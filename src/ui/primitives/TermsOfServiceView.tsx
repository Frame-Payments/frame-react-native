import { Linking, StyleSheet, Text } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';

// Reusable terms-of-service paragraph with tappable Privacy / Terms links.
// Shown above the Continue button on PhoneAuthScreen when geo_compliance is
// requested. Mirrors Frame iOS' TermsOfServiceView attributed-string copy.

export interface TermsOfServiceViewProps {
  privacyUrl?: string;
  termsUrl?: string;
}

const DEFAULT_PRIVACY = 'https://framepayments.com/legal/privacy';
const DEFAULT_TERMS = 'https://framepayments.com/legal/terms';

export function TermsOfServiceView({
  privacyUrl = DEFAULT_PRIVACY,
  termsUrl = DEFAULT_TERMS,
}: TermsOfServiceViewProps) {
  const theme = useFrameTheme();

  return (
    <Text
      style={[
        styles.text,
        {
          color: theme.colors.textSecondary,
          fontSize: theme.fonts.bodySmall.size,
          lineHeight: theme.fontLineHeights.bodySmall,
        },
      ]}
      accessibilityLabel="Terms of Service"
    >
      By tapping Continue, you confirm that you agree to Frame's{' '}
      <Text
        style={[styles.link, { color: theme.colors.textPrimary }]}
        onPress={() => Linking.openURL(termsUrl)}
        accessibilityRole="link"
      >
        Terms of Service
      </Text>{' '}
      and{' '}
      <Text
        style={[styles.link, { color: theme.colors.textPrimary }]}
        onPress={() => Linking.openURL(privacyUrl)}
        accessibilityRole="link"
      >
        Privacy Policy
      </Text>
      .
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
  },
  link: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
