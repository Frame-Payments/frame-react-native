import { useCallback } from 'react';
import type { OnboardingCapability, OnboardingResult } from '../../../types';
import { showToast } from '../../primitives/toastCenter';
import { toToastMessage } from '../../../api-errors';
import { useOnboardingViewModel } from './useOnboardingViewModel';
import { OnboardingChrome } from './OnboardingChrome';
import { VerificationWelcomeScreen } from './personalInformation/VerificationWelcomeScreen';
import { PhoneAuthScreen } from './personalInformation/PhoneAuthScreen';
import { VerifyPhoneScreen } from './personalInformation/VerifyPhoneScreen';
import { CustomerInformationScreen } from './personalInformation/CustomerInformationScreen';
import { GeolocationScreen } from './personalInformation/GeolocationScreen';
import { SelectPaymentMethodScreen } from './confirmPaymentMethod/SelectPaymentMethodScreen';
import { AddPaymentMethodScreen } from './confirmPaymentMethod/AddPaymentMethodScreen';
import { SecurePMVerificationScreen } from './confirmPaymentMethod/SecurePMVerificationScreen';
import { SelectPayoutMethodScreen } from './confirmBankAccount/SelectPayoutMethodScreen';
import { AddPayoutMethodScreen } from './confirmBankAccount/AddPayoutMethodScreen';
import { UploadDocumentsListScreen } from './uploadDocuments/UploadDocumentsListScreen';
import { CaptureScreen } from './uploadDocuments/CaptureScreen';
import { ReviewScreen } from './uploadDocuments/ReviewScreen';
import { VerificationSubmittedScreen } from './VerificationSubmittedScreen';
import { areDocsComplete } from './onboardingSelectors';

export interface OnboardingRootProps {
  accountId: string | null;
  capabilities: ReadonlyArray<OnboardingCapability>;
  /** Called when the user reaches VerificationSubmitted and taps Done. */
  onComplete: (result: OnboardingResult) => void;
  /** Called when the user dismisses the onboarding modal early. */
  onCancel: () => void;
  /** Reserved for unrecoverable host-level failures. Errors that surface to
   *  the user (network, validation) are toasted internally — this callback
   *  fires only when the whole onboarding session is unsalvageable. */
  onFail: (error: unknown) => void;
}

// Top-level orchestrator. Owns the substep → screen routing, wraps every
// screen in OnboardingChrome (close button + progress bar), and threads the
// view model's actions through to the leaf screens. Mounted by Frame.present-
// Onboarding via the JS presenter.
export function OnboardingRoot({
  accountId,
  capabilities,
  onComplete,
  onCancel,
  onFail,
}: OnboardingRootProps) {
  const vm = useOnboardingViewModel({ accountId, capabilities, onComplete, onCancel });

  // ─── Routing helpers ───

  // Continue handler for SelectPaymentMethod. Mirrors iOS
  // SelectPaymentMethodView.selectPaymentView's ContinueButton action:
  //   • If address_verification is requested AND the selected card has no
  //     billing line1, route into AddPaymentMethod in address-only mode.
  //   • Otherwise advance.
  // The iOS `card_verification → start 3DS` branch is commented out in iOS
  // (see SelectPaymentMethodView.swift:85-91), so RN must not run 3DS here
  // either — that would diverge from iOS behavior.
  const onSelectPaymentMethodContinue = useCallback(() => {
    const selectedId = vm.state.selectedPaymentMethodId;
    const requiresAddressVerification = capabilities.includes('address_verification');
    if (selectedId === null) {
      vm.goTo('confirm_payment_method', 'add');
      return;
    }
    if (requiresAddressVerification) {
      const pm = vm.state.savedPaymentMethods.find((m) => m.id === selectedId);
      const billing = (pm as { billing?: { line_1?: string } } | undefined)?.billing;
      if (!billing || !billing.line_1) {
        vm.dispatch({ type: 'SET_ADDRESS_VERIFICATION_ONLY', value: true });
        vm.goTo('confirm_payment_method', 'add');
        return;
      }
    }
    vm.advance();
  }, [vm, capabilities]);

  // Mirrors iOS AddPaymentMethodView's ContinueButton → addNewPaymentMethod()
  // → self.dismiss(): create the card, append to saved methods, then pop back
  // to SelectPaymentMethod so the user can review and tap Continue again.
  // iOS does NOT advance the onboarding step or run 3DS here.
  const onAddPaymentMethodSubmit = useCallback(
    async (card: { pan: string; expirationMonth: string; expirationYear: string; cvc: string }) => {
      const pmId = await vm.submitNewCard(card);
      vm.goTo('confirm_payment_method', 'select');
      return pmId;
    },
    [vm],
  );

  // Mirrors iOS AddPaymentMethodView in `onlyAddressVerification` mode:
  // updatePaymentMethod() then self.dismiss(). Returns to select; no 3DS.
  const onAddPaymentMethodAddressOnly = useCallback(
    async (paymentMethodId: string) => {
      await vm.updateSavedPaymentMethodBilling(paymentMethodId);
      vm.dispatch({ type: 'SET_ADDRESS_VERIFICATION_ONLY', value: false });
      vm.goTo('confirm_payment_method', 'select');
    },
    [vm],
  );

  const onAddApplePayInOnboarding = useCallback(async () => {
    const pmId = await vm.addApplePayToOwner();
    // Mirrors iOS AddPaymentMethodView.walletButton's success callback:
    // appendNewlyAddedPaymentMethod(pm) + self.dismiss() — return to the
    // SelectPaymentMethod screen so the user reviews and taps Continue,
    // matching the manual-card flow above.
    vm.goTo('confirm_payment_method', 'select');
    return pmId;
  }, [vm]);

  const onSecurePMSuccess = useCallback(() => {
    vm.dispatch({ type: 'SET_THREE_DS_VERIFICATION_ID', id: null });
    vm.advance();
  }, [vm]);

  const onSecurePMFailure = useCallback(
    (message: string) => {
      showToast(message);
      vm.dispatch({ type: 'SET_THREE_DS_VERIFICATION_ID', id: null });
      vm.goTo('confirm_payment_method', 'select');
    },
    [vm],
  );

  const onSelectPayoutContinue = useCallback(() => {
    if (vm.state.selectedPayoutMethodId === null) {
      vm.goTo('confirm_bank_account', 'add');
      return;
    }
    vm.advance();
  }, [vm]);

  const onAddPayoutPlaid = useCallback(async () => {
    const pmId = await vm.openPlaidLink();
    vm.advance();
    return pmId;
  }, [vm]);

  const onAddPayoutManual = useCallback(async () => {
    const pmId = await vm.submitManualAch();
    vm.dispatch({ type: 'SET_ACH_MANUAL_MODE', value: false });
    vm.advance();
    return pmId;
  }, [vm]);

  const surfaceError = useCallback(
    (err: unknown) => {
      const code = (err as { code?: string }).code;
      if (code === 'USER_CANCELED') return;
      // Use toToastMessage so we surface the server's `error_details.message`
      // from FrameAPIError.raw instead of the top-level generic message
      // (framepayments returns a useless "An error occured" / "An error
      // occurred" envelope; the details below it carry the real reason).
      showToast(toToastMessage(err));
    },
    [],
  );

  // Upload documents routing — substeps are list / capture_* / review_*.
  const onCaptureDone = useCallback(
    (side: 'front' | 'back' | 'selfie', uri: string, type: string, name: string) => {
      vm.dispatch({ type: 'SET_DOC_PHOTO', side, photo: { uri, type, name } });
      vm.goTo('upload_documents', `review_${side}` as const);
    },
    [vm],
  );

  const onReviewUse = useCallback(() => {
    // Stay on the list once any one side is confirmed — user picks the next side.
    vm.goTo('upload_documents', 'list');
  }, [vm]);

  const onReviewRetake = useCallback(
    (side: 'front' | 'back' | 'selfie') => {
      vm.dispatch({ type: 'SET_DOC_PHOTO', side, photo: null });
      vm.goTo('upload_documents', `capture_${side}` as const);
    },
    [vm],
  );

  const onSubmitDocs = useCallback(async () => {
    try {
      await vm.ensureCustomerIdentity();
      await vm.uploadCapturedDocuments();
      vm.advance();
    } catch (err) {
      surfaceError(err);
    }
  }, [vm, surfaceError]);

  // ─── Screen routing ───
  //
  // Plain function (not useMemo) — the previous attempt at memoization
  // depended on `vm` which is a fresh object each render, so the memo
  // recomputed every time anyway. The routing logic is cheap; just compute
  // it inline.
  function renderScreen() {
    const { currentStep, subStep } = vm.state;

    if (currentStep === 'verification_welcome') {
      return (
        <VerificationWelcomeScreen
          accountLoaded={vm.state.accountLoaded}
          onContinue={vm.advance}
        />
      );
    }

    if (currentStep === 'personal_information') {
      switch (subStep) {
        case 'phone_auth':
          return (
            <PhoneAuthScreen
              capabilities={capabilities}
              state={vm.state}
              onChangePhoneCountry={vm.setPhoneCountry}
              onChangePhoneNumber={vm.setPhoneNumber}
              onChangeDob={vm.setDob}
              onMount={() => void vm.generateTermsOfServiceToken()}
              onSubmit={() => vm.sendOtp().catch(surfaceError)}
            />
          );
        case 'verify_phone':
          return (
            <VerifyPhoneScreen
              state={vm.state}
              onChangeOtp={vm.setOtpCode}
              onConfirmFrameOtp={() => vm.confirmFrameOtp().catch(surfaceError)}
              onProveResult={(result) => {
                if (result.status === 'success') {
                  // Re-fetch account so Prove's server-side identity prefill
                  // lands in the customer-information screen. Mirrors iOS
                  // OnboardingContainerViewModel.sendOTPVerification.
                  void vm
                    .refreshAccountAfterPhoneVerify()
                    .catch(() => {})
                    .finally(() => {
                      vm.goTo('personal_information', 'customer_information');
                    });
                  return;
                }
                // Prove failed → re-issue a Frame phone verification so the
                // OTP confirm endpoint accepts the new id, then surface the
                // failure message. Without re-issuing, confirmFrameOtp would
                // try to confirm the Prove-issued id.
                if (result.message) showToast(result.message);
                void vm.sendOtp({ forceFrameOtp: true }).catch(surfaceError);
              }}
              onSetUi={vm.setVerifyPhoneUi}
              onResend={() => void vm.sendOtp().catch(surfaceError)}
            />
          );
        case 'customer_information':
          return (
            <CustomerInformationScreen
              capabilities={capabilities}
              state={vm.state}
              onChangeFirstName={vm.setCustomerFirstName}
              onChangeLastName={vm.setCustomerLastName}
              onChangeEmail={vm.setCustomerEmail}
              onChangeDob={vm.setDob}
              onChangeSsn={vm.setSsnLast4}
              onChangeAddressField={vm.setAddressField}
              onSubmit={() => vm.submitCustomerInformation().catch(surfaceError)}
            />
          );
        case 'geolocation':
          return <GeolocationScreen accountId={vm.state.accountId} onAdvance={vm.advance} />;
        default:
          return null;
      }
    }

    if (currentStep === 'confirm_payment_method') {
      switch (subStep) {
        case 'select':
          return (
            <SelectPaymentMethodScreen
              state={vm.state}
              onLoadMethods={vm.loadSavedPaymentMethods}
              onSelectMethod={(id) => vm.dispatch({ type: 'SELECT_PAYMENT_METHOD', id })}
              onContinue={onSelectPaymentMethodContinue}
            />
          );
        case 'add':
          return (
            <AddPaymentMethodScreen
              state={vm.state}
              onChangeAddressField={vm.setAddressField}
              onSubmitNewCard={onAddPaymentMethodSubmit}
              onSubmitAddressOnly={onAddPaymentMethodAddressOnly}
              onAddApplePay={onAddApplePayInOnboarding}
            />
          );
        case 'secure_3ds':
          return (
            <SecurePMVerificationScreen
              state={vm.state}
              onPoll={(signal) => vm.poll3DS({ signal })}
              onResend={() => vm.resend3DS().catch(surfaceError)}
              onSuccess={onSecurePMSuccess}
              onFailure={onSecurePMFailure}
            />
          );
        default:
          return null;
      }
    }

    if (currentStep === 'confirm_bank_account') {
      switch (subStep) {
        case 'select':
          return (
            <SelectPayoutMethodScreen
              state={vm.state}
              onLoadMethods={vm.loadSavedPayoutMethods}
              onSelectMethod={(id) => vm.dispatch({ type: 'SELECT_PAYOUT_METHOD', id })}
              onContinue={onSelectPayoutContinue}
            />
          );
        case 'add':
          return (
            <AddPayoutMethodScreen
              state={vm.state}
              onChangeAchField={vm.setAchField}
              onChangeAchAccountType={vm.setAchAccountType}
              onChangeManualMode={vm.setAchManualMode}
              onChangeAddressField={vm.setAddressField}
              onOpenPlaidLink={onAddPayoutPlaid}
              onSubmitManualAch={onAddPayoutManual}
            />
          );
        default:
          return null;
      }
    }

    if (currentStep === 'upload_documents') {
      const idType = vm.state.docs.idType;
      const requiresBack = idType !== null && idType !== 'passport';
      switch (subStep) {
        case 'list':
          return (
            <UploadDocumentsListScreen
              state={vm.state}
              onChangeIdType={(value) => vm.dispatch({ type: 'SET_DOC_ID_TYPE', value })}
              onCaptureFront={() => vm.goTo('upload_documents', 'capture_front')}
              onCaptureBack={() => vm.goTo('upload_documents', 'capture_back')}
              onCaptureSelfie={() => vm.goTo('upload_documents', 'capture_selfie')}
              onSubmit={onSubmitDocs}
              isComplete={areDocsComplete(vm.state)}
            />
          );
        case 'capture_front':
        case 'capture_back':
        case 'capture_selfie': {
          const side = subStep === 'capture_front'
            ? 'front'
            : subStep === 'capture_back'
              ? 'back'
              : 'selfie';
          return (
            <CaptureScreen
              title={
                side === 'front'
                  ? 'Front of ID'
                  : side === 'back'
                    ? 'Back of ID'
                    : 'Selfie'
              }
              prompt={
                side === 'selfie'
                  ? 'Center your face inside the oval, then tap the shutter.'
                  : 'Align your ID inside the frame, then tap the shutter.'
              }
              viewfinder={side === 'selfie' ? 'oval' : 'rectangle'}
              cameraPosition={side === 'selfie' ? 'front' : 'back'}
              onCaptured={(photo) => onCaptureDone(side, photo.uri, photo.type, photo.name)}
              onCancel={() => vm.goTo('upload_documents', 'list')}
            />
          );
        }
        case 'review_front':
        case 'review_back':
        case 'review_selfie': {
          const side = subStep === 'review_front'
            ? 'front'
            : subStep === 'review_back'
              ? 'back'
              : 'selfie';
          const photo = vm.state.docs[side];
          if (!photo) {
            // Should never happen — defensive route back to capture.
            vm.goTo('upload_documents', `capture_${side}` as const);
            return null;
          }
          return (
            <ReviewScreen
              title={`Review ${side === 'selfie' ? 'selfie' : `${side} of ID`}`}
              prompt="Make sure the photo is clear and readable."
              photo={photo}
              onUse={() => onReviewUse()}
              onRetake={() => onReviewRetake(side)}
              onCancel={() => vm.goTo('upload_documents', 'list')}
            />
          );
        }
        default:
          // Suppress unused-var on requiresBack — keeps the visual reminder
          // that passport doesn't need a back capture.
          void requiresBack;
          return null;
      }
    }

    if (currentStep === 'verification_submitted') {
      return (
        <VerificationSubmittedScreen
          onDone={() => vm.complete()}
        />
      );
    }

    return null;
  }
  const screenContent = renderScreen();

  // Skip the BottomSheet chrome for screens that own their entire visual
  // surface — welcome, terminal "submitted," and the camera capture/review
  // pages. The chrome would otherwise paste an empty title bar + close
  // button over their full-screen layouts.
  const { currentStep, subStep } = vm.state;
  const isTerminalScreen =
    currentStep === 'verification_welcome' || currentStep === 'verification_submitted';
  const isFullBleedDoc =
    currentStep === 'upload_documents' &&
    typeof subStep === 'string' &&
    (subStep.startsWith('capture_') || subStep.startsWith('review_'));
  const isFullBleed = isTerminalScreen || isFullBleedDoc;

  // onFail is reserved for future host-level failure paths (e.g. SDK init
  // race conditions detected mid-flow). No current code path invokes it.
  void onFail;

  if (isFullBleed) return screenContent;

  return (
    <OnboardingChrome state={vm.state} onClose={onCancel}>
      {screenContent}
    </OnboardingChrome>
  );
}
