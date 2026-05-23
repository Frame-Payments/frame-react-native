const initMock = jest.fn(() => Promise.resolve());
const encryptMock = jest.fn((value: unknown) => Promise.resolve(`ev:${String(value)}`));

jest.mock('@evervault/evervault-react-native', () => ({
  init: initMock,
  encrypt: encryptMock,
}));

import {
  configureEvervault,
  encryptWithEvervault,
  isEvervaultConfigured,
  resetEvervault,
} from '../evervault';

beforeEach(() => {
  initMock.mockClear();
  encryptMock.mockClear();
  resetEvervault();
});

describe('configureEvervault', () => {
  it('forwards teamId + appId to the Evervault SDK', async () => {
    await configureEvervault('team_xxx', 'app_yyy');
    expect(initMock).toHaveBeenCalledWith('team_xxx', 'app_yyy');
    expect(isEvervaultConfigured()).toBe(true);
  });

  it('memoizes — re-calling with the same team/app does not re-init', async () => {
    await configureEvervault('team_xxx', 'app_yyy');
    await configureEvervault('team_xxx', 'app_yyy');
    expect(initMock).toHaveBeenCalledTimes(1);
  });

  it('re-initializes when teamId or appId changes (key rotation)', async () => {
    await configureEvervault('team_xxx', 'app_yyy');
    await configureEvervault('team_zzz', 'app_yyy');
    expect(initMock).toHaveBeenCalledTimes(2);
    expect(initMock).toHaveBeenLastCalledWith('team_zzz', 'app_yyy');
  });

  it('throws when teamId is empty', async () => {
    await expect(configureEvervault('', 'app_yyy')).rejects.toMatchObject({
      code: 'EVERVAULT_CONFIG_INVALID',
    });
    expect(initMock).not.toHaveBeenCalled();
  });

  it('throws when appId is empty', async () => {
    await expect(configureEvervault('team_xxx', '')).rejects.toMatchObject({
      code: 'EVERVAULT_CONFIG_INVALID',
    });
    expect(initMock).not.toHaveBeenCalled();
  });
});

describe('encryptWithEvervault', () => {
  it('throws EVERVAULT_NOT_CONFIGURED when configure() has not run', async () => {
    await expect(encryptWithEvervault('4242424242424242')).rejects.toMatchObject({
      code: 'EVERVAULT_NOT_CONFIGURED',
    });
    expect(encryptMock).not.toHaveBeenCalled();
  });

  it('forwards the value to Evervault.encrypt after configure', async () => {
    await configureEvervault('team_x', 'app_x');
    const out = await encryptWithEvervault('4242424242424242');
    expect(out).toBe('ev:4242424242424242');
    expect(encryptMock).toHaveBeenCalledWith('4242424242424242');
  });
});

describe('resetEvervault', () => {
  it('clears configured state', async () => {
    await configureEvervault('team_x', 'app_x');
    expect(isEvervaultConfigured()).toBe(true);
    resetEvervault();
    expect(isEvervaultConfigured()).toBe(false);
  });

  it('next encrypt after reset throws EVERVAULT_NOT_CONFIGURED again', async () => {
    await configureEvervault('team_x', 'app_x');
    resetEvervault();
    await expect(encryptWithEvervault('x')).rejects.toMatchObject({
      code: 'EVERVAULT_NOT_CONFIGURED',
    });
  });
});
