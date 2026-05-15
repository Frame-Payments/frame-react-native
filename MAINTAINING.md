# Maintaining frame-react-native

This document covers how to keep the package dependencies up to date across all three layers: Node, Android, and iOS.

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
Edit `package.json` manually, then run:
```sh
npm install
```

Key packages to watch:
- `react-native` peer dependency — match the minimum version your SDK supports
- `typescript` — check for breaking changes in new major versions
- `@types/react`, `@types/react-native` — keep aligned with the peer dependency versions

---

## Native SDK versions — single source of truth

The Frame iOS and Android SDK versions live in **one place**: the top-level
`frameNativeVersions` field in `package.json`.

```json
"frameNativeVersions": {
  "ios": "2.2.2",
  "android": "2.0.8"
}
```

- **iOS podspec** (`ios/FrameReactNative.podspec`) reads `frameNativeVersions.ios`
  and passes it to RN's `spm_dependency(...)` Podfile hook. `pod install` then
  resolves `frame-ios` automatically via Swift Package Manager.
- **Android build.gradle** parses `package.json` with `JsonSlurper` and uses
  `frameNativeVersions.android` for `com.framepayments:framesdk*` dependencies.
- **`Package.swift`** is the one duplicated pin (Swift Package manifests cannot
  read JSON). Keep the `from: "X.Y.Z"` in `Package.swift` in lock-step with
  `frameNativeVersions.ios` when you bump.

Bumping a native SDK is therefore a 1- or 2-line edit:

| Bumping… | Files to edit |
|---|---|
| frame-android only | `package.json` (`frameNativeVersions.android`) |
| frame-ios only     | `package.json` (`frameNativeVersions.ios`) AND `Package.swift` line 26 |
| Both               | All three places above |

Releases:
- frame-ios: https://github.com/Frame-Payments/frame-ios
- frame-android: https://github.com/Frame-Payments/frame-android

## Android

Android dependencies are declared in `android/build.gradle`.

### Supporting dependencies
Update these as needed, checking for compatibility with the Frame SDK version:
```groovy
implementation 'com.google.code.gson:gson:2.10.1'
implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
implementation 'androidx.lifecycle:lifecycle-runtime-compose:2.8.2'
```

> **Note:** `lifecycle-runtime-compose` must be >= 2.8 — the Frame SDK UI uses Jetpack Compose with `LocalLifecycleOwner`, which requires this minimum version.

### Gradle tooling
Update the build toolchain versions in `android/build.gradle` when needed:
```groovy
classpath 'com.android.tools.build:gradle:8.1.0'
classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.0"
```
Also update `compileSdk` / `targetSdk` defaults as new Android API levels are released.

### React Native
`com.facebook.react:react-native:+` is unpinned and resolves to whatever version the host app provides. No action needed here.

---

## iOS

### Frame iOS SDK
Managed via `frameNativeVersions.ios` in `package.json` (see "Native SDK versions —
single source of truth" above). The podspec calls RN's `spm_dependency(...)`
helper with that version; host apps using CocoaPods get `Frame-iOS` and
`Frame-Onboarding` resolved automatically by `pod install` (no Xcode GUI step).

Pure-SPM consumers resolve `frame-ios` transitively through `Package.swift`.

### CocoaPods / React-Core
This package declares only `React-Core` as a pod dependency, which is versioned by the host app's React Native version. No manual update needed here.

To update CocoaPods itself (in the host app):
```sh
bundle exec pod update
```

---

## Minimum platform versions

| Platform | Current minimum | Declared in |
|---|---|---|
| iOS | 17.0 | `ios/FrameReactNative.podspec`, `Package.swift` |
| Android minSdk | 26 | `android/build.gradle` |
| Android compileSdk / targetSdk | 36 | `android/build.gradle` |
| React Native | >= 0.81.0 | `package.json` |
| Node | >= 16 | `package.json` |

When raising minimums, update both the relevant config file and this table.

---

## Adding a new native view

When the Frame iOS or Android SDK ships a new UI view (e.g. a new payment sheet), it is **not** automatically available in React Native. Each new view must be explicitly bridged through all five layers below.

Use the existing `presentCheckout` / `presentCart` implementations as the pattern to follow.

### 1. iOS — `ios/FrameSDKBridge.swift`
Add a new `present*` private method that wraps the new SwiftUI view in a `UIHostingController` and presents it as a modal sheet. Add a corresponding `@objc public` entry point that calls it.

### 2. iOS — `ios/FrameSDKBridge.m`
Register the new method with the React Native bridge using `RCT_EXTERN_METHOD(...)`. Without this declaration, React Native cannot see the method.

### 3. Android — new Activity + `FrameSDKModule.kt`
Create a new Activity (e.g. `FrameNewViewActivity.kt`) that inflates the new view from `framesdk_ui`. Add a corresponding `@ReactMethod` in `FrameSDKModule.kt` that launches it, and register the new Activity in `android/src/main/AndroidManifest.xml`.

### 4. TypeScript — `src/native.ts`
Add a new exported function that calls `FrameSDK.presentNewView(...)` with the appropriate parameters and return type.

### 5. TypeScript — `src/index.ts` and `src/types.ts`
Export the new function from `index.ts`, and add any new input/output types to `types.ts`.

### Checklist

| Layer | File(s) to change |
|---|---|
| iOS Swift | `ios/FrameSDKBridge.swift` |
| iOS ObjC bridge | `ios/FrameSDKBridge.m` |
| Android module | `android/.../FrameSDKModule.kt` + new Activity |
| TypeScript bridge | `src/native.ts` |
| TypeScript public API | `src/index.ts`, `src/types.ts` |

---

## After updating dependencies

1. Run the TypeScript build to catch any type errors:
   ```sh
   npm run build
   ```
2. Run tests:
   ```sh
   npm test
   ```
3. Build and test the example app on both platforms before publishing.
