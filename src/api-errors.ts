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

/**
 * Human copy for the risk and geo-compliance rejections, which the server
 * reports as bare codes (`sonar_session_required`) that would otherwise be
 * shown to shoppers verbatim. Mirrors iOS `riskMessage(for:)`
 * (`CommonObjects.swift:222-233`).
 *
 * @returns The replacement message, or `undefined` if `message` is not one of
 *   these codes.
 */
function riskMessage(message: string): string | undefined {
  switch (message.trim().toLowerCase()) {
    case 'sonar_session_required':
      return "We couldn't verify this device. Please try again.";
    case 'geo_compliance_blocked':
      return "Payments aren't available in your location.";
    case 'geo_compliance_vpn_detected':
      return 'Please turn off your VPN or proxy and try again.';
    default:
      return undefined;
  }
}

export function toToastMessage(error: unknown, fallback: string = DEFAULT_TOAST_FALLBACK): string {
  if (error instanceof FrameAPIError) {
    const fromEnvelope = extractFromEnvelope(error.raw);
    if (fromEnvelope) return `Error: ${riskMessage(fromEnvelope) ?? fromEnvelope}`;
    if (typeof error.message === 'string' && error.message.length > 0 && error.message !== 'An error occurred') {
      return `Error: ${riskMessage(error.message) ?? error.message}`;
    }
    return `Error: ${fallback}`;
  }
  return `Error: ${fallback}`;
}

export function isAssertionRejection(error: unknown): boolean {
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

const UNRECOVERABLE_CHECKOUT_CODES: ReadonlySet<string> = new Set([
  ErrorCodes.MISSING_SECRET_KEY,
  ErrorCodes.NOT_INITIALIZED,
  ErrorCodes.INVALID_ACCOUNT,
  ErrorCodes.INVALID_AMOUNT,
  ErrorCodes.INVALID_MERCHANT_ID,
]);

export function isUnrecoverableCheckoutError(error: unknown): boolean {
  const code = isFrameError(error) ? error.code : normalizeToFrameError(error).code;
  return UNRECOVERABLE_CHECKOUT_CODES.has(code);
}

export function isValidationError(error: unknown): boolean {
  const code = isFrameError(error) ? error.code : normalizeToFrameError(error).code;
  return code === ErrorCodes.VALIDATION_FAILED;
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
