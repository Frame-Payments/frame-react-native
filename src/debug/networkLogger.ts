import type { FrameSDK } from 'framepayments';

// Dev-only network logger. Mirrors the iOS SDK's debug print: every request
// and response is logged with method, path, headers, and body. Gated on
// __DEV__ so production builds are silent.
//
// The framepayments SDK doesn't expose its axios instance directly, but every
// API surface stores it on `.client`. We grab that instance via `sdk.accounts`
// and attach interceptors — there's only one axios client per FrameSDK, shared
// across all surfaces, so a single attach covers every endpoint.

const REDACTED = '<redacted>';
const SENSITIVE_HEADERS = new Set(['authorization', 'x-frame-use-publishable-key']);

let attached = false;

export function attachNetworkLogger(sdk: FrameSDK): void {
  // `__DEV__` is a Metro-injected global at runtime; in Jest's node runtime it's
  // undefined. Guard with `typeof` so the logger no-ops cleanly under tests
  // (mirrors the same pattern in src/plaid.ts:129).
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (!isDev || attached) return;
  const axiosClient = (sdk.accounts as unknown as { client?: AxiosLike }).client;
  if (!axiosClient?.interceptors) return;

  axiosClient.interceptors.request.use((config) => {
    const id = nextRequestId();
    (config as { __frameLogId?: number }).__frameLogId = id;
    const method = (config.method ?? 'get').toUpperCase();
    const url = buildFullUrl(config.baseURL, config.url, config.params);
    // eslint-disable-next-line no-console
    console.log(
      `[Frame ▶ #${id}] ${method} ${url}\n  headers: ${formatHeaders(config.headers)}` +
        (config.data !== undefined ? `\n  body: ${formatBody(config.data)}` : ''),
    );
    return config;
  });

  axiosClient.interceptors.response.use(
    (response) => {
      const id = (response.config as { __frameLogId?: number }).__frameLogId;
      // eslint-disable-next-line no-console
      console.log(
        `[Frame ◀ #${id ?? '?'}] ${response.status} ${response.config.url}\n  body: ${formatBody(response.data)}`,
      );
      return response;
    },
    (error: unknown) => {
      const e = (error ?? {}) as {
        config?: { __frameLogId?: number; url?: string };
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      const config = e.config ?? {};
      const status = e.response?.status ?? 'ERR';
      const body = e.response?.data ?? e.message;
      // eslint-disable-next-line no-console
      console.log(
        `[Frame ◀ #${config.__frameLogId ?? '?'}] ${status} ${config.url ?? ''}\n  error: ${formatBody(body)}`,
      );
      throw error;
    },
  );

  attached = true;
}

export function resetNetworkLogger(): void {
  attached = false;
}

let requestCounter = 0;
function nextRequestId(): number {
  requestCounter += 1;
  return requestCounter;
}

function buildFullUrl(base: string | undefined, url: string | undefined, params: unknown): string {
  const path = url ?? '';
  const root = base ? base.replace(/\/$/, '') : '';
  const full = path.startsWith('http') ? path : `${root}${path.startsWith('/') ? '' : '/'}${path}`;
  if (params && typeof params === 'object' && Object.keys(params as object).length > 0) {
    const qs = Object.entries(params as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    return qs ? `${full}?${qs}` : full;
  }
  return full;
}

function formatHeaders(headers: unknown): string {
  if (!headers || typeof headers !== 'object') return '{}';
  const flat: Record<string, string> = {};
  const source = headers as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value == null) continue;
    if (typeof value === 'object') continue; // axios's per-method header buckets
    flat[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? REDACTED : String(value);
  }
  return JSON.stringify(flat);
}

function formatBody(body: unknown): string {
  if (body == null) return 'null';
  if (typeof body === 'string') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  try {
    return JSON.stringify(body, null, 2);
  } catch {
    return String(body);
  }
}

interface AxiosLike {
  interceptors: {
    request: {
      use: (
        onFulfilled: (config: AxiosRequestConfigLike) => AxiosRequestConfigLike,
      ) => number;
    };
    response: {
      use: (
        onFulfilled: (response: AxiosResponseLike) => AxiosResponseLike,
        onRejected?: (error: unknown) => unknown,
      ) => number;
    };
  };
}

interface AxiosRequestConfigLike {
  method?: string;
  url?: string;
  baseURL?: string;
  headers?: unknown;
  data?: unknown;
  params?: unknown;
}

interface AxiosResponseLike {
  status: number;
  data: unknown;
  config: AxiosRequestConfigLike;
}
