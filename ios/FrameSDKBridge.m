//
//  FrameSDKBridge.m
//  FrameReactNative
//
//  ObjC adapter that forwards to Swift FrameSDKBridge.
//

#import <React/RCTBridgeModule.h>
#import "FrameVCHelper.h"

// Import the FrameReactNative pod's auto-generated Swift header so this Obj-C
// file can reach the Swift `ObjCFrameSDKBridge` class. CocoaPods generates
// "FrameReactNative-Swift.h" from the pod's Swift sources during the pod's
// build phase.
#if __has_include("FrameReactNative-Swift.h")
#import "FrameReactNative-Swift.h"
#elif __has_include(<FrameReactNative/FrameReactNative-Swift.h>)
#import <FrameReactNative/FrameReactNative-Swift.h>
#else
#error "FrameReactNative-Swift.h not found. The Frame React Native pod's Swift code did not generate its module header — check that pod install ran cleanly."
#endif

@interface FrameSDKModule : NSObject <RCTBridgeModule>
@end

@interface RCT_EXTERN_MODULE(FrameSDK, FrameSDKModule)

RCT_EXTERN_METHOD(initialize:(NSString *)secretKey
                  publishableKey:(NSString *)publishableKey
                  debugMode:(BOOL)debugMode
                  theme:(NSDictionary *)theme
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentCheckout:(id)accountId
                  amount:(nonnull NSNumber *)amount
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentCart:(id)accountId
                  items:(NSArray *)items
                  shippingAmountInCents:(nonnull NSNumber *)shippingAmountInCents
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentOnboarding:(id)accountId
                  capabilities:(NSArray *)capabilities
                  applePayMerchantId:(id)applePayMerchantId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentApplePay:(NSString *)ownerType
                  ownerId:(NSString *)ownerId
                  amount:(nonnull NSNumber *)amount
                  currency:(NSString *)currency
                  merchantId:(NSString *)merchantId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

@implementation FrameSDK
@end

@implementation FrameSDKModule

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (void)initialize:(NSString *)secretKey publishableKey:(NSString *)publishableKey debugMode:(BOOL)debugMode theme:(NSDictionary *)theme resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  [[[ObjCFrameSDKBridge alloc] init] initialize:secretKey publishableKey:publishableKey debugMode:debugMode theme:theme resolver:resolve rejecter:reject];
}

- (void)presentCheckout:(id)accountId amount:(NSNumber *)amount resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *topVC = FrameGetTopViewController();
    if (!topVC) {
      reject(@"NO_ROOT_VC", @"Could not find root view controller to present checkout", nil);
      return;
    }
    NSString *aId = [accountId isKindOfClass:[NSString class]] ? (NSString *)accountId : nil;
    [[[ObjCFrameSDKBridge alloc] init] presentCheckoutFrom:topVC accountId:aId amount:amount.intValue resolver:resolve rejecter:reject];
  });
}

- (void)presentCart:(id)accountId items:(NSArray *)items shippingAmountInCents:(NSNumber *)shippingAmountInCents resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *topVC = FrameGetTopViewController();
    if (!topVC) {
      reject(@"NO_ROOT_VC", @"Could not find root view controller to present cart", nil);
      return;
    }
    [[[ObjCFrameSDKBridge alloc] init] presentCartFrom:topVC accountId:accountId items:items shippingAmountInCents:shippingAmountInCents.integerValue resolver:resolve rejecter:reject];
  });
}

- (void)presentOnboarding:(id)accountId capabilities:(NSArray *)capabilities applePayMerchantId:(id)applePayMerchantId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *topVC = FrameGetTopViewController();
    if (!topVC) {
      reject(@"NO_ROOT_VC", @"Could not find root view controller to present onboarding", nil);
      return;
    }
    [[[ObjCFrameSDKBridge alloc] init] presentOnboardingFrom:topVC accountId:accountId capabilities:capabilities applePayMerchantId:applePayMerchantId resolver:resolve rejecter:reject];
  });
}

- (void)presentApplePay:(NSString *)ownerType ownerId:(NSString *)ownerId amount:(NSNumber *)amount currency:(NSString *)currency merchantId:(NSString *)merchantId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  [[[ObjCFrameSDKBridge alloc] init] presentApplePay:ownerType ownerId:ownerId amount:amount.intValue currency:currency merchantId:merchantId resolver:resolve rejecter:reject];
}

@end
