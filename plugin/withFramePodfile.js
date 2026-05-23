const { withPodfile, WarningAggregator } = require('@expo/config-plugins');

const PLUGIN_NAME = 'framepayments-react-native';
const SENTINEL_POST_INSTALL = '@generated framepayments-react-native post_install';
const SENTINEL_PROVE_PLUGIN = '@generated framepayments-react-native prove_plugin';

// Build settings applied to every pod in the project. Required for any RN
// 0.81+ host that pulls in React-Core via CocoaPods:
//
// - C++20 for ReactCommon and all React-* pods; C++17 only for `fmt` (Apple
//   Clang rejects `consteval basic_format_string` in C++20).
// - FOLLY_CFG_NO_COROUTINES=1 — RN ships RCT-Folly without coro headers; any
//   pod transitively including Optional.h / Expected.h fails without this.
// - FMT_USE_CONSTEVAL=0 — forces fmt 11+ to fall back to constexpr
//   basic_format_string, which Apple Clang on Xcode 15/16 accepts.
//
// CocoaPods 1.10+ forbids multiple post_install blocks per target, so this
// block appends INSIDE the existing post_install body.
const POST_INSTALL_BODY = `
    # ${SENTINEL_POST_INSTALL}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        if target.name == 'fmt'
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        else
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
        end
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        unless config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'].include?('FOLLY_CFG_NO_COROUTINES=1')
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_CFG_NO_COROUTINES=1'
        end
        unless config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'].include?('FMT_USE_CONSTEVAL=0')
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FMT_USE_CONSTEVAL=0'
        end
      end
    end
`;

// Prove's ProveAuth SDK is distributed via Prove's Artifactory CocoaPods spec
// repo rather than CocoaPods trunk. The `cocoapods-art` plugin teaches
// CocoaPods to resolve from it. Host apps that include the SDK must run:
//
//   gem install cocoapods-art
//   pod repo-art add prove.jfrog.io https://prove.jfrog.io/artifactory/api/pods/libs-public-cocoapods
//
// Once the Podfile declares any non-default source, CocoaPods stops auto-using
// trunk — so the explicit `source 'https://cdn.cocoapods.org/'` line is also
// required, or transitive deps that live on trunk fail to resolve.
const PROVE_PLUGIN_LINE = `# ${SENTINEL_PROVE_PLUGIN}\nsource 'https://cdn.cocoapods.org/'\nplugin 'cocoapods-art', :sources => ['prove.jfrog.io']\n\n`;

function alreadyPatched(contents, sentinel) {
  return contents.includes(sentinel);
}

function patchProvePlugin(contents) {
  if (alreadyPatched(contents, SENTINEL_PROVE_PLUGIN)) return contents;
  return PROVE_PLUGIN_LINE + contents;
}

function patchPostInstall(contents) {
  if (alreadyPatched(contents, SENTINEL_POST_INSTALL)) return contents;

  const openRe = /^([ \t]*)post_install\s+do\s*\|installer\|\s*$/m;
  const open = openRe.exec(contents);
  if (!open) return null;

  const indent = open[1];
  const blockStart = open.index + open[0].length;
  const closeRe = new RegExp(`^${indent}end\\s*$`, 'm');
  closeRe.lastIndex = blockStart;
  const rest = contents.slice(blockStart);
  const closeMatch = closeRe.exec(rest);
  if (!closeMatch) return null;

  const insertAt = blockStart + closeMatch.index;
  return contents.slice(0, insertAt) + POST_INSTALL_BODY + contents.slice(insertAt);
}

const withFramePodfile = (config) =>
  withPodfile(config, (mod) => {
    let contents = mod.modResults.contents;
    const failures = [];

    const afterProvePlugin = patchProvePlugin(contents);
    if (afterProvePlugin == null) failures.push('prove_plugin');
    else contents = afterProvePlugin;

    const afterPostInstall = patchPostInstall(contents);
    if (afterPostInstall == null) failures.push('post_install');
    else contents = afterPostInstall;

    if (failures.length > 0) {
      WarningAggregator.addWarningIOS(
        PLUGIN_NAME,
        `Could not auto-inject Frame Podfile patches: ${failures.join(', ')}. See example/ios/Podfile for the canonical pattern.`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });

module.exports = withFramePodfile;
