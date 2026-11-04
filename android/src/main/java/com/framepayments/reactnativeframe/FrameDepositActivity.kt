package com.framepayments.reactnativeframe

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.framepayments.framesdk_ui.FrameDepositView
import kotlinx.coroutines.launch

/**
 * Hosts frame-android's FrameDepositView. On Continue, asks JS to mint a chk_sess_
 * via FrameSDKModule, then launches [FrameCheckoutActivity] and forwards its result.
 */
class FrameDepositActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val accountId = intent.getStringExtra(EXTRA_ACCOUNT_ID)
    if (accountId.isNullOrEmpty()) {
      setResult(RESULT_CANCELED)
      finish()
      return
    }
    val minAmount =
      if (intent.hasExtra(EXTRA_MIN_AMOUNT)) intent.getIntExtra(EXTRA_MIN_AMOUNT, 0) else null
    val maxAmount =
      if (intent.hasExtra(EXTRA_MAX_AMOUNT)) intent.getIntExtra(EXTRA_MAX_AMOUNT, 0) else null

    setContent {
      val scope = rememberCoroutineScope()
      var isContinuing by remember { mutableStateOf(false) }
      var attempt by remember { mutableIntStateOf(0) }

      val checkoutLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
      ) { result ->
        isContinuing = false
        setResult(result.resultCode, result.data)
        finish()
      }

      FrameDepositView(
        accountId = accountId,
        minAmount = minAmount,
        maxAmount = maxAmount,
        isContinuing = isContinuing,
        onContinue = { cents ->
          if (isContinuing) return@FrameDepositView
          isContinuing = true
          val thisAttempt = attempt
          scope.launch {
            var launched = false
            try {
              val secret = FrameSDKModule.requestDepositMint(cents)
              if (thisAttempt != attempt || secret == null) return@launch
              if (secret.amountCents != null && secret.amountCents != cents) return@launch
              val intent = Intent(this@FrameDepositActivity, FrameCheckoutActivity::class.java).apply {
                putExtra(FrameCheckoutActivity.EXTRA_ACCOUNT_ID, accountId)
                putExtra(FrameCheckoutActivity.EXTRA_AMOUNT, cents)
                putExtra(FrameCheckoutActivity.EXTRA_CHECKOUT_CLIENT_SECRET, secret.clientSecret)
                putExtra(FrameCheckoutActivity.EXTRA_CHECKOUT_EXPIRES_AT, secret.expiresAt)
                putExtra(FrameCheckoutActivity.EXTRA_CHECKOUT_AMOUNT_CENTS, secret.amountCents ?: cents)
                secret.amountCurrency?.let {
                  putExtra(FrameCheckoutActivity.EXTRA_CHECKOUT_AMOUNT_CURRENCY, it)
                }
              }
              launched = true
              checkoutLauncher.launch(intent)
            } finally {
              if (!launched && thisAttempt == attempt) isContinuing = false
            }
          }
        },
        onCancel = {
          attempt += 1
          setResult(Activity.RESULT_CANCELED)
          finish()
        },
      )
    }
  }

  companion object {
    const val EXTRA_ACCOUNT_ID = "account_id"
    const val EXTRA_MIN_AMOUNT = "min_amount"
    const val EXTRA_MAX_AMOUNT = "max_amount"
    const val REQUEST_CODE = 9007
  }
}
