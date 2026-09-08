import { useCallback, useEffect, useRef } from 'react';
import { BottomSheet } from '../../primitives/BottomSheet';
import { showToast } from '../../primitives/toastCenter';
import { toToastMessage } from '../../../api-errors';
import { beginOnboardingSession, endOnboardingSession } from '../../../auth';
import { useOnboardingViewModel } from './useOnboardingViewModel';
import { AddPaymentMethodScreen } from './confirmPaymentMethod/AddPaymentMethodScreen';
import { AddPayoutMethodScreen } from './confirmBankAccount/AddPayoutMethodScreen';
import { SelectPayoutMethodScreen } from './confirmBankAccount/SelectPayoutMethodScreen';

// Standalone counterparts to iOS's FrameAddPaymentMethodView /
// FrameAddPayoutMethodView / FrameSelectPayoutMethodView
// (`Sources/FrameOnboarding/Views/Payments/`). Each reuses the onboarding
// screen it wraps, driven by a view model constructed with NO required
// capabilities — matching iOS's
// `OnboardingContainerViewModel(accountId:requiredCapabilities: [])`.
//
// They are not part of a flow: there is no progress bar, no advance(), and the
// result is emitted the moment the method is added or elected.

export type StandaloneMethodMode = 'add_payment' | 'add_payout' | 'select_payout';

export interface StandaloneMethodRootProps {
  mode: StandaloneMethodMode;
  accountId: string;
  /**
   * Server-minted onboarding-session token (`onb_sess_...`). While the screen is
   * presented every request is scoped to it. Mirrors the `clientSecret:`
   * parameter all three iOS views take.
   */
  clientSecret?: string | null;
  /** Fires with the payment-method id once it is added or elected. */
  onComplete: (paymentMethodId: string) => void;
  onCancel: () => void;
}

const TITLES: Record<StandaloneMethodMode, string> = {
  add_payment: 'Add Payment Method',
  add_payout: 'Add Payout Method',
  select_payout: 'Payout Method',
};

export function StandaloneMethodRoot({
  mode,
  accountId,
  clientSecret,
  onComplete,
  onCancel,
}: StandaloneMethodRootProps) {
  // Same session boundary as OnboardingRoot: begin on mount, safe-clear by token
  // on unmount so a newer flow's session isn't wiped.
  useEffect(() => {
    if (!clientSecret) return;
    beginOnboardingSession(clientSecret);
    return () => {
      endOnboardingSession(clientSecret);
    };
  }, [clientSecret]);

  // Guards against reporting twice when the host dismisses on the callback and
  // the unmount path also fires. iOS uses the same `didFinish` latch.
  //
  // A ref, not state: state updates are async, so two calls in the same tick
  // would both observe `false` and both report. The ref flips synchronously.
  const didFinish = useRef(false);

  const vm = useOnboardingViewModel({
    accountId,
    capabilities: [],
    showIntroScreen: false,
    showCompletionScreen: false,
    onComplete: () => {},
    onCancel,
  });

  const finish = useCallback(
    (paymentMethodId: string) => {
      if (didFinish.current) return;
      didFinish.current = true;
      onComplete(paymentMethodId);
    },
    [onComplete],
  );

  const surfaceError = useCallback((err: unknown) => {
    if ((err as { code?: string }).code === 'USER_CANCELED') return;
    showToast(toToastMessage(err));
  }, []);

  function renderScreen() {
    switch (mode) {
      case 'add_payment':
        return (
          <AddPaymentMethodScreen
            state={vm.state}
            onChangeAddressField={vm.setAddressField}
            onApplyAddress={vm.applyAddress}
            onSubmitNewCard={async (card) => {
              const id = await vm.submitNewCard(card);
              finish(id);
              return id;
            }}
            onSubmitAddressOnly={async (paymentMethodId) => {
              await vm.updateSavedPaymentMethodBilling(paymentMethodId);
              finish(paymentMethodId);
            }}
            onAddApplePay={async () => {
              const id = await vm.addApplePayToOwner();
              finish(id);
              return id;
            }}
          />
        );
      case 'add_payout':
        return (
          <AddPayoutMethodScreen
            state={vm.state}
            onChangeAchField={vm.setAchField}
            onChangeAchAccountType={vm.setAchAccountType}
            onChangeManualMode={(value) => vm.dispatch({ type: 'SET_ACH_MANUAL_MODE', value })}
            onChangeAddressField={vm.setAddressField}
            onApplyAddress={vm.applyAddress}
            onOpenPlaidLink={async () => {
              const id = await vm.openPlaidLink();
              // Adding a bank only attaches it; electing is what makes it the
              // account's payout destination.
              await vm.electSelectedPayoutMethod(id);
              finish(id);
              return id;
            }}
            onSubmitManualAch={async () => {
              const id = await vm.submitManualAch();
              vm.dispatch({ type: 'SET_ACH_MANUAL_MODE', value: false });
              await vm.electSelectedPayoutMethod(id);
              finish(id);
              return id;
            }}
          />
        );
      case 'select_payout':
        return (
          <SelectPayoutMethodScreen
            state={vm.state}
            onLoadMethods={vm.loadSavedPayoutMethods}
            onSelectMethod={(id) => vm.dispatch({ type: 'SELECT_PAYOUT_METHOD', id })}
            onContinue={() => {
              const selected = vm.state.selectedPayoutMethodId;
              if (selected === null) {
                showToast('Select a payout method to continue.');
                return;
              }
              // iOS gates completion on the election succeeding
              // (`FrameSelectPayoutMethodView.swift:55-63`), so a failure keeps
              // the screen open with a toast rather than reporting success.
              void vm
                .electSelectedPayoutMethod(selected)
                .then(() => finish(selected))
                .catch(surfaceError);
            }}
          />
        );
    }
  }

  return (
    <BottomSheet title={TITLES[mode]} onClose={onCancel}>
      {renderScreen()}
    </BottomSheet>
  );
}
