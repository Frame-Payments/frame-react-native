import { client } from './client';
import { ErrorCodes, frameError } from './errors';

// Thin wrapper around react-native-plaid-link-sdk so the rest of the SDK
// doesn't have to deal with the dynamic import / peer-dep dance. Mirrors the
// Prove orchestrator pattern: a guarded `isPlaidAvailable()` plus a single
// `openPlaidLink({ accountId })` entry point that handles the create/open
// dance and resolves with the Plaid public token + selected account.
//
// The Plaid SDK is an OPTIONAL peer dep. Host apps without bank-account
// onboarding capabilities don't need it. We lazy-require it so a missing
// dep doesn't crash module load — `isPlaidAvailable()` returns false and the
// onboarding screen hides the Plaid button.

interface PlaidLinkSuccessAccount {
  id: string;
  name?: string;
  mask?: string;
  subtype?: string;
}

interface PlaidLinkSuccessMetadata {
  institution?: { name?: string; institutionId?: string };
  accounts: PlaidLinkSuccessAccount[];
}

interface PlaidLinkSuccess {
  publicToken: string;
  metadata: PlaidLinkSuccessMetadata;
}

interface PlaidLinkExit {
  error?: { errorCode?: string; errorMessage?: string };
}

interface PlaidLinkSdk {
  create(props: {
    token: string;
    onLoad?: () => void;
    noLoadingState?: boolean;
  }): void;
  open(props: {
    onSuccess: (success: PlaidLinkSuccess) => void;
    onExit?: (exit: PlaidLinkExit) => void;
  }): void;
  destroy(): Promise<void>;
  dismissLink(): void;
}

let cachedSdk: PlaidLinkSdk | null | undefined;

function loadSdk(): PlaidLinkSdk | null {
  if (cachedSdk !== undefined) return cachedSdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-plaid-link-sdk');
    cachedSdk = mod as PlaidLinkSdk;
  } catch {
    cachedSdk = null;
  }
  return cachedSdk;
}

export function isPlaidAvailable(): boolean {
  return loadSdk() !== null;
}

export interface PlaidConnectResult {
  publicToken: string;
  selectedAccountId: string;
  institutionName?: string;
  subtype?: string;
}

/**
 * Opens Plaid Link for the given Frame account. Fetches a link token via
 * frame-node's publishable-key route, calls Plaid's create() + open(), and
 * resolves with the public token + selected account on success. Rejects with
 * USER_CANCELED on dismiss, PAYMENT_FAILED on any other Plaid error, or
 * PLAID_UNAVAILABLE if the SDK isn't installed.
 *
 * The promise lifecycle owns the create/open round-trip: callers don't have
 * to think about Plaid's React component model or destroy() cleanup.
 */
export async function openPlaidLink(opts: { accountId: string }): Promise<PlaidConnectResult> {
  const sdk = loadSdk();
  if (!sdk) {
    throw frameError(
      ErrorCodes.PLAID_UNAVAILABLE,
      'Plaid is not installed in this app. Add react-native-plaid-link-sdk to your peer deps and rebuild.',
    );
  }

  const tokenResponse = await client.sdk.accounts.getPlaidLinkToken(opts.accountId, {
    usePublishableKey: true,
  });
  const linkToken = tokenResponse.link_token;
  if (!linkToken) {
    throw frameError(ErrorCodes.PAYMENT_FAILED, 'Frame returned no Plaid link token.');
  }

  // Plaid's create() returns void and synchronously caches the configuration;
  // open() picks the cached config up and triggers the modal. The two-call
  // ordering is the SDK's documented pattern even though the race-safety
  // isn't stated explicitly. Don't reorder without re-reading Plaid docs.
  return new Promise<PlaidConnectResult>((resolve, reject) => {
    let settled = false;
    function settleResolve(value: PlaidConnectResult) {
      if (settled) return;
      settled = true;
      resolve(value);
    }
    function settleReject(err: unknown) {
      if (settled) return;
      settled = true;
      reject(err);
    }

    sdk.create({ token: linkToken });
    sdk.open({
      onSuccess: (success) => {
        const account = success.metadata.accounts[0];
        if (!account) {
          settleReject(frameError(ErrorCodes.PAYMENT_FAILED, 'Plaid returned no selected account.'));
          return;
        }
        // Plaid normally returns exactly one selected account, but some
        // institutions surface multiple. The Frame backend takes a single
        // account_id so we pick the first; flag in dev to catch future flows
        // that need a per-account picker.
        if (success.metadata.accounts.length > 1 && typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn(
            `[Frame] Plaid returned ${success.metadata.accounts.length} accounts; using the first.`,
          );
        }
        settleResolve({
          publicToken: success.publicToken,
          selectedAccountId: account.id,
          institutionName: success.metadata.institution?.name,
          subtype: account.subtype,
        });
      },
      onExit: (exit) => {
        if (exit.error) {
          settleReject(
            frameError(ErrorCodes.PAYMENT_FAILED, exit.error.errorMessage ?? 'Plaid Link failed.'),
          );
          return;
        }
        settleReject(frameError(ErrorCodes.USER_CANCELED, 'User dismissed Plaid Link.'));
      },
    });
  });
}

/** Force-dismiss any in-flight Plaid Link session. Safe to call when nothing
 *  is open. Used by the parent's cancel path on screen teardown. */
export function dismissPlaidLink(): void {
  const sdk = loadSdk();
  sdk?.dismissLink();
}

// Test-only — clears the SDK cache so tests can swap implementations between
// `react-native-plaid-link-sdk is missing` and `present` scenarios.
export function __resetPlaidSdkCache(): void {
  cachedSdk = undefined;
}
