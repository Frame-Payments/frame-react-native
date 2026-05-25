import { detectCardBrand } from '../../validation';

// PAN max-digit count per brand (the longest length the brand allows). Used to
// cap as-you-type input so users can't paste past the legal length.
export const PAN_MAX_DIGITS: Readonly<Record<string, number>> = {
  amex: 15,
  visa: 19,
  mastercard: 16,
  discover: 19,
  diners: 19,
  jcb: 19,
  unionpay: 19,
};
const PAN_DEFAULT_MAX = 19;

export const CVC_MAX_DIGITS: Readonly<Record<string, number>> = {
  amex: 4,
};
const CVC_DEFAULT_MAX = 3;

export function panMaxDigits(brand: string | null): number {
  if (!brand) return PAN_DEFAULT_MAX;
  return PAN_MAX_DIGITS[brand] ?? PAN_DEFAULT_MAX;
}

export function cvcMaxDigits(brand: string | null): number {
  if (!brand) return CVC_DEFAULT_MAX;
  return CVC_MAX_DIGITS[brand] ?? CVC_DEFAULT_MAX;
}

// Strip everything but digits; cap at the brand's max PAN length.
export function sanitizePanInput(raw: string, brand: string | null): string {
  const digits = raw.replace(/\D+/g, '');
  return digits.slice(0, panMaxDigits(brand));
}

// Visually group digits: amex = 4-6-5, others = 4-4-4-4 (extended cards 4-4-4-7).
export function formatPanDisplay(digits: string, brand: string | null): string {
  if (digits === '') return '';
  if (brand === 'amex') {
    const a = digits.slice(0, 4);
    const b = digits.slice(4, 10);
    const c = digits.slice(10, 15);
    return [a, b, c].filter((p) => p.length > 0).join(' ');
  }
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    groups.push(digits.slice(i, i + 4));
  }
  return groups.join(' ');
}

// Strip non-digits; cap at brand-specific CVC length.
export function sanitizeCvcInput(raw: string, brand: string | null): string {
  const digits = raw.replace(/\D+/g, '');
  return digits.slice(0, cvcMaxDigits(brand));
}

// MM/YY formatter with auto-slash insertion:
//   - "1"     → "1"
//   - "12"    → "12/"
//   - "129"   → "12/9"
//   - "1229"  → "12/29"
//   - "13"    → "1"        (rejects 13–19 first-digit-2 path; pretend the 3 wasn't typed)
//   - "0"     → "0"
//   - "02"    → "02/"
// Mirrors iOS Validators' MM/YY formatter behavior.
export function formatExpiryDisplay(raw: string): string {
  const digits = raw.replace(/\D+/g, '').slice(0, 4);
  if (digits.length === 0) return '';
  if (digits.length === 1) {
    // Allow only 0 or 1 as the first month digit (anything 2–9 means single-digit month — pad).
    if (digits[0] >= '2' && digits[0] <= '9') {
      return `0${digits[0]}/`;
    }
    return digits;
  }
  const monthStr = digits.slice(0, 2);
  const monthNum = Number.parseInt(monthStr, 10);
  if (monthNum < 1 || monthNum > 12) {
    // Invalid month: keep only the first digit so the user can fix it.
    return digits[0]!;
  }
  if (digits.length === 2) return `${monthStr}/`;
  return `${monthStr}/${digits.slice(2)}`;
}

export interface ParsedExpiry {
  month: string; // raw 2-digit string like "12"
  year: string; // raw 2-digit string like "29"
}

export function parseExpiry(formatted: string): ParsedExpiry | null {
  const m = /^(\d{2})\/(\d{2})$/.exec(formatted);
  if (!m) return null;
  return { month: m[1]!, year: m[2]! };
}

export interface CardFieldState {
  panRaw: string; // digits-only
  panDisplay: string;
  expiryDisplay: string;
  cvcRaw: string;
  brand: string | null;
}

export function emptyCardFieldState(): CardFieldState {
  return {
    panRaw: '',
    panDisplay: '',
    expiryDisplay: '',
    cvcRaw: '',
    brand: null,
  };
}

export function applyPanInput(prev: CardFieldState, next: string): CardFieldState {
  // Detect brand based on the new input, then sanitize against THAT brand's max.
  const provisionalDigits = next.replace(/\D+/g, '');
  const brand = detectCardBrand(provisionalDigits);
  const panRaw = sanitizePanInput(provisionalDigits, brand);
  const cvcRaw = sanitizeCvcInput(prev.cvcRaw, brand); // shrink CVC if brand changed (e.g. now amex requires 4)
  return {
    ...prev,
    panRaw,
    panDisplay: formatPanDisplay(panRaw, brand),
    cvcRaw,
    brand,
  };
}

export function applyExpiryInput(prev: CardFieldState, next: string): CardFieldState {
  return { ...prev, expiryDisplay: formatExpiryDisplay(next) };
}

export function applyCvcInput(prev: CardFieldState, next: string): CardFieldState {
  return { ...prev, cvcRaw: sanitizeCvcInput(next, prev.brand) };
}
