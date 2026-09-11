import type { KeyboardTypeOptions } from 'react-native';

export interface AddressFormat {
  stateLabel: string;
  postalLabel: string;
  postalKeyboard: KeyboardTypeOptions;
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

export function addressFormatForCountry(alpha2: string): AddressFormat {
  return FORMATS[alpha2.toUpperCase()] ?? DEFAULT_FORMAT;
}
