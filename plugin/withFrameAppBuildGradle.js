const { withAppBuildGradle, WarningAggregator } = require('@expo/config-plugins');

const PLUGIN_NAME = 'framepayments-react-native';
const MARKER = '// @generated framepayments-react-native prove_implementation';
const PROVE_VERSION = '6.10.3';
const PROVE_IMPL_LINE = `    ${MARKER}\n    implementation 'com.prove.sdk:proveauth:${PROVE_VERSION}'\n`;

// Injects `implementation 'com.prove.sdk:proveauth:X.Y.Z'` into the host app's
// `android/app/build.gradle` when `enableProveAuth: true` is set on the config
// plugin. The SDK declares Prove as `compileOnly` in its own build.gradle, so
// the runtime classpath is only populated when the host opts in here.
//
// Pairs with withFrameSettingsGradle, which adds the Prove Artifactory Maven
// repo unconditionally — having the repo declared is harmless without the
// implementation line; the dep isn't fetched until something asks for it.

function injectImplementation(contents) {
  if (contents.includes(MARKER)) return contents;

  const re = /(dependencies\s*\{)([\s\S]*?)(\n\})/;
  const match = contents.match(re);
  if (!match) return null;

  return contents.replace(re, (_full, prefix, body, suffix) => prefix + body + '\n' + PROVE_IMPL_LINE + suffix);
}

const withFrameAppBuildGradle = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    const patched = injectImplementation(cfg.modResults.contents);
    if (patched == null) {
      WarningAggregator.addWarningAndroid(
        PLUGIN_NAME,
        `Could not auto-inject ProveAuth implementation into app/build.gradle. Add it manually: implementation 'com.prove.sdk:proveauth:${PROVE_VERSION}'`
      );
      return cfg;
    }
    cfg.modResults.contents = patched;
    return cfg;
  });

module.exports = withFrameAppBuildGradle;
