import type { KeyboardTypeOptions } from 'react-native';

// Per-country address field presentation. Ports iOS AddressFormat
// (`Sources/Frame/ViewModels/AddressFormat.swift:37-58`) table-for-table.
//
// RN previously hardcoded a US/non-US binary in checkout and onboarding: every
// country got the label "State", and `characterLimit: 2` was applied
// unconditionally — so a UK county or a Japanese prefecture was truncated to two
// characters as the user typed.

/** How one country's state and postal fields should be presented. */
export interface AddressFormat {
  /** Label for the state / region field (e.g. "State", "Province", "County"). */
  stateLabel: string;
  /** Label for the postal-code field (e.g. "Zip Code", "Postcode", "PIN Code"). */
  postalLabel: string;
  /** Keyboard best suited to the country's postal-code format. */
  postalKeyboard: KeyboardTypeOptions;
  /** Max characters for the state field, or undefined when unrestricted. */
  stateMaxLength?: number;
}

const FORMATS: Readonly<Record<string, AddressFormat>> = {
  US: { stateLabel: 'State', postalLabel: 'Zip Code', postalKeyboard: 'number-pad', stateMaxLength: 2 },
  CA: { stateLabel: 'Province', postalLabel: 'Postal Code', postalKeyboard: 'default', stateMaxLength: 2 },
  GB: { stateLabel: 'County', postalLabel: 'Postcode', postalKeyboard: 'default' },
  AU: { stateLabel: 'State', postalLabel: 'Postcode', postalKeyboard: 'number-pad' },
  DE: { stateLabel: 'State', postalLabel: 'Postal Code', postalKeyboard: 'number-pad' },
  FR: { stateLabel: 'Region', postalLabel: 'Postal Code', postalKeyboard: 'number-pad' },
  NL: { stateLabel: 'Province', postalLabel: 'Postcode', postalKeyboard: 'default' },
  JP: { stateLabel: 'Prefecture', postalLabel: 'Postal Code', postalKeyboard: 'default' },
  MX: { stateLabel: 'State', postalLabel: 'Postal Code', postalKeyboard: 'number-pad' },
  IN: { stateLabel: 'State', postalLabel: 'PIN Code', postalKeyboard: 'number-pad' },
  IE: { stateLabel: 'County', postalLabel: 'Eircode', postalKeyboard: 'default' },
  NZ: { stateLabel: 'Region', postalLabel: 'Postcode', postalKeyboard: 'number-pad' },
  BR: { stateLabel: 'State', postalLabel: 'CEP', postalKeyboard: 'number-pad' },
  IT: { stateLabel: 'Province', postalLabel: 'Postal Code', postalKeyboard: 'number-pad' },
  ES: { stateLabel: 'Province', postalLabel: 'Postal Code', postalKeyboard: 'number-pad' },
  SG: { stateLabel: 'Region', postalLabel: 'Postal Code', postalKeyboard: 'number-pad' },
};

const DEFAULT_FORMAT: AddressFormat = {
  stateLabel: 'State',
  postalLabel: 'Postal Code',
  postalKeyboard: 'default',
};

/**
 * The address format for an ISO 3166-1 alpha-2 country code (case-insensitive),
 * falling back to a generic format for countries not in the table.
 */
export function addressFormatForCountry(alpha2: string): AddressFormat {
  return FORMATS[alpha2.toUpperCase()] ?? DEFAULT_FORMAT;
}
