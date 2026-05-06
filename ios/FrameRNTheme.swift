//
//  FrameRNTheme.swift
//  FrameReactNative
//
//  Bridges JS theme dictionaries to Frame-iOS's FrameTheme and applies it to
//  every SwiftUI root view we present. Read/written only on the main thread.
//

import Foundation
import SwiftUI
import Frame

enum FrameRNTheme {
  // Main-thread only: written by FrameSDKBridge.setTheme (dispatched to main),
  // read by present* methods (already on main).
  static var current: FrameTheme? = nil

  static func resolved() -> FrameTheme { current ?? .default }

  static func parse(_ dict: [String: Any]) -> FrameTheme {
    var theme = FrameTheme.default

    if let colorsDict = dict["colors"] as? [String: Any] {
      applyColor(colorsDict, "primaryButton") { theme.colors.primaryButton = $0 }
      applyColor(colorsDict, "primaryButtonText") { theme.colors.primaryButtonText = $0 }
      applyColor(colorsDict, "secondaryButton") { theme.colors.secondaryButton = $0 }
      applyColor(colorsDict, "secondaryButtonText") { theme.colors.secondaryButtonText = $0 }
      applyColor(colorsDict, "disabledButton") { theme.colors.disabledButton = $0 }
      applyColor(colorsDict, "disabledButtonStroke") { theme.colors.disabledButtonStroke = $0 }
      applyColor(colorsDict, "disabledButtonText") { theme.colors.disabledButtonText = $0 }
      applyColor(colorsDict, "surface") { theme.colors.surface = $0 }
      applyColor(colorsDict, "surfaceStroke") { theme.colors.surfaceStroke = $0 }
      applyColor(colorsDict, "textPrimary") { theme.colors.textPrimary = $0 }
      applyColor(colorsDict, "textSecondary") { theme.colors.textSecondary = $0 }
      applyColor(colorsDict, "error") { theme.colors.error = $0 }
      applyColor(colorsDict, "onboardingHeaderBackground") { theme.colors.onboardingHeaderBackground = $0 }
      applyColor(colorsDict, "onboardingProgressFilledOnBrand") { theme.colors.onboardingProgressFilledOnBrand = $0 }
      applyColor(colorsDict, "onboardingProgressEmptyOnBrand") { theme.colors.onboardingProgressEmptyOnBrand = $0 }
    }

    if let fontsDict = dict["fonts"] as? [String: Any] {
      applyFont(fontsDict, "title") { theme.fonts.title = $0 }
      applyFont(fontsDict, "heading") { theme.fonts.heading = $0 }
      applyFont(fontsDict, "headline") { theme.fonts.headline = $0 }
      applyFont(fontsDict, "body") { theme.fonts.body = $0 }
      applyFont(fontsDict, "bodySmall") { theme.fonts.bodySmall = $0 }
      applyFont(fontsDict, "label") { theme.fonts.label = $0 }
      applyFont(fontsDict, "caption") { theme.fonts.caption = $0 }
      applyFont(fontsDict, "button") { theme.fonts.button = $0 }
    }

    if let radiiDict = dict["radii"] as? [String: Any] {
      if let v = radiiDict["small"] as? Double { theme.radii.small = CGFloat(v) }
      if let v = radiiDict["medium"] as? Double { theme.radii.medium = CGFloat(v) }
      if let v = radiiDict["large"] as? Double { theme.radii.large = CGFloat(v) }
    }

    return theme
  }

  private static func applyColor(_ dict: [String: Any], _ key: String, _ set: (Color) -> Void) {
    guard let hex = dict[key] as? String, let color = Color(rnHex: hex) else { return }
    set(color)
  }

  private static func applyFont(_ dict: [String: Any], _ key: String, _ set: (Font) -> Void) {
    guard let entry = dict[key] as? [String: Any],
          let name = entry["name"] as? String,
          let size = entry["size"] as? Double else { return }
    if name.lowercased() == "system" {
      set(.system(size: CGFloat(size)))
    } else {
      set(.custom(name, size: CGFloat(size)))
    }
  }
}

// Applies the supplied FrameTheme to a single root view. Captured at present
// time so each UIHostingController has a stable, concrete rootView type.
struct ThemedRoot<Content: View>: View {
  let theme: FrameTheme
  let content: Content

  init(_ content: Content, theme: FrameTheme) {
    self.content = content
    self.theme = theme
  }

  var body: some View {
    content.frameTheme(theme)
  }
}

extension Color {
  // Accepts "#RGB", "#RRGGBB", "#RRGGBBAA" with or without the leading '#'.
  init?(rnHex hex: String) {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    if s.count == 3 {
      s = s.map { "\($0)\($0)" }.joined()
    }
    guard s.count == 6 || s.count == 8 else { return nil }
    var v: UInt64 = 0
    guard Scanner(string: s).scanHexInt64(&v) else { return nil }
    let r, g, b, a: Double
    if s.count == 6 {
      r = Double((v >> 16) & 0xff) / 255
      g = Double((v >>  8) & 0xff) / 255
      b = Double( v        & 0xff) / 255
      a = 1
    } else {
      r = Double((v >> 24) & 0xff) / 255
      g = Double((v >> 16) & 0xff) / 255
      b = Double((v >>  8) & 0xff) / 255
      a = Double( v        & 0xff) / 255
    }
    self = Color(.sRGB, red: r, green: g, blue: b, opacity: a)
  }
}
