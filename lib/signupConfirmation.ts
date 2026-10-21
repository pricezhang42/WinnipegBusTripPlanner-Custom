import { authStorage } from './authStorage';

export const SIGNUP_RESEND_DELAY = 60_000;
export const SIGNUP_CONFIRMATION_MESSAGE = 'Open the link on this device to confirm your account, then sign in.';
export type PendingSignup = { email: string; resendAvailableAt: number };
type SavedSignups = { version: 1; currentEmail: string | null; emails: Record<string, PendingSignup> };
type Storage = Pick<typeof authStorage, 'getItem' | 'setItem'>;
const emailKey = (email: string) => email.trim().toLowerCase();

export function resendSeconds(pending: PendingSignup | null, now = Date.now()) {
  return pending ? Math.max(0, Math.ceil((pending.resendAvailableAt - now) / 1000)) : 0;
}

/** Only email addresses and deadlines are saved, never passwords or email-link tokens. */
export function createSignupConfirmationStore(storage: Storage, project: string) {
  const key = `signup-confirmation.${project.replace(/[^a-z0-9]/gi, '_')}`;
  let saved: SavedSignups | null = null;
  let loading: Promise<SavedSignups> | null = null;
  let storageWarning = '';
  let resending = false;
  async function load(): Promise<SavedSignups> {
    if (saved) return saved;
    if (loading) return loading;
    loading = (async () => {
      const raw = await storage.getItem(key);
      const parsed: SavedSignups | null = raw ? JSON.parse(raw) : null;
      if (parsed && (parsed.version !== 1 || !parsed.emails || typeof parsed.emails !== 'object' ||
          (parsed.currentEmail !== null && typeof parsed.currentEmail !== 'string') ||
          Object.entries(parsed.emails).some(([email, pending]) => !pending || typeof pending.email !== 'string' ||
            emailKey(pending.email) !== email || !Number.isFinite(pending.resendAvailableAt)))) {
        throw new Error('Unable to restore the pending confirmation. Return to sign in and try again.');
      }
      saved = parsed ?? { version: 1, currentEmail: null, emails: {} };
      return saved;
    })();
    try { return await loading; } finally { loading = null; }
  }
  async function persist(state: SavedSignups) {
    saved = state;
    try {
      await storage.setItem(key, JSON.stringify(state));
      storageWarning = '';
    } catch {
      // The email was already sent. Keep the in-memory deadline and show the page.
      storageWarning = 'The resend timer could not be saved. Keep the app open while waiting, then try again.';
    }
  }
  const store = {
    async get(email?: string): Promise<PendingSignup | null> {
      const state = await load();
      const current = email ? emailKey(email) : state.currentEmail;
      return current && Object.hasOwn(state.emails, current) ? state.emails[current] : null;
    },
    async select(email: string): Promise<void> {
      const state = await load();
      if (!Object.hasOwn(state.emails, emailKey(email))) throw new Error('No pending confirmation was found.');
      await persist({ ...state, currentEmail: emailKey(email) });
    },
    async remember(email: string, now = Date.now()): Promise<PendingSignup> {
      const state = await load();
      const current = emailKey(email);
      const pending = { email: email.trim(), resendAvailableAt: now + SIGNUP_RESEND_DELAY };
      // Preserve other unexpired email cooldowns, but do not retain old addresses indefinitely.
      const emails = Object.fromEntries(Object.entries(state.emails).filter(([, entry]) => entry.resendAvailableAt > now));
      await persist({ version: 1, currentEmail: current, emails: { ...emails, [current]: pending } });
      return pending;
    },
    async resend(send: (email: string) => Promise<void>): Promise<PendingSignup> {
      // This lock belongs to the project store, so navigating away cannot start a second request.
      if (resending) throw new Error('A confirmation email is already being sent. Please wait.');
      resending = true;
      try {
        const pending = await store.get();
        if (!pending) throw new Error('No pending confirmation was found. Return to sign in.');
        if (resendSeconds(pending) > 0) throw new Error('Please wait for the resend countdown to finish.');
        await send(pending.email);
        return await store.remember(pending.email);
      } finally { resending = false; }
    },
    get warning() { return storageWarning; },
  };
  return store;
}

export const signupConfirmation = createSignupConfirmationStore(
  authStorage, process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'unconfigured',
);
