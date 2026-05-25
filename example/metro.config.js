const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

// Packages we MUST resolve to the example's copy, even if the importing file
// lives outside `example/` (e.g. the symlinked framepayments-react-native SDK
// at the repo root). Without this, Metro finds the repo root's
// `node_modules/react-native` first and bundles two copies of react-native,
// which breaks TurboModule lookup (DeviceInfo missing, etc.).
const FORCE_LOCAL = ['react', 'react-native'];

/**
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    resolveRequest: (context, moduleName, platform) => {
      // Match bare imports of `react-native` or `react-native/some/sub/path`.
      for (const pkg of FORCE_LOCAL) {
        if (moduleName === pkg || moduleName.startsWith(pkg + '/')) {
          const subPath = moduleName.slice(pkg.length);
          const target = path.join(projectRoot, 'node_modules', pkg + subPath);
          return context.resolveRequest(context, target, platform);
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
