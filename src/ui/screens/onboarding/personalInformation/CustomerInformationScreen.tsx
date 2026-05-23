import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { ValidatedTextField } from '../../../primitives/ValidatedTextField';
import { DobInputField } from '../../../primitives/DobInputField';
import { BillingAddressDetailView } from '../../../primitives/BillingAddressDetailView';
import { requiresDobInPhoneAuth } from '../onboardingSelectors';
import type { OnboardingCapability } from '../../../../types';
import type { OnboardingAddress, OnboardingState } from '../onboardingReducer';

// CustomerInformation — name, email, optional DOB (when not collected in
// phone-auth), SSN-last-4 (when kyc/kyc_prefill is requested), and the
// international BillingAddressDetailView.

export interface CustomerInformationScreenProps {
  capabilities: ReadonlyArray<OnboardingCapability>;
  state: OnboardingState;
  onChangeFirstName: (value: string) => void;
  onChangeLastName: (value: string) => void;
  onChangeEmail: (value: string) => void;
  onChangeDob: (next: { month: string; day: string; year: string }) => void;
  onChangeSsn: (value: string) => void;
  onChangeAddressField: (field: keyof OnboardingAddress, value: string) => void;
  onSubmit: () => void;
}

export function CustomerInformationScreen({
  capabilities,
  state,
  onChangeFirstName,
  onChangeLastName,
  onChangeEmail,
  onChangeDob,
  onChangeSsn,
  onChangeAddressField,
  onSubmit,
}: CustomerInformationScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const showDob = !requiresDobInPhoneAuth(capabilities);
  const showSsn = capabilities.includes('kyc') || capabilities.includes('kyc_prefill');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
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
        About you
      </Text>

      <View style={styles.row}>
        <View style={styles.cell}>
          <ValidatedTextField
            prompt="First name"
            value={state.customerFirstName}
            onChangeText={onChangeFirstName}
            error={state.fieldErrors.customerFirstName}
            autoCapitalize="words"
          />
        </View>
        <View style={styles.cell}>
          <ValidatedTextField
            prompt="Last name"
            value={state.customerLastName}
            onChangeText={onChangeLastName}
            error={state.fieldErrors.customerLastName}
            autoCapitalize="words"
          />
        </View>
      </View>

      <ValidatedTextField
        prompt="Email"
        value={state.customerEmail}
        onChangeText={onChangeEmail}
        error={state.fieldErrors.customerEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {showDob ? (
        <View style={styles.dobBlock}>
          <Text style={[styles.dobLabel, { color: theme.colors.textSecondary }]}>Date of birth</Text>
          <DobInputField
            month={state.dobMonth}
            day={state.dobDay}
            year={state.dobYear}
            onChange={onChangeDob}
            error={state.fieldErrors.dob}
          />
        </View>
      ) : null}

      {showSsn ? (
        <ValidatedTextField
          prompt="Last 4 of SSN"
          value={state.ssnLast4}
          onChangeText={onChangeSsn}
          error={state.fieldErrors.ssnLast4}
          keyboardType="number-pad"
          characterLimit={4}
          secureTextEntry
        />
      ) : null}

      <View style={styles.addressBlock}>
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
          Address
        </Text>
        <BillingAddressDetailView
          address={state.address}
          errors={state.fieldErrors}
          onChangeField={onChangeAddressField}
          international
        />
      </View>

      <View style={styles.footer}>
        <Button
          text="Continue"
          enabled={!state.isPerformingAction}
          isLoading={state.isPerformingAction}
          onPress={onSubmit}
        />
      </View>
    </ScrollView>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    heading: {
      marginTop: 8,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    cell: {
      flex: 1,
    },
    dobBlock: {
      marginTop: 8,
    },
    dobLabel: {
      fontSize: 12,
      marginBottom: 4,
    },
    addressBlock: {
      marginTop: 16,
    },
    sectionTitle: {
      marginBottom: 8,
    },
    footer: {
      marginTop: 24,
    },
  });
}
