package com.framepayments.reactnativeframe

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import com.framepayments.framesdk.FrameNetworking
import com.framepayments.framesdk.chargeintents.ChargeIntent
import com.framepayments.framesdk_ui.FrameCheckoutView
import com.google.gson.Gson

class FrameCheckoutActivity : AppCompatActivity() {

  private val handler = Handler(Looper.getMainLooper())
  private var pollRunnable: Runnable? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val container = FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    }
    setContentView(container)
    val customerId = intent.getStringExtra(EXTRA_CUSTOMER_ID)
    val amount = intent.getIntExtra(EXTRA_AMOUNT, 0)

    // Evervault must be configured before FrameCheckoutView (EncryptedPaymentCardInput) can inflate.
    // configureEvervault() is async on first launch; direct checkout opens before it completes.
    tryShowCheckout(container, customerId, amount)
  }

  private fun tryShowCheckout(container: FrameLayout, customerId: String?, amount: Int) {
    if (FrameNetworking.isEvervaultConfigured) {
      addCheckoutView(container, customerId, amount)
      return
    }
    var attempts = 0
    val maxAttempts = 50 // 5 seconds
    pollRunnable = object : Runnable {
      override fun run() {
        if (isFinishing) return
        if (FrameNetworking.isEvervaultConfigured) {
          addCheckoutView(container, customerId, amount)
          pollRunnable = null
          return
        }
        attempts++
        if (attempts >= maxAttempts) {
          setResult(RESULT_CANCELED)
          finish()
          return
        }
        handler.postDelayed(this, 100)
      }
    }
    handler.postDelayed(pollRunnable!!, 100)
  }

  private fun addCheckoutView(container: FrameLayout, customerId: String?, amount: Int) {
    val checkoutView = FrameCheckoutView(this)
    checkoutView.configure(customerId, amount) { chargeIntent ->
      val json = Gson().toJson(chargeIntent)
      setResult(RESULT_OK, Intent().putExtra(EXTRA_CHARGE_INTENT_JSON, json))
      finish()
    }
    container.addView(checkoutView)
  }

  override fun onDestroy() {
    pollRunnable?.let { handler.removeCallbacks(it) }
    super.onDestroy()
  }

  companion object {
    const val EXTRA_CUSTOMER_ID = "customer_id"
    const val EXTRA_AMOUNT = "amount"
    const val EXTRA_CHARGE_INTENT_JSON = "charge_intent_json"
    const val REQUEST_CODE = 9001
  }
}
