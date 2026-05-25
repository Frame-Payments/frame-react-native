#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FrameApplePay, NSObject)

RCT_EXTERN_METHOD(canMakeApplePay:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(presentApplePay:(NSDictionary *)args
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(finishApplePay:(NSString *)status
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// PKPaymentAuthorizationController must be allocated + presented from the
// main thread. The Swift implementation wraps every public call in
// DispatchQueue.main.async, but RN may invoke the first method on a
// background queue if requiresMainQueueSetup is false. Defensively require
// main-queue setup.
+ (BOOL)requiresMainQueueSetup { return YES; }

@end
