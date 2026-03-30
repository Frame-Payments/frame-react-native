require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'FrameReactNative'
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = package['homepage']
  s.license      = package['license']
  s.authors      = package['author']
  s.platforms    = { :ios => '17.0' }
  s.source       = { :git => package['repository']['url'], :tag => "#{s.version}" }
  s.source_files = '**/*.{h,m,mm,swift}'
  s.requires_arc = true

  s.dependency 'React-Core'

  # Frame-iOS SDK (Frame + FrameOnboarding) must be available to the app.
  #
  # SPM users (RN >= 0.73): add framepayments-react-native via Swift Package Manager.
  # Frame and FrameOnboarding are declared as dependencies in Package.swift and resolve
  # automatically — no manual step required.
  #
  # CocoaPods users: add frame-ios manually via Xcode:
  #   File → Add Package Dependencies → https://github.com/Frame-Payments/frame-ios
  #   Add both the "Frame-iOS" and "Frame-Onboarding" products to your app target.
  # If Frame-iOS is published as a pod in the future, replace the above with:
  # s.dependency 'Frame-iOS'

  install_modules_dependencies(s) if respond_to?(:install_modules_dependencies)
end
