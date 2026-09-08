import { FrameAPIError } from 'framepayments';
import {
  ErrorCodes,
  isFrameError,
  normalizeToFrameError,
  type FrameErrorShape,
} from './errors';

export const DEFAULT_TOAST_FALLBACK = 'Something went wrong. Please try again.';

function extractFromEnvelope(raw: unknown): string | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const envelope = raw as Record<string, unknown>;
  const details = envelope.error_details;
  if (details && typeof details === 'object' && 'message' in details) {
    const m = (details as { message: unknown }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  if (typeof details === 'string' && details.length > 0) return details;
  if (typeof envelope.error === 'string' && envelope.error.length > 0) return envelope.error;
  return undefined;
}

export function toToastMessage(error: unknown, fallback: string = DEFAULT_TOAST_FALLBACK): string {
  if (error instanceof FrameAPIError) {
    const fromEnvelope = extractFromEnvelope(error.raw);
    if (fromEnvelope) return `Error: ${fromEnvelope}`;
    if (typeof error.message === 'string' && error.message.length > 0 && error.message !== 'An error occurred') {
      return `Error: ${error.message}`;
    }
    return `Error: ${fallback}`;
  }
  return `Error: ${fallback}`;
}

/**
 * Whether the API rejected the request because the device assertion was refused.
 *
 * The device's App Attest key can be revoked server-side (a reinstall, a
 * security event), after which every assertion fails identically until the key
 * is regenerated. Callers reset attestation on this so the next attempt mints a
 * fresh key rather than leaving the device wedged until the app is reinstalled.
 *
 * Mirrors iOS `NetworkingError.isAssertionRejection`
 * (`Sources/Frame/Networking/CommonObjects.swift:187-193`) — a 422 whose message
 * mentions assertion or attestation.
 */
export function isAssertionRejection(error: unknown): boolean {
  // Duck-typed rather than `instanceof FrameAPIError`: this runs on the failure
  // path of a payment, and an `instanceof` against a class the bundle didn't
  // load throws, turning a card decline into a TypeError.
  if (typeof error !== 'object' || error === null) return false;
  const { status, raw, message: rawMessage } = error as {
    status?: unknown;
    raw?: unknown;
    message?: unknown;
  };
  if (status !== 422) return false;
  const message = (
    extractFromEnvelope(raw) ?? (typeof rawMessage === 'string' ? rawMessage : '')
  ).toLowerCase();
  return (
    message.includes('assertion') ||
    message.includes('device not attested') ||
    message.includes('attestation')
  );
}

// Error codes a host can never resolve by retrying inside the checkout/cart UI
// — they mean the merchant integration itself is misconfigured (no secret key
// configured for a server-only operation, SDK never initialized, no Apple/
// Google Pay merchant ID). Everything else (a declined card, a validation
// error, a transient network blip, 3DS being unresolved) is recoverable: the
// user can fix the input or retry, so it toasts and the sheet stays open
// rather than tearing down (mirrors iOS `FrameCheckoutView.swift:428-436`).
const UNRECOVERABLE_CHECKOUT_CODES: ReadonlySet<string> = new Set([
  ErrorCodes.MISSING_SECRET_KEY,
  ErrorCodes.NOT_INITIALIZED,
  ErrorCodes.INVALID_ACCOUNT,
  ErrorCodes.INVALID_AMOUNT,
  ErrorCodes.INVALID_MERCHANT_ID,
]);

/**
 * Whether this error means the checkout/cart flow can never succeed no matter
 * what the user does — a merchant-integration misconfiguration rather than a
 * payment failure. Checkout reports these via `onFail` (rejecting the host's
 * `presentCheckout`/`presentCart` promise) instead of swallowing them into a
 * toast that would loop forever on a Pay button that can never work.
 */
export function isUnrecoverableCheckoutError(error: unknown): boolean {
  const code = isFrameError(error) ? error.code : normalizeToFrameError(error).code;
  return UNRECOVERABLE_CHECKOUT_CODES.has(code);
}

// A 404 from the API means the resource genuinely does not exist, as opposed to
// a transport failure or a 5xx, which say nothing about whether it exists.
// Callers use this to distinguish "the id is bad" from "we couldn't reach the
// server" — only the former is safe to treat as a permanent answer.
export function isNotFoundError(error: unknown): boolean {
  return error instanceof FrameAPIError && error.status === 404;
}

// Non-FrameAPIError throws are treated as transport errors because they're
// typically thrown before framepayments' interceptor wraps them.
export function isTransportError(error: unknown): boolean {
  if (error instanceof FrameAPIError) {
    return error.status === 0;
  }
  return true;
}

export function toFrameError(error: unknown): FrameErrorShape {
  if (error instanceof FrameAPIError) {
    return {
      code: mapApiErrorCode(error),
      message: extractFromEnvelope(error.raw) ?? error.message ?? DEFAULT_TOAST_FALLBACK,
    };
  }
  return normalizeToFrameError(error);
}

function mapApiErrorCode(error: FrameAPIError): string {
  if (error.status === 0) return ErrorCodes.API_NETWORK;
  if (error.status >= 400 && error.status < 500) return ErrorCodes.API_VALIDATION;
  return ErrorCodes.API_ERROR;
}
