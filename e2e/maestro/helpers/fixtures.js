// Frame's deterministic sandbox fixtures, in one place.
//
// Nothing here is invented: these are backend catalogs, shared with the web
// suite (frame-cypress). Source of truth:
//   ~/dev/frame/app/services/sandbox/test_profiles.rb
//   ~/dev/frame/app/services/core/payment_methods/test_payment_methods.rb
//
// The flow never names a literal value — everything goes through `output.*`
// from here.

// --- session inputs --------------------------------------------------------
// These come from helpers/setup-session.sh (which derives them from the same
// cypress.env.json / cypress/fixtures/<env>.json the web suite uses) and arrive
// via `maestro test -e`.
//
// Why the phone number is not a literal here: it is the KEY that decides the
// KYC outcome, and it is chosen together with the persona when the account is
// minted. Duplicating it in this file would create a second source of truth
// that drifts silently — the flow would pass against the wrong persona. The
// personas live in frame-cypress/cypress/fixtures/<env>.json, under
// `sandbox.frameOS.personas.<name>.getStarted.phone`.
function required(name, value) {
  var s = value == null ? '' : String(value);
  // Maestro leaves the literal reference in place when a variable was not passed.
  if (s === '' || s.indexOf('${') === 0) {
    throw new Error(
      name +
        ' is not set. Run via `npm run e2e:onboarding` (or ' +
        'e2e/maestro/helpers/run.sh), which mints the session and injects the ' +
        'variables. Running `maestro test` by hand does not prepare the state.',
    );
  }
  return s;
}

output.session = {
  // Freshly created account in <environment>, onboarding not yet completed.
  accountId: required('ACCOUNT_ID', ACCOUNT_ID),
  // The phone number to TYPE on the phone auth screen. Careful: it is not the
  // same one sent in the account creation payload (`apiProfile.individual.phone`).
  // Typing the payload one returns "Sandbox persona not found for phone +1…".
  phone: required('SCREEN_PHONE', SCREEN_PHONE),
  // Reporting only: proves which host the scenario ran against.
  baseUrl: required('BASE_URL', BASE_URL),
};

// --- verification fixtures -------------------------------------------------
output.otp = {
  // 123456 passes · 000000 invalid · 111111 expired
  valid: '123456',
};

output.card = {
  // Approving Visa. Digits only: the fields are keyboardType=number-pad and the
  // iOS numeric keyboard has no "/" — the field itself formats 1230 -> 12/30.
  pan: '4242424242424242',
  expiry: '1230',
  cvc: '123',
};

output.ach = {
  // Succeeding ACH. Account Type "Checking" comes pre-selected on screen.
  routing: '110000000',
  accountNumber: '000123456789',
  accountType: 'checking',
};
