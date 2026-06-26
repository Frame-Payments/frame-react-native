import { useCallback, useEffect, useReducer, useRef } from 'react';
import { PaymentMethodType } from '../../../framepaymentsTypes';
import { client, requireSecretKeyFor } from '../../../client';
import { configureEvervault, encryptWithEvervault } from '../../../evervault';
import { __internal as configInternal } from '../../../config';
import { ErrorCodes, frameError } from '../../../errors';
import {
  checkoutReducer,
  hasUsablePaymentInput,
  initialCheckoutState,
  isUsingSavedCard,
  shouldValidateAddress,
  validateForSubmit,
  type AddressMode,
  type CheckoutState,
} from './checkoutReducer';
import type { PaymentCardFieldHandle } from '../../primitives/PaymentCardField';

// View model for the Checkout screen. Owns the reducer + side effects:
//   - loads saved payment methods on mount
//   - resolves Evervault config from JS cache or fetches it (one-shot)
//   - validates + encrypts the card on submit
//   - creates the card payment method (publishable-key route)
//   - creates the transfer (publishable-key route)

export interface UseCheckoutViewModelArgs {
  accountId: string;
  amount: number;
  currency?: string;
  addressMode?: AddressMode;
  cardFieldRef: React.RefObject<PaymentCardFieldHandle | null>;
}

export interface UseCheckoutViewModelResult {
  state: CheckoutState;
  dispatch: React.Dispatch<Parameters<typeof checkoutReducer>[1]>;
  hasUsableInput: boolean;
  isUsingSaved: boolean;
  shouldShowAddress: boolean;
  submit: () => Promise<string>;
}

export function useCheckoutViewModel({
  accountId,
  amount,
  currency = 'USD',
  addressMode = 'required',
  cardFieldRef,
}: UseCheckoutViewModelArgs): UseCheckoutViewModelResult {
  const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState(addressMode));
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;
  // Latest-state ref so `submit` can read the freshest reducer state without
  // listing `state` as a useCallback dependency — that would re-create the
  // callback on every keystroke and bust memoized children that consume it.
  const stateRef = useRef<CheckoutState>(state);
  stateRef.current = state;
  // Sync re-entry guard. Reducer state changes are async — two rapid Pay taps
  // both observe isPerformingAction=false before the first dispatch settles.
  // The ref flips synchronously inside the callback so the second tap bails.
  const performingRef = useRef(false);

  // Load saved payment methods for the account.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await client.sdk.accounts.getPaymentMethods(accountId);
        if (cancelled) return;
        dispatch({ type: 'SET_PAYMENT_OPTIONS', options: resp.data ?? [] });
      } catch {
        // Empty list on failure; user can still enter a new card.
        if (cancelled) return;
        dispatch({ type: 'SET_PAYMENT_OPTIONS', options: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const submit = useCallback(async (): Promise<string> => {
    if (performingRef.current) {
      throw frameError(ErrorCodes.PAYMENT_FAILED, 'Submission already in flight.');
    }
    // Set the sync guard immediately. Anything that throws below the guard
    // must clear it in the catch path — otherwise the next tap is wedged.
    performingRef.current = true;

    try {
      // Checkout tokenizes the card and creates a transfer — both server-only
      // (secret-keyed) today. Fail up front with remediation rather than letting
      // framepayments throw an opaque `missing_api_key` after the user submits.
      requireSecretKeyFor('Checkout');

      const current = stateRef.current;

      const validation = validateForSubmit(current);
      if (!validation.isValid) {
        dispatch({ type: 'SET_FIELD_ERRORS', errors: validation.fieldErrors });
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'Resolve the highlighted fields and try again.');
      }

      const usingSaved = isUsingSavedCard(current);
      if (!usingSaved) {
        const cardErrors = cardFieldRef.current?.validate() ?? null;
        if (cardErrors) {
          const firstError =
            cardErrors.pan ?? cardErrors.expiry ?? cardErrors.cvc ?? 'Enter valid card details';
          throw frameError(ErrorCodes.PAYMENT_FAILED, firstError);
        }
      }

      dispatch({ type: 'SET_PERFORMING_ACTION', value: true });
      let paymentMethodId: string;

      if (usingSaved) {
        paymentMethodId = current.selectedAccountPaymentOptionId!;
      } else {
        const card = cardFieldRef.current!.getValues();
        await ensureEvervaultConfigured();
        const [encryptedPan, encryptedCvc] = await Promise.all([
          encryptWithEvervault(card.pan),
          encryptWithEvervault(card.cvc),
        ]);

        const billing = shouldValidateAddress(current)
          ? {
              line_1: current.address.line1 || undefined,
              line_2: current.address.line2 || undefined,
              city: current.address.city || undefined,
              state: current.address.state || undefined,
              country: current.address.country || undefined,
              postal_code: current.address.postalCode || undefined,
            }
          : undefined;

        const pm = await client.sdk.paymentMethods.createCard({
          type: PaymentMethodType.CARD,
          account: accountIdRef.current,
          card_number: encryptedPan,
          exp_month: card.expirationMonth,
          exp_year: card.expirationYear,
          cvc: encryptedCvc,
          billing,
        });
        if (!pm || typeof pm.id !== 'string') {
          throw frameError(ErrorCodes.PAYMENT_METHOD_FAILED, 'Frame returned no payment method id.');
        }
        paymentMethodId = pm.id;
      }

      const transfer = await client.sdk.transfers.create({
        amount,
        account_id: accountIdRef.current,
        currency: currency.toLowerCase(),
        source_payment_method_id: paymentMethodId,
      });
      if (!transfer || typeof transfer.id !== 'string') {
        throw frameError(ErrorCodes.PAYMENT_FAILED, 'Frame returned no transfer id.');
      }
      cardFieldRef.current?.reset();
      return transfer.id;
    } finally {
      performingRef.current = false;
      dispatch({ type: 'SET_PERFORMING_ACTION', value: false });
    }
  }, [amount, currency, cardFieldRef]);

  return {
    state,
    dispatch,
    hasUsableInput: hasUsablePaymentInput(state),
    isUsingSaved: isUsingSavedCard(state),
    shouldShowAddress: state.addressMode !== 'hidden',
    submit,
  };
}

// Resolve Evervault from the JS cache populated by Frame.initialize. If the
// cache wasn't filled (rare race), fetch it on demand via the SDK. Memoization
// inside configureEvervault prevents double-init.
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
