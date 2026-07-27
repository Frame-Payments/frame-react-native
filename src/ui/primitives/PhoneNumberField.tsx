import { useMemo, useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AsYouType } from 'libphonenumber-js';
import { useFrameTheme } from '../theme/ThemeContext';
import { PhoneCountryPicker } from './PhoneCountryPicker';
import type { PhoneCountry } from '../../countries';

// Phone number entry: 110pt country picker on the left + flex digits input.
// Partial formatting uses libphonenumber-js AsYouType per-region. The reducer
// stores `phoneNumber` as the raw user-typed string (digits + formatting); the
// view model strips non-digits before building the E.164.

export interface PhoneNumberFieldProps {
  phoneNumber: string;
  selectedAlpha2: string;
  onChangePhoneNumber: (value: string) => void;
  onChangeCountry: (country: PhoneCountry) => void;
  error?: string;
  testID?: string;
}

export function PhoneNumberField({
  phoneNumber,
  selectedAlpha2,
  onChangePhoneNumber,
  onChangeCountry,
  error,
  testID,
}: PhoneNumberFieldProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // AsYouType retains internal state across keystrokes (intentional for parser
  // throughput); make sure each region change rebuilds the formatter.
  const formatterAlpha2 = useRef(selectedAlpha2);
  formatterAlpha2.current = selectedAlpha2;

  function handleChange(next: string) {
    const formatter = new AsYouType(selectedAlpha2 as never);
    onChangePhoneNumber(formatter.input(next));
  }

  return (
    <View>
      <View style={styles.row}>
        <PhoneCountryPicker
          selectedAlpha2={selectedAlpha2}
          onSelect={onChangeCountry}
          testID={testID ? `${testID}.country` : undefined}
        />
        <View
          style={[
            styles.input,
            {
              borderColor: error ? theme.colors.error : theme.colors.surfaceStroke,
              borderRadius: theme.radii.medium,
            },
          ]}
        >
          <TextInput
            value={phoneNumber}
            onChangeText={handleChange}
            placeholder="Phone number"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            style={[
              styles.inputText,
              {
                color: theme.colors.textPrimary,
                fontSize: theme.fonts.body.size,
              },
            ]}
            accessibilityLabel="Phone number"
            testID={testID}
          />
        </View>
      </View>
      {error ? (
        <Text
          style={[
            styles.error,
            {
              color: theme.colors.error,
              fontSize: theme.fonts.bodySmall.size,
            },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    input: {
      flex: 1,
      height: 49,
      borderWidth: 1,
      paddingHorizontal: 12,
      justifyContent: 'center',
    },
    inputText: {
      padding: 0,
    },
    error: {
      marginTop: 4,
    },
  });
}
