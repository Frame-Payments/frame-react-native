#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>

// Preload Frame on main thread before bridge starts - avoids "Helpers are not supported by the default hub" crash
#import "FrameExampleTemp-Swift.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Load Frame/Evervault/Sift on main thread BEFORE bridge init (which loads modules on bg thread)
  [FramePreloader preloadOnMainThread];

  self.moduleName = @"FrameExampleTemp";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
