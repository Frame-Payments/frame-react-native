import { FrameSDK } from 'framepayments';
import { getIpAddress, getPublishableKey, getSecretKey } from './config';
import { frameError, ErrorCodes } from './errors';

let sdk: FrameSDK | undefined;

function getClient(): FrameSDK {
  if (sdk) return sdk;
  const apiKey = getSecretKey();
  const publishableKey = getPublishableKey();
  if (!apiKey && !publishableKey) {
    throw frameError(
      ErrorCodes.NOT_INITIALIZED,
      'Frame SDK is not configured. Call Frame.initialize({ secretKey, publishableKey }) first.',
    );
  }
  // Forward the device IP via the `ip_address` header on every request,
  // matching the native Frame iOS / Frame Android SDKs. Omitted when the
  // lookup hasn't completed yet — the next client construction (after
  // resetClients() in the IP-fetch resolver) will pick it up.
  const ip = getIpAddress();
  const defaultHeaders = ip ? { ip_address: ip } : undefined;
  sdk = new FrameSDK({ apiKey, publishableKey, defaultHeaders });
  return sdk;
}

export function resetClients(): void {
  sdk = undefined;
}

export function warmClients(): boolean {
  if (!getSecretKey() && !getPublishableKey()) return false;
  getClient();
  return true;
}

export const client = {
  get sdk(): FrameSDK {
    return getClient();
  },
};
