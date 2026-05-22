const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const META_NAME = 'com.google.android.gms.wallet.api.enabled';

const withFrameAndroidManifest = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app['meta-data'] = app['meta-data'] || [];
    const exists = app['meta-data'].some(
      (m) => m && m.$ && m.$['android:name'] === META_NAME
    );
    if (!exists) {
      app['meta-data'].push({
        $: { 'android:name': META_NAME, 'android:value': 'true' },
      });
    }
    return cfg;
  });

module.exports = withFrameAndroidManifest;
