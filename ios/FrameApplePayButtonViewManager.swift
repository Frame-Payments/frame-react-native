//
//  FrameApplePayButtonViewManager.swift
//  FrameReactNative
//
//  React Native view manager for FrameApplePayButtonView.
//

import Foundation
import React

@objc(FrameApplePayButtonViewManager)
public final class FrameApplePayButtonViewManager: RCTViewManager {

  public override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  public override func view() -> UIView! {
    return FrameApplePayButtonView()
  }
}
