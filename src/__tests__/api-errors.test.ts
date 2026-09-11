import { FrameAPIError } from 'framepayments';
import {
  toToastMessage,
  toFrameError,
  isNotFoundError,
  isTransportError,
  isUnrecoverableCheckoutError,
  isValidationError,
  DEFAULT_TOAST_FALLBACK,
} from '../api-errors';
import { ErrorCodes, isFrameError, frameError } from '../errors';

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

  it('maps sonar_session_required to human copy', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 422, {
      error_details: { message: 'sonar_session_required' },
    });
    expect(toToastMessage(err)).toBe("Error: We couldn't verify this device. Please try again.");
  });

  it('maps geo_compliance_blocked to human copy', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 403, {
      error: 'geo_compliance_blocked',
    });
    expect(toToastMessage(err)).toBe("Error: Payments aren't available in your location.");
  });

  it('maps geo_compliance_vpn_detected to human copy', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 403, {
      error_details: 'geo_compliance_vpn_detected',
    });
    expect(toToastMessage(err)).toBe('Error: Please turn off your VPN or proxy and try again.');
  });

  it('risk-code mapping is case-insensitive and trims whitespace', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 422, {
      error_details: { message: '  SONAR_SESSION_REQUIRED  ' },
    });
    expect(toToastMessage(err)).toBe("Error: We couldn't verify this device. Please try again.");
  });

  it('leaves an unrecognized message untouched', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 422, {
      error_details: { message: 'Card submitted is not a test card' },
    });
    expect(toToastMessage(err)).toBe('Error: Card submitted is not a test card');
  });

  it('maps a risk code surfaced via error.message with no envelope', () => {
    const err = new FrameAPIError('geo_compliance_blocked', 'unknown_error', 403, null);
    expect(toToastMessage(err)).toBe("Error: Payments aren't available in your location.");
  });
});

describe('isNotFoundError', () => {
  it('is true for a 404', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 404, {
      error: 'Not Found',
    });
    expect(isNotFoundError(err)).toBe(true);
  });

  // The negative cases carry the weight: onboarding uses this to decide whether
  // to discard a host-supplied accountId, and a false positive there silently
  // creates a duplicate account.
  it('is false for other 4xx statuses', () => {
    const err = new FrameAPIError('Validation', 'unknown_error', 422, {});
    expect(isNotFoundError(err)).toBe(false);
  });

  it('is false for 5xx server errors', () => {
    const err = new FrameAPIError('Server', 'unknown_error', 500, {});
    expect(isNotFoundError(err)).toBe(false);
  });

  it('is false for a status-0 network failure', () => {
    const err = new FrameAPIError('Network down', 'network_error', 0, null);
    expect(isNotFoundError(err)).toBe(false);
  });

  it('is false for non-FrameAPIError throws', () => {
    expect(isNotFoundError(new Error('not found'))).toBe(false);
    expect(isNotFoundError('404')).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
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

describe('isUnrecoverableCheckoutError', () => {
  it('flags a missing secret key on a server-only operation', () => {
    const err = frameError(ErrorCodes.MISSING_SECRET_KEY, 'Checkout requires a secret key.');
    expect(isUnrecoverableCheckoutError(err)).toBe(true);
  });

  it('flags NOT_INITIALIZED, INVALID_ACCOUNT, INVALID_AMOUNT, INVALID_MERCHANT_ID', () => {
    for (const code of [
      ErrorCodes.NOT_INITIALIZED,
      ErrorCodes.INVALID_ACCOUNT,
      ErrorCodes.INVALID_AMOUNT,
      ErrorCodes.INVALID_MERCHANT_ID,
    ]) {
      expect(isUnrecoverableCheckoutError(frameError(code, 'x'))).toBe(true);
    }
  });

  it('does not flag a declined card or other recoverable payment failure', () => {
    expect(isUnrecoverableCheckoutError(frameError(ErrorCodes.PAYMENT_FAILED, 'declined'))).toBe(false);
    expect(isUnrecoverableCheckoutError(frameError(ErrorCodes.API_VALIDATION, 'bad zip'))).toBe(false);
    expect(isUnrecoverableCheckoutError(frameError(ErrorCodes.API_NETWORK, 'timeout'))).toBe(false);
  });

  it('does not flag a FrameAPIError (server-side decline)', () => {
    const err = new FrameAPIError('An error occurred', 'card_declined', 402, {
      error_details: { message: 'Your card was declined.' },
    });
    expect(isUnrecoverableCheckoutError(err)).toBe(false);
  });

  it('does not flag USER_CANCELED', () => {
    expect(isUnrecoverableCheckoutError(frameError(ErrorCodes.USER_CANCELED, 'x'))).toBe(false);
  });

  it('does not throw and returns false for a non-error value', () => {
    expect(isUnrecoverableCheckoutError(undefined)).toBe(false);
    expect(isUnrecoverableCheckoutError('boom')).toBe(false);
    expect(isUnrecoverableCheckoutError(null)).toBe(false);
  });
});

describe('isValidationError', () => {
  it('flags VALIDATION_FAILED', () => {
    const err = frameError(ErrorCodes.VALIDATION_FAILED, 'Resolve the highlighted fields and try again.');
    expect(isValidationError(err)).toBe(true);
  });

  it('does not flag a real payment/API failure', () => {
    expect(isValidationError(frameError(ErrorCodes.PAYMENT_FAILED, 'declined'))).toBe(false);
    expect(isValidationError(frameError(ErrorCodes.API_VALIDATION, 'bad zip'))).toBe(false);
    expect(isValidationError(frameError(ErrorCodes.API_NETWORK, 'timeout'))).toBe(false);
  });

  it('does not flag a FrameAPIError (server-side response)', () => {
    const err = new FrameAPIError('An error occurred', 'unknown_error', 500, {});
    expect(isValidationError(err)).toBe(false);
  });

  it('does not throw and returns false for a non-error value', () => {
    expect(isValidationError(undefined)).toBe(false);
    expect(isValidationError('boom')).toBe(false);
    expect(isValidationError(null)).toBe(false);
  });
});
