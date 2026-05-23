package com.framepayments.reactnativeframe

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

/**
 * Single-method native module shim for 4.0.0. All JS-callable surfaces
 * (Checkout, Cart, Onboarding, Google Pay, Prove) live in their own modules.
 * initialize() is intentionally a no-op — src/config.ts holds the truth.
 */
class FrameSDKModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "FrameSDK"

  @ReactMethod
  fun initialize(
    secretKey: String,
    publishableKey: String,
    debugMode: Boolean,
    applePayMerchantId: String?,
    googlePayMerchantId: String?,
    theme: ReadableMap?,
    promise: Promise
  ) {
    @Suppress("UNUSED_PARAMETER") val unused = listOf(
      secretKey,
      publishableKey,
      debugMode,
      applePayMerchantId,
      googlePayMerchantId,
      theme,
    )
    promise.resolve(null)
  }
}
