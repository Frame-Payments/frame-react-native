import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { isCallbackUrl, type ThreeDSecureChallengeResult } from '../../threeDSecure';

// Hosts the issuer's 3D Secure challenge page and reports when the cardholder
// is done with it. Mirrors iOS ThreeDSecureChallengeView + the Cancel toolbar
// item on FrameThreeDSecureChallengePresenter: watch for the redirect to
// /evervault/3ds/callback, report exactly once, and treat Cancel and an
// interactive dismiss as `failed` rather than `unavailable` — the charge may
// still have settled, so only a challenge that never loaded is unavailable.
//
// react-native-webview is an OPTIONAL peer dep, lazy-required like Plaid so a
// host that never runs a challenged card doesn't have to install it. Without it
// the challenge reports `unavailable`, which surfaces as
// "Card verification could not be started" rather than a crash.

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

/** True when react-native-webview is linked, so a challenge can actually run. */
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
  // A redirect, a load failure, and a dismiss can all arrive during teardown.
  const reported = useRef(false);
  const WebView = loadWebView();

  function report(result: ThreeDSecureChallengeResult) {
    if (reported.current) return;
    reported.current = true;
    onFinish(result);
  }

  // Reported from an effect rather than the render body: calling back during
  // render re-enters the caller mid-commit, and a re-render before a
  // setTimeout fires would schedule the callback more than once.
  const unavailable = WebView === null;
  useEffect(() => {
    if (unavailable) report('unavailable');
    // `report` is latched, so a re-run cannot double-report.
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
          // Keeps issuer cookies out of the host app's shared storage, matching
          // iOS's non-persistent WKWebsiteDataStore.
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
