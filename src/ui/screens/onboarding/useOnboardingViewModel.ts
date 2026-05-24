import { useCallback, useEffect, useReducer, useRef } from 'react';
import { client } from '../../../client';
import { configureEvervault, encryptWithEvervault } from '../../../evervault';
import { __internal as configInternal } from '../../../config';
import { ErrorCodes, frameError } from '../../../errors';
import { addApplePayToOwnerFlow } from '../../../applePay';
import { openPlaidLink as runPlaidLink, type PlaidConnectResult } from '../../../plaid';
import { PaymentAccountType, PaymentMethodType } from 'framepayments/dist/types/payment_methods';
import type { OnboardingCapability, OnboardingResult } from '../../../types';
import {
  initialOnboardingState,
  onboardingReducer,
  type AchAccountType,
  type OnboardingAction,
  type OnboardingAddress,
  type OnboardingState,
  type OnboardingStep,
  type OnboardingSubStep,
  type VerifyPhoneUi,
} from './onboardingReducer';
import {
  computeFlow,
  entrySubStep,
  nextStep as selectorNextStep,
  previousStep as selectorPreviousStep,
  validateAch,
  validateAddress,
  validateCustomerInformation,
  validateOtp,
  validatePhoneAuth,
  isCapabilitySatisfied,
} from './onboardingSelectors';

// Hook owning the onboarding state machine + side effects. Phase 8a wires the
// foundation; later sub-phases plug screens in. The Prove + Plaid + camera +
// 3DS-poll surfaces stay behind adapter callables so 8b–8e can extend
// without rewriting 8a.

export interface OnboardingViewModelArgs {
  accountId: string | null;
  capabilities: ReadonlyArray<OnboardingCapability>;
  onComplete: (result: OnboardingResult) => void;
  onCancel: () => void;
}

export interface OnboardingViewModelResult {
  state: OnboardingState;
  dispatch: React.Dispatch<OnboardingAction>;
  // Navigation
  advance: () => void;
  back: () => void;
  goTo: (step: OnboardingStep, subStep: OnboardingSubStep | null) => void;
  cancel: () => void;
  complete: (paymentMethodId?: string) => void;
  // Personal-info simple field setters (thin wrappers around dispatch so the
  // screens don't import the reducer directly).
  setPhoneCountry: (alpha2: string, callingCode: string) => void;
  setPhoneNumber: (value: string) => void;
  setDob: (next: { month: string; day: string; year: string }) => void;
  setAcceptedTos: (value: boolean) => void;
  setOtpCode: (value: string) => void;
  setCustomerFirstName: (value: string) => void;
  setCustomerLastName: (value: string) => void;
  setCustomerEmail: (value: string) => void;
  setSsnLast4: (value: string) => void;
  setAddressField: (field: keyof OnboardingAddress, value: string) => void;
  setVerifyPhoneUi: (ui: VerifyPhoneUi | null) => void;
  setAchField: (field: 'routingNumber' | 'accountNumber', value: string) => void;
  setAchAccountType: (value: AchAccountType) => void;
  setAchManualMode: (value: boolean) => void;
  // Personal-info network actions
  /** Create a phone verification and route the user to the verify-phone
   *  screen. When `forceFrameOtp=true` the Prove branch is bypassed even if
   *  the backend returns a prove_auth_token (used after Prove falls back). */
  sendOtp: (opts?: { forceFrameOtp?: boolean }) => Promise<void>;
  confirmFrameOtp: () => Promise<void>;
  submitCustomerInformation: () => Promise<void>;
  // Payment-method actions
  loadSavedPaymentMethods: () => Promise<void>;
  submitNewCard: (card: { pan: string; expirationMonth: string; expirationYear: string; cvc: string }) => Promise<string>;
  /** Add an Apple Pay token to the account (no charge). iOS only. */
  addApplePayToOwner: () => Promise<string>;
  /** Patch billing onto a saved payment method (addressVerificationOnly path). */
  updateSavedPaymentMethodBilling: (paymentMethodId: string) => Promise<void>;
  start3DS: (paymentMethodId: string) => Promise<void>;
  /** Poll threeDS.get until the verification terminates. Resolves on
   *  succeeded, throws on failed, timeout, or signal abort. */
  poll3DS: (opts?: { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal }) => Promise<void>;
  resend3DS: () => Promise<void>;
  // Payout-method actions
  loadSavedPayoutMethods: () => Promise<void>;
  submitManualAch: () => Promise<string>;
  connectPlaidAccount: (params: { publicToken: string; accountId: string; institutionName?: string; subtype?: string }) => Promise<string>;
  /** End-to-end Plaid Link: fetches token, opens Link, calls
   *  paymentMethods.connectPlaidBankAccount. Resolves with the new pm id. */
  openPlaidLink: () => Promise<string>;
  // Document actions
  ensureCustomerIdentity: () => Promise<string>;
  uploadCapturedDocuments: () => Promise<void>;
}

export function useOnboardingViewModel({
  accountId: initialAccountId,
  capabilities,
  onComplete,
  onCancel,
}: OnboardingViewModelArgs): OnboardingViewModelResult {
  const [state, dispatch] = useReducer(
    onboardingReducer,
    initialOnboardingState(capabilities, initialAccountId),
  );

  const stateRef = useRef<OnboardingState>(state);
  stateRef.current = state;
  const performingRef = useRef(false);
  const completedRef = useRef(false);

  // ─── Init: compute flow + drop into the first step on mount ───
  useEffect(() => {
    const flow = computeFlow(capabilities);
    const firstStep = flow[0] ?? 'verification_welcome';
    dispatch({
      type: 'SET_FLOW',
      flow,
      currentStep: firstStep,
      subStep: entrySubStep(firstStep, capabilities),
    });
    if (!initialAccountId) {
      // No accountId → nothing to prefetch. The Verify-Welcome continue
      // button gates on accountLoaded so we flip it immediately.
      dispatch({ type: 'SET_ACCOUNT_LOADED', loaded: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Pull the account profile + saved methods in parallel. Failures are
        // non-fatal — the user can still complete the flow, just without
        // prefill.
        const [accountInitial, methodsResp] = await Promise.all([
          client.sdk.accounts.get(initialAccountId).catch(() => null),
          client.sdk.accounts
            .getPaymentMethods(initialAccountId)
            .catch(() => ({ data: [] as Array<unknown> })),
        ]);
        if (cancelled) return;

        // Reconcile the merchant-requested capabilities with the account's
        // existing capabilities. Mirrors iOS OnboardingContainerViewModel.
        // checkExistingAccount(updateCapabilies: true):
        //   • If the account is missing any required capability, POST
        //     /capabilities to add them, then re-fetch.
        //   • For every required capability whose `currently_due` is empty,
        //     drop it from requiredCapabilities so the flow skips that step.
        const account = await reconcileCapabilities(
          accountInitial,
          initialAccountId,
          capabilities,
        );
        if (cancelled) return;

        if (account) {
          dispatch({ type: 'PREFILL', values: prefillFromAccount(account) });
          const trimmed = trimCompletedCapabilities(capabilities, account);
          if (trimmed.length !== capabilities.length) {
            dispatch({ type: 'SET_REQUIRED_CAPABILITIES', capabilities: trimmed });
          }
        }
        // Split saved methods by kind: cards on the payment list, ACHs on
        // the payout list. The reducer's selectors filter again on render
        // but pre-sorting is cleaner.
        const list = ((methodsResp.data ?? []) as ReadonlyArray<{ card?: unknown; ach?: unknown; id: string }>);
        const cards = list.filter((m) => m.card != null) as unknown as ReadonlyArray<
          import('framepayments/dist/types/payment_methods').PaymentMethod
        >;
        const achs = list.filter((m) => m.ach != null) as unknown as ReadonlyArray<
          import('framepayments/dist/types/payment_methods').PaymentMethod
        >;
        dispatch({ type: 'SET_SAVED_PAYMENT_METHODS', methods: cards });
        dispatch({ type: 'SET_SAVED_PAYOUT_METHODS', methods: achs });
      } catch {
        // Any other unhandled failure (shouldn't happen — both promises
        // catch internally). Flip loaded so the user isn't wedged on the
        // welcome spinner.
      } finally {
        if (!cancelled) dispatch({ type: 'SET_ACCOUNT_LOADED', loaded: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // capabilities is the only effect input; runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync flow if requiredCapabilities changes after the initial computation
  // (used by 8g: capabilities resolved by account-prefetch). If the new flow
  // doesn't include the user's current step, snap them back to the first step
  // that still exists rather than wedging on a stale step.
  useEffect(() => {
    const flow = computeFlow(state.requiredCapabilities);
    const currentStep = flow.includes(stateRef.current.currentStep)
      ? stateRef.current.currentStep
      : (flow[0] ?? 'verification_welcome');
    const subStep = currentStep === stateRef.current.currentStep
      ? stateRef.current.subStep
      : entrySubStep(currentStep, state.requiredCapabilities);
    dispatch({ type: 'SET_FLOW', flow, currentStep, subStep });
    // We deliberately read currentStep/subStep via stateRef rather than as
    // deps — using them as deps would loop on every step transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.requiredCapabilities]);

  // ─── Navigation ───
  const advance = useCallback(() => {
    const current = stateRef.current;
    const target = selectorNextStep(current);
    if (!target) return;
    dispatch({ type: 'GO_TO_STEP', step: target, subStep: entrySubStep(target, current.requiredCapabilities) });
  }, []);

  const back = useCallback(() => {
    const current = stateRef.current;
    const target = selectorPreviousStep(current);
    if (!target) return;
    dispatch({ type: 'GO_TO_STEP', step: target, subStep: entrySubStep(target, current.requiredCapabilities) });
  }, []);

  const goTo = useCallback((step: OnboardingStep, subStep: OnboardingSubStep | null) => {
    dispatch({ type: 'GO_TO_STEP', step, subStep });
  }, []);

  const cancel = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCancel();
  }, [onCancel]);

  const complete = useCallback(
    (paymentMethodId?: string) => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete({ status: 'completed', paymentMethodId });
    },
    [onComplete],
  );

  // ─── Helper for guarded async actions ───
  const guardedAction = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      if (performingRef.current) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'An action is already in flight.');
      }
      performingRef.current = true;
      dispatch({ type: 'SET_PERFORMING_ACTION', value: true });
      try {
        return await fn();
      } finally {
        performingRef.current = false;
        dispatch({ type: 'SET_PERFORMING_ACTION', value: false });
      }
    },
    [],
  );

  // ─── Personal information ───

  const sendOtp = useCallback(async (opts?: { forceFrameOtp?: boolean }) => {
    return guardedAction(async () => {
      const current = stateRef.current;
      const errors = validatePhoneAuth(current);
      if (Object.keys(errors).length > 0) {
        dispatch({ type: 'SET_FIELD_ERRORS', errors });
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'Resolve the highlighted fields and try again.');
      }
      const forceFrameOtp = opts?.forceFrameOtp === true;

      // Account creation: empty-individual account if none exists, then OTP.
      let accountId = current.accountId;
      if (!accountId) {
        const e164 = `+${current.phoneCountry.callingCode}${current.phoneNumber.replace(/\D+/g, '')}`;
        // Empty-account creation for phone-auth: the backend accepts a draft
        // individual profile with only phone (and DOB when kyc_prefill).
        // Names + email + address are filled in via accounts.update on the
        // CustomerInformation step. The SDK's CreateAccountProfile type
        // requires name + email at the type level, but the backend treats
        // them as optional on initial create — so we use a runtime-safe
        // cast here and assert the response shape ourselves.
        const dob =
          current.dobYear && current.dobMonth && current.dobDay
            ? `${current.dobYear}-${current.dobMonth.padStart(2, '0')}-${current.dobDay.padStart(2, '0')}`
            : undefined;
        const createParams = {
          type: 'individual',
          profile: {
            individual: {
              phone: { number: e164 },
              ...(dob ? { dob } : {}),
            },
          },
        };
        const account = await client.sdk.accounts.create(
          createParams as unknown as Parameters<typeof client.sdk.accounts.create>[0],
        );
        if (!account?.id) {
          throw frameError(ErrorCodes.PAYMENT_FAILED, 'Frame returned no account id.');
        }
        accountId = account.id;
        dispatch({ type: 'SET_ACCOUNT_ID', id: accountId });
      }

      const e164 = `+${current.phoneCountry.callingCode}${current.phoneNumber.replace(/\D+/g, '')}`;
      const verification = await client.sdk.phoneVerifications.create(
        accountId,
        { phone_number: e164 },
      );

      // When the Prove branch has already failed, force the Frame OTP path
      // even if the backend still returns a prove_auth_token. Prevents the
      // user from being stuck in a loading_prove → otp_for_prove cycle.
      const proveAuthToken = forceFrameOtp
        ? null
        : ((verification as { prove_auth_token?: string }).prove_auth_token ?? null);
      const ui: VerifyPhoneUi = proveAuthToken ? 'loading_prove' : 'otp_frame_api';
      dispatch({
        type: 'SET_VERIFY_PHONE',
        verificationId: verification.id,
        proveAuthToken,
        ui,
      });
      dispatch({ type: 'SET_SUB_STEP', subStep: 'verify_phone' });
    });
  }, [guardedAction]);

  const confirmFrameOtp = useCallback(async () => {
    return guardedAction(async () => {
      const current = stateRef.current;
      const errors = validateOtp(current);
      if (Object.keys(errors).length > 0) {
        dispatch({ type: 'SET_FIELD_ERRORS', errors });
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'Enter the 6-digit code.');
      }
      if (!current.accountId || !current.pendingVerificationId) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'Phone verification session expired. Restart the step.');
      }
      await client.sdk.phoneVerifications.confirm(
        current.accountId,
        current.pendingVerificationId,
        { code: current.otpCode },
      );
      dispatch({ type: 'SET_SUB_STEP', subStep: 'customer_information' });
    });
  }, [guardedAction]);

  const submitCustomerInformation = useCallback(async () => {
    return guardedAction(async () => {
      const current = stateRef.current;
      const errors = validateCustomerInformation(current);
      if (Object.keys(errors).length > 0) {
        dispatch({ type: 'SET_FIELD_ERRORS', errors });
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'Resolve the highlighted fields and try again.');
      }
      if (!current.accountId) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'No account id present. Restart onboarding.');
      }

      // Field names mirror frame-node's AccountProfileIndividual shape:
      //   name.{first_name,last_name}, email, phone.{number,country_code},
      //   address.{line1,line2,city,state,country,postal_code}, dob, ssn.
      const phoneE164 = `+${current.phoneCountry.callingCode}${current.phoneNumber.replace(/\D+/g, '')}`;
      const individual = {
        name: {
          first_name: current.customerFirstName,
          last_name: current.customerLastName,
        },
        email: current.customerEmail,
        phone: { number: phoneE164 },
        dob: `${current.dobYear}-${current.dobMonth.padStart(2, '0')}-${current.dobDay.padStart(2, '0')}`,
        ssn: current.ssnLast4 || undefined,
        address: {
          line1: current.address.line1,
          line2: current.address.line2 || undefined,
          city: current.address.city,
          state: current.address.state,
          country: current.address.country,
          postal_code: current.address.postalCode,
        },
      };
      await client.sdk.accounts.update(
        current.accountId,
        { profile: { individual } },
      );

      // Per the flow chart, customer-information is the last sub-step of
      // PersonalInformation unless geo_compliance is requested.
      if (current.requiredCapabilities.includes('geo_compliance')) {
        dispatch({ type: 'SET_SUB_STEP', subStep: 'geolocation' });
      } else {
        advance();
      }
    });
  }, [guardedAction, advance]);

  // ─── Payment methods ───

  const loadSavedPaymentMethods = useCallback(async () => {
    return guardedAction(async () => {
      const current = stateRef.current;
      if (!current.accountId) return;
      try {
        const resp = await client.sdk.accounts.getPaymentMethods(current.accountId);
        // Cards only on this step; ACH lives on the payout step.
        const cards = (resp.data ?? []).filter((m) => m.card != null);
        dispatch({ type: 'SET_SAVED_PAYMENT_METHODS', methods: cards });
      } catch {
        dispatch({ type: 'SET_SAVED_PAYMENT_METHODS', methods: [] });
      }
    });
  }, [guardedAction]);

  const submitNewCard = useCallback(
    async (card: { pan: string; expirationMonth: string; expirationYear: string; cvc: string }): Promise<string> => {
      return guardedAction(async () => {
        const current = stateRef.current;
        if (!current.accountId) {
          throw frameError(ErrorCodes.PAYMENT_FAILED, 'No account id present.');
        }
        const addressErrors = validateAddress(current.address, true);
        if (Object.keys(addressErrors).length > 0) {
          dispatch({ type: 'SET_FIELD_ERRORS', errors: addressErrors });
          throw frameError(ErrorCodes.PAYMENT_FAILED, 'Resolve the highlighted fields and try again.');
        }
        await ensureEvervaultConfigured();
        const [encryptedPan, encryptedCvc] = await Promise.all([
          encryptWithEvervault(card.pan),
          encryptWithEvervault(card.cvc),
        ]);

        const billing = {
          line_1: current.address.line1,
          line_2: current.address.line2 || undefined,
          city: current.address.city,
          state: current.address.state,
          country: current.address.country,
          postal_code: current.address.postalCode,
        };
        const pm = await client.sdk.paymentMethods.createCard({
          type: PaymentMethodType.CARD,
          account: current.accountId,
          card_number: encryptedPan,
          exp_month: card.expirationMonth,
          exp_year: card.expirationYear,
          cvc: encryptedCvc,
          billing,
        });
        if (!pm?.id) {
          throw frameError(ErrorCodes.PAYMENT_METHOD_FAILED, 'Frame returned no payment method id.');
        }
        dispatch({ type: 'SELECT_PAYMENT_METHOD', id: pm.id });
        return pm.id;
      });
    },
    [guardedAction],
  );

  const addApplePayToOwner = useCallback(async (): Promise<string> => {
    return guardedAction(async () => {
      const current = stateRef.current;
      if (!current.accountId) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'No account id present.');
      }
      const pmId = await addApplePayToOwnerFlow({
        owner: { type: 'account', id: current.accountId },
      });
      dispatch({ type: 'SELECT_PAYMENT_METHOD', id: pmId });
      return pmId;
    });
  }, [guardedAction]);

  const updateSavedPaymentMethodBilling = useCallback(
    async (paymentMethodId: string) => {
      return guardedAction(async () => {
        const current = stateRef.current;
        const addressErrors = validateAddress(current.address, true);
        if (Object.keys(addressErrors).length > 0) {
          dispatch({ type: 'SET_FIELD_ERRORS', errors: addressErrors });
          throw frameError(ErrorCodes.PAYMENT_FAILED, 'Resolve the highlighted fields and try again.');
        }
        await client.sdk.paymentMethods.update(paymentMethodId, {
          billing: {
            line_1: current.address.line1,
            line_2: current.address.line2 || undefined,
            city: current.address.city,
            state: current.address.state,
            country: current.address.country,
            postal_code: current.address.postalCode,
          },
        });
      });
    },
    [guardedAction],
  );

  const start3DS = useCallback(
    async (paymentMethodId: string) => {
      return guardedAction(async () => {
        const verification = await client.sdk.threeDS.create({ payment_method_id: paymentMethodId });
        if (!verification?.id) {
          throw frameError(ErrorCodes.PAYMENT_FAILED, 'Failed to initialize card verification. Please try again.');
        }
        dispatch({ type: 'SET_THREE_DS_VERIFICATION_ID', id: verification.id });
        dispatch({ type: 'SET_SUB_STEP', subStep: 'secure_3ds' });
      });
    },
    [guardedAction],
  );

  const poll3DS = useCallback(
    async (opts?: { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal }) => {
      const timeoutMs = opts?.timeoutMs ?? 5 * 60 * 1000; // 5 min
      const intervalMs = opts?.intervalMs ?? 2000;
      const signal = opts?.signal;
      const id = stateRef.current.threeDsVerificationId;
      if (!id) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'No 3DS challenge in progress.');
      }
      const deadline = Date.now() + timeoutMs;
      // No guardedAction here — the poll is intentionally long-running and
      // shouldn't block other actions (e.g. Resend). Caller-supplied AbortSignal
      // is how SecurePMVerificationScreen cancels the loop on unmount.
      while (Date.now() < deadline) {
        if (signal?.aborted) {
          throw frameError(ErrorCodes.USER_CANCELED, '3DS poll canceled.');
        }
        const v = (await client.sdk.threeDS.get(id)) as { status?: string } | null;
        const status = v?.status ?? '';
        if (status === 'succeeded') return;
        if (status === 'failed' || status === 'canceled') {
          throw frameError(ErrorCodes.PAYMENT_FAILED, '3DS challenge was declined.');
        }
        // Abortable sleep — resolves either after intervalMs or on signal abort.
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
          }, intervalMs);
          const onAbort = () => {
            clearTimeout(timer);
            resolve();
          };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
      }
      throw frameError(ErrorCodes.PAYMENT_FAILED, '3DS challenge timed out.');
    },
    [],
  );

  const resend3DS = useCallback(async () => {
    return guardedAction(async () => {
      const current = stateRef.current;
      if (!current.threeDsVerificationId) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'No 3DS challenge in progress.');
      }
      await client.sdk.threeDS.resend(current.threeDsVerificationId);
    });
  }, [guardedAction]);

  // ─── Payout methods ───

  const loadSavedPayoutMethods = useCallback(async () => {
    return guardedAction(async () => {
      const current = stateRef.current;
      if (!current.accountId) return;
      try {
        const resp = await client.sdk.accounts.getPaymentMethods(current.accountId);
        const achs = (resp.data ?? []).filter((m) => m.ach != null);
        dispatch({ type: 'SET_SAVED_PAYOUT_METHODS', methods: achs });
      } catch {
        dispatch({ type: 'SET_SAVED_PAYOUT_METHODS', methods: [] });
      }
    });
  }, [guardedAction]);

  const submitManualAch = useCallback(async (): Promise<string> => {
    return guardedAction(async () => {
      const current = stateRef.current;
      if (!current.accountId) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'No account id present.');
      }
      const errors = validateAch(current.ach, current.address);
      if (Object.keys(errors).length > 0) {
        dispatch({ type: 'SET_FIELD_ERRORS', errors });
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'Resolve the highlighted fields and try again.');
      }

      const billing = {
        line_1: current.address.line1,
        line_2: current.address.line2 || undefined,
        city: current.address.city,
        state: current.address.state,
        country: 'US',
        postal_code: current.address.postalCode,
      };
      const pm = await client.sdk.paymentMethods.createACH({
        type: PaymentMethodType.ACH,
        account: current.accountId,
        account_type:
          current.ach.accountType === 'savings'
            ? PaymentAccountType.SAVINGS
            : PaymentAccountType.CHECKING,
        account_number: current.ach.accountNumber,
        routing_number: current.ach.routingNumber,
        billing,
      });
      if (!pm?.id) {
        throw frameError(ErrorCodes.PAYMENT_METHOD_FAILED, 'Frame returned no payment method id.');
      }
      dispatch({ type: 'SELECT_PAYOUT_METHOD', id: pm.id });
      return pm.id;
    });
  }, [guardedAction]);

  const connectPlaidAccount = useCallback(
    async (params: { publicToken: string; accountId: string; institutionName?: string; subtype?: string }): Promise<string> => {
      return guardedAction(async () => {
        const current = stateRef.current;
        if (!current.accountId) {
          throw frameError(ErrorCodes.PAYMENT_FAILED, 'No account id present.');
        }
        const pm = await client.sdk.paymentMethods.connectPlaidBankAccount({
          account: current.accountId,
          public_token: params.publicToken,
          account_id: params.accountId,
          institution_name: params.institutionName,
          subtype: params.subtype,
        });
        if (!pm?.id) {
          throw frameError(ErrorCodes.PAYMENT_METHOD_FAILED, 'Frame returned no payment method id.');
        }
        dispatch({ type: 'SELECT_PAYOUT_METHOD', id: pm.id });
        return pm.id;
      });
    },
    [guardedAction],
  );

  // End-to-end Plaid: open the SDK, then hand the publicToken + selected
  // account id to the Frame backend via paymentMethods.connectPlaidBankAccount.
  // Errors from openPlaidLink (USER_CANCELED, PAYMENT_FAILED, PLAID_UNAVAILABLE)
  // propagate up so the caller can render a toast or stay on the screen.
  const openPlaidLink = useCallback(async (): Promise<string> => {
    return guardedAction(async () => {
      const current = stateRef.current;
      if (!current.accountId) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'No account id present.');
      }
      const linkResult: PlaidConnectResult = await runPlaidLink({ accountId: current.accountId });
      const pm = await client.sdk.paymentMethods.connectPlaidBankAccount({
        account: current.accountId,
        public_token: linkResult.publicToken,
        account_id: linkResult.selectedAccountId,
        institution_name: linkResult.institutionName,
        subtype: linkResult.subtype,
      });
      if (!pm?.id) {
        throw frameError(ErrorCodes.PAYMENT_METHOD_FAILED, 'Frame returned no payment method id.');
      }
      dispatch({ type: 'SELECT_PAYOUT_METHOD', id: pm.id });
      return pm.id;
    });
  }, [guardedAction]);

  // ─── Documents ───

  const ensureCustomerIdentity = useCallback(async (): Promise<string> => {
    return guardedAction(async () => {
      const current = stateRef.current;
      if (current.customerIdentityId) return current.customerIdentityId;
      if (!current.accountId) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'No account id present.');
      }
      // The customer identity verification carries the same identity payload
      // that was just submitted to accounts.update on the CustomerInformation
      // screen. The SDK has no createForAccount(accountId) helper, so build
      // the full params from reducer state. Missing fields here mean the
      // user skipped CustomerInformation — surface a clear error.
      const e164 = `+${current.phoneCountry.callingCode}${current.phoneNumber.replace(/\D+/g, '')}`;
      const dob =
        current.dobYear && current.dobMonth && current.dobDay
          ? `${current.dobYear}-${current.dobMonth.padStart(2, '0')}-${current.dobDay.padStart(2, '0')}`
          : '';
      const params = {
        first_name: current.customerFirstName,
        last_name: current.customerLastName,
        date_of_birth: dob,
        email: current.customerEmail,
        phone_number: e164,
        ssn: current.ssnLast4,
        address: {
          line_1: current.address.line1,
          line_2: current.address.line2 || undefined,
          city: current.address.city,
          state: current.address.state,
          country: current.address.country,
          postal_code: current.address.postalCode,
        },
      };
      if (
        !params.first_name ||
        !params.last_name ||
        !params.date_of_birth ||
        !params.email ||
        !params.phone_number ||
        !params.ssn ||
        !params.address.line_1
      ) {
        throw frameError(
          ErrorCodes.PAYMENT_FAILED,
          'Customer identity is missing required fields. Complete the customer information step before uploading documents.',
        );
      }
      const identity = await client.sdk.customerIdentityVerifications.create(params);
      if (!identity?.id) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'Frame returned no customer-identity id.');
      }
      dispatch({ type: 'SET_CUSTOMER_IDENTITY_ID', id: identity.id });
      return identity.id;
    });
  }, [guardedAction]);

  const uploadCapturedDocuments = useCallback(async () => {
    return guardedAction(async () => {
      const current = stateRef.current;
      const identityId = current.customerIdentityId;
      if (!identityId) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'Customer identity not initialized.');
      }
      // Map captured photos to the frame-node IdentityDocumentUpload shape.
      // document_type is the kind of ID (drivers_license/passport/etc.) the
      // user picked; field_name identifies which side / face within that ID.
      const docType = current.docs.idType ?? 'drivers_license';
      const files: Array<{
        document_type: string;
        field_name: string;
        file: { uri: string; type: string; name: string };
        content_type: string;
        file_name: string;
      }> = [];
      const addFile = (fieldName: string, photo: { uri: string; type: string; name: string }) => {
        files.push({
          document_type: docType,
          field_name: fieldName,
          file: photo,
          content_type: photo.type,
          file_name: photo.name,
        });
      };
      if (current.docs.front) addFile('front', current.docs.front);
      if (current.docs.back) addFile('back', current.docs.back);
      if (current.docs.selfie) addFile('selfie', current.docs.selfie);
      if (files.length === 0) {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'No documents captured.');
      }
      await client.sdk.customerIdentityVerifications.uploadIdentityDocuments(
        identityId,
        files,
      );
      await client.sdk.customerIdentityVerifications.submitForVerification(identityId);
    });
  }, [guardedAction]);

  // ─── Simple field setters ───
  // Thin wrappers around dispatch so screens can stay decoupled from the
  // reducer's action union. Identities are stable (no deps), so screens that
  // pass them into useEffect deps don't loop.
  const setPhoneCountry = useCallback((alpha2: string, callingCode: string) => {
    dispatch({ type: 'SET_PHONE_COUNTRY', country: { alpha2, callingCode } });
  }, []);
  const setPhoneNumber = useCallback((value: string) => {
    dispatch({ type: 'SET_PHONE_NUMBER', value });
  }, []);
  const setDob = useCallback((next: { month: string; day: string; year: string }) => {
    dispatch({ type: 'SET_DOB', month: next.month, day: next.day, year: next.year });
  }, []);
  const setAcceptedTos = useCallback((value: boolean) => {
    dispatch({ type: 'SET_ACCEPTED_TOS', value });
  }, []);
  const setOtpCode = useCallback((value: string) => {
    dispatch({ type: 'SET_OTP_CODE', value });
  }, []);
  const setCustomerFirstName = useCallback((value: string) => {
    dispatch({ type: 'SET_CUSTOMER_FIRST_NAME', value });
  }, []);
  const setCustomerLastName = useCallback((value: string) => {
    dispatch({ type: 'SET_CUSTOMER_LAST_NAME', value });
  }, []);
  const setCustomerEmail = useCallback((value: string) => {
    dispatch({ type: 'SET_CUSTOMER_EMAIL', value });
  }, []);
  const setSsnLast4 = useCallback((value: string) => {
    dispatch({ type: 'SET_SSN_LAST4', value });
  }, []);
  const setAddressField = useCallback(
    (field: keyof OnboardingAddress, value: string) => {
      dispatch({ type: 'SET_ADDRESS_FIELD', field, value });
    },
    [],
  );
  const setVerifyPhoneUi = useCallback((ui: VerifyPhoneUi | null) => {
    dispatch({ type: 'SET_VERIFY_PHONE_UI', ui });
  }, []);
  const setAchField = useCallback(
    (field: 'routingNumber' | 'accountNumber', value: string) => {
      dispatch({ type: 'SET_ACH_FIELD', field, value });
    },
    [],
  );
  const setAchAccountType = useCallback((value: AchAccountType) => {
    dispatch({ type: 'SET_ACH_ACCOUNT_TYPE', value });
  }, []);
  const setAchManualMode = useCallback((value: boolean) => {
    dispatch({ type: 'SET_ACH_MANUAL_MODE', value });
  }, []);

  // Surface adjacent helpers used by 8g via the returned shape.
  // (Kept on the object so screens have one canonical access point.)
  return {
    state,
    dispatch,
    advance,
    back,
    goTo,
    cancel,
    complete,
    setPhoneCountry,
    setPhoneNumber,
    setDob,
    setAcceptedTos,
    setOtpCode,
    setCustomerFirstName,
    setCustomerLastName,
    setCustomerEmail,
    setSsnLast4,
    setAddressField,
    setVerifyPhoneUi,
    setAchField,
    setAchAccountType,
    setAchManualMode,
    sendOtp,
    confirmFrameOtp,
    submitCustomerInformation,
    loadSavedPaymentMethods,
    submitNewCard,
    addApplePayToOwner,
    updateSavedPaymentMethodBilling,
    start3DS,
    poll3DS,
    resend3DS,
    loadSavedPayoutMethods,
    submitManualAch,
    connectPlaidAccount,
    openPlaidLink,
    ensureCustomerIdentity,
    uploadCapturedDocuments,
  };
}

// Re-exposed for advanced consumers (e.g. tests + 8g prefetch logic).
export { isCapabilitySatisfied };

// ─── Evervault helper (mirrors useCheckoutViewModel) ───

// Shape of one entry in `account.capabilities` as returned by the framepayments
// API. The JS SDK types it as `unknown[]`; iOS uses `name` + `currently_due`.
// We rely on the same fields here.
interface AccountCapabilityRow {
  name: string;
  currently_due?: ReadonlyArray<string> | null;
}

function readAccountCapabilities(
  account: { capabilities?: unknown[] } | null | undefined,
): ReadonlyArray<AccountCapabilityRow> {
  const raw = account?.capabilities;
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is AccountCapabilityRow => {
    return typeof c === 'object' && c !== null && typeof (c as { name?: unknown }).name === 'string';
  });
}

// Mirrors iOS OnboardingContainerViewModel.checkExistingAccount(updateCapabilies:
// true): if the account's capabilities aren't a superset of what the merchant
// asked for, POST the missing ones via the Capabilities API and re-fetch the
// account so we see the resulting `currently_due` state. Idempotent — returns
// the (possibly refreshed) account or the original if nothing was missing.
async function reconcileCapabilities(
  account: Awaited<ReturnType<typeof client.sdk.accounts.get>> | null,
  accountId: string,
  required: ReadonlyArray<OnboardingCapability>,
): Promise<typeof account> {
  if (!account) return account;
  const present = new Set(readAccountCapabilities(account).map((c) => c.name));
  const missing = required.filter((r) => !present.has(r));
  if (missing.length === 0) return account;
  try {
    await client.sdk.capabilities.request(accountId, { capabilities: [...missing] });
    const refreshed = await client.sdk.accounts.get(accountId).catch(() => null);
    return refreshed ?? account;
  } catch {
    // Non-fatal — fall back to the original account so the user can still
    // attempt the flow. Server-side validation will catch any unmet caps.
    return account;
  }
}

// For each required capability the account already has with an empty
// `currently_due`, remove it from the merchant's requested list. The mount
// effect's downstream `SET_REQUIRED_CAPABILITIES` dispatch triggers the
// existing `state.requiredCapabilities` effect (see ~line 182) which
// recomputes the flow.
function trimCompletedCapabilities(
  required: ReadonlyArray<OnboardingCapability>,
  account: { capabilities?: unknown[] } | null | undefined,
): ReadonlyArray<OnboardingCapability> {
  const rows = readAccountCapabilities(account);
  const completed = new Set(
    rows
      .filter((c) => Array.isArray(c.currently_due) && c.currently_due.length === 0)
      .map((c) => c.name),
  );
  return required.filter((r) => !completed.has(r));
}

// Map Frame's Account.profile (a Record<string, unknown>) into the reducer's
// PREFILL partial. Best-effort — every field stays empty when the profile is
// missing or shaped differently than expected.
function prefillFromAccount(account: { id: string; profile?: Record<string, unknown> | null }): Partial<OnboardingState> {
  const out: Partial<OnboardingState> = { accountId: account.id };
  const individual = (account.profile?.individual ?? account.profile) as Record<string, unknown> | undefined;
  if (!individual) return out;

  const name = individual.name as Record<string, unknown> | undefined;
  if (name) {
    if (typeof name.first_name === 'string') out.customerFirstName = name.first_name;
    if (typeof name.last_name === 'string') out.customerLastName = name.last_name;
  }
  if (typeof individual.email === 'string') out.customerEmail = individual.email;
  if (typeof individual.ssn_last_four === 'string') out.ssnLast4 = individual.ssn_last_four;
  if (typeof individual.date_of_birth === 'string') {
    // Stored as 'YYYY-MM-DD' per the backend convention; split into the
    // three reducer fields.
    const [y, m, d] = individual.date_of_birth.split('-');
    if (y && m && d) {
      out.dobYear = y;
      out.dobMonth = m;
      out.dobDay = d;
    }
  }
  const address = individual.address as Record<string, unknown> | undefined;
  if (address) {
    out.address = {
      line1: typeof address.line_1 === 'string' ? address.line_1 : '',
      line2: typeof address.line_2 === 'string' ? address.line_2 : '',
      city: typeof address.city === 'string' ? address.city : '',
      state: typeof address.state === 'string' ? address.state : '',
      country: typeof address.country === 'string' ? address.country : 'US',
      postalCode: typeof address.postal_code === 'string' ? address.postal_code : '',
    };
  }
  return out;
}

async function ensureEvervaultConfigured(): Promise<void> {
  const cached = configInternal.getEvervaultConfiguration();
  if (cached) {
    await configureEvervault(cached.teamId, cached.appId);
    return;
  }
  const config = await client.sdk.configuration.getEvervaultConfiguration();
  if (!config.team_id || !config.app_id) {
    throw frameError(ErrorCodes.PAYMENT_FAILED, 'Evervault configuration is unavailable.');
  }
  configInternal.setEvervaultConfiguration({ teamId: config.team_id, appId: config.app_id });
  await configureEvervault(config.team_id, config.app_id);
}
