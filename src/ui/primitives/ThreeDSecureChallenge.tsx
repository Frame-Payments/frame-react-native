import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { isCallbackUrl, type ThreeDSecureChallengeResult } from '../../threeDSecure';

interface WebViewNavigation {
  url: string;
}

type WebViewComponent = React.ComponentType<{
  source: { uri: string };
  onNavigationStateChange?: (event: WebViewNavigation) => void;
  onShouldStartLoadWithRequest?: (event: WebViewNavigation) => boolean;
  onError?: () => void;
  onLoadEnd?: () => void;
  incognito?: boolean;
  style?: object;
}>;

let cachedWebView: WebViewComponent | null | undefined;

function loadWebView(): WebViewComponent | null {
  if (cachedWebView !== undefined) return cachedWebView;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-webview') as {
      WebView?: WebViewComponent;
      default?: WebViewComponent;
    };
    cachedWebView = mod.WebView ?? mod.default ?? null;
  } catch {
    cachedWebView = null;
  }
  return cachedWebView;
}

export function isThreeDSecureAvailable(): boolean {
  return loadWebView() !== null;
}

export interface ThreeDSecureChallengeProps {
  challengeUrl: string;
  onFinish: (result: ThreeDSecureChallengeResult) => void;
}

export function ThreeDSecureChallenge({ challengeUrl, onFinish }: ThreeDSecureChallengeProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const reported = useRef(false);
  const WebView = loadWebView();

  function report(result: ThreeDSecureChallengeResult) {
    if (reported.current) return;
    reported.current = true;
    onFinish(result);
  }

  const unavailable = WebView === null;
  useEffect(() => {
    if (unavailable) report('unavailable');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unavailable]);

  if (!WebView) return null;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => report('failed')}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.surfaceStroke }]}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.headline.size,
              fontWeight: theme.fontWeights.headline,
            }}
          >
            Verify your card
          </Text>
          <Pressable onPress={() => report('failed')} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: theme.colors.primaryButton, fontSize: theme.fonts.body.size }}>
              Cancel
            </Text>
          </Pressable>
        </View>
        <WebView
          source={{ uri: challengeUrl }}
          incognito
          onLoadEnd={() => setLoading(false)}
          onError={() => report('unavailable')}
          onNavigationStateChange={(event) => {
            if (isCallbackUrl(event.url)) report('completed');
          }}
          style={styles.web}
        />
        {loading ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color={theme.colors.primaryButton} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    web: { flex: 1 },
    loading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
