/**
 * Frame React Native SDK – Example App
 *
 * 1. Set your API key in FRAME_API_KEY below or via env.
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
} from 'react-native';
import Frame from 'framepayments-react-native';
import { FrameSDK } from 'framepayments';

// Set your Frame secret key here or use an env variable. Do not commit real keys.
const FRAME_API_KEY = process.env.FRAME_API_KEY ?? 'YOUR_FRAME_SECRET_KEY';

const frameSDK = new FrameSDK({ apiKey: FRAME_API_KEY });

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
  const [customers, setCustomers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [initError, setInitError] = useState<string | null>(null);

  React.useEffect(() => {
    Frame.initialize({ apiKey: FRAME_API_KEY, debugMode: __DEV__ })
      .catch((e: any) => {
        const msg = e?.message ?? String(e);
        setInitError(msg);
        if (__DEV__) {
          console.warn('Frame.initialize failed:', msg);
        }
      });
  }, []);

  const handleCheckout = async () => {
    setLoading('checkout');
    try {
      const intent = await Frame.presentCheckout({ amount: 15000 });
      Alert.alert('Success', `Charge intent: ${intent?.id ?? 'created'}`);
    } catch (e: any) {
      if (e.code === 'USER_CANCELED') return;
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleCart = async () => {
    setLoading('cart');
    try {
      const intent = await Frame.presentCart({
        items: sampleCartItems,
        shippingAmountInCents: 4000,
      });
      Alert.alert('Success', intent?.id ? `Charge intent: ${intent.id}` : 'Cart flow completed');
    } catch (e: any) {
      if (e.code === 'USER_CANCELED') return;
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleOnboarding = async () => {
    setLoading('onboarding');
    try {
      const result = await Frame.presentOnboarding({
        capabilities: ['kyc', 'kyc_prefill', 'age_verification', 'phone_verification', 'card_verification', 'bank_account_verification'],
      });
      Alert.alert(
        result.status === 'completed' ? 'Onboarding complete' : 'Onboarding cancelled',
        result.paymentMethodId ? `Payment method: ${result.paymentMethodId}` : undefined,
      );
    } catch (e: any) {
      if (e.code === 'USER_CANCELED') return;
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleListCustomers = async () => {
    setLoading('customers');
    try {
      const response = await frameSDK.customers.list();
      const list = (response as { data?: unknown[] })?.data ?? [];
      setCustomers(Array.isArray(list) ? list : []);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleListAccounts = async () => {
    setLoading('accounts');
    try {
      const response = await frameSDK.accounts.list();
      const list = (response as { data?: unknown[] })?.data ?? [];
      setAccounts(Array.isArray(list) ? list : []);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleListPaymentMethods = async () => {
    setLoading('paymentMethods');
    try {
      const response = await frameSDK.paymentMethods.list();
      const list = (response as { data?: unknown[] })?.data ?? [];
      setPaymentMethods(Array.isArray(list) ? list : []);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Frame RN SDK Example</Text>
      <Text style={styles.subtitle}>Set FRAME_API_KEY in App.tsx or env, then tap below.</Text>

      {initError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>SDK init failed</Text>
          <Text style={styles.errorText}>{initError}</Text>
          <Text style={styles.errorHint}>
            If you see &quot;Helpers are not supported by the default hub&quot;, call [FramePreloader preloadOnMainThread] in AppDelegate before [super application:didFinishLaunchingWithOptions:], and ensure Frame-iOS is added via Xcode (File → Add Package Dependencies → https://github.com/Frame-Payments/frame-ios).
          </Text>
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
        style={[styles.button, styles.buttonSecondary, (loading === 'customers' || !!initError) && styles.buttonDisabled]}
        onPress={handleListCustomers}
        disabled={!!loading || !!initError}
      >
        {loading === 'customers' ? (
          <ActivityIndicator color="#333" />
        ) : (
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>View customers</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary, (loading === 'accounts' || !!initError) && styles.buttonDisabled]}
        onPress={handleListAccounts}
        disabled={!!loading || !!initError}
      >
        {loading === 'accounts' ? (
          <ActivityIndicator color="#333" />
        ) : (
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>View accounts</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary, (loading === 'paymentMethods' || !!initError) && styles.buttonDisabled]}
        onPress={handleListPaymentMethods}
        disabled={!!loading || !!initError}
      >
        {loading === 'paymentMethods' ? (
          <ActivityIndicator color="#333" />
        ) : (
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>View payment methods</Text>
        )}
      </TouchableOpacity>

      {customers.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.listTitle}>Customers</Text>
          {customers.slice(0, 5).map((c: any) => (
            <Text key={c.id} style={styles.listItem}>{c.name ?? c.id}</Text>
          ))}
        </View>
      )}

      {accounts.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.listTitle}>Accounts</Text>
          {accounts.slice(0, 5).map((a: any) => (
            <Text key={a.id} style={styles.listItem}>{a.name ?? a.id}</Text>
          ))}
        </View>
      )}

      {paymentMethods.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.listTitle}>Payment Methods</Text>
          {paymentMethods.slice(0, 5).map((pm: any) => (
            <Text key={pm.id} style={styles.listItem}>{pm.type ?? pm.id}{pm.card ? ` •••• ${pm.card.lastFourDigits}` : ''}</Text>
          ))}
        </View>
      )}
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
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#333',
  },
  list: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  listItem: {
    fontSize: 14,
    paddingVertical: 4,
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
});
