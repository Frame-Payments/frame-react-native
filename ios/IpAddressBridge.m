#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FrameIpAddress, NSObject)

RCT_EXTERN_METHOD(getIpAddress:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup { return NO; }

@end
