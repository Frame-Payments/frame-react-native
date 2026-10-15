# Frame React Native SDK – Example App

This example demonstrates:

- **Initialize** – `Frame.initialize({ publishableKey })` on app load
- **Checkout** – `Frame.presentCheckout({ accountId, amount, checkoutClientSecret })` to open the native checkout modal
- **Cart** – `Frame.presentCart({ accountId, items, shippingAmountInCents, checkoutClientSecret })` for the cart → checkout flow
- **Onboarding and checkout sessions** – the demo mints `onb_sess_` and `chk_sess_` tokens with the secret key. Saved cards on checkout require the checkout session.

## Prerequisites

- Node 16+
- React Native environment (Xcode for iOS, Android Studio / SDK for Android)
- A [Frame](https://framepayments.com) account, a **publishable** key (`pk_…`), and a **secret** key (`sk_…`) for the demo's session minting

## Setup

1. **Install dependencies**

   ```bash
   cd example
   npm install
   ```

2. **Set your API keys**

   `App.tsx` reads `FRAME_PUBLISHABLE_KEY` (`pk_…`, passed to `Frame.initialize`) and `FRAME_SECRET_KEY` (`sk_…`, used to mint `onb_sess_` and `chk_sess_` tokens). Put them in `example/.env` (gitignored):

   ```bash
   FRAME_PUBLISHABLE_KEY=pk_sandbox_...
   FRAME_SECRET_KEY=sk_sandbox_...
   ```

   `metro.config.js` loads that file into `process.env`. `babel.config.js` inlines `FRAME_*` into the bundle. A shell variable wins over `.env` (`FRAME_PUBLISHABLE_KEY=pk_sandbox_... npm run ios`). Restart Metro with `--reset-cache` after changing keys. Do not commit real keys. Leave `FRAME_SECRET_KEY` unset to run the publishable-key-only path.

3. **iOS only**: Add the Frame iOS SDK via Swift Package Manager in Xcode (**File → Add Package Dependencies** → `https://github.com/Frame-Payments/frame-ios`). Add `[FramePreloader preloadOnMainThread]` to `AppDelegate.m`/`.mm` **before** `[super application:didFinishLaunchingWithOptions:]` (see main README). Then:

   ```bash
   cd ios && pod install && cd ..
   ```

## Run

- **iOS**: `npm run ios`
- **Android**: `npm run android`
- **Metro**: `npm run start` (in a separate terminal)

## Note

The example app depends on the parent package via `"framepayments-react-native": "file:.."`. The parent repo must contain the full React Native SDK (including `ios/` and `android/`). If you cloned only the example, link the published package instead: `npm install framepayments-react-native`.
