/**
 * Formats an integer cent amount as a localized currency string.
 * Uses `Intl.NumberFormat` with `currencySign: 'accounting'` so negative
 * values render in parentheses (e.g. `($1.50)`) — matching iOS
 * `NumberFormatter(numberStyle: .currency)` default behavior in `en_US`.
 *
 * Falls back to `'<CODE> <amount>'` (e.g. `'EUR 12.50'`) if the runtime
 * rejects the currency code (Hermes / older ICU environments).
 *
 * @param cents - Amount in the smallest currency unit (e.g. `2500` = $25.00). Non-finite values return `''`.
 * @param currencyCode - ISO 4217 code (e.g. `'USD'`, `'EUR'`). Defaults to `'USD'`.
 * @param locale - BCP 47 locale tag (e.g. `'en-US'`). Defaults to the device locale when omitted.
 * @returns A formatted currency string (e.g. `'$25.00'`).
 *
 * @example
 * ```ts
 * convertCentsToCurrencyString(2500);           // '$25.00'
 * convertCentsToCurrencyString(2500, 'EUR', 'de-DE'); // '25,00 €'
 * convertCentsToCurrencyString(-150, 'USD');    // '($1.50)'
 * ```
 */
export function convertCentsToCurrencyString(
  cents: number,
  currencyCode: string = 'USD',
  locale?: string,
): string {
  if (!Number.isFinite(cents)) return '';
  const amount = cents / 100;
  try {
    // `currencySign: 'accounting'` wraps negatives in parens (e.g. `($1.50)`),
    // matching iOS `NumberFormatter(numberStyle: .currency)` default behaviour
    // in `en_US`.
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      currencySign: 'accounting',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Hermes / older ICU may reject some currency codes. Degrade with the ISO
    // code visible so the consumer doesn't lose all currency context.
    return `${currencyCode.toUpperCase()} ${amount.toFixed(2)}`;
  }
}
