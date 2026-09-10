import {
  actionableRequirements,
  hasActiveIdvCapability,
  isCapabilityOutstanding,
  readAccountCapabilities,
  requiresCorrectedKycDetails,
  requiresIdentityDocument,
  resolveBlockedOutcome,
  resolveOnboardingOutcome,
  trimCompletedCapabilities,
  withDependencies,
} from '../screens/onboarding/capabilities';

describe('readAccountCapabilities', () => {
  it('returns [] when capabilities is absent or not an array', () => {
    expect(readAccountCapabilities(null)).toEqual([]);
    expect(readAccountCapabilities(undefined)).toEqual([]);
    expect(readAccountCapabilities({})).toEqual([]);
    expect(readAccountCapabilities({ capabilities: 'nope' as unknown as unknown[] })).toEqual([]);
  });

  it('drops rows without a string name', () => {
    const rows = readAccountCapabilities({ capabilities: [{ name: 'kyc' }, { status: 'pending' }, null, 7] });
    expect(rows).toEqual([{ name: 'kyc' }]);
  });
});

describe('isCapabilityOutstanding', () => {
  it('treats active / unrequested / ineligible as settled', () => {
    for (const status of ['active', 'unrequested', 'ineligible']) {
      expect(isCapabilityOutstanding({ name: 'kyc', status })).toBe(false);
    }
  });

  it('treats pending as outstanding', () => {
    expect(isCapabilityOutstanding({ name: 'kyc', status: 'pending' })).toBe(true);
  });

  it('degrades an unrecognized status to outstanding', () => {
    expect(isCapabilityOutstanding({ name: 'kyc', status: 'something_new' })).toBe(true);
  });

  it('a commercial disable is settled; any other disable still blocks', () => {
    expect(
      isCapabilityOutstanding({ name: 'kyc', status: 'disabled', disabled_reason: 'product_grant_revoked' }),
    ).toBe(false);
    expect(isCapabilityOutstanding({ name: 'kyc', status: 'disabled', disabled_reason: 'rejected' })).toBe(true);
  });
});

describe('actionableRequirements', () => {
  it('returns currently_due for a pending capability', () => {
    expect(actionableRequirements({ name: 'kyc', status: 'pending', currently_due: ['individual.ssn_last_4'] })).toEqual([
      'individual.ssn_last_4',
    ]);
  });

  it('blanks the dead keys a disabled or ineligible capability still publishes', () => {
    for (const status of ['active', 'unrequested', 'disabled', 'ineligible']) {
      expect(actionableRequirements({ name: 'kyc', status, currently_due: ['individual.ssn_last_4'] })).toEqual([]);
    }
  });

  it('trusts currently_due when the server sent no status', () => {
    expect(actionableRequirements({ name: 'kyc', currently_due: ['individual.ssn_last_4'] })).toEqual([
      'individual.ssn_last_4',
    ]);
  });
});

describe('requiresIdentityDocument', () => {
  it('detects the step-up on a non-kyc capability', () => {
    const account = {
      capabilities: [
        { name: 'bank_account_receive', status: 'pending', currently_due: ['individual.identity_document'] },
      ],
    };
    expect(requiresIdentityDocument(account)).toBe(true);
  });

  it('detects the step-up on kyc', () => {
    const account = {
      capabilities: [{ name: 'kyc', status: 'pending', currently_due: ['individual.identity_document'] }],
    };
    expect(requiresIdentityDocument(account)).toBe(true);
  });

  it('is false when no capability lists the key', () => {
    const account = {
      capabilities: [{ name: 'kyc', status: 'pending', currently_due: ['individual.ssn_last_4'] }],
    };
    expect(requiresIdentityDocument(account)).toBe(false);
  });

  it('ignores the key on an ineligible capability, whose currently_due is dead', () => {
    const account = {
      capabilities: [
        { name: 'bank_account_receive', status: 'ineligible', currently_due: ['individual.identity_document'] },
      ],
    };
    expect(requiresIdentityDocument(account)).toBe(false);
  });

  it('is false for a null account', () => {
    expect(requiresIdentityDocument(null)).toBe(false);
  });
});

describe('requiresCorrectedKycDetails', () => {
  // FRA-6552: a KYC run rejected on complete-but-wrong details, surfaced as
  // individual.kyc. Outranks the gov-ID signals in skipsSsnEntry — the
  // applicant cannot fix rejected details through a field they cannot see.
  it('detects the correction step-up', () => {
    const account = {
      capabilities: [{ name: 'kyc', status: 'pending', currently_due: ['individual.kyc'] }],
    };
    expect(requiresCorrectedKycDetails(account)).toBe(true);
  });

  it('is false when no capability lists the key', () => {
    const account = {
      capabilities: [{ name: 'kyc', status: 'pending', currently_due: ['individual.identity_document'] }],
    };
    expect(requiresCorrectedKycDetails(account)).toBe(false);
  });

  it('ignores the key on an ineligible capability, whose currently_due is dead', () => {
    const account = {
      capabilities: [{ name: 'kyc', status: 'ineligible', currently_due: ['individual.kyc'] }],
    };
    expect(requiresCorrectedKycDetails(account)).toBe(false);
  });

  it('is false for a null account', () => {
    expect(requiresCorrectedKycDetails(null)).toBe(false);
  });
});

describe('hasActiveIdvCapability', () => {
  it('detects an active idv capability', () => {
    const account = { capabilities: [{ name: 'idv', status: 'active' }] };
    expect(hasActiveIdvCapability(account)).toBe(true);
  });

  it('is false when idv is present but not active', () => {
    const account = { capabilities: [{ name: 'idv', status: 'pending' }] };
    expect(hasActiveIdvCapability(account)).toBe(false);
  });

  it('is false when idv is absent', () => {
    const account = { capabilities: [{ name: 'kyc', status: 'active' }] };
    expect(hasActiveIdvCapability(account)).toBe(false);
  });

  it('is false for a null account', () => {
    expect(hasActiveIdvCapability(null)).toBe(false);
  });
});

describe('trimCompletedCapabilities', () => {
  it('keeps idv despite an empty currently_due while it is still pending', () => {
    const account = { capabilities: [{ name: 'idv', status: 'pending', currently_due: [] }] };
    expect(trimCompletedCapabilities(['idv'], account)).toEqual(['idv']);
  });

  it('drops idv once it goes active', () => {
    const account = { capabilities: [{ name: 'idv', status: 'active', currently_due: [] }] };
    expect(trimCompletedCapabilities(['idv'], account)).toEqual([]);
  });

  it('drops a satisfied capability and keeps an outstanding one', () => {
    const account = {
      capabilities: [
        { name: 'kyc', status: 'active', currently_due: [] },
        { name: 'bank_account_send', status: 'pending', currently_due: ['external_account'] },
      ],
    };
    expect(trimCompletedCapabilities(['kyc', 'bank_account_send'], account)).toEqual(['bank_account_send']);
  });

  it('keeps a capability the account does not carry at all', () => {
    expect(trimCompletedCapabilities(['kyc'], { capabilities: [] })).toEqual(['kyc']);
  });

  it('falls back to the currently_due test when the server sent no status', () => {
    const account = {
      capabilities: [
        { name: 'kyc', currently_due: [] },
        { name: 'bank_account_send', currently_due: ['external_account'] },
      ],
    };
    expect(trimCompletedCapabilities(['kyc', 'bank_account_send'], account)).toEqual(['bank_account_send']);
  });
});

describe('withDependencies', () => {
  it('reaches phone_verification from kyc_prefill transitively, by way of kyc', () => {
    expect([...withDependencies(['kyc_prefill'])].sort()).toEqual([
      'kyc',
      'kyc_prefill',
      'phone_verification',
    ]);
  });

  it('expands creator_shield into kyc + age_verification + phone_verification', () => {
    expect([...withDependencies(['creator_shield'])].sort()).toEqual([
      'age_verification',
      'creator_shield',
      'kyc',
      'phone_verification',
    ]);
  });

  it('leaves a capability with no edges alone', () => {
    expect([...withDependencies(['card_send'])]).toEqual(['card_send']);
  });

  it('is empty for an empty request', () => {
    expect(withDependencies([]).size).toBe(0);
  });
});

describe('resolveOnboardingOutcome', () => {
  it('approves when nothing relevant is outstanding', () => {
    const account = { capabilities: [{ name: 'kyc', status: 'active' }] };
    expect(resolveOnboardingOutcome(account, ['kyc'])).toEqual({ status: 'approved' });
  });

  it('judges the base kyc row that kyc_prefill drags in', () => {
    const account = {
      capabilities: [
        { name: 'kyc_prefill', status: 'active' },
        {
          name: 'kyc',
          status: 'pending',
          errors: [{ code: 'verification_rejected', message: 'Could not verify identity.' }],
        },
      ],
    };
    expect(resolveOnboardingOutcome(account, ['kyc_prefill'])).toEqual({
      status: 'declined',
      message: 'Could not verify identity.',
    });
  });

  it('a terminal failure declines and is never hidden behind a milder verdict', () => {
    const account = {
      capabilities: [
        { name: 'card_send', status: 'pending', errors: [{ code: 'review_pending' }] },
        { name: 'kyc', status: 'pending', errors: [{ code: 'verification_rejected', message: 'No.' }] },
      ],
    };
    expect(resolveOnboardingOutcome(account, ['kyc', 'card_send'])).toEqual({
      status: 'declined',
      message: 'No.',
    });
  });

  it('identity_mismatch and identity_not_found are actionable, not declines', () => {
    for (const code of ['identity_mismatch', 'identity_not_found']) {
      const account = {
        capabilities: [{ name: 'kyc', status: 'pending', errors: [{ code, message: 'Check details.' }] }],
      };
      expect(resolveOnboardingOutcome(account, ['kyc'])).toEqual({
        status: 'action_required',
        message: 'Check details.',
      });
    }
  });

  it('transient and review codes are waits, so they stay pending_review', () => {
    for (const code of ['provider_error', 'signals_unavailable', 'review_pending']) {
      const account = { capabilities: [{ name: 'kyc', status: 'pending', errors: [{ code }] }] };
      expect(resolveOnboardingOutcome(account, ['kyc'])).toEqual({ status: 'pending_review' });
    }
  });

  it('an unrecognized failure type does not read as a demand for action', () => {
    const account = {
      capabilities: [{ name: 'kyc', status: 'pending', errors: [{ code: 'invented_next_year' }] }],
    };
    expect(resolveOnboardingOutcome(account, ['kyc'])).toEqual({ status: 'pending_review' });
  });

  it('an outstanding capability with no error is pending_review', () => {
    const account = { capabilities: [{ name: 'kyc', status: 'pending' }] };
    expect(resolveOnboardingOutcome(account, ['kyc'])).toEqual({ status: 'pending_review' });
  });

  it('a required capability absent from the response is not a failure signal', () => {
    const account = { capabilities: [{ name: 'kyc', status: 'active' }] };
    expect(resolveOnboardingOutcome(account, ['kyc', 'geo_compliance'])).toEqual({ status: 'approved' });
  });

  it('an empty required list judges every capability on the account', () => {
    const account = {
      capabilities: [{ name: 'kyc', status: 'pending', errors: [{ code: 'verification_rejected' }] }],
    };
    expect(resolveOnboardingOutcome(account, [])).toEqual({ status: 'declined', message: undefined });
  });
});

describe('resolveBlockedOutcome', () => {
  it('is null when nothing is outstanding — belongs to the end-of-flow resolve', () => {
    const account = { capabilities: [{ name: 'kyc', status: 'active' }] };
    expect(resolveBlockedOutcome(account, ['kyc'])).toBeNull();
  });

  it('is null when an outstanding capability still has actionable requirements — a road remains', () => {
    const account = {
      capabilities: [{ name: 'kyc', status: 'pending', currently_due: ['individual.identity_document'] }],
    };
    expect(resolveBlockedOutcome(account, ['kyc'])).toBeNull();
  });

  it('is null on an in-flight run — no actionable requirements but no stated verdict either', () => {
    const account = { capabilities: [{ name: 'kyc', status: 'pending' }] };
    expect(resolveBlockedOutcome(account, ['kyc'])).toBeNull();
  });

  it('is null when the stated verdict is approved or pending_review', () => {
    const declined = {
      capabilities: [{ name: 'kyc', status: 'pending', errors: [{ code: 'provider_error' }] }],
    };
    expect(resolveBlockedOutcome(declined, ['kyc'])).toBeNull();
  });

  it('returns the verdict on a dead end: outstanding, no actionable requirements, declined', () => {
    const account = {
      capabilities: [
        { name: 'kyc', status: 'pending', errors: [{ code: 'verification_rejected', message: 'No.' }] },
      ],
    };
    expect(resolveBlockedOutcome(account, ['kyc'])).toEqual({ status: 'declined', message: 'No.' });
  });

  it('returns the verdict on a dead end that is actionable, not declined', () => {
    const account = {
      capabilities: [
        { name: 'kyc', status: 'pending', errors: [{ code: 'identity_mismatch', message: 'Fix it.' }] },
      ],
    };
    expect(resolveBlockedOutcome(account, ['kyc'])).toEqual({ status: 'action_required', message: 'Fix it.' });
  });

  it('is null for a null account', () => {
    expect(resolveBlockedOutcome(null, ['kyc'])).toBeNull();
  });
});
