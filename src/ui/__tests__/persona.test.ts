import { ErrorCodes } from '../../errors';

// persona.ts loads `react-native-persona` via a runtime `require()` guarded in a
// try/catch, caching the resolved SDK. Each test swaps the mocked module and
// re-requires persona.ts through jest.isolateModules so the module-level cache
// starts fresh — mirroring how __resetPersonaSdkCache is used in the app.

type PersonaModule = typeof import('../../persona');

function loadPersona(): PersonaModule {
  let mod: PersonaModule;
  jest.isolateModules(() => {
    mod = require('../../persona');
  });
  // @ts-expect-error assigned inside isolateModules callback
  return mod;
}

afterEach(() => {
  jest.resetModules();
  jest.dontMock('react-native-persona');
});

describe('launchPersonaInquiry — dependency gating', () => {
  it('rejects with PERSONA_UNAVAILABLE when react-native-persona cannot resolve', async () => {
    jest.doMock('react-native-persona', () => {
      throw new Error('Cannot find module');
    });
    const { launchPersonaInquiry, __resetPersonaSdkCache } = loadPersona();
    __resetPersonaSdkCache();

    await expect(launchPersonaInquiry({ inquiryId: 'inq_1' })).rejects.toMatchObject({
      code: ErrorCodes.PERSONA_UNAVAILABLE,
    });
  });

  it('rejects with PERSONA_UNAVAILABLE when the module resolves without an Inquiry export', async () => {
    jest.doMock('react-native-persona', () => ({}), { virtual: true });
    const { launchPersonaInquiry, __resetPersonaSdkCache } = loadPersona();
    __resetPersonaSdkCache();

    await expect(launchPersonaInquiry({ inquiryId: 'inq_1' })).rejects.toMatchObject({
      code: ErrorCodes.PERSONA_UNAVAILABLE,
    });
  });
});

describe('launchPersonaInquiry — settle guard', () => {
  // Builds a mocked react-native-persona whose Inquiry builder captures the
  // registered callbacks so a test can fire them in any order, then asserts the
  // returned promise settles exactly once.
  function mockPersona(): { fire: () => { onComplete: Callbacks['onComplete']; onError: Callbacks['onError'] } } {
    const captured: Partial<Callbacks> = {};
    jest.doMock(
      'react-native-persona',
      () => ({
        Inquiry: {
          fromInquiry: () => {
            const builder = {
              onComplete(cb: Callbacks['onComplete']) {
                captured.onComplete = cb;
                return builder;
              },
              onCanceled(cb: Callbacks['onCanceled']) {
                captured.onCanceled = cb;
                return builder;
              },
              onError(cb: Callbacks['onError']) {
                captured.onError = cb;
                return builder;
              },
              build: () => ({ start: () => {} }),
            };
            return builder;
          },
        },
      }),
      { virtual: true },
    );
    return {
      fire: () => ({
        onComplete: captured.onComplete!,
        onError: captured.onError!,
      }),
    };
  }

  it('resolves on onComplete and ignores a later onError (settles once)', async () => {
    const persona = mockPersona();
    const { launchPersonaInquiry, __resetPersonaSdkCache } = loadPersona();
    __resetPersonaSdkCache();

    const promise = launchPersonaInquiry({ inquiryId: 'inq_1' });
    const cbs = persona.fire();
    cbs.onComplete('inq_1', 'completed', {});
    // A stray error after completion must not turn the resolved promise into a
    // rejection — the `settled` guard drops it.
    cbs.onError(new Error('too late'), 'some_code');

    await expect(promise).resolves.toMatchObject({ inquiryId: 'inq_1', status: 'completed' });
  });

  it('rejects on onError and ignores a later onComplete (settles once)', async () => {
    const persona = mockPersona();
    const { launchPersonaInquiry, __resetPersonaSdkCache } = loadPersona();
    __resetPersonaSdkCache();

    const promise = launchPersonaInquiry({ inquiryId: 'inq_1' });
    const cbs = persona.fire();
    cbs.onError(new Error('boom'), 'some_code');
    cbs.onComplete('inq_1', 'completed', {});

    await expect(promise).rejects.toMatchObject({ code: ErrorCodes.PAYMENT_FAILED });
  });
});

interface Callbacks {
  onComplete: (inquiryId: string, status: string, fields: Record<string, unknown>) => void;
  onCanceled: (inquiryId?: string, sessionToken?: string) => void;
  onError: (error: Error, errorCode?: string) => void;
}
