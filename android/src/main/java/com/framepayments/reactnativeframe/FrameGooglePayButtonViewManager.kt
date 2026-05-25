package com.framepayments.reactnativeframe

import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class FrameGooglePayButtonViewManager : SimpleViewManager<FrameGooglePayButtonView>() {

  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(reactContext: ThemedReactContext): FrameGooglePayButtonView {
    return FrameGooglePayButtonView(reactContext)
  }

  @ReactProp(name = "buttonTheme")
  fun setButtonTheme(view: FrameGooglePayButtonView, value: String?) {
    view.setButtonTheme(value ?: "dark")
  }

  @ReactProp(name = "buttonType")
  fun setButtonType(view: FrameGooglePayButtonView, value: String?) {
    view.setButtonType(value ?: "pay")
  }

  @ReactProp(name = "cornerRadiusDp", defaultInt = 8)
  fun setCornerRadiusDp(view: FrameGooglePayButtonView, value: Int) {
    view.setCornerRadiusDp(value)
  }

  override fun getExportedCustomBubblingEventTypeConstants(): MutableMap<String, Any> {
    return MapBuilder.of(
      "topPress",
      MapBuilder.of(
        "phasedRegistrationNames",
        MapBuilder.of("bubbled", "onPress"),
      ),
    )
  }

  companion object {
    const val REACT_CLASS = "FrameGooglePayButton"
  }
}
