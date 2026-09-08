import { ErrorCodes, frameError } from './errors';

// Card 3D Secure for the checkout path. Mirrors iOS's ChargeIntentConfirmation
// (`Sources/Frame/Networking/ChargeIntents/ChargeIntentConfirmation.swift`):
// confirm the intent, present a challenge if the API asks for one, then poll for
// the verdict. The challenge presenter is injected so this module stays free of
// UI and can be unit-tested without a WebView.
//
// This is NOT the onboarding `secure_3ds` sub-step, which is a bank-app push
// verification against the ThreeDsIntents resource. This one is the cardholder
// challenge on a charge.

/** The path a challenge redirects to when the cardholder is done with it. */
export const THREE_DS_CALLBACK_PATH = '/evervault/3ds/callback';

/**
 * Whether a navigation URL is the terminal redirect. Matches iOS's check in
 * ThreeDSecureChallengeView's navigation delegate: the path component alone,
 * so host and query string don't matter.
 */
export function isCallbackUrl(url: string): boolean {
  try {
    return new URL(url).pathname === THREE_DS_CALLBACK_PATH;
  } catch {
    // Non-absolute or malformed URLs can't be the callback.
    return false;
  }
}

/**
 * How a presented challenge ended. This is a UI lifecycle signal, not a payment
 * verdict — only the Frame API decides whether the cardholder was charged.
 */
export type ThreeDSecureChallengeResult =
  /** The cardholder finished the challenge. Says nothing about the charge. */
  | 'completed'
  /** The cardholder failed or abandoned it. The charge may still have settled. */
  | 'failed'
  /** The challenge could not be loaded, so it never ran. */
  | 'unavailable';

export type ThreeDSecureChallengePresenter = (
  challengeUrl: string,
) => Promise<ThreeDSecureChallengeResult>;

/** The terminal answer for a confirmed charge. */
export type ChargeOutcome =
  /** Captured, or authorized and awaiting a merchant-initiated capture. */
  | { status: 'succeeded' }
  /** A terminal failure. `message` is absent when the API gave no reason. */
  | { status: 'failed'; code?: string; message?: string }
  /** Every attempt returned a non-terminal status. The charge may still settle. */
  | { status: 'timed_out' };

// Statuses that end the wait. Anything else means "still settling, poll again".
const SUCCESS_STATUSES = new Set(['succeeded', 'requires_capture']);
const FAILURE_STATUSES = new Set(['failed']);

/** Statuses on a created transfer that mean a confirm is still owed. */
const NEEDS_CONFIRMATION_STATUSES = new Set(['requires_confirmation', 'requires_three_d_secure']);

export function requiresConfirmation(status: string | undefined | null): boolean {
  return status != null && NEEDS_CONFIRMATION_STATUSES.has(status);
}

/**
 * The subset of a charge/transfer the confirmation driver reads. Neither
 * `client_secret` nor `next_action` is declared on the framepayments `Transfer`
 * type, but both come back on the wire — iOS reads the same two fields.
 */
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
  // Only load a challenge over https. The value comes from Frame's own API, so
  // this is a defence-in-depth check rather than a suspected attack: a
  // javascript:/file:/http: URL reaching a WebView that is about to handle card
  // authentication is not something to leave to the response being well-formed.
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export interface ConfirmChargeOptions {
  /** Confirms the charge and returns its new state. */
  confirm: (id: string) => Promise<ConfirmableCharge | null>;
  /** Re-reads the charge while polling. */
  reload: (id: string) => Promise<ConfirmableCharge | null>;
  /** Presents a required challenge. Omit to make a required challenge throw. */
  presentChallenge?: ThreeDSecureChallengePresenter;
  /** How many times to read the status before giving up. Defaults to 10. */
  maxAttempts?: number;
  /** Wait between reads, and before the first one. Defaults to 1000ms. */
  intervalMs?: number;
  /** Injected so tests need no real time. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_INTERVAL_MS = 1000;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Confirms a charge the API held back, running a 3D Secure challenge if the
 * confirm asks for one, and reports the charge's real outcome.
 *
 * Polling timings match iOS and the browser SDK: a 1s lead-in, then up to 10
 * reads a second apart.
 */
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
  // Nothing decodable came back, so the state is unknown; poll rather than guess.
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
    // 'completed' and 'failed' both just mean the sheet closed; only a challenge
    // that never ran is an error. The API, not the sheet, decides the verdict.
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
  // The lead-in comes before the first read: the charge needs a beat to settle.
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
    // A failed read consumes an attempt and still waits: fast-retrying a
    // transient 5xx would burn the whole budget in milliseconds.
    await sleep(intervalMs);
  }

  // Returned rather than thrown — the charge may still settle, so the caller
  // must not report it as a decline.
  return { status: 'timed_out' };
}
