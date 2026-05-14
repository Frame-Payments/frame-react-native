//
//  FramePreloader.h
//  FrameReactNative
//
//  Public Obj-C interface for the Swift `FramePreloader` class. Lets consumers
//  reach `+[FramePreloader preloadOnMainThread]` from AppDelegate.mm (or any
//  .m/.mm file) via `#import "FramePreloader.h"`, without needing modules
//  enabled in C++ context.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface FramePreloader : NSObject

/// Call from AppDelegate before [super application:didFinishLaunchingWithOptions:].
/// Forces Frame (and its deps: Evervault, Sift) to load on the main thread.
+ (void)preloadOnMainThread;

@end

NS_ASSUME_NONNULL_END
