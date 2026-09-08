import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../theme/ThemeContext';
import { BottomSheet } from '../../primitives/BottomSheet';
import { Button } from '../../primitives/Button';
import { ValidatedTextField } from '../../primitives/ValidatedTextField';
import { PaymentMethodRow } from '../../primitives/PaymentMethodRow';
import { PaymentCardField, type PaymentCardFieldHandle } from '../../primitives/PaymentCardField';
import { ApplePayButton } from '../../primitives/ApplePayButton';
import { GooglePayButton } from '../../primitives/GooglePayButton';
import { CountryPicker } from '../../primitives/CountryPicker';
import { Checkbox } from '../../primitives/Checkbox';
import { Icon, type IconName } from '../../assets';
import { convertCentsToCurrencyString } from '../../../currency';
import { addressFormatForCountry } from '../../../addressFormat';
import { showToast } from '../../primitives/toastCenter';
import { toToastMessage, isUnrecoverableCheckoutError } from '../../../api-errors';
import { isFrameError, normalizeToFrameError, ErrorCodes } from '../../../errors';
import { presentApplePayFlow } from '../../../applePay';
import { presentGooglePayFlow } from '../../../googlePay';
import { ThreeDSecureChallenge } from '../../primitives/ThreeDSecureChallenge';
import type { ThreeDSecureChallengeResult } from '../../../threeDSecure';
import { useCheckoutViewModel } from './useCheckoutViewModel';
import type { AddressMode } from './checkoutReducer';

export interface CheckoutScreenProps {
  accountId: string;
  amount: number;
  currency?: string;
  addressMode?: AddressMode;
  title?: string;
  onSuccess: (transferId: string) => void;
  onClose: () => void;
  /**
   * Reserved for unrecoverable host-level failures — a missing secret key on a
   * server-only operation, the SDK not initialized, a missing/invalid account
   * or merchant ID. Errors the user can act on (a declined card, a validation
   * error, a transient network blip) are toasted internally and the sheet stays
   * open instead; this fires only when the flow can never succeed, so the host
   * app's `await Frame.presentCheckout(...)` doesn't hang forever on a Pay
   * button that no retry can fix.
   */
  onFail: (error: unknown) => void;
  /**
   * Render the Apple Pay button. Checkout runs the wallet charge itself against
   * `accountId` / `amount` / `currency`, matching iOS's embedded
   * `FrameApplePayButton(mode: .charge(...), owner: .account(...))`
   * (`Sources/Frame/Views/FrameCheckoutView.swift:164-167`) — the host does not
   * wire a callback.
   */
  showApplePay?: boolean;
  /** Render the Google Pay button. See {@link CheckoutScreenProps.showApplePay}. */
  showGooglePay?: boolean;
  /**
   * Overrides the built-in wallet charge. Only used by tests; production
   * callers leave these unset so checkout drives the wallet flow in-modal.
   */
  onApplePay?: () => void;
  onGooglePay?: () => void;
}

export function CheckoutScreen({
  accountId,
  amount,
  currency = 'USD',
  addressMode = 'required',
  title = 'Checkout',
  onSuccess,
  onClose,
  onFail,
  showApplePay = false,
  showGooglePay = false,
  onApplePay,
  onGooglePay,
}: CheckoutScreenProps) {
  const theme = useFrameTheme();
  const cardFieldRef = useRef<PaymentCardFieldHandle | null>(null);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [walletBusy, setWalletBusy] = useState(false);

  // The 3DS challenge is a modal this screen owns, but it is awaited from inside
  // the view model's submit. Park the resolver here so the WebView's outcome
  // settles the promise the confirm loop is waiting on.
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const challengeResolver = useRef<((r: ThreeDSecureChallengeResult) => void) | null>(null);

  const presentChallenge = useCallback(
    (url: string) =>
      new Promise<ThreeDSecureChallengeResult>((resolve) => {
        challengeResolver.current = resolve;
        setChallengeUrl(url);
      }),
    [],
  );

  const finishChallenge = useCallback((result: ThreeDSecureChallengeResult) => {
    setChallengeUrl(null);
    const resolve = challengeResolver.current;
    challengeResolver.current = null;
    resolve?.(result);
  }, []);

  // Settle any open challenge on unmount. Without this, dismissing the sheet
  // mid-challenge leaves the promise submit() is awaiting unresolved forever,
  // wedging the in-flight guard. 'failed' rather than 'unavailable': the
  // challenge did run, and the charge may still settle — the confirm loop then
  // polls for the real answer rather than treating it as a decline.
  useEffect(() => {
    return () => {
      const resolve = challengeResolver.current;
      challengeResolver.current = null;
      resolve?.('failed');
    };
  }, []);

  const vm = useCheckoutViewModel({
    accountId,
    amount,
    currency,
    addressMode,
    cardFieldRef,
    presentChallenge,
  });

  const showWalletRow = showApplePay || showGooglePay;
  // Per-country field labels, keyboard and length caps. Previously a US/non-US
  // binary, so a UK county or Japanese prefecture was labelled "State" and
  // truncated to two characters as the user typed.
  const addressFormat = addressFormatForCountry(vm.state.address.country);

  async function handlePay() {
    try {
      const transferId = await vm.submit();
      onSuccess(transferId);
    } catch (err) {
      // A merchant-integration misconfiguration (no secret key, SDK never
      // initialized, missing account/merchant id) can never be fixed by
      // retrying in this UI — report it so the host's presentCheckout promise
      // rejects instead of leaving a Pay button that will toast forever.
      if (isUnrecoverableCheckoutError(err)) {
        onFail(err);
        return;
      }
      // Everything else — card declined, validation, transient transport —
      // surfaces as a toast and leaves the sheet open so the user can correct
      // the input and retry. Tearing the modal down here would discard the
      // entered card and address for what is often a transient failure.
      // Mirrors iOS `FrameCheckoutView.swift:428-436`.
      showToast(toToastMessage(err));
    }
  }

  // Runs the wallet charge in-modal, exactly as iOS's embedded
  // FrameApplePayButton does. A cancel is silent; any other failure toasts and
  // keeps checkout open so the user can retry or fall through to card entry
  // (`FrameCheckoutView.swift:176-191`).
  async function runWallet(charge: () => Promise<string>, fallback: string) {
    if (walletBusy) return;
    setWalletBusy(true);
    try {
      onSuccess(await charge());
    } catch (err) {
      const code = isFrameError(err) ? err.code : normalizeToFrameError(err).code;
      if (code !== ErrorCodes.USER_CANCELED) showToast(toToastMessage(err, fallback));
    } finally {
      setWalletBusy(false);
    }
  }

  const handleApplePay =
    onApplePay ??
    (() =>
      void runWallet(
        () =>
          presentApplePayFlow({
            amount,
            currency: currency.toLowerCase(),
            owner: { type: 'account', id: accountId },
          }),
        'Apple Pay could not complete. Please try again or use a card.',
      ));

  const handleGooglePay =
    onGooglePay ??
    (() =>
      void runWallet(
        () =>
          presentGooglePayFlow({
            amountCents: amount,
            currencyCode: currency.toUpperCase(),
            owner: { type: 'account', id: accountId },
          }),
        'Google Pay could not complete. Please try again or use a card.',
      ));

  return (
    <BottomSheet title={title} onClose={onClose}>
      {challengeUrl ? (
        <ThreeDSecureChallenge challengeUrl={challengeUrl} onFinish={finishChallenge} />
      ) : null}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {showWalletRow ? (
          <View style={styles.walletSection}>
            {showApplePay ? <ApplePayButton onPress={handleApplePay} /> : null}
            {showGooglePay ? <GooglePayButton onPress={handleGooglePay} /> : null}
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: theme.colors.surfaceStroke }]} />
              <Text style={[styles.orLabel, { color: theme.colors.textSecondary }]}>Or</Text>
              <View style={[styles.orLine, { backgroundColor: theme.colors.surfaceStroke }]} />
            </View>
          </View>
        ) : null}

        {/* Saved payment methods */}
        {vm.state.accountPaymentOptions !== null && vm.state.accountPaymentOptions.length > 0 ? (
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.colors.textSecondary,
                  fontSize: theme.fonts.headline.size,
                  fontWeight: theme.fontWeights.headline,
                  lineHeight: theme.fontLineHeights.headline,
                },
              ]}
            >
              Saved Payment Methods
            </Text>
            <View style={styles.rowList}>
              {vm.state.accountPaymentOptions.map((pm) => (
                <PaymentMethodRow
                  key={pm.id}
                  title={savedMethodTitle(pm)}
                  subtitle={savedMethodSubtitle(pm) ?? undefined}
                  selected={vm.state.selectedAccountPaymentOptionId === pm.id}
                  onPress={() => vm.dispatch({ type: 'SELECT_SAVED_OPTION', id: pm.id })}
                  icon={<Icon name={savedMethodIconName(pm)} width={40} height={28} />}
                />
              ))}
              <PaymentMethodRow
                title="Enter New Payment Method"
                selected={vm.state.selectedAccountPaymentOptionId === null}
                onPress={() => vm.dispatch({ type: 'SELECT_SAVED_OPTION', id: null })}
                icon={<Icon name="empty-card" width={40} height={28} color={theme.colors.textPrimary} />}
              />
            </View>
          </View>
        ) : null}

        {/* Customer Information renders on BOTH paths. iOS keeps it outside
            the saved/new branch (FrameCheckoutView.swift:81-82) and validates
            name + email unconditionally, so hiding it for a saved card left
            the transfer carrying whatever those fields happened to hold. */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.fonts.headline.size,
                fontWeight: theme.fontWeights.headline,
                lineHeight: theme.fontLineHeights.headline,
              },
            ]}
          >
            Customer Information
          </Text>
          <View
            style={[
              styles.fieldContainer,
              {
                borderColor: theme.colors.surfaceStroke,
                borderRadius: theme.radii.medium,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <ValidatedTextField
              prompt="Customer Name"
              value={vm.state.customerName}
              onChangeText={(v) => vm.dispatch({ type: 'SET_CUSTOMER_NAME', value: v })}
              error={vm.state.fieldErrors.customerName}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              inputRestriction="textOnly"
              borderless
            />
            <View style={[styles.hDivider, { backgroundColor: theme.colors.surfaceStroke }]} />
            <ValidatedTextField
              prompt="Customer Email"
              value={vm.state.customerEmail}
              onChangeText={(v) => vm.dispatch({ type: 'SET_CUSTOMER_EMAIL', value: v })}
              error={vm.state.fieldErrors.customerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
              autoComplete="email"
              borderless
            />
          </View>
        </View>

        {/* Held back until the saved-methods fetch settles, so a returning
            user doesn't see this form flash before their saved card is
            auto-selected. iOS gates on didLoadAccountPaymentMethods
            (FrameCheckoutView.swift:83-85). */}
        {vm.state.didLoadPaymentOptions && !vm.isUsingSaved ? (
          <>
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: theme.colors.textSecondary,
                    fontSize: theme.fonts.headline.size,
                    fontWeight: theme.fontWeights.headline,
                    lineHeight: theme.fontLineHeights.headline,
                  },
                ]}
              >
                Card Information
              </Text>
              <PaymentCardField
                ref={cardFieldRef}
                onChange={({ complete }) => vm.dispatch({ type: 'SET_CARD_COMPLETE', value: complete })}
              />
            </View>

            {vm.shouldShowAddress ? (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: theme.colors.textSecondary,
                      fontSize: theme.fonts.headline.size,
                      fontWeight: theme.fontWeights.headline,
                      lineHeight: theme.fontLineHeights.headline,
                    },
                  ]}
                >
                  Billing Address
                </Text>
                <View
                  style={[
                    styles.fieldContainer,
                    {
                      borderColor: theme.colors.surfaceStroke,
                      borderRadius: theme.radii.medium,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                >
                  <ValidatedTextField
                    prompt="Address Line 1"
                    value={vm.state.address.line1}
                    onChangeText={(v) => vm.dispatch({ type: 'SET_ADDRESS_FIELD', field: 'line1', value: v })}
                    error={vm.state.fieldErrors.addressLine1}
                    autoCapitalize="words"
                    textContentType="streetAddressLine1"
                    autoComplete="address-line1"
                    borderless
                  />
                  <View style={[styles.hDivider, { backgroundColor: theme.colors.surfaceStroke }]} />
                  <ValidatedTextField
                    prompt="Address Line 2"
                    value={vm.state.address.line2}
                    onChangeText={(v) => vm.dispatch({ type: 'SET_ADDRESS_FIELD', field: 'line2', value: v })}
                    autoCapitalize="words"
                    textContentType="streetAddressLine2"
                    autoComplete="address-line2"
                    borderless
                  />
                  <View style={[styles.hDivider, { backgroundColor: theme.colors.surfaceStroke }]} />
                  <View style={styles.addressRow}>
                    <View style={styles.addressCell}>
                      <ValidatedTextField
                        prompt="City"
                        value={vm.state.address.city}
                        onChangeText={(v) =>
                          vm.dispatch({ type: 'SET_ADDRESS_FIELD', field: 'city', value: v })
                        }
                        error={vm.state.fieldErrors.addressCity}
                        autoCapitalize="words"
                        textContentType="addressCity"
                        autoComplete="postal-address-locality"
                        inputRestriction="textOnly"
                        borderless
                      />
                    </View>
                    <View style={[styles.vDivider, { backgroundColor: theme.colors.surfaceStroke }]} />
                    <View style={styles.addressCell}>
                      <ValidatedTextField
                        prompt={addressFormat.stateLabel}
                        value={vm.state.address.state}
                        onChangeText={(v) =>
                          vm.dispatch({ type: 'SET_ADDRESS_FIELD', field: 'state', value: v })
                        }
                        error={vm.state.fieldErrors.addressState}
                        autoCapitalize="characters"
                        textContentType="addressState"
                        autoComplete="postal-address-region"
                        inputRestriction="textOnly"
                        characterLimit={addressFormat.stateMaxLength}
                        borderless
                      />
                    </View>
                  </View>
                  <View style={[styles.hDivider, { backgroundColor: theme.colors.surfaceStroke }]} />
                  <View style={styles.countryRow}>
                    <CountryPicker
                      selectedAlpha2={vm.state.address.country}
                      onSelect={(c) =>
                        vm.dispatch({
                          type: 'SET_ADDRESS_FIELD',
                          field: 'country',
                          value: c.alpha2Code,
                        })
                      }
                    />
                  </View>
                  <View style={[styles.hDivider, { backgroundColor: theme.colors.surfaceStroke }]} />
                  <ValidatedTextField
                    prompt={addressFormat.postalLabel}
                    value={vm.state.address.postalCode}
                    onChangeText={(v) =>
                      vm.dispatch({ type: 'SET_ADDRESS_FIELD', field: 'postalCode', value: v })
                    }
                    error={vm.state.fieldErrors.addressPostalCode}
                    keyboardType={addressFormat.postalKeyboard}
                    textContentType="postalCode"
                    autoComplete="postal-code"
                    characterLimit={vm.state.address.country === 'US' ? 5 : undefined}
                    borderless
                  />
                </View>
              </View>
            ) : null}

            {/* A checkbox, not a switch: iOS applies iOSCheckboxToggleStyle to
                this control (FrameCheckoutView.swift:400-411), and Checkbox
                already exists here to match it. */}
            <Checkbox
              style={styles.saveCardRow}
              value={vm.state.saveCard}
              onValueChange={(v) => vm.dispatch({ type: 'SET_SAVE_CARD', value: v })}
              accessibilityLabel="Save this card for future payments"
              label={
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: theme.fonts.headline.size,
                    fontWeight: theme.fontWeights.headline,
                    lineHeight: theme.fontLineHeights.headline,
                  }}
                >
                  Save this card for future payments
                </Text>
              }
            />
          </>
        ) : null}

        <Button
          text={`Pay ${convertCentsToCurrencyString(amount, currency)}`}
          variant="primary"
          enabled={vm.hasUsableInput && !vm.state.isPerformingAction}
          isLoading={vm.state.isPerformingAction}
          onPress={handlePay}
          style={styles.payButton}
        />
      </ScrollView>
    </BottomSheet>
  );
}

interface SavedMethod {
  card?: { brand?: string; last_four?: string; exp_month?: string; exp_year?: string };
  ach?: { last_four?: string; account_type?: string };
  type?: string;
}

function isAch(pm: SavedMethod): boolean {
  return pm.type === 'ach' || pm.ach !== undefined;
}

function savedMethodTitle(pm: SavedMethod): string {
  // ACH rows used to fall through to 'Saved card' with a credit-card icon,
  // because only the card branch existed. iOS branches on the type
  // (FramePaymentMethodRow.swift:73-80).
  if (isAch(pm)) {
    return pm.ach?.last_four ? `Bank •••• ${pm.ach.last_four}` : 'Bank account';
  }
  if (pm.card && pm.card.last_four) {
    const brand = pm.card.brand ? prettyBrand(pm.card.brand) : 'Card';
    return `${brand} •••• ${pm.card.last_four}`;
  }
  return 'Saved card';
}

function savedMethodSubtitle(pm: SavedMethod): string | null {
  if (isAch(pm)) {
    const type = pm.ach?.account_type;
    return type ? `${type.charAt(0).toUpperCase()}${type.slice(1)} Account` : null;
  }
  if (pm.card?.exp_month && pm.card?.exp_year) {
    return `Exp. ${pm.card.exp_month}/${pm.card.exp_year}`;
  }
  return null;
}

function savedMethodIconName(pm: SavedMethod): IconName {
  return isAch(pm) ? 'bank-icon' : brandIconName(pm.card?.brand);
}

function brandIconName(brand: string | undefined): IconName {
  switch ((brand ?? '').toLowerCase()) {
    case 'visa':
      return 'visa';
    case 'mastercard':
      return 'mastercard';
    case 'amex':
      return 'amex';
    case 'discover':
      return 'discover';
    default:
      return 'credit-card';
  }
}

function prettyBrand(brand: string): string {
  switch (brand.toLowerCase()) {
    case 'amex':
      return 'Amex';
    case 'visa':
      return 'Visa';
    case 'mastercard':
      return 'Mastercard';
    case 'discover':
      return 'Discover';
    case 'diners':
      return 'Diners';
    case 'jcb':
      return 'JCB';
    case 'unionpay':
      return 'UnionPay';
    default:
      return brand;
  }
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    walletSection: {
      paddingTop: 4,
      paddingBottom: 16,
    },
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
      gap: 8,
    },
    orLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
    },
    orLabel: {
      fontSize: 12,
      textTransform: 'uppercase',
    },
    section: {
      marginBottom: 16,
      gap: 12,
    },
    sectionTitle: {},
    fieldContainer: {
      borderWidth: 1,
      overflow: 'hidden',
    },
    hDivider: {
      height: StyleSheet.hairlineWidth,
      width: '100%',
    },
    vDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
    },
    rowList: {
      gap: 8,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    addressCell: {
      flex: 1,
    },
    countryRow: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    saveCardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
    },
    payButton: {
      marginTop: 8,
    },
  });
}
