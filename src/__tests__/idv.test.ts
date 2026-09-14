jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mockCreateSession = jest.fn();
const mockCompleteSession = jest.fn();
class MockFrameAPIError extends Error {
  constructor(message: string, public code: string, public status: number, public raw: unknown) {
    super(message);
    this.name = 'FrameAPIError';
  }
}
jest.mock('framepayments', () => {
  class MockFrameSDK {
    idv = {
      createSession: () => mockCreateSession(),
      completeSession: (inquiryId: string) => mockCompleteSession(inquiryId),
    };
    setOnboardingSession = jest.fn();
    clearOnboardingSession = jest.fn(() => true);
    constructor(_config: unknown) {}
  }
  return { FrameSDK: MockFrameSDK, FrameAPIError: MockFrameAPIError };
});

import { setConfig, resetConfig } from '../config';
import { resetClients } from '../client';
import { beginOnboardingSession, __resetOnboardingSessionForTests } from '../auth';
import { completeIdvSessionDetailed, createIdvSession } from '../idv';

beforeEach(() => {
  resetConfig();
  resetClients();
  __resetOnboardingSessionForTests();
  setConfig({ publishableKey: 'pk_test_x', debugMode: false });
  mockCreateSession.mockClear();
  mockCompleteSession.mockClear();
});

describe('createIdvSession', () => {
  it('throws when there is no active onboarding session', async () => {
    await expect(createIdvSession()).rejects.toMatchObject({ code: 'PAYMENT_FAILED' });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('returns the inquiry id from the SDK response', async () => {
    beginOnboardingSession('onb_sess_1');
    mockCreateSession.mockResolvedValueOnce({ inquiry_id: 'inq_1' });
    await expect(createIdvSession()).resolves.toEqual({ inquiryId: 'inq_1' });
  });

  it('throws API_NETWORK when the SDK call rejects with a plain error', async () => {
    beginOnboardingSession('onb_sess_1');
    mockCreateSession.mockRejectedValueOnce(new Error('offline'));
    await expect(createIdvSession()).rejects.toMatchObject({ code: 'API_NETWORK' });
  });

  it('throws API_NETWORK on a transport-level FrameAPIError (status 0)', async () => {
    beginOnboardingSession('onb_sess_1');
    mockCreateSession.mockRejectedValueOnce(new MockFrameAPIError('offline', 'network_error', 0, null));
    await expect(createIdvSession()).rejects.toMatchObject({ code: 'API_NETWORK' });
  });

  it('throws API_ERROR on a real HTTP error FrameAPIError', async () => {
    beginOnboardingSession('onb_sess_1');
    mockCreateSession.mockRejectedValueOnce(new MockFrameAPIError('server error', 'api_error', 500, null));
    await expect(createIdvSession()).rejects.toMatchObject({ code: 'API_ERROR' });
  });

  it('throws API_ERROR when the response carries no inquiry id', async () => {
    beginOnboardingSession('onb_sess_1');
    mockCreateSession.mockResolvedValueOnce({});
    await expect(createIdvSession()).rejects.toMatchObject({ code: 'API_ERROR' });
  });
});

describe('completeIdvSessionDetailed', () => {
  it('reports verified: true as an authoritative "verified"', async () => {
    mockCompleteSession.mockResolvedValueOnce({ verified: true, status: 'completed', category: 'success' });
    await expect(completeIdvSessionDetailed('inq_1')).resolves.toMatchObject({
      status: 'verified',
      rawStatus: 'completed',
      category: 'success',
    });
  });

  it('reports a well-formed verified: false as authoritative "not_verified"', async () => {
    mockCompleteSession.mockResolvedValueOnce({ verified: false, status: 'declined', category: 'terminal' });
    await expect(completeIdvSessionDetailed('inq_1')).resolves.toMatchObject({
      status: 'not_verified',
      category: 'terminal',
    });
  });

  it('never throws — a network error resolves to "pending"', async () => {
    mockCompleteSession.mockRejectedValueOnce(new Error('offline'));
    await expect(completeIdvSessionDetailed('inq_1')).resolves.toEqual({ status: 'pending' });
  });

  it('forwards retriable and failure_type through', async () => {
    mockCompleteSession.mockResolvedValueOnce({
      verified: false,
      failure_type: 'expired',
      retriable: true,
    });
    await expect(completeIdvSessionDetailed('inq_1')).resolves.toMatchObject({
      failureType: 'expired',
      retriable: true,
    });
  });
});
