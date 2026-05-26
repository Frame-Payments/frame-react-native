import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { client } from '../../../../client';
import { showToast } from '../../../primitives/toastCenter';
import { FORM_SPACING } from '../formSpacing';

// Stub geolocation screen. Real VPN-detect + permission UX is deferred (per
// the Phase 8 plan). On mount we fire geoCompliance.getAccountStatus once and
// advance silently on success. On failure we still advance — but surface a
// toast so the user knows the check didn't run.

export interface GeolocationScreenProps {
  accountId: string | null;
  onAdvance: () => void;
}

export function GeolocationScreen({ accountId, onAdvance }: GeolocationScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [done, setDone] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let cancelled = false;
    let rafId: number | null = null;
    (async () => {
      try {
        if (accountId) {
          await client.sdk.geoCompliance.getAccountStatus(accountId);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Could not verify your location.';
        showToast(message);
      } finally {
        if (!cancelled) {
          setDone(true);
          // Advance on the next frame so the user sees the "Verifying location"
          // beat — gives the flow visual continuity. Cancelled on unmount.
          rafId = requestAnimationFrame(() => {
            if (!cancelled) onAdvance();
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [accountId, onAdvance]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.textSecondary} size="large" />
      <Text
        style={[
          styles.title,
          {
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.body.size,
            fontWeight: theme.fontWeights.label,
            lineHeight: theme.fontLineHeights.body,
          },
        ]}
      >
        {done ? 'Continuing…' : 'Verifying your location…'}
      </Text>
      <View style={styles.spacer} />
      {/* If the auto-advance hangs (e.g. an unhandled exception), surface a
          manual Continue so the user is never stuck. */}
      <Button text="Continue" enabled={done} onPress={onAdvance} />
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: FORM_SPACING.contentHorizontal,
      paddingVertical: FORM_SPACING.footerVertical,
      alignItems: 'center',
    },
    title: {
      marginTop: FORM_SPACING.sectionBottom,
      textAlign: 'center',
    },
    spacer: {
      flex: 1,
    },
  });
}
