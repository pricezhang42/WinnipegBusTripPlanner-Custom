import { describe, expect, jest, test } from '@jest/globals';
import { createSignupConfirmationStore, resendSeconds, SIGNUP_RESEND_DELAY } from '../signupConfirmation';

function fixture() {
  const values = new Map<string, string>();
  return { values, storage: {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
  } };
}

describe('signup confirmation deadlines', () => {
  test('starts at 60 seconds, rounds up, expires and survives a new store instance', async () => {
    const { storage } = fixture();
    const store = createSignupConfirmationStore(storage, 'https://qa1.supabase.co');
    const pending = await store.remember('user@example.com', 1_000);
    expect(resendSeconds(pending, 1_000)).toBe(60);
    expect(resendSeconds(pending, 1_001)).toBe(60);
    expect(resendSeconds(pending, 60_999)).toBe(1);
    expect(resendSeconds(pending, 61_000)).toBe(0);
    const restarted = createSignupConfirmationStore(storage, 'https://qa1.supabase.co');
    expect(await restarted.get()).toEqual(pending);
    expect(resendSeconds(await restarted.get(), 31_000)).toBe(30);
  });

  test('scopes cooldowns by project and email, and selecting an earlier email does not reset it', async () => {
    const { storage } = fixture();
    const qa = createSignupConfirmationStore(storage, 'qa');
    const first = await qa.remember('First@example.com', 1_000);
    await qa.remember('second@example.com', 2_000);
    expect(await qa.get(' first@EXAMPLE.com ')).toEqual(first);
    await qa.select('first@example.com');
    expect(await qa.get()).toEqual(first);
    expect(await createSignupConfirmationStore(storage, 'production').get()).toBeNull();
  });

  test('rejects sends during cooldown and allows exactly one in-flight resend', async () => {
    const { storage } = fixture();
    const store = createSignupConfirmationStore(storage, 'qa');
    await store.remember('user@example.com');
    const send = jest.fn(async () => {});
    await expect(store.resend(send)).rejects.toThrow('countdown');
    expect(send).not.toHaveBeenCalled();
    await store.remember('user@example.com', Date.now() - SIGNUP_RESEND_DELAY);
    let finish!: () => void;
    const blocked = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const first = store.resend(blocked);
    await expect(store.resend(blocked)).rejects.toThrow('already being sent');
    finish();
    const next = await first;
    expect(blocked).toHaveBeenCalledTimes(1);
    expect(resendSeconds(next)).toBe(60);
  });

  test('a failed resend retains the expired deadline and releases the lock for retry', async () => {
    const { storage } = fixture();
    const store = createSignupConfirmationStore(storage, 'qa');
    const previous = await store.remember('user@example.com', Date.now() - 61_000);
    await expect(store.resend(async () => { throw new Error('Network unavailable'); })).rejects.toThrow('Network unavailable');
    expect(await store.get()).toEqual(previous);
    await store.resend(async () => {});
    expect(resendSeconds(await store.get())).toBe(60);
  });

  test('storage failure retains an in-memory deadline and exposes a warning after email was sent', async () => {
    const { storage } = fixture();
    storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
    const store = createSignupConfirmationStore(storage, 'qa');
    const pending = await store.remember('user@example.com');
    expect(await store.get()).toEqual(pending);
    expect(store.warning).toContain('could not be saved');
  });

  test('saved payload contains only email/deadline metadata, and invalid saved records are rejected', async () => {
    const { values, storage } = fixture();
    const store = createSignupConfirmationStore(storage, 'qa');
    await store.remember('user@example.com');
    expect(JSON.parse([...values.values()][0])).toEqual({ version: 1, currentEmail: 'user@example.com',
      emails: { 'user@example.com': { email: 'user@example.com', resendAvailableAt: expect.any(Number) } } });
    values.set([...values.keys()][0], JSON.stringify({version:1,currentEmail:'user@example.com',emails:{'user@example.com':{email:'wrong@example.com',resendAvailableAt:'invalid'}}}));
    await expect(createSignupConfirmationStore(storage, 'qa').get()).rejects.toThrow('Unable to restore');
  });
});
