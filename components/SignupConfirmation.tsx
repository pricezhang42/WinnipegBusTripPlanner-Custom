import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Text, View } from './Themed';
import { styles } from './AuthForm';
import { authRedirect, supabase } from '@/lib/supabase';
import { PendingSignup, resendSeconds, SIGNUP_CONFIRMATION_MESSAGE, signupConfirmation } from '@/lib/signupConfirmation';
import { useAuth } from '@/providers/AuthProvider';

export function SignupConfirmation() {
  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [now, setNow] = useState(Date.now);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sending = useRef(false);
  const mounted = useRef(true);
  const { session } = useAuth();
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { if (session) router.replace('/(tabs)/account'); }, [session]);
  useFocusEffect(useCallback(() => {
    let focused = true;
    const refreshTime = () => { if (focused) setNow(Date.now()); };
    setLoading(true);
    signupConfirmation.get().then(value => {
      if (focused) { setPending(value); setMessage(signupConfirmation.warning); }
    }).catch(() => {
      if (focused) setMessage('Unable to restore your confirmation details. Return to sign in and try again.');
    }).finally(() => { if (focused) { setLoading(false); refreshTime(); } });
    const interval = setInterval(refreshTime, 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refreshTime(); });
    return () => { focused = false; clearInterval(interval); listener.remove(); };
  }, []));
  const remaining = resendSeconds(pending, now);
  const disabled = loading || busy || !pending || !supabase || !!session || remaining > 0;
  async function resend() {
    if (sending.current || !supabase || !pending || session || resendSeconds(pending) > 0) return;
    sending.current = true;
    setBusy(true); setMessage('');
    try {
      const client = supabase;
      const next = await signupConfirmation.resend(async email => {
        const { error } = await client.auth.resend({ type: 'signup', email,
          options: { emailRedirectTo: authRedirect() } });
        if (error) {
          // Server limits can be longer/project-wide; avoid immediately retrying a 429.
          if (error.status === 429) {
            const delayed = await signupConfirmation.remember(email);
            if (mounted.current) { setPending(delayed); setNow(Date.now()); }
          }
          throw error;
        }
      });
      if (mounted.current) {
        setPending(next); setNow(Date.now());
        setMessage(signupConfirmation.warning || 'Confirmation email sent. Check your inbox and spam folder.');
      }
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'Unable to resend the email. Please try again.');
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>Check your email</Text>
      <Text style={styles.description}>{SIGNUP_CONFIRMATION_MESSAGE}</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Loading confirmation details" /> : pending ?
        <Text style={styles.description}>Email: {pending.email}</Text> :
        <Text style={styles.message}>No pending confirmation was found. Return to sign in to create an account.</Text>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled}
        onPress={resend} style={[styles.button, disabled && { opacity: 0.6 }]}>
        <Text style={styles.buttonText}>{busy ? 'Sending…' : remaining > 0 ? `Resend email (${remaining}s)` : 'Resend confirmation email'}</Text>
      </Pressable>
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.replace('/(tabs)/account')} style={styles.link}>
        <Text>Back to sign in</Text>
      </Pressable>
    </View>
  </ScrollView>;
}
