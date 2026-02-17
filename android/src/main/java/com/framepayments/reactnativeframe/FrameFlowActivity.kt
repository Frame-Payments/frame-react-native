package com.framepayments.reactnativeframe

import android.content.Intent
import android.os.Bundle
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import com.framepayments.framesdk_ui.FrameCartItem
import com.framepayments.framesdk_ui.FrameCartView
import com.framepayments.framesdk_ui.FrameCheckoutView
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class FrameFlowActivity : AppCompatActivity() {

  private var cartView: FrameCartView? = null
  private var checkoutView: FrameCheckoutView? = null
  private val container by lazy {
    FrameLayout(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
      id = android.R.id.content
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(container)
    val customerId = intent.getStringExtra(EXTRA_CUSTOMER_ID)
    val itemsJson = intent.getStringExtra(EXTRA_ITEMS_JSON)
    val shippingCents = intent.getIntExtra(EXTRA_SHIPPING_CENTS, 0)
    val items: List<FrameCartItem> = parseCartItems(itemsJson) ?: emptyList()
    showCart(customerId, items, shippingCents)
  }

  private fun parseCartItems(json: String?): List<FrameCartItem>? {
    if (json.isNullOrBlank()) return emptyList()
    return try {
      val type = object : TypeToken<List<CartItemDto>>() {}.type
      val list: List<CartItemDto> = Gson().fromJson(json, type)
      list.map { FrameCartItem(it.id, it.title, it.amountInCents, it.imageUrl) }
    } catch (e: Exception) {
      null
    }
  }

  private data class CartItemDto(
    val id: String,
    val title: String,
    val amountInCents: Int,
    val imageUrl: String
  )

  private fun showCart(customerId: String?, items: List<FrameCartItem>, shippingCents: Int) {
    container.removeAllViews()
    cartView = FrameCartView(this).apply {
      configure(customerId, items, shippingCents) { totalCents ->
        showCheckout(customerId, totalCents)
      }
    }
    container.addView(cartView)
  }

  private fun showCheckout(customerId: String?, amount: Int) {
    container.removeAllViews()
    checkoutView = FrameCheckoutView(this).apply {
      configure(customerId, amount) { chargeIntent ->
        val json = Gson().toJson(chargeIntent)
        setResult(RESULT_OK, Intent().putExtra(EXTRA_CHARGE_INTENT_JSON, json))
        finish()
      }
    }
    container.addView(checkoutView)
  }

  companion object {
    const val EXTRA_CUSTOMER_ID = "customer_id"
    const val EXTRA_ITEMS_JSON = "items_json"
    const val EXTRA_SHIPPING_CENTS = "shipping_cents"
    const val EXTRA_CHARGE_INTENT_JSON = "charge_intent_json"
    const val REQUEST_CODE = 9002
  }
}
