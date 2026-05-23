import Foundation
import PassKit

// Two-step Apple Pay bridge.
//
// `presentApplePay` opens the PassKit sheet, waits for the user to authorize a
// payment, and resolves the JS promise with the resulting PKPayment token plus
// billing / payer fields. PassKit's authorization completion handler is held
// open at that point — the sheet stays up with its spinner — so JS can call
// the Frame backend without flicker.
//
// JS finishes by calling `finishApplePay('success' | 'failure')`. We invoke
// the stored completion handler with the matching status, and PassKit then
// dismisses the sheet.
//
// User cancel: PassKit calls `paymentAuthorizationControllerDidFinish` without
// first authorizing. We reject the in-flight `presentApplePay` promise with
// USER_CANCELED. JS must NOT call finishApplePay in this branch — there is no
// open completion handler.

@objc(FrameApplePay)
public class FrameApplePay: NSObject, PKPaymentAuthorizationControllerDelegate {

  private var controller: PKPaymentAuthorizationController?
  private var presentResolve: RCTPromiseResolveBlock?
  private var presentReject: RCTPromiseRejectBlock?
  private var authCompletion: ((PKPaymentAuthorizationResult) -> Void)?
  private var didAuthorize = false

  // MARK: - canMakeApplePay

  @objc public func canMakeApplePay(_ resolve: @escaping RCTPromiseResolveBlock,
                                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    let networks = Self.parseNetworks(nil)
    resolve(PKPaymentAuthorizationController.canMakePayments(usingNetworks: networks))
  }

  // MARK: - presentApplePay

  @objc public func presentApplePay(_ args: NSDictionary,
                                     resolver resolve: @escaping RCTPromiseResolveBlock,
                                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else {
        reject("APPLE_PAY_BRIDGE_GONE", "Apple Pay bridge was deallocated.", nil)
        return
      }

      if self.controller != nil {
        reject("APPLE_PAY_BUSY", "An Apple Pay sheet is already presenting.", nil)
        return
      }

      guard let merchantId = args["applePayMerchantId"] as? String, !merchantId.isEmpty else {
        reject("APPLE_PAY_INVALID_ARGS", "applePayMerchantId is required.", nil)
        return
      }
      // JS numbers cross the RN bridge as NSNumber (backed by Double). Reject
      // fractional cents explicitly — silently truncating $12.34.56 to 1234
      // cents would lose half a dollar without surfacing to the caller.
      let amount: Int
      if let n = args["amount"] as? NSNumber {
        let d = n.doubleValue
        guard d.truncatingRemainder(dividingBy: 1.0) == 0, d.isFinite else {
          reject("APPLE_PAY_INVALID_ARGS", "amount must be an integer (cents).", nil)
          return
        }
        amount = Int(d)
      } else if let i = args["amount"] as? Int {
        amount = i
      } else {
        reject("APPLE_PAY_INVALID_ARGS", "amount is required.", nil)
        return
      }
      let currency = (args["currency"] as? String) ?? "USD"
      let countryCode = (args["countryCode"] as? String) ?? "US"
      let networks = Self.parseNetworks(args["supportedNetworks"] as? [String])

      let request = PKPaymentRequest()
      request.merchantIdentifier = merchantId
      request.supportedNetworks = networks
      request.merchantCapabilities = .threeDSecure
      request.countryCode = countryCode
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
      self.controller = controller
      self.presentResolve = resolve
      self.presentReject = reject
      self.didAuthorize = false

      controller.present { [weak self] presented in
        if presented { return }
        DispatchQueue.main.async {
          guard let self = self else { return }
          self.failPresent("APPLE_PAY_PRESENT_FAILED", "Apple Pay sheet failed to present.")
        }
      }
    }
  }

  // MARK: - finishApplePay

  @objc public func finishApplePay(_ status: NSString,
                                    resolver resolve: @escaping RCTPromiseResolveBlock,
                                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else {
        reject("APPLE_PAY_BRIDGE_GONE", "Apple Pay bridge was deallocated.", nil)
        return
      }
      guard let completion = self.authCompletion else {
        // Sheet was already dismissed (user canceled, or didFinish fired). Soft-success
        // so JS error-cleanup paths don't double-throw.
        resolve(nil)
        return
      }
      self.authCompletion = nil
      let pkStatus: PKPaymentAuthorizationStatus = (status as String == "success") ? .success : .failure
      completion(PKPaymentAuthorizationResult(status: pkStatus, errors: nil))
      resolve(nil)
    }
  }

  // MARK: - PKPaymentAuthorizationControllerDelegate

  public func paymentAuthorizationController(
    _ controller: PKPaymentAuthorizationController,
    didAuthorizePayment payment: PKPayment,
    handler completion: @escaping (PKPaymentAuthorizationResult) -> Void
  ) {
    didAuthorize = true
    authCompletion = completion

    guard let resolve = presentResolve else {
      // Defensive: PassKit fired didAuthorize without a pending presentApplePay
      // promise. Settle as failure and dismiss.
      completion(PKPaymentAuthorizationResult(status: .failure, errors: nil))
      authCompletion = nil
      return
    }
    presentResolve = nil
    presentReject = nil

    let response = Self.serializePayment(payment)
    resolve(response)
  }

  public func paymentAuthorizationControllerDidFinish(_ controller: PKPaymentAuthorizationController) {
    controller.dismiss { [weak self] in
      DispatchQueue.main.async {
        guard let self = self else { return }
        if !self.didAuthorize, let reject = self.presentReject {
          reject("USER_CANCELED", "User dismissed Apple Pay sheet without authorizing.", nil)
        }
        self.presentResolve = nil
        self.presentReject = nil
        self.authCompletion = nil
        self.controller = nil
      }
    }
  }

  // MARK: - Helpers

  private func failPresent(_ code: String, _ message: String) {
    guard let reject = presentReject else { return }
    presentResolve = nil
    presentReject = nil
    controller = nil
    reject(code, message, nil)
  }

  private static func parseNetworks(_ raw: [String]?) -> [PKPaymentNetwork] {
    let defaults: [PKPaymentNetwork] = [.visa, .masterCard, .amex, .discover, .JCB]
    guard let raw = raw, !raw.isEmpty else { return defaults }
    return raw.compactMap { name -> PKPaymentNetwork? in
      switch name.lowercased() {
      case "visa": return .visa
      case "mastercard": return .masterCard
      case "amex": return .amex
      case "discover": return .discover
      case "jcb": return .JCB
      case "interac": return .interac
      case "chinaunionpay", "cup": return .chinaUnionPay
      default: return nil
      }
    }
  }

  // Mirrors the ApplePayBridgeResponse JS shape:
  //   { token: { paymentData (base64), paymentMethod, transactionIdentifier },
  //     billingContact?, payerName?, payerEmail? }
  private static func serializePayment(_ payment: PKPayment) -> [String: Any] {
    let token = payment.token
    let pm = token.paymentMethod

    let paymentMethod: [String: Any] = [
      "displayName": pm.displayName ?? "",
      "network": pm.network?.rawValue ?? "",
      "type": Self.paymentMethodTypeString(pm.type),
    ]

    let tokenDict: [String: Any] = [
      "paymentData": token.paymentData.base64EncodedString(),
      "paymentMethod": paymentMethod,
      "transactionIdentifier": token.transactionIdentifier,
    ]

    var out: [String: Any] = ["token": tokenDict]

    if let billing = payment.billingContact {
      var billingDict: [String: Any] = [:]
      if let postal = billing.postalAddress {
        let lines = postal.street.split(separator: "\n").map(String.init)
        if !lines.isEmpty {
          billingDict["addressLines"] = lines
        }
        billingDict["locality"] = postal.city
        billingDict["administrativeArea"] = postal.state
        billingDict["postalCode"] = postal.postalCode
        billingDict["countryCode"] = postal.isoCountryCode
      }
      if let name = billing.name {
        let formatter = PersonNameComponentsFormatter()
        let full = formatter.string(from: name)
        if !full.isEmpty {
          out["payerName"] = full
        }
      }
      if let email = billing.emailAddress {
        out["payerEmail"] = email
      }
      if !billingDict.isEmpty {
        out["billingContact"] = billingDict
      }
    }

    return out
  }

  private static func paymentMethodTypeString(_ type: PKPaymentMethodType) -> String {
    switch type {
    case .debit: return "debit"
    case .credit: return "credit"
    case .prepaid: return "prepaid"
    case .store: return "store"
    case .eMoney: return "eMoney"
    case .unknown: return "unknown"
    @unknown default: return "unknown"
    }
  }
}
