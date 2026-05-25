//
//  FrameSDKBridge.swift
//  FrameReactNative
//
//  Single-method native shim for 4.0.0. All JS-callable surfaces (Checkout,
//  Cart, Onboarding, Apple Pay, attestation) live in their own modules.
//  initialize() is intentionally a no-op — src/config.ts holds the truth.
//

import Foundation
import React

@objc(ObjCFrameSDKBridge)
public class FrameSDKBridge: NSObject {

  @objc public static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc public
  func initialize(_ secretKey: String, publishableKey: String, debugMode: Bool, applePayMerchantId: NSObject?, googlePayMerchantId: NSObject?, theme: NSDictionary?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    _ = secretKey
    _ = publishableKey
    _ = debugMode
    _ = applePayMerchantId
    _ = googlePayMerchantId
    _ = theme
    resolve(nil)
  }
}
