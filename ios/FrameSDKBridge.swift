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
  func initialize(_ apiKey: String, debugMode: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      FrameNetworking.shared.initializeWithAPIKey(apiKey, debugMode: debugMode)
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
    presentOnboardingOnMain(from: viewController, accountId: accountIdString, capabilities: parsedCapabilities, resolve: resolve, reject: reject)
  }

  // MARK: - Private helpers

  private func presentCheckoutOnMain(from top: UIViewController, customerId: String?, amount: Int, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let hosting = CheckoutHostingController(rootView: FrameCheckoutView(
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

  private static func encodeChargeIntent(_ intent: FrameObjects.ChargeIntent) -> [String: Any]? {
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
    let hosting = UIHostingController(rootView: cartView)
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

  private func presentOnboardingOnMain(from top: UIViewController, accountId: String?, capabilities: [FrameObjects.Capabilities], resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let hosting = OnboardingHostingController(
      rootView: OnboardingContainerView(
        accountId: accountId,
        requiredCapabilities: capabilities
      )
    )
    hosting.modalPresentationStyle = UIModalPresentationStyle.pageSheet
    if let sheet = hosting.sheetPresentationController {
      sheet.detents = [UISheetPresentationController.Detent.large()]
    }
    let delegate = OnboardingDismissDelegate(hosting: hosting, resolve: resolve)
    objc_setAssociatedObject(hosting, &onboardingDismissKey, delegate, .OBJC_ASSOCIATION_RETAIN)
    top.present(hosting, animated: true) {
      hosting.presentationController?.delegate = delegate
    }
  }
}

// MARK: - CheckoutHostingController
// Intercepts both dismiss paths for FrameCheckoutView:
//   1. Programmatic: SwiftUI's @Environment(\.dismiss) routes through override dismiss().
//   2. Swipe-to-dismiss: UIAdaptivePresentationControllerDelegate.presentationControllerDidDismiss fires.
// In both cases, if the checkout callback hasn't fired, we reject the promise.
// onCancel is guarded by `cancelled` so it only fires once regardless of dismiss path.

private final class CheckoutHostingController: UIHostingController<FrameCheckoutView>, UIAdaptivePresentationControllerDelegate {
  var didComplete = false
  var onCancel: (() -> Void)?
  private var cancelled = false

  func cancel() {
    guard !didComplete, !cancelled else { return }
    cancelled = true
    onCancel?()
  }

  override func dismiss(animated flag: Bool, completion: (() -> Void)? = nil) {
    cancel()
    super.dismiss(animated: flag, completion: completion)
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    cancel()
  }
}

// MARK: - OnboardingHostingController
// Subclass UIHostingController to intercept programmatic dismiss() calls from OnboardingContainerView.
// When SwiftUI calls @Environment(\.dismiss), it routes through UIHostingController.dismiss(animated:).
// We override this to set programmaticDismiss = true before forwarding.

private final class OnboardingHostingController<V: View>: UIHostingController<V> {
  var programmaticDismiss = false

  override func dismiss(animated flag: Bool, completion: (() -> Void)? = nil) {
    programmaticDismiss = true
    super.dismiss(animated: flag, completion: completion)
  }
}

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
  // Hold a weak reference to the hosting controller to read the programmaticDismiss flag.
  weak var hosting: OnboardingHostingController<OnboardingContainerView>?
  let resolve: RCTPromiseResolveBlock
  var didFinish = false

  init(hosting: OnboardingHostingController<OnboardingContainerView>, resolve: @escaping RCTPromiseResolveBlock) {
    self.hosting = hosting
    self.resolve = resolve
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    guard !didFinish else { return }
    didFinish = true
    let completed = hosting?.programmaticDismiss ?? false
    DispatchQueue.main.async { [resolve, completed] in
      resolve(["status": completed ? "completed" : "cancelled"])
    }
  }
}

private var cartDismissKey: UInt8 = 0
private var onboardingDismissKey: UInt8 = 0
