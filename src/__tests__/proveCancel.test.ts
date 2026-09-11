jest.mock('react-native', () => ({
  NativeModules: {},
  NativeEventEmitter: class {},
  Platform: { OS: 'ios' },
}));

import { cancelProveOtp, consumeProveCancelledByUser } from '../prove';

describe('consumeProveCancelledByUser', () => {
  it('is false before any cancel', () => {
    expect(consumeProveCancelledByUser()).toBe(false);
  });

  it('reports a cancel exactly once, then clears', () => {
    return cancelProveOtp().then(() => {
      expect(consumeProveCancelledByUser()).toBe(true);
      expect(consumeProveCancelledByUser()).toBe(false);
    });
  });
});
