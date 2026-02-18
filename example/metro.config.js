const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    disableHierarchicalLookup: true,
    // Use axios browser build (avoids Node.js crypto/http modules in RN)
    unstable_enablePackageExports: true,
    unstable_conditionNames: ['require', 'import', 'react-native', 'browser'],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);