package com.framepayments.reactnativeframe

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.framepayments.frameonboarding.classes.Capabilities
import com.framepayments.frameonboarding.classes.OnboardingConfig
import com.framepayments.frameonboarding.classes.OnboardingResult
import com.framepayments.frameonboarding.views.OnboardingContainerView
import com.framepayments.framesdk_ui.theme.FrameTheme
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

    val config = OnboardingConfig(
      accountId = accountId,
      requiredCapabilities = capabilities,
      showIntroScreen = showIntroScreen,
      showCompletionScreen = showCompletionScreen
    )

    val themeOverride = FrameRNTheme.current
    setContent {
      val theme = themeOverride ?: FrameTheme.default(this)
      FrameTheme(theme = theme) {
        OnboardingContainerView(config = config) { result ->
          when (result) {
            is OnboardingResult.Completed -> {
              val data = Intent().apply {
                putExtra(EXTRA_PAYMENT_METHOD_ID, result.paymentMethodId)
              }
              setResult(RESULT_OK, data)
              finish()
            }
            is OnboardingResult.Cancelled -> {
              setResult(RESULT_CANCELED)
              finish()
            }
            is OnboardingResult.Failed -> {
              setResult(RESULT_CANCELED)
              finish()
            }
          }
        }
      }
    }
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
    const val EXTRA_PAYMENT_METHOD_ID = "payment_method_id"
    const val REQUEST_CODE = 9003
  }
}
