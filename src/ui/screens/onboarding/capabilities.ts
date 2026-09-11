import type { OnboardingCapability, OnboardingOutcome } from '../../../types';

export interface AccountCapabilityRow {
  name: string;
  status?: string | null;
  disabled_reason?: string | null;
  currently_due?: ReadonlyArray<string> | null;
}

const PRODUCT_GRANT_REVOKED = 'product_grant_revoked';

const IDENTITY_DOCUMENT_REQUIREMENT = 'individual.identity_document';

const KYC_CORRECTION_REQUIREMENT = 'individual.kyc';

export function readAccountCapabilities(
  account: { capabilities?: unknown[] } | null | undefined,
): ReadonlyArray<AccountCapabilityRow> {
  const raw = account?.capabilities;
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is AccountCapabilityRow => {
    return typeof c === 'object' && c !== null && typeof (c as { name?: unknown }).name === 'string';
  });
}

export function isCapabilityOutstanding(row: AccountCapabilityRow): boolean {
  switch (row.status) {
    case 'active':
    case 'unrequested':
    case 'ineligible':
      return false;
    case 'disabled':
      return row.disabled_reason !== PRODUCT_GRANT_REVOKED;
    default:
      return true;
  }
}

export function actionableRequirements(row: AccountCapabilityRow): ReadonlyArray<string> {
  const inert =
    row.status != null &&
    ['active', 'unrequested', 'disabled', 'ineligible'].includes(row.status);
  if (inert) return [];
  return Array.isArray(row.currently_due) ? row.currently_due : [];
}

export function requiresIdentityDocument(
  account: { capabilities?: unknown[] } | null | undefined,
): boolean {
  return readAccountCapabilities(account).some((row) =>
    actionableRequirements(row).includes(IDENTITY_DOCUMENT_REQUIREMENT),
  );
}

export function requiresCorrectedKycDetails(
  account: { capabilities?: unknown[] } | null | undefined,
): boolean {
  return readAccountCapabilities(account).some((row) =>
    actionableRequirements(row).includes(KYC_CORRECTION_REQUIREMENT),
  );
}

export function hasActiveIdvCapability(
  account: { capabilities?: unknown[] } | null | undefined,
): boolean {
  return readAccountCapabilities(account).some((row) => row.name === 'idv' && row.status === 'active');
}

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

const DEPENDENCY_EDGES: Partial<Record<OnboardingCapability, ReadonlyArray<OnboardingCapability>>> = {
  kyc_prefill: ['kyc', 'phone_verification'],
  creator_shield: ['kyc', 'age_verification'],
  kyc: ['phone_verification'],
};

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

  const outstanding = relevant.filter(isCapabilityOutstanding);
  if (outstanding.length === 0) return { status: 'approved' };

  let fallback: OnboardingOutcome = { status: 'pending_review' };

  for (const row of outstanding) {
    const error = firstCapabilityError(row);
    const code = error?.code;
    if (!code) continue;
    const message = typeof error?.message === 'string' ? error.message : undefined;
    switch (CATEGORY_BY_FAILURE_TYPE[code]) {
      case 'terminal':
        return { status: 'declined', message };
      case 'retriable_with_new_data':
      case 'step_up':
        fallback = { status: 'action_required', message };
        break;
      default:
        continue;
    }
  }

  return fallback;
}

export function resolveBlockedOutcome(
  account: { capabilities?: unknown[] } | null | undefined,
  required: ReadonlyArray<OnboardingCapability>,
): OnboardingOutcome | null {
  const rows = readAccountCapabilities(account);
  if (rows.length === 0) return null;

  const outstanding = rows.filter(isCapabilityOutstanding);
  if (outstanding.length === 0) return null;
  if (outstanding.some((row) => actionableRequirements(row).length > 0)) return null;

  const outcome = resolveOnboardingOutcome(account, required);
  return outcome.status === 'declined' || outcome.status === 'action_required' ? outcome : null;
}
