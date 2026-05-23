# Frame React Native SDK — Bare RN Example

A minimal React Native 0.83 app that exercises the standalone Frame SDK 4.0:

- **Initialize** — `Frame.initialize({ secretKey, publishableKey, applePayMerchantId? })`
- **Checkout / Cart** — `Frame.presentCheckout(...)` and `Frame.presentCart(...)` render JS-driven modals
- **Onboarding** — `Frame.presentOnboarding({ accountId?, capabilities })`
- **Wallets** — `Frame.presentApplePay(...)` and `Frame.presentGooglePay(...)`
- **Server SDK** — the "View customers" button uses the [`framepayments`](https://www.npmjs.com/package/framepayments) Node SDK over the secret key, just to show that the two SDKs interoperate

## Prerequisites

- Node 18+
- React Native dev environment (Xcode for iOS, Android Studio for Android)
- A [Frame](https://framepayments.com) account with a secret key and a publishable key

## Setup

1. **Install dependencies.** The example pulls the SDK from the parent repo via
   `"framepayments-react-native": "file:.."`. It also installs the SDK's
   required peer deps (Evervault, FingerprintPro, Sift) so the bridge can
   load without runtime errors.

   ```bash
   cd example
   npm install
   ```

2. **Set your API keys.** Edit `App.tsx` and replace `FRAME_SECRET_KEY` /
   `FRAME_PUBLISHABLE_KEY` with your own, or export them as env vars before
   starting Metro. **Never commit real keys.**

3. **iOS:**

   ```bash
   cd ios && pod install && cd ..
   ```

   The SDK autolinks; no manual SPM step, no `FramePreloader` call. Apple Pay
   and App Attest entitlements are already configured under
   `ios/FrameExampleTemp/FrameExampleTemp.entitlements` — replace the sandbox
   merchant identifier with your own before shipping.

4. **Android:** autolinking handles everything. If you intend to ship the
   `phone_verification` onboarding capability, your host app must also add
   `implementation 'com.prove.sdk:proveauth:6.10.3'` to its `app/build.gradle`
   (this example's `android/settings.gradle` already wires the Prove
   Artifactory repository).

## Run

```bash
npm run ios          # or npm run ios:sim for the iPhone 17 Pro simulator
npm run android
npm run start        # Metro, in a separate terminal
```

## Note

If you cloned this repo for the first time and `npm install` fails, run
`npm install` at the repo root first — the example consumes the SDK via a
local `file:..` reference and needs the SDK's `lib/` directory built. The
SDK's `prepare` script builds `lib/` automatically on `npm install`.
