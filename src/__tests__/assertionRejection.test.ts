jest.mock('framepayments', () => {
  class MockFrameAPIError extends Error {
    status = 0;
    raw: unknown = null;
  }
  return { FrameAPIError: MockFrameAPIError };
});

import { isAssertionRejection } from '../api-errors';

function apiError(status: number, raw: unknown, message = 'An error occurred') {
  return { status, raw, message };
}

describe('isAssertionRejection', () => {
  it('matches a 422 whose envelope message mentions the assertion', () => {
    expect(
      isAssertionRejection(
        apiError(422, { error_details: { message: 'Device assertion was rejected.' } }),
      ),
    ).toBe(true);
  });

  it('matches the other two phrasings iOS matches', () => {
    expect(isAssertionRejection(apiError(422, { error_details: { message: 'Device not attested' } }))).toBe(
      true,
    );
    expect(isAssertionRejection(apiError(422, { error_details: { message: 'Attestation failed' } }))).toBe(
      true,
    );
  });

  it('reads the top-level message when there is no envelope', () => {
    expect(isAssertionRejection(apiError(422, null, 'assertion invalid'))).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAssertionRejection(apiError(422, { error_details: { message: 'ASSERTION BAD' } }))).toBe(true);
  });

  it('ignores a 422 about something else', () => {
    expect(isAssertionRejection(apiError(422, { error_details: { message: 'Card was declined.' } }))).toBe(
      false,
    );
  });

  it('ignores non-422 statuses', () => {
    expect(isAssertionRejection(apiError(400, { error_details: { message: 'assertion' } }))).toBe(false);
    expect(isAssertionRejection(apiError(500, { error_details: { message: 'assertion' } }))).toBe(false);
  });

  it('does not throw on non-error values', () => {
    expect(isAssertionRejection(null)).toBe(false);
    expect(isAssertionRejection(undefined)).toBe(false);
    expect(isAssertionRejection('boom')).toBe(false);
    expect(isAssertionRejection(new Error('plain'))).toBe(false);
  });
});
