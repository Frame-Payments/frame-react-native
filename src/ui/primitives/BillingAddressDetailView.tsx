import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { ValidatedTextField } from './ValidatedTextField';
import { CountryPicker } from './CountryPicker';
import {
  AddressAutocompleteField,
  type AddressAutocompleteOverlayState,
} from './AddressAutocompleteField';
import { addressFormatForCountry } from '../../addressFormat';
import { subregionsForCountry } from '../../addressSubregions';
import { getAvailableCountries } from '../../countries';
import type { OnboardingAddress } from '../screens/onboarding/onboardingReducer';
import type { BillingAddress } from '../../types';

// Reusable billing-address form block. Renders 5–6 ValidatedTextFields plus
// (in international mode) a CountryPicker. The view model owns the address
// state in the reducer; this primitive is dumb glue.

export interface BillingAddressDetailViewProps {
  address: OnboardingAddress;
  /** Per-field error map keyed as `address.<field>`. */
  errors: Readonly<Record<string, string>>;
  onChangeField: (field: keyof OnboardingAddress, value: string) => void;
  /**
   * Batch-applies a picked autocomplete suggestion's fields in one write.
   * Omit to fall back to a plain text field with no autocomplete (used where
   * a screen has no overlay-rendering layer to hoist the suggestion list
   * into, e.g. a form with no ScrollView ancestor to escape).
   */
  onApplyAddress?: (address: Partial<OnboardingAddress>) => void;
  /**
   * Reports the autocomplete suggestion list + the field's on-screen position
   * so the CALLER can draw it outside this view's own layout — see
   * AddressAutocompleteField.tsx's header comment for why. Required whenever
   * `onApplyAddress` is supplied.
   */
  onOverlayChange?: (state: AddressAutocompleteOverlayState | null) => void;
  /** When true, shows the country picker and uses the dynamic postal/zip label.
   *  When false, country is hidden + locked to US (used by ACH billing). */
  international: boolean;
  testID?: string;
}

export function BillingAddressDetailView({
  address,
  errors,
  onChangeField,
  onApplyAddress,
  onOverlayChange,
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

  // Per-country labels, keyboard and length caps, matching iOS AddressFormat.
  // A non-international form is US-only by definition, so it reads the US entry
  // rather than whatever `address.country` happens to hold.
  const format = addressFormatForCountry(international ? address.country : 'US');
  const hasSubregionCodes = subregionsForCountry(address.country) !== null;

  // Fills the address fields from a picked autocomplete suggestion. Ports iOS
  // BillingAddressDetailView.apply(_:) (BillingAddressDetailView.swift:53-76).
  function handleSelectSuggestion(suggestion: BillingAddress) {
    // The country is only taken in international mode, and only when the
    // suggestion names one the picker offers — matches iOS's guard
    // (`allowsInternational` + `AvailableCountry.allCountries.first(where:)`).
    // A US-only form ignores the country outright.
    const countryMatch =
      international && suggestion.country
        ? getAvailableCountries().find((c) => c.alpha2Code === suggestion.country)
        : undefined;
    onApplyAddress?.({
      ...(suggestion.addressLine1 !== undefined ? { line1: suggestion.addressLine1 } : {}),
      ...(suggestion.city !== undefined ? { city: suggestion.city } : {}),
      ...(suggestion.state !== undefined ? { state: suggestion.state } : {}),
      postalCode: suggestion.postalCode,
      ...(countryMatch ? { country: countryMatch.alpha2Code } : {}),
    });
  }

  return (
    <View testID={testID} style={styles.stack}>
      {onApplyAddress && onOverlayChange ? (
        <AddressAutocompleteField
          prompt="Address line 1"
          value={address.line1}
          onChangeText={(v) => onChangeField('line1', v)}
          error={errors['address.line1']}
          countryCode={international ? address.country : 'US'}
          onSelect={handleSelectSuggestion}
          onOverlayChange={onOverlayChange}
        />
      ) : (
      <ValidatedTextField
        prompt="Address line 1"
        value={address.line1}
        onChangeText={(v) => onChangeField('line1', v)}
        error={errors['address.line1']}
        autoCapitalize="words"
        textContentType="streetAddressLine1"
        autoComplete="address-line1"
      />
      )}
      <ValidatedTextField
        prompt="Address line 2 (optional)"
        value={address.line2}
        onChangeText={(v) => onChangeField('line2', v)}
        autoCapitalize="words"
        textContentType="streetAddressLine2"
        autoComplete="address-line2"
      />
      <View style={styles.row}>
        <View style={styles.cell}>
          <ValidatedTextField
            prompt="City"
            value={address.city}
            onChangeText={(v) => onChangeField('city', v)}
            error={errors['address.city']}
            autoCapitalize="words"
            textContentType="addressCity"
            autoComplete="postal-address-locality"
            inputRestriction="textOnly"
          />
        </View>
        <View style={styles.cell}>
          <ValidatedTextField
            prompt={format.stateLabel}
            value={address.state}
            onChangeText={(v) => onChangeField('state', v)}
            error={errors['address.state']}
            // Upper-case only where the subregion is a code; a free-text
            // county or prefecture is a name, not an abbreviation.
            autoCapitalize={hasSubregionCodes ? 'characters' : 'words'}
            textContentType="addressState"
            autoComplete="postal-address-region"
            inputRestriction="textOnly"
            characterLimit={format.stateMaxLength}
          />
        </View>
      </View>
      <ValidatedTextField
        prompt={format.postalLabel}
        value={address.postalCode}
        onChangeText={(v) => onChangeField('postalCode', v)}
        error={errors['address.postalCode']}
        keyboardType={format.postalKeyboard}
        textContentType="postalCode"
        autoComplete="postal-code"
      />
      {international ? (
        <CountryPicker
          selectedAlpha2={address.country}
          onSelect={(c) => onChangeField('country', c.alpha2Code)}
        />
      ) : null}
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    stack: {
      gap: 12,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    cell: {
      flex: 1,
    },
  });
}
