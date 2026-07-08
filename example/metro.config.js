const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

// Load example/.env into process.env so App.tsx's `process.env.FRAME_*` reads
// resolve without any shell sourcing. Metro's Babel transform inlines
// `process.env.X` from THIS Node process at bundle time, and metro.config.js
// runs before transformation — so populating process.env here is enough.
// Zero-dependency parser (no react-native-dotenv needed). Existing shell vars
// win, so `FRAME_SECRET_KEY=... npm start` still overrides the file.
loadEnv(path.join(projectRoot, '.env'));

function loadEnv(envPath) {
  let contents;
  try {
    contents = fs.readFileSync(envPath, 'utf8');
  } catch {
    return; // no .env file — fall back to shell env only
  }
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue; // shell env takes precedence
    let value = line.slice(eq + 1).trim();
    // Strip surrounding single or double quotes if present.
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value[value.length - 1] === value[0]) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

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
    // framepayments@2.4.0 ships a dual build: its `.mjs` (import condition)
    // opens with `import { createRequire } from "node:module"`, which Metro
    // can't resolve for RN. Prefer `require` so Metro picks the clean CJS
    // build (`index.cjs`, no node: builtins). `browser` also steers axios
    // away from Node's http/crypto. Mirrors expo-example/metro.config.js.
    unstable_conditionNames: ['require', 'react-native', 'browser', 'default'],
    resolveRequest: (context, moduleName, platform) => {
      // framepayments@2.4.0's `.mjs` (import condition) opens with
      // `import { createRequire } from "node:module"`, which Metro can't
      // resolve for RN. unstable_conditionNames isn't reliably honored here
      // (Metro still prefers the pkg `module` field), so pin the bare import
      // straight to the clean CJS build (`index.cjs`, no node: builtins).
      if (moduleName === 'framepayments') {
        // Its `exports` map blocks direct subpath resolution, so locate the
        // package via package.json and join the CJS build relative to it.
        const pkgDir = path.dirname(
          require.resolve('framepayments/package.json')
        );
        return context.resolveRequest(
          context,
          path.join(pkgDir, 'dist', 'index.cjs'),
          platform
        );
      }
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
