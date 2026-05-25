# Frame React Native SDK — Expo Example

A parallel demo to [`../example/`](../example) (which uses the bare React
Native CLI). This one drives the same flows through the **Expo prebuild
workflow** with the `framepayments-react-native` config plugin.

`App.tsx` is identical to the bare example — the only difference is how the
native projects are produced.

## Prerequisites

- Node 18+
- Xcode 16+ (iOS) / Android Studio with SDK 36 (Android)
- A [Frame](https://framepayments.com) account with a secret key and a
  publishable key

> **Expo Go won't work.** The SDK ships native modules (Apple Pay, App
> Attest, Google Pay, Prove), so you need a custom dev client built via
> `expo run:ios` / `expo run:android`.

## Setup

1. Install dependencies. The example pulls in the SDK's required peer deps
   (Evervault, FingerprintPro, Sift) alongside Expo itself.

   ```bash
   cd expo-example
   npm install
   ```

2. Generate the native projects. The `framepayments-react-native` config
   plugin runs as part of this step, so the produced `ios/` and `android/`
   already contain:

   - the Apple Pay entitlement (`merchant.com.framepayments.example` by
     default — see the **Apple Pay note** below)
   - the App Attest entitlement (`production` environment)
   - the Google Pay wallet meta-data
   - `android.permission.INTERNET` (required by the device-IP header lookup)
   - the CocoaPods Artifactory source for the Prove SDK on iOS (only used
     if your host app pulls in `pod 'ProveAuth'`)
   - the Prove Artifactory Maven repository on Android, so the SDK's
     `compileOnly` Prove dependency resolves
   - the C++20 / Folly post-install flags React Native 0.81+ needs

   The `@fingerprintjs/fingerprintjs-pro-react-native` plugin also runs
   here (declared in `app.json`) to register Fingerprint Pro's Maven
   repository — required because Fingerprint Pro is a hard peer dep.

   ```bash
   npx expo prebuild --clean
   ```

3. Set your Frame API keys (never commit them):

   ```bash
   export FRAME_SECRET_KEY=sk_sandbox_...
   export FRAME_PUBLISHABLE_KEY=pk_sandbox_...
   ```

4. Boot the app:

   ```bash
   npx expo run:ios       # or: npx expo run:android
   ```

## Apple Pay note

`app.json` ships a placeholder merchant identifier
(`merchant.com.framepayments.example`) that matches the `APPLE_PAY_MERCHANT_ID`
constant in `App.tsx`. For your own integration:

1. Change `expo.plugins[0][1].applePayMerchantId` in [app.json](app.json) to a
   merchant ID registered in your Apple Developer account.
2. Update `APPLE_PAY_MERCHANT_ID` in [App.tsx](App.tsx) to the same value.
3. Re-run `npx expo prebuild --clean`.
4. Configure the matching Apple Team ID + Bundle ID in your Frame dashboard
   under **Settings → Device Attestation** (the backend verifies
   `SHA256("<TeamID>.<BundleID>")` against the attestation payload).

## Server-side calls

The example bundles the `framepayments` Node SDK so the "View customers" /
"View accounts" buttons demonstrate that the two SDKs interoperate.

> **Don't do this in a production client app.** A secret key embedded in a
> binary can be extracted. In real apps, fetch keys from your own backend
> after authentication. The bundled call is here purely so the demo is
> self-contained.

## Verifying the integration

After `npx expo run:ios` boots:

1. The app loads without the red "SDK init failed" banner.
2. The Apple Pay (iOS) / Google Pay (Android) button renders on the home
   screen.
3. Tapping "Checkout (fixed amount)" opens the JS-driven checkout modal.
4. Tapping "View customers" fetches and renders sandbox customers via the
   `framepayments` Node SDK.

After `expo prebuild` you can sanity-check the generated artifacts:

- `ios/<projname>/<projname>.entitlements` contains
  `merchant.com.framepayments.example` under `com.apple.developer.in-app-payments`
  and `production` for `com.apple.developer.devicecheck.appattest-environment`.
- `android/app/src/main/AndroidManifest.xml` contains
  `<meta-data android:name="com.google.android.gms.wallet.api.enabled" android:value="true" />`
  inside `<application>`.

## Troubleshooting

- **`pod install` fails.** Confirm React Native is 0.81+
  (`cat node_modules/react-native/package.json`). The SDK's podspec relies
  on autolinking introduced in 0.81.
- **Google Pay button blank on Android.** Confirm `AndroidManifest.xml` has
  the `com.google.android.gms.wallet.api.enabled` meta-data. If not,
  `enableGooglePay` may be set to `false` in `app.json`, or the plugin
  didn't run during prebuild.
- **"Duplicate React instances" or hooks errors at runtime.** Metro is
  resolving a second React from the repo root's `node_modules`. The
  `metro.config.js` here sets `disableHierarchicalLookup: true` to prevent
  this; restore it if you've modified the file.

## Relationship to `/example/`

|                 | `/example/`                | `/expo-example/`                            |
| --------------- | -------------------------- | ------------------------------------------- |
| Toolchain       | Bare React Native CLI 0.83 | Expo SDK 54 (RN 0.81)                       |
| Native folders  | Committed                  | Generated by `expo prebuild` (gitignored)   |
| Native setup    | Manual Xcode + manifest    | `framepayments-react-native` config plugin  |
| Best for        | Existing RN apps           | New apps / Expo-based projects              |

`App.tsx` is identical between the two — only the toolchain and native
plumbing differ.
