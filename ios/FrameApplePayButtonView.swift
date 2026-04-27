//
//  FrameApplePayButtonView.swift
//  FrameReactNative
//
//  Hosts a SwiftUI FrameApplePayButton inside a UIView for React Native.
//

import Foundation
import React
import UIKit
import SwiftUI
import PassKit
import Frame

@objc(FrameApplePayButtonView)
public final class FrameApplePayButtonView: UIView {

  // MARK: - React-managed props

  @objc public var amount: NSNumber = 0 { didSet { setNeedsRebuild() } }
  @objc public var currency: NSString = "usd" { didSet { setNeedsRebuild() } }
  @objc public var owner: NSDictionary? { didSet { setNeedsRebuild() } }
  @objc public var merchantId: NSString = "" { didSet { setNeedsRebuild() } }
  @objc public var addCheckoutDivider: Bool = false { didSet { setNeedsRebuild() } }
  @objc public var buttonType: NSString = "buy" { didSet { setNeedsRebuild() } }
  @objc public var buttonStyle: NSString = "black" { didSet { setNeedsRebuild() } }
  @objc public var onResult: RCTDirectEventBlock?

  // MARK: - State

  private var hosting: UIHostingController<FrameApplePayButton>?
  private var rebuildScheduled: Bool = false

  public override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  deinit {
    hosting?.willMove(toParent: nil)
    hosting?.view.removeFromSuperview()
    hosting?.removeFromParent()
  }

  // MARK: - Layout

  public override func layoutSubviews() {
    super.layoutSubviews()
    hosting?.view.frame = bounds
  }

  // MARK: - Rebuild scheduling

  // RN sets props one by one, so coalesce into a single rebuild on the next runloop pass
  // to avoid recreating the SwiftUI view N times during a single JS render.
  private func setNeedsRebuild() {
    if rebuildScheduled { return }
    rebuildScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.rebuildScheduled = false
      self.rebuild()
    }
  }

  private func rebuild() {
    guard amount.intValue > 0,
          merchantId.length > 0,
          let parsedOwner = parseOwner(owner) else {
      tearDownHosting()
      return
    }

    let pkType = mapButtonType(buttonType as String)
    let pkStyle = mapButtonStyle(buttonStyle as String)
    let currencyString = currency as String

    let newButton = FrameApplePayButton(
      amount: amount.intValue,
      currency: currencyString,
      owner: parsedOwner,
      merchantId: merchantId as String,
      addCheckoutDivider: addCheckoutDivider,
      buttonType: pkType,
      buttonStyle: pkStyle,
      completion: { [weak self] result in
        self?.fireResult(result)
      }
    )

    if let existing = hosting {
      existing.rootView = newButton
    } else {
      installHosting(rootView: newButton)
    }
  }

  private func installHosting(rootView: FrameApplePayButton) {
    let host = UIHostingController(rootView: rootView)
    host.view.backgroundColor = .clear
    host.view.frame = bounds
    host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(host.view)
    if let parentVC = reactViewController() {
      parentVC.addChild(host)
      host.didMove(toParent: parentVC)
    }
    hosting = host
  }

  private func tearDownHosting() {
    guard let host = hosting else { return }
    host.willMove(toParent: nil)
    host.view.removeFromSuperview()
    host.removeFromParent()
    hosting = nil
  }

  // MARK: - Prop parsing

  private func parseOwner(_ dict: NSDictionary?) -> FrameApplePayViewModel.PaymentMethodOwner? {
    guard let dict = dict,
          let type = dict["type"] as? String,
          let id = dict["id"] as? String,
          !id.isEmpty else {
      return nil
    }
    switch type {
    case "customer": return .customer(id)
    case "account": return .account(id)
    default: return nil
    }
  }

  private func mapButtonType(_ raw: String) -> PKPaymentButtonType {
    switch raw {
    case "buy": return .buy
    case "plain": return .plain
    case "donate": return .donate
    case "checkout": return .checkout
    case "book": return .book
    case "subscribe": return .subscribe
    case "reload": return .reload
    case "addMoney": return .addMoney
    case "topUp": return .topUp
    case "order": return .order
    case "rent": return .rent
    case "support": return .support
    case "contribute": return .contribute
    case "tip": return .tip
    case "inStore": return .inStore
    default: return .buy
    }
  }

  private func mapButtonStyle(_ raw: String) -> PKPaymentButtonStyle {
    switch raw {
    case "black": return .black
    case "white": return .white
    case "whiteOutline": return .whiteOutline
    case "automatic": return .automatic
    default: return .black
    }
  }

  // MARK: - Result dispatch

  private func fireResult(_ result: Result<FrameObjects.ChargeIntent, Error>) {
    switch result {
    case .success(let intent):
      if let dict = FrameSDKBridge.encodeChargeIntent(intent) {
        onResult?(["status": "success", "chargeIntent": dict])
      } else {
        onResult?(["status": "failure", "message": "Failed to encode charge intent"])
      }
    case .failure(let error):
      onResult?(["status": "failure", "message": error.localizedDescription])
    }
  }
}
