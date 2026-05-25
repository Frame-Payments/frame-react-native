# Running the example apps

Two example apps live in this repo. They share the same `App.tsx` pattern (Checkout, Cart, Apple Pay, Google Pay, Onboarding, and server-side list calls):

- [`example/`](../example) — bare React Native CLI (RN 0.83). Use this if your target app is a bare RN app.
- [`expo-example/`](../expo-example) — Expo SDK 54 with the `framepayments-react-native` config plugin. Use this if your target app is an Expo app.

Both consume the SDK via `"framepayments-react-native": "file:.."` in `package.json`, which resolves to the **compiled `lib/`** at the repo root — not `src/`. Always rebuild `lib/` after editing source:

```bash
# from the repo root
npm install        # one time
npm run build      # compiles src/ → lib/ (rerun after every SDK source change)
```

For an active iteration loop, run `npx tsc --watch` in a separate terminal — `lib/` then stays in sync, and you can just shake → Reload (or press `R` in Metro) in the running example to pick up changes.

---

## Prerequisites

- **Node** ≥ 20
- **Xcode** 16+ with iOS 17 SDK (Apple Pay requires a real device for live payments; the sheet renders in the simulator with a stub PassKit)
- **Android Studio** with SDK 36 + an emulator image (API ≥ 26)
- **Frame API keys** (one publishable + one secret) — sandbox is fine for everything in this repo

### One-time machine setup for Prove (phone verification)

The `phone_verification` onboarding capability uses Prove's ProveAuth SDK, which is distributed via JFrog Artifactory (not public CocoaPods/Maven Central). If you'll exercise the phone-auth flow, install Prove's CocoaPods Artifactory plugin once per machine:

```bash
gem install cocoapods-art
pod repo-art add prove.jfrog.io https://prove.jfrog.io/artifactory/api/pods/libs-public-cocoapods
```

The Expo plugin handles the rest (Podfile lines, Android Maven repo, Gradle dependency) when `enableProveAuth: true` is set in `app.json`. The bare RN example does this manually — see [example/ios/Podfile](../example/ios/Podfile).

---

## Bare React Native example

```bash
cd example
npm install              # one time, or after package.json changes
cd ios && pod install && cd ..
FRAME_SECRET_KEY=sk_sandbox_... FRAME_PUBLISHABLE_KEY=pk_sandbox_... npm run ios
# Android:
# FRAME_SECRET_KEY=sk_sandbox_... FRAME_PUBLISHABLE_KEY=pk_sandbox_... npm run android
```

`npm run ios` boots the iPhone 17 Pro simulator by default (see [example/package.json:7](../example/package.json#L7)) — change `--simulator` if you want a different device.

### After SDK source edits

```bash
# from repo root
npm run build

# then in example/:
cd example
npm run start -- --reset-cache   # picks up new lib/ from Metro cache
```

If you edit anything native (Swift, Obj-C, Podfile, AndroidManifest), you need to also re-run:

```bash
cd ios && pod install && cd ..   # iOS only
npm run ios                       # full native rebuild
```

---

## Expo example

```bash
cd expo-example
npm install                  # one time, or after package.json changes
npx expo prebuild --clean    # regenerates ios/ + android/ from app.json + plugins
FRAME_SECRET_KEY=sk_sandbox_... FRAME_PUBLISHABLE_KEY=pk_sandbox_... npx expo run:ios
# Android:
# FRAME_SECRET_KEY=sk_sandbox_... FRAME_PUBLISHABLE_KEY=pk_sandbox_... npx expo run:android
```

> Expo Go is **not** supported — this SDK uses native modules. Always use `expo run:ios` / `expo run:android` (a "development build").

### After SDK source edits

JS/TS only:

```bash
# repo root
npm run build

# expo-example terminal — Metro is already running
# Press R in the Metro window OR shake → Reload
```

Native or plugin changes:

```bash
cd expo-example
npx expo prebuild --clean    # regenerates ios/ + android/ projects
npx expo run:ios             # full native rebuild
```

### What the plugin wires in

[expo-example/app.json](../expo-example/app.json) configures the `framepayments-react-native` plugin with three switches; flip these to test different paths without touching native code:

| Plugin prop | Effect |
|---|---|
| `applePayMerchantId: 'merchant.com.framepayments.example'` | Writes the merchant ID into iOS entitlements + sets the App Attest environment to `production`. Change to your real merchant ID for live Apple Pay. |
| `enableGooglePay: true` | Injects the Google Pay Wallet API meta-data into `AndroidManifest.xml`. Set to `false` to test the "hidden Google Pay button" path. |
| `enableProveAuth: true` | Adds `pod 'ProveAuth'`, the cocoapods-art source, and the Android Gradle dependency. Set to `false` to test the Twilio OTP fallback path. |

After flipping any of these, re-run `npx expo prebuild --clean && npx expo run:ios`.

---

## Customizable values in `App.tsx`

Both `example/App.tsx` and `expo-example/App.tsx` use the same constants and handlers. These are the values you can change to exercise different flows without rebuilding native code (JS-only edits, reload from Metro):

### API keys

```ts
// Defaults to env vars; falls back to nullable if unset.
const FRAME_SECRET_KEY = process.env.FRAME_SECRET_KEY;
const FRAME_PUBLISHABLE_KEY = process.env.FRAME_PUBLISHABLE_KEY;
```

Prefer the env-var approach (no risk of committing real keys). For sandbox testing you can also drop a literal in:

```ts
const FRAME_SECRET_KEY = 'sk_sandbox_...';
const FRAME_PUBLISHABLE_KEY = 'pk_sandbox_...';
```

### Apple Pay merchant ID

```ts
const APPLE_PAY_MERCHANT_ID = 'merchant.com.framepayments.example';
```

Single source of truth for every Apple Pay surface (presentApplePay, checkout wallet row, onboarding Apple Pay attach button). The Expo example also references this in [expo-example/app.json](../expo-example/app.json) — keep both in sync if you change it. For the bare RN example, the merchant ID is also in the Xcode entitlements file ([example/ios/FrameExample/FrameExample.entitlements](../example/ios/FrameExample/FrameExample.entitlements)).

### Demo account ID

```ts
const DEMO_ACCOUNT_ID = '83f5c9f7-7dfe-4962-8ccd-92a0fbc1909e';
```

Used by Checkout, Cart, and the Apple Pay / Google Pay account-owner paths. **Replace with an account ID from your own Frame dashboard before running** — the bundled value is from a personal sandbox account and won't authorize against your keys.

### Cart items

```ts
const sampleCartItems = [
  { id: '1', title: 'Vintage Track Jacket', amountInCents: 10000, imageUrl: '...' },
  { id: '2', title: 'Zip Up Hoodie', amountInCents: 25000, imageUrl: '...' },
];
```

Used by `Frame.presentCart`. `shippingAmountInCents` is set inline in the `handleCart` handler (currently `4000`).

### Onboarding capabilities

The "Onboarding" button calls:

```ts
const result = await Frame.presentOnboarding({
  capabilities: [
    'kyc',
    'kyc_prefill',
    'age_verification',
    'phone_verification',
    'card_verification',
    'bank_account_verification',
  ],
});
```

Trim or extend this array to test different step combinations. The flow is computed from these — drop `bank_account_verification` to skip the payout step, drop `kyc`/`kyc_prefill` to skip the Personal Information step entirely, etc. Full list of valid capability strings:

```
kyc, kyc_prefill, phone_verification, age_verification,
address_verification, geo_compliance, creator_shield,
card_verification, card_send, card_receive,
bank_account_verification, bank_account_send, bank_account_receive
```

You can also pass `accountId` to skip the empty-account auto-create flow:

```ts
const result = await Frame.presentOnboarding({
  accountId: DEMO_ACCOUNT_ID,
  capabilities: ['kyc'],
});
```

### Apple Pay / Google Pay amount + owner

```ts
const chargeId = await Frame.presentApplePay({
  amount: 100,                                       // cents — change to test totals
  currency: 'usd',                                   // ISO 4217
  owner: { type: 'account', id: DEMO_ACCOUNT_ID },   // 'customer' creates a ChargeIntent instead
});
```

Switch `owner.type` to `'customer'` and pass a customer id to exercise the ChargeIntent path. The resolved id type follows the owner — Transfer id for `account`, ChargeIntent id for `customer`.

### Theme overrides

[example/App.tsx](../example/App.tsx) and [expo-example/App.tsx](../expo-example/App.tsx) both have a commented-out theme block inside `Frame.initialize`:

```ts
// theme: {
//   colors: { primaryButton: '#FF0066', surface: '#0A0A0A', ... },
//   radii: { medium: 16 },
// },
```

(Note: theme overrides currently route through `<FrameProvider theme={...}>` — passing `theme` to `Frame.initialize` is accepted but not yet consumed. See the [README Theming section](../README.md#theming).)

---

## Troubleshooting

### "View config not found for component 'FrameApplePayButton'"

The native binary was built before the Apple Pay view manager existed in JS. Rebuild:

```bash
# bare RN
cd example/ios && pod install && cd .. && npm run ios

# Expo
cd expo-example && npx expo prebuild --clean && npx expo run:ios
```

### `NO_PROVIDER` rejection

Your app root must be wrapped in `<FrameProvider>`. Both example apps already are — only an issue if you copy partial snippets into a custom app.

### `App ID verification failed` on Apple Pay

Frame backend computes `SHA256("<TeamID>.<BundleID>")` and compares to the device's attestation signature. Open your Frame dashboard → **Settings → Device Attestation** and confirm Team ID + Bundle ID match the running app exactly.

### Metro shows stale code after `npm run build`

```bash
# bare RN
cd example && npm run start -- --reset-cache

# Expo
cd expo-example && npx expo start --dev-client --clear
```

### Sift `@import` error during `pod install`

The bare RN example's [example/ios/Podfile](../example/ios/Podfile) patches `-fmodules -fcxx-modules` into SiftReactNative's xcconfig in `post_install`. Re-run `pod install` from `example/ios/` if you see it. The Expo plugin handles this automatically — re-run `expo prebuild --clean` if it bites in the Expo example.

### `ExpoModulesJSI` errors — `'facebook::jsi::Object' has no member 'deleteProperty'` / `no exact matches in call to instance method 'getProperty'`

JSI ABI mismatch. Expo SDK 56+ modules call newer JSI APIs (`Object::deleteProperty`, an updated `getProperty` overload) that React Native 0.81 doesn't ship. Symptom: build fails inside `expo-modules-core`'s Swift sources (`JavaScriptObject.swift`, `JSIRepresentable.swift`) even though nothing in your own code changed.

Cause: someone ran `npx expo install` (or manually bumped a dep) which upgraded `expo` past the SDK 54 line, but `react-native` is still pinned to 0.81.5.

Verify:

```bash
cd expo-example
grep '"version"' node_modules/expo/package.json node_modules/react-native/package.json
# expo should be 54.x; react-native 0.81.x. Any other combo is a mismatch.
```

Fix (re-pin to SDK 54):

```bash
cd expo-example
# Make sure package.json has `"expo": "~54.0.0"`, NOT `^56.x` or anything higher.
rm -rf node_modules package-lock.json ios android
npm install
npx expo prebuild --clean
npx expo run:ios
```

The full SDK 54 stack: `expo ~54.0.0`, `expo-modules-core 3.x` (transitive), `react 19.1.0`, `react-native 0.81.5`, `babel-preset-expo ~54.0.x`, `expo-build-properties ~0.14.x`. If you want to upgrade to a newer Expo SDK, bump them all together via `npx expo install --check`.

### `'Sift/Sift.h' file not found` during `xcodebuild` (Expo)

`sift-react-native@1.0.1` imports `<Sift/Sift.h>` but doesn't declare `s.dependency 'Sift'` in its podspec, so the host Podfile has to add `pod 'Sift'` itself. The Frame config plugin injects this for you — but only if `npx expo prebuild --clean` is run **after** the plugin code on disk was last updated. Symptom: the generated `expo-example/ios/Podfile` is missing the `# @generated framepayments-react-native sift_pod` sentinel and the `pod 'Sift'` line inside the target block.

Fix:

```bash
cd expo-example
npx expo prebuild --clean
grep -E "pod 'Sift'|pod 'ProveAuth'" ios/Podfile   # both should be present
FRAME_SECRET_KEY=sk_sandbox_... FRAME_PUBLISHABLE_KEY=pk_sandbox_... npx expo run:ios
```

### General rule — re-run `prebuild --clean` after SDK source updates

The Frame config plugin lives at [plugin/](../plugin) (loaded via `app.plugin.js`). Its output is "baked" into `expo-example/ios/` and `expo-example/android/` only at `prebuild` time, **not** at `run:ios` / `run:android` time. So any time you:

- pull SDK updates from git that touch `plugin/*.js`,
- bump `framepayments-react-native` in `expo-example/package.json`,
- or change plugin props in `expo-example/app.json`,

re-run `npx expo prebuild --clean` before the next build. Otherwise the native projects still reflect the **older** plugin output and you'll see ghost failures (missing pods, stale entitlements, missing AndroidManifest entries) that look unrelated to what you actually changed.

Quick check whether the on-disk Podfile is out of sync:

```bash
# from repo root: compare plugin source mtime against generated Podfile mtime
stat -f "%Sm %N" plugin/withFramePodfile.js expo-example/ios/Podfile
```

If `withFramePodfile.js` is newer than the Podfile, re-prebuild.

### `'Sift/Sift.h' file not found` during `expo run:ios`

The generated `expo-example/ios/Podfile` is stale — it was created by an older version of the Frame Expo plugin that didn't yet inject `pod 'Sift'` (the `sift-react-native` 1.0.1 podspec imports `<Sift/Sift.h>` without declaring the dep, so the host has to pull it in). This happens whenever the plugin (`plugin/withFramePodfile.js`) has been updated since your last prebuild.

```bash
cd expo-example
npx expo prebuild --clean

# sanity-check the patches landed
grep -E "pod 'Sift'|pod 'ProveAuth'" ios/Podfile
# should show both lines (ProveAuth only when enableProveAuth: true in app.json)

FRAME_SECRET_KEY=sk_sandbox_... FRAME_PUBLISHABLE_KEY=pk_sandbox_... npx expo run:ios
```

**Rule of thumb:** any time you pull SDK updates that touch `plugin/`, re-run `prebuild --clean` before `run:ios`. The Podfile, AndroidManifest, entitlements, and Gradle files are all regenerated from those plugin files.

### Prove `pod 'ProveAuth'` fails to resolve

Run the cocoapods-art setup at the top of this doc. Verify with:

```bash
pod repo-art list
# Should include: prove.jfrog.io
```

### "Duplicate React instances" in Metro

The Expo example sets `disableHierarchicalLookup: true` in [expo-example/metro.config.js](../expo-example/metro.config.js) to prevent this. If you see it in the bare RN example, run `npm dedupe react react-native` in `example/`.
