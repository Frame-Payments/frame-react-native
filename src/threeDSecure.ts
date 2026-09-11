import { ErrorCodes, frameError } from './errors';

export const THREE_DS_CALLBACK_PATH = '/evervault/3ds/callback';

export function isCallbackUrl(url: string): boolean {
  try {
    return new URL(url).pathname === THREE_DS_CALLBACK_PATH;
  } catch {
    return false;
  }
}

export type ThreeDSecureChallengeResult =
  | 'completed'
  | 'failed'
  | 'unavailable';

export type ThreeDSecureChallengePresenter = (
  challengeUrl: string,
) => Promise<ThreeDSecureChallengeResult>;

export type ChargeOutcome =
  | { status: 'succeeded' }
  | { status: 'failed'; code?: string; message?: string }
  | { status: 'timed_out' };

const SUCCESS_STATUSES = new Set(['succeeded', 'requires_capture']);
const FAILURE_STATUSES = new Set(['failed']);

const NEEDS_CONFIRMATION_STATUSES = new Set(['requires_confirmation', 'requires_three_d_secure']);

export function requiresConfirmation(status: string | undefined | null): boolean {
  return status != null && NEEDS_CONFIRMATION_STATUSES.has(status);
}

export interface ConfirmableCharge {
  id: string;
  status?: string | null;
  client_secret?: string | null;
  next_action?: { use_frame_sdk?: { challenge_url?: string | null } | null } | null;
}

function terminalOutcome(charge: ConfirmableCharge): ChargeOutcome | null {
  const status = charge.status ?? '';
  if (SUCCESS_STATUSES.has(status)) return { status: 'succeeded' };
  if (FAILURE_STATUSES.has(status)) {
    const reason = failureReason(charge);
    return { status: 'failed', ...reason };
  }
  return null;
}

function failureReason(charge: ConfirmableCharge): { code?: string; message?: string } {
  const latest = (charge as { latest_charge?: unknown }).latest_charge;
  if (typeof latest !== 'object' || latest === null) return {};
  const { failure_code: code, failure_message: message } = latest as {
    failure_code?: unknown;
    failure_message?: unknown;
  };
  return {
    ...(typeof code === 'string' ? { code } : {}),
    ...(typeof message === 'string' ? { message } : {}),
  };
}

function challengeUrlOf(charge: ConfirmableCharge): string | null {
  const url = charge.next_action?.use_frame_sdk?.challenge_url;
  if (typeof url !== 'string' || url.length === 0) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export interface ConfirmChargeOptions {
  confirm: (id: string) => Promise<ConfirmableCharge | null>;
  reload: (id: string) => Promise<ConfirmableCharge | null>;
  presentChallenge?: ThreeDSecureChallengePresenter;
  maxAttempts?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_INTERVAL_MS = 1000;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function confirmCharge(
  charge: ConfirmableCharge,
  opts: ConfirmChargeOptions,
): Promise<ChargeOutcome> {
  const {
    confirm,
    reload,
    presentChallenge,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    intervalMs = DEFAULT_INTERVAL_MS,
    sleep = realSleep,
  } = opts;
  const attempts = Math.max(1, maxAttempts);

  const confirmed = await confirm(charge.id);
  if (!confirmed) return pollForTerminal(charge.id, reload, attempts, intervalMs, sleep);

  const immediate = terminalOutcome(confirmed);
  if (immediate) return immediate;

  if (confirmed.status === 'requires_three_d_secure') {
    const challengeUrl = challengeUrlOf(confirmed);
    if (!challengeUrl) {
      throw frameError(
        ErrorCodes.PAYMENT_FAILED,
        'Card verification could not be started. Please try again.',
      );
    }
    if (!presentChallenge) {
      throw frameError(
        ErrorCodes.PAYMENT_FAILED,
        'Card verification could not be started. Please try again.',
      );
    }
    if ((await presentChallenge(challengeUrl)) === 'unavailable') {
      throw frameError(
        ErrorCodes.PAYMENT_FAILED,
        'Card verification could not be started. Please try again.',
      );
    }
  }

  return pollForTerminal(confirmed.id, reload, attempts, intervalMs, sleep);
}

async function pollForTerminal(
  id: string,
  reload: (id: string) => Promise<ConfirmableCharge | null>,
  maxAttempts: number,
  intervalMs: number,
  sleep: (ms: number) => Promise<void>,
): Promise<ChargeOutcome> {
  await sleep(intervalMs);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const charge = await reload(id);
      if (charge) {
        const outcome = terminalOutcome(charge);
        if (outcome) return outcome;
      }
    } catch (err) {
      if (attempt === maxAttempts) {
        throw frameError(
          ErrorCodes.API_NETWORK,
          `Could not read the payment status after ${maxAttempts} attempts: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    await sleep(intervalMs);
  }

  return { status: 'timed_out' };
}
