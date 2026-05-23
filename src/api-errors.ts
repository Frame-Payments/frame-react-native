import { FrameAPIError } from 'framepayments';
import {
  ErrorCodes,
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
