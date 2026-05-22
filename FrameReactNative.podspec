require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'FrameReactNative'
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = package['homepage']
  s.license      = package['license']
  s.authors      = package['author']
  s.platforms    = { :ios => '17.0' }
  s.source       = { :git => package['repository']['url'], :tag => "#{s.version}" }
  s.source_files = 'ios/**/*.{h,m,mm,swift}'
  s.requires_arc = true

  # static_framework exposes the pod's generated `FrameReactNative-Swift.h` to
  # consumers — required so host AppDelegate.mm can `#import <FrameReactNative/FrameReactNative-Swift.h>`
  # to reach `FramePreloader`.
  s.static_framework = true

  s.dependency 'React-Core'

  # Autolink Frame-iOS (SPM-only) via RN 0.81+'s Podfile SPM hook. spm.rb injects
  # XCRemoteSwiftPackageReferences into Pods.xcodeproj at react_native_post_install;
  # consumers get Frame-iOS + Frame-Onboarding resolved by `pod install` alone.
  #
  # The respond_to? guards use `include_private: true` because both helpers are
  # top-level Ruby `def`s in react_native_pods.rb — i.e. private methods of Object.
  # The guards exist not for RN-version compatibility (peer dep is >= 0.81) but
  # because the RN CLI loads this podspec STANDALONE for autolinking discovery,
  # outside the Podfile's `require 'react_native_pods.rb'` context where the
  # helpers are defined. Without guards, `npx react-native config` would crash
  # and return `ios: null`, breaking `use_native_modules!`.
  #
  # Escape hatch: set FRAME_RN_SKIP_SPM=1 in the env (or `ENV['FRAME_RN_SKIP_SPM'] = '1'`
  # at the top of the host Podfile) to disable SPM injection. Consumers who prefer
  # CocoaPods then declare `pod 'Frame-iOS'` and `pod 'Frame-Onboarding'` directly
  # in their Podfile — see README "iOS setup → Using CocoaPods instead of SPM".
  if respond_to?(:spm_dependency, true) && !ENV['FRAME_RN_SKIP_SPM']
    spm_dependency(s,
      url: 'https://github.com/Frame-Payments/frame-ios',
      requirement: { kind: 'upToNextMajorVersion', minimumVersion: package['frameNativeVersions']['ios'] },
      products: ['Frame-iOS', 'Frame-Onboarding']
    )
  end

  install_modules_dependencies(s) if respond_to?(:install_modules_dependencies, true)
end
