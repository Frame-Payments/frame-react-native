package com.framepayments.reactnativeframe

import android.content.Intent
import android.os.Bundle
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import com.framepayments.framesdk.FrameNetworking
import com.framepayments.framesdk.chargeintents.ChargeIntent
import com.framepayments.framesdk_ui.FrameCheckoutView
import com.google.gson.Gson

class FrameCheckoutActivity : AppCompatActivity() {

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
    val checkoutView = FrameCheckoutView(this)
    checkoutView.configure(customerId, amount) { chargeIntent ->
      val json = Gson().toJson(chargeIntent)
      setResult(RESULT_OK, Intent().putExtra(EXTRA_CHARGE_INTENT_JSON, json))
      finish()
    }
    container.addView(checkoutView)
  }

  companion object {
    const val EXTRA_CUSTOMER_ID = "customer_id"
    const val EXTRA_AMOUNT = "amount"
    const val EXTRA_CHARGE_INTENT_JSON = "charge_intent_json"
    const val REQUEST_CODE = 9001
  }
}
