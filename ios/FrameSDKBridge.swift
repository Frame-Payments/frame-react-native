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

