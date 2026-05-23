import Foundation
import PassKit
import UIKit
import React

// Native wrapper around PKPaymentButton. Exposed to RN as
// `requireNativeComponent('FrameApplePayButton')`. Apple Pay HIG mandates
// using the system-drawn button, so we host one inside an RN-managed view.

@objc(FrameApplePayButtonView)
public class FrameApplePayButtonView: UIView {

  private var button: PKPaymentButton?
  // RN sets buttonStyle + buttonType in the same render pass. Without batching
  // we'd allocate the button twice on first mount. Defer the actual rebuild
  // until layout runs.
  private var needsRebuild = true

  @objc public var buttonStyle: NSString = "black" {
    didSet { markRebuildNeeded() }
  }

  @objc public var buttonType: NSString = "plain" {
    didSet { markRebuildNeeded() }
  }

  @objc public var cornerRadius: CGFloat = 10 {
    didSet { markRebuildNeeded() }
  }

  // Bridged from the @objc paymentButtonTapped action. RN's RCTBubblingEventBlock
  // is set on the view from the view manager.
  @objc public var onPress: RCTBubblingEventBlock?

  public override init(frame: CGRect) {
    super.init(frame: frame)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  private func markRebuildNeeded() {
    needsRebuild = true
    setNeedsLayout()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    if needsRebuild {
      rebuildButton()
      needsRebuild = false
    }
    button?.frame = bounds
  }

  private func rebuildButton() {
    button?.removeFromSuperview()
    let style = Self.parseStyle(buttonStyle as String)
    let type = Self.parseType(buttonType as String)
    let newButton = PKPaymentButton(paymentButtonType: type, paymentButtonStyle: style)
    newButton.cornerRadius = cornerRadius
    newButton.addTarget(self, action: #selector(paymentButtonTapped), for: .touchUpInside)
    newButton.frame = bounds
    addSubview(newButton)
    button = newButton
  }

  @objc private func paymentButtonTapped() {
    onPress?([:])
  }

  private static func parseStyle(_ raw: String) -> PKPaymentButtonStyle {
    switch raw.lowercased() {
    case "white": return .white
    case "whiteoutline", "white-outline": return .whiteOutline
    case "automatic": return .automatic
    default: return .black
    }
  }

  private static func parseType(_ raw: String) -> PKPaymentButtonType {
    switch raw.lowercased() {
    case "buy": return .buy
    case "setup", "set-up": return .setUp
    case "instore", "in-store": return .inStore
    case "donate": return .donate
    case "checkout", "check-out": return .checkout
    case "book": return .book
    case "subscribe": return .subscribe
    case "reload": return .reload
    case "addmoney", "add-money": return .addMoney
    case "topup", "top-up": return .topUp
    case "order": return .order
    case "rent": return .rent
    case "support": return .support
    case "contribute": return .contribute
    case "tip": return .tip
    case "continue": return .continue
    default: return .plain
    }
  }
}

@objc(FrameApplePayButtonViewManager)
public class FrameApplePayButtonViewManager: RCTViewManager {

  public override class func requiresMainQueueSetup() -> Bool {
    return true
  }

  public override func view() -> UIView! {
    return FrameApplePayButtonView()
  }
}
