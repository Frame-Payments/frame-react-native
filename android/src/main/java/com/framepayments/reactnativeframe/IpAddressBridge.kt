package com.framepayments.reactnativeframe

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.URL

// Resolves the device's public IP via api.ipify.org so the SDK can attach it
// to every outgoing API request as the `ip_address` header. Matches Frame
// Android's SiftManager.getPublicIp() — caches the result for app lifecycle
// after the first successful lookup; failed lookups are not cached so the
// next call retries.
//
// Network I/O runs on Dispatchers.IO; the JS-facing method is async (resolves
// the Promise once the lookup completes). On any failure, the promise
// resolves null so callers fall back to "no header" rather than blocking
// initialization on a network round-trip.

class IpAddressBridge(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val scope = CoroutineScope(Dispatchers.IO + Job())

  @Volatile
  private var cachedIp: String? = null

  override fun getName(): String = "FrameIpAddress"

  @ReactMethod
  fun getIpAddress(promise: Promise) {
    cachedIp?.let {
      promise.resolve(it)
      return
    }
    scope.launch {
      val ip = fetchPublicIp()
      if (ip != null) cachedIp = ip
      promise.resolve(ip)
    }
  }

  override fun invalidate() {
    scope.cancel()
    super.invalidate()
  }

  private fun fetchPublicIp(): String? = try {
    val url = URL("https://api.ipify.org")
    BufferedReader(InputStreamReader(url.openStream())).use {
      it.readLine()?.trim()?.takeIf(String::isNotEmpty)
    }
  } catch (_: Throwable) {
    null
  }
}
