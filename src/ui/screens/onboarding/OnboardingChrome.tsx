import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '../../primitives/BottomSheet';
import { ProgressBar } from '../../primitives/ProgressBar';
import { PageHeader } from '../../primitives/PageHeader';
import type { OnboardingState, OnboardingStep } from './onboardingReducer';

// Shared chrome (close-button bottom sheet + progress bar + optional page
// header with back button) for every onboarding screen except the terminal
// ones. The OnboardingRoot in 8h wraps each rendered screen in this chrome
// and passes `currentStepIndex` / `progressTotal`.

export interface OnboardingChromeProps {
  state: OnboardingState;
  /** Optional title rendered between back button and right spacer. */
  title?: string;
  /** Tap-back handler. When null/undefined, the back button is hidden. */
  onBack?: () => void;
  /** Close-modal handler (the X on the BottomSheet). */
  onClose: () => void;
  children: ReactNode;
}

// Steps shown in the progress bar. We hide the welcome screen (it's not
// progress, it's an intro) and the terminal submitted screen.
const PROGRESS_STEPS: ReadonlyArray<OnboardingStep> = [
  'personal_information',
  'confirm_payment_method',
  'confirm_bank_account',
  'upload_documents',
];

export function OnboardingChrome({ state, title, onBack, onClose, children }: OnboardingChromeProps) {
  const { progressTotal, progressCurrent, showProgress } = useMemo(() => {
    const activeSteps = state.flow.filter((s) => PROGRESS_STEPS.includes(s));
    const currentIndex = activeSteps.indexOf(state.currentStep);
    // Hide the progress bar on intro / submitted to keep the visual focus on
    // the message of those terminal-ish screens.
    const visible =
      state.currentStep !== 'verification_welcome' &&
      state.currentStep !== 'verification_submitted' &&
      activeSteps.length > 0;
    return {
      progressTotal: activeSteps.length,
      progressCurrent: currentIndex < 0 ? 0 : currentIndex,
      showProgress: visible,
    };
  }, [state.flow, state.currentStep]);

  return (
    <BottomSheet title="" onClose={onClose}>
      {showProgress ? <ProgressBar total={progressTotal} current={progressCurrent} /> : null}
      {title ? <PageHeader title={title} onBack={onBack} /> : null}
      <View style={styles.body}>{children}</View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
});
