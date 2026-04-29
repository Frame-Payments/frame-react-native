//
//  FrameApplePayButtonViewManager.m
//  FrameReactNative
//
//  ObjC bridge for FrameApplePayButtonViewManager (Swift).
//

#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(FrameApplePayButtonViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(amount, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(currency, NSString)
RCT_EXPORT_VIEW_PROPERTY(owner, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(merchantId, NSString)
RCT_EXPORT_VIEW_PROPERTY(addCheckoutDivider, BOOL)
RCT_EXPORT_VIEW_PROPERTY(buttonType, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(onResult, RCTDirectEventBlock)

@end
