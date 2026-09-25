package com.framepayments.reactnativeframe

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.framepayments.frameonboarding.views.FrameAddPaymentMethodView
import com.framepayments.frameonboarding.views.FrameAddPayoutMethodView
import com.framepayments.frameonboarding.views.FrameSelectPayoutMethodView
import com.framepayments.framesdk.FrameResult

/** Hosts frame-android's standalone add-payment, add-payout, and select-payout screens. */
class FrameAddMethodActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val accountId = intent.getStringExtra(EXTRA_ACCOUNT_ID)
    val mode = intent.getStringExtra(EXTRA_MODE)
    if (accountId.isNullOrEmpty() || mode == null) {
      setResult(RESULT_CANCELED)
      finish()
      return
    }
    val clientSecret = intent.getStringExtra(EXTRA_CLIENT_SECRET)

    // onResult must be non-null: the views only handle system Back when it is.
    val onResult: (FrameResult) -> Unit = { result ->
      if (result is FrameResult.Completed) {
        setResult(RESULT_OK, Intent().putExtra(EXTRA_METHOD_ID, result.id))
      } else {
        setResult(RESULT_CANCELED)
      }
      finish()
    }

    setContent {
      when (mode) {
        MODE_ADD_PAYMENT -> FrameAddPaymentMethodView(accountId, clientSecret, onResult)
        MODE_ADD_PAYOUT -> FrameAddPayoutMethodView(accountId, clientSecret, onResult)
        MODE_SELECT_PAYOUT -> FrameSelectPayoutMethodView(accountId, clientSecret, onResult)
      }
    }
  }

  companion object {
    const val EXTRA_ACCOUNT_ID = "account_id"
    const val EXTRA_CLIENT_SECRET = "client_secret"
    const val EXTRA_MODE = "mode"
    const val EXTRA_METHOD_ID = "method_id"
    const val MODE_ADD_PAYMENT = "add_payment"
    const val MODE_ADD_PAYOUT = "add_payout"
    const val MODE_SELECT_PAYOUT = "select_payout"
    const val REQUEST_CODE = 9005
  }
}
