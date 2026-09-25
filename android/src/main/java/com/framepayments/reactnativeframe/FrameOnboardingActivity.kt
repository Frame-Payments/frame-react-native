package com.framepayments.reactnativeframe

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.framepayments.frameonboarding.classes.Capabilities
import com.framepayments.frameonboarding.classes.OnboardingConfig
import com.framepayments.frameonboarding.classes.OnboardingOutcome
import com.framepayments.frameonboarding.classes.OnboardingResult
import com.framepayments.frameonboarding.views.OnboardingContainerView
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class FrameOnboardingActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val accountId = intent.getStringExtra(EXTRA_ACCOUNT_ID)
    val capabilitiesJson = intent.getStringExtra(EXTRA_CAPABILITIES_JSON) ?: "[]"
    val capabilities = parseCapabilities(capabilitiesJson)
    val showIntroScreen = intent.getBooleanExtra(EXTRA_SHOW_INTRO_SCREEN, true)
    val showCompletionScreen = intent.getBooleanExtra(EXTRA_SHOW_COMPLETION_SCREEN, true)
    val clientSecret = intent.getStringExtra(EXTRA_CLIENT_SECRET)

    // OnboardingContainerView begins/ends the onboarding session itself from
    // config.clientSecret, so passing it through here is all that's required.
    // Theme goes through config: OnboardingContainerView applies config.theme itself and would
    // override any FrameTheme wrapped around it.
    val config = OnboardingConfig(
      accountId = accountId,
      clientSecret = clientSecret,
      requiredCapabilities = capabilities,
      theme = FrameRNTheme.current,
      showIntroScreen = showIntroScreen,
      showCompletionScreen = showCompletionScreen
    )

    setContent {
      OnboardingContainerView(config = config) { result ->
        when (result) {
          is OnboardingResult.Completed -> {
            val data = Intent().apply {
              putExtra(EXTRA_PAYMENT_METHOD_ID, result.paymentMethodId)
              putExtra(EXTRA_ACCOUNT_ID, result.accountId)
            }
            setResult(RESULT_OK, data)
          }
          is OnboardingResult.FinishedUnverified -> {
            val outcome = result.outcome
            val data = Intent().apply {
              putExtra(EXTRA_PAYMENT_METHOD_ID, result.paymentMethodId)
              putExtra(EXTRA_ACCOUNT_ID, result.accountId)
              putExtra(EXTRA_OUTCOME, outcomeName(outcome))
              putExtra(EXTRA_MESSAGE, outcomeMessage(outcome))
            }
            setResult(RESULT_UNVERIFIED, data)
          }
          // Failed is reported as cancelled, matching iOS.
          is OnboardingResult.Cancelled, is OnboardingResult.Failed -> setResult(RESULT_CANCELED)
        }
        finish()
      }
    }
  }

  private fun outcomeName(outcome: OnboardingOutcome): String = when (outcome) {
    OnboardingOutcome.Approved -> "approved"
    OnboardingOutcome.PendingReview -> "pendingReview"
    is OnboardingOutcome.Declined -> "declined"
    is OnboardingOutcome.ActionRequired -> "actionRequired"
  }

  private fun outcomeMessage(outcome: OnboardingOutcome): String? = when (outcome) {
    is OnboardingOutcome.Declined -> outcome.message
    is OnboardingOutcome.ActionRequired -> outcome.message
    else -> null
  }

  private fun parseCapabilities(json: String): List<Capabilities> {
    return try {
      val type = object : TypeToken<List<String>>() {}.type
      val rawList: List<String> = Gson().fromJson(json, type)
      rawList.mapNotNull { raw ->
        Capabilities.entries.find { it.apiValue == raw }
      }
    } catch (e: Exception) {
      emptyList()
    }
  }

  companion object {
    const val EXTRA_ACCOUNT_ID = "account_id"
    const val EXTRA_CAPABILITIES_JSON = "capabilities_json"
    const val EXTRA_SHOW_INTRO_SCREEN = "show_intro_screen"
    const val EXTRA_SHOW_COMPLETION_SCREEN = "show_completion_screen"
    const val EXTRA_CLIENT_SECRET = "client_secret"
    const val EXTRA_PAYMENT_METHOD_ID = "payment_method_id"
    const val EXTRA_OUTCOME = "outcome"
    const val EXTRA_MESSAGE = "message"
    const val REQUEST_CODE = 9003
    const val RESULT_UNVERIFIED = android.app.Activity.RESULT_FIRST_USER
  }
}
