import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { ValidatedTextField } from '../../../primitives/ValidatedTextField';
import { DropDown } from '../../../primitives/DropDown';
import { BillingAddressDetailView } from '../../../primitives/BillingAddressDetailView';
import { isPlaidAvailable } from '../../../../plaid';
import { showToast } from '../../../primitives/toastCenter';
import type {
  AchAccountType,
  OnboardingAch,
  OnboardingAddress,
  OnboardingState,
} from '../onboardingReducer';

// Add a payout method. Two paths:
//   - Plaid Connect (preferred when react-native-plaid-link-sdk is installed)
//   - Manual ACH form (routing 9-digit + ABA, account 4–17 digits, account
//     type dropdown, US billing address)
//
// "Enter manually" is always available; "Connect with Plaid" only when the
// SDK is linked.

const ACCOUNT_TYPE_OPTIONS: ReadonlyArray<{ value: AchAccountType; label: string }> = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
];

export interface AddPayoutMethodScreenProps {
  state: OnboardingState;
  onChangeAchField: (field: keyof Omit<OnboardingAch, 'accountType'>, value: string) => void;
  onChangeAchAccountType: (value: AchAccountType) => void;
  onChangeManualMode: (value: boolean) => void;
  onChangeAddressField: (field: keyof OnboardingAddress, value: string) => void;
  onOpenPlaidLink: () => Promise<string>;
  onSubmitManualAch: () => Promise<string>;
}

export function AddPayoutMethodScreen({
  state,
  onChangeAchField,
  onChangeAchAccountType,
  onChangeManualMode,
  onChangeAddressField,
  onOpenPlaidLink,
  onSubmitManualAch,
}: AddPayoutMethodScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const plaidAvailable = isPlaidAvailable();
  const manual = state.achManualMode;

  async function handlePlaid() {
    try {
      await onOpenPlaidLink();
    } catch (err) {
      // frameError always attaches a `code`; non-Frame errors won't, and the
      // optional access flows to the toast fallback.
      const code = (err as { code?: string }).code;
      // USER_CANCELED is silent — the user backed out intentionally. Other
      // failures surface as toasts so the user knows the attempt didn't take.
      if (code === 'USER_CANCELED') return;
      const message = err instanceof Error ? err.message : 'Could not connect with Plaid.';
      showToast(message);
    }
  }

  async function handleManualSubmit() {
    try {
      await onSubmitManualAch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save bank account.';
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
          Add Bank Account
        </Text>

        {plaidAvailable ? (
          <View style={styles.plaidBlock}>
            <Button
              text="Connect Bank Account"
              enabled={!state.isPerformingAction}
              isLoading={state.isPerformingAction}
              onPress={handlePlaid}
            />
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: theme.colors.surfaceStroke }]} />
              <Text style={[styles.orLabel, { color: theme.colors.textSecondary }]}>Or</Text>
              <View style={[styles.orLine, { backgroundColor: theme.colors.surfaceStroke }]} />
            </View>
          </View>
        ) : null}

        {!manual ? (
          <Button
            text="Enter manually"
            variant="secondary"
            onPress={() => onChangeManualMode(true)}
          />
        ) : (
          <>
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
                Bank Details
              </Text>
              <ValidatedTextField
                prompt="Routing Number"
                value={state.ach.routingNumber}
                onChangeText={(v) => onChangeAchField('routingNumber', v)}
                error={state.fieldErrors['ach.routingNumber']}
                keyboardType="number-pad"
                characterLimit={9}
              />
              <ValidatedTextField
                prompt="Account Number"
                value={state.ach.accountNumber}
                onChangeText={(v) => onChangeAchField('accountNumber', v)}
                error={state.fieldErrors['ach.accountNumber']}
                keyboardType="number-pad"
                characterLimit={17}
                secureTextEntry
              />
              <DropDown
                prompt="Account Type"
                options={ACCOUNT_TYPE_OPTIONS}
                selected={state.ach.accountType}
                onSelect={onChangeAchAccountType}
                testID="onboarding.ach.account_type"
              />
            </View>

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
          </>
        )}
      </ScrollView>
      {manual ? (
        <View style={styles.footer}>
          <Button
            text="Add Bank Account"
            enabled={!state.isPerformingAction}
            isLoading={state.isPerformingAction}
            onPress={handleManualSubmit}
          />
        </View>
      ) : null}
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
    plaidBlock: {
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
