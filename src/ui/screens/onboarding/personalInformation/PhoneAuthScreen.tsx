import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { PhoneNumberField } from '../../../primitives/PhoneNumberField';
import { DobInputField } from '../../../primitives/DobInputField';
import { TermsOfServiceView } from '../../../primitives/TermsOfServiceView';
import {
  requiresDobInPhoneAuth,
  requiresTosInPhoneAuth,
} from '../onboardingSelectors';
import { FORM_SPACING } from '../formSpacing';
import type { OnboardingCapability } from '../../../../types';
import type { OnboardingState } from '../onboardingReducer';

// PhoneAuth screen — first sub-step of PersonalInformation when any phone-
// touching capability is requested. Mirrors iOS
// UserIdentificationView.authenticationView (Identity/Identification/
// UserIdentificationView.swift:143-275):
//   • Heading copy switches on kyc_prefill.
//   • DOB MM/DD/YYYY block appears when kyc_prefill is required.
//   • TermsOfServiceView (plain text, no checkbox) appears when
//     geo_compliance is required. Acceptance is implicit on Continue tap —
//     the VM attaches the TOS payload (token + ip + accepted_at) to the
//     resulting account create/update call.
//   • Mount fires generateTermsOfServiceToken so the token is ready when
//     Continue submits.

export interface PhoneAuthScreenProps {
  capabilities: ReadonlyArray<OnboardingCapability>;
  state: OnboardingState;
  onChangePhoneCountry: (alpha2: string, callingCode: string) => void;
  onChangePhoneNumber: (value: string) => void;
  onChangeDob: (next: { month: string; day: string; year: string }) => void;
  onMount: () => void;
  onSubmit: () => void;
}

export function PhoneAuthScreen({
  capabilities,
  state,
  onChangePhoneCountry,
  onChangePhoneNumber,
  onChangeDob,
  onMount,
  onSubmit,
}: PhoneAuthScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const showDob = requiresDobInPhoneAuth(capabilities);
  const showTos = requiresTosInPhoneAuth(capabilities);
  const heading = showDob ? 'Enter Your Phone Number & DOB' : 'Enter Your Phone Number';

  // iOS UserIdentificationView.authenticationView fires
  // generateTermsOfServiceToken() once in .onAppear (line 148-153). Mirror it
  // here — onMount is the VM's generateTermsOfServiceToken passthrough.
  useEffect(() => {
    onMount();
  }, [onMount]);

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
        {heading}
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
        We'll send you a code — it helps us keep your account secure.
      </Text>

      <View style={styles.field}>
        <PhoneNumberField
          phoneNumber={state.phoneNumber}
          selectedAlpha2={state.phoneCountry.alpha2}
          onChangeCountry={(c) => onChangePhoneCountry(c.alpha2Code, c.callingCode.replace(/^\+/, ''))}
          onChangePhoneNumber={onChangePhoneNumber}
          error={state.fieldErrors.phoneNumber}
        />
      </View>

      {showDob ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Date of Birth</Text>
          <DobInputField
            month={state.dobMonth}
            day={state.dobDay}
            year={state.dobYear}
            onChange={onChangeDob}
            error={state.fieldErrors.dob}
          />
        </View>
      ) : null}

      {showTos ? (
        <View style={styles.tosBlock}>
          <TermsOfServiceView />
        </View>
      ) : null}

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
      paddingHorizontal: FORM_SPACING.contentHorizontal,
      paddingBottom: FORM_SPACING.contentBottom,
    },
    heading: {
      marginTop: FORM_SPACING.headingTop,
      marginBottom: FORM_SPACING.headingBottom,
    },
    body: {
      marginBottom: FORM_SPACING.subheadBottom,
    },
    field: {
      marginBottom: FORM_SPACING.fieldGap,
    },
    label: {
      fontSize: 12,
      marginBottom: 4,
    },
    tosBlock: {
      marginVertical: FORM_SPACING.sectionBottom,
    },
    footer: {
      marginTop: FORM_SPACING.headingTop,
    },
  });
}
