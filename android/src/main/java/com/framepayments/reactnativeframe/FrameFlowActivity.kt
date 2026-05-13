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
    val accountId = intent.getStringExtra(EXTRA_ACCOUNT_ID)
    val itemsJson = intent.getStringExtra(EXTRA_ITEMS_JSON)
    val shippingCents = intent.getIntExtra(EXTRA_SHIPPING_CENTS, 0)
    val items: List<FrameCartItem> = parseCartItems(itemsJson) ?: emptyList()

    // Bundled cart → checkout always creates a Transfer, which requires an account.
    if (accountId.isNullOrEmpty()) {
      setResult(RESULT_CANCELED)
      finish()
      return
    }

    showCart(accountId, items, shippingCents)
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

  private fun showCart(accountId: String, items: List<FrameCartItem>, shippingCents: Int) {
    container.removeAllViews()
    cartView = FrameCartView(this).apply {
      FrameRNTheme.current?.let { setTheme(it) }
      configure(accountId, items, shippingCents, { totalCents ->
        showCheckout(accountId, totalCents)
      }, null)
    }
    container.addView(cartView)
  }

  private fun showCheckout(accountId: String, amount: Int) {
    container.removeAllViews()
    checkoutView = FrameCheckoutView(this).apply {
      FrameRNTheme.current?.let { setTheme(it) }
      configure(accountId, amount) { transferId ->
        setResult(RESULT_OK, Intent().putExtra(EXTRA_TRANSFER_ID, transferId))
        finish()
      }
    }
    container.addView(checkoutView)
  }

  companion object {
    const val EXTRA_ACCOUNT_ID = "account_id"
    const val EXTRA_ITEMS_JSON = "items_json"
    const val EXTRA_SHIPPING_CENTS = "shipping_cents"
    const val EXTRA_TRANSFER_ID = "transfer_id"
    const val REQUEST_CODE = 9002
  }
}
