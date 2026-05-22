const { withEntitlementsPlist } = require('@expo/config-plugins');

const APPLE_PAY_KEY = 'com.apple.developer.in-app-payments';
const APP_ATTEST_KEY = 'com.apple.developer.devicecheck.appattest-environment';

const withFrameEntitlements = (config, props) =>
  withEntitlementsPlist(config, (mod) => {
    const merchantId = props && props.applePayMerchantId;
    if (!merchantId) return mod;

    const existing = mod.modResults[APPLE_PAY_KEY];
    const arr = Array.isArray(existing)
      ? existing.slice()
      : typeof existing === 'string'
      ? [existing]
      : [];
    if (!arr.includes(merchantId)) arr.push(merchantId);
    mod.modResults[APPLE_PAY_KEY] = arr;

    // App Attest is required for every Apple Pay charge. Always 'production' —
    // sandbox vs live behavior is keyed off the Frame API keys, not this value.
    mod.modResults[APP_ATTEST_KEY] = 'production';

    return mod;
  });

module.exports = withFrameEntitlements;
