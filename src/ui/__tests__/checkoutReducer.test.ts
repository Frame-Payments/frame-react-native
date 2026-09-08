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

  it('hasUsablePaymentInput: saved card still needs name + email', () => {
    // iOS validates name and email on both paths, so the Pay button must not
    // enable for a saved card before they are filled — otherwise the tap fails
    // validation with no visible reason.
    let s = initialCheckoutState();
    s = checkoutReducer(s, { type: 'SELECT_SAVED_OPTION', id: 'pm_1' });
    expect(hasUsablePaymentInput(s)).toBe(false);
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_NAME', value: 'Eric Townsend' });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'eric@example.com' });
    expect(hasUsablePaymentInput(s)).toBe(true);
  });

  it('hasUsablePaymentInput: saved card skips the card and address fields', () => {
    let s = initialCheckoutState('required');
    s = checkoutReducer(s, { type: 'SELECT_SAVED_OPTION', id: 'pm_1' });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_NAME', value: 'Eric Townsend' });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'eric@example.com' });
    // No cardComplete, no address — a saved card needs neither.
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
  it('saved card path still validates name and email', () => {
    // iOS runs both validators unconditionally and only skips the card and
    // address blocks for a saved card (FrameCheckoutViewModel.swift:213-224).
    let s = initialCheckoutState();
    s = checkoutReducer(s, { type: 'SELECT_SAVED_OPTION', id: 'pm_1' });
    const empty = validateForSubmit(s);
    expect(empty.isValid).toBe(false);
    expect(empty.fieldErrors.customerName).toBeDefined();
    expect(empty.fieldErrors.customerEmail).toBeDefined();
    // ...and nothing else: the card and address blocks are skipped.
    expect(empty.fieldErrors.addressLine1).toBeUndefined();

    s = checkoutReducer(s, { type: 'SET_CUSTOMER_NAME', value: 'Eric Townsend' });
    s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'eric@example.com' });
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

  it('non-US country validates the postal code against that country format', () => {
    // Was a bare non-empty check, so 'K1A' passed. iOS uses the country-aware
    // Validators.validatePostalCode, and RN already had the same table in
    // validation.ts — checkout just wasn't calling it.
    function caStateWith(postalCode: string) {
      let s = initialCheckoutState();
      s = checkoutReducer(s, { type: 'SET_CUSTOMER_NAME', value: 'Eric Townsend' });
      s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'a@b.co' });
      s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'country', value: 'CA' });
      s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'line1', value: '1' });
      s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'city', value: 'a' });
      s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'state', value: 'ON' });
      return checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'postalCode', value: postalCode });
    }
    expect(validateForSubmit(caStateWith('K1A 0B1')).fieldErrors.addressPostalCode).toBeUndefined();
    expect(validateForSubmit(caStateWith('K1A')).fieldErrors.addressPostalCode).toBeDefined();
  });

  it('a country with no known postal format falls back to a presence check', () => {
    function stateWith(postalCode: string) {
      let s = initialCheckoutState();
      s = checkoutReducer(s, { type: 'SET_CUSTOMER_NAME', value: 'Eric Townsend' });
      s = checkoutReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'a@b.co' });
      s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'country', value: 'ZA' });
      s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'line1', value: '1' });
      s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'city', value: 'a' });
      s = checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'state', value: 'GP' });
      return checkoutReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'postalCode', value: postalCode });
    }
    expect(validateForSubmit(stateWith('anything')).fieldErrors.addressPostalCode).toBeUndefined();
    expect(validateForSubmit(stateWith('')).fieldErrors.addressPostalCode).toBeDefined();
  });
});

describe('saved-method loading', () => {
  const savedCard = { id: 'pm_1' } as never;
  const otherCard = { id: 'pm_2' } as never;

  it('holds didLoadPaymentOptions false until the fetch settles', () => {
    expect(initialCheckoutState().didLoadPaymentOptions).toBe(false);
    const loaded = checkoutReducer(initialCheckoutState(), {
      type: 'SET_PAYMENT_OPTIONS',
      options: [],
    });
    expect(loaded.didLoadPaymentOptions).toBe(true);
  });

  it('auto-selects the first saved method', () => {
    const s = checkoutReducer(initialCheckoutState(), {
      type: 'SET_PAYMENT_OPTIONS',
      options: [savedCard, otherCard],
    });
    expect(s.selectedAccountPaymentOptionId).toBe('pm_1');
  });

  it('does not auto-select when the user has started typing a card', () => {
    let s = checkoutReducer(initialCheckoutState(), { type: 'SET_CARD_COMPLETE', value: true });
    s = checkoutReducer(s, { type: 'SET_PAYMENT_OPTIONS', options: [savedCard] });
    expect(s.selectedAccountPaymentOptionId).toBeNull();
  });

  it('does not auto-select over a deliberate "Enter New Payment Method" choice', () => {
    // A late-arriving options list must not undo an explicit pick.
    let s = checkoutReducer(initialCheckoutState(), { type: 'SELECT_SAVED_OPTION', id: null });
    s = checkoutReducer(s, { type: 'SET_PAYMENT_OPTIONS', options: [savedCard] });
    expect(s.selectedAccountPaymentOptionId).toBeNull();
  });

  it('leaves an existing selection alone', () => {
    let s = checkoutReducer(initialCheckoutState(), { type: 'SELECT_SAVED_OPTION', id: 'pm_2' });
    s = checkoutReducer(s, { type: 'SET_PAYMENT_OPTIONS', options: [savedCard, otherCard] });
    expect(s.selectedAccountPaymentOptionId).toBe('pm_2');
  });

  it('selects nothing when the account has no saved methods', () => {
    const s = checkoutReducer(initialCheckoutState(), { type: 'SET_PAYMENT_OPTIONS', options: [] });
    expect(s.selectedAccountPaymentOptionId).toBeNull();
    expect(s.didLoadPaymentOptions).toBe(true);
  });
});
