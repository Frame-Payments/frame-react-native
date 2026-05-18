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
  func initialize(_ secretKey: String, publishableKey: String, debugMode: Bool, applePayMerchantId: NSObject?, googlePayMerchantId: NSObject?, theme: NSDictionary?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let themeDict = theme as? [String: Any] ?? [:]
      let resolvedTheme = themeDict.isEmpty ? FrameTheme.default : FrameRNTheme.parse(themeDict)
      // googlePayMerchantId is iOS-side ignored — frame-iOS has no Google Pay surface today.
      // Accepted in the bridge signature so the JS Frame.initialize() API stays cross-platform.
      _ = googlePayMerchantId
      let applePayMerchantIdString = applePayMerchantId as? String
      FrameNetworking.shared.initializeWithAPIKey(
        secretKey,
        publishableKey: publishableKey,
        applePayMerchantId: applePayMerchantIdString,
        theme: resolvedTheme,
        debugMode: debugMode
      )
      resolve(nil)
    }
  }

  @objc public
  func presentCheckout(from viewController: UIViewController, accountId: String?, amount: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let accountId, !accountId.isEmpty else {
      reject("INVALID_ACCOUNT", "Frame.presentCheckout requires a non-empty accountId", nil)
      return
    }
    presentCheckoutOnMain(from: viewController, accountId: accountId, amount: amount, resolve: resolve, reject: reject)
  }

  @objc public
  func presentCart(from viewController: UIViewController, accountId: NSObject?, items: NSArray, shippingAmountInCents: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let cartItems = parseCartItems(items) else {
      reject("INVALID_ITEMS", "Invalid cart items array", nil)
      return
    }
    guard let accountIdString = accountId as? String, !accountIdString.isEmpty else {
      reject("INVALID_ACCOUNT", "Frame.presentCart requires a non-empty accountId", nil)
      return
    }
    presentCartOnMain(from: viewController, accountId: accountIdString, cartItems: cartItems, shippingAmountInCents: shippingAmountInCents, resolve: resolve, reject: reject)
  }

  @objc public
  func presentOnboarding(from viewController: UIViewController, accountId: NSObject?, capabilities: NSArray, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let parsedCapabilities = parseCapabilities(capabilities)
    let accountIdString = accountId as? String
    presentOnboardingOnMain(from: viewController, accountId: accountIdString, capabilities: parsedCapabilities, resolve: resolve, reject: reject)
  }

  @objc public
  func presentApplePay(_ ownerType: String, ownerId: String, amount: Int, currency: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      Task { @MainActor in
        let owner: ApplePayPresenter.Owner
        switch ownerType {
        case "customer": owner = .customer(ownerId)
        case "account":  owner = .account(ownerId)
        default:
          reject("INVALID_OWNER", "owner.type must be 'customer' or 'account'", nil)
          return
        }
        guard !ownerId.isEmpty else {
          reject("INVALID_OWNER", "owner.id must be non-empty", nil)
          return
        }
        let configuredMerchantId = FrameNetworking.shared.applePayMerchantId ?? ""
        guard !configuredMerchantId.isEmpty else {
          reject("INVALID_MERCHANT_ID", "Apple Pay merchant ID is not configured. Pass `applePayMerchantId` to Frame.initialize().", nil)
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
          resolve: { resolve($0) },
          reject: { code, message, error in reject(code, message, error) }
        )
        presenter.present()
      }
    }
  }

  // MARK: - Private helpers

  private func presentCheckoutOnMain(from top: UIViewController, accountId: String, amount: Int, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // Single dismiss delegate guards against double-resolve. The native FrameCheckoutView now
    // emits `.cancelled` on its own .onDisappear and the bridge's
    // `presentationControllerDidDismiss` ALSO fires on swipe-down — the delegate's `didFinish`
    // guard prevents the double-resolve.
    let delegate = CheckoutDismissDelegate(resolve: resolve, reject: reject)
    let checkoutView = FrameCheckoutView(
      accountId: accountId,
      paymentAmount: amount,
      onResult: { [weak top, delegate] result in
        switch result {
        case .completed(let id):
          delegate.finish(.success(id))
        case .cancelled:
          delegate.finish(.cancel)
        case .failed:
          delegate.finish(.failure)
        }
        top?.dismiss(animated: true)
      }
    )
    let hosting = UIHostingController(rootView: checkoutView)
    hosting.modalPresentationStyle = UIModalPresentationStyle.pageSheet
    if let sheet = hosting.sheetPresentationController {
      sheet.detents = [UISheetPresentationController.Detent.large()]
    }
    objc_setAssociatedObject(hosting, &checkoutDismissKey, delegate, .OBJC_ASSOCIATION_RETAIN)
    top.present(hosting, animated: true) {
      hosting.presentationController?.delegate = delegate
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

  private func parseCapabilities(_ capabilities: NSArray) -> [FrameObjects.Capabilities] {
    var result: [FrameObjects.Capabilities] = []
    for item in capabilities {
      guard let raw = item as? String,
            let cap = FrameObjects.Capabilities(rawValue: raw) else { continue }
      result.append(cap)
    }
    return result
  }

  private func presentCartOnMain(from top: UIViewController, accountId: String, cartItems: [RNFrameCartItem], shippingAmountInCents: Int, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // Single dismiss delegate guards against double-resolve. The native FrameCartView's own
    // .onDisappear emits `.cancelled`, and the bridge's `presentationControllerDidDismiss`
    // also fires on swipe-down — the delegate's `didFinish` guard prevents re-resolve.
    let delegate = CartDismissDelegate(resolve: resolve, reject: reject)
    let cartView = FrameCartView(
      accountId: accountId,
      cartItems: cartItems,
      shippingAmountInCents: shippingAmountInCents,
      onResult: { [weak top, delegate] result in
        switch result {
        case .completed(let id):
          delegate.finish(.success(id))
        case .cancelled:
          delegate.finish(.cancel)
        case .failed:
          delegate.finish(.failure)
        }
        top?.dismiss(animated: true)
      }
    )
    let hosting = UIHostingController(rootView: cartView)
    hosting.modalPresentationStyle = UIModalPresentationStyle.pageSheet
    if let sheet = hosting.sheetPresentationController {
      sheet.detents = [UISheetPresentationController.Detent.large()]
    }
    objc_setAssociatedObject(hosting, &cartDismissKey, delegate, .OBJC_ASSOCIATION_RETAIN)
    top.present(hosting, animated: true) {
      hosting.presentationController?.delegate = delegate
    }
  }

  private func presentOnboardingOnMain(from top: UIViewController, accountId: String?, capabilities: [FrameObjects.Capabilities], resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // Build the dismiss delegate up-front so onResult captures a non-nil instance directly.
    let delegate = OnboardingDismissDelegate(resolve: resolve)

    let hosting = OnboardingHostingController(
      rootView: OnboardingContainerView(
        accountId: accountId,
        requiredCapabilities: capabilities,
        onResult: { [delegate, weak top] result in
          switch result {
          case .completed(let id):
            delegate.finish(.completed(paymentMethodId: id.isEmpty ? nil : id))
          case .cancelled:
            delegate.finish(.cancelled)
          case .failed:
            delegate.finish(.cancelled)
          }
          top?.dismiss(animated: true)
        }
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
    delegate.hostingController = nav
    objc_setAssociatedObject(nav, &onboardingDismissKey, delegate, .OBJC_ASSOCIATION_RETAIN)
    NSLog("[FrameRN][onb] presenting OnboardingHostingController (wrapped in UINavigationController) from \(type(of: top))")
    top.present(nav, animated: true) {
      nav.presentationController?.delegate = delegate
      NSLog("[FrameRN][onb] presentation completed; presentationController=\(String(describing: nav.presentationController)) delegate set")
    }
  }
}

// MARK: - OnboardingHostingController

private final class OnboardingHostingController<V: View>: UIHostingController<V> {}

// MARK: - Delegates

private final class CheckoutDismissDelegate: NSObject, UIAdaptivePresentationControllerDelegate {
  enum Outcome {
    case success(String)
    case failure
    case cancel
  }

  private let resolve: RCTPromiseResolveBlock
  private let reject: RCTPromiseRejectBlock
  private var didFinish = false

  init(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    self.resolve = resolve
    self.reject = reject
  }

  func finish(_ outcome: Outcome) {
    guard !didFinish else { return }
    didFinish = true
    DispatchQueue.main.async { [resolve, reject] in
      switch outcome {
      case .success(let transferId): resolve(transferId)
      case .failure: reject("PAYMENT_FAILED", "Checkout did not produce a transfer id", nil)
      case .cancel: reject("USER_CANCELED", "User dismissed checkout without completing payment", nil)
      }
    }
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    finish(.cancel)
  }
}

private final class CartDismissDelegate: NSObject, UIAdaptivePresentationControllerDelegate {
  enum Outcome {
    case success(String)
    case failure
    case cancel
  }

  private let resolve: RCTPromiseResolveBlock
  private let reject: RCTPromiseRejectBlock
  private var didFinish = false

  init(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    self.resolve = resolve
    self.reject = reject
  }

  func finish(_ outcome: Outcome) {
    guard !didFinish else { return }
    didFinish = true
    DispatchQueue.main.async { [resolve, reject] in
      switch outcome {
      case .success(let transferId): resolve(transferId)
      case .failure: reject("PAYMENT_FAILED", "Cart checkout did not produce a transfer id", nil)
      case .cancel: reject("USER_CANCELED", "User dismissed cart without completing checkout", nil)
      }
    }
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    finish(.cancel)
  }
}

private final class OnboardingDismissDelegate: NSObject, UIAdaptivePresentationControllerDelegate {
  enum Outcome {
    case completed(paymentMethodId: String?)
    case cancelled
  }

  let resolve: RCTPromiseResolveBlock
  weak var hostingController: UIViewController?
  var didFinish = false

  init(resolve: @escaping RCTPromiseResolveBlock) {
    self.resolve = resolve
  }

  func finish(_ outcome: Outcome) {
    guard !didFinish else { return }
    didFinish = true
    DispatchQueue.main.async { [resolve] in
      switch outcome {
      case .completed(let paymentMethodId):
        var payload: [String: Any] = ["status": "completed"]
        if let paymentMethodId { payload["paymentMethodId"] = paymentMethodId }
        resolve(payload)
      case .cancelled:
        resolve(["status": "cancelled"])
      }
    }
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    // Nested SwiftUI sheets (e.g. the phone country picker) propagate this
    // callback to the Onboarding host's delegate. Only treat dismissal of the
    // Onboarding hosting controller itself as a cancellation.
    guard presentationController.presentedViewController === hostingController else { return }
    finish(.cancelled)
  }
}

private var checkoutDismissKey: UInt8 = 0
private var cartDismissKey: UInt8 = 0
private var onboardingDismissKey: UInt8 = 0
