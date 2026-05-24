import type { PaymentMethod as FramePaymentMethod } from 'framepayments/dist/types/payment_methods';
import type { OnboardingCapability } from '../../../types';

// Onboarding state machine. Ports OnboardingContainerViewModel.swift (647 lines)
// + FrameOnboarding.kt (1492 lines) into a single pure reducer + selectors.
//
// Top-level navigation moves through `flow` (an ordered list of OnboardingStep
// values computed from `requiredCapabilities`). Within each step the
// `subStep` field tracks which screen is active. Most fields read by any one
// screen are kept flat at the top level — partitioning by screen would
// require passing the partition map through every action.
//
// Side effects live in useOnboardingViewModel.ts; the reducer is pure data.

export type OnboardingStep =
  | 'verification_welcome'
  | 'personal_information'
  | 'confirm_payment_method'
  | 'confirm_bank_account'
  | 'upload_documents'
  | 'verification_submitted';

export type PersonalInfoSubStep =
  | 'phone_auth'
  | 'verify_phone'
  | 'customer_information'
  | 'geolocation';

export type ConfirmPaymentMethodSubStep =
  | 'select'
  | 'add'
  | 'secure_3ds';

export type ConfirmBankAccountSubStep =
  | 'select'
  | 'add';

export type UploadDocumentsSubStep =
  | 'list'
  | 'capture_front'
  | 'review_front'
  | 'capture_back'
  | 'review_back'
  | 'capture_selfie'
  | 'review_selfie';

export type OnboardingSubStep =
  | PersonalInfoSubStep
  | ConfirmPaymentMethodSubStep
  | ConfirmBankAccountSubStep
  | UploadDocumentsSubStep;

// VerifyPhone UI branches off the result of phoneVerifications.create:
//   - response has prove_auth_token  → loading_prove → otp_for_prove (on Prove fallback)
//   - response has no prove_auth_token → otp_frame_api
export type VerifyPhoneUi = 'loading_prove' | 'otp_for_prove' | 'otp_frame_api';

export type IdDocumentType = 'drivers_license' | 'passport' | 'state_id' | 'military_id';

export type AchAccountType = 'checking' | 'savings';

export interface OnboardingAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string; // alpha-2, defaults to 'US'
  postalCode: string;
}

export interface OnboardingAch {
  routingNumber: string;
  accountNumber: string;
  accountType: AchAccountType;
}

export interface CapturedPhoto {
  uri: string;
  type: string; // MIME
  name: string;
}

export interface OnboardingDocs {
  idType: IdDocumentType | null;
  front: CapturedPhoto | null;
  back: CapturedPhoto | null;
  selfie: CapturedPhoto | null;
}

export interface PhoneCountry {
  alpha2: string;
  callingCode: string; // e.g. '1', '44'
}

export interface OnboardingState {
  // ─── Flow ───
  requiredCapabilities: ReadonlyArray<OnboardingCapability>;
  flow: ReadonlyArray<OnboardingStep>;
  currentStep: OnboardingStep;
  subStep: OnboardingSubStep | null;

  // ─── Account ───
  accountId: string | null;
  accountLoaded: boolean;

  // ─── PersonalInformation: phone-auth ───
  phoneCountry: PhoneCountry;
  phoneNumber: string;
  dobMonth: string;
  dobDay: string;
  dobYear: string;
  acceptedTos: boolean;

  // ─── PersonalInformation: verify-phone ───
  pendingVerificationId: string | null;
  pendingProveAuthToken: string | null;
  verifyPhoneUi: VerifyPhoneUi | null;
  otpCode: string;

  // ─── PersonalInformation: customer-information ───
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  ssnLast4: string;
  address: OnboardingAddress;

  // ─── ConfirmPaymentMethod ───
  savedPaymentMethods: ReadonlyArray<FramePaymentMethod>;
  selectedPaymentMethodId: string | null;
  // True when the user enters AddPaymentMethod via SelectPaymentMethod after
  // the selected saved card is missing billing — only the address fields show.
  addressVerificationOnly: boolean;
  cardComplete: boolean;
  threeDsVerificationId: string | null;

  // ─── ConfirmBankAccount ───
  savedPayoutMethods: ReadonlyArray<FramePaymentMethod>;
  selectedPayoutMethodId: string | null;
  ach: OnboardingAch;
  achManualMode: boolean;

  // ─── UploadDocuments ───
  customerIdentityId: string | null;
  docs: OnboardingDocs;

  // ─── UI / network ───
  isPerformingAction: boolean;
  fieldErrors: Readonly<Record<string, string>>;
}

export type OnboardingAction =
  // Flow
  | { type: 'SET_FLOW'; flow: ReadonlyArray<OnboardingStep>; currentStep: OnboardingStep; subStep: OnboardingSubStep | null }
  | { type: 'GO_TO_STEP'; step: OnboardingStep; subStep: OnboardingSubStep | null }
  | { type: 'SET_SUB_STEP'; subStep: OnboardingSubStep | null }
  | { type: 'SET_REQUIRED_CAPABILITIES'; capabilities: ReadonlyArray<OnboardingCapability> }
  // Account
  | { type: 'SET_ACCOUNT_ID'; id: string | null }
  | { type: 'SET_ACCOUNT_LOADED'; loaded: boolean }
  // Prefill (used by 8g prefetch — only writes fields the user hasn't touched)
  | { type: 'PREFILL'; values: Partial<OnboardingState> }
  // Phone-auth
  | { type: 'SET_PHONE_COUNTRY'; country: PhoneCountry }
  | { type: 'SET_PHONE_NUMBER'; value: string }
  | { type: 'SET_DOB'; month: string; day: string; year: string }
  | { type: 'SET_ACCEPTED_TOS'; value: boolean }
  // Verify-phone
  | { type: 'SET_VERIFY_PHONE'; verificationId: string | null; proveAuthToken: string | null; ui: VerifyPhoneUi | null }
  | { type: 'SET_VERIFY_PHONE_UI'; ui: VerifyPhoneUi | null }
  | { type: 'SET_OTP_CODE'; value: string }
  // Customer info
  | { type: 'SET_CUSTOMER_FIRST_NAME'; value: string }
  | { type: 'SET_CUSTOMER_LAST_NAME'; value: string }
  | { type: 'SET_CUSTOMER_EMAIL'; value: string }
  | { type: 'SET_SSN_LAST4'; value: string }
  | { type: 'SET_ADDRESS_FIELD'; field: keyof OnboardingAddress; value: string }
  // Payment method
  | { type: 'SET_SAVED_PAYMENT_METHODS'; methods: ReadonlyArray<FramePaymentMethod> }
  | { type: 'APPEND_SAVED_PAYMENT_METHOD'; method: FramePaymentMethod }
  | { type: 'SELECT_PAYMENT_METHOD'; id: string | null }
  | { type: 'SET_ADDRESS_VERIFICATION_ONLY'; value: boolean }
  | { type: 'SET_CARD_COMPLETE'; value: boolean }
  | { type: 'SET_THREE_DS_VERIFICATION_ID'; id: string | null }
  // Payout method
  | { type: 'SET_SAVED_PAYOUT_METHODS'; methods: ReadonlyArray<FramePaymentMethod> }
  | { type: 'SELECT_PAYOUT_METHOD'; id: string | null }
  | { type: 'SET_ACH_FIELD'; field: keyof OnboardingAch; value: string }
  | { type: 'SET_ACH_ACCOUNT_TYPE'; value: AchAccountType }
  | { type: 'SET_ACH_MANUAL_MODE'; value: boolean }
  // Documents
  | { type: 'SET_CUSTOMER_IDENTITY_ID'; id: string | null }
  | { type: 'SET_DOC_ID_TYPE'; value: IdDocumentType | null }
  | { type: 'SET_DOC_PHOTO'; side: 'front' | 'back' | 'selfie'; photo: CapturedPhoto | null }
  // UI / errors
  | { type: 'SET_PERFORMING_ACTION'; value: boolean }
  | { type: 'SET_FIELD_ERRORS'; errors: Record<string, string> }
  | { type: 'CLEAR_FIELD_ERROR'; field: string };

const DEFAULT_PHONE_COUNTRY: PhoneCountry = { alpha2: 'US', callingCode: '1' };

const DEFAULT_ADDRESS: OnboardingAddress = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  country: 'US',
  postalCode: '',
};

const DEFAULT_ACH: OnboardingAch = {
  routingNumber: '',
  accountNumber: '',
  accountType: 'checking',
};

const DEFAULT_DOCS: OnboardingDocs = {
  idType: null,
  front: null,
  back: null,
  selfie: null,
};

export function initialOnboardingState(
  requiredCapabilities: ReadonlyArray<OnboardingCapability>,
  accountId: string | null,
): OnboardingState {
  return {
    requiredCapabilities,
    flow: [],
    currentStep: 'verification_welcome',
    subStep: null,
    accountId,
    accountLoaded: false,
    phoneCountry: DEFAULT_PHONE_COUNTRY,
    phoneNumber: '',
    dobMonth: '',
    dobDay: '',
    dobYear: '',
    acceptedTos: false,
    pendingVerificationId: null,
    pendingProveAuthToken: null,
    verifyPhoneUi: null,
    otpCode: '',
    customerFirstName: '',
    customerLastName: '',
    customerEmail: '',
    ssnLast4: '',
    address: { ...DEFAULT_ADDRESS },
    savedPaymentMethods: [],
    selectedPaymentMethodId: null,
    addressVerificationOnly: false,
    cardComplete: false,
    threeDsVerificationId: null,
    savedPayoutMethods: [],
    selectedPayoutMethodId: null,
    ach: { ...DEFAULT_ACH },
    achManualMode: false,
    customerIdentityId: null,
    docs: { ...DEFAULT_DOCS },
    isPerformingAction: false,
    fieldErrors: {},
  };
}

function clearError(errors: Readonly<Record<string, string>>, field: string): Readonly<Record<string, string>> {
  if (!(field in errors)) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_FLOW':
      return { ...state, flow: action.flow, currentStep: action.currentStep, subStep: action.subStep };
    case 'GO_TO_STEP':
      return { ...state, currentStep: action.step, subStep: action.subStep };
    case 'SET_SUB_STEP':
      return { ...state, subStep: action.subStep };
    case 'SET_REQUIRED_CAPABILITIES':
      return { ...state, requiredCapabilities: action.capabilities };
    case 'SET_ACCOUNT_ID':
      return { ...state, accountId: action.id };
    case 'SET_ACCOUNT_LOADED':
      return { ...state, accountLoaded: action.loaded };
    case 'PREFILL':
      // Only writes fields the user has not touched. Empty-string fields and
      // null cross-step ids are considered untouched; anything else stays.
      return mergePrefill(state, action.values);
    case 'SET_PHONE_COUNTRY':
      // Strip a leading '+' from callingCode so the view model's E.164
      // assembly (`+${callingCode}${digits}`) is idempotent regardless of
      // whether callers hand us '+1' (libphonenumber-js style) or '1'.
      return {
        ...state,
        phoneCountry: {
          alpha2: action.country.alpha2,
          callingCode: action.country.callingCode.replace(/^\+/, ''),
        },
      };
    case 'SET_PHONE_NUMBER':
      return { ...state, phoneNumber: action.value, fieldErrors: clearError(state.fieldErrors, 'phoneNumber') };
    case 'SET_DOB':
      return {
        ...state,
        dobMonth: action.month,
        dobDay: action.day,
        dobYear: action.year,
        fieldErrors: clearError(state.fieldErrors, 'dob'),
      };
    case 'SET_ACCEPTED_TOS':
      return { ...state, acceptedTos: action.value, fieldErrors: clearError(state.fieldErrors, 'acceptedTos') };
    case 'SET_VERIFY_PHONE':
      return {
        ...state,
        pendingVerificationId: action.verificationId,
        pendingProveAuthToken: action.proveAuthToken,
        verifyPhoneUi: action.ui,
        otpCode: '',
      };
    case 'SET_VERIFY_PHONE_UI':
      return { ...state, verifyPhoneUi: action.ui };
    case 'SET_OTP_CODE':
      return { ...state, otpCode: action.value, fieldErrors: clearError(state.fieldErrors, 'otpCode') };
    case 'SET_CUSTOMER_FIRST_NAME':
      return {
        ...state,
        customerFirstName: action.value,
        fieldErrors: clearError(state.fieldErrors, 'customerFirstName'),
      };
    case 'SET_CUSTOMER_LAST_NAME':
      return {
        ...state,
        customerLastName: action.value,
        fieldErrors: clearError(state.fieldErrors, 'customerLastName'),
      };
    case 'SET_CUSTOMER_EMAIL':
      return {
        ...state,
        customerEmail: action.value,
        fieldErrors: clearError(state.fieldErrors, 'customerEmail'),
      };
    case 'SET_SSN_LAST4':
      return { ...state, ssnLast4: action.value, fieldErrors: clearError(state.fieldErrors, 'ssnLast4') };
    case 'SET_ADDRESS_FIELD': {
      const nextAddress: OnboardingAddress = { ...state.address, [action.field]: action.value };
      return {
        ...state,
        address: nextAddress,
        fieldErrors: clearError(state.fieldErrors, `address.${action.field}`),
      };
    }
    case 'SET_SAVED_PAYMENT_METHODS':
      return { ...state, savedPaymentMethods: action.methods };
    case 'APPEND_SAVED_PAYMENT_METHOD':
      return {
        ...state,
        savedPaymentMethods: [...state.savedPaymentMethods, action.method],
      };
    case 'SELECT_PAYMENT_METHOD':
      return { ...state, selectedPaymentMethodId: action.id };
    case 'SET_ADDRESS_VERIFICATION_ONLY':
      return { ...state, addressVerificationOnly: action.value };
    case 'SET_CARD_COMPLETE':
      return { ...state, cardComplete: action.value };
    case 'SET_THREE_DS_VERIFICATION_ID':
      return { ...state, threeDsVerificationId: action.id };
    case 'SET_SAVED_PAYOUT_METHODS':
      return { ...state, savedPayoutMethods: action.methods };
    case 'SELECT_PAYOUT_METHOD':
      return { ...state, selectedPayoutMethodId: action.id };
    case 'SET_ACH_FIELD': {
      const nextAch: OnboardingAch = { ...state.ach, [action.field]: action.value };
      return { ...state, ach: nextAch, fieldErrors: clearError(state.fieldErrors, `ach.${action.field}`) };
    }
    case 'SET_ACH_ACCOUNT_TYPE':
      return { ...state, ach: { ...state.ach, accountType: action.value } };
    case 'SET_ACH_MANUAL_MODE':
      return { ...state, achManualMode: action.value };
    case 'SET_CUSTOMER_IDENTITY_ID':
      return { ...state, customerIdentityId: action.id };
    case 'SET_DOC_ID_TYPE':
      return { ...state, docs: { ...state.docs, idType: action.value } };
    case 'SET_DOC_PHOTO':
      return { ...state, docs: { ...state.docs, [action.side]: action.photo } };
    case 'SET_PERFORMING_ACTION':
      return { ...state, isPerformingAction: action.value };
    case 'SET_FIELD_ERRORS':
      return { ...state, fieldErrors: action.errors };
    case 'CLEAR_FIELD_ERROR':
      return { ...state, fieldErrors: clearError(state.fieldErrors, action.field) };
  }
}

// Merge prefilled values into state. Only writes fields that are still "empty"
// from the user's perspective. Strings: empty-string is replaceable. Null
// scalars: replaceable. Objects (address): each scalar field handled by the
// same rule recursively.
function mergePrefill(state: OnboardingState, values: Partial<OnboardingState>): OnboardingState {
  const next: OnboardingState = { ...state };

  for (const key of Object.keys(values) as Array<keyof OnboardingState>) {
    const incoming = values[key];
    if (incoming === undefined) continue;

    if (key === 'address' && typeof incoming === 'object' && incoming !== null) {
      next.address = mergeAddressPrefill(state.address, incoming as Partial<OnboardingAddress>);
      continue;
    }

    const current = state[key];
    if (typeof current === 'string' && current === '') {
      // @ts-expect-error — narrow the union; runtime check ensures shape match
      next[key] = incoming;
    } else if (current === null) {
      // @ts-expect-error — same
      next[key] = incoming;
    } else if (typeof current === 'boolean' && current === false && typeof incoming === 'boolean') {
      // booleans only flipped if currently false (default) — preserves explicit toggles
      // @ts-expect-error — same
      next[key] = incoming;
    }
    // arrays, objects (non-address), non-empty strings, true booleans → keep user value
  }
  return next;
}

function mergeAddressPrefill(current: OnboardingAddress, incoming: Partial<OnboardingAddress>): OnboardingAddress {
  return {
    line1: current.line1 === '' && incoming.line1 ? incoming.line1 : current.line1,
    line2: current.line2 === '' && incoming.line2 ? incoming.line2 : current.line2,
    city: current.city === '' && incoming.city ? incoming.city : current.city,
    state: current.state === '' && incoming.state ? incoming.state : current.state,
    country: current.country === 'US' && incoming.country ? incoming.country : current.country,
    postalCode: current.postalCode === '' && incoming.postalCode ? incoming.postalCode : current.postalCode,
  };
}
