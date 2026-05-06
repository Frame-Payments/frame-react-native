//
//  FrameSDKBridge.swift
//  FrameReactNative
//
//  Bridges Frame iOS SDK to React Native.
//

import Foundation
import React
import UIKit
import SwiftUI
import Frame
import FrameOnboarding

@objc(ObjCFrameSDKBridge)
public class FrameSDKBridge: NSObject {

  @objc public static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc public
  func initialize(_ secretKey: String, publishableKey: String, debugMode: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      FrameNetworking.shared.initializeWithAPIKey(secretKey, publishableKey: publishableKey, debugMode: debugMode)
      resolve(nil)
    }
  }

  @objc public
  func setTheme(_ theme: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let dict = theme as? [String: Any] ?? [:]
      FrameRNTheme.current = dict.isEmpty ? nil : FrameRNTheme.parse(dict)
      resolve(nil)
    }
  }

  @objc public
  func presentCheckout(from viewController: UIViewController, customerId: String?, amount: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    presentCheckoutOnMain(from: viewController, customerId: customerId, amount: amount, resolve: resolve, reject: reject)
  }

  @objc public
  func presentCart(from viewController: UIViewController, customerId: NSObject?, items: NSArray, shippingAmountInCents: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let cartItems = parseCartItems(items) else {
      reject("INVALID_ITEMS", "Invalid cart items array", nil)
      return
    }
    presentCartOnMain(from: viewController, customerId: customerId as? String, cartItems: cartItems, shippingAmountInCents: shippingAmountInCents, resolve: resolve, reject: reject)
  }

  @objc public
  func presentOnboarding(from viewController: UIViewController, accountId: NSObject?, capabilities: NSArray, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let parsedCapabilities = parseCapabilities(capabilities)
    let accountIdString = accountId as? String
    presentOnboardingOnMain(from: viewController, accountId: accountIdString, capabilities: parsedCapabilities, applePayMerchantId: nil, resolve: resolve, reject: reject)
  }

  @objc public
  func presentOnboardingWithApplePay(from viewController: UIViewController, accountId: NSObject?, capabilities: NSArray, applePayMerchantId: NSObject?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let parsedCapabilities = parseCapabilities(capabilities)
    let accountIdString = accountId as? String
    let merchantIdString = applePayMerchantId as? String
    presentOnboardingOnMain(from: viewController, accountId: accountIdString, capabilities: parsedCapabilities, applePayMerchantId: merchantIdString, resolve: resolve, reject: reject)
  }

  @objc public
  func presentApplePay(_ ownerType: String, ownerId: String, amount: Int, currency: String, merchantId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      Task { @MainActor in
        let owner: FrameApplePayViewModel.PaymentMethodOwner
        switch ownerType {
        case "customer": owner = .customer(ownerId)
        case "account": owner = .account(ownerId)
        default:
          reject("INVALID_OWNER", "owner.type must be 'customer' or 'account'", nil)
          return
        }
        guard !ownerId.isEmpty else {
          reject("INVALID_OWNER", "owner.id must be non-empty", nil)
          return
        }
        guard !merchantId.isEmpty else {
          reject("INVALID_MERCHANT_ID", "merchantId must be non-empty", nil)
          return
        }
        guard ApplePayPresenter.canMakePayments() else {
          reject("APPLE_PAY_UNAVAILABLE", "This device cannot make Apple Pay payments", nil)
          return
        }
        guard DeviceAttestationManager.shared.isDeviceAttested else {
          // Kick off attestation asynchronously so the next attempt has a chance to succeed.
          Task { try? await DeviceAttestationManager.shared.attestDevice() }
          reject("NOT_ATTESTED", "Device attestation has not completed yet. Please try again.", nil)
          return
        }

        let presenter = ApplePayPresenter(
          amount: amount,
          currency: currency,
          owner: owner,
          merchantId: merchantId,
          resolve: { resolve($0) },
          reject: { code, message, error in reject(code, message, error) }
        )
        presenter.present()
      }
    }
  }

  // MARK: - Private helpers

  private func presentCheckoutOnMain(from top: UIViewController, customerId: String?, amount: Int, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    var hosting: CheckoutHostingController!
    hosting = CheckoutHostingController(rootView: ThemedRoot(
      FrameCheckoutView(
        customerId: customerId,
        paymentAmount: amount,
        checkoutCallback: { [weak hosting] chargeIntent in
          hosting?.didComplete = true
          top.dismiss(animated: true)
          DispatchQueue.main.async {
            if let dict = Self.encodeChargeIntent(chargeIntent) {
              resolve(dict)
            } else {
              reject("ENCODE_ERROR", "Failed to encode charge intent", nil)
            }
          }
        }
      ),
      theme: FrameRNTheme.resolved()
    ))
    hosting.onCancel = {
      DispatchQueue.main.async {
        reject("USER_CANCELED", "User dismissed checkout without completing payment", nil)
      }
    }
    hosting.modalPresentationStyle = UIModalPresentationStyle.pageSheet
    if let sheet = hosting.sheetPresentationController {
      sheet.detents = [UISheetPresentationController.Detent.large()]
    }
    top.present(hosting, animated: true) {
      hosting.presentationController?.delegate = hosting
    }
  }

  internal static func encodeChargeIntent(_ intent: FrameObjects.ChargeIntent) -> [String: Any]? {
    guard let data = try? JSONEncoder().encode(intent) else { return nil }
    return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
  }

  private struct RNFrameCartItem: FrameCartItem {
    var id: String
    var imageURL: String
    var title: String
    var amountInCents: Int
  }

  private func parseCartItems(_ items: NSArray) -> [RNFrameCartItem]? {
    var result: [RNFrameCartItem] = []
    for item in items {
      guard let dict = item as? NSDictionary,
            let id = dict["id"] as? String,
            let title = dict["title"] as? String,
            let amountInCents = dict["amountInCents"] as? Int else { return nil }
      let imageURL = (dict["imageUrl"] as? String) ?? (dict["imageURL"] as? String) ?? ""
      result.append(RNFrameCartItem(id: id, imageURL: imageURL, title: title, amountInCents: amountInCents))
    }
    return result
  }

  private func parseCapabilities(_ capabilities: NSArray) -> [FrameObjects.Capabilities] {
    var result: [FrameObjects.Capabilities] = []
    for item in capabilities {
      guard let raw = item as? String,
            let cap = FrameObjects.Capabilities(rawValue: raw) else { continue }
      result.append(cap)
    }
    return result
  }

  private func presentCartOnMain(from top: UIViewController, customerId: String?, cartItems: [RNFrameCartItem], shippingAmountInCents: Int, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let cartView = FrameCartView(
      customer: nil,
      cartItems: cartItems,
      shippingAmountInCents: shippingAmountInCents
    )
    let hosting = UIHostingController(rootView: ThemedRoot(cartView, theme: FrameRNTheme.resolved()))
    hosting.modalPresentationStyle = UIModalPresentationStyle.pageSheet
    if let sheet = hosting.sheetPresentationController {
      sheet.detents = [UISheetPresentationController.Detent.large()]
    }
    // When the sheet is dismissed (swipe or close), resolve. Note: FrameCartView does not expose ChargeIntent from nested checkout.
    let delegate = CartDismissDelegate(resolve: resolve)
    objc_setAssociatedObject(hosting, &cartDismissKey, delegate, .OBJC_ASSOCIATION_RETAIN)
    top.present(hosting, animated: true) {
      hosting.presentationController?.delegate = delegate
    }
  }

  private func presentOnboardingOnMain(from top: UIViewController, accountId: String?, capabilities: [FrameObjects.Capabilities], applePayMerchantId: String?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    var hosting: OnboardingHostingController<ThemedRoot<OnboardingContainerView>>!
    var delegate: OnboardingDismissDelegate!
    hosting = OnboardingHostingController(
      rootView: ThemedRoot(
        OnboardingContainerView(
          accountId: accountId,
          requiredCapabilities: capabilities,
          applePayMerchantId: applePayMerchantId,
          onComplete: { [weak hosting] in
            delegate?.finish(completed: true)
            hosting?.dismiss(animated: true)
          }
        ),
        theme: FrameRNTheme.resolved()
      )
    )
    // Embed in a UINavigationController so the outer sheet is a UIKit container,
    // not a SwiftUI-bridged one. On iOS 18, presenting the UIHostingController
    // directly causes SwiftUI's SheetBridge to call dismiss on the host whenever
    // a nested .sheet() inside the onboarding flow toggles its binding (its
    // preferencesDidChange propagates up to the outer bridge). The nav
    // controller breaks that propagation. Nav bar is hidden so the sheet looks
    // identical to before.
    let nav = UINavigationController(rootViewController: hosting)
    nav.setNavigationBarHidden(true, animated: false)
    nav.modalPresentationStyle = UIModalPresentationStyle.pageSheet
    if let sheet = nav.sheetPresentationController {
      sheet.detents = [UISheetPresentationController.Detent.large()]
    }
    delegate = OnboardingDismissDelegate(resolve: resolve)
    delegate.hostingController = nav
    objc_setAssociatedObject(nav, &onboardingDismissKey, delegate, .OBJC_ASSOCIATION_RETAIN)
    NSLog("[FrameRN][onb] presenting OnboardingHostingController (wrapped in UINavigationController) from \(type(of: top))")
    top.present(nav, animated: true) {
      nav.presentationController?.delegate = delegate
      NSLog("[FrameRN][onb] presentation completed; presentationController=\(String(describing: nav.presentationController)) delegate set")
    }
  }
}

// MARK: - CheckoutHostingController

private final class CheckoutHostingController: UIHostingController<ThemedRoot<FrameCheckoutView>>, UIAdaptivePresentationControllerDelegate {
  var didComplete = false
  var onCancel: (() -> Void)?
  private var cancelled = false

  func cancel() {
    guard !didComplete, !cancelled else { return }
    cancelled = true
    onCancel?()
  }

  override func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    cancel()
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    cancel()
  }
}

// MARK: - OnboardingHostingController

private final class OnboardingHostingController<V: View>: UIHostingController<V> {}

// MARK: - Delegates

private final class CartDismissDelegate: NSObject, UIAdaptivePresentationControllerDelegate {
  let resolve: RCTPromiseResolveBlock
  init(resolve: @escaping RCTPromiseResolveBlock) { self.resolve = resolve }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    DispatchQueue.main.async { [resolve] in
      resolve([String: Any]())
    }
  }
}

private final class OnboardingDismissDelegate: NSObject, UIAdaptivePresentationControllerDelegate {
  let resolve: RCTPromiseResolveBlock
  weak var hostingController: UIViewController?
  var didFinish = false

  init(resolve: @escaping RCTPromiseResolveBlock) {
    self.resolve = resolve
  }

  func finish(completed: Bool) {
    guard !didFinish else { return }
    didFinish = true
    DispatchQueue.main.async { [resolve, completed] in
      resolve(["status": completed ? "completed" : "cancelled"])
    }
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    // Nested SwiftUI sheets (e.g. the phone country picker) propagate this
    // callback to the Onboarding host's delegate. Only treat dismissal of the
    // Onboarding hosting controller itself as a cancellation.
    guard presentationController.presentedViewController === hostingController else { return }
    finish(completed: false)
  }
}

private var cartDismissKey: UInt8 = 0
private var onboardingDismissKey: UInt8 = 0
