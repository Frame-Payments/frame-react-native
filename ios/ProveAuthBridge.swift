//
//  ProveAuthBridge.swift
//  FrameReactNative
//
//  Bridges Prove's iOS ProveAuth SDK to React Native. The JS surface:
//
//   - authenticate(authToken: String) → Promise<{ status: 'success' | 'failed' }>
//   - submitOtp(code: String) → void   (call when JS shows the OTP fallback UI)
//   - cancelOtp() → void
//   - cancelAuth() → void              (force-cancel the in-flight authentication)
//
//   Event: `FrameProveOtpNeeded` — fires when the Prove SDK falls back to OTP.
//   JS listens for the event, shows the OTP entry sheet, and calls submitOtp.
//
//  The Frame backend's confirmVerification call is NOT performed here — JS
//  handles it via PhoneVerificationsAPI after authenticate() resolves success.
//  We pass a no-op confirmHandler to AuthFinishStep so the SDK's state machine
//  resolves the authenticate promise as soon as Prove finishes its part.
//
//  ProveAuth is loaded behind `#if canImport(ProveAuth)`; when the SDK isn't
//  linked, authenticate() resolves PROVE_UNAVAILABLE so JS can fall back to
//  the Frame OTP path.
//
//  Protocol shapes are verified against the Frame iOS 3.0.0 reference at
//  Sources/FrameOnboarding/Services/ProveAuthService.swift:
//    - ProveAuthFinishStep.execute(authId:)
//    - OtpStartStep.execute(phoneNumberNeeded:phoneValidationError:callback:)
//    - OtpFinishStep.execute(otpError:callback:)
//

import Foundation
import React

#if canImport(ProveAuth)
import ProveAuth
#endif

@objc(FrameProveAuth)
public class FrameProveAuth: RCTEventEmitter {

  private static let EVENT_OTP_NEEDED = "FrameProveOtpNeeded"

#if canImport(ProveAuth)
  private var proveAuth: ProveAuth?
  private var authFinishStep: BridgeAuthFinishStep?
  private var otpStartStep: BridgeOtpStartStep?
  private var otpFinishStep: BridgeOtpFinishStep?
#endif

  // Single-resume guard around the JS promise. Both the SDK completion
  // callback and the AuthFinishStep onResult closure can fire — first one
  // wins, the other no-ops via this nil-check.
  private var authResolve: RCTPromiseResolveBlock?
  private var authReject: RCTPromiseRejectBlock?

  // Continuation handed to the OTP-finish step. Captured when the SDK calls
  // OtpFinishStep.execute(...) and resumed by submitOtp/cancelOtp from JS.
  // The Prove SDK can re-request OTP if the first code fails validation, so
  // the bridge guards against an existing continuation by error-resuming the
  // old one before installing the new one.
  private var otpContinuation: ((String?) -> Void)?

  // MARK: - RCTEventEmitter

  public override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  public override func supportedEvents() -> [String] {
    return [FrameProveAuth.EVENT_OTP_NEEDED]
  }

  // MARK: - JS API

  @objc public func authenticate(_ authToken: String,
                                  resolver resolve: @escaping RCTPromiseResolveBlock,
                                  rejecter reject: @escaping RCTPromiseRejectBlock) {
#if canImport(ProveAuth)
    DispatchQueue.main.async { [weak self] in
      guard let self = self else {
        reject("PROVE_BRIDGE_GONE", "Prove bridge was deallocated.", nil)
        return
      }
      guard self.authResolve == nil else {
        reject("PROVE_BUSY", "A Prove authentication is already in flight.", nil)
        return
      }
      self.authResolve = resolve
      self.authReject = reject
      self.startProveAuth(authToken: authToken)
    }
#else
    // Prove SDK not linked in this build. Return a clean failure so JS can
    // fall back to the Frame OTP path without surfacing a crash.
    reject("PROVE_UNAVAILABLE", "Prove SDK is not linked in this app.", nil)
#endif
  }

  @objc public func submitOtp(_ code: String,
                               resolver resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self = self else {
        reject("PROVE_BRIDGE_GONE", "Prove bridge was deallocated.", nil)
        return
      }
      guard let cont = self.otpContinuation else {
        // OTP wasn't requested; treat as a no-op so JS error handlers don't
        // double-throw on a stale OTP submit.
        resolve(nil)
        return
      }
      self.otpContinuation = nil
      cont(code)
      resolve(nil)
    }
  }

  @objc public func cancelOtp(_ resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      self?.otpContinuation?(nil)
      self?.otpContinuation = nil
      resolve(nil)
    }
  }

  @objc public func cancelAuth(_ resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      self?.otpContinuation?(nil)
      self?.otpContinuation = nil
      self?.handleAuthFailure(message: "Prove authentication canceled by user.")
      resolve(nil)
    }
  }

  // MARK: - Prove orchestration

#if canImport(ProveAuth)
  private func startProveAuth(authToken: String) {
    // AuthFinishStep fires when Prove signals "device auth ok"; JS owns the
    // backend confirm step, so we hand the SDK a no-op confirmHandler that
    // returns success immediately.
    let bridge = BridgeWeakBox(self)

    self.authFinishStep = BridgeAuthFinishStep(
      confirmHandler: { _, _ in /* JS owns the confirm step */ },
      onResult: { result in
        DispatchQueue.main.async {
          bridge.value?.handleAuthResult(result)
        }
      }
    )
    self.otpStartStep = BridgeOtpStartStep(onOtpNeeded: {
      DispatchQueue.main.async {
        bridge.value?.emitOtpNeeded()
      }
    })
    self.otpFinishStep = BridgeOtpFinishStep(otpProvider: {
      // Suspend until submitOtp/cancelOtp resolves the continuation. If a
      // prior continuation is somehow still live (Prove re-requested OTP
      // before the first one was answered), fail the old one so it doesn't
      // hang the SDK state machine.
      return await withCheckedContinuation { cont in
        DispatchQueue.main.async {
          if let stale = bridge.value?.otpContinuation {
            bridge.value?.otpContinuation = nil
            stale(nil)
          }
          bridge.value?.otpContinuation = { code in cont.resume(returning: code) }
        }
      }
    })

    guard let authFinishStep = self.authFinishStep,
          let otpStartStep = self.otpStartStep,
          let otpFinishStep = self.otpFinishStep else { return }

    self.proveAuth = ProveAuth.builder(authFinish: authFinishStep)
      .withOtpFallback(otpStart: otpStartStep, otpFinish: otpFinishStep)
      .build()

    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let prove = self?.proveAuth else { return }
      prove.authenticate(authToken: authToken) { error in
        // Some Prove SDK versions deliver completion via AuthFinishStep;
        // others surface terminal errors here. Both paths converge on the
        // single-resume handleAuthFailure / handleAuthResult guard.
        if error.errorDescription != nil {
          DispatchQueue.main.async {
            self?.handleAuthFailure(message: error.errorDescription ?? "Prove authentication failed.")
          }
        }
      }
    }
  }

  private func handleAuthResult(_ result: Result<Bool, Error>) {
    switch result {
    case .success:
      finishAuthSuccess()
    case .failure(let error):
      handleAuthFailure(message: error.localizedDescription)
    }
  }
#endif

  private func emitOtpNeeded() {
    self.sendEvent(withName: FrameProveAuth.EVENT_OTP_NEEDED, body: [:])
  }

  private func finishAuthSuccess() {
    guard let resolve = self.authResolve else { return }
    self.authResolve = nil
    self.authReject = nil
    resolve(["status": "success"])
    // Defer SDK release until after the JS promise has resolved so any
    // in-flight step closures aren't reading dangling references.
    DispatchQueue.main.async { [weak self] in
      self?.releaseRetainedSDKObjects()
    }
  }

  private func handleAuthFailure(message: String) {
    guard let resolve = self.authResolve else { return }
    self.authResolve = nil
    self.authReject = nil
    resolve(["status": "failed", "message": message])
    DispatchQueue.main.async { [weak self] in
      self?.releaseRetainedSDKObjects()
    }
  }

  private func releaseRetainedSDKObjects() {
#if canImport(ProveAuth)
    self.proveAuth = nil
    self.authFinishStep = nil
    self.otpStartStep = nil
    self.otpFinishStep = nil
#endif
    self.otpContinuation = nil
  }
}

// Weak wrapper used to thread the bridge through Prove SDK step closures
// without creating retain cycles.
private final class BridgeWeakBox<T: AnyObject> {
  weak var value: T?
  init(_ value: T) { self.value = value }
}

#if canImport(ProveAuth)

// MARK: - Prove SDK step adapters (mirror Frame iOS ProveAuthService.swift)

/// AuthFinishStep — fires `onResult(.success)` after Prove signals the device
/// auth is complete and our (no-op) confirmHandler returns.
private final class BridgeAuthFinishStep: NSObject, ProveAuthFinishStep, @unchecked Sendable {
  private let confirmHandler: @Sendable (String, String) async throws -> Void
  private let onResult: @Sendable (Result<Bool, Error>) -> Void

  init(
    confirmHandler: @escaping @Sendable (String, String) async throws -> Void,
    onResult: @escaping @Sendable (Result<Bool, Error>) -> Void
  ) {
    self.confirmHandler = confirmHandler
    self.onResult = onResult
  }

  func execute(authId: String) {
    Task {
      do {
        try await confirmHandler("", "")
        onResult(.success(true))
      } catch {
        onResult(.failure(error))
      }
    }
  }
}

/// OtpStartStep — Prove tells us OTP fallback is starting. The phone number
/// is already known to Prove (it came from authToken's claims), so we accept
/// the start; phoneNumberNeeded=true is a misconfiguration → error.
private final class BridgeOtpStartStep: NSObject, OtpStartStep, @unchecked Sendable {
  private let onOtpNeeded: @Sendable () -> Void
  init(onOtpNeeded: @escaping @Sendable () -> Void) { self.onOtpNeeded = onOtpNeeded }

  func execute(phoneNumberNeeded: Bool, phoneValidationError: ProveAuthError?, callback: any OtpStartStepCallback) {
    if phoneNumberNeeded {
      callback.onError()
    } else {
      onOtpNeeded()
      callback.onSuccess(input: nil)
    }
  }
}

/// OtpFinishStep — Prove asks the host to collect the OTP from the user. We
/// await JS via the continuation provider; null means cancel.
private final class BridgeOtpFinishStep: NSObject, OtpFinishStep, @unchecked Sendable {
  private let otpProvider: @Sendable () async -> String?
  init(otpProvider: @escaping @Sendable () async -> String?) { self.otpProvider = otpProvider }

  func execute(otpError: ProveAuthError?, callback: any OtpFinishStepCallback) {
    Task { @MainActor in
      let otp = await otpProvider()
      if let otp = otp {
        callback.onSuccess(input: OtpFinishInput(otp: otp))
      } else {
        callback.onError()
      }
    }
  }
}

#endif
