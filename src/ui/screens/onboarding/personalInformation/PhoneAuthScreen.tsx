import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import { PhoneNumberField } from '../../../primitives/PhoneNumberField';
import { DobInputField } from '../../../primitives/DobInputField';
import { Checkbox } from '../../../primitives/Checkbox';
import { TermsOfServiceView } from '../../../primitives/TermsOfServiceView';
import {
  requiresDobInPhoneAuth,
  requiresTosInPhoneAuth,
} from '../onboardingSelectors';
import type { OnboardingCapability } from '../../../../types';
import type { OnboardingState } from '../onboardingReducer';

// PhoneAuth screen — first sub-step of PersonalInformation when any phone-
// touching capability is requested. Header copy + DOB visibility + TOS view
// are all driven by capability flags per Phase 8a's selectors.

export interface PhoneAuthScreenProps {
  capabilities: ReadonlyArray<OnboardingCapability>;
  state: OnboardingState;
  onChangePhoneCountry: (alpha2: string, callingCode: string) => void;
  onChangePhoneNumber: (value: string) => void;
  onChangeDob: (next: { month: string; day: string; year: string }) => void;
  onChangeAcceptedTos: (value: boolean) => void;
  onSubmit: () => void;
}

export function PhoneAuthScreen({
  capabilities,
  state,
  onChangePhoneCountry,
  onChangePhoneNumber,
  onChangeDob,
  onChangeAcceptedTos,
  onSubmit,
}: PhoneAuthScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const showDob = requiresDobInPhoneAuth(capabilities);
  const showTos = requiresTosInPhoneAuth(capabilities);
  const heading = showDob ? 'Enter your phone number & DOB' : 'Enter your phone number';

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
        We'll send a verification code so we can confirm it's really you.
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
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Date of birth</Text>
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
          <Checkbox
            value={state.acceptedTos}
            onValueChange={onChangeAcceptedTos}
            label={<TermsOfServiceView />}
            accessibilityLabel="Accept terms of service"
          />
          {state.fieldErrors.acceptedTos ? (
            <Text
              style={[
                styles.error,
                {
                  color: theme.colors.error,
                  fontSize: theme.fonts.bodySmall.size,
                },
              ]}
            >
              {state.fieldErrors.acceptedTos}
            </Text>
          ) : null}
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
    field: {
      marginBottom: 16,
    },
    label: {
      fontSize: 12,
      marginBottom: 4,
    },
    tosBlock: {
      marginVertical: 16,
    },
    error: {
      marginTop: 8,
    },
    footer: {
      marginTop: 8,
    },
  });
}
