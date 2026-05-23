package com.framepayments.reactnativeframe

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.prove.sdk.proveauth.AuthFinishStep
import com.prove.sdk.proveauth.OtpFinishInput
import com.prove.sdk.proveauth.OtpFinishStep
import com.prove.sdk.proveauth.OtpStartInput
import com.prove.sdk.proveauth.OtpStartStep
import com.prove.sdk.proveauth.ProveAuth
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

// Android bridge for Prove's ProveAuth SDK. Surface mirrors the iOS bridge:
//
//   authenticate(authToken) -> Promise<{ status: 'success' | 'failed' }>
//   submitOtp(code) -> void   (resumes a suspended OTP request)
//   cancelOtp() -> void
//   cancelAuth() -> void
//
//   Event: FrameProveOtpNeeded — fires when Prove falls back to OTP.
//
// The Prove Android SDK (com.prove.sdk:proveauth) is declared as compileOnly
// in our android/build.gradle so this file compiles without forcing host apps
// that don't ship phone_verification to pull it in. Host apps that DO ship
// phone_verification add `implementation 'com.prove.sdk:proveauth:<version>'`
// to their own app/build.gradle. At runtime, we probe for the SDK class and
// resolve PROVE_UNAVAILABLE if missing so JS falls back to the Frame OTP path.
//
// Call sequence verified against frame-android's ProveAuthService.kt.

class ProveAuthBridge(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val scope = CoroutineScope(Dispatchers.Default + Job())
  private var authPromise: Promise? = null
  private var otpDeferred: CompletableDeferred<String?>? = null

  // Retained across the auth lifecycle so the Prove SDK's step closures don't
  // outlive the bridge's reference to them; cleared on terminal resolution.
  private var proveAuth: ProveAuth? = null

  override fun getName(): String = "FrameProveAuth"

  // RTNDeviceEventEmitter is the documented mechanism for arbitrary RN events
  // from a non-RCTEventEmitter module. JS subscribes via NativeEventEmitter.
  @ReactMethod
  fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

  @ReactMethod
  fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {}

  // ─── JS API ───

  @ReactMethod
  fun authenticate(authToken: String, promise: Promise) {
    if (authPromise != null) {
      promise.reject("PROVE_BUSY", "A Prove authentication is already in flight.")
      return
    }

    if (!isProveSdkLinked()) {
      promise.reject("PROVE_UNAVAILABLE", "Prove SDK is not linked in this app.")
      return
    }

    authPromise = promise
    scope.launch {
      try {
        runProveFlow(authToken)
        finishAuthSuccess()
      } catch (e: NoClassDefFoundError) {
        finishAuthFailure("Prove SDK is not linked in this app.")
      } catch (e: Throwable) {
        finishAuthFailure(e.message ?: "Prove authentication failed.")
      }
    }
  }

  @ReactMethod
  fun submitOtp(code: String, promise: Promise) {
    val deferred = otpDeferred
    if (deferred == null) {
      promise.resolve(null)
      return
    }
    otpDeferred = null
    deferred.complete(code)
    promise.resolve(null)
  }

  @ReactMethod
  fun cancelOtp(promise: Promise) {
    otpDeferred?.complete(null)
    otpDeferred = null
    promise.resolve(null)
  }

  @ReactMethod
  fun cancelAuth(promise: Promise) {
    otpDeferred?.complete(null)
    otpDeferred = null
    finishAuthFailure("Prove authentication canceled by user.")
    promise.resolve(null)
  }

  override fun invalidate() {
    scope.cancel()
    super.invalidate()
  }

  // ─── Internal ───

  private fun isProveSdkLinked(): Boolean = try {
    Class.forName("com.prove.sdk.proveauth.ProveAuth")
    true
  } catch (_: Throwable) {
    false
  }

  private fun emitOtpNeeded() {
    val params = WritableNativeMap()
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("FrameProveOtpNeeded", params)
  }

  private suspend fun runProveFlow(authToken: String) {
    val resultDeferred = CompletableDeferred<Result<Boolean>>()

    // AuthFinishStep fires when Prove signals "device auth ok". JS owns the
    // backend confirm step, so we resolve the bridge promise as soon as the
    // SDK reaches this point.
    val authFinishStep = AuthFinishStep { _ ->
      resultDeferred.complete(Result.success(true))
    }

    // The phone number is encoded in the authToken; phoneNumberNeeded=true is
    // a misconfiguration → error. Mirrors frame-android ProveAuthService.kt.
    val otpStartStep = OtpStartStep { phoneNumberNeeded, _, callback ->
      if (phoneNumberNeeded) {
        callback.onError()
      } else {
        callback.onSuccess(OtpStartInput(""))
      }
    }

    // OtpFinishStep — Prove falls back to OTP. Emit the event so JS shows its
    // entry sheet, then suspend on otpDeferred until submitOtp/cancelOtp
    // resolves it. Null means the user cancelled.
    val otpFinishStep = OtpFinishStep { _, callback ->
      scope.launch {
        // Guard against a stale deferred from a previous OTP request (Prove
        // can re-request OTP if the first code fails validation).
        otpDeferred?.complete(null)
        val deferred = CompletableDeferred<String?>()
        otpDeferred = deferred
        emitOtpNeeded()
        val otp = deferred.await()
        otpDeferred = null
        if (otp != null) {
          callback.onSuccess(OtpFinishInput(otp))
        } else {
          callback.onError()
        }
      }
    }

    val sdk = ProveAuth.builder()
      .withContext(reactContext.applicationContext)
      .withAuthFinishStep(authFinishStep)
      .withOtpFallback(otpStartStep, otpFinishStep)
      .build()
    proveAuth = sdk

    try {
      sdk.authenticate(authToken)
    } catch (e: Throwable) {
      releaseRetainedSDKObjects()
      resultDeferred.complete(Result.failure(e))
    }

    resultDeferred.await().getOrThrow()
    releaseRetainedSDKObjects()
  }

  private fun releaseRetainedSDKObjects() {
    proveAuth = null
  }

  private fun finishAuthSuccess() {
    val promise = authPromise ?: return
    authPromise = null
    val result = WritableNativeMap().apply { putString("status", "success") }
    promise.resolve(result)
  }

  private fun finishAuthFailure(message: String) {
    val promise = authPromise ?: return
    authPromise = null
    val result = WritableNativeMap().apply {
      putString("status", "failed")
      putString("message", message)
    }
    promise.resolve(result)
  }
}
