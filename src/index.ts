/**
 * framepayments-react-native
 *
 * React Native SDK for Frame Payments.
 * - Initialize the SDK, then use presentCheckout / presentCart for payment UI.
 * - For API calls (customers, charge intents, refunds), use the framepayments (frame-node) package from JS.
 */

export { initialize, presentCheckout, presentCart } from './native';
export type { FrameCartItem, ChargeIntent, FrameError } from './types';
export { ErrorCodes } from './errors';
export type { FrameErrorShape, FrameErrorCode } from './errors';
