const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

// example/.env is gitignored. Shell vars win so a one-off override still works.
// Babel inlines FRAME_* at bundle time; restart Metro with --reset-cache after edits.
const envFile = path.join(projectRoot, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const exampleReact = path.resolve(projectRoot, 'node_modules/react');
const exampleReactNative = path.resolve(projectRoot, 'node_modules/react-native');
const rootReact = path.resolve(monorepoRoot, 'node_modules/react');
const rootReactNative = path.resolve(monorepoRoot, 'node_modules/react-native');

function escapePathForRegExp(filePath) {
  return filePath.replace(/[/\\]/g, '[/\\\\]');
}

// Root package.json pins react-native@0.82 for Jest; the example runs 0.83.
// Hierarchical lookup from lib/ would pick the root copy and NativeEventEmitter
// then fails with PlatformConstants (separate TurboModuleRegistry singleton).
const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    blockList: [
      new RegExp(`^${escapePathForRegExp(rootReactNative)}[/\\\\].*`),
      new RegExp(`^${escapePathForRegExp(rootReact)}[/\\\\].*`),
    ],
    extraNodeModules: {
      react: exampleReact,
      'react-native': exampleReactNative,
    },
    // Use axios browser build (avoids Node.js crypto/http modules in RN)
    unstable_enablePackageExports: true,
    unstable_conditionNames: ['require', 'react-native', 'browser', 'default'],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);