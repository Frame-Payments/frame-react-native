import { fetchRemoteConfig } from './remoteConfig';

const IDENTIFY_TIMEOUT_MS = 5_000;

interface FingerprintConfiguration {
  apiKey: string;
  region: string;
}

interface FingerprintAgent {
  getVisitorId(): Promise<string>;
}

type AgentConstructor = new (params: { apiKey: string; region: string }) => FingerprintAgent;

let cachedSdk: AgentConstructor | null | undefined;
let cachedConfig: FingerprintConfiguration | null | undefined;
let cachedAgent: FingerprintAgent | null | undefined;

function loadSdk(): AgentConstructor | null {
  if (cachedSdk !== undefined) return cachedSdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@fingerprintjs/fingerprintjs-pro-react-native') as {
      FingerprintJsProAgent?: AgentConstructor;
    };
    cachedSdk = mod.FingerprintJsProAgent ?? null;
  } catch {
    cachedSdk = null;
  }
  return cachedSdk;
}

export function isFingerprintAvailable(): boolean {
  return loadSdk() !== null;
}

async function fetchConfiguration(): Promise<FingerprintConfiguration | null> {
  if (cachedConfig !== undefined) return cachedConfig;
  const remote = await fetchRemoteConfig();
  if (!remote) return null;
  const block = remote.fingerprint;
  cachedConfig = block?.apiKey && block?.region
    ? { apiKey: block.apiKey, region: block.region }
    : null;
  return cachedConfig;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function getFingerprintVisitorId(): Promise<string | null> {
  const Agent = loadSdk();
  if (!Agent) return null;

  if (cachedAgent === undefined) {
    const config = await fetchConfiguration();
    if (config) {
      cachedAgent = new Agent({ apiKey: config.apiKey, region: config.region });
    } else if (cachedConfig === null) {
      cachedAgent = null;
    }
  }
  if (!cachedAgent) return null;

  try {
    const visitorId = await withTimeout(cachedAgent.getVisitorId(), IDENTIFY_TIMEOUT_MS);
    return typeof visitorId === 'string' && visitorId.length > 0 ? visitorId : null;
  } catch {
    return null;
  }
}

export function __resetFingerprint(): void {
  cachedSdk = undefined;
  cachedConfig = undefined;
  cachedAgent = undefined;
}
