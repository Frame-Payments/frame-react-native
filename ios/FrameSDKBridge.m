//
//  FrameSDKBridge.m
//  FrameReactNative
//
//  ObjC adapter that forwards to Swift FrameSDKBridge.
//

#import <React/RCTBridgeModule.h>
#import "FrameVCHelper.h"

#if __has_include("FrameExampleTemp-Swift.h")
#import "FrameExampleTemp-Swift.h"
#elif __has_include(<FrameExampleTemp/FrameExampleTemp-Swift.h>)
#import <FrameExampleTemp/FrameExampleTemp-Swift.h>
#else
#error "FrameExampleTemp-Swift.h not found - ensure Swift files compile before this file"
#endif

@interface FrameSDKModule : NSObject <RCTBridgeModule>
@end

@interface RCT_EXTERN_MODULE(FrameSDK, FrameSDKModule)

RCT_EXTERN_METHOD(initialize:(NSString *)apiKey
                  debugMode:(BOOL)debugMode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentCheckout:(id)customerId
                  amount:(nonnull NSNumber *)amount
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentCart:(id)customerId
                  items:(NSArray *)items
                  shippingAmountInCents:(nonnull NSNumber *)shippingAmountInCents
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

@implementation FrameSDK
@end

@implementation FrameSDKModule

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (void)initialize:(NSString *)apiKey debugMode:(BOOL)debugMode resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  [[[ObjCFrameSDKBridge alloc] init] initialize:apiKey debugMode:debugMode resolver:resolve rejecter:reject];
}

- (void)presentCheckout:(id)customerId amount:(NSNumber *)amount resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *topVC = FrameGetTopViewController();
    if (!topVC) {
      reject(@"NO_ROOT_VC", @"Could not find root view controller to present checkout", nil);
      return;
    }
    NSString *cId = [customerId isKindOfClass:[NSString class]] ? (NSString *)customerId : nil;
    [[[ObjCFrameSDKBridge alloc] init] presentCheckoutFrom:topVC customerId:cId amount:amount.intValue resolver:resolve rejecter:reject];
  });
}

- (void)presentCart:(id)customerId items:(NSArray *)items shippingAmountInCents:(NSNumber *)shippingAmountInCents resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *topVC = FrameGetTopViewController();
    if (!topVC) {
      reject(@"NO_ROOT_VC", @"Could not find root view controller to present cart", nil);
      return;
    }
    [[[ObjCFrameSDKBridge alloc] init] presentCartFrom:topVC customerId:customerId items:items shippingAmountInCents:shippingAmountInCents resolver:resolve rejecter:reject];
  });
}

@end
