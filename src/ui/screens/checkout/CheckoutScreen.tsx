import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFrameTheme } from '../../theme/ThemeContext';
import { BottomSheet } from '../../primitives/BottomSheet';
import { Button } from '../../primitives/Button';
import { ValidatedTextField } from '../../primitives/ValidatedTextField';
import { PaymentMethodRow } from '../../primitives/PaymentMethodRow';
import { PaymentCardField, type PaymentCardFieldHandle } from '../../primitives/PaymentCardField';
import { ApplePayButton } from '../../primitives/ApplePayButton';
import { GooglePayButton } from '../../primitives/GooglePayButton';
import { convertCentsToCurrencyString } from '../../../currency';
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
  onFail: (error: unknown) => void;
  // Wallet buttons fire callbacks; the host wires these into Frame.presentApplePay
  // / Frame.presentGooglePay from outside the modal (the wallet flow runs as
  // its own modal, not embedded in Checkout).
  showApplePay?: boolean;
  showGooglePay?: boolean;
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
  const vm = useCheckoutViewModel({ accountId, amount, currency, addressMode, cardFieldRef });
  const styles = useMemo(() => createStyles(theme), [theme]);

  const showWalletRow = (showApplePay && onApplePay) || (showGooglePay && onGooglePay);

  async function handlePay() {
    try {
      const transferId = await vm.submit();
      onSuccess(transferId);
    } catch (err) {
      onFail(err);
    }
  }

  return (
    <BottomSheet title={title} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {showWalletRow ? (
          <View style={styles.walletSection}>
            {showApplePay && onApplePay ? <ApplePayButton onPress={onApplePay} /> : null}
            {showGooglePay && onGooglePay ? <GooglePayButton onPress={onGooglePay} /> : null}
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
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Saved payment methods
            </Text>
            <View style={styles.rowList}>
              {vm.state.accountPaymentOptions.map((pm) => (
                <PaymentMethodRow
                  key={pm.id}
                  title={savedMethodTitle(pm)}
                  subtitle={savedMethodSubtitle(pm) ?? undefined}
                  selected={vm.state.selectedAccountPaymentOptionId === pm.id}
                  onPress={() => vm.dispatch({ type: 'SELECT_SAVED_OPTION', id: pm.id })}
                />
              ))}
              <PaymentMethodRow
                title="Enter New Payment Method"
                selected={vm.state.selectedAccountPaymentOptionId === null}
                onPress={() => vm.dispatch({ type: 'SELECT_SAVED_OPTION', id: null })}
              />
            </View>
          </View>
        ) : null}

        {!vm.isUsingSaved ? (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Customer information</Text>
              <ValidatedTextField
                prompt="Full name"
                value={vm.state.customerName}
                onChangeText={(v) => vm.dispatch({ type: 'SET_CUSTOMER_NAME', value: v })}
                error={vm.state.fieldErrors.customerName}
                autoCapitalize="words"
              />
              <ValidatedTextField
                prompt="Email"
                value={vm.state.customerEmail}
                onChangeText={(v) => vm.dispatch({ type: 'SET_CUSTOMER_EMAIL', value: v })}
                error={vm.state.fieldErrors.customerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Card information</Text>
              <PaymentCardField
                ref={cardFieldRef}
                onChange={({ complete }) => vm.dispatch({ type: 'SET_CARD_COMPLETE', value: complete })}
              />
            </View>

            {vm.shouldShowAddress ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Billing address</Text>
                <ValidatedTextField
                  prompt="Address line 1"
                  value={vm.state.address.line1}
                  onChangeText={(v) => vm.dispatch({ type: 'SET_ADDRESS_FIELD', field: 'line1', value: v })}
                  error={vm.state.fieldErrors.addressLine1}
                  autoCapitalize="words"
                />
                <ValidatedTextField
                  prompt="Address line 2 (optional)"
                  value={vm.state.address.line2}
                  onChangeText={(v) => vm.dispatch({ type: 'SET_ADDRESS_FIELD', field: 'line2', value: v })}
                  autoCapitalize="words"
                />
                <View style={styles.addressRow}>
                  <View style={styles.addressCell}>
                    <ValidatedTextField
                      prompt="City"
                      value={vm.state.address.city}
                      onChangeText={(v) => vm.dispatch({ type: 'SET_ADDRESS_FIELD', field: 'city', value: v })}
                      error={vm.state.fieldErrors.addressCity}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={styles.addressCell}>
                    <ValidatedTextField
                      prompt="State"
                      value={vm.state.address.state}
                      onChangeText={(v) => vm.dispatch({ type: 'SET_ADDRESS_FIELD', field: 'state', value: v })}
                      error={vm.state.fieldErrors.addressState}
                      autoCapitalize="characters"
                      characterLimit={2}
                    />
                  </View>
                </View>
                <ValidatedTextField
                  prompt={vm.state.address.country === 'US' ? 'Zip code' : 'Postal code'}
                  value={vm.state.address.postalCode}
                  onChangeText={(v) =>
                    vm.dispatch({ type: 'SET_ADDRESS_FIELD', field: 'postalCode', value: v })
                  }
                  error={vm.state.fieldErrors.addressPostalCode}
                  keyboardType={vm.state.address.country === 'US' ? 'number-pad' : 'default'}
                />
              </View>
            ) : null}

            <View style={styles.saveCardRow}>
              <Text style={[styles.saveCardLabel, { color: theme.colors.textPrimary }]}>
                Save card for future payments
              </Text>
              <Switch
                value={vm.state.saveCard}
                onValueChange={(v) => vm.dispatch({ type: 'SET_SAVE_CARD', value: v })}
              />
            </View>
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

function savedMethodTitle(pm: { card?: { brand?: string; last_four?: string } | undefined; type?: string }): string {
  if (pm.card && pm.card.last_four) {
    const brand = pm.card.brand ? prettyBrand(pm.card.brand) : 'Card';
    return `${brand} •••• ${pm.card.last_four}`;
  }
  return 'Saved card';
}

function savedMethodSubtitle(pm: { card?: { exp_month?: string; exp_year?: string } | undefined }): string | null {
  if (pm.card?.exp_month && pm.card?.exp_year) {
    return `Exp ${pm.card.exp_month}/${pm.card.exp_year}`;
  }
  return null;
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
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    rowList: {
      gap: 8,
    },
    addressRow: {
      flexDirection: 'row',
      gap: 12,
    },
    addressCell: {
      flex: 1,
    },
    saveCardRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    saveCardLabel: {
      fontSize: 14,
    },
    payButton: {
      marginTop: 8,
    },
  });
}
