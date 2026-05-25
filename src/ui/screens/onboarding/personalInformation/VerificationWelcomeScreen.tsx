import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { Icon } from '../../../assets';
import { FORM_SPACING } from '../formSpacing';

// Mirror of iOS OnboardingContainerView's `onboardingIntro` (shield-icon +
// "Verify Your Identity" + bodySmall body copy + Continue). Button is disabled
// until the account-prefetch reports loaded; iOS simply toggles `enabled` —
// no inline "loading" label.

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
      <View style={styles.spacer} />
      <Icon name="shield-icon" size={96} />
      <Text
        style={[
          styles.title,
          {
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.heading.size,
            fontWeight: theme.fontWeights.heading,
            lineHeight: theme.fontLineHeights.heading,
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
            fontSize: theme.fonts.bodySmall.size,
            lineHeight: theme.fontLineHeights.bodySmall,
          },
        ]}
      >
        We're required by law to verify your identity. This takes about 2 minutes and you'll need a Government ID and a selfie.
      </Text>
      <View style={styles.spacer} />
      <View style={styles.footer}>
        <Button text="Continue" enabled={accountLoaded} onPress={onContinue} />
      </View>
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      gap: 15,
    },
    spacer: {
      flex: 1,
    },
    title: {
      textAlign: 'center',
    },
    body: {
      textAlign: 'center',
      paddingHorizontal: FORM_SPACING.contentHorizontal,
    },
    footer: {
      alignSelf: 'stretch',
      paddingBottom: FORM_SPACING.sectionBottom,
      paddingHorizontal: FORM_SPACING.sectionBottom,
    },
  });
}
