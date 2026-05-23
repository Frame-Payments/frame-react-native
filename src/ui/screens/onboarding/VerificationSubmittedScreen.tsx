import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../theme/ThemeContext';
import { Button } from '../../primitives/Button';

// Terminal screen of the onboarding flow. Person-check icon + "Verification
// Submitted" title + Done button. Resolves the outer Promise<OnboardingResult>
// when the user taps Done.

export interface VerificationSubmittedScreenProps {
  onDone: () => void;
}

export function VerificationSubmittedScreen({ onDone }: VerificationSubmittedScreenProps) {
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
          <Text style={[styles.iconGlyph, { color: theme.colors.primaryButtonText }]}>✓</Text>
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
          Verification submitted
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
          Congratulations! We've received your information. You'll hear back once your account has been reviewed.
        </Text>
      </View>
      <View style={styles.footer}>
        <Button text="Done" onPress={onDone} />
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
      fontSize: 56,
      fontWeight: '700',
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
    },
  });
}
