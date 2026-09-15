import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { recordEvent } from '../../../../accountEvents';
import { Button } from '../../../primitives/Button';
import { ValidatedTextField } from '../../../primitives/ValidatedTextField';
import { DobInputField } from '../../../primitives/DobInputField';
import { BillingAddressDetailView } from '../../../primitives/BillingAddressDetailView';
import {
  AddressAutocompleteOverlay,
  type AddressAutocompleteOverlayState,
} from '../../../primitives/AddressAutocompleteField';
import {
  requiresDobInPhoneAuth,
  requiresKyc,
  governmentIdRequired,
  skipsSsnEntry,
} from '../onboardingSelectors';
import { isPersonaAvailable } from '../../../../persona';
import { FORM_SPACING } from '../formSpacing';
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
  onApplyAddress: (address: Partial<OnboardingAddress>) => void;
  onSubmit: () => void;
  /** No-SSN path: launch government-ID identity verification via Persona. */
  onVerifyIdentity: () => void;
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
  onApplyAddress,
  onSubmit,
  onVerifyIdentity,
}: CustomerInformationScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [addressOverlay, setAddressOverlay] = useState<AddressAutocompleteOverlayState | null>(null);

  useEffect(() => {
    recordEvent('profile_step_started', 'PersonalInformation');
  }, []);

  const showDob = !requiresDobInPhoneAuth(capabilities);
  const ssnCapabilityRequested = requiresKyc(state.requiredCapabilities);
  const showSsn = ssnCapabilityRequested && !skipsSsnEntry(state);
  const showNoSsnButton = showSsn && !governmentIdRequired(state) && isPersonaAvailable();
  // Once verified, replace the whole SSN block with a confirmation line.
  const showVerifiedNotice = ssnCapabilityRequested && state.identityVerifiedViaGovId;

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
    <View style={styles.root}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
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
              textContentType="givenName"
              autoComplete="given-name"
              inputRestriction="textOnly"
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
              textContentType="familyName"
              autoComplete="family-name"
              inputRestriction="textOnly"
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
          textContentType="emailAddress"
          autoComplete="email"
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
          {showNoSsnButton ? (
            <View style={styles.noSsnButton}>
              <Button
                text="I don't have a social security number"
                variant="secondary"
                enabled={!state.isPerformingAction}
                isLoading={state.isPerformingAction}
                onPress={onVerifyIdentity}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {/* Verified-via-government-ID notice (replaces the SSN block) */}
      {showVerifiedNotice ? (
        <>
          <Text style={[styles.sectionLabel, sectionLabelStyle]}>Social Security Number</Text>
          <View style={containerStyle}>
            <Text
              style={[
                styles.verifiedNotice,
                {
                  color: theme.colors.textPrimary,
                  fontSize: theme.fonts.label.size,
                  lineHeight: theme.fontLineHeights.label,
                },
              ]}
            >
              Verified with government ID.
            </Text>
          </View>
        </>
      ) : null}

      {/* Current Address */}
      <Text style={[styles.sectionLabel, sectionLabelStyle]}>Current Address</Text>
      <BillingAddressDetailView
        address={state.address}
        errors={state.fieldErrors}
        onChangeField={onChangeAddressField}
        onApplyAddress={onApplyAddress}
        onOverlayChange={setAddressOverlay}
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
    {addressOverlay ? <AddressAutocompleteOverlay state={addressOverlay} /> : null}
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: FORM_SPACING.contentHorizontal,
      paddingBottom: FORM_SPACING.contentBottom,
      paddingTop: FORM_SPACING.headingTop,
    },
    sectionLabel: {
      marginTop: FORM_SPACING.fieldGap,
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
    noSsnButton: {
      marginTop: 10,
    },
    verifiedNotice: {
      paddingHorizontal: 12,
      paddingVertical: 14,
    },
    footer: {
      marginTop: FORM_SPACING.sectionBottom,
    },
  });
}
