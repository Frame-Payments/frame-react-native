import {
  initialOnboardingState,
  onboardingReducer,
} from '../screens/onboarding/onboardingReducer';
import type { OnboardingState } from '../screens/onboarding/onboardingReducer';

const baseCaps = ['kyc'] as const;

describe('onboardingReducer — flow + navigation', () => {
  it('SET_FLOW replaces the flow and resets currentStep + subStep', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, {
      type: 'SET_FLOW',
      flow: ['verification_welcome', 'personal_information', 'verification_submitted'],
      currentStep: 'personal_information',
      subStep: 'phone_auth',
    });
    expect(s.flow.length).toBe(3);
    expect(s.currentStep).toBe('personal_information');
    expect(s.subStep).toBe('phone_auth');
  });

  it('GO_TO_STEP updates currentStep and subStep together', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'GO_TO_STEP', step: 'confirm_payment_method', subStep: 'select' });
    expect(s.currentStep).toBe('confirm_payment_method');
    expect(s.subStep).toBe('select');
  });

  it('SET_SUB_STEP updates only the sub-step', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'GO_TO_STEP', step: 'personal_information', subStep: 'phone_auth' });
    s = onboardingReducer(s, { type: 'SET_SUB_STEP', subStep: 'verify_phone' });
    expect(s.currentStep).toBe('personal_information');
    expect(s.subStep).toBe('verify_phone');
  });
});

describe('onboardingReducer — account', () => {
  it('SET_ACCOUNT_ID writes the id', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_ACCOUNT_ID', id: 'acct_42' });
    expect(s.accountId).toBe('acct_42');
  });

  it('SET_ACCOUNT_LOADED flips the flag', () => {
    let s = initialOnboardingState(baseCaps, null);
    expect(s.accountLoaded).toBe(false);
    s = onboardingReducer(s, { type: 'SET_ACCOUNT_LOADED', loaded: true });
    expect(s.accountLoaded).toBe(true);
  });
});

describe('onboardingReducer — phone-auth + verify-phone', () => {
  it('SET_PHONE_NUMBER clears phoneNumber error', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_FIELD_ERRORS', errors: { phoneNumber: 'bad' } });
    expect(s.fieldErrors.phoneNumber).toBeDefined();
    s = onboardingReducer(s, { type: 'SET_PHONE_NUMBER', value: '5' });
    expect(s.fieldErrors.phoneNumber).toBeUndefined();
  });

  it('SET_DOB sets all three fields and clears dob error', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_FIELD_ERRORS', errors: { dob: 'invalid' } });
    s = onboardingReducer(s, { type: 'SET_DOB', month: '03', day: '15', year: '1990' });
    expect(s.dobMonth).toBe('03');
    expect(s.dobDay).toBe('15');
    expect(s.dobYear).toBe('1990');
    expect(s.fieldErrors.dob).toBeUndefined();
  });

  it('SET_VERIFY_PHONE writes verification id, prove token, and ui branch + clears otpCode', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_OTP_CODE', value: '12345' });
    s = onboardingReducer(s, {
      type: 'SET_VERIFY_PHONE',
      verificationId: 'pv_1',
      proveAuthToken: 'tok_abc',
      ui: 'loading_prove',
    });
    expect(s.pendingVerificationId).toBe('pv_1');
    expect(s.pendingProveAuthToken).toBe('tok_abc');
    expect(s.verifyPhoneUi).toBe('loading_prove');
    expect(s.otpCode).toBe('');
  });

  it('SET_OTP_CODE clears the otpCode error', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_FIELD_ERRORS', errors: { otpCode: 'bad' } });
    s = onboardingReducer(s, { type: 'SET_OTP_CODE', value: '1' });
    expect(s.fieldErrors.otpCode).toBeUndefined();
  });
});

describe('onboardingReducer — customer information', () => {
  it('each field setter clears its own error', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, {
      type: 'SET_FIELD_ERRORS',
      errors: {
        customerFirstName: 'bad',
        customerLastName: 'bad',
        customerEmail: 'bad',
        ssnLast4: 'bad',
      },
    });
    s = onboardingReducer(s, { type: 'SET_CUSTOMER_FIRST_NAME', value: 'a' });
    s = onboardingReducer(s, { type: 'SET_CUSTOMER_LAST_NAME', value: 'b' });
    s = onboardingReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'c@d.e' });
    s = onboardingReducer(s, { type: 'SET_SSN_LAST4', value: '1' });
    expect(s.fieldErrors).toEqual({});
  });

  it('SET_ADDRESS_FIELD updates one field; clears the keyed error; other fields untouched', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, {
      type: 'SET_FIELD_ERRORS',
      errors: { 'address.line1': 'bad', 'address.city': 'bad' },
    });
    s = onboardingReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'line1', value: '123 Main' });
    expect(s.address.line1).toBe('123 Main');
    expect(s.address.city).toBe('');
    expect(s.fieldErrors['address.line1']).toBeUndefined();
    expect(s.fieldErrors['address.city']).toBe('bad');
  });
});

describe('onboardingReducer — payment method', () => {
  it('SET_SAVED_PAYMENT_METHODS replaces the list', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, {
      type: 'SET_SAVED_PAYMENT_METHODS',
      methods: [{ id: 'pm_1' } as never, { id: 'pm_2' } as never],
    });
    expect(s.savedPaymentMethods.length).toBe(2);
  });

  it('SELECT_PAYMENT_METHOD with id and null', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SELECT_PAYMENT_METHOD', id: 'pm_1' });
    expect(s.selectedPaymentMethodId).toBe('pm_1');
    s = onboardingReducer(s, { type: 'SELECT_PAYMENT_METHOD', id: null });
    expect(s.selectedPaymentMethodId).toBeNull();
  });

  it('SET_THREE_DS_VERIFICATION_ID round-trip', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_THREE_DS_VERIFICATION_ID', id: 'tds_1' });
    expect(s.threeDsVerificationId).toBe('tds_1');
    s = onboardingReducer(s, { type: 'SET_THREE_DS_VERIFICATION_ID', id: null });
    expect(s.threeDsVerificationId).toBeNull();
  });

  it('SET_ADDRESS_VERIFICATION_ONLY flag', () => {
    let s = initialOnboardingState(baseCaps, null);
    expect(s.addressVerificationOnly).toBe(false);
    s = onboardingReducer(s, { type: 'SET_ADDRESS_VERIFICATION_ONLY', value: true });
    expect(s.addressVerificationOnly).toBe(true);
  });
});

describe('onboardingReducer — payout (ACH)', () => {
  it('SET_ACH_FIELD updates routing/account; clears keyed error', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, {
      type: 'SET_FIELD_ERRORS',
      errors: { 'ach.routingNumber': 'bad' },
    });
    s = onboardingReducer(s, { type: 'SET_ACH_FIELD', field: 'routingNumber', value: '12' });
    expect(s.ach.routingNumber).toBe('12');
    expect(s.fieldErrors['ach.routingNumber']).toBeUndefined();
  });

  it('SET_ACH_ACCOUNT_TYPE updates accountType', () => {
    let s = initialOnboardingState(baseCaps, null);
    expect(s.ach.accountType).toBe('checking');
    s = onboardingReducer(s, { type: 'SET_ACH_ACCOUNT_TYPE', value: 'savings' });
    expect(s.ach.accountType).toBe('savings');
  });

  it('SET_ACH_MANUAL_MODE toggle', () => {
    let s = initialOnboardingState(baseCaps, null);
    expect(s.achManualMode).toBe(false);
    s = onboardingReducer(s, { type: 'SET_ACH_MANUAL_MODE', value: true });
    expect(s.achManualMode).toBe(true);
  });
});

describe('onboardingReducer — documents', () => {
  it('SET_DOC_ID_TYPE writes the type', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_DOC_ID_TYPE', value: 'passport' });
    expect(s.docs.idType).toBe('passport');
  });

  it('SET_DOC_PHOTO updates only the targeted side', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, {
      type: 'SET_DOC_PHOTO',
      side: 'front',
      photo: { uri: 'file://f.jpg', type: 'image/jpeg', name: 'f.jpg' },
    });
    expect(s.docs.front).toEqual({ uri: 'file://f.jpg', type: 'image/jpeg', name: 'f.jpg' });
    expect(s.docs.back).toBeNull();
    expect(s.docs.selfie).toBeNull();
  });

  it('SET_CUSTOMER_IDENTITY_ID round-trip', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_CUSTOMER_IDENTITY_ID', id: 'civ_1' });
    expect(s.customerIdentityId).toBe('civ_1');
  });
});

describe('onboardingReducer — performing action + errors', () => {
  it('SET_PERFORMING_ACTION flips flag', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_PERFORMING_ACTION', value: true });
    expect(s.isPerformingAction).toBe(true);
    s = onboardingReducer(s, { type: 'SET_PERFORMING_ACTION', value: false });
    expect(s.isPerformingAction).toBe(false);
  });

  it('SET_FIELD_ERRORS replaces the whole map', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_FIELD_ERRORS', errors: { a: '1', b: '2' } });
    s = onboardingReducer(s, { type: 'SET_FIELD_ERRORS', errors: { c: '3' } });
    expect(s.fieldErrors).toEqual({ c: '3' });
  });

  it('CLEAR_FIELD_ERROR removes one entry', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_FIELD_ERRORS', errors: { a: '1', b: '2' } });
    s = onboardingReducer(s, { type: 'CLEAR_FIELD_ERROR', field: 'a' });
    expect(s.fieldErrors).toEqual({ b: '2' });
  });
});

describe('onboardingReducer — PREFILL', () => {
  function withTouchedName(): OnboardingState {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_CUSTOMER_FIRST_NAME', value: 'Eric' });
    return s;
  }

  it('writes empty fields', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, {
      type: 'PREFILL',
      values: { customerFirstName: 'Jane', customerEmail: 'j@d.e' },
    });
    expect(s.customerFirstName).toBe('Jane');
    expect(s.customerEmail).toBe('j@d.e');
  });

  it('does not clobber a field the user already typed', () => {
    let s = withTouchedName();
    s = onboardingReducer(s, { type: 'PREFILL', values: { customerFirstName: 'Should not win' } });
    expect(s.customerFirstName).toBe('Eric');
  });

  it('writes address fields one-by-one (still empty)', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, {
      type: 'PREFILL',
      values: {
        address: {
          line1: '1 Main',
          line2: '',
          city: 'Austin',
          state: 'TX',
          country: 'US',
          postalCode: '78701',
        },
      },
    });
    expect(s.address.line1).toBe('1 Main');
    expect(s.address.city).toBe('Austin');
    expect(s.address.postalCode).toBe('78701');
  });

  it('does not overwrite address fields the user already typed', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'SET_ADDRESS_FIELD', field: 'city', value: 'Brooklyn' });
    s = onboardingReducer(s, {
      type: 'PREFILL',
      values: {
        address: {
          line1: '1 Main',
          line2: '',
          city: 'Austin',
          state: 'TX',
          country: 'US',
          postalCode: '78701',
        },
      },
    });
    expect(s.address.line1).toBe('1 Main');
    expect(s.address.city).toBe('Brooklyn');
  });

  it('writes a null id (default) but preserves an already-set id', () => {
    let s = initialOnboardingState(baseCaps, null);
    s = onboardingReducer(s, { type: 'PREFILL', values: { accountId: 'acct_prefilled' } });
    expect(s.accountId).toBe('acct_prefilled');

    s = onboardingReducer(s, { type: 'PREFILL', values: { accountId: 'acct_should_lose' } });
    expect(s.accountId).toBe('acct_prefilled');
  });

  it('flips a default-false boolean to true; a subsequent prefill back to false is ignored', () => {
    let s = initialOnboardingState(baseCaps, null);
    expect(s.accountLoaded).toBe(false);
    s = onboardingReducer(s, { type: 'PREFILL', values: { accountLoaded: true } });
    expect(s.accountLoaded).toBe(true);
    s = onboardingReducer(s, { type: 'PREFILL', values: { accountLoaded: false } });
    expect(s.accountLoaded).toBe(true);
  });
});
