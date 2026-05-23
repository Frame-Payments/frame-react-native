# Frame React Native consumer ProGuard rules. Applied to host apps via the
# consumerProguardFiles entry in android/build.gradle. Keeps classes referenced
# by reflection at runtime so R8 / ProGuard minification doesn't break the SDK.

# Prove SDK — ProveAuthBridge calls com.prove.sdk.proveauth.* directly (the
# dep is compileOnly, so host apps that ship phone_verification add it as
# implementation in their own app/build.gradle). The bridge also probes via
# Class.forName at runtime to short-circuit when the dep isn't linked. Keep
# the package so R8 doesn't obfuscate or strip the SDK classes in host apps.
-keep class com.prove.sdk.proveauth.** { *; }
-dontwarn com.prove.sdk.proveauth.**

# Google Pay SDK reflection. play-services-wallet uses reflection internally
# for PaymentDataRequest serialization. Keep the relevant classes.
-keep class com.google.android.gms.wallet.** { *; }
-dontwarn com.google.android.gms.wallet.**
-keep class com.google.android.gms.tasks.** { *; }

# Frame React Native modules. RN's ReactPackage discovers modules + view
# managers via reflection on @ReactMethod / @ReactProp annotations. Keep
# everything in the Frame namespace so the bridge survives minification.
-keep class com.framepayments.reactnativeframe.** { *; }
-keep @com.facebook.react.bridge.ReactMethod public class * { *; }
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp *;
}

# RCTEventEmitter event names. The Prove bridge emits "FrameProveOtpNeeded"
# via DeviceEventManagerModule which uses reflection. Keep the emitter
# package + the event method names.
-keep class com.facebook.react.modules.core.DeviceEventManagerModule** { *; }
