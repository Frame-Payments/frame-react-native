/**
 * Unit tests for the native module bridge (initialize, presentCheckout, presentCart).
 * NativeModules.FrameSDK is mocked.
 */

const mockInitialize = jest.fn((_apiKey: string, _debugMode: boolean) => Promise.resolve());
const mockPresentCheckout = jest.fn((_customerId: unknown, _amount: number) => Promise.resolve({ id: 'ci_1', amount: 10000 }));
const mockPresentCart = jest.fn((_customerId: unknown, _items: unknown[], _shipping: number) => Promise.resolve({ id: 'ci_2', amount: 15000 }));

jest.mock('react-native', () => ({
  NativeModules: {
    FrameSDK: {
      initialize: mockInitialize,
      presentCheckout: mockPresentCheckout,
      presentCart: mockPresentCart,
    },
  },
}));

// Re-import after mock so we get the mocked NativeModules
let initialize: (opts: { apiKey: string; debugMode?: boolean }) => void;
let presentCheckout: (opts: { customerId?: string | null; amount: number }) => Promise<unknown>;
let presentCart: (opts: {
  customerId?: string | null;
  items: Array<{ id: string; title: string; amountInCents: number; imageUrl: string }>;
  shippingAmountInCents: number;
}) => Promise<unknown>;

beforeEach(() => {
  jest.resetModules();
  mockInitialize.mockClear();
  mockPresentCheckout.mockClear();
  mockPresentCart.mockClear();
  const native = require('../native');
  initialize = native.initialize;
  presentCheckout = native.presentCheckout;
  presentCart = native.presentCart;
});

describe('initialize', () => {
  it('calls native FrameSDK.initialize with apiKey and debugMode', () => {
    initialize({ apiKey: 'sk_test_xxx', debugMode: true });
    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockInitialize).toHaveBeenCalledWith('sk_test_xxx', true);
  });

  it('defaults debugMode to false', () => {
    initialize({ apiKey: 'sk_test_yyy' });
    expect(mockInitialize).toHaveBeenCalledWith('sk_test_yyy', false);
  });

  it('throws if apiKey is missing', () => {
    expect(() => initialize({ apiKey: '' })).toThrow();
    expect(() => (initialize as any)({})).toThrow();
    expect(mockInitialize).not.toHaveBeenCalled();
  });
});

describe('presentCheckout', () => {
  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentCheckout({ amount: 10000 });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
      expect(e.message).toContain('initialized');
    }
    expect(mockPresentCheckout).not.toHaveBeenCalled();
  });

  it('calls native presentCheckout with customerId and amount after initialize', async () => {
    initialize({ apiKey: 'sk_xxx' });
    const result = await presentCheckout({ customerId: 'cus_1', amount: 10000 });
    expect(mockPresentCheckout).toHaveBeenCalledWith('cus_1', 10000);
    expect(result).toEqual({ id: 'ci_1', amount: 10000 });
  });

  it('passes null for customerId when not provided', async () => {
    initialize({ apiKey: 'sk_xxx' });
    await presentCheckout({ amount: 5000 });
    expect(mockPresentCheckout).toHaveBeenCalledWith(null, 5000);
  });
});

describe('presentCart', () => {
  const items = [
    { id: '1', title: 'Item A', amountInCents: 1000, imageUrl: 'https://example.com/a.jpg' },
  ];

  it('throws NOT_INITIALIZED if initialize was not called', async () => {
    try {
      await presentCart({ items, shippingAmountInCents: 500 });
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe('NOT_INITIALIZED');
    }
    expect(mockPresentCart).not.toHaveBeenCalled();
  });

  it('calls native presentCart with customerId, items, shipping after initialize', async () => {
    initialize({ apiKey: 'sk_xxx' });
    const result = await presentCart({
      customerId: 'cus_2',
      items,
      shippingAmountInCents: 500,
    });
    expect(mockPresentCart).toHaveBeenCalledWith('cus_2', items, 500);
    expect(result).toEqual({ id: 'ci_2', amount: 15000 });
  });

  it('passes null for customerId when not provided', async () => {
    initialize({ apiKey: 'sk_xxx' });
    await presentCart({ items, shippingAmountInCents: 0 });
    expect(mockPresentCart).toHaveBeenCalledWith(null, items, 0);
  });
});
