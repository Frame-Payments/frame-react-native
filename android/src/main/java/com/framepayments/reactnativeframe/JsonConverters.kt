package com.framepayments.reactnativeframe

import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import org.json.JSONArray
import org.json.JSONObject

internal fun jsonObjectToWritableMap(obj: JSONObject): WritableNativeMap {
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

internal fun jsonArrayToWritableArray(arr: JSONArray): WritableNativeArray {
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
