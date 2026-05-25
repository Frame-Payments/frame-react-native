const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WALLET_META = 'com.google.android.gms.wallet.api.enabled';
const PERM_CAMERA = 'android.permission.CAMERA';
const PERM_FINE_LOCATION = 'android.permission.ACCESS_FINE_LOCATION';
const PERM_COARSE_LOCATION = 'android.permission.ACCESS_COARSE_LOCATION';

// Reads the host app's package.json (one level up from the project root that
// `expo prebuild` runs in) and returns true if any of the given package names
// appear in dependencies or devDependencies. Optional peer deps drive the
// permission set: a host app that never installs `react-native-vision-camera`
// should not ship a CAMERA permission (Play Store flags it during review).
function hostHasAnyDep(projectRoot, names) {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return names.some((n) => Object.prototype.hasOwnProperty.call(all, n));
  } catch {
    return false;
  }
}

function ensureWalletMeta(application) {
  application['meta-data'] = application['meta-data'] || [];
  const exists = application['meta-data'].some(
    (m) => m && m.$ && m.$['android:name'] === WALLET_META,
  );
  if (!exists) {
    application['meta-data'].push({
      $: { 'android:name': WALLET_META, 'android:value': 'true' },
    });
  }
}

function ensurePermission(manifest, permName) {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  const exists = manifest['uses-permission'].some(
    (p) => p && p.$ && p.$['android:name'] === permName,
  );
  if (!exists) {
    manifest['uses-permission'].push({ $: { 'android:name': permName } });
  }
}

const withFrameAndroidManifest = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    ensureWalletMeta(app);

    const projectRoot = cfg.modRequest?.projectRoot ?? process.cwd();
    if (hostHasAnyDep(projectRoot, ['react-native-vision-camera'])) {
      ensurePermission(manifest, PERM_CAMERA);
    }
    if (
      hostHasAnyDep(projectRoot, [
        'expo-location',
        '@react-native-community/geolocation',
      ])
    ) {
      ensurePermission(manifest, PERM_FINE_LOCATION);
      ensurePermission(manifest, PERM_COARSE_LOCATION);
    }

    return cfg;
  });

module.exports = withFrameAndroidManifest;
