import { supabase } from './supabase';
// Deduplicate effect re-runs: a PKCE code is single use. Keep only the latest exchange.
let lastCode: string | undefined;
let lastExchange: ReturnType<NonNullable<typeof supabase>['auth']['exchangeCodeForSession']> | undefined;
export function exchangeAuthCode(code: string) {
  if (!supabase) throw new Error('Sign-in is not configured yet.');
  if (code !== lastCode || !lastExchange) {
    lastCode = code;
    lastExchange = supabase.auth.exchangeCodeForSession(code);
  }
  return lastExchange;
}
