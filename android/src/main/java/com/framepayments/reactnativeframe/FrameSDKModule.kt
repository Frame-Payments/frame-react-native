package com.framepayments.reactnativeframe

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.framepayments.framesdk.FrameNetworking
import org.json.JSONObject

class FrameSDKModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  init {
    reactContext.addActivityEventListener(this)
  }

  private var checkoutPromise: Promise? = null
  private var cartPromise: Promise? = null
  private var onboardingPromise: Promise? = null

  override fun getName(): String = "FrameSDK"

  @ReactMethod
  fun initialize(secretKey: String, publishableKey: String, debugMode: Boolean, promise: Promise) {
    try {
      val ctx = reactApplicationContext.applicationContext
      FrameNetworking.initializeWithAPIKey(ctx, secretKey, publishableKey, debugMode)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("INIT_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun presentCheckout(customerId: String?, amount: Double, promise: Promise) {
    val activity = reactApplicationContext.currentActivity ?: run {
      promise.reject("NO_ACTIVITY", "No current activity", null)
      return
    }
    checkoutPromise = promise
    activity.runOnUiThread {
      val intent = Intent(activity, FrameCheckoutActivity::class.java).apply {
        putExtra(FrameCheckoutActivity.EXTRA_CUSTOMER_ID, customerId)
        putExtra(FrameCheckoutActivity.EXTRA_AMOUNT, amount.toInt())
      }
      activity.startActivityForResult(intent, FrameCheckoutActivity.REQUEST_CODE)
    }
  }

  @ReactMethod
  fun presentCart(
    customerId: String?,
    items: com.facebook.react.bridge.ReadableArray,
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
        putExtra(FrameFlowActivity.EXTRA_CUSTOMER_ID, customerId)
        putExtra(FrameFlowActivity.EXTRA_ITEMS_JSON, itemsJson)
        putExtra(FrameFlowActivity.EXTRA_SHIPPING_CENTS, shippingAmountInCents.toInt())
      }
      activity.startActivityForResult(intent, FrameFlowActivity.REQUEST_CODE)
    }
  }

  @ReactMethod
  fun presentOnboarding(
    accountId: String?,
    capabilities: com.facebook.react.bridge.ReadableArray,
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
      }
      activity.startActivityForResult(intent, FrameOnboardingActivity.REQUEST_CODE)
    }
  }

  private fun readableArrayToJson(items: com.facebook.react.bridge.ReadableArray): String? {
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

  private fun readableArrayToJsonArray(arr: com.facebook.react.bridge.ReadableArray): String {
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
      else -> return
    }
  }

  private fun handleCheckoutResult(resultCode: Int, data: Intent?) {
    val promise = checkoutPromise ?: return
    checkoutPromise = null
    if (resultCode == Activity.RESULT_OK && data != null) {
      val json = data.getStringExtra(FrameCheckoutActivity.EXTRA_CHARGE_INTENT_JSON)
      if (json != null) {
        try {
          val obj = JSONObject(json)
          val map = jsonObjectToWritableMap(obj)
          promise.resolve(map)
        } catch (e: Exception) {
          promise.reject("PARSE_ERROR", e.message, e)
        }
      } else {
        promise.reject("NO_RESULT", "No charge intent in result", null)
      }
    } else {
      promise.reject("USER_CANCELED", "User cancelled checkout", null)
    }
  }

  private fun handleCartResult(resultCode: Int, data: Intent?) {
    val promise = cartPromise ?: return
    cartPromise = null
    if (resultCode == Activity.RESULT_OK && data != null) {
      val json = data.getStringExtra(FrameFlowActivity.EXTRA_CHARGE_INTENT_JSON)
      if (json != null) {
        try {
          val obj = JSONObject(json)
          val map = jsonObjectToWritableMap(obj)
          promise.resolve(map)
        } catch (e: Exception) {
          promise.reject("PARSE_ERROR", e.message, e)
        }
      } else {
        promise.reject("NO_RESULT", "No charge intent in result", null)
      }
    } else {
      promise.reject("USER_CANCELED", "User cancelled", null)
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
