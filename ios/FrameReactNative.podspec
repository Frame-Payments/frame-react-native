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

  # Frame-iOS SDK – must be available to the app. Add via Swift Package Manager in Xcode:
  # File → Add Package Dependencies → https://github.com/Frame-Payments/frame-ios
  # Our native code imports Frame; ensure the app target links Frame-iOS (SPM).
  # If Frame-iOS is provided as a pod in the future, uncomment:
  # s.dependency 'Frame-iOS'

  install_modules_dependencies(s) if respond_to?(:install_modules_dependencies)
end
