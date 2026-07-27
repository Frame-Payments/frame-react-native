import type { KeyboardTypeOptions } from 'react-native';

// Split out from KeyboardAccessory.tsx so this logic is importable without
// pulling in the react-native runtime (the component imports InputAccessoryView
// et al., which don't load in jest's node environment). Mirrors the
// otpFieldLogic / paymentCardFormat split used elsewhere in primitives/.

// Keyboard types with no return key. iOS renders these as a bare 10-key pad, so
// they are the ones that strand the user without an accessory bar.
// 'decimal-pad' and 'numeric' are included for completeness — the SDK doesn't
// use them today, but they have the same problem.
const NUMERIC_KEYBOARDS: ReadonlySet<string> = new Set([
  'number-pad',
  'numeric',
  'decimal-pad',
  'phone-pad',
]);

/** True for keyboard types that render without a return key. */
export function isNumericKeyboard(keyboardType: KeyboardTypeOptions | undefined): boolean {
  return keyboardType !== undefined && NUMERIC_KEYBOARDS.has(keyboardType);
}
