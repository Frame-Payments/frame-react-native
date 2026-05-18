//
//  ApplePayPresenter.swift
//  FrameReactNative
//
//  Programmatic Apple Pay presentation for Frame.presentApplePay(). Wraps
//  PKPaymentAuthorizationController + ApplePayAPI + (ChargeIntentsAPI | TransfersAPI)
//  directly so we can detect the user-cancel path — PKPaymentAuthorizationController's
//  didFinish fires for both success and cancel, and the underlying SDK's view
//  model only delivers success, so we re-implement that flow here.
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

  private let amount: Int
  private let currency: String
  private let owner: Owner
  private let resolve: (Any?) -> Void
  private let reject: (String, String, Error?) -> Void

  // Set to true once we've delivered a definitive result (success or backend
  // failure). When didFinish fires without this set, treat as user cancel.
  private var didDeliverResult = false

  // Strong self-retain across the async PassKit flow. Released on didFinish.
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
        deliverFailure(code: "PAYMENT_METHOD_FAILED", error: methodError)
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
          deliverSuccess(id: chargeIntent.id)
          return PKPaymentAuthorizationResult(status: .success, errors: nil)
        } else {
          deliverFailure(code: "PAYMENT_FAILED", error: chargeError)
          return PKPaymentAuthorizationResult(status: .failure, errors: nil)
        }

      case .account(let accountId):
        let request = TransferRequests.CreateTransferRequest(
          amount: amount,
          accountId: accountId,
          currency: currency,
          sourcePaymentMethodId: paymentMethodId
        )
        let (transfer, transferError) = try await TransfersAPI.createTransfer(request: request)

        if let transfer {
          deliverSuccess(id: transfer.id)
          return PKPaymentAuthorizationResult(status: .success, errors: nil)
        } else {
          deliverFailure(code: "PAYMENT_FAILED", error: transferError)
          return PKPaymentAuthorizationResult(status: .failure, errors: nil)
        }
      }
    } catch {
      deliverFailure(code: "PAYMENT_FAILED", error: error)
      return PKPaymentAuthorizationResult(status: .failure, errors: nil)
    }
  }

  func paymentAuthorizationControllerDidFinish(_ controller: PKPaymentAuthorizationController) {
    controller.dismiss()
    if !didDeliverResult {
      reject("USER_CANCELED", "User dismissed Apple Pay sheet without authorizing", nil)
      didDeliverResult = true
    }
    retainCycle = nil
  }

  // MARK: - Result delivery

  private func deliverSuccess(id: String) {
    guard !didDeliverResult else { return }
    didDeliverResult = true
    resolve(id)
  }

  private func deliverFailure(code: String, error: Error?) {
    guard !didDeliverResult else { return }
    didDeliverResult = true
    let message = error?.localizedDescription ?? "Apple Pay failed"
    reject(code, message, error)
  }
}
