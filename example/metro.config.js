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

const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    // Use axios browser build (avoids Node.js crypto/http modules in RN)
    unstable_enablePackageExports: true,
    unstable_conditionNames: ['require', 'react-native', 'browser', 'default'],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);