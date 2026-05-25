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
