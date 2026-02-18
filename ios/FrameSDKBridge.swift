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
  func presentCheckout(_ customerId: NSObject, amount: NSNumber, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let cId = customerId as? String
    let amountInt = amount.intValue
    DispatchQueue.main.async { [weak self] in
      self?.presentCheckoutOnMain(customerId: cId, amount: amountInt, resolve: resolve, reject: reject)
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

  private func findTopViewController() -> UIViewController? {
    // Try React Native / iOS 13+ scene-based window, then delegate window
    let keyWindow: UIWindow? = {
      if #available(iOS 13.0, *) {
        // Prefer the key window from connected scenes
        if let w = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .flatMap({ $0.windows })
          .first(where: { $0.isKeyWindow }) {
          return w
        }
        // Fallback to the first window in the first scene
        if let w = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .flatMap({ $0.windows })
          .first {
          return w
        }
      }
      // On older iOS versions, fall back to the app delegate's window.
      // `UIApplication.shared.delegate?.window` has the type `UIWindow??`, so coalesce to `nil` to obtain `UIWindow?`.
      return UIApplication.shared.delegate?.window ?? nil
    }()
    guard var vc = keyWindow?.rootViewController else {
      return nil
    }
    while let presented = vc.presentedViewController, !presented.isBeingDismissed {
      vc = presented
    }
    return vc
  }

  private func presentCheckoutOnMain(customerId: String?, amount: Int, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let top = findTopViewController() else {
      reject("NO_ROOT_VC", "Could not find root view controller to present checkout", nil)
      return
    }
    presentCheckoutOnMain(from: top, customerId: customerId, amount: amount, resolve: resolve, reject: reject)
  }

  private func presentCheckoutOnMain(from top: UIViewController, customerId: String?, amount: Int, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let delegate = CheckoutDismissDelegate(resolve: resolve, reject: reject)
    let checkoutView = FrameCheckoutView(
      customerId: customerId,
      paymentAmount: amount,
      checkoutCallback: { [weak delegate] chargeIntent in
        delegate?.didComplete = true
        top.dismiss(animated: true)
        DispatchQueue.main.async {
          if let dict = Self.encodeChargeIntent(chargeIntent) {
            resolve(dict)
          } else {
            reject("ENCODE_ERROR", "Failed to encode charge intent", nil)
          }
        }
      }
    )
    let hosting = UIHostingController(rootView: checkoutView)
    hosting.modalPresentationStyle = UIModalPresentationStyle.pageSheet
    if let sheet = hosting.sheetPresentationController {
      sheet.detents = [UISheetPresentationController.Detent.large()]
    }
    objc_setAssociatedObject(hosting, &checkoutDismissKey, delegate, .OBJC_ASSOCIATION_RETAIN)
    hosting.presentationController?.delegate = delegate
    top.present(hosting, animated: true)
  }

  private static func encodeChargeIntent(_ intent: FrameObjects.ChargeIntent) -> [String: Any]? {
    guard let data = try? JSONEncoder().encode(intent) else { return nil }
    return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
  }

  @objc public
  func presentCart(_ customerId: NSObject, items: NSArray, shippingAmountInCents: NSNumber, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let cId = customerId as? String
    let shipping = shippingAmountInCents.intValue
    guard let cartItems = parseCartItems(items) else {
      reject("INVALID_ITEMS", "Invalid cart items array", nil)
      return
    }
    DispatchQueue.main.async { [weak self] in
      guard let top = self?.findTopViewController() else {
        reject("NO_ROOT_VC", "Could not find root view controller to present cart", nil)
        return
      }
      self?.presentCartOnMain(from: top, customerId: cId, cartItems: cartItems, shippingAmountInCents: shipping, resolve: resolve, reject: reject)
    }
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
    hosting.presentationController?.delegate = delegate
    top.present(hosting, animated: true)
  }
}

private final class CheckoutDismissDelegate: NSObject, UIAdaptivePresentationControllerDelegate {
  let resolve: RCTPromiseResolveBlock
  let reject: RCTPromiseRejectBlock
  var didComplete = false
  init(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    self.resolve = resolve
    self.reject = reject
  }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    guard !didComplete else { return }
    DispatchQueue.main.async { [reject] in
      reject("USER_CANCELED", "User dismissed checkout without completing payment", nil)
    }
  }
}

private final class CartDismissDelegate: NSObject, UIAdaptivePresentationControllerDelegate {
  let resolve: RCTPromiseResolveBlock
  init(resolve: @escaping RCTPromiseResolveBlock) { self.resolve = resolve }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    DispatchQueue.main.async { [resolve] in
      resolve([String: Any]())
    }
  }
}

private var cartDismissKey: UInt8 = 0
private var checkoutDismissKey: UInt8 = 0

