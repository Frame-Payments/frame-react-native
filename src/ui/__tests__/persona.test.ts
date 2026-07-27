import { ErrorCodes } from '../../errors';

// persona.ts loads `react-native-persona` via a runtime `require()` guarded in a
// try/catch, caching the resolved SDK. Each test swaps the mocked module and
// re-requires persona.ts through jest.isolateModules so the module-level cache
// starts fresh — mirroring how __resetPersonaSdkCache is used in the app.

// Mutable so a test can simulate the pod being absent. Defaults to present:
// every pre-existing case here exercises the JS-resolution guard, which is only
// reachable once the native check passes.
const mockNativeModules: { PersonaInquiry2?: unknown } = { PersonaInquiry2: {} };
jest.mock('react-native', () => ({
  get NativeModules() {
    return mockNativeModules;
  },
}));

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
  mockNativeModules.PersonaInquiry2 = {};
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

  // Regression: a hoisted/monorepo node_modules makes the JS package resolvable
  // in apps that never installed the pod. react-native-persona constructs a
  // NativeEventEmitter at module scope, so requiring it there throws
  // "`new NativeEventEmitter()` requires a non-null argument" and crashes the
  // screen. The native check must short-circuit BEFORE the require.
  it('reports unavailable when the JS package resolves but the native module is missing', async () => {
    delete mockNativeModules.PersonaInquiry2;
    let required = false;
    jest.doMock(
      'react-native-persona',
      () => {
        required = true;
        throw new Error('`new NativeEventEmitter()` requires a non-null argument.');
      },
      { virtual: true },
    );
    const { isPersonaAvailable, launchPersonaInquiry, __resetPersonaSdkCache } = loadPersona();
    __resetPersonaSdkCache();

    expect(isPersonaAvailable()).toBe(false);
    expect(required).toBe(false);
    await expect(launchPersonaInquiry({ inquiryId: 'inq_1' })).rejects.toMatchObject({
      code: ErrorCodes.PERSONA_UNAVAILABLE,
    });
  });

  it('reports available when both the native module and the JS package are present', () => {
    jest.doMock('react-native-persona', () => ({ Inquiry: { fromInquiry: () => ({}) } }), {
      virtual: true,
    });
    const { isPersonaAvailable, __resetPersonaSdkCache } = loadPersona();
    __resetPersonaSdkCache();

    expect(isPersonaAvailable()).toBe(true);
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
