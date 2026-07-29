//
//  ApplePayPresenter.swift
//  FrameReactNative
//
//  Programmatic Apple Pay presentation for Frame.presentApplePay(). Wraps
//  PKPaymentAuthorizationController + ApplePayAPI + (ChargeIntentsAPI | TransfersAPI)
//  directly so we can detect the user-cancel path — PKPaymentAuthorizationController's
//  didFinish fires for both success and cancel, and the underlying SDK's view
//  model only delivers success, so we re-implement that flow here. Mirrors
//  FrameApplePayViewModel step-for-step otherwise.
//
//  Supports both:
//   - `.customer(id)` owner → creates a `ChargeIntent`; resolves with the ChargeIntent id.
//   - `.account(id)`  owner → creates a `Transfer`;     resolves with the Transfer id.
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
      // 1. Create the Frame PaymentMethod from the Apple Pay token, scoped to
      //    whichever owner the caller asked for.
      let (paymentMethod, methodError): (FrameObjects.PaymentMethod?, NetworkingError?)
      switch owner {
      case .customer(let customerId):
        (paymentMethod, methodError) = try await ApplePayAPI.createPaymentMethodWithCustomerId(
          from: payment, customerId: customerId
        )
      case .account(let accountId):
        (paymentMethod, methodError) = try await ApplePayAPI.createPaymentMethodWithAccountId(
          from: payment, accountId: accountId
        )
      }

      guard let paymentMethodId = paymentMethod?.id else {
        if methodError?.isAssertionRejection == true {
          DeviceAttestationManager.shared.resetAttestation()
        }
        pendingResult = .failure(code: "PAYMENT_METHOD_FAILED", error: methodError)
        return PKPaymentAuthorizationResult(status: .failure, errors: nil)
      }

      // 2. Create the charge. Customer owners produce a ChargeIntent; account
      //    owners produce a Transfer. Both surface the resulting id to JS — the
      //    caller knows which resource the id refers to based on the owner.
      switch owner {
      case .customer(let customerId):
        let request = ChargeIntentsRequests.CreateChargeIntentRequest(
          amount: amount,
          currency: currency,
          customer: customerId,
          paymentMethod: paymentMethodId,
          confirm: true,
          authorizationMode: .automatic
        )
        let (chargeIntent, chargeError) = try await ChargeIntentsAPI.createChargeIntent(request: request)

        if let chargeIntent {
          pendingResult = .success(chargeIntent.id)
          return PKPaymentAuthorizationResult(status: .success, errors: nil)
        } else {
          pendingResult = .failure(code: "PAYMENT_FAILED", error: chargeError)
          return PKPaymentAuthorizationResult(status: .failure, errors: nil)
        }

      case .account(let accountId):
        // The server rejects the transfer outright without a live session for this account.
        try await SessionManager.shared.ensureSession(accountId: accountId)

        let request = TransferRequests.CreateTransferRequest(
          amount: amount,
          accountId: accountId,
          currency: currency,
          sourcePaymentMethodId: paymentMethodId
        )
        let (transfer, transferError) = try await TransfersAPI.createTransfer(request: request)

        if let transfer {
          pendingResult = .success(transfer.id)
          return PKPaymentAuthorizationResult(status: .success, errors: nil)
        } else {
          pendingResult = .failure(code: "PAYMENT_FAILED", error: transferError)
          return PKPaymentAuthorizationResult(status: .failure, errors: nil)
        }
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
    // Settle on the next main-actor turn as a backstop; `deliver`'s
    // `didDeliverResult` guard makes whichever path runs first the only one
    // that reaches JS.
    Task { @MainActor [weak self] in
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
