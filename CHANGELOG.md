# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.4.0] - 2026-08-26

### Added

- **`Frame.presentSelectPayoutMethod`**, backed by frame-ios 4.4.1's new
  `FrameSelectPayoutMethodView`. Presents a standalone "choose the primary payout
  account" screen: it lists the account's saved ACH payout methods, lets the user
  add a new one, and elects the chosen method as the account's payout destination.
  Where `presentAddPayoutMethod` only adds a bank, this also makes it primary — on
  success `methodId` is the newly *elected* method.

  Election is an account-scoped write (`POST /v1/accounts/:id/elect_payout_method`),
  so it needs an onboarding-session client secret (`onb_sess_…`) or a secret key; a
  publishable key is rejected by the API. iOS-only — frame-android 3.0.2 has no
  equivalent screen, so this throws `PLATFORM_UNSUPPORTED` on Android.

### Changed

- **frame-ios: `4.3.0` → `4.4.2`** (via `4.3.6` and `4.4.1`; neither intermediate
  bump was released on its own, so their notes are folded in below).
- **4.4.2 fixes the onboarding-session token leak (FRA-6358).** The standalone
  add/select-method screens gated session teardown on the host having supplied a
  `clientSecret`, so a session the flow minted itself was never cleared — and because
  the token is a process-wide singleton that outranks the publishable key, every
  later `pk_`-authenticated request (checkout 3DS confirm, terms of service, device
  attestation) went out as the stale session. Checkout entered after
  `presentSelectPayoutMethod` failed; a fresh launch worked. The fix is internal to
  the native SDK — the public initializers the bridge calls are unchanged, so no
  RN-side change was required.
- **BREAKING (iOS): `presentOnboarding` now resolves `accountId` instead of
  `paymentMethodId`.** frame-ios 4.3.6 changed what `OnboardingContainerView`
  emits on success — the onboarded account's id rather than the selected payment
  method's — without changing the `FrameResult.completed(id:)` signature, so this
  would otherwise have compiled clean and mislabeled the value at runtime. Use
  `result.accountId` to scope follow-up calls (checkout loads payment methods per
  account). Still true in 4.4.1: verified that `OnboardingContainerView` emits the
  account id. (The upstream doc comment on `FrameResult` still says "PaymentMethod
  id" — that comment is stale, not the behavior.)

  Android is unaffected and still resolves `paymentMethodId`: frame-android 3.0.2
  genuinely returns a payment method id. The two platforms therefore return
  different resources for the same call — check for the field you need rather
  than assuming one is present. They will converge once frame-android also
  returns an account id.
- The rest of the 4.4.1 delta arrives with no RN-side change — all of it lives
  inside the native SDK:
  - **Charge-time 3D Secure now works.** 4.4.1 adds the full flow: confirm the
    charge intent, present the issuer challenge in a web view, then poll to a
    terminal status. Previously the "3DS" path in checkout could not complete.
    Card transfers are now created with `confirm: false` so a card the issuer wants
    to challenge is no longer rejected before the challenge can run.
  - **Lenient response decoding.** A single malformed optional field no longer fails
    an entire API model, so a backend change to one unused field can't break an
    unrelated screen.
  - **One config request per launch instead of six.** `GET /v1/config/all` marks each
    block fresh and the five consumers then resolve from that cache rather than
    re-requesting their own endpoints. 4.4.1 shipped the aggregate call but no
    cache-first read, so init actually made one *extra* request; 4.4.2 fixed it
    (FRA-6358). Freshness is process-scoped, not keychain-scoped, so each launch
    still refetches once and a rotated credential is picked up. Consumers also now
    run concurrently instead of serially, and card tokenization waits for Evervault
    configuration rather than racing it.
  - **Mapbox address autocomplete** on billing-address fields, and country-aware
    subregion (state/province) validation for non-US addresses. The Mapbox token is
    served by the Frame API — no host-app configuration and no new dependency.

  No new CocoaPods/SPM dependency, and the iOS deployment target stays at 17.0.

### Known issues

- **Auth-token precedence still favours the onboarding session over an explicit
  publishable-key request.** frame-ios 4.4.1 reordered token selection so an active
  `onb_sess_…` outranks a `.publishable` request. Account-scoped reads need that to
  receive `profile`, but merchant-level endpoints (`terms_of_service`,
  `device_attestation`) are documented upstream as accepting only a `pk_`.

  The leak that made this bite in practice is fixed in 4.4.2 (FRA-6358) — sessions
  no longer outlive the screen that opened them, so checkout after
  `presentSelectPayoutMethod` works. The ordering itself is unchanged, so the
  narrower risk remains for calls made *during* an onboarding session. Worth
  confirming on device that terms-of-service and device-attestation succeed
  mid-onboarding. Entirely inside the native SDK; no RN-side change can affect it.
- **Sonar session upkeep across app backgrounding is still not wired up.** frame-ios
  4.3.6 added `SessionManager.pause()` / `resume()`, but the bridge registers no
  `UIApplication` lifecycle observers, so a backgrounded session can still expire
  silently; tracked separately. Session creation and the per-view refresh remain
  automatic and needed no RN change.

## [3.3.0] - 2026-08-10

### Added

- **`Frame.presentAddPaymentMethod` / `Frame.presentAddPayoutMethod`**, backed by
  frame-ios 4.3.0's new `FrameAddPaymentMethodView` / `FrameAddPayoutMethodView`.
  Presents the same card/bank-account entry screens used during onboarding, but
  standalone — call it at any point after a user already has an account, without
  running the full onboarding flow. iOS-only for now; frame-android has no
  equivalent standalone screen yet, so both throw `PLATFORM_UNSUPPORTED` on
  Android. Use `Frame.presentOnboarding` with the relevant capability there.
- **`idv` onboarding capability**, matching frame-ios 4.3.0's new
  government-ID-verification capability. Gates the existing no-SSN Persona step
  in `Frame.presentOnboarding` the same way other capabilities do — no new
  bridge method needed. iOS-only; frame-android has no matching capability yet
  and silently ignores the string if passed.

### Changed

- **frame-ios: `4.2.1` → `4.3.0`.** Also ships an internal fix for broken
  privacy-policy/terms-of-service links and an address-autofill fix in the
  bundled checkout/onboarding forms; neither required an RN-side change.

## [3.2.0] - 2026-07-29

### Added

- **Publishable-key-first initialization on Android.** `secretKey` is now optional
  in `Frame.initialize` on Android as well, closing the last platform asymmetry
  from 3.1.0. When omitted, the bridge passes an empty secret key to
  frame-android, which authenticates client-side flows with the publishable key.
  Existing calls passing both keys keep working unchanged.
- **Onboarding sessions on Android.** `Frame.presentOnboarding`'s `clientSecret`
  (`onb_sess_…`) is now honored on Android instead of being accepted and
  discarded. It is threaded into `OnboardingConfig`, and frame-android's
  `OnboardingContainerView` begins and ends the session around the flow.
- **Persona no-SSN government-ID verification on Android**, via frame-android
  3.x — matching the iOS capability added in 3.1.0. The camera permission is
  declared by frame-android's onboarding module and merges into the host app, so
  no manifest change is required.

### Changed

- **frame-android: `2.1.0` → `3.0.2`.** Note that `3.0.0` was tagged but never
  published to Maven Central (its publish workflow failed); `3.0.1` was the first
  published 3.x release. `3.0.2` additionally fixes government-ID verification
  never launching the Persona SDK on the publishable-key path — without it, the
  no-SSN onboarding step mints an inquiry and then silently does nothing.
- `theme` is documented as supported on both platforms. It has been implemented
  on Android since 2.0.7 — the "no-op on Android" notes in `src/native.ts` and
  `src/types.ts` were stale, and the latter referenced a `Frame.setTheme()`
  method that does not exist.

### Fixed

- **Google Pay activity request-code collision.** `FrameGooglePayActivity` used
  request code `9003`, the same as `FrameOnboardingActivity`, which made its
  branch in `onActivityResult` unreachable. Moved to `9004`. No behavior change
  today — Google Pay results route through a static callback rather than
  `startActivityForResult` — but it removes a latent misrouting bug.

## [3.1.0] - 2026-07-27

### Added

- **Publishable-key-first initialization (iOS).** `secretKey` is now optional in
  `Frame.initialize` on iOS — Frame-iOS 4.x authenticates client-side flows with
  the publishable key, so apps no longer need to ship an `sk_` key. Existing
  calls passing both keys keep working unchanged. `secretKey` remains required
  on Android until frame-android supports publishable-key-first initialization.
- **Onboarding sessions.** `Frame.presentOnboarding` accepts an optional
  `clientSecret` (`onb_sess_…` token minted server-side via
  `POST /v1/onboarding_sessions`). When provided, the onboarding flow
  authenticates with that session instead of the legacy secret-key path.
  iOS-only; ignored on Android.

### Changed

- Frame-iOS: `3.0.4` → `4.2.1`. Resolved automatically on the next
  `pod install`; no consumer code or Podfile changes required. Consumers who
  added the Frame-iOS package manually in Xcode (the manual-setup fallback)
  must bump that pin to `4.2.1` themselves. Onboarding now pulls in Persona's
  `PersonaInquirySDK2` transitively for the no-SSN government-ID verification
  step.
- iOS native bridge: `presentOnboarding` selector gained a trailing
  `clientSecret:` argument; `initialize`'s `secretKey` argument is now nullable.
  Consumers calling the bridge from custom Objective-C code (uncommon) must
  update their selectors.

### Fixed

- iOS: Apple Pay results are now delivered after the payment sheet has fully
  dismissed instead of inline from the authorization callback. On iOS 26+,
  resolving early let JS dismiss its own modal while the Apple Pay sheet was
  still up, stranding the sheet on screen. (Mirrors the same fix in
  Frame-iOS 4.x's `FrameApplePayViewModel`.)
- iOS: account-owner Apple Pay charges now establish a risk session
  (`SessionManager.ensureSession`) before creating the transfer — the server
  rejects the transfer without one.
- iOS: if payment-method creation fails because the device assertion was
  rejected, the stored App Attest key is reset so the next attempt
  re-attests, matching Frame-iOS 4.x behavior.
- iOS: device-attestation keychain keys are namespaced per App Attest
  environment (via Frame-iOS 4.x), fixing development keys leaking into
  TestFlight/production builds.

## [3.0.1] - 2026-05-18

### Breaking

- **Wallet merchant IDs moved to `Frame.initialize`.** Apple Pay and Google Pay merchant IDs are now configured once at init time and become the single source of truth for every wallet surface (`presentApplePay`, `presentGooglePay`, the bundled checkout's wallet row, the onboarding wallet attach step). The per-call `merchantId` / `googlePayMerchantId` / `applePayMerchantId` options have been removed from `presentApplePay`, `presentGooglePay`, and `presentOnboarding`.
  ```ts
  // Before (3.0.0)
  await Frame.initialize({ secretKey, publishableKey });
  await Frame.presentApplePay({ amount, owner, merchantId: 'merchant.com.yourapp' });

  // After (3.0.1)
  await Frame.initialize({
    secretKey,
    publishableKey,
    applePayMerchantId: 'merchant.com.yourapp',
    googlePayMerchantId: 'BCR2DN4T...',
  });
  await Frame.presentApplePay({ amount, owner });
  ```
  `presentApplePay` / `presentGooglePay` now reject with `INVALID_MERCHANT_ID` if the corresponding merchant ID was not configured at init.

### Changed

- Frame-iOS: `2.2.2` → `2.2.3`.
- Frame-Android: `2.0.8` → `2.0.9`.
- iOS native bridge: `initialize` selector gained `applePayMerchantId:` and `googlePayMerchantId:` arguments; `presentApplePay` lost its trailing `merchantId:` argument; `presentOnboarding` lost its trailing wallet-merchant-id argument. Consumers depending on the bridge from custom Objective-C code (uncommon) must update their selectors.

### Fixed

- iOS: `Frame.initialize` no longer crashes with `-[__NSMallocBlock__ count]: unrecognized selector` when called from apps consuming the compiled package. The bridge's argument list grew (see Changed) but `lib/native.js` was stale on disk, so the JS call sent only 4 user args instead of 6. RN appended the resolve/reject blocks after the 4 args, which landed the reject block in the `theme:` slot; the Swift `as? [String: Any]` bridge cast then called `-count` on a block. Rebuilt `lib/` ships the correct call. Going forward, `prepublishOnly` guarantees a fresh build on every publish.

### Notes

- README documents the new init-time merchant ID flow and adds an end-to-end Apple Pay setup walkthrough (merchant identifier → Xcode capability → init → Frame-side enablement).

## [3.0.0] - 2026-05-14

### Breaking

- **React Native floor raised to 0.81**. The iOS autolinking path uses RN's
  `spm_dependency` Podfile hook, which stabilized in 0.81.

### Added

- **True iOS autolinking.** `pod install` now resolves Frame-iOS + Frame-Onboarding
  automatically via RN's SPM hook. The manual Xcode "File → Add Package
  Dependencies" step is gone — installation is just `npm install` + `pod install`.
- **Single source of truth for native SDK versions.** Bump frame-android by
  editing one field (`package.json:frameNativeVersions.android`); the podspec
  and `build.gradle` both read it. Frame-iOS still needs a paired bump in
  `Package.swift` (SPM manifests can't read JSON).
- JS-side `Platform.OS` guards on `presentApplePay` (iOS-only) and `presentGooglePay`
  (Android-only). Both throw `PLATFORM_UNSUPPORTED` if called on the wrong platform.

### Changed

- Frame-iOS floor: 2.2.2.
- Frame-Android: 2.0.7 → 2.0.8.

### Fixed

- iOS: `presentCheckout` Promise no longer hangs when the user swipes the sheet
  away without completing payment. Replaced the half-finished
  `CheckoutHostingController` (which conformed to
  `UIAdaptivePresentationControllerDelegate` but never implemented
  `presentationControllerDidDismiss`) with a `CheckoutDismissDelegate` matching
  the shape `presentCart` already uses — completion resolves with the transfer
  id, swipe-down rejects with `USER_CANCELED`, double-resolution is guarded by
  a `didFinish` flag.

## [2.1.1] - 2026-05-09

### Fixed

- iOS: `presentOnboarding` Promise no longer hangs after the user finishes the final step. The 2.0.6 theming work wrapped the SDK's `OnboardingContainerView` in a `ThemedRoot` SwiftUI struct so the bridge could inject `FrameTheme` into the environment. The extra `body` indirection that wrapper introduced sat between `UIHostingController` and the SDK view, which caused `OnboardingContainerView`'s `@Environment(\.dismiss)` action to resolve to the wrong context — the host stayed on screen, `OnboardingDismissDelegate.finish(completed:)` never ran, and the JS Promise never resolved. The bridge now hands the SDK view directly to `UIHostingController` with no intervening wrapper, restoring the 2.0.5 ancestor chain.

### Breaking

- **`Frame.setTheme(theme)` removed.** Theme is now configured at SDK init time. Pass it as an optional field on the existing `Frame.initialize({...})` call:
  ```ts
  // Before (2.0.6)
  await Frame.initialize({ secretKey, publishableKey, debugMode });
  await Frame.setTheme({ colors: { primaryButton: '#5B2DFF' } });

  // After (2.1.1)
  await Frame.initialize({
    secretKey,
    publishableKey,
    debugMode,
    theme: { colors: { primaryButton: '#5B2DFF' } },
  });
  ```
  This collapses to a single bridge call, matches the new `FrameNetworking.shared.initializeWithAPIKey(_:publishableKey:theme:debugMode:)` signature in Frame-iOS 2.1.3, and lets the SDK own the canonical theme via `FrameThemeKey.defaultValue` instead of forcing the bridge to wrap every present site.

### Changed

- iOS native bridge: `initialize` selector now takes an additional `theme:(NSDictionary *)theme` argument. Consumers who depend on the bridge from custom Objective-C code (uncommon) must update their selectors.
- Bumped `Frame-iOS` SPM dependency `2.1.2` → `2.1.3`. CocoaPods consumers must bump `frame-ios` manually in Xcode.

### Notes

- Android: the `theme` field on `Frame.initialize` is accepted for cross-platform parity but currently has no effect — `frame-android` does not yet have a matching theme API.
- Themes are still captured at the time of each `present*` call. Modals already on screen are not re-themed if the theme changes mid-flow.

## [2.1.0] - 2026-05-08

### Fixed

- iOS: `presentOnboarding` Promise no longer hangs indefinitely on apps using the New Architecture (TurboModules). The bridge previously exposed two sibling `RCT_EXTERN_METHOD`s (`presentOnboarding` and `presentOnboardingWithApplePay`) whose shared prefix caused the TurboModule interop layer to mis-resolve the promise resolver, leaving completion callbacks dropped on the floor. Consolidated into a single `presentOnboarding(accountId, capabilities, applePayMerchantId)` selector to match the Android signature.

### Changed

- iOS native bridge: removed `FrameSDK.presentOnboardingWithApplePay`. The JS API (`Frame.presentOnboarding({ applePayMerchantId })`) is unchanged; consumers do not need to update their TS/JS code, but **must** rebuild the native iOS target after upgrading.

## [2.0.6] - 2026-05-06

### Added

- `Frame.setTheme(theme)` (iOS) — configures colors, fonts, and corner radii for the SDK's reusable components (checkout, cart, onboarding). Backed by `FrameTheme` introduced in Frame-iOS 2.1.2. Accepts partial theme dicts; unspecified tokens fall back to SDK defaults. Pass `null` or `{}` to reset. See README for the full token list.
- New TS exports: `FrameTheme`, `FrameThemeColor`, `FrameThemeFont`, `FrameThemeColors`, `FrameThemeFonts`, `FrameThemeRadii`.

### Changed

- Bumped `Frame-iOS` SPM dependency `2.1.1` → `2.1.2`. CocoaPods consumers must bump `frame-ios` manually in Xcode (File → Add Package Dependencies).

### Notes

- Android: `setTheme()` resolves immediately and has no effect — `frame-android` does not yet have a matching theme API. Same JS code is safe to run on both platforms.
- Themes are captured at the time of each `present*` call. Modals already on screen are not re-themed when `setTheme()` is called mid-flow.

## [2.0.5] - 2026-05-05

### Added

- `Frame.presentOnboarding({ applePayMerchantId })` (iOS) — optional. When set, the onboarding flow includes a native Apple Pay setup step. Same prerequisites as `presentApplePay` (App Attest entitlement + Apple Pay merchant ID). No-op on Android.
- iOS: `presentOnboarding` now surfaces the SDK's native form-level validation across the personal information, payment method, and bank account steps. Required fields and address inputs are validated inline before the user can advance.

### Fixed

- iOS: `presentOnboarding` now resolves reliably after the user finishes the final step. The bridge passes an `onComplete` closure into `OnboardingContainerView` and dismisses the host controller from there, instead of relying on SwiftUI's `@Environment(\.dismiss)` (which is a no-op when presented from UIKit).
- iOS 18: `presentOnboarding` no longer dismisses prematurely when nested SwiftUI sheets inside the flow (e.g. the phone country picker) toggle their bindings. The host is now wrapped in a `UINavigationController` so SwiftUI's `SheetBridge` doesn't propagate `presentationControllerDidDismiss` up to the outer host, and the dismiss delegate ignores callbacks for nested presentation controllers.

### Changed

- Bumped `Frame-iOS` SPM dependency `2.0.7` → `2.1.1`. Includes international phone verification fix (2.0.8), account API structure update (2.0.9), the Apple Pay onboarding step (2.1.0), and dark mode color asset updates for the SDK's UI elements (2.1.1).

## [2.0.2] - 2026-05-01

### Fixed

- iOS: `presentOnboarding` now resolves reliably after the user finishes the final step. Previously the SDK's `OnboardingContainerView` ended the flow by calling SwiftUI's `@Environment(\.dismiss)`, which is a no-op when the view is presented from UIKit (as the bridge does), so the sheet stayed up and the JS promise never resolved. The bridge now passes an `onComplete` closure into the container view and dismisses the host controller from there.

### Added

- iOS: `presentOnboarding` now surfaces the SDK's native form-level validation across the onboarding steps (personal information, payment method, bank account). Required fields and address inputs are validated inline before the user can advance, matching the validation behavior already shipping in `presentCheckout` and `presentCart`. No JS API change.

### Changed

- Bumped `Frame-iOS` SPM dependency to `2.0.7` — adds the `onComplete` callback to `OnboardingContainerView` that the fix above depends on, and ships the onboarding form validations.

## [2.0.1] - 2026-04-30

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
