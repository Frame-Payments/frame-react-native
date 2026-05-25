import { NativeModules } from 'react-native';

// Thin wrapper around the FrameIpAddress native module. On iOS, getIpAddress()
// resolves immediately via getifaddrs (returns the device's primary interface
// address, e.g. en0 LAN or pdp_ip0 cellular). On Android, the first call
// fetches the public IP from api.ipify.org over the network and caches it for
// app lifecycle; subsequent calls return instantly from the cache.
//
// Both platforms resolve null on failure rather than rejecting, so the caller
// can attach the header opportunistically without error-handling clutter.

interface IpAddressNative {
  getIpAddress(): Promise<string | null>;
}

const FrameIpAddress: IpAddressNative | null =
  (NativeModules.FrameIpAddress as IpAddressNative | undefined) ?? null;

/** Returns the device IP address, or null if the bridge isn't linked or the
 *  lookup failed. Safe to call before native init has completed — failures
 *  surface as null. */
export async function fetchIpAddress(): Promise<string | null> {
  if (!FrameIpAddress) return null;
  try {
    return await FrameIpAddress.getIpAddress();
  } catch {
    return null;
  }
}
