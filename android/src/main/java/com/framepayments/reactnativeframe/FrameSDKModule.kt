package com.framepayments.reactnativeframe

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap
import com.framepayments.framesdk.FrameNetworking

class FrameSDKModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  init {
    reactContext.addActivityEventListener(this)
  }

  private var checkoutPromise: Promise? = null
  private var cartPromise: Promise? = null
  private var onboardingPromise: Promise? = null
  private var googlePayPromise: Promise? = null

  override fun getName(): String = "FrameSDK"

  companion object {
    @JvmStatic
    var pendingGooglePayCallback: ((Int, Intent?) -> Unit)? = null
  }

  @ReactMethod
  fun initialize(
    secretKey: String,
    publishableKey: String,
    debugMode: Boolean,
    theme: ReadableMap?,
    promise: Promise
  ) {
    try {
      val ctx = reactApplicationContext.applicationContext
      FrameNetworking.initializeWithAPIKey(ctx, secretKey, publishableKey, debugMode)
      FrameRNTheme.current = theme?.takeIf { it.keySetIterator().hasNextKey() }?.let {
        FrameRNTheme.parse(ctx, it)
      }
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("INIT_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun presentCheckout(accountId: String?, amount: Double, promise: Promise) {
    val activity = reactApplicationContext.currentActivity ?: run {
      promise.reject("NO_ACTIVITY", "No current activity", null)
      return
    }
    checkoutPromise = promise
    activity.runOnUiThread {
      val intent = Intent(activity, FrameCheckoutActivity::class.java).apply {
        putExtra(FrameCheckoutActivity.EXTRA_ACCOUNT_ID, accountId)
        putExtra(FrameCheckoutActivity.EXTRA_AMOUNT, amount.toInt())
      }
      activity.startActivityForResult(intent, FrameCheckoutActivity.REQUEST_CODE)
    }
  }

  @ReactMethod
  fun presentCart(
    accountId: String?,
    items: ReadableArray,
    shippingAmountInCents: Double,
    promise: Promise
  ) {
    val activity = reactApplicationContext.currentActivity ?: run {
      promise.reject("NO_ACTIVITY", "No current activity", null)
      return
    }
    val itemsJson = readableArrayToJson(items) ?: run {
      promise.reject("INVALID_ITEMS", "Invalid cart items", null)
      return
    }
    cartPromise = promise
    activity.runOnUiThread {
      val intent = Intent(activity, FrameFlowActivity::class.java).apply {
        putExtra(FrameFlowActivity.EXTRA_ACCOUNT_ID, accountId)
        putExtra(FrameFlowActivity.EXTRA_ITEMS_JSON, itemsJson)
        putExtra(FrameFlowActivity.EXTRA_SHIPPING_CENTS, shippingAmountInCents.toInt())
      }
      activity.startActivityForResult(intent, FrameFlowActivity.REQUEST_CODE)
    }
  }

  @ReactMethod
  fun presentGooglePay(
    amountCents: Double,
    ownerType: String?,
    ownerId: String?,
    currencyCode: String?,
    googlePayMerchantId: String?,
    promise: Promise
  ) {
    val activity = reactApplicationContext.currentActivity ?: run {
      promise.reject("NO_ACTIVITY", "No current activity", null)
      return
    }
    val amountInt = amountCents.toInt()
    if (amountInt <= 0) {
      promise.reject("INVALID_AMOUNT", "amountCents must be positive", null)
      return
    }
    if (ownerType != "customer" && ownerType != "account") {
      promise.reject("INVALID_OWNER", "owner.type must be 'customer' or 'account'", null)
      return
    }
    if (ownerId.isNullOrEmpty()) {
      promise.reject("INVALID_OWNER", "owner.id is required", null)
      return
    }
    googlePayPromise = promise
    pendingGooglePayCallback = { resultCode, data ->
      handleGooglePayResult(resultCode, data)
    }
    activity.runOnUiThread {
      val intent = Intent(activity, FrameGooglePayActivity::class.java).apply {
        putExtra(FrameGooglePayActivity.EXTRA_AMOUNT_CENTS, amountInt)
        putExtra(FrameGooglePayActivity.EXTRA_OWNER_TYPE, ownerType)
        putExtra(FrameGooglePayActivity.EXTRA_OWNER_ID, ownerId)
        putExtra(FrameGooglePayActivity.EXTRA_CURRENCY, currencyCode ?: "USD")
        putExtra(FrameGooglePayActivity.EXTRA_MERCHANT_ID, googlePayMerchantId)
      }
      activity.startActivity(intent)
    }
  }

  @ReactMethod
  fun presentOnboarding(
    accountId: String?,
    capabilities: ReadableArray,
    googlePayMerchantId: String?,
    promise: Promise
  ) {
    val activity = reactApplicationContext.currentActivity ?: run {
      promise.reject("NO_ACTIVITY", "No current activity", null)
      return
    }
    val capabilitiesJson = readableArrayToJsonArray(capabilities)
    onboardingPromise = promise
    activity.runOnUiThread {
      val intent = Intent(activity, FrameOnboardingActivity::class.java).apply {
        putExtra(FrameOnboardingActivity.EXTRA_ACCOUNT_ID, accountId)
        putExtra(FrameOnboardingActivity.EXTRA_CAPABILITIES_JSON, capabilitiesJson)
        putExtra(FrameOnboardingActivity.EXTRA_GOOGLE_PAY_MERCHANT_ID, googlePayMerchantId)
      }
      activity.startActivityForResult(intent, FrameOnboardingActivity.REQUEST_CODE)
    }
  }

  private fun readableArrayToJson(items: ReadableArray): String? {
    val arr = org.json.JSONArray()
    for (i in 0 until items.size()) {
      val item = items.getMap(i) ?: return null
      val obj = org.json.JSONObject()
      obj.put("id", item.getString("id"))
      obj.put("title", item.getString("title"))
      obj.put("amountInCents", item.getDouble("amountInCents").toInt())
      obj.put("imageUrl", item.getString("imageUrl") ?: "")
      arr.put(obj)
    }
    return arr.toString()
  }

  private fun readableArrayToJsonArray(arr: ReadableArray): String {
    val jsonArr = org.json.JSONArray()
    for (i in 0 until arr.size()) {
      arr.getString(i)?.let { jsonArr.put(it) }
    }
    return jsonArr.toString()
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    when (requestCode) {
      FrameCheckoutActivity.REQUEST_CODE -> handleCheckoutResult(resultCode, data)
      FrameFlowActivity.REQUEST_CODE -> handleCartResult(resultCode, data)
      FrameOnboardingActivity.REQUEST_CODE -> handleOnboardingResult(resultCode, data)
      FrameGooglePayActivity.REQUEST_CODE -> handleGooglePayResult(resultCode, data)
      else -> return
    }
  }

  private fun handleCheckoutResult(resultCode: Int, data: Intent?) {
    val promise = checkoutPromise ?: return
    checkoutPromise = null
    if (resultCode == Activity.RESULT_OK && data != null) {
      val transferId = data.getStringExtra(FrameCheckoutActivity.EXTRA_TRANSFER_ID)
      if (!transferId.isNullOrEmpty()) {
        promise.resolve(transferId)
      } else {
        promise.reject("NO_RESULT", "No transfer id in result", null)
      }
    } else {
      promise.reject("USER_CANCELED", "User cancelled checkout", null)
    }
  }

  private fun handleCartResult(resultCode: Int, data: Intent?) {
    val promise = cartPromise ?: return
    cartPromise = null
    if (resultCode == Activity.RESULT_OK && data != null) {
      val transferId = data.getStringExtra(FrameFlowActivity.EXTRA_TRANSFER_ID)
      if (!transferId.isNullOrEmpty()) {
        promise.resolve(transferId)
      } else {
        promise.reject("NO_RESULT", "No transfer id in result", null)
      }
    } else {
      promise.reject("USER_CANCELED", "User cancelled", null)
    }
  }

  private fun handleGooglePayResult(resultCode: Int, data: Intent?) {
    val promise = googlePayPromise ?: return
    googlePayPromise = null
    when (resultCode) {
      Activity.RESULT_OK -> {
        val id = data?.getStringExtra(FrameGooglePayActivity.EXTRA_CHARGE_ID)
        if (id.isNullOrEmpty()) {
          promise.reject("NO_RESULT", "Google Pay returned no charge id", null)
        } else {
          promise.resolve(id)
        }
      }
      FrameGooglePayActivity.RESULT_FAILURE -> {
        val message = data?.getStringExtra(FrameGooglePayActivity.EXTRA_FAILURE_MESSAGE) ?: "Google Pay failed"
        promise.reject("PAYMENT_FAILED", message, null)
      }
      FrameGooglePayActivity.RESULT_UNAVAILABLE -> {
        promise.reject("GOOGLE_PAY_UNAVAILABLE", "Google Pay is not available on this device", null)
      }
      else -> {
        promise.reject("USER_CANCELED", "User cancelled Google Pay", null)
      }
    }
  }

  private fun handleOnboardingResult(resultCode: Int, data: Intent?) {
    val promise = onboardingPromise ?: return
    onboardingPromise = null
    val map = WritableNativeMap()
    if (resultCode == Activity.RESULT_OK) {
      map.putString("status", "completed")
      val paymentMethodId = data?.getStringExtra(FrameOnboardingActivity.EXTRA_PAYMENT_METHOD_ID)
      if (paymentMethodId != null) {
        map.putString("paymentMethodId", paymentMethodId)
      }
      promise.resolve(map)
    } else {
      map.putString("status", "cancelled")
      promise.resolve(map)
    }
  }

  override fun onNewIntent(intent: Intent) {}
}
