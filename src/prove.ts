import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { ErrorCodes, frameError } from './errors';

// JS-side orchestrator for the Prove native bridge. Mirrors the iOS / Android
// surface: `authenticate(authToken)` resolves with success/failure, while a
// listener fires when Prove falls back to OTP entry.

interface ProveAuthResult {
  status: 'success' | 'failed';
  message?: string;
}

interface ProveAuthNative {
  authenticate(authToken: string): Promise<ProveAuthResult>;
  submitOtp(code: string): Promise<void>;
  cancelOtp(): Promise<void>;
  cancelAuth(): Promise<void>;
}

const FrameProveAuth: ProveAuthNative | null = NativeModules.FrameProveAuth ?? null;

const PROVE_OTP_NEEDED = 'FrameProveOtpNeeded';

/** True when the Prove bridge is linked on the current platform. */
export function isProveAvailable(): boolean {
  return FrameProveAuth !== null;
}

/** Subscribe to the "Prove fell back to OTP entry" event. Returns an
 * unsubscribe function. JS shows the OTP entry sheet when this fires. */
export function subscribeProveOtpNeeded(listener: () => void): () => void {
  if (!FrameProveAuth) return () => {};
  const emitter = new NativeEventEmitter(NativeModules.FrameProveAuth);
  const sub = emitter.addListener(PROVE_OTP_NEEDED, listener);
  return () => sub.remove();
}

/** Hand a code to the native side. Used by the OTP-fallback UI when the user
 * presses Submit on the Prove OTP sheet. */
export async function submitProveOtp(code: string): Promise<void> {
  if (!FrameProveAuth) return;
  await FrameProveAuth.submitOtp(code);
}

// Latched when the applicant dismisses the Prove OTP sheet themselves. The
// native side then resolves authenticate() with status=failed, which is
// indistinguishable from a real Prove failure — but a deliberate cancel is not
// something to recover from with a re-send and an error toast. iOS keeps the
// same flag (`proveOTPCancelledByUser`, OnboardingContainerViewModel.swift:493).
let cancelledByUser = false;

/** Cancel the pending OTP request. Used by the OTP UI's Cancel button. The
 * underlying authenticate() promise resolves with status=failed afterwards;
 * {@link consumeProveCancelledByUser} distinguishes that from a real failure. */
export async function cancelProveOtp(): Promise<void> {
  cancelledByUser = true;
  if (!FrameProveAuth) return;
  await FrameProveAuth.cancelOtp();
}

/**
 * Whether the last Prove failure was the applicant cancelling, clearing the flag
 * as it reads. Callers use it to skip the Twilio-fallback re-send and the error
 * toast: the applicant dismissed the sheet and is back on the phone form, where
 * tapping Continue starts this over.
 */
export function consumeProveCancelledByUser(): boolean {
  const was = cancelledByUser;
  cancelledByUser = false;
  return was;
}

/** Forcibly cancel the in-flight Prove authentication. Resolves authenticate()
 * with status=failed. Safe to call when nothing is in flight. */
export async function cancelProveAuth(): Promise<void> {
  if (!FrameProveAuth) return;
  await FrameProveAuth.cancelAuth();
}

/**
 * Launch the Prove auth flow with the auth token returned from
 * phoneVerifications.create. Resolves with `success` when the Prove SDK
 * completes, or `failed` (with optional message) when the SDK gave up, the
 * user canceled, or Prove isn't linked.
 *
 * Prove's success is NOT the verification: the caller must still confirm it
 * server-side via `phoneVerifications.confirm` (see
 * `useOnboardingViewModel.confirmProveVerification`), matching iOS's
 * `ProveConfirmHandler`.
 *
 * Behavior is consistent across platforms: if Prove falls back to OTP,
 * subscribers to the OTP-needed event are notified and the promise stays
 * pending until JS calls submitProveOtp(code) or cancelProveOtp().
 */
export async function authenticateProve(authToken: string): Promise<ProveAuthResult> {
  // A fresh run: any cancel latched by a previous attempt is stale.
  cancelledByUser = false;
  if (!FrameProveAuth) {
    return { status: 'failed', message: 'Prove SDK is not linked.' };
  }
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw frameError(ErrorCodes.PLATFORM_UNSUPPORTED, 'Prove authentication requires iOS or Android.');
  }
  try {
    return await FrameProveAuth.authenticate(authToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message };
  }
}
