// swift-tools-version: 5.9
// RN 0.73+ supports SPM-based native modules. Apps that add framepayments-react-native
// via Swift Package Manager will have Frame and FrameOnboarding resolved automatically —
// no manual Xcode "Add Package Dependencies" step required.
//
// CocoaPods users: continue using ios/FrameReactNative.podspec as before, and add
// frame-ios manually via Xcode (File → Add Package Dependencies →
// https://github.com/Frame-Payments/frame-ios).

import PackageDescription

let package = Package(
    name: "framepayments-react-native",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "framepayments-react-native",
            targets: ["framepayments-react-native"]
        )
    ],
    dependencies: [
        .package(
            url: "https://github.com/Frame-Payments/frame-ios",
            from: "2.1.2"
        )
    ],
    targets: [
        .target(
            name: "framepayments-react-native",
            dependencies: [
                .product(name: "Frame-iOS", package: "frame-ios"),
                .product(name: "Frame-Onboarding", package: "frame-ios")
            ],
            path: "ios",
            publicHeadersPath: ".",
            cSettings: [
                .headerSearchPath(".")
            ]
        )
    ]
)
