import type { FrameTheme } from './types';

export interface FrameConfig {
  secretKey?: string;
  publishableKey?: string;
  debugMode: boolean;
  applePayMerchantId?: string;
  googlePayMerchantId?: string;
  theme?: FrameTheme;
}

export interface EvervaultConfiguration {
  teamId: string;
  appId: string;
}

export interface SiftConfiguration {
  accountId: string;
  beaconKey: string;
  sessionId?: string;
}

interface InternalState extends FrameConfig {
  initialized: boolean;
  evervaultConfiguration?: EvervaultConfiguration;
  siftConfiguration?: SiftConfiguration;
  ipAddress?: string;
}

const state: InternalState = {
  initialized: false,
  debugMode: false,
};

function deepFreezeClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  const copy: T = Array.isArray(value)
    ? ((value.map((v) => deepFreezeClone(v)) as unknown) as T)
    : (Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deepFreezeClone(v)]),
      ) as T);
  return Object.freeze(copy);
}

export function setConfig(config: FrameConfig): void {
  state.secretKey = config.secretKey;
  state.publishableKey = config.publishableKey;
  state.debugMode = config.debugMode;
  state.applePayMerchantId = config.applePayMerchantId;
  state.googlePayMerchantId = config.googlePayMerchantId;
  state.theme = config.theme === undefined ? undefined : deepFreezeClone(config.theme);
  state.initialized = true;
}

export function getConfig(): Readonly<FrameConfig> {
  return {
    secretKey: state.secretKey,
    publishableKey: state.publishableKey,
    debugMode: state.debugMode,
    applePayMerchantId: state.applePayMerchantId,
    googlePayMerchantId: state.googlePayMerchantId,
    theme: state.theme,
  };
}

export function isInitialized(): boolean {
  return state.initialized;
}

export function getPublishableKey(): string | undefined {
  return state.publishableKey;
}

export function getSecretKey(): string | undefined {
  return state.secretKey;
}

export function getDebugMode(): boolean {
  return state.debugMode;
}

export function getTheme(): FrameTheme | undefined {
  return state.theme;
}

export function getApplePayMerchantId(): string | undefined {
  return state.applePayMerchantId;
}

export function getGooglePayMerchantId(): string | undefined {
  return state.googlePayMerchantId;
}

export function getEvervaultConfiguration(): EvervaultConfiguration | undefined {
  return state.evervaultConfiguration;
}

export function getSiftConfiguration(): SiftConfiguration | undefined {
  return state.siftConfiguration;
}

export function getIpAddress(): string | undefined {
  return state.ipAddress;
}

export function resetConfig(): void {
  state.secretKey = undefined;
  state.publishableKey = undefined;
  state.debugMode = false;
  state.applePayMerchantId = undefined;
  state.googlePayMerchantId = undefined;
  state.theme = undefined;
  state.evervaultConfiguration = undefined;
  state.siftConfiguration = undefined;
  state.ipAddress = undefined;
  state.initialized = false;
}

export const __internal = {
  setEvervaultConfiguration(config: EvervaultConfiguration): void {
    state.evervaultConfiguration = config;
  },
  getEvervaultConfiguration(): EvervaultConfiguration | undefined {
    return state.evervaultConfiguration;
  },
  setSiftConfiguration(config: SiftConfiguration): void {
    state.siftConfiguration = config;
  },
  getSiftConfiguration(): SiftConfiguration | undefined {
    return state.siftConfiguration;
  },
  setIpAddress(ip: string | undefined): void {
    state.ipAddress = ip;
  },
  getIpAddress(): string | undefined {
    return state.ipAddress;
  },
};
