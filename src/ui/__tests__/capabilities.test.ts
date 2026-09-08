import {
  actionableRequirements,
  isCapabilityOutstanding,
  readAccountCapabilities,
  requiresIdentityDocument,
  trimCompletedCapabilities,
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
    // iOS scans every capability row, not just kyc — a payout-only account gets
    // the key on bank_account_receive.
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

describe('trimCompletedCapabilities', () => {
  it('keeps idv despite an empty currently_due while it is still pending', () => {
    // idv's requirement is event-driven and declares no field keys, so its
    // currently_due is empty from the moment it is requested. Judging by
    // currently_due alone would drop it while unsatisfied.
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
