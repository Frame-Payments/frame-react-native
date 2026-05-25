const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the parent repo so changes to lib/ are picked up by Metro hot reload.
config.watchFolders = [monorepoRoot];

// Search the example's node_modules first (so the library's `file:..` resolves
// against the example's React/RN, not the library's own dev-dep copies at the
// repo root). Hierarchical lookup stays on so transitive Expo modules nested
// under `node_modules/expo/node_modules/` can still resolve.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Pin the React/RN packages to the example's copies to prevent duplicates from
// the library's own dev-dependency installs at the repo root.
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

// Force every import of `react` or `react-native` (including transitive imports
// from the symlinked framepayments-react-native SDK at the repo root) to the
// example's copies. `extraNodeModules` alone isn't always sufficient — Metro
// can still resolve to the library's own dev-dep copies and bundle a duplicate
// React, which then breaks hooks with "Cannot read property 'useState' of null".
const FORCE_LOCAL = ['react', 'react-native'];
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const pkg of FORCE_LOCAL) {
    if (moduleName === pkg || moduleName.startsWith(pkg + '/')) {
      const subPath = moduleName.slice(pkg.length);
      const target = path.join(projectRoot, 'node_modules', pkg + subPath);
      return context.resolveRequest(context, target, platform);
    }
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// axios (transitive via framepayments) needs browser conditions to avoid Node http/crypto.
config.resolver.unstable_conditionNames = ['require', 'react-native', 'browser', 'default'];

module.exports = config;
