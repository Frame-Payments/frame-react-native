/**
 * Standard error codes and shape for the Frame React Native SDK.
 */

export const ErrorCodes = {
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  USER_CANCELED: 'USER_CANCELED',
  NO_ROOT_VC: 'NO_ROOT_VC',
  NO_ACTIVITY: 'NO_ACTIVITY',
  INVALID_ITEMS: 'INVALID_ITEMS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  NO_RESULT: 'NO_RESULT',
  INIT_FAILED: 'INIT_FAILED',
  ENCODE_ERROR: 'ENCODE_ERROR',
} as const;

export type FrameErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface FrameErrorShape {
  code: string;
  message: string;
  nativeError?: string;
}

export function isFrameError(error: unknown): error is FrameErrorShape {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as FrameErrorShape).code === 'string' &&
    typeof (error as FrameErrorShape).message === 'string'
  );
}

export function normalizeToFrameError(reject: unknown): FrameErrorShape {
  if (isFrameError(reject)) {
    return reject;
  }
  if (reject instanceof Error) {
    const code = (reject as Error & { code?: string }).code ?? 'UNKNOWN_ERROR';
    return { code, message: reject.message, nativeError: reject.stack };
  }
  if (typeof reject === 'object' && reject !== null && 'code' in reject && 'message' in reject) {
    return reject as FrameErrorShape;
  }
  return {
    code: 'UNKNOWN_ERROR',
    message: String(reject),
  };
}
