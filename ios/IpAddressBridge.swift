//
//  IpAddressBridge.swift
//  FrameReactNative
//
//  Resolves the device's IP via getifaddrs() so the SDK can attach it to every
//  outgoing API request as the `ip_address` header. Mirrors Frame iOS's
//  SiftManager.getIPAddress() — walks the active interfaces, filters to the
//  set the native SDK uses (`en0`, `en2`, `en3`, `en4`, `pdp_ip0…3`), and
//  returns the first IPv4 or IPv6 address found.
//
//  This is intentionally synchronous: getifaddrs is cheap and JS calls it once
//  at initialize() and caches the result on the config singleton.
//

import Foundation
import React

@objc(FrameIpAddress)
public class FrameIpAddress: NSObject {

  @objc public static func requiresMainQueueSetup() -> Bool { false }

  @objc public func getIpAddress(_ resolve: @escaping RCTPromiseResolveBlock,
                                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(Self.currentIpAddress())
  }

  // Returns the first IPv4 or IPv6 address bound to one of the interfaces the
  // native Frame iOS SDK considers a "primary" device interface, or nil if no
  // candidate is found. Verbatim port of the SiftManager.getIPAddress() impl.
  private static func currentIpAddress() -> String? {
    var address: String?
    var ifaddr: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&ifaddr) == 0 else { return nil }
    guard let firstAddr = ifaddr else { return nil }
    defer { freeifaddrs(ifaddr) }

    for ifptr in sequence(first: firstAddr, next: { $0.pointee.ifa_next }) {
      let interface = ifptr.pointee
      let addrFamily = interface.ifa_addr.pointee.sa_family
      guard addrFamily == UInt8(AF_INET) || addrFamily == UInt8(AF_INET6) else { continue }

      let name = String(cString: interface.ifa_name)
      switch name {
      case "en0", "en2", "en3", "en4", "pdp_ip0", "pdp_ip1", "pdp_ip2", "pdp_ip3":
        var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        getnameinfo(interface.ifa_addr,
                    socklen_t(interface.ifa_addr.pointee.sa_len),
                    &hostname,
                    socklen_t(hostname.count),
                    nil,
                    socklen_t(0),
                    NI_NUMERICHOST)
        address = String(cString: hostname)
      default:
        continue
      }
    }
    return address
  }
}
