import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { PaymentMethodRow } from '../../../primitives/PaymentMethodRow';
import { Icon } from '../../../assets';
import type { OnboardingState } from '../onboardingReducer';
import { FORM_SPACING } from '../formSpacing';

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
          Select A Payout Method
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
          Choose a saved payout method or add a new one to continue
        </Text>

        {state.savedPayoutMethods.length > 0 ? (
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
              Saved Payout Methods
            </Text>
            <View style={styles.list}>
              {state.savedPayoutMethods.map((pm) => (
                <PaymentMethodRow
                  key={pm.id}
                  title={achTitle(pm)}
                  subtitle={achSubtitle(pm) ?? undefined}
                  selected={state.selectedPayoutMethodId === pm.id}
                  onPress={() => onSelectMethod(pm.id)}
                  icon={<Icon name="bank-icon" width={40} height={28} color={theme.colors.textPrimary} />}
                  testID={`onboarding.payout.${pm.id}`}
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
          Add Payout Method
        </Text>
        <View style={styles.list}>
          <PaymentMethodRow
            title="Bank Account (ACH)"
            selected={isAddNewSelected}
            onPress={() => onSelectMethod(null)}
            icon={<Icon name="empty-card" width={40} height={28} color={theme.colors.textPrimary} />}
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

function achSubtitle(pm: { ach?: { account_type?: string } | undefined }): string | null {
  // Mirrors iOS SelectPayoutMethodView: "{Type} Account" (e.g. "Checking Account").
  const type = pm.ach?.account_type;
  if (type) return `${prettyAccountType(type)} Account`;
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
      paddingHorizontal: FORM_SPACING.contentHorizontal,
      paddingBottom: FORM_SPACING.contentBottom,
    },
    heading: {
      marginTop: FORM_SPACING.headingTop,
    },
    body: {
      marginTop: FORM_SPACING.headingTop,
      marginBottom: FORM_SPACING.subheadBottom,
    },
    sectionHeader: {
      marginTop: FORM_SPACING.sectionBottom,
      marginBottom: 8,
    },
    list: {
      gap: 8,
    },
    footer: {
      paddingHorizontal: FORM_SPACING.footerHorizontal,
      paddingVertical: FORM_SPACING.footerVertical,
    },
  });
}
