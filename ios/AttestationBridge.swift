import Foundation
import DeviceCheck
import Security
import React

// Keychain key strings mirror Frame iOS' DeviceAttestationManager, namespaced
// by App Attest environment for the same reason iOS namespaces them: a key
// minted by a local development build and a TestFlight/App Store build of the
// same bundle ID would otherwise share one unscoped Keychain item, which
// Apple then rejects at assertion time (`DeviceAttestationManager.swift:135-137`).
// Do not rename the namespaced or legacy keys without a coordinated migration.

@objc(FrameAttestation)
public class FrameAttestation: NSObject {

  private let service = DCAppAttestService.shared

  // Mirrors iOS AppAttestEnvironment.current
  // (`DeviceAttestationManager.swift:122-131`): a build with no embedded
  // provisioning profile is a Store/TestFlight build (App Attest calls this
  // "production"); a build with one (dev, ad-hoc, enterprise) is "development".
  private var attestEnvironment: String {
    Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision") == nil
      ? "production"
      : "development"
  }

  private var attestedKey: String { "com.framepayments.device-attest-key-id.\(attestEnvironment)" }
  private var pendingKey: String { "com.framepayments.device-attest-key-id-pending.\(attestEnvironment)" }

  // The pre-namespacing Keychain accounts. Read only to migrate away from
  // (resetAttestation wipes them); never written.
  private let legacyAttestedKey = "com.framepayments.device-attest-key-id"
  private let legacyPendingKey = "com.framepayments.device-attest-key-id-pending"

  @objc public func isSupported(_ resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(service.isSupported)
  }

  // nil from readKeychainItem bridges through `Any` → NSNull → JS null.
  @objc public func attestedKeyId(_ resolve: @escaping RCTPromiseResolveBlock,
                                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(readKeychainItem(attestedKey) as Any)
  }

  @objc public func generateKey(_ resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard service.isSupported else {
      reject("ATTESTATION_NOT_SUPPORTED", "App Attest is not supported on this device.", nil)
      return
    }
    service.generateKey { [weak self] keyId, error in
      guard let self = self else {
        reject("ATTESTATION_BRIDGE_GONE", "Attestation bridge was deallocated mid-flow.", nil)
        return
      }
      if let error = error {
        reject("ATTESTATION_KEY_GENERATION_FAILED", error.localizedDescription, error)
        return
      }
      guard let keyId = keyId else {
        reject("ATTESTATION_KEY_GENERATION_FAILED", "App Attest returned no key id.", nil)
        return
      }
      self.saveKeychainItem(self.pendingKey, value: keyId)
      resolve(keyId)
    }
  }

  @objc public func attestKey(_ keyId: String,
                               clientDataHashBase64: String,
                               resolve: @escaping RCTPromiseResolveBlock,
                               rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let hash = Data(base64Encoded: clientDataHashBase64) else {
      reject("ATTESTATION_INVALID_HASH", "clientDataHash must be base64-encoded.", nil)
      return
    }
    service.attestKey(keyId, clientDataHash: hash) { [weak self] attestationObject, error in
      guard let self = self else {
        reject("ATTESTATION_BRIDGE_GONE", "Attestation bridge was deallocated mid-flow.", nil)
        return
      }
      if let error = error {
        // attestKey is single-use per key — drop the pending entry so the
        // next attempt starts fresh.
        self.deleteKeychainItem(self.pendingKey)
        reject("ATTESTATION_ATTEST_FAILED", error.localizedDescription, error)
        return
      }
      guard let attestationObject = attestationObject else {
        self.deleteKeychainItem(self.pendingKey)
        reject("ATTESTATION_ATTEST_FAILED", "App Attest returned no attestation object.", nil)
        return
      }
      resolve(attestationObject.base64EncodedString())
    }
  }

  @objc public func promoteKey(_ keyId: String,
                                resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
    saveKeychainItem(attestedKey, value: keyId)
    deleteKeychainItem(pendingKey)
    resolve(nil)
  }

  // Drops the pending key. JS calls this when the attest flow fails after
  // App Attest succeeded but before promoteKey (e.g. backend rejects the
  // attestation, or the challenge fetch fails post-generateKey). Without it,
  // a stale pending key id sits in Keychain and the next ensureAttested
  // can't tell it apart from a fresh one.
  @objc public func clearPendingKey(_ resolve: @escaping RCTPromiseResolveBlock,
                                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    deleteKeychainItem(pendingKey)
    resolve(nil)
  }

  @objc public func generateAssertion(_ keyId: String,
                                       clientDataHashBase64: String,
                                       resolve: @escaping RCTPromiseResolveBlock,
                                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let hash = Data(base64Encoded: clientDataHashBase64) else {
      reject("ATTESTATION_INVALID_HASH", "clientDataHash must be base64-encoded.", nil)
      return
    }
    service.generateAssertion(keyId, clientDataHash: hash) { assertion, error in
      if let error = error {
        reject("ATTESTATION_ASSERTION_FAILED", error.localizedDescription, error)
        return
      }
      guard let assertion = assertion else {
        reject("ATTESTATION_ASSERTION_FAILED", "App Attest returned no assertion.", nil)
        return
      }
      resolve(assertion.base64EncodedString())
    }
  }

  @objc public func resetAttestation(_ resolve: @escaping RCTPromiseResolveBlock,
                                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    deleteKeychainItem(attestedKey)
    deleteKeychainItem(pendingKey)
    // Also clear the pre-namespacing items — namespacing orphans rather than
    // removes them, and a leftover orphan is still what an unscoped read
    // (an older SDK version, or the native iOS SDK sharing this Keychain)
    // would pick up. Mirrors iOS `resetAttestation()`
    // (`DeviceAttestationManager.swift:293-300`).
    deleteKeychainItem(legacyAttestedKey)
    deleteKeychainItem(legacyPendingKey)
    resolve(nil)
  }

  // MARK: - Keychain helpers (mirror DeviceAttestationManager 1:1)

  private func saveKeychainItem(_ key: String, value: String) {
    guard !key.isEmpty, let data = value.data(using: .utf8) else { return }
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
    ]
    let attributes: [String: Any] = [kSecValueData as String: data]
    let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      var addQuery = query
      addQuery[kSecValueData as String] = data
      SecItemAdd(addQuery as CFDictionary, nil)
    }
  }

  private func readKeychainItem(_ key: String) -> String? {
    guard !key.isEmpty else { return nil }
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  private func deleteKeychainItem(_ key: String) {
    guard !key.isEmpty else { return }
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
    ]
    SecItemDelete(query as CFDictionary)
  }
}
