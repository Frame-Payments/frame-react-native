import {
  checkoutReducer,
  hasUsablePaymentInput,
  initialCheckoutState,
  isUsingSavedCard,
  shouldValidateAddress,
  validateForSubmit,
} from '../screens/checkout/checkoutReducer';

describe('checkoutReducer', () => {
  it('sets payment options', () => {
    const s = checkoutReducer(initialCheckoutState(), {
      type: 'SET_PAYMENT_OPTIONS',
      options: [{ id: 'pm_1' } as never],
    });
    expect(s.accountPaymentOptions).toEqual([{ id: 'pm_1' }]);
  });

  it('selecting a saved option sets the id; null deselects', () => {
    let s = initialCheckoutState();
    s = checkoutReducer(s, { type: 'SELECT_SAVED_OPTION', id: 'pm_42' });
    expect(s.selectedAccountPaymentOptionId).toBe('pm_42');
    s = checkoutReducer(s, { type: 'SELECT_SAVED_OPTION', id: null });
    expect(s.selectedAccountPaymentOptionId).toBeNull();
  });

  it('typing into a field clears that field error', () => {
    let s = initialCheckoutState();
    s = checkoutReducer(s, {
      type: 'SET_FIELD_ERRORS',
      errors: { customerEmail: 'Bad email' },
    });
    expect(s.fieldErrors.customerEmail).toBeDefined();

    s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'a' });
    expect(s.fieldErrors.customerEmail).toBeUndefined();
  });

  it('SET_ADDRESS_FIELD clears the address-specific error', () => {
    let s = initialCheckoutState();
    s = checkoutReducer(s, { type: 'SET_FIELD_ERRORS', errors: { addressCity: 'X' } });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'city', value: 'a' });
    expect(s.fieldErrors.addressCity).toBeUndefined();
  });

  it('SET_ADDRESS_FIELD on line2 does not clear any error', () => {
    let s = initialCheckoutState();
    s = checkoutReducer(s, { type: 'SET_FIELD_ERRORS', errors: { addressLine1: 'X' } });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'line2', value: 'a' });
    expect(s.fieldErrors.addressLine1).toBe('X');
  });
});

describe('selectors', () => {
  it('isUsingSavedCard reflects selection', () => {
    let s = initialCheckoutState();
    expect(isUsingSavedCard(s)).toBe(false);
    s = checkoutReducer(s, { type: 'SELECT_SAVED_OPTION', id: 'pm_1' });
    expect(isUsingSavedCard(s)).toBe(true);
  });

  it('shouldValidateAddress: required → always', () => {
    const s = initialCheckoutState('required');
    expect(shouldValidateAddress(s)).toBe(true);
  });

  it('shouldValidateAddress: hidden → never', () => {
    const s = initialCheckoutState('hidden');
    expect(shouldValidateAddress(s)).toBe(false);
  });

  it('shouldValidateAddress: optional → only when any field has input', () => {
    let s = initialCheckoutState('optional');
    expect(shouldValidateAddress(s)).toBe(false);
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'city', value: 'Austin' });
    expect(shouldValidateAddress(s)).toBe(true);
  });

  it('hasUsablePaymentInput: saved card always passes', () => {
    let s = initialCheckoutState();
    s = checkoutReducer(s, { type: 'SELECT_SAVED_OPTION', id: 'pm_1' });
    expect(hasUsablePaymentInput(s)).toBe(true);
  });

  it('hasUsablePaymentInput: new-card needs cardComplete + customer + address', () => {
    let s = initialCheckoutState('required');
    // Card not complete yet
    expect(hasUsablePaymentInput(s)).toBe(false);
    s = checkoutReducer(s, { type: 'SET_CARD_COMPLETE', value: true });
    // Customer name + email still empty
    expect(hasUsablePaymentInput(s)).toBe(false);
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_NAME', value: 'Eric Townsend' });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'eric@example.com' });
    expect(hasUsablePaymentInput(s)).toBe(false); // address still required
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'line1', value: '123 Main' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'city', value: 'Austin' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'state', value: 'TX' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'postalCode', value: '78701' });
    expect(hasUsablePaymentInput(s)).toBe(true);
  });

  it('hasUsablePaymentInput: optional address with only some fields blocks (all-or-nothing)', () => {
    let s = initialCheckoutState('optional');
    s = checkoutReducer(s, { type: 'SET_CARD_COMPLETE', value: true });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_NAME', value: 'Eric Townsend' });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'eric@example.com' });
    // No address fields — passes (optional + empty).
    expect(hasUsablePaymentInput(s)).toBe(true);
    // Type only the city — now address validation is active and the rest fail.
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'city', value: 'Austin' });
    expect(hasUsablePaymentInput(s)).toBe(false);
  });

  it('hasUsablePaymentInput: hidden address skips address validation entirely', () => {
    let s = initialCheckoutState('hidden');
    s = checkoutReducer(s, { type: 'SET_CARD_COMPLETE', value: true });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_NAME', value: 'Eric Townsend' });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'eric@example.com' });
    expect(hasUsablePaymentInput(s)).toBe(true);
  });
});

describe('validateForSubmit', () => {
  it('saved card path is always valid', () => {
    let s = initialCheckoutState();
    s = checkoutReducer(s, { type: 'SELECT_SAVED_OPTION', id: 'pm_1' });
    expect(validateForSubmit(s)).toEqual({ fieldErrors: {}, isValid: true });
  });

  it('new-card path collects per-field errors', () => {
    const s = initialCheckoutState();
    const result = validateForSubmit(s);
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.customerName).toBeDefined();
    expect(result.fieldErrors.customerEmail).toBeDefined();
    expect(result.fieldErrors.addressLine1).toBeDefined();
    expect(result.fieldErrors.addressPostalCode).toBeDefined();
  });

  it('US country uses zip validator (5 digits)', () => {
    let s = initialCheckoutState();
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_NAME', value: 'Eric Townsend' });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'a@b.co' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'line1', value: '1' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'city', value: 'a' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'state', value: 'TX' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'postalCode', value: '1234' });
    expect(validateForSubmit(s).fieldErrors.addressPostalCode).toBeDefined();
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'postalCode', value: '78701' });
    expect(validateForSubmit(s).fieldErrors.addressPostalCode).toBeUndefined();
  });

  it('non-US country uses non-empty validator (any non-empty postal passes)', () => {
    let s = initialCheckoutState();
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_NAME', value: 'Eric Townsend' });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'a@b.co' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'country', value: 'CA' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'line1', value: '1' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'city', value: 'a' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'state', value: 'ON' });
    s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'postalCode', value: 'K1A' });
    expect(validateForSubmit(s).fieldErrors.addressPostalCode).toBeUndefined();
  });
});
