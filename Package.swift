// swift-tools-version: 5.9
// Distribution paths:
//   • Pure-SPM consumers: add framepayments-react-native via Swift Package Manager;
//     frame-ios resolves transitively from this manifest.
//   • CocoaPods consumers (the common RN setup): the podspec at
//     ios/FrameReactNative.podspec declares the same frame-ios SPM dependency via
//     RN 0.81+'s `spm_dependency` Podfile hook, so `pod install` resolves it
//     automatically — no Xcode "Add Package Dependencies" step required.
//
// IMPORTANT: keep the frame-ios version below in sync with
// package.json:frameNativeVersions.ios. Swift Package manifests cannot read JSON,
// so this is the one duplicated version pin. See MAINTAINING.md.

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
            from: "3.0.2" // Keep in sync with package.json:frameNativeVersions.ios
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
