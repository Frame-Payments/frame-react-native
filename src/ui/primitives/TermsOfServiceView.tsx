import { Linking, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { getLegalUrls } from '../../legal';

// Reusable terms-of-service paragraph with tappable Privacy / Terms links.
// Shown above the Continue button on PhoneAuthScreen when geo_compliance is

export interface TermsOfServiceViewProps {
  privacyUrl?: string;
  termsUrl?: string;
  alignment?: 'left' | 'center' | 'right';
  padded?: boolean;
}

export function TermsOfServiceView({
  privacyUrl,
  termsUrl,
  alignment = 'center',
  padded = false,
}: TermsOfServiceViewProps) {
  const theme = useFrameTheme();
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
