# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-04-30

### Fixed

- Android: `presentGooglePay` now reliably resolves the JS promise after the wallet sheet closes. Earlier builds delivered the result through `setResult` / `onActivityResult`, which Android occasionally dropped under the translucent host activity, leaving the spinner hung. The result is now delivered through a direct callback held by `FrameSDKModule`.
- Android: `presentCheckout`, `presentCart`, and `presentOnboarding` host activities now use a `Theme.MaterialComponents` descendant. Previously they used `Theme.AppCompat.Light.NoActionBar`, which crashed on inflate when any view in the flow embedded the Frame SDK's MaterialButton-based Google Pay button.

## [1.2.0] - 2026-04-27

### Breaking changes

- `Frame.initialize()` now requires both `secretKey` and `publishableKey`. The previous `apiKey` field has been removed. The native SDKs require both keys, and routing was always silently dropping the publishable key. Update your init call:
  ```ts
  // Before
  await Frame.initialize({ apiKey: 'sk_...', debugMode: __DEV__ });

  // After
  await Frame.initialize({
    secretKey: 'sk_...',
    publishableKey: 'pk_...',
    debugMode: __DEV__,
  });
  ```

### Added

- `Frame.presentApplePay({ amount, currency?, owner, merchantId })` (iOS) — launches the native Apple Pay sheet, creates a Frame payment method from the authorized payment, and creates and confirms a charge intent. Render your own button and call this from its `onPress`.
- `Frame.presentGooglePay({ amountCents, customerId?, currencyCode?, googlePayMerchantId? })` (Android) — launches the native Google Pay sheet, creates a Frame payment method from the wallet token, and creates and confirms a charge intent. Render your own button and call this from its `onPress`.
- New TypeScript types: `ApplePayOwner`, `PresentApplePayOptions`, `PresentGooglePayOptions`.

### Changed

- Bumped `Frame-iOS` SPM dependency to `2.0.6` — adds Plaid Link inside the onboarding payout flow, native checkout-input validation (Validators / ValidatedTextField), Apple Pay button, and the device attestation infrastructure required by Apple Pay.
- Bumped Android `framesdk` / `framesdk_ui` / `framesdk_onboarding` to `2.0.2` — adds Plaid Link inside the onboarding payout flow, Google Pay button, and native checkout validation (Validators / FieldKey / AddressMode).
- `presentOnboarding({ capabilities: ['bank_account_verification'] })` now opens Plaid Link as the primary bank-account flow on both platforms (manual entry remains as fallback). No JS API change.
- `presentCheckout` and `presentCart` now surface the new native field-level validation before allowing submission. No JS API change.

### Requirements

- iOS apps using `presentApplePay` must add the App Attest entitlement (`com.apple.developer.devicecheck.appattest-environment`) and an Apple Pay merchant ID. Apple Pay does not work in the simulator.
- Android apps using `presentGooglePay` must include the `com.google.android.gms.wallet.api.enabled` metadata flag in their manifest.

## [1.1.0] - 2026-03-30

### Added

- `Frame.presentOnboarding({ accountId?, capabilities? })` – presents the native onboarding flow (KYC, phone verification, identity verification, payment method / bank account onboarding) on iOS and Android. Returns `Promise<OnboardingResult>` with `status: 'completed' | 'cancelled'` and an optional `paymentMethodId`.
- New TypeScript types: `OnboardingCapability`, `OnboardingResult`, `OnboardingResultStatus`
- New TypeScript types for richer `ChargeIntent` sub-objects: `BillingAddress`, `PaymentCard`, `BankAccount`, `PaymentMethod`, `ChargeIntentStatus`, `AuthorizationMode`
- iOS: bridges to `OnboardingContainerView` from the `FrameOnboarding` SPM target (add `FrameOnboarding` via Xcode → File → Add Package Dependencies)
- Android: bridges to `OnboardingContainerView` from the `frameonboarding` module via a new `FrameOnboardingActivity`

### Changed

- `ChargeIntent.status` is now typed as `ChargeIntentStatus` union instead of `string`
- `ChargeIntent.shipping` is now typed as `BillingAddress` instead of `Record<string, unknown>`
- `ChargeIntent.paymentMethod` is now typed as `PaymentMethod` instead of `Record<string, unknown>`
- `ChargeIntent.authorizationMode` is now typed as `AuthorizationMode` instead of `string`

## [1.0.0] - 2025-02-17

### Added

- Initial release of `framepayments-react-native`
- `Frame.initialize({ apiKey, debugMode? })` to initialize the SDK
- `Frame.presentCheckout({ customerId?, amount })` – native checkout modal (iOS and Android)
- `Frame.presentCart({ customerId?, items, shippingAmountInCents })` – cart then checkout flow
- TypeScript types: `ChargeIntent`, `FrameCartItem`, `FrameError`, `ErrorCodes`
- Error handling: `NOT_INITIALIZED`, `USER_CANCELED`, and other standard codes
- Example app (see `example/`) demonstrating init, checkout, cart, and frame-node for listing customers
- API usage via optional peer dependency [framepayments](https://www.npmjs.com/package/framepayments) (frame-node)

### Changed

- Minimum React Native version bumped from `>=0.72.0` to `>=0.73.0`
- Added `Package.swift` — apps using Swift Package Manager no longer need to add `frame-ios` manually in Xcode; `Frame` and `FrameOnboarding` resolve automatically

### Requirements

- React Native >= 0.72
- iOS 17+ / Android API 26+
