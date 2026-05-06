//
//  FrameSDKBridge.m
//  FrameReactNative
//
//  ObjC adapter that forwards to Swift FrameSDKBridge.
//

#import <React/RCTBridgeModule.h>
#import "FrameVCHelper.h"

// Import app's Swift header (ObjCFrameSDKBridge, FramePreloader). The example uses FrameExampleTemp.
// If your app has a different module name, add Preprocessor Macro: FRAME_SWIFT_HEADER="YourApp-Swift.h"
#if defined(FRAME_SWIFT_HEADER)
#import FRAME_SWIFT_HEADER
#elif __has_include("FrameExampleTemp-Swift.h")
#import "FrameExampleTemp-Swift.h"
#elif __has_include(<FrameExampleTemp/FrameExampleTemp-Swift.h>)
#import <FrameExampleTemp/FrameExampleTemp-Swift.h>
#else
#error "Swift header not found. Add FRAME_SWIFT_HEADER=\"YourApp-Swift.h\" to your app target's Preprocessor Macros, or ensure Swift files compile before this file."
#endif

@interface FrameSDKModule : NSObject <RCTBridgeModule>
@end

@interface RCT_EXTERN_MODULE(FrameSDK, FrameSDKModule)

RCT_EXTERN_METHOD(initialize:(NSString *)secretKey
                  publishableKey:(NSString *)publishableKey
                  debugMode:(BOOL)debugMode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setTheme:(NSDictionary *)theme
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

RCT_EXTERN_METHOD(presentOnboarding:(id)accountId
                  capabilities:(NSArray *)capabilities
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentOnboardingWithApplePay:(id)accountId
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

- (void)initialize:(NSString *)secretKey publishableKey:(NSString *)publishableKey debugMode:(BOOL)debugMode resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  [[[ObjCFrameSDKBridge alloc] init] initialize:secretKey publishableKey:publishableKey debugMode:debugMode resolver:resolve rejecter:reject];
}

- (void)setTheme:(NSDictionary *)theme resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  [[[ObjCFrameSDKBridge alloc] init] setTheme:theme resolver:resolve rejecter:reject];
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
    [[[ObjCFrameSDKBridge alloc] init] presentCartFrom:topVC customerId:customerId items:items shippingAmountInCents:shippingAmountInCents.integerValue resolver:resolve rejecter:reject];
  });
}

- (void)presentOnboarding:(id)accountId capabilities:(NSArray *)capabilities resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *topVC = FrameGetTopViewController();
    if (!topVC) {
      reject(@"NO_ROOT_VC", @"Could not find root view controller to present onboarding", nil);
      return;
    }
    [[[ObjCFrameSDKBridge alloc] init] presentOnboardingFrom:topVC accountId:accountId capabilities:capabilities resolver:resolve rejecter:reject];
  });
}

- (void)presentOnboardingWithApplePay:(id)accountId capabilities:(NSArray *)capabilities applePayMerchantId:(id)applePayMerchantId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *topVC = FrameGetTopViewController();
    if (!topVC) {
      reject(@"NO_ROOT_VC", @"Could not find root view controller to present onboarding", nil);
      return;
    }
    [[[ObjCFrameSDKBridge alloc] init] presentOnboardingWithApplePayFrom:topVC accountId:accountId capabilities:capabilities applePayMerchantId:applePayMerchantId resolver:resolve rejecter:reject];
  });
}

- (void)presentApplePay:(NSString *)ownerType ownerId:(NSString *)ownerId amount:(NSNumber *)amount currency:(NSString *)currency merchantId:(NSString *)merchantId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject {
  [[[ObjCFrameSDKBridge alloc] init] presentApplePay:ownerType ownerId:ownerId amount:amount.intValue currency:currency merchantId:merchantId resolver:resolve rejecter:reject];
}

@end
