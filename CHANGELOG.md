# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
