import { FrameAPIError } from 'framepayments';
import { toToastMessage, toFrameError, isTransportError, DEFAULT_TOAST_FALLBACK } from '../api-errors';
import { ErrorCodes, isFrameError } from '../errors';

describe('toToastMessage', () => {
  it('extracts error_details.message when error_details is an object', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 422, {
      error_details: { message: 'Card submitted is not a test card' },
      error: 'Unprocessable Entity',
    });
    expect(toToastMessage(err)).toBe('Error: Card submitted is not a test card');
  });

  it('uses error_details directly when it is a string', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 422, {
      error_details: 'Direct string details',
      error: 'Unprocessable Entity',
    });
    expect(toToastMessage(err)).toBe('Error: Direct string details');
  });

  it('falls back to top-level error field when error_details is missing', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 404, {
      error: 'Not Found',
    });
    expect(toToastMessage(err)).toBe('Error: Not Found');
  });

  it('falls back to the default fallback when the envelope is empty', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 500, {});
    expect(toToastMessage(err)).toBe(`Error: ${DEFAULT_TOAST_FALLBACK}`);
  });

  it('respects a custom fallback', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 500, {});
    expect(toToastMessage(err, 'Custom fallback')).toBe('Error: Custom fallback');
  });

  it('uses error.message when it is meaningful and no envelope is present', () => {
    const err = new FrameAPIError('Custom failure', 'unknown_error', 500, null);
    expect(toToastMessage(err)).toBe('Error: Custom failure');
  });

  it('ignores the generic "An error occurred" framepayments default', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 500, null);
    expect(toToastMessage(err)).toBe(`Error: ${DEFAULT_TOAST_FALLBACK}`);
  });

  it('falls back for non-FrameAPIError throws', () => {
    expect(toToastMessage(new Error('boom'))).toBe(`Error: ${DEFAULT_TOAST_FALLBACK}`);
    expect(toToastMessage(undefined)).toBe(`Error: ${DEFAULT_TOAST_FALLBACK}`);
    expect(toToastMessage('string')).toBe(`Error: ${DEFAULT_TOAST_FALLBACK}`);
  });

  it('prefers error_details.message over a string error_details (object beats string)', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 422, {
      error_details: { message: 'Detailed message' },
      error: 'Unprocessable Entity',
    });
    expect(toToastMessage(err)).toBe('Error: Detailed message');
  });

  it('ignores empty error_details.message', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 422, {
      error_details: { message: '' },
      error: 'Unprocessable Entity',
    });
    expect(toToastMessage(err)).toBe('Error: Unprocessable Entity');
  });
});

describe('isTransportError', () => {
  it('is true when status is 0 (network failure)', () => {
    const err = new FrameAPIError('Network down', 'network_error', 0, null);
    expect(isTransportError(err)).toBe(true);
  });

  it('is false for 4xx server errors', () => {
    const err = new FrameAPIError('Validation', 'unknown_error', 422, {
      error_details: { message: 'Invalid' },
    });
    expect(isTransportError(err)).toBe(false);
  });

  it('is false for 5xx server errors', () => {
    const err = new FrameAPIError('Server', 'unknown_error', 500, {});
    expect(isTransportError(err)).toBe(false);
  });

  it('is true for non-FrameAPIError throws', () => {
    expect(isTransportError(new Error('boom'))).toBe(true);
    expect(isTransportError('weird')).toBe(true);
  });
});

describe('toFrameError', () => {
  it('maps a 4xx FrameAPIError to API_VALIDATION', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 422, {
      error_details: { message: 'Bad card' },
    });
    expect(toFrameError(err)).toEqual({
      code: ErrorCodes.API_VALIDATION,
      message: 'Bad card',
    });
  });

  it('maps a status-0 FrameAPIError to API_NETWORK', () => {
    const err = new FrameAPIError('Network', 'network_error', 0, null);
    expect(toFrameError(err)).toEqual({
      code: ErrorCodes.API_NETWORK,
      message: 'Network',
    });
  });

  it('preserves existing FrameErrorShape inputs', () => {
    const input = { code: 'USER_CANCELED', message: 'Dismissed' };
    expect(toFrameError(input)).toBe(input);
  });

  it('extracts code from generic Error.code if present', () => {
    const err = Object.assign(new Error('hi'), { code: 'NOT_INITIALIZED' });
    expect(toFrameError(err)).toMatchObject({
      code: 'NOT_INITIALIZED',
      message: 'hi',
    });
  });

  it('falls back for unknown throws', () => {
    expect(toFrameError(undefined)).toEqual({ code: 'UNKNOWN_ERROR', message: 'undefined' });
    expect(toFrameError({})).toEqual({ code: 'UNKNOWN_ERROR', message: '[object Object]' });
  });

  it('surfaces nativeError (stack) from a generic Error', () => {
    const err = Object.assign(new Error('boom'), { code: 'CUSTOM' });
    const stackBefore = err.stack;
    expect(toFrameError(err)).toEqual({
      code: 'CUSTOM',
      message: 'boom',
      nativeError: stackBefore,
    });
  });

  it('FrameAPIError is routed to the envelope adapter, not treated as a duck-typed FrameErrorShape', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 422, {
      error_details: { message: 'Backend says no' },
    });
    // Regression guard: FrameAPIError duck-types as { code, message }, but it
    // must NOT be returned as-is from toFrameError — the envelope wins.
    const result = toFrameError(err);
    expect(result.code).toBe(ErrorCodes.API_VALIDATION);
    expect(result.message).toBe('Backend says no');
    // And isFrameError must reject the FrameAPIError instance so other
    // call sites that branch on `isFrameError` don't grab the wrong message.
    expect(isFrameError(err)).toBe(false);
  });
});
