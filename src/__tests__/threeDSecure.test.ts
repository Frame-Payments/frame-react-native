import {
  confirmCharge,
  isCallbackUrl,
  requiresConfirmation,
  type ConfirmableCharge,
} from '../threeDSecure';

const noSleep = async () => {};

function charge(over: Partial<ConfirmableCharge> = {}): ConfirmableCharge {
  return { id: 'tr_1', status: 'requires_confirmation', ...over };
}

describe('requiresConfirmation', () => {
  it('is true only for the two held-back statuses', () => {
    expect(requiresConfirmation('requires_confirmation')).toBe(true);
    expect(requiresConfirmation('requires_three_d_secure')).toBe(true);
    expect(requiresConfirmation('succeeded')).toBe(false);
    expect(requiresConfirmation('failed')).toBe(false);
    expect(requiresConfirmation(undefined)).toBe(false);
    expect(requiresConfirmation(null)).toBe(false);
  });
});

describe('confirmCharge', () => {
  it('returns succeeded when the confirm settles immediately', async () => {
    const outcome = await confirmCharge(charge(), {
      confirm: async () => charge({ status: 'succeeded' }),
      reload: async () => null,
      sleep: noSleep,
    });
    expect(outcome).toEqual({ status: 'succeeded' });
  });

  it('treats requires_capture as succeeded', async () => {
    // Authorized and awaiting a merchant-initiated capture is a success for the
    // cardholder, matching iOS's terminalOutcome.
    const outcome = await confirmCharge(charge(), {
      confirm: async () => charge({ status: 'requires_capture' }),
      reload: async () => null,
      sleep: noSleep,
    });
    expect(outcome).toEqual({ status: 'succeeded' });
  });

  it('surfaces the issuer failure reason', async () => {
    const failed = {
      ...charge({ status: 'failed' }),
      latest_charge: { failure_code: 'card_declined', failure_message: 'Insufficient funds.' },
    } as ConfirmableCharge;
    const outcome = await confirmCharge(charge(), {
      confirm: async () => failed,
      reload: async () => null,
      sleep: noSleep,
    });
    expect(outcome).toEqual({
      status: 'failed',
      code: 'card_declined',
      message: 'Insufficient funds.',
    });
  });

  it('reports a failure with no latest_charge as failed with no reason', async () => {
    const outcome = await confirmCharge(charge(), {
      confirm: async () => charge({ status: 'failed' }),
      reload: async () => null,
      sleep: noSleep,
    });
    expect(outcome).toEqual({ status: 'failed' });
  });

  it('runs the challenge, then polls for the verdict', async () => {
    const presented: string[] = [];
    let reloads = 0;
    const outcome = await confirmCharge(charge(), {
      confirm: async () =>
        charge({
          status: 'requires_three_d_secure',
          next_action: { use_frame_sdk: { challenge_url: 'https://issuer.test/3ds' } },
        }),
      reload: async () => {
        reloads += 1;
        return reloads < 2 ? charge({ status: 'processing' }) : charge({ status: 'succeeded' });
      },
      presentChallenge: async (url) => {
        presented.push(url);
        return 'completed';
      },
      sleep: noSleep,
    });
    expect(presented).toEqual(['https://issuer.test/3ds']);
    expect(outcome).toEqual({ status: 'succeeded' });
  });

  it('polls after a failed challenge too — the sheet closing is not the verdict', async () => {
    // iOS: 'completed' and 'failed' both just mean the sheet closed; only the
    // API decides whether the cardholder was charged.
    const outcome = await confirmCharge(charge(), {
      confirm: async () =>
        charge({
          status: 'requires_three_d_secure',
          next_action: { use_frame_sdk: { challenge_url: 'https://issuer.test/3ds' } },
        }),
      reload: async () => charge({ status: 'succeeded' }),
      presentChallenge: async () => 'failed',
      sleep: noSleep,
    });
    expect(outcome).toEqual({ status: 'succeeded' });
  });

  it('throws when a challenge is required but never ran', async () => {
    await expect(
      confirmCharge(charge(), {
        confirm: async () =>
          charge({
            status: 'requires_three_d_secure',
            next_action: { use_frame_sdk: { challenge_url: 'https://issuer.test/3ds' } },
          }),
        reload: async () => null,
        presentChallenge: async () => 'unavailable',
        sleep: noSleep,
      }),
    ).rejects.toThrow('Card verification could not be started. Please try again.');
  });

  it('throws when a challenge is required but no presenter was supplied', async () => {
    await expect(
      confirmCharge(charge(), {
        confirm: async () =>
          charge({
            status: 'requires_three_d_secure',
            next_action: { use_frame_sdk: { challenge_url: 'https://issuer.test/3ds' } },
          }),
        reload: async () => null,
        sleep: noSleep,
      }),
    ).rejects.toThrow('Card verification could not be started. Please try again.');
  });

  it('throws when the API asks for a challenge but sends no URL', async () => {
    await expect(
      confirmCharge(charge(), {
        confirm: async () => charge({ status: 'requires_three_d_secure' }),
        reload: async () => null,
        presentChallenge: async () => 'completed',
        sleep: noSleep,
      }),
    ).rejects.toThrow('Card verification could not be started. Please try again.');
  });

  it('refuses a non-https challenge URL', async () => {
    // Defence in depth: a javascript:/file:/http: URL must never reach a WebView
    // that is about to handle card authentication.
    for (const url of ['javascript:alert(1)', 'http://issuer.test/3ds', 'file:///etc/passwd', 'nonsense']) {
      await expect(
        confirmCharge(charge(), {
          confirm: async () =>
            charge({
              status: 'requires_three_d_secure',
              next_action: { use_frame_sdk: { challenge_url: url } },
            }),
          reload: async () => null,
          presentChallenge: async () => 'completed',
          sleep: noSleep,
        }),
      ).rejects.toThrow('Card verification could not be started. Please try again.');
    }
  });

  it('polls rather than guessing when the confirm decodes to nothing', async () => {
    const outcome = await confirmCharge(charge(), {
      confirm: async () => null,
      reload: async () => charge({ status: 'succeeded' }),
      sleep: noSleep,
    });
    expect(outcome).toEqual({ status: 'succeeded' });
  });

  it('times out rather than declining when no status ever settles', async () => {
    // The charge may still settle, so a timeout must never be reported as a
    // decline — telling the user to retry could double-charge them.
    let reloads = 0;
    const outcome = await confirmCharge(charge(), {
      confirm: async () => charge({ status: 'processing' }),
      reload: async () => {
        reloads += 1;
        return charge({ status: 'processing' });
      },
      maxAttempts: 3,
      sleep: noSleep,
    });
    expect(outcome).toEqual({ status: 'timed_out' });
    expect(reloads).toBe(3);
  });

  it('a transient read failure consumes an attempt but does not abort', async () => {
    let reloads = 0;
    const outcome = await confirmCharge(charge(), {
      confirm: async () => charge({ status: 'processing' }),
      reload: async () => {
        reloads += 1;
        if (reloads === 1) throw new Error('boom');
        return charge({ status: 'succeeded' });
      },
      maxAttempts: 3,
      sleep: noSleep,
    });
    expect(outcome).toEqual({ status: 'succeeded' });
  });

  it('throws when every read fails', async () => {
    await expect(
      confirmCharge(charge(), {
        confirm: async () => charge({ status: 'processing' }),
        reload: async () => {
          throw new Error('offline');
        },
        maxAttempts: 2,
        sleep: noSleep,
      }),
    ).rejects.toThrow('Could not read the payment status after 2 attempts');
  });

  it('always reads at least once even when maxAttempts is zero', async () => {
    let reloads = 0;
    await confirmCharge(charge(), {
      confirm: async () => charge({ status: 'processing' }),
      reload: async () => {
        reloads += 1;
        return charge({ status: 'processing' });
      },
      maxAttempts: 0,
      sleep: noSleep,
    });
    expect(reloads).toBe(1);
  });
});

describe('isCallbackUrl', () => {
  it('matches the callback path exactly, ignoring host and query', () => {
    expect(isCallbackUrl('https://api.framepayments.com/evervault/3ds/callback')).toBe(true);
    expect(isCallbackUrl('https://issuer.test/evervault/3ds/callback?status=ok')).toBe(true);
  });

  it('does not match other paths on the same host', () => {
    expect(isCallbackUrl('https://api.framepayments.com/evervault/3ds/start')).toBe(false);
    expect(isCallbackUrl('https://api.framepayments.com/evervault/3ds/callback/extra')).toBe(false);
  });

  it('does not throw on a malformed URL', () => {
    expect(isCallbackUrl('not a url')).toBe(false);
    expect(isCallbackUrl('')).toBe(false);
  });
});
