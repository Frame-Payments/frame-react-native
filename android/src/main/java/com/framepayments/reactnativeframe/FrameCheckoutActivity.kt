package com.framepayments.reactnativeframe

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.framepayments.framesdk.EvervaultConfigurator
import com.framepayments.framesdk.FrameResult
import com.framepayments.framesdk.checkoutsessions.FrameCheckoutClientSecret
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
    val checkoutClientSecret = readCheckoutClientSecret(intent)

    // Bundled checkout always creates a Transfer, which requires an account.
    if (accountId.isNullOrEmpty()) {
      setResult(RESULT_CANCELED)
      finish()
      return
    }
    if (checkoutClientSecret == null) {
      finishFailed(this, "checkoutClientSecret is required")
      return
    }

    // The card input can't inflate until Evervault is configured, which may still be in flight on a cold start.
    lifecycleScope.launch {
      if (isCardEncryptionReady()) {
        addCheckoutView(container, accountId, amount, checkoutClientSecret)
      } else {
        finishFailed(this@FrameCheckoutActivity, "Card encryption is unavailable")
      }
    }
  }

  private fun addCheckoutView(
    container: FrameLayout,
    accountId: String,
    amount: Int,
    checkoutClientSecret: FrameCheckoutClientSecret?,
  ) {
    val checkoutView = FrameCheckoutView(this)
    FrameRNTheme.current?.let { checkoutView.setTheme(it) }
    checkoutView.configure(
      accountId = accountId,
      paymentAmount = amount,
      checkoutClientSecret = checkoutClientSecret,
    ) { result -> finishWithCheckoutResult(this, result) }
    container.addView(checkoutView)
  }

  companion object {
    const val EXTRA_ACCOUNT_ID = "account_id"
    const val EXTRA_AMOUNT = "amount"
    const val EXTRA_CHECKOUT_CLIENT_SECRET = "checkout_client_secret"
    const val EXTRA_CHECKOUT_EXPIRES_AT = "checkout_expires_at"
    const val EXTRA_CHECKOUT_AMOUNT_CENTS = "checkout_amount_cents"
    const val EXTRA_CHECKOUT_AMOUNT_CURRENCY = "checkout_amount_currency"
    const val EXTRA_TRANSFER_ID = "transfer_id"
    const val EXTRA_FAILURE_MESSAGE = "failure_message"
    const val REQUEST_CODE = 9001
    /** Maps to PAYMENT_FAILED in FrameSDKModule, matching iOS. */
    const val RESULT_FAILED = Activity.RESULT_FIRST_USER

    fun readCheckoutClientSecret(intent: Intent): FrameCheckoutClientSecret? {
      val clientSecret = intent.getStringExtra(EXTRA_CHECKOUT_CLIENT_SECRET) ?: return null
      if (!intent.hasExtra(EXTRA_CHECKOUT_EXPIRES_AT)) return null
      val amountCents =
        if (intent.hasExtra(EXTRA_CHECKOUT_AMOUNT_CENTS)) intent.getIntExtra(EXTRA_CHECKOUT_AMOUNT_CENTS, 0) else null
      val amountCurrency = intent.getStringExtra(EXTRA_CHECKOUT_AMOUNT_CURRENCY)
      return FrameCheckoutClientSecret(
        clientSecret,
        intent.getLongExtra(EXTRA_CHECKOUT_EXPIRES_AT, 0L),
        amountCents,
        amountCurrency,
      )
    }

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
