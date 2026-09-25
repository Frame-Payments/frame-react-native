package com.framepayments.reactnativeframe

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.framepayments.framesdk.EvervaultConfigurator
import com.framepayments.framesdk.FrameResult
import com.framepayments.framesdk_ui.FrameCheckoutView
import kotlinx.coroutines.CancellationException
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

    // The card input can't inflate until Evervault is configured, which may still be in flight on a cold start.
    lifecycleScope.launch {
      if (isCardEncryptionReady()) {
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
    const val RESULT_FAILED = Activity.RESULT_FIRST_USER

    suspend fun isCardEncryptionReady(): Boolean = try {
      EvervaultConfigurator.ensureConfigured()
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      false
    }

    fun finishWithCheckoutResult(activity: Activity, result: FrameResult) {
      when (result) {
        is FrameResult.Completed -> activity.setResult(Activity.RESULT_OK, Intent().putExtra(EXTRA_TRANSFER_ID, result.id))
        FrameResult.Cancelled -> activity.setResult(Activity.RESULT_CANCELED)
        is FrameResult.Failed -> {
          finishFailed(activity, result.error.message ?: "Checkout did not produce a transfer id")
          return
        }
      }
      activity.finish()
    }

    fun finishFailed(activity: Activity, message: String) {
      activity.setResult(RESULT_FAILED, Intent().putExtra(EXTRA_FAILURE_MESSAGE, message))
      activity.finish()
    }
  }
}
