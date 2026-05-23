import { NativeModules, Platform } from 'react-native';
import { sha256 } from 'js-sha256';
import { client } from './client';
import { ErrorCodes, frameError } from './errors';

const LINKING_ERROR =
  "The native module 'FrameAttestation' isn't linked. " +
  'Make sure you have run `pod install` and rebuilt the app.';

interface AttestationNative {
  isSupported(): Promise<boolean>;
  attestedKeyId(): Promise<string | null>;
  generateKey(): Promise<string>;
  attestKey(keyId: string, clientDataHashBase64: string): Promise<string>;
  promoteKey(keyId: string): Promise<void>;
  clearPendingKey(): Promise<void>;
  generateAssertion(keyId: string, clientDataHashBase64: string): Promise<string>;
  resetAttestation(): Promise<void>;
}

const FrameAttestation: AttestationNative = NativeModules.FrameAttestation
  ? NativeModules.FrameAttestation
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      },
    ) as unknown as AttestationNative);

function guardIos(): void {
  if (Platform.OS !== 'ios') {
    throw frameError(
      'PLATFORM_UNSUPPORTED',
      'Device attestation is iOS-only (Apple App Attest). Android has no equivalent in this SDK.',
    );
  }
}

/**
 * Returns the attested key id stored in the Keychain, or null if the device
 * hasn't been attested. Returns null on Android — parity with
 * `isAttestationSupported()` which also degrades silently.
 */
export async function getAttestedKeyId(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  return FrameAttestation.attestedKeyId();
}

/**
 * Returns true if the device supports App Attest. False on simulator, on iOS
 * < 14, and always on Android.
 */
export async function isAttestationSupported(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return FrameAttestation.isSupported();
}

let inflightEnsureAttested: Promise<string> | null = null;

/**
 * Full device attestation flow — mirrors `DeviceAttestationManager.attestDevice()`:
 *   1. Reuse existing attested key if present.
 *   2. Generate a key in the Secure Enclave (persisted as "pending").
 *   3. Fetch a challenge from Frame.
 *   4. SHA-256 the challenge as clientDataHash; attest via App Attest.
 *   5. Submit the attestation object to Frame.
 *   6. Promote the pending key to attested.
 *
 * Concurrent callers share a single in-flight promise so two parallel call
 * sites don't each burn a fresh Secure Enclave key.
 */
export function ensureAttested(): Promise<string> {
  if (inflightEnsureAttested) return inflightEnsureAttested;
  inflightEnsureAttested = runEnsureAttested().finally(() => {
    inflightEnsureAttested = null;
  });
  return inflightEnsureAttested;
}

async function runEnsureAttested(): Promise<string> {
  guardIos();

  const existing = await FrameAttestation.attestedKeyId();
  if (existing) return existing;

  if (!(await FrameAttestation.isSupported())) {
    throw frameError(
      ErrorCodes.NOT_ATTESTED,
      'App Attest is not supported on this device (iOS 14+ on a real device required).',
    );
  }

  const keyId = await wrapped('generateKey', () => FrameAttestation.generateKey());

  let challenge: string;
  try {
    const challengeResponse = await client.sdk.deviceAttestation.getChallenge({ usePublishableKey: true });
    challenge = challengeResponse.challenge ?? '';
    if (!challenge) {
      throw frameError(ErrorCodes.ATTESTATION_FAILED, 'Frame backend returned no attestation challenge.');
    }
  } catch (err) {
    await safeClearPending();
    if ((err as { code?: string }).code === ErrorCodes.ATTESTATION_FAILED) throw err;
    throw frameError(
      ErrorCodes.ATTESTATION_FAILED,
      `Device attestation challenge failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const clientDataHash = sha256Base64(base64ToBytes(challenge));

  let attestationObject: string;
  try {
    attestationObject = await FrameAttestation.attestKey(keyId, clientDataHash);
  } catch (err) {
    // attestKey is single-use per key; the Swift bridge already cleans up
    // the pending entry on failure.
    throw frameError(
      ErrorCodes.ATTESTATION_FAILED,
      `App Attest attestKey failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!attestationObject) {
    await safeClearPending();
    throw frameError(ErrorCodes.ATTESTATION_FAILED, 'App Attest returned an empty attestation object.');
  }

  let attestResponse: { status: string; key_id: string };
  try {
    attestResponse = await client.sdk.deviceAttestation.attest(
      { key_id: keyId, attestation_object: attestationObject, challenge },
      { usePublishableKey: true },
    );
  } catch (err) {
    await safeClearPending();
    throw frameError(
      ErrorCodes.ATTESTATION_FAILED,
      `Frame backend attest failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (attestResponse.status !== 'verified') {
    await safeClearPending();
    throw frameError(
      ErrorCodes.ATTESTATION_FAILED,
      `Frame backend rejected attestation (status: ${attestResponse.status}).`,
    );
  }

  await FrameAttestation.promoteKey(keyId);
  return keyId;
}

/**
 * Generates an assertion bound to `paymentData`. Mirrors iOS
 * `generateAssertionForPayment` — wraps the payment payload into a clientData
 * JSON, SHA-256 hashes it, calls App Attest, and returns all three fields
 * base64-encoded so the caller can embed them in the Apple Pay payment-method
 * request.
 *
 * The returned `clientData` is the exact bytes the SHA-256 was computed over.
 * Frame's backend must re-hash the submitted `clientData` (rather than parse +
 * re-serialize as JSON) to verify the assertion — that's how Apple specifies
 * App Attest assertions work. Each platform is self-consistent; the byte
 * sequence across iOS and RN is not guaranteed to match (iOS uses
 * `JSONSerialization`, RN uses `JSON.stringify`) and does not need to.
 */
export async function generateAssertionForPayment(paymentData: Uint8Array): Promise<{
  keyId: string;
  assertion: string;
  clientData: string;
}> {
  guardIos();

  const keyId = await FrameAttestation.attestedKeyId();
  if (!keyId) {
    throw frameError(ErrorCodes.NOT_ATTESTED, 'No attested key on this device. Call ensureAttested() first.');
  }

  const clientDataJson = JSON.stringify({
    challenge: bytesToBase64(paymentData),
    origin: 'ios-sdk',
  });
  const clientDataBytes = textEncoderEncode(clientDataJson);
  const clientDataHash = sha256Base64(clientDataBytes);

  let assertion: string;
  try {
    assertion = await FrameAttestation.generateAssertion(keyId, clientDataHash);
  } catch (err) {
    throw frameError(
      ErrorCodes.ATTESTATION_FAILED,
      `App Attest generateAssertion failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    keyId,
    assertion,
    clientData: bytesToBase64(clientDataBytes),
  };
}

/** Clears the attested key id so the next `ensureAttested()` runs a fresh flow. */
export async function resetAttestation(): Promise<void> {
  guardIos();
  await FrameAttestation.resetAttestation();
}

// ----- helpers -----

async function wrapped<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw frameError(
      ErrorCodes.ATTESTATION_FAILED,
      `Device attestation ${stage} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function safeClearPending(): Promise<void> {
  try {
    await FrameAttestation.clearPendingKey();
  } catch {
    // Best-effort cleanup; the next ensureAttested will overwrite the entry.
  }
}

function sha256Base64(bytes: Uint8Array): string {
  // js-sha256 emits a hex digest by default; convert to bytes then base64.
  const hex = sha256(bytes);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytesToBase64(out);
}

function base64ToBytes(b64: string): Uint8Array {
  // Hermes ships atob/btoa from RN 0.74+. The Buffer fallback is only hit
  // under Node (jest tests).
  const binary = globalThis.atob ? globalThis.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (globalThis.btoa) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    return globalThis.btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function textEncoderEncode(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  return new Uint8Array(Buffer.from(text, 'utf-8'));
}

/** @internal Resets the in-flight ensureAttested promise. Used by tests. */
export function __resetEnsureAttestedInflight(): void {
  inflightEnsureAttested = null;
}
