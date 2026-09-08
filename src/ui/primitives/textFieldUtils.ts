export function truncateToLimit(value: string, limit?: number): string {
  if (limit === undefined) return value;
  if (!Number.isInteger(limit) || limit <= 0) return value;
  return value.length > limit ? value.slice(0, limit) : value;
}

/**
 * What a field will accept. Ports iOS `TextFieldInputRestriction`
 * (`Sources/Frame/Views/Reusable/ValidatedTextField.swift:12-42`).
 */
export type TextFieldInputRestriction = 'none' | 'textOnly';

// Any Unicode letter, whitespace, or the punctuation real names and place names
// contain — O'Fallon, Stoke-on-Trent, St. Louis, Jr. Names here are compared
// against a government ID during KYC, so silently dropping a character an
// applicant's legal name actually contains would cause a verification failure.
// `\p{L}` with the `u` flag is the JS equivalent of Swift's `Character.isLetter`,
// so José, Müller and 李 all pass.
const TEXT_ONLY_PATTERN = /[^\p{L}\s\-'.]/gu;

export function applyInputRestriction(
  value: string,
  restriction: TextFieldInputRestriction | undefined,
): string {
  return restriction === 'textOnly' ? value.replace(TEXT_ONLY_PATTERN, '') : value;
}
