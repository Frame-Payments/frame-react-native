const { createRunOncePlugin } = require('@expo/config-plugins');
const withFrameEntitlements = require('./withFrameEntitlements');
const withFrameAndroidManifest = require('./withFrameAndroidManifest');
const withFramePodfile = require('./withFramePodfile');
const withFrameSettingsGradle = require('./withFrameSettingsGradle');
const pkg = require('../package.json');

const withFrameReactNative = (config, props = {}) => {
  config = withFramePodfile(config);
  config = withFrameSettingsGradle(config);
  if (props.applePayMerchantId) {
    config = withFrameEntitlements(config, props);
  }
  if (props.enableGooglePay !== false) {
    config = withFrameAndroidManifest(config);
  }
  return config;
};

module.exports = createRunOncePlugin(withFrameReactNative, pkg.name, pkg.version);
