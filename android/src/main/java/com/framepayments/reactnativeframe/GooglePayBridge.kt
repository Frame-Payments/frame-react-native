package com.framepayments.reactnativeframe

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap
import com.google.android.gms.tasks.Task
import com.google.android.gms.wallet.AutoResolveHelper
import com.google.android.gms.wallet.IsReadyToPayRequest
import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.PaymentDataRequest
import com.google.android.gms.wallet.PaymentsClient
import com.google.android.gms.wallet.Wallet
import com.google.android.gms.wallet.WalletConstants
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Token-out Google Pay bridge.
 *
 * `isGooglePayReady` returns whether the device has a usable Google Pay setup.
 * `presentGooglePay` builds the PaymentDataRequest, opens the wallet sheet,
 * and resolves with the raw PaymentData JSON parsed into a map. JS hands that
 * blob to frame-node, which forwards it to Frame's backend for tokenization.
 */
class GooglePayBridge(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  init {
    reactContext.addActivityEventListener(this)
  }

  private var pendingPromise: Promise? = null

  override fun getName(): String = "FrameGooglePay"

  // MARK: - isGooglePayReady

  @ReactMethod
  fun isGooglePayReady(args: ReadableMap, promise: Promise) {
    val environment = args.getString("environment") ?: "PRODUCTION"
    val client = paymentsClient(environment)
    val request = IsReadyToPayRequest.fromJson(buildIsReadyToPayRequest().toString())
    val task: Task<Boolean> = client.isReadyToPay(request)
    task.addOnCompleteListener { completed ->
      if (completed.isSuccessful) {
        promise.resolve(completed.result == true)
      } else {
        promise.resolve(false)
      }
    }
  }

  // MARK: - presentGooglePay

  @ReactMethod
  fun presentGooglePay(args: ReadableMap, promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("GOOGLE_PAY_BUSY", "A Google Pay sheet is already presenting.")
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("GOOGLE_PAY_NO_ACTIVITY", "No current Activity. Open the sheet from a foregrounded screen.")
      return
    }

    val amountCents = if (args.hasKey("amountCents")) args.getInt("amountCents") else 0
    if (amountCents <= 0) {
      promise.reject("GOOGLE_PAY_INVALID_ARGS", "amountCents must be > 0.")
      return
    }
    val currencyCode = args.getString("currencyCode") ?: "USD"
    val merchantId = args.getString("googlePayMerchantId") ?: ""
    if (merchantId.isEmpty()) {
      promise.reject("GOOGLE_PAY_INVALID_ARGS", "googlePayMerchantId is required.")
      return
    }
    val environment = args.getString("environment") ?: "PRODUCTION"
    val walletConfig = args.getMap("walletConfig")
    val gateway = walletConfig?.getString("processor") ?: ""
    val gatewayMerchantId = walletConfig?.getString("processor_key") ?: ""
    if (gateway.isEmpty() || gatewayMerchantId.isEmpty()) {
      promise.reject(
        "GOOGLE_PAY_INVALID_ARGS",
        "walletConfig.processor and walletConfig.processor_key are required.",
      )
      return
    }

    val requestJson = buildPaymentDataRequest(
      amountCents = amountCents,
      currencyCode = currencyCode,
      gateway = gateway,
      gatewayMerchantId = gatewayMerchantId,
      googlePayMerchantId = merchantId,
    )
    val request = PaymentDataRequest.fromJson(requestJson.toString())
    val client = paymentsClient(environment)

    pendingPromise = promise
    AutoResolveHelper.resolveTask(client.loadPaymentData(request), activity, REQUEST_CODE)
  }

  // MARK: - ActivityEventListener

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE) return
    val promise = pendingPromise ?: return
    pendingPromise = null

    when (resultCode) {
      Activity.RESULT_OK -> {
        val paymentData = data?.let { PaymentData.getFromIntent(it) }
        if (paymentData == null) {
          promise.reject("PAYMENT_FAILED", "Google Pay returned no PaymentData.")
          return
        }
        val json = try {
          JSONObject(paymentData.toJson())
        } catch (e: Exception) {
          promise.reject("PAYMENT_FAILED", "Could not parse Google Pay response.", e)
          return
        }
        val response = WritableNativeMap().apply {
          putInt("apiVersion", json.optInt("apiVersion", 2))
          putInt("apiVersionMinor", json.optInt("apiVersionMinor", 0))
          json.optString("email").takeIf { it.isNotEmpty() }?.let { putString("email", it) }
          val pmd = json.optJSONObject("paymentMethodData")
          if (pmd != null) {
            putMap("paymentMethodData", jsonObjectToWritableMap(pmd))
          } else {
            putMap("paymentMethodData", WritableNativeMap())
          }
        }
        promise.resolve(response)
      }
      Activity.RESULT_CANCELED -> {
        promise.reject("USER_CANCELED", "User dismissed Google Pay sheet without authorizing.")
      }
      AutoResolveHelper.RESULT_ERROR -> {
        val status = AutoResolveHelper.getStatusFromIntent(data)
        val code = status?.statusCode ?: -1
        val message = status?.statusMessage ?: "Google Pay failed."
        promise.reject("PAYMENT_FAILED", "Google Pay error ($code): $message")
      }
      else -> {
        promise.reject("PAYMENT_FAILED", "Google Pay returned unexpected result code $resultCode.")
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    // no-op: Google Pay results arrive via onActivityResult, not intents.
  }

  override fun invalidate() {
    // RN 0.70+ uses invalidate() as the module-teardown hook (replacing the
    // deprecated onCatalystInstanceDestroy). Remove the ActivityEventListener
    // so we don't leak an Activity reference across hot-reloads in dev.
    reactContext.removeActivityEventListener(this)
    super.invalidate()
  }

  // MARK: - Helpers

  private fun paymentsClient(environment: String): PaymentsClient {
    val env = if (environment == "PRODUCTION") {
      WalletConstants.ENVIRONMENT_PRODUCTION
    } else {
      WalletConstants.ENVIRONMENT_TEST
    }
    val activity = reactApplicationContext.currentActivity
    val options = Wallet.WalletOptions.Builder()
      .setEnvironment(env)
      .build()
    return if (activity != null) {
      Wallet.getPaymentsClient(activity, options)
    } else {
      Wallet.getPaymentsClient(reactContext, options)
    }
  }

  private fun buildIsReadyToPayRequest(): JSONObject {
    return JSONObject().apply {
      put("apiVersion", 2)
      put("apiVersionMinor", 0)
      put("allowedPaymentMethods", JSONArray().apply {
        put(JSONObject().apply {
          put("type", "CARD")
          put("parameters", JSONObject().apply {
            put("allowedAuthMethods", JSONArray(listOf("PAN_ONLY", "CRYPTOGRAM_3DS")))
            put("allowedCardNetworks", JSONArray(listOf("AMEX", "DISCOVER", "MASTERCARD", "VISA")))
          })
        })
      })
    }
  }

  private fun buildPaymentDataRequest(
    amountCents: Int,
    currencyCode: String,
    gateway: String,
    gatewayMerchantId: String,
    googlePayMerchantId: String,
  ): JSONObject {
    return JSONObject().apply {
      put("apiVersion", 2)
      put("apiVersionMinor", 0)
      put("allowedPaymentMethods", JSONArray().apply {
        put(JSONObject().apply {
          put("type", "CARD")
          put("parameters", JSONObject().apply {
            put("allowedAuthMethods", JSONArray(listOf("PAN_ONLY", "CRYPTOGRAM_3DS")))
            put("allowedCardNetworks", JSONArray(listOf("AMEX", "DISCOVER", "MASTERCARD", "VISA")))
            put("billingAddressRequired", true)
            put("billingAddressParameters", JSONObject().apply {
              put("format", "FULL")
            })
          })
          put("tokenizationSpecification", JSONObject().apply {
            put("type", "PAYMENT_GATEWAY")
            put("parameters", JSONObject().apply {
              put("gateway", gateway)
              put("gatewayMerchantId", gatewayMerchantId)
            })
          })
        })
      })
      put("transactionInfo", JSONObject().apply {
        put("totalPriceStatus", "FINAL")
        // Locale.US forces "12.50" (decimal point). Default locale would
        // produce "12,50" on de_DE/fr_FR/etc., which Google Pay rejects.
        put("totalPrice", String.format(Locale.US, "%.2f", amountCents / 100.0))
        put("currencyCode", currencyCode)
      })
      put("merchantInfo", JSONObject().apply {
        put("merchantId", googlePayMerchantId)
        put("merchantName", "Frame Payments")
      })
      put("emailRequired", true)
    }
  }

  companion object {
    const val REQUEST_CODE = 9100
  }
}
