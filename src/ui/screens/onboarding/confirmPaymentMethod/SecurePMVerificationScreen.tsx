import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { showToast } from '../../../primitives/toastCenter';
import type { OnboardingState } from '../onboardingReducer';
import { FORM_SPACING } from '../formSpacing';

// 3DS challenge polling screen. We don't host the bank's challenge UI ourselves
// (3DS challenge sheets are displayed by the bank's app or in-browser) — this
// screen just polls `threeDS.get(id)` every 2s while the user completes the
// challenge wherever the bank put it. Resolves to the parent's success
// handler when the verification terminates with status='succeeded'.

export interface SecurePMVerificationScreenProps {
  state: OnboardingState;
  /** Poll threeDS.get until terminal. Resolves on succeeded; throws otherwise.
   *  The screen passes an AbortSignal so the poll ends on unmount. */
  onPoll: (signal: AbortSignal) => Promise<void>;
  /** Re-request the bank's challenge (sends a new SMS / push). */
  onResend: () => Promise<void>;
  /** Called once polling resolves successfully — the parent advances. */
  onSuccess: () => void;
  /** Called when polling terminates with failure. The parent typically pops
   *  back to AddPaymentMethod so the user can try a different card. */
  onFailure: (message: string) => void;
}

export function SecurePMVerificationScreen({
  state,
  onPoll,
  onResend,
  onSuccess,
  onFailure,
}: SecurePMVerificationScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [resending, setResending] = useState(false);

  // Latest-callback refs so the poll effect doesn't re-fire on parent re-renders.
  const onSuccessRef = useRef(onSuccess);
  const onFailureRef = useRef(onFailure);
  const onPollRef = useRef(onPoll);
  onSuccessRef.current = onSuccess;
  onFailureRef.current = onFailure;
  onPollRef.current = onPoll;

  // Poll re-fires whenever the 3DS id rotates (e.g. after Resend returns a
  // new ThreeDSIntent). On unmount or id change the previous controller is
  // aborted, terminating the in-flight poll.
  useEffect(() => {
    if (!state.threeDsVerificationId) {
      // Surface the lost-session as a failure rather than rendering a blank
      // spinner forever — the parent will toast + route back to AddPM.
      onFailureRef.current('3DS session lost. Please try again.');
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        await onPollRef.current(controller.signal);
        if (controller.signal.aborted) return;
        onSuccessRef.current();
      } catch (err) {
        if (controller.signal.aborted) return;
        const code = (err as { code?: string }).code;
        if (code === 'USER_CANCELED') return; // signal abort from our own controller
        const message = err instanceof Error ? err.message : 'Verification failed.';
        onFailureRef.current(message);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [state.threeDsVerificationId]);

  async function handleResend() {
    setResending(true);
    try {
      await onResend();
      showToast('A new verification request was sent.', { variant: 'info' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not resend verification.';
      showToast(message);
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={theme.colors.textSecondary} />
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
          Complete verification
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
          Your bank will send a verification request — open the bank app or check your messages, then come back here. We'll continue as soon as it's confirmed.
        </Text>
      </View>
      <View style={styles.footer}>
        <Button
          text="Resend verification"
          variant="secondary"
          enabled={!resending}
          isLoading={resending}
          onPress={handleResend}
        />
      </View>
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: FORM_SPACING.contentHorizontal,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: FORM_SPACING.sectionBottom,
    },
    title: {
      marginTop: FORM_SPACING.headingTop,
      textAlign: 'center',
    },
    body: {
      textAlign: 'center',
    },
    footer: {
      paddingVertical: FORM_SPACING.footerVertical,
    },
  });
}
