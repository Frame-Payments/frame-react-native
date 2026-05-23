import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';

// First screen of the onboarding flow. Shield glyph + "Verify Your Identity"
// + descriptive copy + Continue button. Button is disabled until the
// account-prefetch (Phase 8g) reports loaded.

export interface VerificationWelcomeScreenProps {
  accountLoaded: boolean;
  onContinue: () => void;
}

export function VerificationWelcomeScreen({
  accountLoaded,
  onContinue,
}: VerificationWelcomeScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: theme.colors.primaryButton,
              borderRadius: 999,
            },
          ]}
        >
          <Text
            style={[
              styles.iconGlyph,
              { color: theme.colors.primaryButtonText },
            ]}
          >
            🛡
          </Text>
        </View>
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.title.size,
              fontWeight: theme.fontWeights.title,
              lineHeight: theme.fontLineHeights.title,
            },
          ]}
        >
          Verify Your Identity
        </Text>
        <Text
          style={[
            styles.body,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.fonts.body.size,
              lineHeight: theme.fontLineHeights.body,
            },
          ]}
        >
          We need to confirm a few details to comply with regulations and protect your account. This usually takes just a couple of minutes.
        </Text>
      </View>
      <View style={styles.footer}>
        {!accountLoaded ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.textSecondary} />
            <Text
              style={[
                styles.loadingLabel,
                {
                  color: theme.colors.textSecondary,
                  fontSize: theme.fonts.bodySmall.size,
                },
              ]}
            >
              Loading your account…
            </Text>
          </View>
        ) : null}
        <Button text="Continue" enabled={accountLoaded} onPress={onContinue} />
      </View>
    </View>
  );
}

const ICON_SIZE = 96;

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'space-between',
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
    },
    iconWrap: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGlyph: {
      fontSize: 48,
    },
    title: {
      textAlign: 'center',
    },
    body: {
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    footer: {
      paddingVertical: 24,
      gap: 12,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    loadingLabel: {},
  });
}
