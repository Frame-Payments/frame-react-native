# Frame React Native SDK

React Native SDK for [Frame Payments](https://framepayments.com). Bridges the native Frame iOS and Android SDKs to provide payment UI (checkout, cart, and onboarding modals) directly in your React Native app. For server-side API operations (customers, charge intents, refunds, etc.), use the [framepayments](https://www.npmjs.com/package/framepayments) Node.js package.

## Requirements

- React Native >= 0.74
- iOS 17+ / Android 8.0+ (API 26+)
- A [Frame](https://framepayments.com) account and API key

## Installation

```bash
npm install framepayments-react-native
# or
yarn add framepayments-react-native
```

### iOS setup

#### 1. Add the Frame iOS SDK via Swift Package Manager

The React Native SDK's native layer depends on the Frame iOS SDK, which must be added manually via SPM — CocoaPods cannot pull it in automatically.

In Xcode: **File → Add Package Dependencies**, enter:

```
https://github.com/Frame-Payments/frame-ios
```

Add the **Frame-iOS** package and select the version you need.

#### 2. Preload Frame on the main thread

Add this to your `AppDelegate.m` or `AppDelegate.mm` **before** `[super application:didFinishLaunchingWithOptions:]`:

```objc
#import "YourAppName-Swift.h"   // use your app's module name

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FramePreloader preloadOnMainThread];  // must be first
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}
```

This prevents the **"Helpers are not supported by the default hub"** crash, which occurs when Frame/Evervault initializes on a background thread during React Native bridge startup.

> If your app module name isn't the default (i.e., not matching the generated `-Swift.h` header), set `FRAME_SWIFT_HEADER=YourApp-Swift.h` in your target's **Preprocessor Macros** in Xcode build settings.

#### 3. Install pods

```bash
cd ios && pod install && cd ..
```

### Android setup

No extra steps required. Autolinking handles the native module automatically.

---

## Quick start

```ts
import Frame from 'framepayments-react-native';

// 1. Initialize once at app startup
await Frame.initialize({ apiKey: 'sk_sandbox_...', debugMode: __DEV__ });

// 2. Present a checkout modal
const chargeIntent = await Frame.presentCheckout({ amount: 10000 }); // cents

// 3. Present a cart flow
const result = await Frame.presentCart({
  items: [{ id: '1', title: 'Hat', amountInCents: 5000, imageUrl: 'https://...' }],
  shippingAmountInCents: 500,
});

// 4. Present an onboarding flow (KYC, bank account, etc.)
const onboarding = await Frame.presentOnboarding({
  accountId: 'acct_xxx',
  capabilities: ['kyc', 'bank_account_verification'],
});
```

---

## API reference

### `Frame.initialize(options)`

Initializes the native SDK. Must be called before any `present*` method. Call once at app startup (e.g., in your root component's `useEffect`).

```ts
await Frame.initialize({
  apiKey: 'sk_sandbox_...',  // your Frame secret key
  debugMode: false,          // set true in development to enable native debug logging
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Your Frame secret key |
| `debugMode` | `boolean` | No | Enables native debug logging. Default: `false` |

---

### `Frame.presentCheckout(options)`

Opens the native checkout modal. Resolves with a `ChargeIntent` when the user completes payment.

```ts
const chargeIntent = await Frame.presentCheckout({
  amount: 15000,           // required, in cents
  customerId: 'cus_xxx',  // optional
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `amount` | `number` | Yes | Payment amount in cents |
| `customerId` | `string` | No | Pre-associate the charge with a Frame customer |

**Returns:** [`ChargeIntent`](#chargeintent)

---

### `Frame.presentCart(options)`

Opens a cart review screen followed by the checkout flow. Resolves when the user completes payment or dismisses.

```ts
const chargeIntent = await Frame.presentCart({
  items: [
    {
      id: '1',
      title: 'Vintage Track Jacket',
      amountInCents: 10000,
      imageUrl: 'https://example.com/jacket.jpg',
    },
  ],
  shippingAmountInCents: 500,
  customerId: 'cus_xxx',       // optional
});
```

| Option | Type | Required | Description |
|---|---|---|---|
| `items` | `FrameCartItem[]` | Yes | Array of items to display in the cart |
| `shippingAmountInCents` | `number` | Yes | Shipping cost in cents |
| `customerId` | `string` | No | Pre-associate the charge with a Frame customer |

**`FrameCartItem` shape:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for the item |
| `title` | `string` | Display name |
| `amountInCents` | `number` | Item price in cents |
| `imageUrl` | `string` | URL of the product image |

**Returns:** [`ChargeIntent`](#chargeintent)

> **iOS limitation:** On iOS, `presentCart` resolves with an empty object (`{}`) rather than a full `ChargeIntent`. The underlying `FrameCartView` does not expose the charge intent from its nested checkout step. On Android, the full `ChargeIntent` is returned. Always guard with `intent?.id` before using the result.

---

### `Frame.presentOnboarding(options)`

Opens the native onboarding flow for KYC, identity verification, and payment method setup. Resolves when the user completes or dismisses.

```ts
const result = await Frame.presentOnboarding({
  accountId: 'acct_xxx',
  capabilities: ['kyc', 'bank_account_verification'],
});

if (result.status === 'completed') {
  console.log('Payment method created:', result.paymentMethodId);
}
```

| Option | Type | Required | Description |
|---|---|---|---|
| `accountId` | `string` | No | The Frame account to onboard |
| `capabilities` | `OnboardingCapability[]` | No | Which onboarding steps to include (see below) |

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
| `paymentMethodId` | `string \| undefined` | Set when a payment method was created or verified during the flow |

---

### `ChargeIntent`

Returned from `presentCheckout` and `presentCart` (Android only for cart).

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique charge intent ID |
| `amount` | `number` | Amount in cents |
| `currency` | `string` | ISO currency code (e.g. `"usd"`) |
| `status` | `ChargeIntentStatus` | Current status of the intent |
| `created` | `number` | Unix timestamp |
| `updated` | `number` | Unix timestamp |
| `livemode` | `boolean` | `true` in production, `false` in sandbox |
| `description` | `string \| undefined` | Optional description |
| `authorizationMode` | `'automatic' \| 'manual' \| undefined` | Capture mode |
| `failureDescription` | `string \| undefined` | Present when status is `failed` |
| `customer` | `Customer \| undefined` | Associated customer object |
| `paymentMethod` | `PaymentMethod \| undefined` | Payment method used |
| `latestCharge` | `Charge \| undefined` | Most recent charge on this intent |

**`ChargeIntentStatus` values:** `pending`, `succeeded`, `failed`, `canceled`, `incomplete`, `disputed`, `refunded`, `reversed`

---

### Error handling

All `present*` methods return Promises that reject with an error object containing `code` and `message`.

```ts
import Frame, { ErrorCodes } from 'framepayments-react-native';

try {
  const intent = await Frame.presentCheckout({ amount: 10000 });
  // handle success
} catch (e: any) {
  if (e.code === ErrorCodes.USER_CANCELED) {
    return; // user dismissed — not an error
  }
  console.error(`[${e.code}] ${e.message}`);
}
```

**Error codes (`ErrorCodes`):**

| Code | When it's thrown |
|---|---|
| `NOT_INITIALIZED` | `present*` called before `Frame.initialize()` |
| `USER_CANCELED` | User dismissed the modal without completing |
| `INIT_FAILED` | Native SDK failed to initialize |
| `NO_ROOT_VC` | iOS: no root view controller available |
| `NO_ACTIVITY` | Android: no host activity available |
| `INVALID_ITEMS` | Cart items could not be parsed |
| `NO_RESULT` | Native activity returned OK but no payload |
| `PARSE_ERROR` | Could not decode the native response |
| `ENCODE_ERROR` | iOS: could not encode the charge intent |
| `NETWORK_ERROR` | Network failure in the native SDK |
| `API_ERROR` | Frame API returned an error |

You can also use the `isFrameError` and `normalizeToFrameError` utilities for typed error handling:

```ts
import { isFrameError, normalizeToFrameError } from 'framepayments-react-native';

try {
  await Frame.presentCheckout({ amount: 5000 });
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
- Payment card data is handled entirely by the native Frame SDKs (via Evervault) and never passes through your JavaScript bundle.

---

## Troubleshooting

### "Helpers are not supported by the default hub" (iOS)

Frame/Evervault loaded on a background thread before the main thread was ready. Fix: add `[FramePreloader preloadOnMainThread]` to your `AppDelegate` before `[super application:didFinishLaunchingWithOptions:]`. See [iOS setup](#ios-setup).

Also ensure the **Frame-iOS** Swift package is added in Xcode (**File → Add Package Dependencies** → `https://github.com/Frame-Payments/frame-ios`).

### "The package doesn't seem to be linked"

- iOS: run `cd ios && pod install`, then rebuild.
- Android: rebuild the app (`npm run android`).
- Both: make sure you're running a debug build (not Expo Go), since this SDK uses native modules.

### Spinner stuck after onboarding completes (iOS)

Ensure you are using SDK version 1.1.0+. Earlier versions had a bug where programmatic dismiss from the onboarding flow did not resolve the promise.

### `presentCart` returns `{}` on iOS

This is a known limitation of `FrameCartView` on iOS — it does not expose the `ChargeIntent` from its nested checkout. On Android, the full object is returned. Guard with `intent?.id` before reading the result.

### `settings.gradle` build error on Android (RN 0.74+)

If you see `Could not read script '.../cli-platform-android/native_modules.gradle'`, remove the `apply from:` line referencing it from your `android/settings.gradle`. This file was removed in newer versions of `@react-native-community/cli-platform-android`; the gradle plugin handles it automatically.

---

## Example app

The [example/](./example) directory contains a full working app demonstrating all SDK features.

**Run on iOS:**
```bash
cd example
npm install
cd ios && pod install && cd ..
npm run ios
```

**Run on Android:**
```bash
cd example
npm install
npm run android
```

The example app covers `initialize`, `presentCheckout`, `presentCart`, `presentOnboarding`, and server-side API calls via `framepayments`.

---

## License

Apache-2.0
