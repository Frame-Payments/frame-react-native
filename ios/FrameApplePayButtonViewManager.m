#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>

// RN's legacy view-manager name stripping (and the Fabric interop lookup)
// derives the JS component name by stripping "Manager" from the moduleName.
// With the default class name `FrameApplePayButtonViewManager`, the stripped
// name is `FrameApplePayButtonView`, which doesn't match the JS-side
// `requireNativeComponent('FrameApplePayButton')`. REMAP forces the JS name
// explicitly so both old-arch and Fabric-interop registries resolve it.
@interface RCT_EXTERN_REMAP_MODULE(FrameApplePayButton, FrameApplePayButtonViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(buttonStyle, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonType, NSString)
RCT_EXPORT_VIEW_PROPERTY(cornerRadius, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(onPress, RCTBubblingEventBlock)

@end
