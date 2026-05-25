# Frame React Native SDK

React Native SDK for [Frame Payments](https://framepayments.com). Ships checkout, cart, onboarding, and wallet UI as pure React Native — networking runs through the [framepayments](https://www.npmjs.com/package/framepayments) Node SDK; native bridges are only used for Apple Pay, Google Pay, App Attest (iOS), and the Prove SDK.

> **4.0.0 is a full rewrite** of the 3.x bridge SDK. The Frame iOS / Frame Android SDKs are no longer dependencies. See [CHANGELOG.md](CHANGELOG.md) for the migration guide.

## Requirements

- React Native >= 0.81
- iOS 17+ / Android 8.0+ (API 26+)
- A [Frame](https://framepayments.com) account with a publishable key (and, server-side, a secret key)

## Installation

```bash
npm install framepayments-react-native framepayments \
  @evervault/evervault-react-native \
  @fingerprintjs/fingerprintjs-pro-react-native \
  sift-react-native
```

These three packages are **hard peer deps** — the bridge initializer prefetches Evervault, FingerprintPro, and Sift configuration on every `Frame.initialize` call. Some onboarding capabilities pull in additional optional peers; see [Optional peer dependencies](#optional-peer-dependencies).

### iOS setup

Add one line to your `ios/Podfile`, inside your app target, then install pods:

```ruby
target 'YourApp' do
  pod 'Sift'   # required: see note below
  # ...
end
```

```bash
cd ios && pod install && cd ..
```

> **Why the `pod 'Sift'` line?** `sift-react-native` is a hard peer dep, but its 1.0.1 podspec imports `<Sift/Sift.h>` without declaring `s.dependency 'Sift'`. Without this line you'll see a "Sift/Sift.h file not found" build error. The Expo config plugin auto-injects this for you; bare RN apps add it once.

The SDK autolinks otherwise; there is no Swift Package Manager step, no `FramePreloader` to install, and no entitlement to add by hand (the config plugin handles entitlements for Expo users; bare RN users add the Apple Pay + App Attest entitlements once in Xcode — see [Required iOS setup](#required-ios-setup) under `presentApplePay`).

### Android setup

No manual steps. Autolinking wires up the native module, and Google Pay's wallet meta-data is injected automatically by the Expo plugin (or, for bare RN apps, add it once to `AndroidManifest.xml` — see [Required Android setup](#required-android-setup) under `presentGooglePay`).

If you ship the `phone_verification` onboarding capability, see [Enabling phone verification (Prove)](#enabling-phone-verification-prove) below. The bridge declares Prove as `compileOnly` on Android and gates the iOS code behind `#if canImport(ProveAuth)`, so it stays optional for apps that don't use phone verification — the bridge probes for the SDK at runtime and degrades cleanly to the Frame OTP path if it's missing.

### Expo

Expo SDK 54+ is supported via a development build (Expo Go is **not** supported — this SDK uses native modules). Add the config plugin to your `app.json` (or `app.config.js`):

```json
{
  "expo": {
    "plugins": [
      ["framepayments-react-native", {
        "applePayMerchantId": "merchant.com.yourcompany.app",
        "enableGooglePay": true
      }],
      "@fingerprintjs/fingerprintjs-pro-react-native"
    ]
  }
}
```

Then run `npx expo prebuild --clean` to regenerate `ios/` and `android/`. The plugin:

- Injects `pod 'Sift'` into the iOS target (working around the missing dep in the upstream sift-react-native podspec).
- When `applePayMerchantId` is provided: adds it to the `com.apple.developer.in-app-payments` entitlement and sets `com.apple.developer.devicecheck.appattest-environment` to `production` (App Attest is required for every Apple Pay charge — sandbox vs live is keyed off your Frame API keys, not this entitlement).
- When `enableGooglePay !== false` (default `true`): adds the `com.google.android.gms.wallet.api.enabled` meta-data to `AndroidManifest.xml`.
- When `enableProveAuth: true`: registers the cocoapods-art Artifactory source, injects `pod 'ProveAuth'` into the host target, and adds `implementation 'com.prove.sdk:proveauth:6.10.3'` to `android/app/build.gradle`. See [Enabling phone verification (Prove)](#enabling-phone-verification-prove).
- Adds the Prove Artifactory Maven repository to the Android project so the SDK's `compileOnly` Prove dependency always resolves at SDK compile time (the binary is only pulled into your app when `enableProveAuth` is set).
- Adds the C++20 / Folly post-install flags required by React Native 0.81+.

Also list `@fingerprintjs/fingerprintjs-pro-react-native` as a plugin — Fingerprint Pro is a hard peer dep and ships its own config plugin to register its Maven repo.

Both plugin options are optional. The plugin is a no-op for bare React Native users — `@expo/config-plugins` is declared as an **optional peer dependency**, so it is not installed unless you already have Expo in your project.

### Optional peer dependencies

| Onboarding capability | Required package |
|---|---|
| `bank_account_*` (Plaid) | `react-native-plaid-link-sdk` |
| `kyc` document upload | `react-native-vision-camera` |
| `geo_compliance` | `expo-location` *or* `@react-native-community/geolocation` |

These are listed under `peerDependenciesMeta` as optional — install them only if you use the corresponding capability. The bridge surfaces a clear error if a capability is requested without its peer installed.

### Enabling phone verification (Prove)

The `phone_verification` onboarding capability uses Prove's ProveAuth SDK. The native bridges on both platforms are gated so the SDK is optional — without ProveAuth linked, `phone_verification` falls back to Frame's OTP path.

Prove is distributed outside the public CocoaPods/Maven Central registries, so enabling it has a one-time machine-level setup step on top of the build-config changes.

**Expo (`app.json` / `app.config.js`)**

Add `enableProveAuth: true` to the plugin props:

```json
["framepayments-react-native", {
  "applePayMerchantId": "merchant.com.yourcompany.app",
  "enableGooglePay": true,
  "enableProveAuth": true
}]
```

Then on each dev machine and CI worker that runs `pod install`, install Prove's CocoaPods Artifactory plugin once:

```bash
gem install cocoapods-art
pod repo-art add prove.jfrog.io https://prove.jfrog.io/artifactory/api/pods/libs-public-cocoapods
```

Run `npx expo prebuild --clean && npx expo run:ios` (and `run:android`). The plugin injects `pod 'ProveAuth'`, the cocoapods-art source declaration, and the Android `implementation 'com.prove.sdk:proveauth:6.10.3'` line for you.

**Bare React Native**

The plugin only runs under Expo prebuild. For bare RN, do the equivalent edits by hand:

1. Install cocoapods-art (same one-time step as above):
   ```bash
   gem install cocoapods-art
   pod repo-art add prove.jfrog.io https://prove.jfrog.io/artifactory/api/pods/libs-public-cocoapods
   ```
2. Add to the top of your `ios/Podfile`:
   ```ruby
   source 'https://cdn.cocoapods.org/'
   plugin 'cocoapods-art', :sources => ['prove.jfrog.io']
   ```
3. Inside your app's `target ... do` block, add:
   ```ruby
   pod 'ProveAuth'
   ```
4. In `android/app/build.gradle`, inside `dependencies { ... }`, add:
   ```gradle
   implementation 'com.prove.sdk:proveauth:6.10.3'
   ```
5. Run `cd ios && pod install` and rebuild Android.

---

## Quick start

The SDK's modals are mounted by `FrameProvider`. **Wrap your app root once**, then call `Frame.initialize` and the `present*` methods anywhere below it. Calling `present*` without a mounted provider rejects synchronously with `NO_PROVIDER`.

```tsx
// App.tsx
import { useEffect } from 'react';
import Frame, { FrameProvider } from 'framepayments-react-native';

export default function App() {
  useEffect(() => {
    Frame.initialize({
      secretKey: 'sk_sandbox_...',
      publishableKey: 'pk_sandbox_...',
      debugMode: __DEV__,
    }).catch(console.error);
  }, []);

  return (
    <FrameProvider>
      {/* your existing app tree */}
      <YourApp />
    </FrameProvider>
  );
}
```

Anywhere inside the provider:

```ts
import Frame from 'framepayments-react-native';

// Present a checkout modal — resolves with the transfer id string
const transferId = await Frame.presentCheckout({ amount: 10000, accountId: 'acct_xxx' });

// Present a cart flow — also resolves with the transfer id string
const transferId2 = await Frame.presentCart({
  accountId: 'acct_xxx',
  items: [{ id: '1', title: 'Hat', amountInCents: 5000, imageUrl: 'https://...' }],
  shippingAmountInCents: 500,
});

// Present an onboarding flow (KYC, bank account, etc.)
const onboarding = await Frame.presentOnboarding({
  accountId: 'acct_xxx',
  capabilities: ['kyc', 'bank_account_verification'],
});
```

> `FrameProvider` accepts an optional `theme` prop — see [Theming](#theming). The provider also subscribes to `Appearance` changes, so light/dark switches automatically follow the OS.

---

## API reference

### `Frame.initialize(options)`

Initializes the native SDK. Must be called before any `present*` method. Call once at app startup (e.g., in your root component's `useEffect`).

```ts
await Frame.initialize({
  secretKey: 'sk_sandbox_...',      // your Frame secret key
  publishableKey: 'pk_sandbox_...', // your Frame publishable key
  applePayMerchantId: 'merchant.com.yourapp', // optional — see Apple Pay section
  googlePayMerchantId: 'BCR2DN4T...',         // optional — see Google Pay section
  debugMode: false,                 // set true in development to enable native debug logging
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `secretKey` | `string` | Yes | Your Frame secret key (`sk_…`). Used for server-style operations. |
| `publishableKey` | `string` | Yes | Your Frame publishable key (`pk_…`). Used for client-side operations like wallet payments. |
| `applePayMerchantId` | `string` | No | Apple Pay merchant identifier (`merchant.com.…`). Single source of truth for every Apple Pay surface — `presentApplePay`, the bundled checkout's wallet row, the onboarding wallet attach button. iOS-only; ignored on Android. |
| `googlePayMerchantId` | `string` | No | Google Pay merchant identifier from the Google Pay & Wallet Console. Single source of truth for every Google Pay surface — `presentGooglePay`, the bundled checkout's wallet row, the onboarding wallet attach button. Android-only; ignored on iOS. |
| `debugMode` | `boolean` | No | Enables native debug logging and routes wallet flows through sandbox/test environments. Default: `false`. |
| `theme` | `FrameTheme` | No | Accepted and stored for forward-compat, but the SDK currently reads theme overrides only from `<FrameProvider theme={...}>`. Use the Provider prop — see [Theming](#theming). |

---

### `Frame.presentCheckout(options)`

Opens the native checkout modal. Resolves with the created Transfer's id string when the user completes payment. Rejects with `USER_CANCELED` if the sheet is dismissed.

`accountId` is **required**: the bundled checkout creates a `Transfer`, which is account-scoped. If you need a customer/ChargeIntent flow, render your own UI and call `presentApplePay` / `presentGooglePay` directly with a customer owner instead.

```ts
const transferId = await Frame.presentCheckout({
  accountId: 'acct_xxx',
  amount: 15000, // in cents
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `accountId` | `string` | Yes | Frame account that the resulting Transfer is created against |
| `amount` | `number` | Yes | Payment amount in cents |
| `currency` | `string` | No | ISO 4217 currency code. Default `'usd'` |
| `addressMode` | `'required' \| 'optional' \| 'hidden'` | No | Controls whether the billing address fields are collected. Default `'required'` |
| `title` | `string` | No | Custom title rendered at the top of the checkout sheet. Default `'Checkout'` |

**Returns:** `Promise<string>` — the created Transfer's `id`.

**Throws synchronously with `code: 'INVALID_ACCOUNT'`** if `accountId` is missing or empty.

---

### `Frame.presentCart(options)`

Opens a cart review screen followed by the checkout flow. Routes through the same checkout path as `presentCheckout`, so it requires the same `accountId` and resolves with the created Transfer's id string.

```ts
const transferId = await Frame.presentCart({
  accountId: 'acct_xxx',
  items: [
    {
      id: '1',
      title: 'Vintage Track Jacket',
      amountInCents: 10000,
      imageUrl: 'https://example.com/jacket.jpg',
    },
  ],
  shippingAmountInCents: 500,
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `accountId` | `string` | Yes | Frame account that the resulting Transfer is created against |
| `items` | `FrameCartItem[]` | Yes | Array of items to display in the cart |
| `shippingAmountInCents` | `number` | Yes | Shipping cost in cents |
| `currency` | `string` | No | ISO 4217 currency code. Default `'usd'` |
| `addressMode` | `'required' \| 'optional' \| 'hidden'` | No | Forwarded to the checkout step. Default `'required'` |
| `title` | `string` | No | Custom title rendered at the top of the cart sheet. Default `'Frame Payments'` |

**Returns:** `Promise<string>` — the created Transfer's `id`.

**`FrameCartItem` shape:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for the item |
| `title` | `string` | Display name |
| `amountInCents` | `number` | Item price in cents |
| `imageUrl` | `string` | URL of the product image |

---

### `Frame.presentOnboarding(options)`

Opens the native onboarding flow for KYC, identity verification, and payment method setup. Resolves when the user completes or dismisses.

```ts
const result = await Frame.presentOnboarding({
  accountId: 'acct_xxx',
  capabilities: ['kyc', 'bank_account_verification'],
});

if (result.status === 'completed') {
  console.log('Account onboarded:', result.accountId);
}
```

| Option | Type | Required | Description |
|---|---|---|---|
| `accountId` | `string` | No | The Frame account to onboard |
| `capabilities` | `OnboardingCapability[]` | No | Which onboarding steps to include (see below) |

The Apple Pay / Google Pay wallet attach steps are rendered automatically when the corresponding merchant ID was passed to `Frame.initialize`. No per-call merchant params here.

**`capabilities` values:**

| Value | Description |
|---|---|
| `kyc` | Identity verification |
| `kyc_prefill` | Pre-populate KYC fields |
| `phone_verification` | Phone number verification |
| `age_verification` | Age verification |
| `address_verification` | Address verification |
| `geo_compliance` | Geolocation compliance check |
| `creator_shield` | Creator Shield enrollment |
| `card_verification` | Card verification |
| `card_send` | Enable card send capability |
| `card_receive` | Enable card receive capability |
| `bank_account_verification` | Bank account verification |
| `bank_account_send` | Enable bank account send |
| `bank_account_receive` | Enable bank account receive |

**Returns:** `OnboardingResult`

| Field | Type | Description |
|---|---|---|
| `status` | `'completed' \| 'cancelled'` | Whether the user finished or dismissed the flow |
| `accountId` | `string \| undefined` | The Frame account that was onboarded. Populated on `status: 'completed'` for both the host-supplied-accountId path and the empty-account auto-create path. Use it to fetch payment methods / capabilities / profile server-side. |

---

### `Frame.presentApplePay(options)` (iOS)

Launches the native Apple Pay sheet, creates a Frame payment method from the authorized payment, and creates a charge against the owner. Resolves with the resulting resource's id string. Render your own button — Apple's `PKPaymentButton`, a community wrapper, or your own design-system component — and call this from its `onPress`.

The Apple Pay merchant ID is configured **once** at `Frame.initialize({ applePayMerchantId })`; there is no per-call merchant parameter.

The `owner` determines which downstream resource is created:

- `owner.type === 'customer'` → creates a `ChargeIntent` against the customer; resolves with the ChargeIntent's `id`.
- `owner.type === 'account'`  → creates a `Transfer` charged into the account; resolves with the Transfer's `id`.

In both cases the resolved value is a `string`; the caller knows which resource the id refers to based on the owner passed in.

```tsx
import Frame from 'framepayments-react-native';

// Account → Transfer
const transferId = await Frame.presentApplePay({
  amount: 15000,
  currency: 'usd',
  owner: { type: 'account', id: 'acct_xxx' },
});

// Customer → ChargeIntent
const chargeIntentId = await Frame.presentApplePay({
  amount: 15000,
  currency: 'usd',
  owner: { type: 'customer', id: 'cus_xxx' },
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `amount` | `number` | Yes | Payment amount in cents |
| `currency` | `string` | No | ISO 4217 currency code. Default `'usd'` |
| `owner` | `{ type: 'customer' \| 'account', id: string }` | Yes | Customer or account that owns the resulting payment method and charge |

**Returns:** `Promise<string>` — the created `ChargeIntent`'s `id` (for customer owners) or the `Transfer`'s `id` (for account owners).

The promise rejects with `code: 'USER_CANCELED'` when the user dismisses the sheet, `'INVALID_OWNER'` if the owner is missing or malformed, `'INVALID_MERCHANT_ID'` if `applePayMerchantId` was not configured at `Frame.initialize`, `'APPLE_PAY_UNAVAILABLE'` if the device cannot make Apple Pay payments, `'NOT_ATTESTED'` if device attestation has not completed yet (try again in a moment), `'PAYMENT_METHOD_FAILED'` when the wallet payment method could not be persisted, and `'PAYMENT_FAILED'` when the downstream ChargeIntent or Transfer could not be created.

#### Required iOS setup

Apple Pay setup is a four-part process: create a merchant ID with Apple, configure your Xcode project, pass the merchant ID to `Frame.initialize`, then **contact Frame** to enable the feature on your account.

1. **Create a merchant identifier.** Sign in to [developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → Merchant IDs](https://developer.apple.com/account/resources/identifiers/list/merchant), click **+**, choose **Merchant IDs**, and create one in reverse-DNS form (e.g. `merchant.com.yourapp`).
2. **Add the Apple Pay capability in Xcode.** Open your project, select your **app target**, go to **Signing & Capabilities** → **+ Capability** → **Apple Pay**, and add the merchant ID you created in step 1. Xcode writes it into your entitlements file:
   ```xml
   <key>com.apple.developer.in-app-payments</key>
   <array>
       <string>merchant.com.yourapp</string>
   </array>
   ```
3. **App Attest entitlement.** Frame uses Apple's App Attest for device attestation on every Apple Pay payment. Add to your `.entitlements`:
   ```xml
   <key>com.apple.developer.devicecheck.appattest-environment</key>
   <string>development</string>
   ```
   Use `production` for App Store builds. App Attest does not work in the simulator — Apple Pay requires a real device.
4. **Frame dashboard — device attestation.** In your Frame dashboard, **Settings → Device Attestation**, set your Apple Team ID and the Bundle ID of your iOS app. These must exactly match the app you're running — the backend computes `SHA256("<TeamID>.<BundleID>")` and compares it to the hash signed by the device. If they don't match, payment-method creation fails with `App ID verification failed`.
5. **Pass the merchant ID to `Frame.initialize`.** This is the single source of truth — every Frame Apple Pay surface reads it from here.
   ```ts
   await Frame.initialize({
     secretKey: 'sk_...',
     publishableKey: 'pk_...',
     applePayMerchantId: 'merchant.com.yourapp',
   });
   ```

#### Enabling Apple Pay on your account

Once the steps above are complete, contact Frame at [support@framepayments.com](mailto:support@framepayments.com) (or via your [Frame dashboard](https://framepayments.com)) and we'll enable Apple Pay on your account. Apple Pay charges won't succeed until this is done on our side.

On non-iOS platforms `Frame.presentApplePay` rejects synchronously with a not-supported error.

---

### `Frame.presentGooglePay(options)` (Android)

Launches the native Google Pay sheet, creates a Frame payment method from the wallet token, and creates a charge against the owner. Resolves with the resulting resource's id string. Render your own button (Google's `PayButton` from `play-services-pay`, a community wrapper, or your own component) and call this from its `onPress`.

The Google Pay merchant ID is configured **once** at `Frame.initialize({ googlePayMerchantId })`; there is no per-call merchant parameter.

The `owner` mirrors `presentApplePay` and determines which downstream resource is created:

- `owner.type === 'customer'` → creates a `ChargeIntent` against the customer; resolves with the ChargeIntent's `id`.
- `owner.type === 'account'`  → creates a `Transfer` charged into the account; resolves with the Transfer's `id`.

```tsx
import Frame from 'framepayments-react-native';

// Account → Transfer
const transferId = await Frame.presentGooglePay({
  amountCents: 15000,
  currencyCode: 'USD',
  owner: { type: 'account', id: 'acct_xxx' },
});

// Customer → ChargeIntent
const chargeIntentId = await Frame.presentGooglePay({
  amountCents: 15000,
  owner: { type: 'customer', id: 'cus_xxx' },
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `amountCents` | `number` | Yes | Payment amount in cents |
| `owner` | `{ type: 'customer' \| 'account', id: string }` | Yes | Customer or account that owns the resulting payment method and charge |
| `currencyCode` | `string` | No | ISO 4217 currency code. Default `'USD'` |

**Returns:** `Promise<string>` — the created `ChargeIntent`'s `id` (for customer owners) or the `Transfer`'s `id` (for account owners).

The promise rejects with `code: 'USER_CANCELED'` when the user dismisses the sheet, `'INVALID_OWNER'` if the owner is missing or malformed, `'GOOGLE_PAY_UNAVAILABLE'` if Google Pay is not ready on the device (no signed-in account, no test card, no `googlePayMerchantId` configured at `Frame.initialize`, or Wallet API disabled in the manifest), and `'PAYMENT_FAILED'` for backend failures.

#### Required Android setup

Google Pay setup is a four-part process: get a merchant ID from Google, declare the wallet capability in your manifest, pass the merchant ID to `Frame.initialize`, then **contact Frame** to enable the feature on your account.

1. **Obtain a Google Pay merchant ID.** Sign up for a [Google Pay & Wallet Console](https://pay.google.com/business/console/) account, complete the business profile, and accept the Google Pay API Terms of Service. Your **Merchant ID** (looks like `BCR2DN4T…`) appears on the Business Console home page once approved.
2. **Declare the wallet capability in `AndroidManifest.xml`.** Inside `<application>`:
   ```xml
   <meta-data
       android:name="com.google.android.gms.wallet.api.enabled"
       android:value="true" />
   ```
   Without this entry the Google Pay button stays hidden — the Wallet API is opted-out by default.
3. **Test environment.** When the SDK is initialized with `debugMode: true`, Google Pay runs in `ENVIRONMENT_TEST`; otherwise it uses `ENVIRONMENT_PRODUCTION`.
4. **Pass the merchant ID to `Frame.initialize`.** This is the single source of truth — every Frame Google Pay surface reads it from here.
   ```ts
   await Frame.initialize({
     secretKey: 'sk_...',
     publishableKey: 'pk_...',
     googlePayMerchantId: 'BCR2DN4T...',
   });
   ```

#### Enabling Google Pay on your account

Once the steps above are complete, contact Frame at [support@framepayments.com](mailto:support@framepayments.com) (or via your [Frame dashboard](https://framepayments.com)) and we'll enable Google Pay on your account. Google Pay charges won't succeed until this is done on our side.

On non-Android platforms `Frame.presentGooglePay` rejects synchronously with a not-supported error.

---

### Theming

Customizes colors, fonts, and corner radii across every screen the SDK renders — checkout, cart, and the onboarding flow.

Pass an optional `theme` prop to `FrameProvider`. The provider resolves light/dark variants from `Appearance`, merges your overrides on top, and exposes the resolved value to every SDK screen via context. Omit the prop, or pass `{}`, to use SDK defaults; pass a partial dict to override only specific tokens. Light and dark variants are provided for every color token by default; pass per-mode overrides as `{ light: '...', dark: '...' }` to override one without losing the other.

```tsx
import Frame, { FrameProvider } from 'framepayments-react-native';

const myTheme = {
  colors: {
    primaryButton: '#5B2DFF',
    primaryButtonText: '#FFFFFF',
    surface: '#0A0A0A',
    textPrimary: '#FFFFFF',
    error: '#E53935',
  },
  fonts: {
    title: { name: 'Inter-Bold', size: 24 },
    button: { name: 'Inter-SemiBold', size: 16 },
  },
  radii: { medium: 16 },
};

export default function App() {
  return (
    <FrameProvider theme={myTheme}>
      <YourApp />
    </FrameProvider>
  );
}
```

> Re-rendering `FrameProvider` with a new `theme` value updates every SDK screen on the next render, including any modal currently on screen. The provider owns the resolved value; nothing else in the SDK reads theme overrides from `Frame.initialize`.

#### Tokens

**Colors** — hex strings (`#RGB`, `#RRGGBB`, or `#RRGGBBAA`, with or without leading `#`):

| Key | Used by |
|-----|---------|
| `primaryButton` / `primaryButtonText` | Primary CTAs |
| `secondaryButton` / `secondaryButtonText` | Secondary CTAs |
| `disabledButton` / `disabledButtonStroke` / `disabledButtonText` | Disabled CTAs |
| `surface` / `surfaceStroke` | Cards, sheets, input backgrounds |
| `textPrimary` / `textSecondary` | Body and supporting text |
| `error` | Validation messages |
| `toastBackground` / `toastText` | Toast notifications surfaced by the SDK |
| `onboardingHeaderBackground` | Onboarding header bar |
| `onboardingProgressFilledOnBrand` / `onboardingProgressEmptyOnBrand` | Onboarding progress indicator |

**Fonts** — `{ name: string; size: number }` objects. `name` resolves to a PostScript font on iOS and to an asset filename on Android (see [Custom fonts](#custom-fonts) below). Use `name: 'system'` for the platform default.

| Key | Default | Used by |
|-----|---------|---------|
| `title` | `.title` | Page titles |
| `heading` | 18pt semibold | Section headers |
| `headline` | `.headline` | Card headlines |
| `body` | `.body` | Body text |
| `bodySmall` | 14pt | Smaller body |
| `label` | `.subheadline` | Field labels |
| `caption` | `.caption` | Captions, footnotes |
| `button` | `.headline` | Button text |

**Radii** — numbers (in points):

| Key | Default | Used by |
|-----|---------|---------|
| `small` | 8 | Small chips |
| `medium` | 10 | Buttons, inputs |
| `large` | 16 | Cards, sheets |

#### Custom fonts

**iOS** — `name` is passed to SwiftUI's `Font.custom(name:size:)`. The host app must:

1. Add the font file to the app bundle (Xcode → Build Phases → Copy Bundle Resources).
2. Register it in `Info.plist`:
   ```xml
   <key>UIAppFonts</key>
   <array>
     <string>Inter-Bold.ttf</string>
   </array>
   ```

`name` must match the font's PostScript name.

**Android** — `name` is looked up under `android/app/src/main/assets/fonts/`. The resolver tries `<name>`, `<name>.ttf`, then `<name>.otf` in order.

If you already use `react-native.config.js` with `assets: ['./assets/fonts/']`, the RN bundler copies the same files iOS uses into the Android assets directory, so a JS `name` of `Inter-Bold` works on both platforms.

If a font name doesn't resolve on either platform, the SDK silently falls back to the system font.

---

### Rendering wallet buttons

The SDK ships `ApplePayButton` and `GooglePayButton` components that wrap the platform's official button views (`PKPaymentButton` on iOS, Google's `PayButton` on Android). They render the brand-approved artwork in light/dark variants automatically — no need to bundle Apple's or Google's PNGs yourself.

```tsx
import { Platform } from 'react-native';
import Frame, { ApplePayButton, GooglePayButton } from 'framepayments-react-native';

export function WalletButton({ amountCents, accountId }) {
  const onPress = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Frame.presentApplePay({
          amount: amountCents,
          currency: 'usd',
          owner: { type: 'account', id: accountId },
        });
      } else {
        await Frame.presentGooglePay({
          amountCents,
          owner: { type: 'account', id: accountId },
        });
      }
    } catch (e: any) {
      if (e.code === 'USER_CANCELED') return;
      // surface the error to your UI
    }
  };

  if (Platform.OS === 'ios') {
    return <ApplePayButton onPress={onPress} />;
  }
  return <GooglePayButton onPress={onPress} />;
}
```

Each component picks a sensible default; pass per-platform props to override:

- **`ApplePayButton`** — `buttonStyle?: 'black' | 'white' | 'whiteOutline' | 'automatic'` (default `'black'`), `buttonType?: ApplePayButtonType` (default `'buy'`), `cornerRadius?: number` in points (default `10`).
- **`GooglePayButton`** — `buttonTheme?: 'dark' | 'light'` (default `'dark'`), `buttonType?: GooglePayButtonType` (default `'pay'`), `cornerRadiusDp?: number` in dp (default `8`).

On the wrong platform the component returns an empty `View`, so the cross-platform layout above is safe.

A complete working example (including the loading state and per-platform fallback) lives in [example/App.tsx](./example/App.tsx).

---

### Inspecting the full resource

The `present*` flows resolve with a string id only. If you need the full `Transfer` or `ChargeIntent` object after a checkout completes, fetch it server-side from the Frame API using the returned id — see [https://docs.framepayments.com/frameos/transfers](https://docs.framepayments.com/frameos/transfers) and the corresponding ChargeIntent docs for the response schemas. (This SDK doesn't ship TypeScript types for those objects; use the [`framepayments`](https://www.npmjs.com/package/framepayments) Node package if you want typed access from JS.)

---

### Error handling

All `present*` methods return Promises that reject with an error object containing `code` and `message`.

```ts
import Frame, { ErrorCodes } from 'framepayments-react-native';

try {
  const transferId = await Frame.presentCheckout({ amount: 10000, accountId: 'acct_xxx' });
  // handle success
} catch (e: any) {
  if (e.code === ErrorCodes.USER_CANCELED) {
    return; // user dismissed — not an error
  }
  console.error(`[${e.code}] ${e.message}`);
}
```

**Error codes:**

`ErrorCodes` (exported from the package) enumerates most codes thrown by the public surface. A couple of additional codes — `NO_PROVIDER` and `PRESENTER_BUSY` — are thrown by the presenter but live outside the `ErrorCodes` enum; compare against the string literal.

| Code | When it's thrown |
|---|---|
| `NO_PROVIDER` | `present*` called before `<FrameProvider>` was mounted at the app root. Wrap your app root in `<FrameProvider>`. |
| `PRESENTER_BUSY` | Another Frame screen is already on screen. Wait for the in-flight `present*` to resolve or reject before opening the next one. |
| `NOT_INITIALIZED` | `present*` called before `Frame.initialize()` |
| `INIT_FAILED` | `Frame.initialize` failed (typically a thrown peer-dep config error during prefetch) |
| `MISSING_PUBLISHABLE_KEY` | `Frame.initialize` called without `publishableKey` |
| `MISSING_SECRET_KEY` | `Frame.initialize` called without `secretKey` |
| `USER_CANCELED` | User dismissed the modal without completing |
| `INVALID_ITEMS` | Cart items could not be parsed |
| `INVALID_ACCOUNT` | `accountId` was missing or empty (`presentCheckout`, `presentCart`) |
| `INVALID_OWNER` | Apple Pay / Google Pay `owner` was missing, malformed, or had an empty `id` |
| `INVALID_MERCHANT_ID` | `applePayMerchantId` was not configured at `Frame.initialize` |
| `INVALID_AMOUNT` | Wallet `amount` / `amountCents` was missing or non-positive |
| `NO_RESULT` | Native activity returned OK but no payload |
| `PARSE_ERROR` | Could not decode the native response |
| `NO_ROOT_VC` | iOS: no root view controller available |
| `NO_ACTIVITY` | Android: no host activity available |
| `APPLE_PAY_UNAVAILABLE` | iOS: device cannot make Apple Pay payments |
| `GOOGLE_PAY_UNAVAILABLE` | Android: Google Pay not ready on the device |
| `NOT_ATTESTED` | iOS: device attestation has not completed yet — retry in a moment |
| `ATTESTATION_FAILED` | iOS: App Attest attestation itself failed (verify Team ID / Bundle ID in your Frame dashboard's Device Attestation settings) |
| `PAYMENT_METHOD_FAILED` | The wallet payment method could not be persisted to Frame |
| `PAYMENT_FAILED` | Downstream `ChargeIntent` or `Transfer` creation failed |
| `PLAID_UNAVAILABLE` | Onboarding requested a `bank_account_*` capability but `react-native-plaid-link-sdk` is not installed |
| `CAMERA_UNAVAILABLE` | Onboarding requested KYC document upload but `react-native-vision-camera` is not installed |
| `PLATFORM_UNSUPPORTED` | A wallet method was called on the wrong platform (e.g. `presentApplePay` on Android) |
| `NETWORK_ERROR` / `API_NETWORK` | Network failure reaching the Frame API |
| `API_ERROR` | Frame API returned an HTTP error |
| `API_DECODE` | Frame API response could not be decoded |
| `API_VALIDATION` | Frame API rejected the request body |

You can also use the `isFrameError` and `normalizeToFrameError` utilities for typed error handling:

```ts
import { isFrameError, normalizeToFrameError } from 'framepayments-react-native';

try {
  await Frame.presentCheckout({ accountId: 'acct_xxx', amount: 5000 });
} catch (e) {
  const err = normalizeToFrameError(e);
  // err.code, err.message, err.nativeError are all typed strings
}
```

---

## Server-side API calls

For operations that don't involve UI (listing customers, creating charge intents, issuing refunds), install the optional `framepayments` Node.js SDK:

```bash
npm install framepayments
```

```ts
import { FrameSDK } from 'framepayments';

const frame = new FrameSDK({ apiKey: 'sk_sandbox_...' });

const customers = await frame.customers.list();
const accounts = await frame.accounts.list();
const paymentMethods = await frame.paymentMethods.list();
```

> **Security:** Never hardcode your Frame secret key in your app bundle. Fetch it from your own backend after the user authenticates — this keeps the key out of the binary and allows server-side rotation without an app update.
>
> ```ts
> // Fetch from your backend after login
> const { frameApiKey } = await myBackend.getSessionConfig();
> const frame = new FrameSDK({ apiKey: frameApiKey });
> ```

---

## Security

- **Never bundle your secret key.** Anyone with access to your IPA or APK can extract embedded secrets. Fetch the key from your backend at runtime.
- **Don't commit keys to source control.** Use environment variables or a secrets manager.
- **Disable `debugMode` in production** to avoid logging sensitive data to the console.
- Payment card data is encrypted in JS via [`@evervault/evervault-react-native`](https://www.npmjs.com/package/@evervault/evervault-react-native) at submit time, before it leaves the device. The plaintext PAN never crosses the bridge or appears in network traffic.

---

## Troubleshooting

### `NO_PROVIDER` rejection from any `present*` call

Wrap your app root in `<FrameProvider>` from `framepayments-react-native`. The presenter mounts its modal host inside the provider, so calls to `Frame.presentCheckout` / `presentCart` / `presentOnboarding` without a mounted provider reject synchronously with this code. See [Quick start](#quick-start).

### "The package doesn't seem to be linked"

- iOS: run `cd ios && pod install`, then rebuild.
- Android: rebuild the app (`npm run android`).
- Both: make sure you're running a debug / custom dev build (not Expo Go), since this SDK uses native modules.

### `INIT_FAILED` from `Frame.initialize`

The initializer prefetches Evervault, FingerprintPro, and Sift configuration. If any of the hard peer deps listed under [Installation](#installation) is missing — or if the native side rejects (typically a missing CocoaPods install or a stale Android build) — init throws `INIT_FAILED` with the underlying message. Install the missing dep, run `pod install` (iOS) or rebuild Android, then retry. If the error mentions `secretKey`/`publishableKey`, you passed an empty string for one of them.

### `App ID verification failed` from `presentApplePay`

The Frame backend computes `SHA256("<TeamID>.<BundleID>")` from the merchant's dashboard configuration and compares it to the hash signed by the device during attestation. A mismatch returns `App ID verification failed`. Fix: open your Frame dashboard → **Settings → Device Attestation** and confirm both the Apple Team ID and the Bundle ID match the iOS app you're running.

### Google Pay button hidden on Android

The Wallet API is opted out by default. Make sure `AndroidManifest.xml` includes the `com.google.android.gms.wallet.api.enabled` meta-data inside `<application>` (the Expo plugin injects it automatically when `enableGooglePay !== false`). Then confirm the device has a saved card in Google Wallet and that `googlePayMerchantId` was passed to `Frame.initialize`.

### Duplicate React instances at runtime

Metro is resolving a second `react` from a nested `node_modules`. The Expo example sets `disableHierarchicalLookup: true` in `metro.config.js`; bare RN consumers typically don't hit this unless the SDK is symlinked. If you see it, dedupe with `npm dedupe react react-native` or add the same Metro setting.

---

## Example apps

Two parallel example apps live in this repo, sharing the same `App.tsx`:

- [example/](./example) — bare React Native CLI (RN 0.83). Use this if you have an existing bare RN app.
- [expo-example/](./expo-example) — Expo SDK 54 with the `framepayments-react-native` config plugin. Use this if you're on Expo. Requires Expo SDK 54+ (RN 0.81+).

Both cover `initialize`, `presentCheckout`, `presentCart`, `presentOnboarding`, the Apple Pay / Google Pay flows, and server-side API calls via `framepayments`.

See **[docs/RUNNING_EXAMPLES.md](./docs/RUNNING_EXAMPLES.md)** for the full setup walkthrough (prereqs, Prove SDK install, common iteration loop, which `App.tsx` constants you can change to test different capabilities / accounts / cart items, and a troubleshooting reference).

Quick reference:

**Bare RN:**
```bash
cd example
npm install && cd ios && pod install && cd ..
FRAME_SECRET_KEY=sk_sandbox_... FRAME_PUBLISHABLE_KEY=pk_sandbox_... npm run ios
```

**Expo:**
```bash
cd expo-example
npm install
npx expo prebuild --clean
FRAME_SECRET_KEY=sk_sandbox_... FRAME_PUBLISHABLE_KEY=pk_sandbox_... npx expo run:ios
```

---

## License

Apache-2.0
