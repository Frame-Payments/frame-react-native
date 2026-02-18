# Frame React Native SDK

React Native SDK for [Frame Payments](https://framepayments.com). It bridges the native Frame iOS and Android SDKs to provide payment UI (checkout and cart modals) and initialization. For API operations (customers, charge intents, refunds, etc.), use the [framepayments](https://www.npmjs.com/package/framepayments) (frame-node) package from JavaScript.

## Requirements

- React Native >= 0.72
- iOS 17+ / Android 8.0+ (API 26+)
- A [Frame](https://framepayments.com) account and API key

**Tested with:** Frame iOS SDK (SPM) and Frame Android SDK 1.2.x. Other compatible versions may work but are not officially tested.

## Installation

```bash
npm install framepayments-react-native
# or
yarn add framepayments-react-native
```

### iOS

1. **Add the Frame iOS SDK via Swift Package Manager** (required): In Xcode, open your project, then go to **File → Add Package Dependencies**. Enter:
   ```
   https://github.com/Frame-Payments/frame-ios
   ```
   Add the **Frame-iOS** package and choose the version or branch you need. The React Native SDK’s native code depends on it; CocoaPods cannot pull it in automatically.

2. **Preload Frame on the main thread** (required): Add this to your `AppDelegate.m` or `AppDelegate.mm` **before** calling `[super application:didFinishLaunchingWithOptions:]`:
   ```objc
   #import "YourAppName-Swift.h"  // Use your app's module name
   // ...
   - (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
   {
     [FramePreloader preloadOnMainThread];  // Prevents "Helpers are not supported by the default hub" crash
     return [super application:application didFinishLaunchingWithOptions:launchOptions];
   }
   ```
   `FramePreloader` is part of the SDK and loads Frame/Evervault/Sift on the main thread before the React Native bridge initializes.

3. **Install pods**:
   ```bash
   cd ios && pod install && cd ..
   ```

4. Run the app (e.g. `npx react-native run-ios`). The example app already includes this setup.

### Android

No extra steps; autolinking includes the native module.

## Usage

### 1. Initialize

Call once at app startup (e.g. in your root component or App.js). Returns a Promise; await or catch to handle native init errors.

```ts
import Frame from 'framepayments-react-native';

Frame.initialize({
  apiKey: 'YOUR_FRAME_SECRET_KEY',
  debugMode: false, // set true for development
}).catch((e) => console.warn('Frame init failed:', e.message));
```

### 2. Present Checkout

Opens the native checkout modal. Resolves with the created charge intent on success.

```ts
const chargeIntent = await Frame.presentCheckout({
  customerId: 'cus_xxx', // optional
  amount: 10000, // cents
});
```

### 3. Present Cart

Opens the cart flow (cart screen then checkout). Resolves with the charge intent when the user completes payment.

```ts
const chargeIntent = await Frame.presentCart({
  customerId: 'cus_xxx', // optional
  items: [
    { id: '1', title: 'Product A', amountInCents: 10000, imageUrl: 'https://...' },
  ],
  shippingAmountInCents: 500,
});
```

### Error handling

The SDK rejects with an error object that includes `code` and `message`. Common codes:

- `NOT_INITIALIZED` – You called `presentCheckout` or `presentCart` before `Frame.initialize()`.
- `USER_CANCELED` – The user dismissed the modal or closed checkout without completing payment.
- `NO_ACTIVITY` / `NO_ROOT_VC` – No host activity or view controller available (e.g. app not ready).

```ts
try {
  const intent = await Frame.presentCheckout({ amount: 10000 });
} catch (e: any) {
  if (e.code === 'USER_CANCELED') return;
  console.error(e.code, e.message);
}
```

### API calls (customers, charge intents, refunds)

Install the Frame Node SDK (optional peer dependency) and use it from your React Native app:

```bash
npm install framepayments
```

```ts
import { FrameSDK } from 'framepayments';

const frame = new FrameSDK({ apiKey: 'YOUR_SECRET_KEY' });
const customers = await frame.customers.list();
```

## Security

- **API key**: Use your Frame **secret** key only in a secure context. Do not commit it to source control; use environment variables or a secure config.
- **Production**: Disable `debugMode` in production to avoid logging sensitive data.
- Payment card data is handled by the native Frame SDKs (Evervault, etc.) and never touches your JS bundle.

## Troubleshooting (iOS)

- **"Helpers are not supported by the default hub"** – This comes from the native Frame iOS SDK or its dependency (Evervault). Ensure the app target has the **Frame-iOS** Swift package added in Xcode (**File → Add Package Dependencies** → `https://github.com/Frame-Payments/frame-ios`) and that the package and its dependencies are up to date. The example app now catches this error and shows it in the UI instead of crashing.

## Running the example

The [example](./example) folder contains a sample app (App.tsx, package.json) that uses the SDK for init, presentCheckout, presentCart, and frame-node for listing customers.

1. **From this repo (local SDK):** Create a new React Native app (e.g. `npx react-native init FrameExample`), then copy `example/App.tsx` into it and add the dependency: `"framepayments-react-native": "file:/path/to/frame-react-native"`. Run `npm install`. On iOS: add Frame-iOS via SPM in Xcode (see [Installation – iOS](#ios) above), then `cd ios && pod install`. See [example/README.md](./example/README.md) for details.
2. **Using the published package:** Install `framepayments-react-native` and `framepayments` in your app and use the same patterns as in `example/App.tsx`.

## Release checklist

For maintainers publishing a new version:

1. Bump version in `package.json`
2. Update `CHANGELOG.md` with the new version and date
3. Commit and tag: `git tag v1.0.0`
4. Push and create a GitHub release
5. Publish: `npm publish --access public` (for scoped packages)

## License

Apache-2.0
