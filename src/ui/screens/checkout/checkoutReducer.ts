import type { PaymentMethod as FramePaymentMethod } from 'framepayments';
import {
  validateEmail,
  validateFullName,
  validateNonEmpty,
  validatePostalCode,
  validateSubregion,
  validateZipUS,
} from '../../../validation';

// Reducer + selectors for the Checkout screen. Mirrors iOS
// FrameCheckoutViewModel observables: accountPaymentOptions, didLoadAccountPaymentMethods,
// selectedAccountPaymentOption, customerName/Email/Address fields, addressMode,
// saveCard toggle, isPerformingAction, fieldErrors.
//
// State is pure data; the view-model hook owns side effects (network calls,
// dispatch, encryption). React component receives selectors only.

/**
 * Controls billing-address collection in the checkout sheet.
 * - `'required'` — address fields are shown and must be completed before payment.
 * - `'optional'` — address fields are shown but can be skipped.
 * - `'hidden'` — address collection is suppressed entirely.
 */
export type AddressMode = 'required' | 'optional' | 'hidden';

export interface AddressForm {
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string; // alpha-2; 'US' default
  postalCode: string;
}

export interface CheckoutFieldErrors {
  customerName?: string;
  customerEmail?: string;
  addressLine1?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
}

export interface CheckoutState {
  // Loaded saved payment methods. null = not loaded yet; [] = loaded empty.
  accountPaymentOptions: ReadonlyArray<FramePaymentMethod> | null;
  /**
   * Whether the saved-methods fetch has settled. The card / billing / save-card
   * block is held back until it flips, so a returning user doesn't see that form
   * flash before their saved card is auto-selected. iOS
   * `didLoadAccountPaymentMethods` (FrameCheckoutViewModel.swift:40).
   */
  didLoadPaymentOptions: boolean;
  /** The user explicitly picked "Enter New Payment Method". */
  userChoseNewCard: boolean;
  selectedAccountPaymentOptionId: string | null;
  customerName: string;
  customerEmail: string;
  address: AddressForm;
  addressMode: AddressMode;
  saveCard: boolean;
  isPerformingAction: boolean;
  fieldErrors: CheckoutFieldErrors;
  // True once the consumer's card field has a Luhn-passing PAN + valid expiry
  // + valid CVC. Set by the screen via the SET_CARD_COMPLETE action — kept
  // outside the reducer so the reducer stays pure / sync.
  cardComplete: boolean;
}

export type CheckoutAction =
  | { type: 'SET_PAYMENT_OPTIONS'; options: ReadonlyArray<FramePaymentMethod> }
  | { type: 'SELECT_SAVED_OPTION'; id: string | null }
  | { type: 'SET_CUSTOMER_NAME'; value: string }
  | { type: 'SET_CUSTOMER_EMAIL'; value: string }
  | { type: 'SET_ADDRESS_FIELD'; field: keyof AddressForm; value: string }
  | { type: 'SET_ADDRESS_MODE'; mode: AddressMode }
  | { type: 'SET_SAVE_CARD'; value: boolean }
  | { type: 'SET_CARD_COMPLETE'; value: boolean }
  | { type: 'SET_PERFORMING_ACTION'; value: boolean }
  | { type: 'SET_FIELD_ERRORS'; errors: CheckoutFieldErrors }
  | { type: 'CLEAR_FIELD_ERROR'; field: keyof CheckoutFieldErrors };

export function initialCheckoutState(addressMode: AddressMode = 'required'): CheckoutState {
  return {
    accountPaymentOptions: null,
    didLoadPaymentOptions: false,
    userChoseNewCard: false,
    selectedAccountPaymentOptionId: null,
    customerName: '',
    customerEmail: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      country: 'US',
      postalCode: '',
    },
    addressMode,
    saveCard: false,
    isPerformingAction: false,
    fieldErrors: {},
    cardComplete: false,
  };
}

export function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    case 'SET_PAYMENT_OPTIONS': {
      // Auto-select the first saved method, matching iOS
      // (FrameCheckoutViewModel.swift:122-126). Only when nothing is selected
      // and the card field is untouched, so a user who has started typing a new
      // card isn't switched out from under them.
      const shouldAutoSelect =
        state.selectedAccountPaymentOptionId === null &&
        !state.cardComplete &&
        !state.userChoseNewCard &&
        action.options.length > 0;
      return {
        ...state,
        accountPaymentOptions: action.options,
        didLoadPaymentOptions: true,
        selectedAccountPaymentOptionId: shouldAutoSelect
          ? (action.options[0]?.id ?? null)
          : state.selectedAccountPaymentOptionId,
      };
    }
    case 'SELECT_SAVED_OPTION':
      return {
        ...state,
        selectedAccountPaymentOptionId: action.id,
        // Picking "Enter New Payment Method" is a deliberate choice; remember it
        // so a late-arriving options list doesn't auto-select over it.
        userChoseNewCard: action.id === null,
      };
    case 'SET_CUSTOMER_NAME':
      return {
        ...state,
        customerName: action.value,
        fieldErrors: clearError(state.fieldErrors, 'customerName'),
      };
    case 'SET_CUSTOMER_EMAIL':
      return {
        ...state,
        customerEmail: action.value,
        fieldErrors: clearError(state.fieldErrors, 'customerEmail'),
      };
    case 'SET_ADDRESS_FIELD': {
      const nextAddress: AddressForm = { ...state.address, [action.field]: action.value };
      const errorKey = addressFieldToErrorKey(action.field);
      return {
        ...state,
        address: nextAddress,
        fieldErrors: errorKey ? clearError(state.fieldErrors, errorKey) : state.fieldErrors,
      };
    }
    case 'SET_ADDRESS_MODE':
      return { ...state, addressMode: action.mode };
    case 'SET_SAVE_CARD':
      return { ...state, saveCard: action.value };
    case 'SET_CARD_COMPLETE':
      return { ...state, cardComplete: action.value };
    case 'SET_PERFORMING_ACTION':
      return { ...state, isPerformingAction: action.value };
    case 'SET_FIELD_ERRORS':
      return { ...state, fieldErrors: action.errors };
    case 'CLEAR_FIELD_ERROR':
      return { ...state, fieldErrors: clearError(state.fieldErrors, action.field) };
  }
}

function clearError(
  errors: CheckoutFieldErrors,
  key: keyof CheckoutFieldErrors,
): CheckoutFieldErrors {
  if (!(key in errors)) return errors;
  const next: CheckoutFieldErrors = { ...errors };
  delete next[key];
  return next;
}

function addressFieldToErrorKey(
  field: keyof AddressForm,
): keyof CheckoutFieldErrors | null {
  switch (field) {
    case 'line1':
      return 'addressLine1';
    case 'city':
      return 'addressCity';
    case 'state':
      return 'addressState';
    case 'postalCode':
      return 'addressPostalCode';
    default:
      return null;
  }
}

// Selectors

export function isUsingSavedCard(state: CheckoutState): boolean {
  return state.selectedAccountPaymentOptionId !== null;
}

export function shouldValidateAddress(state: CheckoutState): boolean {
  if (state.addressMode === 'required') return true;
  if (state.addressMode === 'hidden') return false;
  // Optional mode: all-or-nothing. Validate iff any address field has input.
  return (
    state.address.line1.trim() !== '' ||
    state.address.line2.trim() !== '' ||
    state.address.city.trim() !== '' ||
    state.address.state.trim() !== '' ||
    state.address.postalCode.trim() !== ''
  );
}

export function hasUsablePaymentInput(state: CheckoutState): boolean {
  // Name and email gate both paths, matching validateForSubmit — enabling Pay
  // for a saved card without them would hand the user a button that fails
  // validation on tap with no visible reason.
  if (validateFullName(state.customerName) !== null) return false;
  if (validateEmail(state.customerEmail) !== null) return false;
  // A saved card needs nothing further; a new card needs its own fields.
  if (isUsingSavedCard(state)) return true;
  if (!state.cardComplete) return false;
  if (shouldValidateAddress(state)) {
    if (validateNonEmpty(state.address.line1, 'Address') !== null) return false;
    if (validateNonEmpty(state.address.city, 'City') !== null) return false;
    if (validateSubregion(state.address.state, state.address.country) !== null) return false;
    if (state.address.country === 'US' && validateZipUS(state.address.postalCode) !== null) return false;
    if (state.address.country !== 'US' && validateNonEmpty(state.address.postalCode, 'Postal code') !== null) return false;
  }
  return true;
}

export interface ValidationResult {
  fieldErrors: CheckoutFieldErrors;
  /** True iff no field errors AND (saved card OR new-card fields valid). */
  isValid: boolean;
}

export function validateForSubmit(state: CheckoutState): ValidationResult {
  const errors: CheckoutFieldErrors = {};
  const usingSaved = isUsingSavedCard(state);

  // Name and email are validated on BOTH paths. iOS runs them unconditionally
  // and only skips the card and address blocks for a saved card
  // (`FrameCheckoutViewModel.swift:213-224`). Short-circuiting the whole
  // validator for a saved card meant the transfer went out with whatever the
  // customer-information fields happened to hold, including nothing.
  const nameError = validateFullName(state.customerName);
  if (nameError) errors.customerName = nameError;

  const emailError = validateEmail(state.customerEmail);
  if (emailError) errors.customerEmail = emailError;

  if (!usingSaved && shouldValidateAddress(state)) {
    const line1Error = validateNonEmpty(state.address.line1, 'Address');
    if (line1Error) errors.addressLine1 = line1Error;

    const cityError = validateNonEmpty(state.address.city, 'City');
    if (cityError) errors.addressCity = cityError;

    // Country-aware: a US state must be one of the 56 accepted codes, not any
    // non-empty string. iOS uses Validators.validateSubregion here.
    const stateError = validateSubregion(state.address.state, state.address.country);
    if (stateError) errors.addressState = stateError;

    // Country-aware, matching iOS's Validators.validatePostalCode(_:countryCode:).
    // validatePostalCode returns null for a country with no known format, so
    // fall back to a presence check rather than accepting an empty value.
    const postalError =
      validatePostalCode(state.address.postalCode, state.address.country) ??
      validateNonEmpty(state.address.postalCode, 'Postal code');
    if (postalError) errors.addressPostalCode = postalError;

    if (!state.address.country) errors.addressCountry = 'Select a country';
  }

  return { fieldErrors: errors, isValid: Object.keys(errors).length === 0 };
}
