jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mockElectPayoutMethod = jest.fn();
class MockFrameAPIError extends Error {
  constructor(message: string, public code: string, public status: number, public raw: unknown) {
    super(message);
    this.name = 'FrameAPIError';
  }
}
jest.mock('framepayments', () => {
  class MockFrameSDK {
    accounts = { electPayoutMethod: (accountId: string, paymentMethodId: string) =>
      mockElectPayoutMethod(accountId, paymentMethodId) };
    constructor(_config: unknown) {}
  }
  return { FrameSDK: MockFrameSDK, FrameAPIError: MockFrameAPIError };
});

import { setConfig, resetConfig } from '../config';
import { resetClients } from '../client';
import { electPayoutMethod } from '../payoutMethod';

beforeEach(() => {
  resetConfig();
  resetClients();
  setConfig({ publishableKey: 'pk_test_x', debugMode: false });
  mockElectPayoutMethod.mockClear();
});

describe('electPayoutMethod', () => {
  it('calls the SDK with the account and payment method ids', async () => {
    mockElectPayoutMethod.mockResolvedValueOnce({ id: 'acct_1' });
    await electPayoutMethod('acct_1', 'pm_1');
    expect(mockElectPayoutMethod).toHaveBeenCalledWith('acct_1', 'pm_1');
  });

  it('returns the paymentMethodId passed in, since Account has no payout field to read back', async () => {
    mockElectPayoutMethod.mockResolvedValueOnce({ id: 'acct_1' });
    await expect(electPayoutMethod('acct_1', 'pm_1')).resolves.toBe('pm_1');
  });

  it('translates a plain rejection into API_NETWORK', async () => {
    mockElectPayoutMethod.mockRejectedValueOnce(new Error('offline'));
    await expect(electPayoutMethod('acct_1', 'pm_1')).rejects.toMatchObject({ code: 'API_NETWORK' });
  });

  it('translates a transport-level FrameAPIError (status 0) into API_NETWORK', async () => {
    mockElectPayoutMethod.mockRejectedValueOnce(new MockFrameAPIError('offline', 'network_error', 0, null));
    await expect(electPayoutMethod('acct_1', 'pm_1')).rejects.toMatchObject({ code: 'API_NETWORK' });
  });

  it('translates a real HTTP error FrameAPIError into API_ERROR', async () => {
    mockElectPayoutMethod.mockRejectedValueOnce(new MockFrameAPIError('unprocessable', 'api_error', 422, null));
    await expect(electPayoutMethod('acct_1', 'pm_1')).rejects.toMatchObject({ code: 'API_ERROR' });
  });
});
