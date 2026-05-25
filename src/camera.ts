import { Platform } from 'react-native';
import { frameError, ErrorCodes } from './errors';

// Thin wrapper around react-native-vision-camera. Mirrors the Plaid + Prove
// dynamic-require pattern so a missing peer dep degrades gracefully.
//
// The wrapper exposes ONLY what UploadDocuments screens need:
//   - isCameraAvailable() — gates the screens
//   - requestCameraPermission() — call from screen mount
//   - The <FrameCameraView /> component itself is in
//     src/ui/primitives/FrameCameraView.tsx (it has React deps so it lives
//     under ui/primitives, but logically it belongs with this wrapper).

export interface CapturedPhoto {
  /** Local file URI for the captured image. Pass to FormData as-is. */
  uri: string;
  /** MIME type, e.g. 'image/jpeg'. */
  type: string;
  /** Suggested file name for multipart upload. */
  name: string;
}

interface VisionCameraModule {
  // We don't type the whole SDK — just the surface our wrapper touches.
  Camera: unknown;
  useCameraDevice?: unknown;
  // v4 / v5 detection: v5 ships Nitro module identifiers; v4 ships a top-level
  // `useCameraPermission` hook + a `Camera` component with `getCameraPermissionStatus`.
  __version?: string;
}

let cachedSdk: VisionCameraModule | null | undefined;

export function loadCameraSdk(): VisionCameraModule | null {
  if (cachedSdk !== undefined) return cachedSdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-vision-camera') as VisionCameraModule;
    cachedSdk = mod;
  } catch {
    cachedSdk = null;
  }
  return cachedSdk;
}

export function isCameraAvailable(): boolean {
  return loadCameraSdk() !== null;
}

export interface CameraPermissionStatus {
  granted: boolean;
  requestable: boolean;
}

/**
 * Request camera permission. The wrapper hides the SDK-version-specific
 * permission-request API behind a single function so the screens can stay
 * agnostic. Returns granted=true when the user authorizes, granted=false
 * with requestable=false when the user has permanently denied.
 */
export async function requestCameraPermission(): Promise<CameraPermissionStatus> {
  const sdk = loadCameraSdk();
  if (!sdk) {
    throw frameError(
      ErrorCodes.CAMERA_UNAVAILABLE,
      'react-native-vision-camera is not installed. Add it to your peer deps and rebuild.',
    );
  }
  // v4: Camera.requestCameraPermission() → 'authorized' | 'denied' | 'restricted'
  // v5: Camera.requestCameraPermission() → 'granted' | 'denied' | 'restricted'
  // Both ship a static method on the Camera class with the same name; the
  // result string varies. Normalize.
  const CameraClass = sdk.Camera as { requestCameraPermission?: () => Promise<string> } | undefined;
  if (!CameraClass?.requestCameraPermission) {
    // Older SDK didn't expose static permission; fall back to deny.
    return { granted: false, requestable: false };
  }
  try {
    const result = await CameraClass.requestCameraPermission();
    const norm = result?.toLowerCase() ?? '';
    if (norm === 'granted' || norm === 'authorized') {
      return { granted: true, requestable: false };
    }
    // iOS prompts the user exactly once. After 'denied' the OS returns the
    // cached value forever — only the Settings app can change it. Android
    // re-prompts on subsequent requests UNLESS the user enabled "Don't ask
    // again," but RN doesn't expose that distinction, so conservatively
    // mark Android-denied as requestable. 'restricted' (parental controls)
    // is irrecoverable on both platforms.
    return { granted: false, requestable: Platform.OS === 'android' && norm === 'denied' };
  } catch {
    return { granted: false, requestable: Platform.OS === 'android' };
  }
}

// Test-only — flushes the cache so tests can swap implementations.
export function __resetCameraSdkCache(): void {
  cachedSdk = undefined;
}
