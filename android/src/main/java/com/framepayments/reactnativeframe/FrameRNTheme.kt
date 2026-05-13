package com.framepayments.reactnativeframe

import android.content.Context
import android.graphics.Typeface
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facebook.react.bridge.ReadableMap
import com.framepayments.framesdk_ui.theme.FrameTheme

object FrameRNTheme {

  @Volatile
  var current: FrameTheme? = null

  fun parse(context: Context, dict: ReadableMap): FrameTheme {
    val defaults = FrameTheme.Companion.default(context)
    val colors = parseColors(dict.getMapOrNull("colors"), defaults)
    val fonts = parseFonts(context, dict.getMapOrNull("fonts"), defaults)
    val radii = parseRadii(dict.getMapOrNull("radii"), defaults)
    return FrameTheme(colors = colors, fonts = fonts, radii = radii)
  }

  private fun parseColors(dict: ReadableMap?, defaults: FrameTheme) = defaults.colors.let { c ->
    if (dict == null) return@let c
    c.copy(
      primaryButton = dict.color("primaryButton") ?: c.primaryButton,
      primaryButtonText = dict.color("primaryButtonText") ?: c.primaryButtonText,
      secondaryButton = dict.color("secondaryButton") ?: c.secondaryButton,
      secondaryButtonText = dict.color("secondaryButtonText") ?: c.secondaryButtonText,
      disabledButton = dict.color("disabledButton") ?: c.disabledButton,
      disabledButtonStroke = dict.color("disabledButtonStroke") ?: c.disabledButtonStroke,
      disabledButtonText = dict.color("disabledButtonText") ?: c.disabledButtonText,
      surface = dict.color("surface") ?: c.surface,
      surfaceStroke = dict.color("surfaceStroke") ?: c.surfaceStroke,
      textPrimary = dict.color("textPrimary") ?: c.textPrimary,
      textSecondary = dict.color("textSecondary") ?: c.textSecondary,
      error = dict.color("error") ?: c.error,
      onboardingHeaderBackground = dict.color("onboardingHeaderBackground") ?: c.onboardingHeaderBackground,
      onboardingProgressFilledOnBrand = dict.color("onboardingProgressFilledOnBrand") ?: c.onboardingProgressFilledOnBrand,
      onboardingProgressEmptyOnBrand = dict.color("onboardingProgressEmptyOnBrand") ?: c.onboardingProgressEmptyOnBrand
    )
  }

  private fun parseFonts(context: Context, dict: ReadableMap?, defaults: FrameTheme) = defaults.fonts.let { f ->
    if (dict == null) return@let f
    f.copy(
      title = dict.textStyle(context, "title", f.title),
      heading = dict.textStyle(context, "heading", f.heading),
      headline = dict.textStyle(context, "headline", f.headline),
      body = dict.textStyle(context, "body", f.body),
      bodySmall = dict.textStyle(context, "bodySmall", f.bodySmall),
      label = dict.textStyle(context, "label", f.label),
      caption = dict.textStyle(context, "caption", f.caption),
      button = dict.textStyle(context, "button", f.button)
    )
  }

  private fun parseRadii(dict: ReadableMap?, defaults: FrameTheme) = defaults.radii.let { r ->
    if (dict == null) return@let r
    r.copy(
      small = dict.dp("small") ?: r.small,
      medium = dict.dp("medium") ?: r.medium,
      large = dict.dp("large") ?: r.large
    )
  }

  private fun ReadableMap.getMapOrNull(key: String): ReadableMap? =
    if (hasKey(key) && !isNull(key)) getMap(key) else null

  private fun ReadableMap.color(key: String): Color? {
    if (!hasKey(key) || isNull(key)) return null
    val hex = getString(key) ?: return null
    return parseHexColor(hex)
  }

  private fun ReadableMap.dp(key: String) =
    if (hasKey(key) && !isNull(key)) getDouble(key).dp else null

  private fun ReadableMap.textStyle(context: Context, key: String, default: TextStyle): TextStyle {
    if (!hasKey(key) || isNull(key)) return default
    val entry = getMap(key) ?: return default
    val sizePt = if (entry.hasKey("size") && !entry.isNull("size")) entry.getDouble("size") else return default
    val name = if (entry.hasKey("name") && !entry.isNull("name")) entry.getString("name") else null
    val family = resolveFontFamily(context, name)
    return default.copy(fontSize = sizePt.sp, fontFamily = family)
  }

  private val fontFamilyCache = mutableMapOf<String, FontFamily>()

  private fun resolveFontFamily(context: Context, name: String?): FontFamily {
    if (name.isNullOrBlank() || name.equals("system", ignoreCase = true)) return FontFamily.Default
    fontFamilyCache[name]?.let { return it }
    val typeface = loadAssetTypeface(context, name) ?: return FontFamily.Default
    val family = FontFamily(typeface)
    fontFamilyCache[name] = family
    return family
  }

  private fun loadAssetTypeface(context: Context, name: String): Typeface? {
    val assets = context.assets
    val candidates = buildList {
      add("fonts/$name")
      add("fonts/$name.ttf")
      add("fonts/$name.otf")
    }
    for (path in candidates) {
      try {
        return Typeface.createFromAsset(assets, path)
      } catch (_: Exception) {
      }
    }
    return null
  }

  private fun parseHexColor(input: String): Color? {
    var s = input.trim()
    if (s.startsWith("#")) s = s.substring(1)
    if (s.length == 3) s = s.map { "$it$it" }.joinToString("")
    if (s.length != 6 && s.length != 8) return null
    val v = s.toLongOrNull(16) ?: return null
    val r: Int; val g: Int; val b: Int; val a: Int
    if (s.length == 6) {
      r = ((v shr 16) and 0xff).toInt()
      g = ((v shr 8) and 0xff).toInt()
      b = (v and 0xff).toInt()
      a = 255
    } else {
      r = ((v shr 24) and 0xff).toInt()
      g = ((v shr 16) and 0xff).toInt()
      b = ((v shr 8) and 0xff).toInt()
      a = (v and 0xff).toInt()
    }
    return Color(red = r, green = g, blue = b, alpha = a)
  }
}
