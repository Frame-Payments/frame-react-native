import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { PaymentMethodRow } from '../../../primitives/PaymentMethodRow';
import { Icon, type IconName } from '../../../assets';
import type { OnboardingState } from '../onboardingReducer';

// Select a saved card or add a new one. The Continue handler is owned by the
// parent (OnboardingRoot in 8h) because the routing depends on capabilities:
//   - card_verification requested → start 3DS
//   - address_verification requested + selected card lacks billing → add
//     billing via AddPaymentMethod in addressVerificationOnly mode
//   - else → advance to the next onboarding step

const ADD_NEW_SENTINEL = '__add_new__';

export interface SelectPaymentMethodScreenProps {
  state: OnboardingState;
  onLoadMethods: () => Promise<void>;
  onSelectMethod: (id: string | null) => void;
  onContinue: () => void;
}

export function SelectPaymentMethodScreen({
  state,
  onLoadMethods,
  onSelectMethod,
  onContinue,
}: SelectPaymentMethodScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Fire-and-forget load on mount. Failures stay silent (the catch in the VM
  // sets savedPaymentMethods=[] so the UI still functions).
  useEffect(() => {
    void onLoadMethods();
  }, [onLoadMethods]);

  // `selectedPaymentMethodId === null` always means "Debit/Credit card" is
  // the active choice — the row visually reflects it and Continue routes to
  // AddPaymentMethod. This screen only renders when sub-step === 'select',
  // so no extra sub-step gate is needed.
  const isAddNewSelected = state.selectedPaymentMethodId === null;

  function selectAddNew() {
    onSelectMethod(null);
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
          Select A Payment Method
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
          Choose a saved payment method or add a new one to continue
        </Text>

        {state.savedPaymentMethods.length > 0 ? (
          <>
            <Text
              style={[
                styles.sectionHeader,
                {
                  color: theme.colors.textPrimary,
                  fontSize: theme.fonts.bodySmall.size,
                  fontWeight: theme.fontWeights.label,
                },
              ]}
            >
              Saved Payment Methods
            </Text>
            <View style={styles.list}>
              {state.savedPaymentMethods.map((pm) => (
                <PaymentMethodRow
                  key={pm.id}
                  title={cardTitle(pm)}
                  subtitle={cardSubtitle(pm) ?? undefined}
                  selected={state.selectedPaymentMethodId === pm.id}
                  onPress={() => onSelectMethod(pm.id)}
                  icon={<Icon name={brandIconName(pm.card?.brand)} width={40} height={28} />}
                  testID={`onboarding.pm.${pm.id}`}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text
          style={[
            styles.sectionHeader,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.bodySmall.size,
              fontWeight: theme.fontWeights.label,
            },
          ]}
        >
          Add Payment Method
        </Text>
        <View style={styles.list}>
          <PaymentMethodRow
            title="Debit/Credit Card"
            selected={isAddNewSelected}
            onPress={selectAddNew}
            icon={<Icon name="empty-card" width={40} height={28} color={theme.colors.textPrimary} />}
            testID={`onboarding.pm.${ADD_NEW_SENTINEL}`}
          />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          text="Continue"
          enabled={!state.isPerformingAction}
          isLoading={state.isPerformingAction}
          onPress={onContinue}
        />
      </View>
    </View>
  );
}

function cardTitle(pm: { card?: { brand?: string; last_four?: string } | undefined }): string {
  if (pm.card?.last_four) {
    const brand = pm.card.brand ? prettyBrand(pm.card.brand) : 'Card';
    return `${brand} •••• ${pm.card.last_four}`;
  }
  return 'Saved card';
}

function cardSubtitle(pm: { card?: { exp_month?: string; exp_year?: string } | undefined }): string | null {
  if (pm.card?.exp_month && pm.card?.exp_year) {
    return `Exp ${pm.card.exp_month}/${pm.card.exp_year}`;
  }
  return null;
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
    case 'amex': return 'Amex';
    case 'visa': return 'Visa';
    case 'mastercard': return 'Mastercard';
    case 'discover': return 'Discover';
    case 'diners': return 'Diners';
    case 'jcb': return 'JCB';
    case 'unionpay': return 'UnionPay';
    default: return brand;
  }
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
    },
    body: {
      marginTop: 8,
      marginBottom: 16,
    },
    sectionHeader: {
      marginTop: 16,
      marginBottom: 8,
    },
    list: {
      gap: 8,
    },
    footer: {
      paddingHorizontal: 24,
      paddingVertical: 24,
    },
  });
}
