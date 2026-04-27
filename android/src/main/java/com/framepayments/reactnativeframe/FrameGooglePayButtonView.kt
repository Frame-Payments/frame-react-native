package com.framepayments.reactnativeframe

import android.view.Choreographer
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.framepayments.framesdk_ui.buttons.FrameGooglePayButton
import com.google.gson.Gson
import org.json.JSONObject

class FrameGooglePayButtonView(context: ThemedReactContext) : FrameLayout(context) {

  private val innerButton: FrameGooglePayButton = FrameGooglePayButton(context)

  private var amountCents: Int = 0
  private var customerId: String? = null
  private var currencyCode: String = "USD"
  private var googlePayMerchantId: String? = null
  private var pendingConfigure: Boolean = false

  init {
    addView(innerButton, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  fun setAmountCents(value: Int) {
    if (amountCents == value) return
    amountCents = value
    scheduleConfigure()
  }

  fun setCustomerId(value: String?) {
    if (customerId == value) return
    customerId = value
    scheduleConfigure()
  }

  fun setCurrencyCode(value: String?) {
    val next = value ?: "USD"
    if (currencyCode == next) return
    currencyCode = next
    scheduleConfigure()
  }

  fun setGooglePayMerchantId(value: String?) {
    if (googlePayMerchantId == value) return
    googlePayMerchantId = value
    scheduleConfigure()
  }

  private fun scheduleConfigure() {
    if (pendingConfigure) return
    pendingConfigure = true
    Choreographer.getInstance().postFrameCallback {
      pendingConfigure = false
      configureNow()
    }
  }

  private fun configureNow() {
    if (amountCents <= 0) return
    innerButton.configure(
      amountCents = amountCents,
      customerId = customerId,
      currencyCode = currencyCode,
      googlePayMerchantId = googlePayMerchantId,
      onResult = { result -> emitResult(result) },
      onReadinessChanged = { isReady -> emitReadiness(isReady) }
    )
  }

  private fun emitResult(result: FrameGooglePayButton.Result) {
    val map = WritableNativeMap()
    when (result) {
      is FrameGooglePayButton.Result.Success -> {
        map.putString("status", "success")
        val json = Gson().toJson(result.chargeIntent)
        map.putMap("chargeIntent", jsonObjectToWritableMap(JSONObject(json)))
      }
      is FrameGooglePayButton.Result.Failure -> {
        map.putString("status", "failure")
        map.putString("message", result.message)
      }
      is FrameGooglePayButton.Result.Cancelled -> {
        map.putString("status", "cancelled")
      }
    }
    dispatchEvent("topResult", map)
  }

  private fun emitReadiness(isReady: Boolean) {
    val map = WritableNativeMap()
    map.putBoolean("isReady", isReady)
    dispatchEvent("topReadinessChanged", map)
  }

  private fun dispatchEvent(eventName: String, payload: WritableNativeMap) {
    val reactContext = context as? ReactContext ?: return
    reactContext.getJSModule(RCTEventEmitter::class.java)
      .receiveEvent(id, eventName, payload)
  }
}
