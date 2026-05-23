import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { OtpInputField } from '../../../primitives/OtpInputField';
import {
  authenticateProve,
  cancelProveOtp,
  isProveAvailable,
  subscribeProveOtpNeeded,
  submitProveOtp,
} from '../../../../prove';
import type { OnboardingState, VerifyPhoneUi } from '../onboardingReducer';

// Three UI branches off `state.verifyPhoneUi`:
//
//   - 'loading_prove'  — Prove SDK is running silently; show a spinner.
//                         If the SDK falls back, the FrameProveOtpNeeded event
//                         flips ui to 'otp_for_prove' so the OTP entry shows.
//   - 'otp_for_prove'  — 6-digit OTP entry; Submit calls submitProveOtp(code);
//                         the underlying authenticateProve() promise resolves
//                         success/failure afterwards.
//   - 'otp_frame_api'  — 6-digit OTP entry; Submit calls confirmFrameOtp(),
//                         which hits PhoneVerificationsAPI.confirm.

export interface VerifyPhoneScreenProps {
  state: OnboardingState;
  onChangeOtp: (value: string) => void;
  onConfirmFrameOtp: () => Promise<void>;
  /** Called after Prove (success or fail) so the parent can advance / fail
   *  appropriately. JS owns the post-Prove backend confirm call. */
  onProveResult: (result: { status: 'success' | 'failed'; message?: string }) => void;
  /** Flips ui from loading_prove → otp_for_prove when Prove asks for OTP. */
  onSetUi: (ui: VerifyPhoneUi) => void;
  onResend: () => void;
}

export function VerifyPhoneScreen({
  state,
  onChangeOtp,
  onConfirmFrameOtp,
  onProveResult,
  onSetUi,
  onResend,
}: VerifyPhoneScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const ui = state.verifyPhoneUi;
  const [submittingProve, setSubmittingProve] = useState(false);

  // Latest-callback refs so the kick-off effect deps stay minimal — without
  // these, a parent that re-creates onProveResult / onSetUi every render
  // would re-fire authenticateProve and trip the bridge's PROVE_BUSY guard.
  const onProveResultRef = useRef(onProveResult);
  const onSetUiRef = useRef(onSetUi);
  onProveResultRef.current = onProveResult;
  onSetUiRef.current = onSetUi;

  // Kick off Prove the first time we land on loading_prove with a valid token.
  useEffect(() => {
    if (ui !== 'loading_prove') return;
    if (!state.pendingProveAuthToken) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    if (isProveAvailable()) {
      unsubscribe = subscribeProveOtpNeeded(() => {
        if (cancelled) return;
        onSetUiRef.current('otp_for_prove');
      });
      (async () => {
        const result = await authenticateProve(state.pendingProveAuthToken!);
        if (cancelled) return;
        onProveResultRef.current(result);
      })();
    } else {
      // Prove not linked → fall back to Frame OTP path immediately.
      onSetUiRef.current('otp_frame_api');
    }
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [ui, state.pendingProveAuthToken]);

  if (ui === 'loading_prove') {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator color={theme.colors.textSecondary} size="large" />
        <Text
          style={[
            styles.loadingTitle,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.body.size,
              fontWeight: theme.fontWeights.label,
              lineHeight: theme.fontLineHeights.body,
            },
          ]}
        >
          Verifying your device…
        </Text>
        <Text
          style={[
            styles.loadingBody,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.fonts.bodySmall.size,
              lineHeight: theme.fontLineHeights.bodySmall,
            },
          ]}
        >
          This should only take a few seconds. We'll fall back to a text-message code if needed.
        </Text>
      </View>
    );
  }

  // Both OTP branches share the same layout — only the Submit handler differs.
  const submitting = state.isPerformingAction || submittingProve;
  const onSubmit = async () => {
    if (ui === 'otp_for_prove') {
      setSubmittingProve(true);
      try {
        await submitProveOtp(state.otpCode);
        // The authenticateProve() promise resolves shortly via onProveResult.
      } finally {
        setSubmittingProve(false);
      }
      return;
    }
    await onConfirmFrameOtp();
  };

  const onCancelOtp = async () => {
    if (ui === 'otp_for_prove') {
      await cancelProveOtp();
    }
    onResend();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text
          style={[
            styles.heading,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.heading.size,
              fontWeight: theme.fontWeights.heading,
              lineHeight: theme.fontLineHeights.heading,
            },
          ]}
        >
          Enter Verification Code
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
          We've sent a verification code to your phone. Enter it below.
        </Text>
        <OtpInputField
          value={state.otpCode}
          onChange={onChangeOtp}
          disabled={submitting}
          autoFocusOnMount
        />
        {state.fieldErrors.otpCode ? (
          <Text
            style={[
              styles.error,
              {
                color: theme.colors.error,
                fontSize: theme.fonts.bodySmall.size,
              },
            ]}
          >
            {state.fieldErrors.otpCode}
          </Text>
        ) : null}
        <Button
          text="Resend code"
          variant="secondary"
          enabled={!submitting}
          onPress={onCancelOtp}
          style={styles.resend}
        />
      </View>
      <View style={styles.footer}>
        <Button
          text="Continue"
          enabled={!submitting && state.otpCode.length === 6}
          isLoading={submitting}
          onPress={onSubmit}
        />
      </View>
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 24,
    },
    centeredContainer: {
      flex: 1,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    loadingTitle: {
      marginTop: 8,
      textAlign: 'center',
    },
    loadingBody: {
      textAlign: 'center',
    },
    content: {
      flex: 1,
      paddingTop: 16,
      gap: 12,
    },
    heading: {},
    body: {
      marginBottom: 8,
    },
    error: {
      marginTop: 4,
    },
    resend: {
      marginTop: 16,
    },
    footer: {
      paddingVertical: 24,
    },
  });
}
