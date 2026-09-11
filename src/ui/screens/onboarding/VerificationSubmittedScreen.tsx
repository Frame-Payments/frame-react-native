import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../theme/ThemeContext';
import { Button } from '../../primitives/Button';
import { Icon, type IconName } from '../../assets';
import { FORM_SPACING } from './formSpacing';
import type { OnboardingOutcome } from '../../../types';


export interface VerificationSubmittedScreenProps {
  outcome: OnboardingOutcome | null;
  isResolving: boolean;
  onResolve: () => void;
  onDone: () => void;
}

export function VerificationSubmittedScreen({
  outcome,
  isResolving,
  onResolve,
  onDone,
}: VerificationSubmittedScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (outcome === null) onResolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showResolving = isResolving || outcome === null;

  return (
    <View style={styles.container}>
      <View style={styles.spacer} />
      {showResolving ? (
        <>
          <ActivityIndicator color={theme.colors.textSecondary} />
          <Text
            style={[
              styles.resolvingText,
              { color: theme.colors.textSecondary, fontSize: theme.fonts.bodySmall.size },
            ]}
          >
            Checking your verification…
          </Text>
        </>
      ) : (
        <>
          <Icon name={iconFor(outcome)} size={96} />
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
            {titleFor(outcome)}
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
            {bodyFor(outcome)}
          </Text>
        </>
      )}
      <View style={styles.spacer} />
      <View style={styles.footer}>
        <Button text={buttonTextFor(outcome)} enabled={!showResolving} onPress={onDone} />
      </View>
    </View>
  );
}

function iconFor(outcome: OnboardingOutcome | null): IconName {
  return outcome?.status === 'approved' ? 'person-check' : 'person-alert';
}

function titleFor(outcome: OnboardingOutcome | null): string {
  switch (outcome?.status) {
    case 'approved':
      return 'Verification Submitted';
    case 'declined':
      return 'Verification Unsuccessful';
    case 'action_required':
      return 'More Information Needed';
    case 'pending_review':
    default:
      return 'Verification In Review';
  }
}

function bodyFor(outcome: OnboardingOutcome | null): string {
  switch (outcome?.status) {
    case 'approved':
      return "Congratulations! You've submitted your identity verification check. You're ready to proceed.";
    case 'declined':
      return (
        outcome.message ??
        "We weren't able to verify your identity. Please contact support if you think this is a mistake."
      );
    case 'action_required':
      return (
        outcome.message ??
        "We need a bit more information from you before we can finish verifying your identity. Please contact support."
      );
    case 'pending_review':
    default:
      return "We're reviewing your information. This usually doesn't take long, and we'll be in touch once it's complete.";
  }
}

function buttonTextFor(outcome: OnboardingOutcome | null): string {
  return outcome?.status === 'approved' ? 'Done' : 'Close';
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
    resolvingText: {
      textAlign: 'center',
      marginTop: 4,
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
