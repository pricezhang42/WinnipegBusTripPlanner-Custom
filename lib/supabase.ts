import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { authStorage } from './authStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key ? createClient(url, key, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    lock: processLock,
  },
}) : null;

export function authRedirect(recovery = false) {
  const base = Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : 'bustripplanner://auth/callback';
  return recovery ? `${base}?recovery=true` : base;
}
