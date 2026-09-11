jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { idvFailureMessage, type IdvCompletion } from '../idv';

function completion(over: Partial<IdvCompletion> = {}): IdvCompletion {
  return { status: 'not_verified', ...over };
}

describe('idvFailureMessage', () => {
  it('points a terminal decline at support, not at a retry', () => {
    expect(idvFailureMessage(completion({ category: 'terminal' }))).toBe(
      "We couldn't verify your identity. Please contact support if you think this is a mistake.",
    );
  });

  it('describes a review as a wait', () => {
    expect(idvFailureMessage(completion({ category: 'review' }))).toBe(
      "Your verification is in review. We'll be in touch once it's complete.",
    );
  });

  it('asks for corrected details on retriable_with_new_data', () => {
    expect(idvFailureMessage(completion({ category: 'retriable_with_new_data' }))).toBe(
      "Some of your details didn't match. Please check them and try again.",
    );
  });

  it('names the government ID on step_up', () => {
    expect(idvFailureMessage(completion({ category: 'step_up' }))).toBe(
      'We need a government ID to finish verifying your identity.',
    );
  });

  it('invites a retry on transient', () => {
    expect(idvFailureMessage(completion({ category: 'transient' }))).toBe(
      "We couldn't complete the check just now. Please try again.",
    );
  });

  it('falls back to status when there is no category', () => {
    expect(idvFailureMessage(completion({ rawStatus: 'declined' }))).toContain('contact support');
    expect(idvFailureMessage(completion({ rawStatus: 'failed' }))).toContain('contact support');
    expect(idvFailureMessage(completion({ rawStatus: 'needs_review' }))).toContain('in review');
  });

  it('offers the SSN fallback by default', () => {
    expect(idvFailureMessage(completion())).toBe(
      "We couldn't verify your identity. Please try again or enter your Social Security Number.",
    );
  });

  it('does not offer an SSN fallback when a government ID is mandatory', () => {
    expect(idvFailureMessage(completion(), true)).toBe(
      "We couldn't verify your identity. Please try again.",
    );
  });

  it('prefers category over status', () => {
    expect(idvFailureMessage(completion({ category: 'review', rawStatus: 'declined' }))).toContain(
      'in review',
    );
  });

  it('ignores an unrecognized category and falls through to status', () => {
    expect(
      idvFailureMessage(completion({ category: 'invented_next_year', rawStatus: 'needs_review' })),
    ).toContain('in review');
  });
});
