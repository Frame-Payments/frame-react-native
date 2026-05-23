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

// Mirror of iOS UserIdentificationView's "Personal Information" sub-step
// (CustomerInformationView + BillingAddressDetailView):
//
//   • Customer Information container (First/Last, Email)
//   • Birthday container (M/D/Y)
//   • Social Security Number container (Last 4 Digits tag + SSN field)
//   • Current Address (BillingAddressDetailView, international)

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

  const containerStyle = [
    styles.container,
    {
      borderColor: theme.colors.surfaceStroke,
      borderRadius: theme.radii.medium,
      backgroundColor: theme.colors.surface,
    },
  ];
  const dividerStyle = [styles.divider, { backgroundColor: theme.colors.surfaceStroke }];
  const sectionLabelStyle = {
    color: theme.colors.textPrimary,
    fontSize: theme.fonts.label.size,
    fontWeight: theme.fontWeights.label,
    lineHeight: theme.fontLineHeights.label,
  };

  return (
    <ScrollView
      style={styles.scroll}
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
        Personal Information
      </Text>

      {/* Customer Information container */}
      <Text style={[styles.sectionLabel, sectionLabelStyle]}>Customer Information</Text>
      <View style={containerStyle}>
        <View style={styles.row}>
          <View style={styles.cell}>
            <ValidatedTextField
              prompt="First Name"
              value={state.customerFirstName}
              onChangeText={onChangeFirstName}
              error={state.fieldErrors.customerFirstName}
              autoCapitalize="words"
              borderless
              inlineError
            />
          </View>
          <View style={dividerStyle} />
          <View style={styles.cell}>
            <ValidatedTextField
              prompt="Last Name"
              value={state.customerLastName}
              onChangeText={onChangeLastName}
              error={state.fieldErrors.customerLastName}
              autoCapitalize="words"
              borderless
              inlineError
            />
          </View>
        </View>
        <View style={[dividerStyle, styles.horizontalDivider]} />
        <ValidatedTextField
          prompt="Email Address"
          value={state.customerEmail}
          onChangeText={onChangeEmail}
          error={state.fieldErrors.customerEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          borderless
          inlineError
        />
      </View>

      {/* Birthday container */}
      {showDob ? (
        <>
          <Text style={[styles.sectionLabel, sectionLabelStyle]}>Birthday</Text>
          <View style={containerStyle}>
            <DobInputField
              month={state.dobMonth}
              day={state.dobDay}
              year={state.dobYear}
              onChange={onChangeDob}
              error={state.fieldErrors.dob}
            />
          </View>
        </>
      ) : null}

      {/* Social Security Number container */}
      {showSsn ? (
        <>
          <Text style={[styles.sectionLabel, sectionLabelStyle]}>Social Security Number</Text>
          <View style={[containerStyle, styles.ssnContainer]}>
            <View
              style={[
                styles.ssnLeftLabel,
                {
                  backgroundColor: theme.colors.surfaceStroke,
                  borderTopLeftRadius: theme.radii.medium,
                  borderBottomLeftRadius: theme.radii.medium,
                },
              ]}
            >
              <Text
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.fonts.caption.size,
                  fontWeight: theme.fontWeights.label,
                }}
              >
                Last 4 Digits
              </Text>
            </View>
            <View style={styles.ssnField}>
              <ValidatedTextField
                prompt="SSN"
                value={state.ssnLast4}
                onChangeText={onChangeSsn}
                error={state.fieldErrors.ssnLast4}
                keyboardType="number-pad"
                characterLimit={4}
                secureTextEntry
                borderless
                inlineError
              />
            </View>
          </View>
        </>
      ) : null}

      {/* Current Address */}
      <Text style={[styles.sectionLabel, sectionLabelStyle]}>Current Address</Text>
      <BillingAddressDetailView
        address={state.address}
        errors={state.fieldErrors}
        onChangeField={onChangeAddressField}
        international
      />

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
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 24,
    },
    heading: {
      marginTop: 8,
      marginBottom: 16,
    },
    sectionLabel: {
      marginTop: 12,
      marginBottom: 6,
    },
    container: {
      borderWidth: 1,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 49,
    },
    cell: {
      flex: 1,
    },
    divider: {
      width: 1,
      alignSelf: 'stretch',
    },
    horizontalDivider: {
      width: '100%',
      height: 1,
    },
    ssnContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 50,
    },
    ssnLeftLabel: {
      width: 120,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ssnField: {
      flex: 1,
    },
    footer: {
      marginTop: 24,
    },
  });
}
