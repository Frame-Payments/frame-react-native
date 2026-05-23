import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { ValidatedTextField } from './ValidatedTextField';
import { CountryPicker } from './CountryPicker';
import type { OnboardingAddress } from '../screens/onboarding/onboardingReducer';

// Reusable billing-address form block. Renders 5–6 ValidatedTextFields plus
// (in international mode) a CountryPicker. The view model owns the address
// state in the reducer; this primitive is dumb glue.

export interface BillingAddressDetailViewProps {
  address: OnboardingAddress;
  /** Per-field error map keyed as `address.<field>`. */
  errors: Readonly<Record<string, string>>;
  onChangeField: (field: keyof OnboardingAddress, value: string) => void;
  /** When true, shows the country picker and uses the dynamic postal/zip label.
   *  When false, country is hidden + locked to US (used by ACH billing). */
  international: boolean;
  testID?: string;
}

export function BillingAddressDetailView({
  address,
  errors,
  onChangeField,
  international,
  testID,
}: BillingAddressDetailViewProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // In non-international mode the country picker is hidden and validation
  // rules are US-only. Force the underlying state to 'US' so the form can't
  // end up displaying US rules against a stale non-US country.
  //
  // Also reset `state` + `postalCode` whenever the country is swapped to US
  // because their formats are mutually incompatible (US: 2-letter state +
  // 5-digit zip vs. non-US: free-form state and country-specific postal).
  // Line1 / Line2 / City are free-text and preserved across the swap.
  useEffect(() => {
    if (!international && address.country !== 'US') {
      onChangeField('country', 'US');
      onChangeField('state', '');
      onChangeField('postalCode', '');
    }
  }, [international, address.country, onChangeField]);

  const isUS = address.country === 'US';
  const postalLabel = !international || isUS ? 'Zip code' : 'Postal code';
  const stateLabel = !international || isUS ? 'State' : 'State / province / region';

  return (
    <View testID={testID}>
      <ValidatedTextField
        prompt="Address line 1"
        value={address.line1}
        onChangeText={(v) => onChangeField('line1', v)}
        error={errors['address.line1']}
        autoCapitalize="words"
      />
      <ValidatedTextField
        prompt="Address line 2 (optional)"
        value={address.line2}
        onChangeText={(v) => onChangeField('line2', v)}
        autoCapitalize="words"
      />
      <View style={styles.row}>
        <View style={styles.cell}>
          <ValidatedTextField
            prompt="City"
            value={address.city}
            onChangeText={(v) => onChangeField('city', v)}
            error={errors['address.city']}
            autoCapitalize="words"
          />
        </View>
        <View style={styles.cell}>
          <ValidatedTextField
            prompt={stateLabel}
            value={address.state}
            onChangeText={(v) => onChangeField('state', v)}
            error={errors['address.state']}
            autoCapitalize={!international || isUS ? 'characters' : 'words'}
            characterLimit={!international || isUS ? 2 : undefined}
          />
        </View>
      </View>
      <ValidatedTextField
        prompt={postalLabel}
        value={address.postalCode}
        onChangeText={(v) => onChangeField('postalCode', v)}
        error={errors['address.postalCode']}
        keyboardType={!international || isUS ? 'number-pad' : 'default'}
      />
      {international ? (
        <View style={styles.country}>
          <CountryPicker
            selectedAlpha2={address.country}
            onSelect={(c) => onChangeField('country', c.alpha2Code)}
          />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    cell: {
      flex: 1,
    },
    country: {
      marginTop: 8,
    },
  });
}
