const isSupported = jest.fn(() => Promise.resolve(true));
const attestedKeyId = jest.fn<Promise<string | null>, []>(() => Promise.resolve(null));
const generateKey = jest.fn(() => Promise.resolve('key_pending_1'));
const attestKey = jest.fn(() => Promise.resolve('attest_obj_base64'));
const promoteKey = jest.fn(() => Promise.resolve());
const clearPendingKey = jest.fn(() => Promise.resolve());
const generateAssertion = jest.fn(() => Promise.resolve('assertion_base64'));
const resetAttestationBridge = jest.fn(() => Promise.resolve());

const mockPlatform = { OS: 'ios' as 'ios' | 'android' };

jest.mock('react-native', () => ({
  NativeModules: {
    FrameAttestation: {
      isSupported,
      attestedKeyId,
      generateKey,
      attestKey,
      promoteKey,
      clearPendingKey,
      generateAssertion,
      resetAttestation: resetAttestationBridge,
    },
  },
  Platform: mockPlatform,
}));

const getChallenge = jest.fn(() => Promise.resolve({ challenge: 'Y2hhbGxlbmdl' })); // "challenge" base64
const attest = jest.fn(() => Promise.resolve({ status: 'verified', key_id: 'key_pending_1' }));

jest.mock('framepayments', () => {
  class MockFrameSDK {
    deviceAttestation = { getChallenge, attest };
    constructor(_config: unknown) {}
  }
  return { FrameSDK: MockFrameSDK };
});

import { setConfig, resetConfig } from '../config';
import { resetClients } from '../client';
import {
  __resetEnsureAttestedInflight,
  ensureAttested,
  generateAssertionForPayment,
  getAttestedKeyId,
  isAttestationSupported,
  resetAttestation,
} from '../attestation';

beforeEach(() => {
  isSupported.mockClear().mockResolvedValue(true);
  attestedKeyId.mockClear().mockResolvedValue(null);
  generateKey.mockClear().mockResolvedValue('key_pending_1');
  attestKey.mockClear().mockResolvedValue('attest_obj_base64');
  promoteKey.mockClear().mockResolvedValue(undefined);
  clearPendingKey.mockClear().mockResolvedValue(undefined);
  generateAssertion.mockClear().mockResolvedValue('assertion_base64');
  resetAttestationBridge.mockClear().mockResolvedValue(undefined);
  getChallenge.mockClear().mockResolvedValue({ challenge: 'Y2hhbGxlbmdl' });
  attest.mockClear().mockResolvedValue({ status: 'verified', key_id: 'key_pending_1' });
  resetConfig();
  resetClients();
  __resetEnsureAttestedInflight();
  setConfig({ publishableKey: 'pk_test', secretKey: 'sk_test', debugMode: false });
  mockPlatform.OS = 'ios';
});

describe('isAttestationSupported', () => {
  it('returns true when the iOS bridge reports support', async () => {
    expect(await isAttestationSupported()).toBe(true);
  });

  it('returns false on Android without calling the bridge', async () => {
    mockPlatform.OS = 'android';
    expect(await isAttestationSupported()).toBe(false);
    expect(isSupported).not.toHaveBeenCalled();
  });
});

describe('ensureAttested', () => {
  it('returns the existing key id without re-attesting', async () => {
    attestedKeyId.mockResolvedValueOnce('key_already_attested');
    expect(await ensureAttested()).toBe('key_already_attested');
    expect(generateKey).not.toHaveBeenCalled();
    expect(getChallenge).not.toHaveBeenCalled();
  });

  it('runs the full 5-step flow when no attested key exists', async () => {
    const keyId = await ensureAttested();
    expect(keyId).toBe('key_pending_1');
    expect(isSupported).toHaveBeenCalled();
    expect(generateKey).toHaveBeenCalled();
    expect(getChallenge).toHaveBeenCalledWith({ usePublishableKey: true });
    expect(attestKey).toHaveBeenCalledWith('key_pending_1', expect.any(String));
    expect(attest).toHaveBeenCalledWith(
      { key_id: 'key_pending_1', attestation_object: 'attest_obj_base64', challenge: 'Y2hhbGxlbmdl' },
      { usePublishableKey: true },
    );
    expect(promoteKey).toHaveBeenCalledWith('key_pending_1');
  });

  it('throws PLATFORM_UNSUPPORTED on Android', async () => {
    mockPlatform.OS = 'android';
    await expect(ensureAttested()).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
  });

  it('throws NOT_ATTESTED when the device does not support App Attest', async () => {
    isSupported.mockResolvedValueOnce(false);
    await expect(ensureAttested()).rejects.toMatchObject({ code: 'NOT_ATTESTED' });
    expect(generateKey).not.toHaveBeenCalled();
  });

  it('throws ATTESTATION_FAILED when frame-node returns no challenge', async () => {
    getChallenge.mockResolvedValueOnce({ challenge: '' });
    await expect(ensureAttested()).rejects.toMatchObject({ code: 'ATTESTATION_FAILED' });
    expect(attestKey).not.toHaveBeenCalled();
  });

  it('throws ATTESTATION_FAILED when App Attest rejects the key', async () => {
    attestKey.mockRejectedValueOnce(new Error('App Attest error'));
    await expect(ensureAttested()).rejects.toMatchObject({ code: 'ATTESTATION_FAILED' });
    expect(promoteKey).not.toHaveBeenCalled();
  });

  it('throws ATTESTATION_FAILED when Frame rejects the attestation, and clears the pending key (regression for orphaned-key bug)', async () => {
    attest.mockResolvedValueOnce({ status: 'rejected', key_id: 'key_pending_1' });
    await expect(ensureAttested()).rejects.toMatchObject({ code: 'ATTESTATION_FAILED' });
    expect(promoteKey).not.toHaveBeenCalled();
    expect(clearPendingKey).toHaveBeenCalled();
  });

  it('clears the pending key when the challenge fetch fails after generateKey', async () => {
    getChallenge.mockRejectedValueOnce(new Error('network down'));
    await expect(ensureAttested()).rejects.toMatchObject({ code: 'ATTESTATION_FAILED' });
    expect(clearPendingKey).toHaveBeenCalled();
  });

  it('clears the pending key when the backend attest call rejects (network error)', async () => {
    attest.mockRejectedValueOnce(new Error('500 server error'));
    await expect(ensureAttested()).rejects.toMatchObject({ code: 'ATTESTATION_FAILED' });
    expect(clearPendingKey).toHaveBeenCalled();
  });

  it('clears the pending key when the bridge returns an empty attestation object', async () => {
    attestKey.mockResolvedValueOnce('');
    await expect(ensureAttested()).rejects.toMatchObject({ code: 'ATTESTATION_FAILED' });
    expect(clearPendingKey).toHaveBeenCalled();
  });

  it('treats a null challenge from frame-node as missing', async () => {
    getChallenge.mockResolvedValueOnce({ challenge: null as never });
    await expect(ensureAttested()).rejects.toMatchObject({ code: 'ATTESTATION_FAILED' });
  });

  it('dedupes parallel ensureAttested calls into one flow', async () => {
    const a = ensureAttested();
    const b = ensureAttested();
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe(rb);
    expect(generateKey).toHaveBeenCalledTimes(1);
    expect(getChallenge).toHaveBeenCalledTimes(1);
    expect(attestKey).toHaveBeenCalledTimes(1);
    expect(promoteKey).toHaveBeenCalledTimes(1);
  });

  it('forwards usePublishableKey to both challenge + attest calls', async () => {
    await ensureAttested();
    expect(getChallenge).toHaveBeenCalledWith({ usePublishableKey: true });
    expect(attest).toHaveBeenCalledWith(expect.any(Object), { usePublishableKey: true });
  });
});

describe('generateAssertionForPayment', () => {
  it('throws NOT_ATTESTED if no key is on the device', async () => {
    attestedKeyId.mockResolvedValueOnce(null);
    await expect(generateAssertionForPayment(new Uint8Array([1, 2, 3]))).rejects.toMatchObject({
      code: 'NOT_ATTESTED',
    });
  });

  it('returns { keyId, assertion, clientData } base64-encoded', async () => {
    attestedKeyId.mockResolvedValueOnce('key_attested');
    const result = await generateAssertionForPayment(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    expect(result.keyId).toBe('key_attested');
    expect(result.assertion).toBe('assertion_base64');
    // clientData JSON encodes { challenge: base64('deadbeef'), origin: 'ios-sdk' }.
    // We don't pin the exact base64 string here; just check it decodes to a JSON object with
    // the expected fields.
    const decoded = JSON.parse(Buffer.from(result.clientData, 'base64').toString('utf-8'));
    expect(decoded.origin).toBe('ios-sdk');
    expect(decoded.challenge).toBe(Buffer.from([0xde, 0xad, 0xbe, 0xef]).toString('base64'));
  });

  it('throws ATTESTATION_FAILED when App Attest rejects the assertion', async () => {
    attestedKeyId.mockResolvedValueOnce('key_attested');
    generateAssertion.mockRejectedValueOnce(new Error('boom'));
    await expect(generateAssertionForPayment(new Uint8Array([1]))).rejects.toMatchObject({
      code: 'ATTESTATION_FAILED',
    });
  });

  it('throws PLATFORM_UNSUPPORTED on Android', async () => {
    mockPlatform.OS = 'android';
    await expect(generateAssertionForPayment(new Uint8Array([1]))).rejects.toMatchObject({
      code: 'PLATFORM_UNSUPPORTED',
    });
  });

  it('handles an empty Uint8Array (challenge becomes empty-string base64)', async () => {
    attestedKeyId.mockResolvedValueOnce('key_attested');
    const result = await generateAssertionForPayment(new Uint8Array(0));
    const decoded = JSON.parse(Buffer.from(result.clientData, 'base64').toString('utf-8'));
    expect(decoded).toEqual({ challenge: '', origin: 'ios-sdk' });
  });
});

describe('getAttestedKeyId', () => {
  it('returns the key from the native bridge', async () => {
    attestedKeyId.mockResolvedValueOnce('key_x');
    expect(await getAttestedKeyId()).toBe('key_x');
  });

  it('returns null when no key is stored', async () => {
    attestedKeyId.mockResolvedValueOnce(null);
    expect(await getAttestedKeyId()).toBeNull();
  });

  it('returns null on Android without touching the bridge', async () => {
    mockPlatform.OS = 'android';
    expect(await getAttestedKeyId()).toBeNull();
    expect(attestedKeyId).not.toHaveBeenCalled();
  });
});

describe('resetAttestation', () => {
  it('calls the bridge', async () => {
    await resetAttestation();
    expect(resetAttestationBridge).toHaveBeenCalled();
  });

  it('throws PLATFORM_UNSUPPORTED on Android', async () => {
    mockPlatform.OS = 'android';
    await expect(resetAttestation()).rejects.toMatchObject({ code: 'PLATFORM_UNSUPPORTED' });
    expect(resetAttestationBridge).not.toHaveBeenCalled();
  });
});
