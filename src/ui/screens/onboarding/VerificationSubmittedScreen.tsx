import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../theme/ThemeContext';
import { Button } from '../../primitives/Button';
import { Icon } from '../../assets';
import { FORM_SPACING } from './formSpacing';

// Mirror of iOS VerificationSubmittedView. Person-check icon + "Verification
// Submitted" + Done button. Resolves the outer Promise<OnboardingResult> when
// the user taps Done.

export interface VerificationSubmittedScreenProps {
  onDone: () => void;
}

export function VerificationSubmittedScreen({ onDone }: VerificationSubmittedScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.spacer} />
      <Icon name="person-check" size={96} />
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
        Verification Submitted
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
        Congratulations! You've submitted your identity verification check. You're ready to proceed.
      </Text>
      <View style={styles.spacer} />
      <View style={styles.footer}>
        <Button text="Done" onPress={onDone} />
      </View>
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      gap: 10,
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
