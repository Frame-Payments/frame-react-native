package com.framepayments.reactnativeframe

import android.content.Context
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.google.android.gms.wallet.button.ButtonConstants
import com.google.android.gms.wallet.button.ButtonOptions
import com.google.android.gms.wallet.button.PayButton
import org.json.JSONArray
import org.json.JSONObject

// Native wrapper around Google's PayButton (play-services-wallet:19.4.0+).
// Brand guidelines require the system button; we host it inside an RN-managed
// FrameLayout and forward taps to JS via the `onPress` event.

class FrameGooglePayButtonView(context: Context) : FrameLayout(context) {

  private val payButton = PayButton(context).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
  }

  private var theme: Int = ButtonConstants.ButtonTheme.DARK
  private var type: Int = ButtonConstants.ButtonType.PAY
  private var cornerRadiusDp: Int = 8

  // Defers the first PayButton.initialize() call until the view is attached to
  // a window. Google's PaymentsClient surface implicitly needs a host activity
  // context; initializing pre-attach has produced "no current activity" crashes
  // in the wild. Prop setters mark the button dirty; onAttachedToWindow + each
  // post-attach prop change call refresh().
  private var attached = false
  private var pendingRefresh = true

  init {
    addView(payButton)
    payButton.setOnClickListener {
      val ctx = context
      if (ctx is ReactContext) {
        ctx
          .getJSModule(RCTEventEmitter::class.java)
          .receiveEvent(id, "topPress", null)
      }
    }
  }

  fun setButtonTheme(value: String) {
    theme = when (value.lowercase()) {
      "light" -> ButtonConstants.ButtonTheme.LIGHT
      else -> ButtonConstants.ButtonTheme.DARK
    }
    markDirty()
  }

  fun setButtonType(value: String) {
    type = when (value.lowercase()) {
      "buy" -> ButtonConstants.ButtonType.BUY
      "book" -> ButtonConstants.ButtonType.BOOK
      "checkout" -> ButtonConstants.ButtonType.CHECKOUT
      "donate" -> ButtonConstants.ButtonType.DONATE
      "order" -> ButtonConstants.ButtonType.ORDER
      "subscribe" -> ButtonConstants.ButtonType.SUBSCRIBE
      "plain" -> ButtonConstants.ButtonType.PLAIN
      else -> ButtonConstants.ButtonType.PAY
    }
    markDirty()
  }

  fun setCornerRadiusDp(value: Int) {
    cornerRadiusDp = value.coerceAtLeast(0)
    markDirty()
  }

  private fun markDirty() {
    pendingRefresh = true
    if (attached) refresh()
  }

  private fun refresh() {
    if (!pendingRefresh) return
    val allowed = JSONArray().apply {
      put(JSONObject().apply {
        put("type", "CARD")
        put("parameters", JSONObject().apply {
          put("allowedAuthMethods", JSONArray(listOf("PAN_ONLY", "CRYPTOGRAM_3DS")))
          put("allowedCardNetworks", JSONArray(listOf("AMEX", "DISCOVER", "MASTERCARD", "VISA")))
        })
      })
    }
    val options = ButtonOptions.newBuilder()
      .setButtonTheme(theme)
      .setButtonType(type)
      .setCornerRadius(cornerRadiusDp)
      .setAllowedPaymentMethods(allowed.toString())
      .build()
    payButton.initialize(options)
    pendingRefresh = false
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attached = true
    refresh()
  }

  override fun onDetachedFromWindow() {
    attached = false
    super.onDetachedFromWindow()
  }
}
