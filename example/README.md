# Frame React Native SDK – Example App

This example demonstrates:

- **Initialize** – `Frame.initialize({ apiKey })` on app load
- **Checkout** – `Frame.presentCheckout({ amount })` to open the native checkout modal
- **Cart** – `Frame.presentCart({ items, shippingAmountInCents })` for the cart → checkout flow
- **API via frame-node** – "View customers" uses the `framepayments` (frame-node) package to list customers

## Prerequisites

- Node 16+
- React Native environment (Xcode for iOS, Android Studio / SDK for Android)
- A [Frame](https://framepayments.com) account and **secret** API key

## Setup

1. **Install dependencies**

   ```bash
   cd example
   npm install
   ```

2. **Set your API key**

   Edit `App.tsx` and set `FRAME_API_KEY` to your Frame secret key, or set the `FRAME_API_KEY` environment variable. Do not commit real keys.

3. **iOS only**: Add the Frame iOS SDK via Swift Package Manager in Xcode (**File → Add Package Dependencies** → `https://github.com/Frame-Payments/frame-ios`), then:

   ```bash
   cd ios && pod install && cd ..
   ```

## Run

- **iOS**: `npm run ios`
- **Android**: `npm run android`
- **Metro**: `npm run start` (in a separate terminal)

## Note

The example app depends on the parent package via `"@framepayments/react-native-frame": "file:.."`. The parent repo must contain the full React Native SDK (including `ios/` and `android/`). If you cloned only the example, link the published package instead: `npm install @framepayments/react-native-frame`.
