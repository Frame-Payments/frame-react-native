const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    disableHierarchicalLookup: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);