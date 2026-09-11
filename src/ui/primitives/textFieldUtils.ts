export function truncateToLimit(value: string, limit?: number): string {
  if (limit === undefined) return value;
  if (!Number.isInteger(limit) || limit <= 0) return value;
  return value.length > limit ? value.slice(0, limit) : value;
}

export type TextFieldInputRestriction = 'none' | 'textOnly';

const TEXT_ONLY_PATTERN = /[^\p{L}\s\-'.]/gu;

export function applyInputRestriction(
  value: string,
  restriction: TextFieldInputRestriction | undefined,
): string {
  return restriction === 'textOnly' ? value.replace(TEXT_ONLY_PATTERN, '') : value;
}
