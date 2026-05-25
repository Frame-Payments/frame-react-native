import {
  setConfig,
  getConfig,
  isInitialized,
  getPublishableKey,
  getSecretKey,
  getDebugMode,
  getTheme,
  getApplePayMerchantId,
  getGooglePayMerchantId,
  getEvervaultConfiguration,
  getSiftConfiguration,
  resetConfig,
  __internal,
} from '../config';

beforeEach(() => {
  resetConfig();
});

describe('config singleton', () => {
  it('starts uninitialized with debugMode false', () => {
    expect(isInitialized()).toBe(false);
    expect(getDebugMode()).toBe(false);
    expect(getPublishableKey()).toBeUndefined();
    expect(getSecretKey()).toBeUndefined();
  });

  it('setConfig persists every field exactly as passed', () => {
    setConfig({
      secretKey: 'sk_test_1',
      publishableKey: 'pk_test_1',
      debugMode: true,
      applePayMerchantId: 'merchant.com.example',
      googlePayMerchantId: 'BCR2DN4T...',
      theme: { colors: { primaryButton: '#FF0066' } },
    });
    expect(isInitialized()).toBe(true);
    expect(getSecretKey()).toBe('sk_test_1');
    expect(getPublishableKey()).toBe('pk_test_1');
    expect(getDebugMode()).toBe(true);
    expect(getApplePayMerchantId()).toBe('merchant.com.example');
    expect(getGooglePayMerchantId()).toBe('BCR2DN4T...');
    expect(getTheme()).toEqual({ colors: { primaryButton: '#FF0066' } });
  });

  it('getConfig returns the public-facing fields only (no cached Evervault/Sift)', () => {
    setConfig({
      secretKey: 'sk_1',
      publishableKey: 'pk_1',
      debugMode: false,
    });
    __internal.setEvervaultConfiguration({ teamId: 'team_a', appId: 'app_a' });
    const snapshot = getConfig();
    expect(snapshot).toEqual({
      secretKey: 'sk_1',
      publishableKey: 'pk_1',
      debugMode: false,
      applePayMerchantId: undefined,
      googlePayMerchantId: undefined,
      theme: undefined,
    });
    expect('evervaultConfiguration' in snapshot).toBe(false);
  });

  it('Evervault configuration cache round-trips', () => {
    expect(getEvervaultConfiguration()).toBeUndefined();
    __internal.setEvervaultConfiguration({ teamId: 'team_x', appId: 'app_x' });
    expect(getEvervaultConfiguration()).toEqual({ teamId: 'team_x', appId: 'app_x' });
  });

  it('Sift configuration cache round-trips', () => {
    expect(getSiftConfiguration()).toBeUndefined();
    __internal.setSiftConfiguration({ accountId: 'acct_x', beaconKey: 'bk_x', sessionId: 'sess_x' });
    expect(getSiftConfiguration()).toEqual({ accountId: 'acct_x', beaconKey: 'bk_x', sessionId: 'sess_x' });
  });

  it('resetConfig clears every field and the initialized flag', () => {
    setConfig({
      secretKey: 'sk_1',
      publishableKey: 'pk_1',
      debugMode: true,
      applePayMerchantId: 'merchant.com.example',
    });
    __internal.setEvervaultConfiguration({ teamId: 't', appId: 'a' });
    __internal.setSiftConfiguration({ accountId: 'a', beaconKey: 'b' });

    resetConfig();

    expect(isInitialized()).toBe(false);
    expect(getSecretKey()).toBeUndefined();
    expect(getPublishableKey()).toBeUndefined();
    expect(getDebugMode()).toBe(false);
    expect(getApplePayMerchantId()).toBeUndefined();
    expect(getEvervaultConfiguration()).toBeUndefined();
    expect(getSiftConfiguration()).toBeUndefined();
  });

  it('re-initializing replaces all fields (no merge)', () => {
    setConfig({
      secretKey: 'sk_1',
      publishableKey: 'pk_1',
      debugMode: true,
      applePayMerchantId: 'merchant.first',
    });
    setConfig({
      secretKey: 'sk_2',
      publishableKey: 'pk_2',
      debugMode: false,
    });
    expect(getSecretKey()).toBe('sk_2');
    expect(getPublishableKey()).toBe('pk_2');
    expect(getDebugMode()).toBe(false);
    expect(getApplePayMerchantId()).toBeUndefined();
  });

  it('theme stored is deep-frozen — external mutation throws or is silently ignored', () => {
    const themeIn = { colors: { primaryButton: '#FF0066' } };
    setConfig({ secretKey: 'sk', publishableKey: 'pk', debugMode: false, theme: themeIn });

    // Mutating the original input must not affect the stored config.
    themeIn.colors.primaryButton = '#000000';
    expect(getTheme()?.colors?.primaryButton).toBe('#FF0066');

    // Mutating the stored snapshot is rejected (strict mode would throw;
    // non-strict callers see the write silently ignored).
    const stored = getTheme();
    expect(() => {
      (stored as { colors: { primaryButton: string } }).colors.primaryButton = '#FFFFFF';
    }).toThrow();
    expect(getTheme()?.colors?.primaryButton).toBe('#FF0066');
  });
});
