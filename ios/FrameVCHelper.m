//
//  FrameVCHelper.m
//  FrameReactNative
//

#import "FrameVCHelper.h"
#import <React/RCTUtils.h>

UIViewController * _Nullable FrameGetTopViewController(void) {
  return RCTPresentedViewController();
}
