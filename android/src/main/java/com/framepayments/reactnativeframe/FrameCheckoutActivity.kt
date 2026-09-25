package com.framepayments.reactnativeframe

import android.app.Activity.RESULT_CANCELED
import android.app.Activity.RESULT_OK
import android.content.Intent
import android.os.Bundle
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.framepayments.framesdk.EvervaultConfigurator
import com.framepayments.framesdk.FrameResult
import com.framepayments.framesdk_ui.FrameCheckoutView
import kotlinx.coroutines.launch

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
    val accountId = intent.getStringExtra(EXTRA_ACCOUNT_ID)
    val amount = intent.getIntExtra(EXTRA_AMOUNT, 0)

    // Bundled checkout always creates a Transfer, which requires an account.
    if (accountId.isNullOrEmpty()) {
      setResult(RESULT_CANCELED)
      finish()
      return
    }

    // Evervault must be configured before FrameCheckoutView (EncryptedPaymentCardInput) can inflate,
    // and on a cold start checkout can open before SDK init has configured it.
    lifecycleScope.launch {
      if (EvervaultConfigurator.ensureConfigured()) {
        addCheckoutView(container, accountId, amount)
      } else {
        finishFailed(this@FrameCheckoutActivity, "Card encryption is unavailable")
      }
    }
  }

  private fun addCheckoutView(container: FrameLayout, accountId: String, amount: Int) {
    val checkoutView = FrameCheckoutView(this)
    FrameRNTheme.current?.let { checkoutView.setTheme(it) }
    checkoutView.configure(accountId, amount) { result -> finishWithCheckoutResult(this, result) }
    container.addView(checkoutView)
  }

  companion object {
    const val EXTRA_ACCOUNT_ID = "account_id"
    const val EXTRA_AMOUNT = "amount"
    const val EXTRA_TRANSFER_ID = "transfer_id"
    const val EXTRA_FAILURE_MESSAGE = "failure_message"
    const val REQUEST_CODE = 9001
    /** Maps to PAYMENT_FAILED in FrameSDKModule, matching iOS. */
    const val RESULT_FAILED = android.app.Activity.RESULT_FIRST_USER

    fun finishWithCheckoutResult(activity: android.app.Activity, result: FrameResult) {
      when (result) {
        is FrameResult.Completed -> activity.setResult(RESULT_OK, Intent().putExtra(EXTRA_TRANSFER_ID, result.id))
        FrameResult.Cancelled -> activity.setResult(RESULT_CANCELED)
        is FrameResult.Failed -> {
          finishFailed(activity, result.error.message ?: "Checkout did not produce a transfer id")
          return
        }
      }
      activity.finish()
    }

    fun finishFailed(activity: android.app.Activity, message: String) {
      activity.setResult(RESULT_FAILED, Intent().putExtra(EXTRA_FAILURE_MESSAGE, message))
      activity.finish()
    }
  }
}
