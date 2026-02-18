//
//  FramePreloader.swift
//  FrameReactNative
//
//  Preloads the Frame module on the main thread BEFORE the React Native bridge
//  initializes. This avoids "Helpers are not supported by the default hub" crash
//  that occurs when Frame/Evervault/Sift load on a background thread during
//  bridge module discovery.
//

import Foundation
import Frame

@objc(FramePreloader)
public final class FramePreloader: NSObject {

    /// Call from AppDelegate before [super application:didFinishLaunchingWithOptions].
    /// Forces Frame (and its deps: Evervault, Sift) to load on main thread.
    @objc public static func preloadOnMainThread() {
        guard Thread.isMainThread else {
            DispatchQueue.main.sync { preloadOnMainThread() }
            return
        }
        // Touch FrameNetworking to trigger Frame module load on main thread.
        // Evervault/Sift config is deferred to initializeWithAPIKey.
        _ = FrameNetworking.shared
    }
}
