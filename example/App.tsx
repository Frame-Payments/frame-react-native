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

  React.useEffect(() => {
    Frame.initialize({ apiKey: FRAME_API_KEY, debugMode: __DEV__ });
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

  const handleListCustomers = async () => {
    setLoading('customers');
    try {
      const frame = new FrameSDK({ apiKey: FRAME_API_KEY });
      const response = await frame.customers.list();
      const list = (response as { data?: unknown[] })?.data ?? [];
      setCustomers(Array.isArray(list) ? list : []);
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

      <TouchableOpacity
        style={[styles.button, loading === 'checkout' && styles.buttonDisabled]}
        onPress={handleCheckout}
        disabled={!!loading}
      >
        {loading === 'checkout' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Checkout (fixed amount)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, loading === 'cart' && styles.buttonDisabled]}
        onPress={handleCart}
        disabled={!!loading}
      >
        {loading === 'cart' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Cart → Checkout</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary, loading === 'customers' && styles.buttonDisabled]}
        onPress={handleListCustomers}
        disabled={!!loading}
      >
        {loading === 'customers' ? (
          <ActivityIndicator color="#333" />
        ) : (
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>View customers (frame-node)</Text>
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
});
