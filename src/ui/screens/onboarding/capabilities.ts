import type { OnboardingCapability } from '../../../types';

// Pure reasoning over an account's `capabilities` array. Kept out of
// useOnboardingViewModel so the rules can be unit-tested without a hook, and
// so the "is this capability done?" question has exactly one answer.

/**
 * One entry in `account.capabilities` as returned by the Frame API. The
 * framepayments SDK types the array as `unknown[]`; iOS reads `name`, `status`,
 * `disabled_reason` and `currently_due` (`FrameObjects.Capability`).
 */
export interface AccountCapabilityRow {
  name: string;
  status?: string | null;
  disabled_reason?: string | null;
  currently_due?: ReadonlyArray<string> | null;
}

// A commercial disable, not a verdict about the account holder.
// iOS: `FrameObjects.Capability.productGrantRevokedReason`.
const PRODUCT_GRANT_REVOKED = 'product_grant_revoked';

// The requirement key the backend uses to step an account up to government-ID
// verification.
const IDENTITY_DOCUMENT_REQUIREMENT = 'individual.identity_document';

export function readAccountCapabilities(
  account: { capabilities?: unknown[] } | null | undefined,
): ReadonlyArray<AccountCapabilityRow> {
  const raw = account?.capabilities;
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is AccountCapabilityRow => {
    return typeof c === 'object' && c !== null && typeof (c as { name?: unknown }).name === 'string';
  });
}

/**
 * Whether this capability still stands between the account and a successful
 * onboarding. Mirrors iOS `Capability.isOutstanding`
 * (`Sources/Frame/Networking/Capabilities/CapabilityObjects.swift:233-244`),
 * which reads `status`, NOT `currently_due`: `idv` declares no field keys, so
 * it reports nothing due even while unsatisfied.
 */
export function isCapabilityOutstanding(row: AccountCapabilityRow): boolean {
  switch (row.status) {
    case 'active':
    case 'unrequested':
    case 'ineligible':
      return false;
    case 'disabled':
      return row.disabled_reason !== PRODUCT_GRANT_REVOKED;
    // 'pending' and any unrecognized value degrade to outstanding.
    default:
      return true;
  }
}

/**
 * Requirement keys the applicant can actually resolve. The server blanks
 * `currently_due` only for `ineligible`, so a disabled capability still
 * publishes dead keys — prefer this over reading `currently_due` raw. iOS
 * `Capability.hasActionableRequirements` / `.actionableRequirements`
 * (`CapabilityObjects.swift:248-262`).
 */
export function actionableRequirements(row: AccountCapabilityRow): ReadonlyArray<string> {
  const inert =
    row.status != null &&
    ['active', 'unrequested', 'disabled', 'ineligible'].includes(row.status);
  if (inert) return [];
  return Array.isArray(row.currently_due) ? row.currently_due : [];
}

/**
 * Whether the backend has stepped this account up to government-ID
 * verification. iOS scans EVERY capability row for the key, not just `kyc` — a
 * payout-only account gets it on `bank_account_receive`. iOS
 * `requiresIdentityDocument(_:)` (`OnboardingContainerViewModel.swift:248-252`).
 */
export function requiresIdentityDocument(
  account: { capabilities?: unknown[] } | null | undefined,
): boolean {
  return readAccountCapabilities(account).some((row) =>
    actionableRequirements(row).includes(IDENTITY_DOCUMENT_REQUIREMENT),
  );
}

/**
 * Drop every required capability the account has already satisfied, so the flow
 * skips that step.
 *
 * Judging completion by "empty currently_due" alone drops `idv` while it is
 * still pending: idv's requirement is event-driven and declares no field keys,
 * so its currently_due is empty from the moment it is requested. That is the
 * bug iOS fixed in a9147f3 and guards at
 * `OnboardingContainerViewModel.swift:266-273`. Ask `status` whether the
 * capability is still outstanding instead, falling back to the currently_due
 * test only for rows the server sent with no status at all.
 */
export function trimCompletedCapabilities(
  required: ReadonlyArray<OnboardingCapability>,
  account: { capabilities?: unknown[] } | null | undefined,
): ReadonlyArray<OnboardingCapability> {
  const byName = new Map(readAccountCapabilities(account).map((c) => [c.name, c]));
  return required.filter((r) => {
    const row = byName.get(r);
    if (!row) return true;
    if (row.status != null) return isCapabilityOutstanding(row);
    return !(Array.isArray(row.currently_due) && row.currently_due.length === 0);
  });
}
