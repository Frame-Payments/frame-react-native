//
//  ApplePayPresenter.swift
//  FrameReactNative
//
//  Programmatic Apple Pay presentation for Frame.presentApplePay(). Wraps
//  PKPaymentAuthorizationController + ApplePayAPI + TransfersV2API
//  directly so we can detect the user-cancel path — PKPaymentAuthorizationController's
//  didFinish fires for both success and cancel, and the underlying SDK's view
//  model only delivers success, so we re-implement that flow here. Mirrors
//  FrameApplePayViewModel step-for-step otherwise (frame-ios 4.7+).
//
//  Charges require an account owner and create a V2 Transfer. Customer owners are
//  rejected — ChargeIntents were removed with Transfers V2.
//

import Foundation
import PassKit
import Frame

@MainActor
final class ApplePayPresenter: NSObject, PKPaymentAuthorizationControllerDelegate {

  enum Owner {
    case customer(String)
    case account(String)
  }

  private enum PendingOutcome {
    case success(String)
    case failure(code: String, error: Error?)
  }

  private let amount: Int
  private let currency: String
  private let owner: Owner
  private let resolve: (Any?) -> Void
  private let reject: (String, String, Error?) -> Void

  // The outcome produced in didAuthorizePayment, held until the Apple Pay sheet
  // has actually dismissed. Delivery must not happen inline: the JS caller
  // typically dismisses its own modal on resolution, and on iOS 26+ dismissing
  // the presenting controller while the Apple Pay sheet is still up strands the
  // sheet on screen. Delivering from didFinish's dismiss completion means the
  // sheet is gone before JS reacts. nil at didFinish = user cancel.
  private var pendingResult: PendingOutcome?

  // Set to true once the promise has been settled — guards against a
  // double-fired didFinish settling it twice.
  private var didDeliverResult = false

  // Strong self-retain across the async PassKit flow. Released after delivery.
  private var retainCycle: ApplePayPresenter?

  private static let supportedNetworks: [PKPaymentNetwork] = [
    .visa, .masterCard, .amex, .discover, .JCB
  ]

  /// Backstop delay when `dismiss`'s completion never fires. Must be well past
  /// the sheet animation so the dismiss path wins in the common case.
  private static let dismissBackstopNanoseconds: UInt64 = 2_000_000_000

  init(amount: Int,
       currency: String,
       owner: Owner,
       resolve: @escaping (Any?) -> Void,
       reject: @escaping (String, String, Error?) -> Void) {
    self.amount = amount
    self.currency = currency
    self.owner = owner
    self.resolve = resolve
    self.reject = reject
  }

  static func canMakePayments() -> Bool {
    PKPaymentAuthorizationController.canMakePayments(usingNetworks: supportedNetworks)
  }

  func present() {
    let request = PKPaymentRequest()
    request.merchantIdentifier = FrameNetworking.shared.applePayMerchantId ?? ""
    request.supportedNetworks = Self.supportedNetworks
    request.merchantCapabilities = .threeDSecure
    request.countryCode = "US"
    request.currencyCode = currency.uppercased()
    request.requiredBillingContactFields = [.postalAddress, .name, .emailAddress]
    request.paymentSummaryItems = [
      PKPaymentSummaryItem(
        label: "Total",
        amount: NSDecimalNumber(value: Double(amount) / 100.0)
      )
    ]

    let controller = PKPaymentAuthorizationController(paymentRequest: request)
    controller.delegate = self
    retainCycle = self
    Task { await controller.present() }
  }

  // MARK: - PKPaymentAuthorizationControllerDelegate

  func paymentAuthorizationController(
    _ controller: PKPaymentAuthorizationController,
    didAuthorizePayment payment: PKPayment
  ) async -> PKPaymentAuthorizationResult {
    do {
      // Charges require an account — Transfers V2 has no customer ChargeIntent path.
      guard case .account(let accountId) = owner else {
        pendingResult = .failure(
          code: "INVALID_OWNER",
          error: NSError(
            domain: "FrameReactNative",
            code: 400,
            userInfo: [NSLocalizedDescriptionKey: "Apple Pay charges require an account owner."]
          )
        )
        return PKPaymentAuthorizationResult(status: .failure, errors: nil)
      }

      let (paymentMethod, methodError) = try await ApplePayAPI.createPaymentMethodWithAccountId(
        from: payment, accountId: accountId
      )

      guard let paymentMethodId = paymentMethod?.id else {
        if methodError?.isAssertionRejection == true {
          DeviceAttestationManager.shared.resetAttestation()
        }
        pendingResult = .failure(code: "PAYMENT_METHOD_FAILED", error: methodError)
        return PKPaymentAuthorizationResult(status: .failure, errors: nil)
      }

      // Apple Pay already carries a cryptogram — confirm inline (same as frame-ios 4.7).
      try await SessionManager.shared.ensureSession(accountId: accountId)
      let request = TransferV2Requests.CreateTransferRequest(
        amount: .init(value: amount, currency: currency),
        source: .init(paymentMethodId: paymentMethodId),
        confirm: true,
        authorizationMode: "automatic"
      )
      let (transfer, transferError) = try await TransfersV2API.createTransfer(
        request: request,
        accountId: accountId
      )

      if let transfer {
        pendingResult = .success(transfer.id)
        return PKPaymentAuthorizationResult(status: .success, errors: nil)
      } else {
        pendingResult = .failure(code: "PAYMENT_FAILED", error: transferError)
        return PKPaymentAuthorizationResult(status: .failure, errors: nil)
      }
    } catch {
      pendingResult = .failure(code: "PAYMENT_FAILED", error: error)
      return PKPaymentAuthorizationResult(status: .failure, errors: nil)
    }
  }

  // Dismisses the Apple Pay sheet, then settles the JS promise from the dismiss
  // completion — see `pendingResult` for why delivery is deferred. Unlike the
  // SDK's view model, a nil pendingResult here is delivered as USER_CANCELED
  // instead of silently dropped: cancel detection is the reason this presenter
  // exists.
  func paymentAuthorizationControllerDidFinish(_ controller: PKPaymentAuthorizationController) {
    controller.dismiss { [weak self] in
      Task { @MainActor in
        self?.settleAndRelease()
      }
    }
    // `dismiss`'s completion is not guaranteed to run — if the sheet is already
    // gone (backgrounded, torn down out from under us) UIKit can drop it, which
    // would leave the JS promise unsettled forever and leak `retainCycle`.
    // Settle after a timeout as a backstop. It must be well past the sheet's
    // dismiss animation: firing earlier would beat the completion and deliver
    // while the sheet is still up. `deliver`'s `didDeliverResult` guard makes
    // whichever path runs first the only one that reaches JS.
    Task { @MainActor [weak self] in
      try? await Task.sleep(nanoseconds: Self.dismissBackstopNanoseconds)
      self?.settleAndRelease()
    }
  }

  /// Settles the JS promise from `pendingResult` and drops the self-retain.
  /// Idempotent — safe to call from both the dismiss completion and the backstop.
  @MainActor
  private func settleAndRelease() {
    switch pendingResult {
    case .success(let id):
      deliver { self.resolve(id) }
    case .failure(let code, let error):
      let message = error?.localizedDescription ?? "Apple Pay failed"
      deliver { self.reject(code, message, error) }
    case nil:
      deliver { self.reject("USER_CANCELED", "User dismissed Apple Pay sheet without authorizing", nil) }
    }
    pendingResult = nil
    retainCycle = nil
  }

  // MARK: - Result delivery

  private func deliver(_ settle: () -> Void) {
    guard !didDeliverResult else { return }
    didDeliverResult = true
    settle()
  }
}
