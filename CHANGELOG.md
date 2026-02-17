# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-17

### Added

- Initial release of `framepayments-react-native`
- `Frame.initialize({ apiKey, debugMode? })` to initialize the SDK
- `Frame.presentCheckout({ customerId?, amount })` – native checkout modal (iOS and Android)
- `Frame.presentCart({ customerId?, items, shippingAmountInCents })` – cart then checkout flow
- TypeScript types: `ChargeIntent`, `FrameCartItem`, `FrameError`, `ErrorCodes`
- Error handling: `NOT_INITIALIZED`, `USER_CANCELED`, and other standard codes
- Example app (see `example/`) demonstrating init, checkout, cart, and frame-node for listing customers
- API usage via optional peer dependency [framepayments](https://www.npmjs.com/package/framepayments) (frame-node)

### Requirements

- React Native >= 0.72
- iOS 17+ / Android API 26+
