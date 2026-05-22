const { createRunOncePlugin } = require('@expo/config-plugins');
const withFrameAppDelegate = require('./withFrameAppDelegate');
const withFrameEntitlements = require('./withFrameEntitlements');
const withFrameAndroidManifest = require('./withFrameAndroidManifest');
const pkg = require('../package.json');

const withFrameReactNative = (config, props = {}) => {
  config = withFrameAppDelegate(config);
  if (props.applePayMerchantId) {
    config = withFrameEntitlements(config, props);
  }
  if (props.enableGooglePay !== false) {
    config = withFrameAndroidManifest(config);
  }
  return config;
};

module.exports = createRunOncePlugin(withFrameReactNative, pkg.name, pkg.version);
