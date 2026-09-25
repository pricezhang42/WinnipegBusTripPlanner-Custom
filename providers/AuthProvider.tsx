import React, { createContext, useContext, useEffect, useState, PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<{ session: Session | null; loading: boolean; error: string | null }>({ session: null, loading: true, error: null });

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let active = true;
    let receivedEvent = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => {
      receivedEvent = true;
      if (active) { setSession(next); setLoading(false); setError(null); }
    });
    client.auth.getSession().then(({ data, error: failure }) => {
      if (!active) return;
      if (failure) setError('Could not restore your session. Please sign in again.');
      if (!receivedEvent) setSession(data.session);
    }).catch(() => {
      if (active) setError('Could not restore your session. Please sign in again.');
    }).finally(() => { if (active) setLoading(false); });
    const refresh = (state: string) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    if (Platform.OS !== 'web') refresh(AppState.currentState);
    const listener = Platform.OS !== 'web' ? AppState.addEventListener('change', refresh) : null;
    return () => { active = false; subscription.unsubscribe(); listener?.remove(); if (Platform.OS !== 'web') client.auth.stopAutoRefresh(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading, error }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
