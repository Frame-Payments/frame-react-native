# Maintaining frame-react-native

This document covers what to keep current in 4.x. The SDK is standalone — no Frame iOS / Frame Android native dependency to track — so most maintenance is npm packages, the small set of Google / Prove deps still pulled in via Gradle / CocoaPods, and the platform minimums.

---

## Node (npm)

### Check for outdated packages

```sh
npm outdated
```

### Update within current semver ranges

```sh
npm update
```

### Bump major versions

Edit `package.json` manually, then run `npm install`.

Packages worth watching:

| Package | Notes |
|---|---|
| `framepayments` | The networking SDK. Pinned to `^2.1.4` (the `defaultHeaders` knob lives there). Any new endpoint the RN SDK calls must first land in `framepayments` (see `/Users/erictownsend/Documents/GitHub/frame-node`). Bump the floor here when you adopt a new method. |
| `react-native` (peer) | Floor is `>=0.81`. The C++20 / Folly post-install flags in `plugin/withFramePodfile.js` track this version. |
| `typescript` | Check for breaking changes when major-bumping. |
| `@types/react` | Keep aligned with the `react` peer your consumers use. |
| `@evervault/evervault-react-native` | Hard peer. Used for PAN encryption at submit time. |
| `@fingerprintjs/fingerprintjs-pro-react-native` | Hard peer. Fraud signals on every request. |
| `sift-react-native` | Hard peer. Sift session is initialized in `Frame.initialize`. |
| `libphonenumber-js` | Phone parsing. Vendor data file updates ship as patch releases. |

---

## Adding a new endpoint or response field

If the bridge needs to call something `framepayments` doesn't expose yet:

1. Add it in `frame-node` first (typed method, axios test, CHANGELOG entry).
2. Cut a `framepayments` release.
3. Bump the `framepayments` floor in this package's `package.json`.
4. Consume the new method from `src/client.ts` (or directly from the call site).

Do **not** reach past `framepayments` to call the REST API yourself from inside this SDK — the publishable-key / secret-key routing and the sanitized `FrameAPIError.raw` envelope are enforced by the interceptor in `framepayments`.

---

## Adding a new screen

Screens live under `src/ui/screens/`. They're pure React Native — no native code required.

1. Add the screen file (`src/ui/screens/foo/FooScreen.tsx`) and, if it needs state, a sibling `useFooViewModel.ts` + pure `fooReducer.ts`.
2. Reuse primitives from `src/ui/primitives/` (Button, ValidatedTextField, BottomSheet, etc.). Don't introduce a third button variant if `Button` already covers it.
3. Wire it into the orchestrator that presents it (e.g. `src/ui/screens/onboarding/OnboardingRoot.tsx` or the modal presenter in `src/presenter/`).
4. Add tests next to the file: reducer transitions in a `.test.ts`, render smoke in a `.test.tsx` if it has non-trivial interaction.

---

## Adding a new public API method

1. Implement the orchestration in `src/native.tsx` (the file ships both `.ts` and `.tsx` because some entrypoints render React).
2. Re-export it from `src/index.ts` and add the input/result types to `src/types.ts`.
3. Update the API reference section in [README.md](./README.md).
4. Add a `__tests__` entry covering happy path + the obvious failure mode.

---

## Adding a new native bridge

Native bridges in 4.x are reserved for things that genuinely need platform primitives — PassKit (Apple Pay), Google Pay's `PaymentsClient`, `DCAppAttestService` (iOS-only; Android has no device-attestation equivalent in this SDK), and the Prove SDK. Most features don't need this. Before adding one, confirm there's no JS-only path.

When a bridge is unavoidable, the existing pairs are the pattern to copy:

| Native module | iOS files | Android files |
|---|---|---|
| `FrameApplePay` | `ios/ApplePayBridge.swift`, `ios/ApplePayBridge.m` | n/a |
| `FrameGooglePay` | n/a | `android/.../GooglePayBridge.kt` |
| `FrameAttestation` | `ios/AttestationBridge.swift` + `.m` | n/a (iOS-only) |
| `FrameProveAuth` | `ios/ProveAuthBridge.swift` + `.m` | `android/.../ProveAuthBridge.kt` |
| View managers (Apple/Google Pay buttons) | `ios/FrameApplePayButtonView.swift` + `.m` | `android/.../FrameGooglePayButtonView.kt` |

Then expose a thin JS wrapper under `src/<feature>/` and route the call site through it — do not call `NativeModules.X` directly from screens.

---

## iOS deps

The podspec (`FrameReactNative.podspec`) only declares `React-Core`. Everything else is autolinked or peer-injected:

- Apple Pay → PassKit (system framework).
- App Attest → DeviceCheck (system framework).
- Prove → the host app installs `pod 'ProveAuth'` if it ships the `phone_verification` capability. The cocoapods-art jfrog source is registered in `plugin/withFramePodfile.js`.
- C++20 / Folly flags → injected by the same plugin (RN 0.81+ requirement).

When raising the iOS deployment target, update:

- `FrameReactNative.podspec` (`s.platform = :ios, '17.0'`)
- the minimum row in this file's table

---

## Android deps

`android/build.gradle` pulls in:

| Dep | Why |
|---|---|
| `com.facebook.react:react-native:+` | RN, unpinned — resolves to whatever the host provides. |
| `org.jetbrains.kotlin:kotlin-stdlib:2.1.0` | Kotlin runtime. |
| `com.google.android.gms:play-services-wallet:19.4.0` | Used by `GooglePayBridge`. |
| `org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1` | Used by `ProveAuthBridge`. |

The Prove Android SDK (`com.prove.sdk:proveauth:6.10.3`) is declared `compileOnly` so the bridge can use real types without forcing host apps that don't ship `phone_verification` to pull it in. Host apps that DO ship `phone_verification` add it as `implementation` in their own `app/build.gradle`; the bridge probes for the class at runtime and degrades to `PROVE_UNAVAILABLE` when missing.

`consumer-rules.pro` ships ProGuard / R8 rules covering RN annotations, the wallet reflection paths, and the reflective Prove lookup. Whenever a new reflective dep is added, add a keep rule there too.

---

## Minimum platform versions

| Platform | Current minimum | Declared in |
|---|---|---|
| iOS | 17.0 | `FrameReactNative.podspec` |
| Android minSdk | 26 | `android/build.gradle` |
| Android compileSdk / targetSdk | 36 | `android/build.gradle` |
| React Native | >= 0.81.0 | `package.json` `peerDependencies` |
| Node | >= 18 | `package.json` `engines` |

When raising any minimum, update both the config file and the table above. Call it out in `CHANGELOG.md` — these are breaking changes for consumers.

---

## After updating dependencies

1. Typecheck:
   ```sh
   npm run typecheck
   ```
2. Tests:
   ```sh
   npm test
   ```
3. Rebuild both example apps end-to-end on a real device or simulator:
   - `cd example && npm install && cd ios && pod install && cd .. && npm run ios && npm run android`
   - `cd expo-example && npm install && npx expo prebuild --clean && npx expo run:ios && npx expo run:android`
4. Verify `npm pack` produces a clean tarball:
   ```sh
   npm pack --dry-run
   ```
   Confirm no `Package.swift`, no `.build/`, no `FramePreloader.*`, no `example/` or `expo-example/` content leaks into the archive.
