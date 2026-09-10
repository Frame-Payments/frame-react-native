import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../../primitives/BottomSheet';
import { showToast } from '../../primitives/toastCenter';
import { toToastMessage } from '../../../api-errors';
import { useOnboardingViewModel } from './useOnboardingViewModel';
import { AddPaymentMethodScreen } from './confirmPaymentMethod/AddPaymentMethodScreen';
import { AddPayoutMethodScreen } from './confirmBankAccount/AddPayoutMethodScreen';
import { SelectPayoutMethodScreen } from './confirmBankAccount/SelectPayoutMethodScreen';

export type StandaloneMethodMode = 'add_payment' | 'add_payout' | 'select_payout';

export interface StandaloneMethodRootProps {
  mode: StandaloneMethodMode;
  accountId: string;
  clientSecret?: string | null;
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
  const didFinish = useRef(false);

  const [showAddPayout, setShowAddPayout] = useState(false);

  const vm = useOnboardingViewModel({
    accountId,
    capabilities: [],
    showIntroScreen: false,
    showCompletionScreen: false,
    onComplete: () => {},
    onCancel,
  });

  // Same session boundary as OnboardingRoot, via the view model's ownership
  // tracking rather than a token-gated clear — see OnboardingRoot.tsx's
  // longer comment for why a token-gated clear leaks a self-minted session.
  // This flow's capabilities: [] means it never self-mints (that only
  // happens on the personal-information path), but the unmount call is still
  // unconditional and idempotent, matching iOS's `.onDisappear` calling
  // `endOnboardingSessionIfOwned()` regardless of whether a session was ever
  // begun.
  useEffect(() => {
    if (clientSecret) vm.beginOnboardingSessionOwned(clientSecret);
    return () => {
      vm.endOnboardingSessionIfOwned();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSecret]);

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

  function renderAddPayout() {
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
  }

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
        return renderAddPayout();
      case 'select_payout':
        if (showAddPayout) return renderAddPayout();
        return (
          <SelectPayoutMethodScreen
            state={vm.state}
            onLoadMethods={vm.loadSavedPayoutMethods}
            onSelectMethod={(id) => vm.dispatch({ type: 'SELECT_PAYOUT_METHOD', id })}
            onContinue={() => {
              const selected = vm.state.selectedPayoutMethodId;
              if (selected === null) {
                setShowAddPayout(true);
                return;
              }
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
