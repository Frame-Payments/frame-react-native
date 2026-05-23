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

// axios (transitive via framepayments) needs browser conditions to avoid Node http/crypto.
config.resolver.unstable_conditionNames = ['require', 'react-native', 'browser', 'default'];

module.exports = config;
