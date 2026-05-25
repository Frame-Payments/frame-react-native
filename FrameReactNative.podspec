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

  s.dependency 'React-Core'

  # ProveAuth (used by ProveAuthBridge for the optional phone-verification
  # Prove flow) is NOT declared here — the bridge is wrapped in
  # `#if canImport(ProveAuth)` so the library compiles without it. Host apps
  # that ship onboarding with the phone_verification capability must add the
  # pod themselves, using the cocoapods-art jfrog source the Expo config
  # plugin already wires:
  #   pod 'ProveAuth'

  install_modules_dependencies(s) if respond_to?(:install_modules_dependencies, true)
end
