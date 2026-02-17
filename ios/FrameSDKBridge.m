//
//  FrameSDKBridge.m
//  FrameReactNative
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FrameSDK, FrameSDKBridge)

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
