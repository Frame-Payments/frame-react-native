package com.framepayments.reactnativeframe

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.framepayments.frameonboarding.views.FramePayoutView
import com.framepayments.framesdk.FrameResult
import com.framepayments.framesdk.payoutsessions.FramePayoutClientSecret

/** Hosts frame-android's standalone FramePayoutView. */
class FramePayoutActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val accountId = intent.getStringExtra(EXTRA_ACCOUNT_ID)
    val clientSecret = intent.getStringExtra(EXTRA_PAYOUT_CLIENT_SECRET)
    if (accountId.isNullOrEmpty() || clientSecret.isNullOrBlank() || !intent.hasExtra(EXTRA_PAYOUT_EXPIRES_AT)) {
      setResult(RESULT_CANCELED)
      finish()
      return
    }
    val expiresAt = intent.getLongExtra(EXTRA_PAYOUT_EXPIRES_AT, 0L)
    val amountCents = intent.getIntExtra(EXTRA_PAYOUT_AMOUNT_CENTS, 0)
    val amountCurrency = intent.getStringExtra(EXTRA_PAYOUT_AMOUNT_CURRENCY) ?: "usd"

    setContent {
      FramePayoutView(
        accountId = accountId,
        clientSecret = FramePayoutClientSecret(
          clientSecret = clientSecret,
          expiresAt = expiresAt,
          amountCents = amountCents,
          amountCurrency = amountCurrency,
        ),
      ) { result ->
        when (result) {
          is FrameResult.Completed -> {
            setResult(Activity.RESULT_OK, Intent().putExtra(EXTRA_TRANSFER_ID, result.id))
          }
          FrameResult.Cancelled -> setResult(Activity.RESULT_CANCELED)
          is FrameResult.Failed -> {
            setResult(
              RESULT_FAILED,
              Intent().putExtra(
                EXTRA_FAILURE_MESSAGE,
                result.error.message ?: "Payout did not produce a transfer id",
              ),
            )
          }
        }
        finish()
      }
    }
  }

  companion object {
    const val EXTRA_ACCOUNT_ID = "account_id"
    const val EXTRA_PAYOUT_CLIENT_SECRET = "payout_client_secret"
    const val EXTRA_PAYOUT_EXPIRES_AT = "payout_expires_at"
    const val EXTRA_PAYOUT_AMOUNT_CENTS = "payout_amount_cents"
    const val EXTRA_PAYOUT_AMOUNT_CURRENCY = "payout_amount_currency"
    const val EXTRA_TRANSFER_ID = "transfer_id"
    const val EXTRA_FAILURE_MESSAGE = "failure_message"
    const val REQUEST_CODE = 9006
    /** Maps to PAYMENT_FAILED in FrameSDKModule, matching checkout. */
    const val RESULT_FAILED = Activity.RESULT_FIRST_USER
  }
}
