package com.framepayments.reactnativeframe

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import com.framepayments.framesdk_ui.buttons.FrameGooglePayButton

/**
 * Hidden host activity for Frame.presentGooglePay(). The Frame Android SDK only
 * exposes Google Pay through FrameGooglePayButton (a View). This activity
 * instantiates that View off-screen, waits for readiness, then programmatically
 * clicks the inner Google Pay button so the wallet sheet appears. The result
 * is forwarded back via setResult / FrameSDKModule.onActivityResult.
 *
 * The Activity finishes after the result arrives or after a 5s readiness timeout.
 */
class FrameGooglePayActivity : AppCompatActivity() {

  private val handler = Handler(Looper.getMainLooper())
  private var googlePayButton: FrameGooglePayButton? = null
  private var didTriggerClick = false
  private var didDeliverResult = false
  private var readinessTimeout: Runnable? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val container = FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    }
    setContentView(container)

    val amountCents = intent.getIntExtra(EXTRA_AMOUNT_CENTS, 0)
    val ownerType = intent.getStringExtra(EXTRA_OWNER_TYPE)
    val ownerId = intent.getStringExtra(EXTRA_OWNER_ID)
    val currencyCode = intent.getStringExtra(EXTRA_CURRENCY) ?: "USD"

    if (amountCents <= 0) {
      deliverFailure("Invalid amountCents")
      return
    }
    if (ownerId.isNullOrEmpty()) {
      deliverFailure("owner.id is required")
      return
    }
    val owner: FrameGooglePayButton.Owner = when (ownerType) {
      "customer" -> FrameGooglePayButton.Owner.Customer(ownerId)
      "account"  -> FrameGooglePayButton.Owner.Account(ownerId)
      else -> {
        deliverFailure("owner.type must be 'customer' or 'account'")
        return
      }
    }

    val button = FrameGooglePayButton(this)
    button.layoutParams = FrameLayout.LayoutParams(1, 1) // tiny but measurable so click can fire
    container.addView(button)
    googlePayButton = button

    button.configure(
      amountCents = amountCents,
      owner = owner,
      currencyCode = currencyCode,
      onResult = { result -> handleResult(result) },
      onReadinessChanged = { isReady -> handleReadiness(isReady) }
    )

    // Bail out if Google Pay isn't ready within 5s.
    readinessTimeout = Runnable {
      if (!didTriggerClick && !didDeliverResult) {
        deliverUnavailable()
      }
    }
    handler.postDelayed(readinessTimeout!!, 5000)
  }

  private fun handleReadiness(isReady: Boolean) {
    if (didTriggerClick || didDeliverResult) return
    if (!isReady) return
    didTriggerClick = true
    val button = googlePayButton ?: return
    // The inner Google Pay button (child 0 of FrameGooglePayButton) carries the
    // OnClickListener that calls requestGooglePay(). Click on the outer
    // FrameLayout does not propagate.
    val inner = if (button.childCount > 0) button.getChildAt(0) else null
    handler.post {
      if (inner != null) {
        inner.performClick()
      } else {
        deliverFailure("Could not find inner Google Pay button")
      }
    }
  }

  private fun handleResult(result: FrameGooglePayButton.Result) {
    if (didDeliverResult) return
    didDeliverResult = true
    when (result) {
      is FrameGooglePayButton.Result.Success -> {
        // `result.id` is a Transfer id (for Owner.Account) or a ChargeIntent id
        // (for Owner.Customer). JS knows which it is because it passed the owner.
        deliverViaCallback(android.app.Activity.RESULT_OK, Intent().putExtra(EXTRA_CHARGE_ID, result.id))
      }
      is FrameGooglePayButton.Result.PaymentMethodCreated -> {
        // RN bridge does not currently expose AddToOwner mode, so this branch
        // shouldn't fire in practice. Surface it as failure instead of silently dropping.
        deliverViaCallback(RESULT_FAILURE, Intent().putExtra(EXTRA_FAILURE_MESSAGE, "Unsupported Google Pay result"))
      }
      is FrameGooglePayButton.Result.Failure -> {
        deliverViaCallback(RESULT_FAILURE, Intent().putExtra(EXTRA_FAILURE_MESSAGE, result.message))
      }
      is FrameGooglePayButton.Result.Cancelled -> {
        deliverViaCallback(android.app.Activity.RESULT_CANCELED, null)
      }
    }
  }

  private fun deliverUnavailable() {
    if (didDeliverResult) return
    didDeliverResult = true
    deliverViaCallback(RESULT_UNAVAILABLE, null)
  }

  private fun deliverFailure(message: String) {
    if (didDeliverResult) return
    didDeliverResult = true
    deliverViaCallback(RESULT_FAILURE, Intent().putExtra(EXTRA_FAILURE_MESSAGE, message))
  }

  private fun deliverViaCallback(resultCode: Int, data: Intent?) {
    val callback = FrameSDKModule.pendingGooglePayCallback
    FrameSDKModule.pendingGooglePayCallback = null
    callback?.invoke(resultCode, data)
    finish()
  }

  override fun onDestroy() {
    readinessTimeout?.let { handler.removeCallbacks(it) }
    readinessTimeout = null
    super.onDestroy()
  }

  companion object {
    const val EXTRA_AMOUNT_CENTS = "amount_cents"
    const val EXTRA_OWNER_TYPE = "owner_type"
    const val EXTRA_OWNER_ID = "owner_id"
    const val EXTRA_CURRENCY = "currency"
    /**
     * The id of the resource created by the wallet flow. Holds a Transfer id when
     * the owner was an account, or a ChargeIntent id when the owner was a customer.
     * JS knows which by inspecting the owner it passed in.
     */
    const val EXTRA_CHARGE_ID = "charge_id"
    const val EXTRA_FAILURE_MESSAGE = "failure_message"

    const val REQUEST_CODE = 9003

    // RESULT_FIRST_USER == 1; we use that to distinguish payment failure from cancel.
    const val RESULT_FAILURE = android.app.Activity.RESULT_FIRST_USER
    const val RESULT_UNAVAILABLE = android.app.Activity.RESULT_FIRST_USER + 1
  }
}
