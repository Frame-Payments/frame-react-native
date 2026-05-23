#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>

@interface RCT_EXTERN_MODULE(FrameApplePayButtonViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(buttonStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonType, NSString)
RCT_EXPORT_VIEW_PROPERTY(cornerRadius, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(onPress, RCTBubblingEventBlock)

@end
