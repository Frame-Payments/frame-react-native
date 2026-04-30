//
//  ApplePayPresenter.swift
//  FrameReactNative
//
//  Programmatic Apple Pay presentation for Frame.presentApplePay(). Wraps
//  PKPaymentAuthorizationController + ApplePayAPI + ChargeIntentsAPI directly
//  so we can detect the user-cancel path (PKPaymentAuthorizationController's
//  didFinish fires for both success and cancel; the underlying SDK's view
//  model only delivers success, so we re-implement that flow here).
//

import Foundation
import PassKit
import Frame

@MainActor
final class ApplePayPresenter: NSObject, PKPaymentAuthorizationControllerDelegate {

  private let amount: Int
  private let currency: String
  private let owner: FrameApplePayViewModel.PaymentMethodOwner
  private let merchantId: String
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
       owner: FrameApplePayViewModel.PaymentMethodOwner,
       merchantId: String,
       resolve: @escaping (Any?) -> Void,
       reject: @escaping (String, String, Error?) -> Void) {
    self.amount = amount
    self.currency = currency
    self.owner = owner
    self.merchantId = merchantId
    self.resolve = resolve
    self.reject = reject
  }

  static func canMakePayments() -> Bool {
    PKPaymentAuthorizationController.canMakePayments(usingNetworks: supportedNetworks)
  }

  func present() {
    let request = PKPaymentRequest()
    request.merchantIdentifier = merchantId
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

      let request: ChargeIntentsRequests.CreateChargeIntentRequest
      switch owner {
      case .customer(let customerId):
        request = ChargeIntentsRequests.CreateChargeIntentRequest(
          amount: amount, currency: currency, customer: customerId,
          paymentMethod: paymentMethodId, confirm: true, authorizationMode: .automatic
        )
      case .account(let accountId):
        request = ChargeIntentsRequests.CreateChargeIntentRequest(
          amount: amount, currency: currency, account: accountId,
          paymentMethod: paymentMethodId, confirm: true, authorizationMode: .automatic
        )
      }
      let (chargeIntent, chargeError) = try await ChargeIntentsAPI.createChargeIntent(request: request)

      if let chargeIntent {
        deliverSuccess(chargeIntent)
        return PKPaymentAuthorizationResult(status: .success, errors: nil)
      } else {
        deliverFailure(code: "CHARGE_INTENT_FAILED", error: chargeError)
        return PKPaymentAuthorizationResult(status: .failure, errors: nil)
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

  private func deliverSuccess(_ intent: FrameObjects.ChargeIntent) {
    guard !didDeliverResult else { return }
    didDeliverResult = true
    if let dict = FrameSDKBridge.encodeChargeIntent(intent) {
      resolve(dict)
    } else {
      reject("ENCODE_ERROR", "Failed to encode charge intent", nil)
    }
  }

  private func deliverFailure(code: String, error: Error?) {
    guard !didDeliverResult else { return }
    didDeliverResult = true
    let message = error?.localizedDescription ?? "Apple Pay failed"
    reject(code, message, error)
  }
}
