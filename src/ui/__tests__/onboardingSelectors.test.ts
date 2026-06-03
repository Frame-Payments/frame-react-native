import {
  initialOnboardingState,
  onboardingReducer,
  type OnboardingState,
} from '../screens/onboarding/onboardingReducer';
import {
  computeFlow,
  entrySubStep,
  isAchValid,
  isCardSubmittable,
  isCustomerInformationValid,
  isOtpValid,
  isPhoneAuthValid,
  nextStep as selectorNextStep,
  previousStep as selectorPreviousStep,
  requiresDobInPhoneAuth,
  requiresTosInPhoneAuth,
  validateAch,
  validateAddress,
  validateCustomerInformation,
  validateOtp,
  validatePhoneAuth,
  areDocsComplete,
} from '../screens/onboarding/onboardingSelectors';
import type { OnboardingCapability } from '../../types';

function fillUS(s: OnboardingState): OnboardingState {
  let next = s;
  next = onboardingReducer(next, { type: 'SET_ADDRESS_FIELD', field: 'line1', value: '1 Main' });
  next = onboardingReducer(next, { type: 'SET_ADDRESS_FIELD', field: 'city', value: 'Austin' });
  next = onboardingReducer(next, { type: 'SET_ADDRESS_FIELD', field: 'state', value: 'TX' });
  next = onboardingReducer(next, { type: 'SET_ADDRESS_FIELD', field: 'postalCode', value: '78701' });
  return next;
}

describe('computeFlow — capability → step mapping', () => {
  it('always includes verification_welcome and verification_submitted', () => {
    expect(computeFlow([])).toEqual(['verification_welcome', 'verification_submitted']);
  });

  it('adds personal_information for KYC capabilities', () => {
    // iOS-parity (OnboardingContainerView.swift:32-40 + commented-out
    // .uploadDocuments case at line 101-104): `kyc` maps to
    // `.personalInformation`, NOT to a separate document-upload step.
    expect(computeFlow(['kyc'])).toEqual([
      'verification_welcome',
      'personal_information',
      'verification_submitted',
    ]);
  });

  it('adds personal_information for phone_verification', () => {
    expect(computeFlow(['phone_verification'])).toContain('personal_information');
  });

  it('adds confirm_payment_method for card_send', () => {
    expect(computeFlow(['card_send'])).toContain('confirm_payment_method');
  });

  it('adds confirm_bank_account for bank_account_receive', () => {
    expect(computeFlow(['bank_account_receive'])).toContain('confirm_bank_account');
  });

  it('neither kyc nor kyc_prefill adds upload_documents (iOS parity)', () => {
    // iOS UserIdentificationView handles `kyc` inside personal_information.
    // The `.uploadDocuments` step exists in the enum but is commented out
    // in OnboardingContainerView.swift; do not activate it on RN until iOS
    // activates it.
    expect(computeFlow(['kyc'])).not.toContain('upload_documents');
    expect(computeFlow(['kyc_prefill'])).not.toContain('upload_documents');
  });

  // Locks in 1:1 parity with the native Frame iOS / Frame Android flow
  // mappings. Verified against frame-ios/Sources/FrameOnboarding/Views/
  // OnboardingContainerView.swift and frame-android/.../Onboarding.kt.
  it('card_verification, card_send, card_receive, and address_verification all route to confirm_payment_method', () => {
    const cardCaps: OnboardingCapability[] = ['card_verification', 'card_send', 'card_receive', 'address_verification'];
    for (const cap of cardCaps) {
      expect(computeFlow([cap])).toContain('confirm_payment_method');
    }
  });

  it('bank_account_verification, bank_account_send, and bank_account_receive all route to confirm_bank_account', () => {
    const bankCaps: OnboardingCapability[] = ['bank_account_verification', 'bank_account_send', 'bank_account_receive'];
    for (const cap of bankCaps) {
      expect(computeFlow([cap])).toContain('confirm_bank_account');
    }
  });

  it('creator_shield routes to personal_information (mirrors native SDK behavior; no dedicated screen)', () => {
    expect(computeFlow(['creator_shield'])).toContain('personal_information');
    expect(entrySubStep('personal_information', ['creator_shield'])).toBe('phone_auth');
  });

  it('full-stack: kyc + card_verification + bank_account_send', () => {
    expect(computeFlow(['kyc', 'card_verification', 'bank_account_send'])).toEqual([
      'verification_welcome',
      'personal_information',
      'confirm_payment_method',
      'confirm_bank_account',
      'verification_submitted',
    ]);
  });

  it('showIntroScreen=false omits verification_welcome', () => {
    expect(computeFlow(['kyc'], false)).not.toContain('verification_welcome');
    expect(computeFlow(['kyc'], false)).toContain('verification_submitted');
    expect(computeFlow(['kyc'], false)[0]).toBe('personal_information');
  });

  it('showCompletionScreen=false omits verification_submitted', () => {
    expect(computeFlow(['kyc'], true, false)).not.toContain('verification_submitted');
    expect(computeFlow(['kyc'], true, false)).toContain('verification_welcome');
    const flow = computeFlow(['kyc'], true, false);
    expect(flow[flow.length - 1]).toBe('personal_information');
  });

  it('both false produces only capability steps', () => {
    expect(computeFlow(['kyc', 'card_send'], false, false)).toEqual([
      'personal_information',
      'confirm_payment_method',
    ]);
  });

  it('both false with empty capabilities produces an empty flow', () => {
    expect(computeFlow([], false, false)).toEqual([]);
  });
});

describe('entrySubStep', () => {
  it('verification_welcome has null sub-step', () => {
    expect(entrySubStep('verification_welcome', [])).toBeNull();
  });

  it('personal_information defaults to phone_auth when any phone-touching capability present', () => {
    expect(entrySubStep('personal_information', ['kyc'])).toBe('phone_auth');
    expect(entrySubStep('personal_information', ['kyc_prefill'])).toBe('phone_auth');
    expect(entrySubStep('personal_information', ['geo_compliance'])).toBe('phone_auth');
  });

  it('personal_information for age_verification-only skips straight to customer_information', () => {
    expect(entrySubStep('personal_information', ['age_verification'])).toBe('customer_information');
  });

  it('confirm_payment_method enters at select', () => {
    expect(entrySubStep('confirm_payment_method', ['card_send'])).toBe('select');
  });

  it('confirm_bank_account enters at select', () => {
    expect(entrySubStep('confirm_bank_account', ['bank_account_send'])).toBe('select');
  });

  it('upload_documents enters at list', () => {
    expect(entrySubStep('upload_documents', ['kyc'])).toBe('list');
  });

  it('verification_submitted has null sub-step', () => {
    expect(entrySubStep('verification_submitted', [])).toBeNull();
  });
});

describe('nextStep / previousStep', () => {
  function setupFlow(caps: ReadonlyArray<OnboardingCapability>): OnboardingState {
    const flow = computeFlow(caps);
    let s = initialOnboardingState(caps, null);
    s = onboardingReducer(s, {
      type: 'SET_FLOW',
      flow,
      currentStep: flow[0]!,
      subStep: entrySubStep(flow[0]!, caps),
    });
    return s;
  }

  it('moves forward through the flow', () => {
    let s = setupFlow(['kyc']);
    expect(selectorNextStep(s)).toBe('personal_information');
    s = { ...s, currentStep: 'personal_information' };
    expect(selectorNextStep(s)).toBe('verification_submitted');
    s = { ...s, currentStep: 'verification_submitted' };
    expect(selectorNextStep(s)).toBeNull();
  });

  it('previousStep returns null at the start', () => {
    const s = setupFlow(['kyc']);
    expect(selectorPreviousStep(s)).toBeNull();
  });
});

describe('requiresDobInPhoneAuth / requiresTosInPhoneAuth', () => {
  it('DOB shown only for kyc_prefill', () => {
    expect(requiresDobInPhoneAuth(['kyc_prefill'])).toBe(true);
    expect(requiresDobInPhoneAuth(['kyc'])).toBe(false);
    expect(requiresDobInPhoneAuth(['phone_verification'])).toBe(false);
  });

  it('TOS shown only for geo_compliance', () => {
    expect(requiresTosInPhoneAuth(['geo_compliance'])).toBe(true);
    expect(requiresTosInPhoneAuth(['kyc'])).toBe(false);
  });
});

describe('validatePhoneAuth', () => {
  it('empty phone fails', () => {
    const s = initialOnboardingState(['kyc'], null);
    expect(validatePhoneAuth(s).phoneNumber).toBeDefined();
  });

  it('valid US phone passes (no DOB, no TOS)', () => {
    let s = initialOnboardingState(['phone_verification'], null);
    s = onboardingReducer(s, { type: 'SET_PHONE_NUMBER', value: '4155551212' });
    expect(isPhoneAuthValid(s)).toBe(true);
  });

  it('kyc_prefill requires DOB', () => {
    let s = initialOnboardingState(['kyc_prefill'], null);
    s = onboardingReducer(s, { type: 'SET_PHONE_NUMBER', value: '4155551212' });
    expect(validatePhoneAuth(s).dob).toBeDefined();
    s = onboardingReducer(s, { type: 'SET_DOB', month: '03', day: '15', year: '1990' });
    expect(validatePhoneAuth(s).dob).toBeUndefined();
  });

  it('geo_compliance does NOT add an acceptedTos validation error (iOS parity)', () => {
    // iOS UserIdentificationView shows the TermsOfServiceView text when
    // geo_compliance is requested, but `validateAllPhoneAuth`
    // (OnboardingContainerViewModel.swift:583-600) only checks phone + DOB.
    // Acceptance is implicit on Continue tap; the TOS payload is attached
    // to the account create/update call regardless.
    let s = initialOnboardingState(['geo_compliance'], null);
    s = onboardingReducer(s, { type: 'SET_PHONE_NUMBER', value: '4155551212' });
    expect(validatePhoneAuth(s).acceptedTos).toBeUndefined();
  });
});

describe('validateOtp', () => {
  it('rejects sub-6-digit input', () => {
    let s = initialOnboardingState(['phone_verification'], null);
    s = onboardingReducer(s, { type: 'SET_OTP_CODE', value: '123' });
    expect(isOtpValid(s)).toBe(false);
  });

  it('accepts exactly 6 digits', () => {
    let s = initialOnboardingState(['phone_verification'], null);
    s = onboardingReducer(s, { type: 'SET_OTP_CODE', value: '123456' });
    expect(isOtpValid(s)).toBe(true);
  });

  it('rejects 6 chars with non-digit', () => {
    let s = initialOnboardingState(['phone_verification'], null);
    s = onboardingReducer(s, { type: 'SET_OTP_CODE', value: '12345A' });
    expect(validateOtp(s).otpCode).toBeDefined();
  });
});

describe('validateCustomerInformation', () => {
  function valid(s: OnboardingState): OnboardingState {
    let next = s;
    next = onboardingReducer(next, { type: 'SET_CUSTOMER_FIRST_NAME', value: 'Eric' });
    next = onboardingReducer(next, { type: 'SET_CUSTOMER_LAST_NAME', value: 'Townsend' });
    next = onboardingReducer(next, { type: 'SET_CUSTOMER_EMAIL', value: 'eric@example.com' });
    next = onboardingReducer(next, { type: 'SET_DOB', month: '03', day: '15', year: '1990' });
    next = fillUS(next);
    return next;
  }

  it('age_verification path requires DOB on this screen', () => {
    let s = initialOnboardingState(['age_verification'], null);
    s = onboardingReducer(s, { type: 'SET_CUSTOMER_FIRST_NAME', value: 'Eric' });
    s = onboardingReducer(s, { type: 'SET_CUSTOMER_LAST_NAME', value: 'Townsend' });
    s = onboardingReducer(s, { type: 'SET_CUSTOMER_EMAIL', value: 'eric@example.com' });
    s = fillUS(s);
    expect(validateCustomerInformation(s).dob).toBeDefined();
    s = onboardingReducer(s, { type: 'SET_DOB', month: '03', day: '15', year: '1990' });
    expect(validateCustomerInformation(s).dob).toBeUndefined();
  });

  it('kyc requires SSN-last-4', () => {
    let s = initialOnboardingState(['kyc'], null);
    s = valid(s);
    expect(validateCustomerInformation(s).ssnLast4).toBeDefined();
    s = onboardingReducer(s, { type: 'SET_SSN_LAST4', value: '1234' });
    expect(validateCustomerInformation(s).ssnLast4).toBeUndefined();
  });

  it('full valid kyc state', () => {
    let s = initialOnboardingState(['kyc'], null);
    s = valid(s);
    s = onboardingReducer(s, { type: 'SET_SSN_LAST4', value: '1234' });
    expect(isCustomerInformationValid(s)).toBe(true);
  });
});

describe('validateAddress', () => {
  it('required mode: empty address fails', () => {
    const errors = validateAddress(
      { line1: '', line2: '', city: '', state: '', country: 'US', postalCode: '' },
      true,
    );
    expect(errors['address.line1']).toBeDefined();
    expect(errors['address.city']).toBeDefined();
    expect(errors['address.state']).toBeDefined();
    expect(errors['address.postalCode']).toBeDefined();
  });

  it('US uses zip validator', () => {
    const errors = validateAddress(
      { line1: '1', line2: '', city: 'a', state: 'b', country: 'US', postalCode: '1234' },
      true,
    );
    expect(errors['address.postalCode']).toBeDefined();
  });

  it('non-US falls back to postal-code validator or non-empty', () => {
    const errors = validateAddress(
      { line1: '1', line2: '', city: 'a', state: 'b', country: 'CA', postalCode: 'K1A 0B1' },
      true,
    );
    expect(errors['address.postalCode']).toBeUndefined();
  });

  it('not-required mode short-circuits', () => {
    const errors = validateAddress(
      { line1: '', line2: '', city: '', state: '', country: 'US', postalCode: '' },
      false,
    );
    expect(errors).toEqual({});
  });
});

describe('validateAch', () => {
  function validUSAddress(): OnboardingState['address'] {
    return { line1: '1', line2: '', city: 'a', state: 'TX', country: 'US', postalCode: '78701' };
  }

  it('rejects invalid routing', () => {
    const errors = validateAch(
      { routingNumber: '12', accountNumber: '12345', accountType: 'checking' },
      validUSAddress(),
    );
    expect(errors['ach.routingNumber']).toBeDefined();
  });

  it('rejects 3-digit account number', () => {
    const errors = validateAch(
      { routingNumber: '021000021', accountNumber: '123', accountType: 'checking' },
      validUSAddress(),
    );
    expect(errors['ach.accountNumber']).toBeDefined();
  });

  it('rejects non-US billing', () => {
    const errors = validateAch(
      { routingNumber: '021000021', accountNumber: '12345', accountType: 'checking' },
      { ...validUSAddress(), country: 'CA' },
    );
    expect(errors['address.country']).toBeDefined();
  });

  it('valid 9-digit ABA + 5-digit account + US billing passes', () => {
    let s = initialOnboardingState(['bank_account_send'], null);
    s = onboardingReducer(s, { type: 'SET_ACH_FIELD', field: 'routingNumber', value: '021000021' });
    s = onboardingReducer(s, { type: 'SET_ACH_FIELD', field: 'accountNumber', value: '12345' });
    s = fillUS(s);
    expect(isAchValid(s)).toBe(true);
  });
});

describe('isCardSubmittable', () => {
  it('address-only mode requires only address fields', () => {
    let s = initialOnboardingState(['address_verification'], null);
    s = onboardingReducer(s, { type: 'SET_ADDRESS_VERIFICATION_ONLY', value: true });
    expect(isCardSubmittable(s)).toBe(false);
    s = fillUS(s);
    expect(isCardSubmittable(s)).toBe(true);
  });

  it('full mode requires cardComplete + address', () => {
    let s = initialOnboardingState(['card_send'], null);
    s = fillUS(s);
    expect(isCardSubmittable(s)).toBe(false);
    s = onboardingReducer(s, { type: 'SET_CARD_COMPLETE', value: true });
    expect(isCardSubmittable(s)).toBe(true);
  });
});

describe('areDocsComplete', () => {
  function withPhoto(side: 'front' | 'back' | 'selfie') {
    return { type: 'SET_DOC_PHOTO' as const, side, photo: { uri: 'f', type: 'image/jpeg', name: 'n' } };
  }

  it('no id type → incomplete', () => {
    const s = initialOnboardingState(['kyc'], null);
    expect(areDocsComplete(s)).toBe(false);
  });

  it('driver license requires front + back + selfie', () => {
    let s = initialOnboardingState(['kyc'], null);
    s = onboardingReducer(s, { type: 'SET_DOC_ID_TYPE', value: 'drivers_license' });
    s = onboardingReducer(s, withPhoto('front'));
    expect(areDocsComplete(s)).toBe(false);
    s = onboardingReducer(s, withPhoto('back'));
    expect(areDocsComplete(s)).toBe(false);
    s = onboardingReducer(s, withPhoto('selfie'));
    expect(areDocsComplete(s)).toBe(true);
  });

  it('passport requires only front + selfie (single-page)', () => {
    let s = initialOnboardingState(['kyc'], null);
    s = onboardingReducer(s, { type: 'SET_DOC_ID_TYPE', value: 'passport' });
    s = onboardingReducer(s, withPhoto('front'));
    expect(areDocsComplete(s)).toBe(false);
    s = onboardingReducer(s, withPhoto('selfie'));
    expect(areDocsComplete(s)).toBe(true);
  });

  it('state_id requires front + back + selfie (like drivers license)', () => {
    let s = initialOnboardingState(['kyc'], null);
    s = onboardingReducer(s, { type: 'SET_DOC_ID_TYPE', value: 'state_id' });
    s = onboardingReducer(s, withPhoto('front'));
    s = onboardingReducer(s, withPhoto('selfie'));
    expect(areDocsComplete(s)).toBe(false); // missing back
    s = onboardingReducer(s, withPhoto('back'));
    expect(areDocsComplete(s)).toBe(true);
  });

  it('military_id requires front + back + selfie', () => {
    let s = initialOnboardingState(['kyc'], null);
    s = onboardingReducer(s, { type: 'SET_DOC_ID_TYPE', value: 'military_id' });
    s = onboardingReducer(s, withPhoto('front'));
    s = onboardingReducer(s, withPhoto('selfie'));
    expect(areDocsComplete(s)).toBe(false);
    s = onboardingReducer(s, withPhoto('back'));
    expect(areDocsComplete(s)).toBe(true);
  });
});
