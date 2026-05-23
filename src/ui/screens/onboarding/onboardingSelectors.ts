import {
  validateAccountNumberUS,
  validateDateOfBirth,
  validateEmail,
  validateNonEmpty,
  validatePhoneE164,
  validatePostalCode,
  validateRoutingNumberUS,
  validateSSNLast4,
  validateZipUS,
} from '../../../validation';
import type { OnboardingCapability } from '../../../types';
import type {
  OnboardingAch,
  OnboardingAddress,
  OnboardingState,
  OnboardingStep,
  OnboardingSubStep,
  PersonalInfoSubStep,
} from './onboardingReducer';

// ─────────────────────────────────────────────────────────────────────────────
// Capability → step routing.
//
// Verified 1:1 from iOS OnboardingContainerView.swift (lines 26–42) and
// Android FrameOnboarding.kt compute functions. Order matters for `flow`:
// PersonalInformation always precedes payment / payout / docs, which always
// precede VerificationSubmitted (terminal).
// ─────────────────────────────────────────────────────────────────────────────

const PERSONAL_INFO_CAPABILITIES: ReadonlySet<OnboardingCapability> = new Set([
  'kyc',
  'kyc_prefill',
  'phone_verification',
  'creator_shield',
  'geo_compliance',
  'age_verification',
]);

const CONFIRM_PAYMENT_METHOD_CAPABILITIES: ReadonlySet<OnboardingCapability> = new Set([
  'card_verification',
  'card_send',
  'card_receive',
  'address_verification',
]);

const CONFIRM_BANK_ACCOUNT_CAPABILITIES: ReadonlySet<OnboardingCapability> = new Set([
  'bank_account_verification',
  'bank_account_send',
  'bank_account_receive',
]);

export function computeFlow(
  capabilities: ReadonlyArray<OnboardingCapability>,
): ReadonlyArray<OnboardingStep> {
  const steps: OnboardingStep[] = [];
  steps.push('verification_welcome');
  if (capabilities.some((c) => PERSONAL_INFO_CAPABILITIES.has(c))) {
    steps.push('personal_information');
  }
  if (capabilities.some((c) => CONFIRM_PAYMENT_METHOD_CAPABILITIES.has(c))) {
    steps.push('confirm_payment_method');
  }
  if (capabilities.some((c) => CONFIRM_BANK_ACCOUNT_CAPABILITIES.has(c))) {
    steps.push('confirm_bank_account');
  }
  // `kyc` (and only `kyc`) triggers the document upload step. `kyc_prefill`
  // by itself is metadata-only — no documents required.
  if (capabilities.includes('kyc')) {
    steps.push('upload_documents');
  }
  steps.push('verification_submitted');
  return steps;
}

export interface FlowEntry {
  step: OnboardingStep;
  subStep: OnboardingSubStep | null;
}

// Default sub-step when entering a step from forward navigation.
export function entrySubStep(step: OnboardingStep, capabilities: ReadonlyArray<OnboardingCapability>): OnboardingSubStep | null {
  switch (step) {
    case 'verification_welcome':
      return null;
    case 'personal_information':
      return firstPersonalInfoSubStep(capabilities);
    case 'confirm_payment_method':
      return 'select';
    case 'confirm_bank_account':
      return 'select';
    case 'upload_documents':
      return 'list';
    case 'verification_submitted':
      return null;
  }
}

function firstPersonalInfoSubStep(capabilities: ReadonlyArray<OnboardingCapability>): PersonalInfoSubStep {
  // Phone-auth always runs first if any phone-touching capability is requested.
  // Per iOS source: phone_verification, kyc, kyc_prefill, creator_shield, geo_compliance
  // all gate on phone auth before customer information.
  if (
    capabilities.includes('phone_verification') ||
    capabilities.includes('kyc') ||
    capabilities.includes('kyc_prefill') ||
    capabilities.includes('creator_shield') ||
    capabilities.includes('geo_compliance')
  ) {
    return 'phone_auth';
  }
  // age_verification-only path skips straight to customer information.
  return 'customer_information';
}

// Next step in the linear flow. Returns null at the end.
export function nextStep(state: OnboardingState): OnboardingStep | null {
  const idx = state.flow.indexOf(state.currentStep);
  if (idx === -1 || idx === state.flow.length - 1) return null;
  return state.flow[idx + 1]!;
}

export function previousStep(state: OnboardingState): OnboardingStep | null {
  const idx = state.flow.indexOf(state.currentStep);
  if (idx <= 0) return null;
  return state.flow[idx - 1]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation per sub-step. Each returns a partial field-error map; empty map
// means valid.
// ─────────────────────────────────────────────────────────────────────────────

export function validatePhoneAuth(state: OnboardingState): Record<string, string> {
  const errors: Record<string, string> = {};
  const phoneE164 = `+${state.phoneCountry.callingCode}${state.phoneNumber.replace(/\D+/g, '')}`;
  const phoneError = validatePhoneE164(phoneE164, state.phoneCountry.alpha2);
  if (phoneError) errors.phoneNumber = phoneError;

  if (requiresDobInPhoneAuth(state.requiredCapabilities)) {
    const dobError = validateDateOfBirth(state.dobYear, state.dobMonth, state.dobDay, 18, 120);
    if (dobError) errors.dob = dobError;
  }

  if (state.requiredCapabilities.includes('geo_compliance') && !state.acceptedTos) {
    errors.acceptedTos = 'Accept the terms to continue';
  }
  return errors;
}

export function requiresDobInPhoneAuth(capabilities: ReadonlyArray<OnboardingCapability>): boolean {
  return capabilities.includes('kyc_prefill');
}

export function requiresTosInPhoneAuth(capabilities: ReadonlyArray<OnboardingCapability>): boolean {
  return capabilities.includes('geo_compliance');
}

export function validateOtp(state: OnboardingState): Record<string, string> {
  const errors: Record<string, string> = {};
  const code = state.otpCode.trim();
  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    errors.otpCode = 'Enter the 6-digit code';
  }
  return errors;
}

export function validateCustomerInformation(state: OnboardingState): Record<string, string> {
  const errors: Record<string, string> = {};

  const firstError = validateNonEmpty(state.customerFirstName, 'First name');
  if (firstError) errors.customerFirstName = firstError;

  const lastError = validateNonEmpty(state.customerLastName, 'Last name');
  if (lastError) errors.customerLastName = lastError;

  const emailError = validateEmail(state.customerEmail);
  if (emailError) errors.customerEmail = emailError;

  // DOB always required at this screen when not already collected in phone-auth.
  if (!requiresDobInPhoneAuth(state.requiredCapabilities)) {
    const dobError = validateDateOfBirth(state.dobYear, state.dobMonth, state.dobDay, 18, 120);
    if (dobError) errors.dob = dobError;
  }

  if (state.requiredCapabilities.includes('kyc') || state.requiredCapabilities.includes('kyc_prefill')) {
    const ssnError = validateSSNLast4(state.ssnLast4);
    if (ssnError) errors.ssnLast4 = ssnError;
  }

  Object.assign(errors, validateAddress(state.address, /* required */ true));
  return errors;
}

export function validateAddress(address: OnboardingAddress, required: boolean): Record<string, string> {
  // Optional mode (used by Checkout's `optional` addressMode) is intentionally
  // NOT exposed here — onboarding requires a billing address whenever the
  // address fields are shown.
  if (!required) return {};

  const errors: Record<string, string> = {};
  const line1Error = validateNonEmpty(address.line1, 'Address');
  if (line1Error) errors['address.line1'] = line1Error;

  const cityError = validateNonEmpty(address.city, 'City');
  if (cityError) errors['address.city'] = cityError;

  const stateError = validateNonEmpty(address.state, 'State');
  if (stateError) errors['address.state'] = stateError;

  const countryError = validateNonEmpty(address.country, 'Country');
  if (countryError) errors['address.country'] = countryError;

  if (address.country === 'US') {
    const zipError = validateZipUS(address.postalCode);
    if (zipError) errors['address.postalCode'] = zipError;
  } else {
    // Use the country-specific validator when available; otherwise non-empty.
    const postalError = validatePostalCode(address.postalCode, address.country) ?? validateNonEmpty(address.postalCode, 'Postal code');
    if (postalError) errors['address.postalCode'] = postalError;
  }
  return errors;
}

export function validateAch(ach: OnboardingAch, address: OnboardingAddress): Record<string, string> {
  const errors: Record<string, string> = {};

  const routingError = validateRoutingNumberUS(ach.routingNumber);
  if (routingError) errors['ach.routingNumber'] = routingError;

  const accountError = validateAccountNumberUS(ach.accountNumber, 4, 17);
  if (accountError) errors['ach.accountNumber'] = accountError;

  // ACH billing is always US per the plan.
  if (address.country !== 'US') {
    errors['address.country'] = 'Bank account billing address must be US.';
  } else {
    Object.assign(errors, validateAddress(address, true));
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enable selectors.
// ─────────────────────────────────────────────────────────────────────────────

export function isCustomerInformationValid(state: OnboardingState): boolean {
  return Object.keys(validateCustomerInformation(state)).length === 0;
}

export function isPhoneAuthValid(state: OnboardingState): boolean {
  return Object.keys(validatePhoneAuth(state)).length === 0;
}

export function isOtpValid(state: OnboardingState): boolean {
  return Object.keys(validateOtp(state)).length === 0;
}

export function isAchValid(state: OnboardingState): boolean {
  return Object.keys(validateAch(state.ach, state.address)).length === 0;
}

export function isCardSubmittable(state: OnboardingState): boolean {
  if (state.addressVerificationOnly) {
    // Only need address fields valid in address-only mode.
    return Object.keys(validateAddress(state.address, true)).length === 0;
  }
  if (!state.cardComplete) return false;
  return Object.keys(validateAddress(state.address, true)).length === 0;
}

// Returns true once all required docs have been captured. Selfie always; front
// always; back depends on the chosen id type (passport is single-page).
export function areDocsComplete(state: OnboardingState): boolean {
  if (!state.docs.idType) return false;
  if (!state.docs.front) return false;
  if (state.docs.idType !== 'passport' && !state.docs.back) return false;
  if (!state.docs.selfie) return false;
  return true;
}

// Capability already satisfied by the loaded account/payment-method profile.
// Used by 8g to skip steps the user has already completed.
export function isCapabilitySatisfied(
  capability: OnboardingCapability,
  state: OnboardingState,
): boolean {
  switch (capability) {
    case 'address_verification':
      // Satisfied if a saved card has a full billing address on it.
      return state.savedPaymentMethods.some(
        (pm) => pm.card != null && hasFullBilling(pm.billing as OnboardingAddress | undefined),
      );
    case 'phone_verification':
      // The account profile prefetch sets accountLoaded; a separate check on
      // `account.phone_verified` would live here once we resolve the account
      // shape. For now, return false so phone_verification always runs.
      return false;
    default:
      return false;
  }
}

function hasFullBilling(billing: OnboardingAddress | undefined): boolean {
  if (!billing) return false;
  return (
    billing.line1.trim() !== '' &&
    billing.city.trim() !== '' &&
    billing.state.trim() !== '' &&
    billing.country.trim() !== '' &&
    billing.postalCode.trim() !== ''
  );
}
