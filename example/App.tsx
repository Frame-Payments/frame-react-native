/**
 * Frame React Native SDK – Example App
 *
 * 1. Set FRAME_PUBLISHABLE_KEY and FRAME_SECRET_KEY via example/.env or the shell (see example/README.md).
 * 2. Run: npm install, then cd ios && pod install (iOS), then npm run ios or npm run android.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  useColorScheme,
} from 'react-native';
import Frame from 'framepayments-react-native';
import { FrameSDK } from 'framepayments';

// Supply via environment variables (e.g. `FRAME_SECRET_KEY=... npm run ios`) — do not commit real keys.
// Leave FRAME_SECRET_KEY unset to exercise the publishable-key-only path on both platforms.
const FRAME_SECRET_KEY = process.env.FRAME_SECRET_KEY ?? '';
const FRAME_PUBLISHABLE_KEY = process.env.FRAME_PUBLISHABLE_KEY ?? '';

// Apple Pay merchant ID registered in the example app's entitlements. Mirrors the native iOS example.
const APPLE_PAY_MERCHANT_ID = 'merchant.com.framepayments.example';


const frameSDK = new FrameSDK({ apiKey: FRAME_SECRET_KEY });

const sampleCartItems = [
  {
    id: '1',
    title: 'Vintage Track Jacket',
    amountInCents: 10000,
    imageUrl: 'https://img.kwcdn.com/product/fancy/5048db00-f41b-47e6-9268-2c0e3d2629e2.jpg',
  },
  {
    id: '2',
    title: 'Zip Up Hoodie',
    amountInCents: 25000,
    imageUrl: 'https://cdn.shopify.com/s/files/1/0573/6433/files/4f311c56-b5aa-4136-89d1-c820f8494ecc_large.jpg',
  },
];

export default function App() {
  const [loading, setLoading] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const applePayButtonSource = colorScheme === 'dark'
    ? require('./assets/applepay/button_buy_with_light.png')
    : require('./assets/applepay/button_buy_with_dark.png');
  const googlePayButtonSource = colorScheme === 'dark'
    ? require('./assets/googlepay/button_buy_with_light.png')
    : require('./assets/googlepay/button_buy_with_dark.png');
  const [initError, setInitError] = useState<string | null>(null);
  // Set from onboarding's result, then used by every other flow — mirrors FrameExample-iOS.
  const [accountId, setAccountId] = useState('');

  React.useEffect(() => {
    Frame.initialize({
      // Omitted entirely when unset, rather than passed as '', so the app runs
      // the publishable-key-only flow that Frame-iOS 4.x / frame-android 3.x support.
      ...(FRAME_SECRET_KEY ? { secretKey: FRAME_SECRET_KEY } : {}),
      publishableKey: FRAME_PUBLISHABLE_KEY,
      applePayMerchantId: APPLE_PAY_MERCHANT_ID,
      debugMode: __DEV__,
      // Uncomment to exercise the FrameTheme tokens (iOS + Android).
      // theme: {
      //   colors: {
      //     primaryButton: '#FF0066',
      //     surface: '#0A0A0A',
      //     surfaceStroke: '#222222',
      //     textPrimary: '#FFFFFF',
      //     textSecondary: '#AAAAAA',
      //   },
      //   radii: { medium: 16 },
      // },
    })
      .catch((e: any) => {
        const msg = e?.message ?? String(e);
        setInitError(msg);
        if (__DEV__) {
          console.warn('Frame.initialize failed:', msg);
        }
      });
  }, []);

  const requireAccount = (): boolean => {
    if (accountId) return true;
    Alert.alert('No account', 'Run onboarding first to create an account.');
    return false;
  };

  // frame-ios 4.7 / frame-android 3.3 load saved cards only with a chk_sess_ token.
  // Production apps mint this on the server. The demo uses sk_.
  const mintCheckoutClientSecret = async (forAccountId: string, amountCents: number) => {
    if (!FRAME_SECRET_KEY) {
      throw new Error('Set FRAME_SECRET_KEY to mint a checkout session.');
    }
    const response = await fetch('https://api.framepayments.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FRAME_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: forAccountId,
        amount: { value: amountCents, currency: 'usd' },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.client_secret !== 'string' || typeof body.expires_at !== 'number') {
      const message = body?.error?.message ?? body?.message ?? `Checkout session failed (${response.status})`;
      throw new Error(message);
    }
    return {
      clientSecret: body.client_secret as string,
      expiresAt: body.expires_at as number,
      amountCents,
      amountCurrency: 'usd',
    };
  };

  const handleCheckout = async () => {
    if (!requireAccount()) return;
    setLoading('checkout');
    try {
      const amount = 15000;
      const checkoutClientSecret = await mintCheckoutClientSecret(accountId, amount);
      const transferId = await Frame.presentCheckout({
        accountId,
        amount,
        checkoutClientSecret,
      });
      Alert.alert('Success', `Transfer: ${transferId}`);
    } catch (e: any) {
      if (e.code === 'USER_CANCELED') return;
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleCart = async () => {
    if (!requireAccount()) return;
    setLoading('cart');
    try {
      const shippingAmountInCents = 4000;
      const amount = sampleCartItems.reduce((sum, item) => sum + item.amountInCents, shippingAmountInCents);
      const checkoutClientSecret = await mintCheckoutClientSecret(accountId, amount);
      const transferId = await Frame.presentCart({
        accountId,
        items: sampleCartItems,
        shippingAmountInCents,
        checkoutClientSecret,
      });
      Alert.alert('Success', transferId ? `Transfer: ${transferId}` : 'Cart flow completed');
    } catch (e: any) {
      if (e.code === 'USER_CANCELED') return;
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleApplePay = async () => {
    if (!requireAccount()) return;
    setLoading('applePay');
    try {
      // Transfers V2: wallet charges require an account owner and resolve with a Transfer id.
      const transferId = await Frame.presentApplePay({
        amount: 100,
        currency: 'usd',
        owner: { type: 'account', id: accountId },
      });
      Alert.alert('Apple Pay', `Transfer id: ${transferId}`);
    } catch (e: any) {
      if (e.code === 'USER_CANCELED') return;
      Alert.alert('Apple Pay error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleGooglePay = async () => {
    if (!requireAccount()) return;
    setLoading('googlePay');
    try {
      // Transfers V2: wallet charges require an account owner and resolve with a Transfer id.
      const transferId = await Frame.presentGooglePay({
        amountCents: 100,
        currencyCode: 'USD',
        owner: { type: 'account', id: accountId },
      });
      Alert.alert('Google Pay', `Transfer id: ${transferId}`);
    } catch (e: any) {
      if (e.code === 'USER_CANCELED') return;
      Alert.alert('Google Pay error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  // Demo only: creates the account and mints the onb_sess_ secret with the configured sk_.
  // Production apps do both on their backend (POST /v1/onboarding_sessions).
  const handleOnboarding = async () => {
    if (!FRAME_SECRET_KEY) {
      Alert.alert('Secret key required', 'Set FRAME_SECRET_KEY to create an account and onboarding session.');
      return;
    }
    setLoading('onboarding');
    try {
      const onboardingAccountId = accountId || (await frameSDK.accounts.create({
        type: 'individual',
        profile: { individual: { name: { first_name: '', last_name: '' }, email: 'newaccount@example.com' } },
      })).id;
      setAccountId(onboardingAccountId);
      const session = await frameSDK.onboardingSessions.create({
        account_id: onboardingAccountId,
        steps: ['id_verification', 'geo_compliance', 'payment_method'],
      });
      const result = await Frame.presentOnboarding({
        accountId: onboardingAccountId,
        clientSecret: session.client_secret,
        capabilities: ['kyc', 'kyc_prefill', 'age_verification', 'phone_verification', 'card_verification', 'bank_account_verification'],
      });
      // Unverified still keeps the account: it's needed to scope follow-up calls.
      if (result.status !== 'cancelled' && result.accountId) {
        setAccountId(result.accountId);
      }
      const detail = result.accountId ? `Account: ${result.accountId}` : result.message;
      const title =
        result.status === 'completed'
          ? 'Onboarding complete'
          : result.status === 'unverified'
            ? `Onboarding unverified (${result.outcome})`
            : 'Onboarding cancelled';
      Alert.alert(title, detail);
    } catch (e: any) {
      if (e.code === 'USER_CANCELED') return;
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  // Standalone add/select screens require an onboarding-session secret (frame-ios 4.6 /
  // frame-android 3.2). Production apps mint this on the server; the demo uses sk_.
  const mintOnboardingSession = async (forAccountId: string) => {
    if (!FRAME_SECRET_KEY) {
      throw Object.assign(new Error('Set FRAME_SECRET_KEY to mint an onboarding session.'), {
        code: 'INVALID_CLIENT_SECRET',
      });
    }
    const session = await frameSDK.onboardingSessions.create({
      account_id: forAccountId,
      steps: ['payment_method'],
    });
    return session.client_secret as string;
  };

  const handleAddPaymentMethod = async () => {
    if (!requireAccount()) return;
    setLoading('addPaymentMethod');
    try {
      const clientSecret = await mintOnboardingSession(accountId);
      const result = await Frame.presentAddPaymentMethod({ accountId, clientSecret });
      Alert.alert(
        result.status === 'completed' ? 'Payment method added' : 'Cancelled',
        result.methodId ? `Payment method: ${result.methodId}` : undefined,
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleAddPayoutMethod = async () => {
    if (!requireAccount()) return;
    setLoading('addPayoutMethod');
    try {
      const clientSecret = await mintOnboardingSession(accountId);
      const result = await Frame.presentAddPayoutMethod({ accountId, clientSecret });
      Alert.alert(
        result.status === 'completed' ? 'Payout method added' : 'Cancelled',
        result.methodId ? `Payout method: ${result.methodId}` : undefined,
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  // Lists the account's saved ACH payout methods and elects the chosen one as the
  // account's payout destination. Where presentAddPayoutMethod only adds a bank, this
  // also makes it primary, so `methodId` is the newly elected method.
  const handleSelectPayoutMethod = async () => {
    if (!requireAccount()) return;
    setLoading('selectPayoutMethod');
    try {
      const clientSecret = await mintOnboardingSession(accountId);
      const result = await Frame.presentSelectPayoutMethod({ accountId, clientSecret });
      Alert.alert(
        result.status === 'completed' ? 'Primary payout method set' : 'Cancelled',
        result.methodId ? `Payout method: ${result.methodId}` : undefined,
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Frame RN SDK Example</Text>
      <Text style={styles.subtitle}>
        {accountId ? `Account: ${accountId}` : 'No account yet — run onboarding first.'}
      </Text>

      {initError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>SDK init failed</Text>
          <Text style={styles.errorText}>{initError}</Text>
          <Text style={styles.errorHint}>
            If you see &quot;Helpers are not supported by the default hub&quot;, call [FramePreloader preloadOnMainThread] in AppDelegate before [super application:didFinishLaunchingWithOptions:], and ensure Frame-iOS is added via Xcode (File → Add Package Dependencies → https://github.com/Frame-Payments/frame-ios).
          </Text>
        </View>
      )}

      {!initError && (
        <View style={styles.walletSection}>
          <Text style={styles.walletTitle}>Quick Pay</Text>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.walletButton}
              onPress={handleApplePay}
              disabled={!!loading || !!initError}
              activeOpacity={0.8}
            >
              <Image
                source={applePayButtonSource}
                style={styles.walletButtonImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={styles.walletButton}
              onPress={handleGooglePay}
              disabled={!!loading || !!initError}
              activeOpacity={0.8}
            >
              <Image
                source={googlePayButtonSource}
                style={styles.walletButtonImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, (loading === 'checkout' || !!initError) && styles.buttonDisabled]}
        onPress={handleCheckout}
        disabled={!!loading || !!initError}
      >
        {loading === 'checkout' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Checkout (fixed amount)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, (loading === 'cart' || !!initError) && styles.buttonDisabled]}
        onPress={handleCart}
        disabled={!!loading || !!initError}
      >
        {loading === 'cart' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Cart → Checkout</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, (loading === 'onboarding' || !!initError) && styles.buttonDisabled]}
        onPress={handleOnboarding}
        disabled={!!loading || !!initError}
      >
        {loading === 'onboarding' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Onboarding (KYC + bank)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, (loading === 'addPaymentMethod' || !!initError) && styles.buttonDisabled]}
        onPress={handleAddPaymentMethod}
        disabled={!!loading || !!initError}
      >
        {loading === 'addPaymentMethod' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Add payment method</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, (loading === 'addPayoutMethod' || !!initError) && styles.buttonDisabled]}
        onPress={handleAddPayoutMethod}
        disabled={!!loading || !!initError}
      >
        {loading === 'addPayoutMethod' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Add payout method</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, (loading === 'selectPayoutMethod' || !!initError) && styles.buttonDisabled]}
        onPress={handleSelectPayoutMethod}
        disabled={!!loading || !!initError}
      >
        {loading === 'selectPayoutMethod' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Select payout method</Text>
        )}
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#c62828',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c62828',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  errorHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  walletSection: {
    marginBottom: 16,
  },
  walletTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  walletButton: {
    width: '100%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  walletButtonImage: {
    width: '100%',
    height: '100%',
  },
});
