package com.framepayments.reactnativeframe

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class FrameGooglePayButtonViewManager : SimpleViewManager<FrameGooglePayButtonView>() {

  override fun getName(): String = "FrameGooglePayButtonView"

  override fun createViewInstance(reactContext: ThemedReactContext): FrameGooglePayButtonView =
    FrameGooglePayButtonView(reactContext)

  @ReactProp(name = "amountCents", defaultInt = 0)
  fun setAmountCents(view: FrameGooglePayButtonView, value: Int) {
    view.setAmountCents(value)
  }

  @ReactProp(name = "customerId")
  fun setCustomerId(view: FrameGooglePayButtonView, value: String?) {
    view.setCustomerId(value)
  }

  @ReactProp(name = "currencyCode")
  fun setCurrencyCode(view: FrameGooglePayButtonView, value: String?) {
    view.setCurrencyCode(value)
  }

  @ReactProp(name = "googlePayMerchantId")
  fun setGooglePayMerchantId(view: FrameGooglePayButtonView, value: String?) {
    view.setGooglePayMerchantId(value)
  }

  override fun getExportedCustomBubblingEventTypeConstants(): Map<String, Any> = mapOf(
    "topResult" to mapOf(
      "phasedRegistrationNames" to mapOf("bubbled" to "onResult")
    ),
    "topReadinessChanged" to mapOf(
      "phasedRegistrationNames" to mapOf("bubbled" to "onReadinessChanged")
    )
  )
}
