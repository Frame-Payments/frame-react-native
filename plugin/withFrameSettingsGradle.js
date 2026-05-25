const { withProjectBuildGradle, withSettingsGradle } = require('@expo/config-plugins');

// Injects the Prove Artifactory Maven repository into the Expo-generated
// Android project so the framepayments-react-native AAR can resolve
// `com.prove.sdk:proveauth:6.10.3` at compile time (we declare it as
// `compileOnly` so the published bytecode references real types, but the
// repo must still be reachable when gradle resolves dependencies).
//
// Without this, `npx expo prebuild --clean && npx expo run:android` fails
// during the framepayments-react-native AAR's own compile step with
// "Could not find com.prove.sdk:proveauth:6.10.3".
//
// Host apps that don't ship the `phone_verification` capability are unaffected
// at runtime — the bridge probes for the class via Class.forName and degrades
// to PROVE_UNAVAILABLE if the SDK isn't on the runtime classpath. Adding the
// repo only widens which repos gradle CAN resolve from; it doesn't pull the
// dep into the host app unless the host adds an `implementation` entry.
//
// Expo SDK 54+ declares repositories in the project-level `android/build.gradle`
// inside an `allprojects { repositories { ... } }` block — that's the primary
// target. We also patch `settings.gradle`'s `dependencyResolutionManagement`
// block for older templates / hybrid setups that route through it.

const PROVE_MAVEN_URL = 'https://prove.jfrog.io/artifactory/libs-public-maven/';
const MARKER = '// framepayments-react-native: Prove Android SDK (compileOnly).';

function injectIntoAllProjectsRepositories(contents) {
  // Match `allprojects { repositories { ... } }` and append the Prove repo
  // before the closing brace of the repositories block.
  const re = /(allprojects\s*\{[\s\S]*?repositories\s*\{)([\s\S]*?)(\n\s*\})/;
  const match = contents.match(re);
  if (!match) return null;
  const insertion = `\n    ${MARKER}\n    maven { url '${PROVE_MAVEN_URL}' }`;
  return contents.replace(re, (_full, prefix, body, suffix) => prefix + body + insertion + suffix);
}

function injectIntoDependencyResolutionManagement(contents) {
  const re = /(dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{)([\s\S]*?)(\n\s*\})/;
  const match = contents.match(re);
  if (!match) return null;
  const insertion = `\n        ${MARKER}\n        maven { url "${PROVE_MAVEN_URL}" }`;
  return contents.replace(re, (_full, prefix, body, suffix) => prefix + body + insertion + suffix);
}

const withProveProjectBuildGradle = (config) =>
  withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    const original = cfg.modResults.contents;
    if (original.includes(PROVE_MAVEN_URL)) return cfg;
    const patched = injectIntoAllProjectsRepositories(original);
    if (patched) cfg.modResults.contents = patched;
    return cfg;
  });

const withProveSettingsGradle = (config) =>
  withSettingsGradle(config, (cfg) => {
    const original = cfg.modResults.contents;
    if (original.includes(PROVE_MAVEN_URL)) return cfg;
    const patched = injectIntoDependencyResolutionManagement(original);
    if (patched) cfg.modResults.contents = patched;
    return cfg;
  });

const withFrameSettingsGradle = (config) => {
  config = withProveProjectBuildGradle(config);
  config = withProveSettingsGradle(config);
  return config;
};

module.exports = withFrameSettingsGradle;
