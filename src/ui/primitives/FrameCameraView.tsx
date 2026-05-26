import { forwardRef, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { loadCameraSdk, type CapturedPhoto } from '../../camera';
import { useFrameTheme } from '../theme/ThemeContext';

// Imperative camera view used by UploadDocuments capture screens. Wraps the
// react-native-vision-camera surface so screens can render a uniform full-
// screen preview with a "Take photo" button. The SDK exposes two distinct
// APIs (v4 component-ref vs v5 hooks/Nitro); we detect at runtime and pick
// the path that works.
//
// The capture screen mounts this view, holds a ref, and calls ref.take() on
// the shutter tap. Result is a { uri, type, name } shape ready for FormData.

export interface FrameCameraViewHandle {
  /** Take a photo. Resolves with the captured-photo descriptor, or null when
   *  the SDK isn't available / the camera isn't ready. */
  take(): Promise<CapturedPhoto | null>;
}

export interface FrameCameraViewProps {
  /** 'back' (default) for ID photos; 'front' for selfies. */
  position?: 'front' | 'back';
  style?: ViewStyle;
  /** Called when the camera reports an error (no device, permission revoked
   *  mid-flight, etc.) so the parent can show a fallback UI. */
  onError?: (message: string) => void;
}

interface V4CameraInstance {
  takePhoto(): Promise<{ path: string; width?: number; height?: number }>;
}

// vision-camera v5 introduced `usePhotoOutput` as the photo-capture path and
// moved the Camera ref's methods to PreviewViewMethods (no top-level
// takePhoto). v4 didn't ship that hook. The hook's presence is therefore a
// stable v4-vs-v5 signal.
function isV4Compatible(sdk: ReturnType<typeof loadCameraSdk>): boolean {
  if (!sdk) return false;
  return typeof (sdk as { usePhotoOutput?: unknown }).usePhotoOutput !== 'function';
}

export const FrameCameraView = forwardRef(function FrameCameraView(
  { position = 'back', style, onError }: FrameCameraViewProps,
  ref: Ref<FrameCameraViewHandle>,
) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sdk = loadCameraSdk();
  const v4CameraRef = useRef<V4CameraInstance | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      async take() {
        if (!sdk) return null;
        // v4 / v5 detection: v4 exposes a class-based `Camera` with `takePhoto`
        // on the instance. v5 ships a hooks-only API where the controller is
        // returned from useCamera(). We support v4 here; v5 requires a host-
        // app shim. The detection is via the presence of `useCameraDevice`
        // hook (added in v3+, still present in v4; v5 swaps to Nitro modules
        // that the bundler reports as undefined when accessed off the module).
        const v4 = v4CameraRef.current;
        if (v4) {
          try {
            const result = await v4.takePhoto();
            return {
              uri: result.path.startsWith('file://') ? result.path : `file://${result.path}`,
              type: 'image/jpeg',
              name: `frame-doc-${Date.now()}.jpg`,
            };
          } catch (err) {
            onError?.(err instanceof Error ? err.message : 'Could not capture photo.');
            return null;
          }
        }
        // No ref attached yet — likely a v5 install where the API surface
        // changed enough that this primitive can't drive it. Surface a clear
        // error rather than silently failing.
        onError?.(
          'Camera SDK is installed but the version is not supported. Use react-native-vision-camera v4.x or implement a custom camera screen.',
        );
        return null;
      },
    }),
    [sdk, onError],
  );

  // v4 vs v5 detection. v5 dropped the component-ref takePhoto() in favor of
  // a `useCamera()` controller + `usePhotoOutput()` hook flow. The current
  // wrapper targets v4's component-ref pattern; mounting v5's Camera would
  // give us a ref without a take() method and crash on shutter tap. Surface
  // a clear fallback so the user / host app gets actionable guidance.
  const supported = isV4Compatible(sdk);

  if (!sdk || !supported) {
    return (
      <View style={[styles.fallback, style, { backgroundColor: theme.colors.surface }]}>
        <Text
          style={[
            styles.fallbackText,
            { color: theme.colors.textSecondary, fontSize: theme.fonts.body.size },
          ]}
        >
          {!sdk
            ? 'Camera is not available. Install react-native-vision-camera and rebuild the app.'
            : 'react-native-vision-camera v5+ photo capture is not yet supported. Pin to v4.x or supply a custom capture screen.'}
        </Text>
      </View>
    );
  }

  // Defer the actual <Camera/> render to a SDK-version-aware child so this
  // file can stay free of vision-camera typings.
  return (
    <View style={[styles.container, style]}>
      <LazyCameraSurface
        position={position}
        sdk={sdk}
        onCameraReady={(instance) => {
          v4CameraRef.current = instance;
        }}
        onError={onError}
      />
    </View>
  );
});

interface LazyCameraSurfaceProps {
  position: 'front' | 'back';
  sdk: ReturnType<typeof loadCameraSdk>;
  onCameraReady: (instance: V4CameraInstance | null) => void;
  onError?: (message: string) => void;
}

// Renders the actual react-native-vision-camera <Camera /> view. Isolated so
// the v4 component-ref pattern stays here and we don't pollute the top-level
// component with SDK-specific types.
function LazyCameraSurface({ position, sdk, onCameraReady, onError }: LazyCameraSurfaceProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!sdk) return null;
  type V4Sdk = {
    Camera: React.ComponentType<{
      ref: React.Ref<V4CameraInstance>;
      device: unknown;
      isActive: boolean;
      photo?: boolean;
      style?: ViewStyle;
    }>;
    useCameraDevice?: (pos: string) => unknown;
  };
  const v4 = sdk as unknown as V4Sdk;
  const useDevice = v4.useCameraDevice;
  if (typeof useDevice !== 'function') {
    onError?.('Camera SDK does not expose useCameraDevice. Use react-native-vision-camera v4.x.');
    return (
      <View style={styles.notReady}>
        <Text style={[styles.notReadyText, { color: theme.colors.textSecondary }]}>
          Camera unavailable on this SDK version.
        </Text>
      </View>
    );
  }
  // The presence check above is a one-time SDK-version probe — `useDevice` is
  // either defined for the installed vision-camera or it isn't, so call order
  // is stable across renders for any given instance.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const device = useDevice(position);
  if (!device) {
    return (
      <View style={styles.notReady}>
        <Text style={[styles.notReadyText, { color: theme.colors.textSecondary }]}>
          No {position === 'front' ? 'front' : 'back'} camera available.
        </Text>
      </View>
    );
  }
  return (
    <v4.Camera
      ref={(instance: V4CameraInstance | null) => onCameraReady(instance)}
      device={device}
      isActive
      photo
      style={StyleSheet.absoluteFill}
    />
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    fallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    fallbackText: {
      textAlign: 'center',
    },
    notReady: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000',
      paddingHorizontal: 24,
    },
    notReadyText: {
      textAlign: 'center',
      fontSize: 14,
    },
  });
}
