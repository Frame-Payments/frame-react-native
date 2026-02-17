package com.framepayments.reactnativeframe

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import org.json.JSONArray
import com.framepayments.framesdk.FrameNetworking
import org.json.JSONObject

class FrameSDKModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  init {
    reactContext.addActivityEventListener(this)
  }

  private var checkoutPromise: Promise? = null
  private var cartPromise: Promise? = null

  override fun getName(): String = "FrameSDK"

  @ReactMethod
  fun initialize(apiKey: String, debugMode: Boolean, promise: Promise) {
    try {
      val ctx = reactApplicationContext.applicationContext
      FrameNetworking.initializeWithAPIKey(ctx, apiKey, debugMode)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("INIT_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun presentCheckout(customerId: String?, amount: Double, promise: Promise) {
    val activity = currentActivity ?: run {
      promise.reject("NO_ACTIVITY", "No current activity", null)
      return
    }
    checkoutPromise = promise
    val intent = Intent(activity, FrameCheckoutActivity::class.java).apply {
      putExtra(FrameCheckoutActivity.EXTRA_CUSTOMER_ID, customerId)
      putExtra(FrameCheckoutActivity.EXTRA_AMOUNT, amount.toInt())
    }
    activity.startActivityForResult(intent, FrameCheckoutActivity.REQUEST_CODE)
  }

  @ReactMethod
  fun presentCart(
    customerId: String?,
    items: com.facebook.react.bridge.ReadableArray,
    shippingAmountInCents: Double,
    promise: Promise
  ) {
    val activity = currentActivity ?: run {
      promise.reject("NO_ACTIVITY", "No current activity", null)
      return
    }
    val itemsJson = readableArrayToJson(items) ?: run {
      promise.reject("INVALID_ITEMS", "Invalid cart items", null)
      return
    }
    cartPromise = promise
    val intent = Intent(activity, FrameFlowActivity::class.java).apply {
      putExtra(FrameFlowActivity.EXTRA_CUSTOMER_ID, customerId)
      putExtra(FrameFlowActivity.EXTRA_ITEMS_JSON, itemsJson)
      putExtra(FrameFlowActivity.EXTRA_SHIPPING_CENTS, shippingAmountInCents.toInt())
    }
    activity.startActivityForResult(intent, FrameFlowActivity.REQUEST_CODE)
  }

  private fun readableArrayToJson(items: com.facebook.react.bridge.ReadableArray): String? {
    val arr = org.json.JSONArray()
    for (i in 0 until items.size()) {
      val item = items.getMap(i) ?: return null
      val obj = org.json.JSONObject()
      obj.put("id", item.getString("id"))
      obj.put("title", item.getString("title"))
      obj.put("amountInCents", item.getDouble("amountInCents").toInt())
      obj.put("imageUrl", item.getString("imageUrl"))
      arr.put(obj)
    }
    return arr.toString()
  }

  override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
    when (requestCode) {
      FrameCheckoutActivity.REQUEST_CODE -> handleCheckoutResult(resultCode, data)
      FrameFlowActivity.REQUEST_CODE -> handleCartResult(resultCode, data)
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

  private fun jsonObjectToWritableMap(obj: JSONObject): WritableNativeMap {
    val map = WritableNativeMap()
    for (key in obj.keys()) {
      if (obj.isNull(key)) continue
      when (val v = obj.get(key)) {
        is String -> map.putString(key, v)
        is Int -> map.putInt(key, v)
        is Long -> map.putDouble(key, v.toDouble())
        is Double -> map.putDouble(key, v)
        is Boolean -> map.putBoolean(key, v)
        is JSONObject -> map.putMap(key, jsonObjectToWritableMap(v))
        is JSONArray -> map.putArray(key, jsonArrayToWritableArray(v))
      }
    }
    return map
  }

  private fun jsonArrayToWritableArray(arr: JSONArray): WritableNativeArray {
    val list = WritableNativeArray()
    for (i in 0 until arr.length()) {
      when (val v = arr.get(i)) {
        is String -> list.pushString(v)
        is Int -> list.pushInt(v)
        is Long -> list.pushDouble(v.toDouble())
        is Double -> list.pushDouble(v)
        is Boolean -> list.pushBoolean(v)
        is JSONObject -> list.pushMap(jsonObjectToWritableMap(v))
        is JSONArray -> list.pushArray(jsonArrayToWritableArray(v))
      }
    }
    return list
  }

  override fun onNewIntent(intent: Intent?) {}
}
