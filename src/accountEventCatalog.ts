/**
 * The screen/flow an account event happened on. Values must match the shared cross-SDK
 * naming contract (FRA-6548, `docs/ACCOUNT_EVENTS.md` in frame-ios) — do not rename a
 * value here without updating that catalog too.
 */
export const AccountEventScreen = {
  ADDRESS_SEARCH: 'AddressSearch',
  APPLE_PAY: 'ApplePay',
  COMPLIANCE: 'Compliance',
  DOCUMENT_UPLOAD: 'DocumentUpload',
  GOOGLE_PAY: 'GooglePay',
  IDENTITY_VERIFICATION: 'IdentityVerification',
  ONBOARDING: 'Onboarding',
  PAYMENT_METHOD: 'PaymentMethod',
  PAYMENT_SHEET: 'PaymentSheet',
  PAYOUT_METHOD: 'PayoutMethod',
  PERSONAL_INFORMATION: 'PersonalInformation',
  PHONE_VERIFICATION: 'PhoneVerification',
  TERMS_OF_SERVICE: 'TermsOfService',
} as const;

export type AccountEventScreen = (typeof AccountEventScreen)[keyof typeof AccountEventScreen];

/**
 * The wire `name` for an account event. Values must match the shared cross-SDK naming
 * contract (FRA-6548, `docs/ACCOUNT_EVENTS.md` in frame-ios) — do not rename a value
 * here without updating that catalog too.
 */
export const AccountEventName = {
  // Onboarding — Session
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_VIEWED: 'onboarding_step_viewed',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_DECLINED: 'onboarding_declined',
  ONBOARDING_NEEDS_REVIEW: 'onboarding_needs_review',
  ONBOARDING_ACTION_REQUIRED: 'onboarding_action_required',
  ONBOARDING_CANCELLED: 'onboarding_cancelled',
  ONBOARDING_BLOCKED: 'onboarding_blocked',
  ONBOARDING_SESSION_START_FAILED: 'onboarding_session_start_failed',
  /** Predates the shared catalog's `onboarding_session_start_failed` name for the mint step specifically — left as-is; align on next touch. */
  ONBOARDING_SESSION_MINT_FAILED: 'onboarding_session_mint_failed',

  // Onboarding — Phone Verification
  PHONE_VERIFICATION_STARTED: 'phone_verification_started',
  PHONE_CODE_SENT: 'phone_code_sent',
  PHONE_CODE_RESENT: 'phone_code_resent',
  PHONE_CODE_SEND_FAILED: 'phone_code_send_failed',
  PHONE_CODE_RESEND_FAILED: 'phone_code_resend_failed',
  PHONE_CODE_ENTRY_STARTED: 'phone_code_entry_started',
  PHONE_VERIFIED: 'phone_verified',
  PHONE_CODE_INCORRECT: 'phone_code_incorrect',
  PHONE_CODE_ENTRY_CANCELLED: 'phone_code_entry_cancelled',
  SILENT_PHONE_AUTH_STARTED: 'silent_phone_auth_started',
  SILENT_PHONE_AUTH_COMPLETED: 'silent_phone_auth_completed',
  SILENT_PHONE_AUTH_FALLBACK: 'silent_phone_auth_fallback',
  SILENT_PHONE_AUTH_FAILED: 'silent_phone_auth_failed',

  // Onboarding — Profile
  PROFILE_STEP_STARTED: 'profile_step_started',
  PROFILE_UPDATED: 'profile_updated',
  PROFILE_UPDATE_FAILED: 'profile_update_failed',
  PROFILE_VALIDATION_FAILED: 'profile_validation_failed',

  // Onboarding — Identity Verification / Step-Up
  STEP_UP_STARTED: 'step_up_started',
  STEP_UP_COMPLETED: 'step_up_completed',
  STEP_UP_ALREADY_VERIFIED: 'step_up_already_verified',
  STEP_UP_FAILED: 'step_up_failed',
  STEP_UP_NEEDS_REVIEW: 'step_up_needs_review',
  STEP_UP_DATA_MISMATCH: 'step_up_data_mismatch',
  STEP_UP_ESCALATED: 'step_up_escalated',
  STEP_UP_DECLINED: 'step_up_declined',
  STEP_UP_UNAVAILABLE: 'step_up_unavailable',
  STEP_UP_CANCELLED: 'step_up_cancelled',
  STEP_UP_PROVIDER_UNAVAILABLE: 'step_up_provider_unavailable',

  // Onboarding — Payment Method
  PAYMENT_METHOD_STEP_STARTED: 'payment_method_step_started',
  SAVED_PAYMENT_METHOD_SELECTED: 'saved_payment_method_selected',
  ADD_PAYMENT_METHOD_STARTED: 'add_payment_method_started',
  PAYMENT_METHOD_ADDED: 'payment_method_added',
  PAYMENT_METHOD_ADD_FAILED: 'payment_method_add_failed',
  CARD_VALIDATION_FAILED: 'card_validation_failed',
  SAVED_PAYMENT_METHODS_LOAD_FAILED: 'saved_payment_methods_load_failed',

  // Onboarding — Payout Method
  PAYOUT_METHOD_STEP_STARTED: 'payout_method_step_started',
  SAVED_PAYOUT_METHOD_SELECTED: 'saved_payout_method_selected',
  ADD_PAYOUT_METHOD_STARTED: 'add_payout_method_started',
  PAYOUT_METHOD_ADDED: 'payout_method_added',
  PAYOUT_METHOD_ADD_FAILED: 'payout_method_add_failed',
  BANK_LINK_STARTED: 'bank_link_started',
  BANK_LINK_COMPLETED: 'bank_link_completed',
  SAVED_PAYOUT_METHODS_LOAD_FAILED: 'saved_payout_methods_load_failed',

  // Onboarding — Compliance Check
  COMPLIANCE_CHECK_STARTED: 'compliance_check_started',
  COMPLIANCE_CHECK_PASSED: 'compliance_check_passed',
  COMPLIANCE_CHECK_FAILED: 'compliance_check_failed',

  // Onboarding — Terms of Service
  TERMS_OF_SERVICE_SHOWN: 'terms_of_service_shown',
  TERMS_OF_SERVICE_ACCEPTED: 'terms_of_service_accepted',
  TERMS_OF_SERVICE_TOKEN_FAILED: 'terms_of_service_token_failed',
  TERMS_OF_SERVICE_ACCEPT_FAILED: 'terms_of_service_accept_failed',

  // Onboarding — Document Upload
  DOCUMENT_UPLOAD_STARTED: 'document_upload_started',
  DOCUMENT_PHOTO_CAPTURED: 'document_photo_captured',
  DOCUMENT_PHOTO_RETAKEN: 'document_photo_retaken',
  DOCUMENT_UPLOAD_COMPLETED: 'document_upload_completed',
  DOCUMENT_UPLOAD_FAILED: 'document_upload_failed',

  // Checkout / Payment Confirmation
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_PAYMENT_METHOD_SELECTED: 'checkout_payment_method_selected',
  CHECKOUT_VALIDATION_FAILED: 'checkout_validation_failed',
  CHECKOUT_PAYMENT_STARTED: 'checkout_payment_started',
  CARD_TOKENIZED: 'card_tokenized',
  CARD_TOKENIZATION_FAILED: 'card_tokenization_failed',
  CHECKOUT_PAYMENT_SUCCEEDED: 'checkout_payment_succeeded',
  CHECKOUT_PAYMENT_DECLINED: 'checkout_payment_declined',
  CHECKOUT_PAYMENT_FAILED: 'checkout_payment_failed',
  STEP_UP_CHALLENGE_STARTED: 'step_up_challenge_started',
  STEP_UP_CHALLENGE_COMPLETED: 'step_up_challenge_completed',
  STEP_UP_CHALLENGE_ABANDONED: 'step_up_challenge_abandoned',
  STEP_UP_CHALLENGE_UNAVAILABLE: 'step_up_challenge_unavailable',
  /** Predates the shared catalog's `step_up_challenge_timed_out` name — left as-is; align on next touch. */
  CHARGE_POLL_EXHAUSTED: 'charge_poll_exhausted',
  /** Predates the shared catalog's `step_up_challenge_timed_out` name — left as-is; align on next touch. */
  CHARGE_POLL_TIMED_OUT: 'charge_poll_timed_out',

  // Apple Pay
  APPLE_PAY_STARTED: 'apple_pay_started',
  APPLE_PAY_UNAVAILABLE: 'apple_pay_unavailable',
  APPLE_PAY_AUTHORIZED: 'apple_pay_authorized',
  APPLE_PAY_FAILED: 'apple_pay_failed',
  APPLE_PAY_CANCELLED: 'apple_pay_cancelled',
  APPLE_PAY_CARD_ADDED: 'apple_pay_card_added',
  APPLE_PAY_ASSERTION_REJECTED: 'apple_pay_assertion_rejected',

  // Google Pay
  GOOGLE_PAY_STARTED: 'google_pay_started',
  GOOGLE_PAY_UNAVAILABLE: 'google_pay_unavailable',
  GOOGLE_PAY_AUTHORIZED: 'google_pay_authorized',
  GOOGLE_PAY_FAILED: 'google_pay_failed',
  GOOGLE_PAY_CANCELLED: 'google_pay_cancelled',
  GOOGLE_PAY_MISCONFIGURED: 'google_pay_misconfigured',

  // Device Attestation
  ATTESTATION_STARTED: 'attestation_started',
  ATTESTATION_COMPLETED: 'attestation_completed',
  ATTESTATION_NOT_SUPPORTED: 'attestation_not_supported',
  /** Predates the shared catalog's `attestation_failed` name — left as-is; align on next touch. */
  DEVICE_ATTESTATION_FAILED: 'device_attestation_failed',
  ATTESTATION_RESET: 'attestation_reset',
  ATTESTATION_ASSERTION_RETRIED: 'attestation_assertion_retried',

  // Fraud Session (Sonar)
  FRAUD_SESSION_STARTED: 'fraud_session_started',
  FRAUD_SESSION_REFRESHED: 'fraud_session_refreshed',
  FRAUD_SESSION_RECREATED: 'fraud_session_recreated',
  /** Predates the shared catalog's `fraud_session_failed` name — left as-is; align on next touch. */
  SONAR_SESSION_FAILED: 'sonar_session_failed',
  FRAUD_SESSION_ADOPTED: 'fraud_session_adopted',

  // Address Search
  ADDRESS_SEARCHED: 'address_searched',
  ADDRESS_SEARCH_FAILED: 'address_search_failed',
  ADDRESS_SUGGESTION_SELECTED: 'address_suggestion_selected',
  ADDRESS_LOOKUP_FAILED: 'address_lookup_failed',
} as const;

export type AccountEventName = (typeof AccountEventName)[keyof typeof AccountEventName];

/**
 * Fixed developer-facing `detail` strings reused across account events. Dynamic details
 * (e.g. an interpolated error message) stay inline at the call site — only static,
 * repeated literals live here.
 */
export const AccountEventDetail = {
  /** For {@link AccountEventName.STEP_UP_CHALLENGE_STARTED}. */
  STEP_UP_CHALLENGE_IS_3DS: '3DS',
  /** For {@link AccountEventName.STEP_UP_CHALLENGE_COMPLETED}. */
  STEP_UP_CHALLENGE_COMPLETED_CONTEXT: 'cardholder finished the challenge UI',
  /** For {@link AccountEventName.STEP_UP_CHALLENGE_ABANDONED}. */
  STEP_UP_CHALLENGE_CARDHOLDER_DISMISSED: 'cardholder cancelled/dismissed',
  /** For {@link AccountEventName.STEP_UP_CHALLENGE_UNAVAILABLE}. */
  STEP_UP_CHALLENGE_NEVER_LOADED: 'challenge page never loaded',
  /** For {@link AccountEventName.CHARGE_POLL_EXHAUSTED}. */
  CHARGE_POLL_RELOAD_FAILED: 'reload failed on final poll attempt',
  /** For {@link AccountEventName.CHECKOUT_PAYMENT_STARTED}. */
  CHECKOUT_PAY_BUTTON_TAPPED: 'pay button tapped',
  /** For {@link AccountEventName.CARD_TOKENIZATION_FAILED}, {@link AccountEventName.PAYMENT_METHOD_ADD_FAILED}, and {@link AccountEventName.PAYOUT_METHOD_ADD_FAILED}. */
  NO_PAYMENT_METHOD_ID_RETURNED: 'Frame returned no payment method id.',
  /** For {@link AccountEventName.CHECKOUT_PAYMENT_FAILED}. */
  CHECKOUT_NO_TRANSFER_ID: 'Frame returned no transfer id.',
  /** For {@link AccountEventName.CHECKOUT_PAYMENT_FAILED}. */
  CHECKOUT_CONFIRMATION_TIMED_OUT: 'confirmation timed out',
  /** For {@link AccountEventName.ONBOARDING_COMPLETED}. */
  ONBOARDING_COMPLETED_APPROVED: 'approved',
  /** For {@link AccountEventName.ONBOARDING_SESSION_START_FAILED}. */
  ONBOARDING_SESSION_NO_ACCOUNT_ID: 'no account id returned',
  /** For {@link AccountEventName.SILENT_PHONE_AUTH_STARTED} and {@link AccountEventName.SILENT_PHONE_AUTH_COMPLETED}. */
  PROVE_PROVIDER: 'provider: prove',
  /** For {@link AccountEventName.STEP_UP_STARTED}. */
  PERSONA_PROVIDER: 'provider: persona',
  /** For {@link AccountEventName.STEP_UP_UNAVAILABLE} (generic bucket, not category-derived). */
  STEP_UP_CATEGORY_TRANSIENT: 'category: transient',
  /** For {@link AccountEventName.PAYOUT_METHOD_STEP_STARTED}-cluster manual-entry path. */
  PAYOUT_METHOD_MANUAL: 'manual',
  /** For {@link AccountEventName.PAYOUT_METHOD_ADDED} manual-entry path. */
  PAYOUT_METHOD_MANUAL_ACH: 'manual ACH',
  /** For {@link AccountEventName.ADD_PAYOUT_METHOD_STARTED} and {@link AccountEventName.BANK_LINK_STARTED}/{@link AccountEventName.BANK_LINK_COMPLETED} Plaid path. */
  PLAID_PROVIDER: 'provider: plaid',
  /** For {@link AccountEventName.ADD_PAYOUT_METHOD_STARTED} Plaid path. */
  PAYOUT_METHOD_PLAID: 'plaid',
  /** For {@link AccountEventName.FRAUD_SESSION_RECREATED}. */
  FRAUD_SESSION_REFRESH_FELL_BACK_TO_RECREATE: 'refresh failed, fell back to creating fresh',
  /** For {@link AccountEventName.FRAUD_SESSION_ADOPTED}. */
  FRAUD_SESSION_ADOPTED_FROM_ANONYMOUS: 'pre-account session migrated to account-scoped',
  /** For {@link AccountEventName.SONAR_SESSION_FAILED}. */
  SONAR_SESSION_FAILED_ON_ENTRY: 'establishSession failed on flow entry',
  /** For {@link AccountEventName.APPLE_PAY_UNAVAILABLE} and {@link AccountEventName.GOOGLE_PAY_UNAVAILABLE}. */
  WALLET_UNAVAILABLE_MERCHANT_ID: 'merchant id',
  /** For {@link AccountEventName.APPLE_PAY_CANCELLED} and {@link AccountEventName.GOOGLE_PAY_CANCELLED}. */
  WALLET_SHEET_DISMISSED_NO_RESULT: 'sheet dismissed with no result',
  /** For {@link AccountEventName.APPLE_PAY_CARD_ADDED}. */
  APPLE_PAY_ADD_TO_OWNER_MODE: 'mode: add-to-owner',
  /** For {@link AccountEventName.GOOGLE_PAY_MISCONFIGURED}. */
  GOOGLE_PAY_MISCONFIGURED_REASON: 'invalid processor from backend config',
  /** For {@link AccountEventName.ADDRESS_LOOKUP_FAILED}. */
  ADDRESS_LOOKUP_NO_FEATURE_RETURNED: 'no feature returned',
} as const;

export type AccountEventDetail = (typeof AccountEventDetail)[keyof typeof AccountEventDetail];
