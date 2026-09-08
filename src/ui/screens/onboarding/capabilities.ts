import type { OnboardingCapability, OnboardingOutcome } from '../../../types';

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

// ─────────────────────────────────────────────────────────────────────────────
// Capability dependency graph
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which capabilities cannot be held without which others, mirroring the
 * server's `Accounts::Capabilities::DependencyGraph::EDGES` and iOS
 * `Capabilities.dependencyEdges`
 * (`Sources/Frame/Networking/Capabilities/CapabilityObjects.swift:200-204`).
 *
 * An edge from A to B means "A cannot be held without B": requesting A also
 * provisions B. This matters for the outcome verdict — the KYC decision lands
 * on the base `kyc` row that `kyc_prefill` drags in, never on `kyc_prefill`
 * itself, so a host that only asked for `kyc_prefill` would otherwise judge
 * against a row that carries no verdict.
 *
 * A new edge added server-side must be mirrored here.
 */
const DEPENDENCY_EDGES: Partial<Record<OnboardingCapability, ReadonlyArray<OnboardingCapability>>> = {
  kyc_prefill: ['kyc', 'phone_verification'],
  creator_shield: ['kyc', 'age_verification'],
  kyc: ['phone_verification'],
};

/** Everything these capabilities drag in with them, themselves included. */
export function withDependencies(
  capabilities: ReadonlyArray<OnboardingCapability>,
): ReadonlySet<OnboardingCapability> {
  const reached = new Set<OnboardingCapability>();
  const pending = [...capabilities];
  while (pending.length > 0) {
    const capability = pending.pop()!;
    if (reached.has(capability)) continue;
    reached.add(capability);
    pending.push(...(DEPENDENCY_EDGES[capability] ?? []));
  }
  return reached;
}

// ─────────────────────────────────────────────────────────────────────────────
// Final outcome
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a capability error's `failure_type` to the API's remediation category,
 * mirroring `Accounts::IdentityVerifications::FailureTypes::CATEGORIES`.
 * Unlisted codes fall through to `unclassified`, which concludes nothing.
 */
const CATEGORY_BY_FAILURE_TYPE: Readonly<Record<string, string>> = {
  identity_mismatch: 'retriable_with_new_data',
  identity_not_found: 'step_up',
  verification_rejected: 'terminal',
  review_pending: 'review',
  provider_error: 'transient',
  signals_unavailable: 'transient',
  unclassified: 'unclassified',
};

interface CapabilityError {
  code?: string | null;
  message?: string | null;
}

function firstCapabilityError(row: AccountCapabilityRow): CapabilityError | null {
  const errors = (row as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const first = errors[0];
  if (typeof first !== 'object' || first === null) return null;
  return first as CapabilityError;
}

/**
 * Resolves how onboarding actually ended. Reaching the last step is not the
 * same as passing verification. Mirrors iOS `OnboardingOutcome.resolve`
 * (`Sources/Frame/Public/OnboardingOutcome.swift:55-89`).
 *
 * `required` empty considers every capability on the account.
 */
export function resolveOnboardingOutcome(
  account: { capabilities?: unknown[] } | null | undefined,
  required: ReadonlyArray<OnboardingCapability>,
): OnboardingOutcome {
  const rows = readAccountCapabilities(account);
  const requiredNames = withDependencies(required);
  const relevant =
    requiredNames.size === 0
      ? rows
      : rows.filter((r) => requiredNames.has(r.name as OnboardingCapability));

  // A required capability missing from the response is not a failure signal.
  // The server silently skips capabilities gated on a merchant switch that is
  // off (geo_compliance, creator_shield), so an absent row usually means the
  // merchant isn't entitled to it — not that the applicant fell short. Judging
  // on what came back is the only sound read.
  const outstanding = relevant.filter(isCapabilityOutstanding);
  if (outstanding.length === 0) return { status: 'approved' };

  // Ranked so a decline is never hidden behind a milder conclusion on another
  // capability.
  let fallback: OnboardingOutcome = { status: 'pending_review' };

  for (const row of outstanding) {
    const error = firstCapabilityError(row);
    const code = error?.code;
    if (!code) continue;
    const message = typeof error?.message === 'string' ? error.message : undefined;
    switch (CATEGORY_BY_FAILURE_TYPE[code]) {
      case 'terminal':
        return { status: 'declined', message };
      // step_up reports retriable: false but is not a decline — documents are
      // the path forward.
      case 'retriable_with_new_data':
      case 'step_up':
        fallback = { status: 'action_required', message };
        break;
      // transient and review are waits, not something the applicant can act on.
      // So is an unrecognized code: a type added server-side must not read as a
      // demand for action.
      default:
        continue;
    }
  }

  return fallback;
}
