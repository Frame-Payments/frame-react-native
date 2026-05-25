// `init()` is deprecated by the Evervault RN SDK since 1.1.0 in favour of
// <EvervaultProvider>. We keep the imperative form here because the SDK's
// card-encryption call site sits in a view model (not a component subtree).
// When 2.x drops `init()`, this wrapper will need to migrate to the provider
// pattern by rendering a hidden <EvervaultProvider> at the modal root and
// reading the encrypt function from React context.
import { encrypt as evervaultEncrypt, init as evervaultInit } from '@evervault/evervault-react-native';

let configuredTeamId: string | null = null;
let configuredAppId: string | null = null;
let inflight: Promise<void> | null = null;

export function configureEvervault(teamId: string, appId: string): Promise<void> {
  if (!teamId || !appId) {
    return Promise.reject(
      Object.assign(new Error('Evervault config requires non-empty teamId and appId'), {
        code: 'EVERVAULT_CONFIG_INVALID',
      }),
    );
  }
  if (configuredTeamId === teamId && configuredAppId === appId) return Promise.resolve();
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      await evervaultInit(teamId, appId);
      configuredTeamId = teamId;
      configuredAppId = appId;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function isEvervaultConfigured(): boolean {
  return configuredTeamId !== null && configuredAppId !== null;
}

/**
 * Encrypts the value with Evervault. Awaits any in-flight `configureEvervault`
 * so callers immediately after `Frame.initialize()` don't see a spurious
 * `EVERVAULT_NOT_CONFIGURED` while the prefetch is still finishing.
 */
export async function encryptWithEvervault(value: string): Promise<string> {
  if (inflight) {
    try {
      await inflight;
    } catch {
      // configure failed; fall through to the not-configured throw below.
    }
  }
  if (!isEvervaultConfigured()) {
    throw Object.assign(new Error('Evervault is not configured. Call Frame.initialize(...) first.'), {
      code: 'EVERVAULT_NOT_CONFIGURED',
    });
  }
  return evervaultEncrypt(value);
}

export function resetEvervault(): void {
  configuredTeamId = null;
  configuredAppId = null;
  inflight = null;
}
