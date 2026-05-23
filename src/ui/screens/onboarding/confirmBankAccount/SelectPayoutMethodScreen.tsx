import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { PaymentMethodRow } from '../../../primitives/PaymentMethodRow';
import type { OnboardingState } from '../onboardingReducer';

// Select a saved ACH payout method or add a new bank account. Parent owns the
// Continue routing.

export interface SelectPayoutMethodScreenProps {
  state: OnboardingState;
  onLoadMethods: () => Promise<void>;
  onSelectMethod: (id: string | null) => void;
  onContinue: () => void;
}

export function SelectPayoutMethodScreen({
  state,
  onLoadMethods,
  onSelectMethod,
  onContinue,
}: SelectPayoutMethodScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    void onLoadMethods();
  }, [onLoadMethods]);

  const isAddNewSelected = state.selectedPayoutMethodId === null;

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
          Confirm your payout method
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
          Choose where you'd like to receive payouts.
        </Text>

        <View style={styles.list}>
          {state.savedPayoutMethods.map((pm) => (
            <PaymentMethodRow
              key={pm.id}
              title={achTitle(pm)}
              subtitle={achSubtitle(pm) ?? undefined}
              selected={state.selectedPayoutMethodId === pm.id}
              onPress={() => onSelectMethod(pm.id)}
              testID={`onboarding.payout.${pm.id}`}
            />
          ))}
          <PaymentMethodRow
            title="Bank account (ACH)"
            subtitle="Connect via Plaid or enter manually"
            selected={isAddNewSelected}
            onPress={() => onSelectMethod(null)}
            testID="onboarding.payout.add_new"
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

function achTitle(pm: { ach?: { bank_name?: string; last_four?: string } | undefined }): string {
  const last4 = pm.ach?.last_four;
  if (last4) return `•••• ${last4}`;
  return 'Bank account';
}

function achSubtitle(pm: { ach?: { bank_name?: string; account_type?: string } | undefined }): string | null {
  const bank = pm.ach?.bank_name;
  const type = pm.ach?.account_type;
  if (bank && type) return `${bank} · ${prettyAccountType(type)}`;
  if (bank) return bank;
  if (type) return prettyAccountType(type);
  return null;
}

function prettyAccountType(raw: string): string {
  switch (raw.toLowerCase()) {
    case 'checking':
      return 'Checking';
    case 'savings':
      return 'Savings';
    default:
      return raw;
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
    list: {
      gap: 8,
    },
    footer: {
      paddingHorizontal: 24,
      paddingVertical: 24,
    },
  });
}
