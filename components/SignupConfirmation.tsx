import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Text, View } from './Themed';
import { styles } from './AuthForm';
import { CodeInput, codeStyles as local } from './CodeInput';
import { authRedirect, supabase } from '@/lib/supabase';
import { PendingSignup, resendSeconds, SIGNUP_CODE_LENGTH, SIGNUP_CONFIRMATION_MESSAGE, signupConfirmation } from '@/lib/signupConfirmation';
import { useAuth } from '@/providers/AuthProvider';

export function SignupConfirmation() {
  const [pending, setPending] = useState<PendingSignup | null>(null);
  const [now, setNow] = useState(Date.now);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
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
  const disabled = loading || busy || verifying || !pending || !supabase || !!session || remaining > 0;
  const canVerify = !loading && !busy && !verifying && !!pending && !!supabase && !session && code.length === SIGNUP_CODE_LENGTH;
  async function verify() {
    if (!canVerify || !supabase || !pending) return;
    setVerifying(true); setMessage('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: pending.email, token: code, type: 'email' });
      if (error) throw error.status === 429 ? error : new Error('That code is incorrect or has expired. Check your latest email or resend a new code.');
      if (data.session) router.replace('/(tabs)/account');
    } catch (error) {
      if (mounted.current) { setCode(''); setMessage(error instanceof Error ? error.message : 'Unable to verify the code. Please try again.'); }
    } finally {
      if (mounted.current) setVerifying(false);
    }
  }
  async function resend() {
    if (sending.current || verifying || !supabase || !pending || session || resendSeconds(pending) > 0) return;
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
        setCode(''); setMessage(signupConfirmation.warning || 'A new code is on its way. Check your inbox and spam folder.');
      }
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'Unable to resend the email. Please try again.');
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return <View style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
    <View style={styles.card}>
      <View style={local.badge}><FontAwesome name="envelope-o" size={30} color="#176b9c" /></View>
      <Text accessibilityRole="header" style={[styles.title, local.center]}>Check your inbox</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Loading confirmation details" /> : pending ? <>
        <Text style={[local.body, local.center]}>{`We sent a ${SIGNUP_CODE_LENGTH}-digit code to`}</Text>
        <Text style={[local.email, local.center]}>{pending.email}</Text>
        <CodeInput value={code} onChange={setCode} onSubmit={verify} editable={!verifying && !busy}
          length={SIGNUP_CODE_LENGTH} accessibilityLabel={`${SIGNUP_CODE_LENGTH}-digit confirmation code`} />
        <Pressable testID="verify" accessibilityRole="button" accessibilityState={{ disabled: !canVerify, busy: verifying }}
          disabled={!canVerify} onPress={verify} style={[styles.button, !canVerify && local.buttonDisabled]}>
          {verifying ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, !canVerify && local.buttonTextDisabled]}>Verify email</Text>}
        </Pressable>
      </> : <Text style={[styles.message, local.center]}>No pending confirmation was found. Return to sign in to create an account.</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={[styles.message, local.center]}>{message}</Text>}
      {pending && <Text style={[local.hint, local.center]}>{SIGNUP_CONFIRMATION_MESSAGE}</Text>}
      <Pressable testID="resend" accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled}
        onPress={resend} style={styles.link}>
        <Text style={disabled ? local.buttonTextDisabled : local.linkText}>{busy ? 'Sending…' : remaining > 0 ? `Resend code in ${remaining}s` : 'Resend code'}</Text>
      </Pressable>
      <Pressable testID="back" accessibilityRole="button" disabled={busy || verifying} onPress={() => router.replace('/(tabs)/account')} style={styles.link}>
        <Text>Back to sign in</Text>
      </Pressable>
    </View>
  </ScrollView></View>;
}

