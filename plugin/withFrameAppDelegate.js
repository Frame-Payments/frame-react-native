const { withAppDelegate, WarningAggregator } = require('@expo/config-plugins');

const PLUGIN_NAME = 'framepayments-react-native';
const SENTINEL = '@generated framepayments-react-native preload';

const SWIFT_IMPORT = 'import FrameReactNative';
const SWIFT_CALL = 'FramePreloader.preloadOnMainThread()';
const OBJC_IMPORT = '#import <FrameReactNative/FramePreloader.h>';
const OBJC_CALL = '[FramePreloader preloadOnMainThread];';

const SWIFT_FUNC_RE =
  /(?:override\s+)?func\s+application\s*\(\s*_\s+application\s*:\s*UIApplication\s*,\s*didFinishLaunchingWithOptions[\s\S]*?->\s*Bool\s*\{/;
const OBJC_FUNC_RE =
  /-\s*\(BOOL\)\s*application\s*:\s*\(UIApplication\s*\*\)\s*\w+\s+didFinishLaunchingWithOptions\s*:[\s\S]*?\{/;

function alreadyPatched(contents) {
  return (
    contents.includes(SENTINEL) ||
    contents.includes('FramePreloader.preloadOnMainThread') ||
    contents.includes('[FramePreloader preloadOnMainThread]')
  );
}

function patchSwift(contents) {
  let next = contents;

  if (!/^\s*import\s+FrameReactNative\b/m.test(next)) {
    const importMatches = [...next.matchAll(/^\s*import\s+[^\n]+\n/gm)];
    if (importMatches.length > 0) {
      const last = importMatches[importMatches.length - 1];
      const insertAt = last.index + last[0].length;
      next = next.slice(0, insertAt) + SWIFT_IMPORT + '\n' + next.slice(insertAt);
    } else {
      next = SWIFT_IMPORT + '\n' + next;
    }
  }

  const match = SWIFT_FUNC_RE.exec(next);
  if (!match) return null;
  const insertAt = match.index + match[0].length;
  const injection = `\n    // ${SENTINEL}\n    ${SWIFT_CALL}`;
  next = next.slice(0, insertAt) + injection + next.slice(insertAt);
  return next;
}

function patchObjc(contents) {
  let next = contents;

  if (!next.includes('FrameReactNative/FramePreloader.h')) {
    const importMatches = [...next.matchAll(/^\s*#import\s+[^\n]+\n/gm)];
    if (importMatches.length > 0) {
      const last = importMatches[importMatches.length - 1];
      const insertAt = last.index + last[0].length;
      next = next.slice(0, insertAt) + OBJC_IMPORT + '\n' + next.slice(insertAt);
    } else {
      next = OBJC_IMPORT + '\n' + next;
    }
  }

  const match = OBJC_FUNC_RE.exec(next);
  if (!match) return null;
  const insertAt = match.index + match[0].length;
  const injection = `\n  // ${SENTINEL}\n  ${OBJC_CALL}`;
  next = next.slice(0, insertAt) + injection + next.slice(insertAt);
  return next;
}

const withFrameAppDelegate = (config) =>
  withAppDelegate(config, (mod) => {
    const { language, contents } = mod.modResults;
    if (alreadyPatched(contents)) return mod;

    const patched =
      language === 'swift' ? patchSwift(contents) : patchObjc(contents);

    if (patched == null) {
      WarningAggregator.addWarningIOS(
        PLUGIN_NAME,
        'Could not auto-inject FramePreloader into AppDelegate. Add `FramePreloader.preloadOnMainThread()` (Swift) or `[FramePreloader preloadOnMainThread];` (Obj-C) as the first statement of application(_:didFinishLaunchingWithOptions:) manually.'
      );
      return mod;
    }

    mod.modResults.contents = patched;
    return mod;
  });

module.exports = withFrameAppDelegate;
