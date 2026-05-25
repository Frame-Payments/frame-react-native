import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { FrameCameraView, type FrameCameraViewHandle } from '../../../primitives/FrameCameraView';
import { Button } from '../../../primitives/Button';
import { requestCameraPermission } from '../../../../camera';
import type { CapturedPhoto } from '../../../../camera';

// Generic full-screen camera capture screen used by Front / Back / Selfie.
// Renders a vision-camera preview with a translucent viewfinder overlay and
// a shutter button. Calls `onCaptured(photo)` once the user takes a photo.

export type ViewfinderShape = 'rectangle' | 'oval';

export interface CaptureScreenProps {
  title: string;
  prompt: string;
  viewfinder: ViewfinderShape;
  cameraPosition: 'front' | 'back';
  onCaptured: (photo: CapturedPhoto) => void;
  onCancel: () => void;
}

export function CaptureScreen({
  title,
  prompt,
  viewfinder,
  cameraPosition,
  onCaptured,
  onCancel,
}: CaptureScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cameraRef = useRef<FrameCameraViewHandle | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [taking, setTaking] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // Mounted flag so the shutter promise can't fire setState / onCaptured
  // after the user has tapped Back mid-capture.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const status = await requestCameraPermission();
        if (!mountedRef.current) return;
        if (!status.granted) setPermissionDenied(true);
      } catch (err) {
        if (!mountedRef.current) return;
        setCameraError(err instanceof Error ? err.message : 'Camera is unavailable.');
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleShutter() {
    if (taking) return;
    setTaking(true);
    try {
      const photo = await cameraRef.current?.take();
      if (!mountedRef.current) return;
      if (photo) onCaptured(photo);
    } finally {
      if (mountedRef.current) setTaking(false);
    }
  }

  return (
    <View style={styles.container}>
      <FrameCameraView
        ref={cameraRef}
        position={cameraPosition}
        style={StyleSheet.absoluteFill}
        onError={setCameraError}
      />
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.overlayTop}>
          <View
            style={[
              viewfinder === 'oval' ? styles.viewfinderOval : styles.viewfinderRect,
              { borderColor: theme.colors.surface },
            ]}
          />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={[styles.prompt, { color: '#FFFFFF' }]}>{prompt}</Text>
        </View>
      </View>
      <View style={styles.cancelRow}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={12}
          style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.55 }]}
        >
          <Text style={styles.cancelText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.titleText}>{title}</Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={styles.shutterRow}>
        {permissionDenied ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>
              Camera permission was denied. Enable it in Settings to upload your ID.
            </Text>
            <Button text="Back" variant="secondary" onPress={onCancel} />
          </View>
        ) : cameraError ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>{cameraError}</Text>
            <Button text="Back" variant="secondary" onPress={onCancel} />
          </View>
        ) : (
          <Pressable
            onPress={handleShutter}
            disabled={taking}
            accessibilityRole="button"
            accessibilityLabel="Capture photo"
            style={({ pressed }) => [
              styles.shutter,
              {
                borderColor: '#FFFFFF',
                backgroundColor: pressed || taking ? 'rgba(255,255,255,0.5)' : 'transparent',
              },
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const VIEWFINDER_WIDTH = 320;
const VIEWFINDER_HEIGHT_RECT = 200;
const VIEWFINDER_SIZE_OVAL = 280;
const SHUTTER_SIZE = 76;

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overlayTop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
    },
    overlayBottom: {
      paddingHorizontal: 24,
      paddingBottom: 160,
    },
    viewfinderRect: {
      width: VIEWFINDER_WIDTH,
      height: VIEWFINDER_HEIGHT_RECT,
      borderWidth: 3,
      borderRadius: 12,
    },
    viewfinderOval: {
      width: VIEWFINDER_SIZE_OVAL,
      height: VIEWFINDER_SIZE_OVAL,
      borderWidth: 3,
      borderRadius: VIEWFINDER_SIZE_OVAL / 2,
    },
    prompt: {
      textAlign: 'center',
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '500',
    },
    cancelRow: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 50,
      bottom: undefined,
    },
    cancelButton: {
      width: 60,
      height: 44,
      justifyContent: 'center',
    },
    cancelText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '500',
    },
    titleText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '600',
    },
    shutterRow: {
      position: 'absolute',
      bottom: 40,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutter: {
      width: SHUTTER_SIZE,
      height: SHUTTER_SIZE,
      borderRadius: SHUTTER_SIZE / 2,
      borderWidth: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterInner: {
      width: SHUTTER_SIZE - 16,
      height: SHUTTER_SIZE - 16,
      borderRadius: (SHUTTER_SIZE - 16) / 2,
      backgroundColor: '#FFFFFF',
    },
    errorBlock: {
      width: '90%',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: 16,
      borderRadius: 12,
      gap: 12,
    },
    errorText: {
      color: '#FFFFFF',
      textAlign: 'center',
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
