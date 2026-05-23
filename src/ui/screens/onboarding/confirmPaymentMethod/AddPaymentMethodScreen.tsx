import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { PaymentCardField, type PaymentCardFieldHandle } from '../../../primitives/PaymentCardField';
import { BillingAddressDetailView } from '../../../primitives/BillingAddressDetailView';
import { ApplePayButton } from '../../../primitives/ApplePayButton';
import { canMakeApplePay } from '../../../../applePay';
import { getApplePayMerchantId } from '../../../../config';
import { showToast } from '../../../primitives/toastCenter';
import type { OnboardingAddress, OnboardingState } from '../onboardingReducer';

// AddPaymentMethod — two modes:
//   1. Full card-entry (default): card field + US billing address. iOS shows
//      an Apple Pay add-to-owner row at the top when the merchant is configured.
//   2. addressVerificationOnly: address fields only. Continue patches the
//      existing selected card's billing via paymentMethods.update.

export interface AddPaymentMethodScreenProps {
  state: OnboardingState;
  onChangeAddressField: (field: keyof OnboardingAddress, value: string) => void;
  /** Card-entry mode. Submits PAN/expiry/CVC; returns the new PM id. */
  onSubmitNewCard: (card: {
    pan: string;
    expirationMonth: string;
    expirationYear: string;
    cvc: string;
  }) => Promise<string>;
  /** Address-only mode. Patches the saved card's billing. */
  onSubmitAddressOnly: (paymentMethodId: string) => Promise<void>;
  /** Apple Pay add-to-owner. iOS only. */
  onAddApplePay: () => Promise<string>;
}

export function AddPaymentMethodScreen({
  state,
  onChangeAddressField,
  onSubmitNewCard,
  onSubmitAddressOnly,
  onAddApplePay,
}: AddPaymentMethodScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cardFieldRef = useRef<PaymentCardFieldHandle | null>(null);
  const isAddressOnly = state.addressVerificationOnly;

  const [applePayReady, setApplePayReady] = useState(false);
  useEffect(() => {
    if (isAddressOnly || Platform.OS !== 'ios') return;
    if (!getApplePayMerchantId()) return;
    let cancelled = false;
    (async () => {
      const ready = await canMakeApplePay();
      if (!cancelled) setApplePayReady(ready);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAddressOnly]);

  const showApplePay = applePayReady && !isAddressOnly;

  async function handleSubmit() {
    if (isAddressOnly) {
      if (!state.selectedPaymentMethodId) {
        showToast('No saved card selected.');
        return;
      }
      try {
        await onSubmitAddressOnly(state.selectedPaymentMethodId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not update billing.';
        showToast(message);
      }
      return;
    }

    const cardErrors = cardFieldRef.current?.validate() ?? null;
    if (cardErrors) {
      const first = cardErrors.pan ?? cardErrors.expiry ?? cardErrors.cvc ?? 'Enter valid card details.';
      showToast(first);
      return;
    }
    const values = cardFieldRef.current!.getValues();
    try {
      await onSubmitNewCard({
        pan: values.pan,
        expirationMonth: values.expirationMonth,
        expirationYear: values.expirationYear,
        cvc: values.cvc,
      });
      cardFieldRef.current?.reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save card.';
      showToast(message);
    }
  }

  async function handleApplePay() {
    try {
      await onAddApplePay();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Apple Pay add failed.';
      showToast(message);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
          {isAddressOnly ? 'Confirm Billing Address' : 'Add New Payment Method'}
        </Text>

        {showApplePay ? (
          <View style={styles.applePayBlock}>
            <ApplePayButton buttonType="setUp" onPress={handleApplePay} />
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: theme.colors.surfaceStroke }]} />
              <Text style={[styles.orLabel, { color: theme.colors.textSecondary }]}>Or</Text>
              <View style={[styles.orLine, { backgroundColor: theme.colors.surfaceStroke }]} />
            </View>
          </View>
        ) : null}

        {!isAddressOnly ? (
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: theme.colors.textPrimary,
                  fontSize: theme.fonts.headline.size,
                  fontWeight: theme.fontWeights.headline,
                  lineHeight: theme.fontLineHeights.headline,
                },
              ]}
            >
              Card Information
            </Text>
            <PaymentCardField ref={cardFieldRef} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.colors.textPrimary,
                fontSize: theme.fonts.headline.size,
                fontWeight: theme.fontWeights.headline,
                lineHeight: theme.fontLineHeights.headline,
              },
            ]}
          >
            Billing Address
          </Text>
          <BillingAddressDetailView
            address={state.address}
            errors={state.fieldErrors}
            onChangeField={onChangeAddressField}
            international={false}
          />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          text="Continue"
          enabled={!state.isPerformingAction}
          isLoading={state.isPerformingAction}
          onPress={handleSubmit}
        />
      </View>
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    heading: {
      marginTop: 8,
      marginBottom: 16,
    },
    applePayBlock: {
      marginBottom: 8,
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
      marginBottom: 8,
    },
    footer: {
      paddingHorizontal: 24,
      paddingVertical: 24,
    },
  });
}
