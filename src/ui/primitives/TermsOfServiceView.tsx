import { Linking, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { getLegalUrls } from '../../legal';

// Reusable terms-of-service paragraph with tappable Privacy / Terms links.
// Shown above the Continue button on PhoneAuthScreen when geo_compliance is
// requested. Mirrors Frame iOS' TermsOfServiceView
// (`Sources/FrameOnboarding/Reusable/TermsOfService.swift:24-44`) — same copy,
// same Privacy-then-Terms order, and the same primaryButton link color.

export interface TermsOfServiceViewProps {
  /** Overrides the configured Privacy Policy URL. */
  privacyUrl?: string;
  /** Overrides the configured Terms of Service URL. */
  termsUrl?: string;
  /** Horizontal alignment for the consent text. Defaults to `'center'`. */
  alignment?: 'left' | 'center' | 'right';
  /** Wraps the text in a themed rounded-rectangle surface. Defaults to `false`. */
  padded?: boolean;
}

export function TermsOfServiceView({
  privacyUrl,
  termsUrl,
  alignment = 'center',
  padded = false,
}: TermsOfServiceViewProps) {
  const theme = useFrameTheme();
  // Sourced from the configuration API (with bundled fallbacks) rather than
  // hardcoded, so a legal-URL change ships without an SDK release.
  const legal = getLegalUrls();
  const privacy = privacyUrl ?? legal.privacyUrl;
  const terms = termsUrl ?? legal.termsUrl;

  const body = (
    <Text
      style={[
        { textAlign: alignment },
        {
          color: theme.colors.textSecondary,
          fontSize: theme.fonts.caption.size,
          lineHeight: theme.fontLineHeights.caption,
        },
      ]}
      accessibilityLabel="Terms of Service"
    >
      By clicking continue, you agree to the terms of Frame&apos;s{' '}
      <Text
        style={[styles.link, { color: theme.colors.primaryButton }]}
        onPress={() => Linking.openURL(privacy)}
        accessibilityRole="link"
      >
        Privacy Policy
      </Text>{' '}
      and{' '}
      <Text
        style={[styles.link, { color: theme.colors.primaryButton }]}
        onPress={() => Linking.openURL(terms)}
        accessibilityRole="link"
      >
        Terms of Service
      </Text>
      .
    </Text>
  );

  if (!padded) return body;

  return (
    <View
      style={[
        styles.surface,
        {
          borderColor: theme.colors.surfaceStroke,
          borderRadius: theme.radii.medium,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderWidth: 1,
    padding: 16,
  },
  link: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
