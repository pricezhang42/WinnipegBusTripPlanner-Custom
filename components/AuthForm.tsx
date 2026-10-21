import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Text, View, useThemeColor } from './Themed';
import { supabase, authRedirect } from '@/lib/supabase';
import { resendSeconds, signupConfirmation } from '@/lib/signupConfirmation';

// Supabase's email OTP length and its 60-second per-address email limit.
const RESET_CODE_LENGTH = 6;
const RESET_RESEND_DELAY = 60_000;

export type AuthMode = 'login' | 'signup' | 'forgot' | 'code' | 'reset';
export function AuthForm({ reset = false }: { reset?: boolean }) {
  const [mode, setMode] = useState<AuthMode>(reset ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState('');
  const color = useThemeColor({}, 'text');
  const title = { login: 'Welcome back', signup: 'Create your account', forgot: 'Forgot password?', code: 'Enter your code', reset: 'Choose a new password' }[mode];
  const label = { login: 'Sign in', signup: 'Create account', forgot: 'Send code', code: 'Verify code', reset: 'Save password' }[mode];
  const descriptions: Partial<Record<AuthMode, string>> = {
    forgot: `We’ll email you a ${RESET_CODE_LENGTH}-digit code to reset your password.`,
    code: `If an account exists for ${email.trim()}, we sent it a ${RESET_CODE_LENGTH}-digit code. Check your spam folder if it hasn’t arrived.`,
  };
  const description = descriptions[mode] ?? 'Your next trip starts here. Trip planning is always available without an account.';
  const switchMode = (next: AuthMode) => { setMode(next); setPassword(''); setConfirmation(''); setCode(''); setMessage(''); };
  const remaining = mode === 'code' ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0;
  useEffect(() => {
    if (mode !== 'code') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [mode]);
  async function sendResetCode() {
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim());
    // A rate-limited request also waits out the cooldown instead of retrying immediately.
    if (!error || error.status === 429) { setResendAt(Date.now() + RESET_RESEND_DELAY); setNow(Date.now()); }
    if (error) throw error;
  }
  async function submit() {
    if (!supabase || busy || submitting.current) return;
    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage('Enter a valid email address.'); return; }
    if (mode === 'code' && code.length !== RESET_CODE_LENGTH) { setMessage(`Enter the ${RESET_CODE_LENGTH}-digit code from your email.`); return; }
    if (mode !== 'forgot' && mode !== 'code' && (!password || (mode !== 'login' && password.length < 8))) { setMessage(mode === 'login' ? 'Enter your password.' : 'Use at least 8 characters for your password.'); return; }
    if ((mode === 'signup' || mode === 'reset') && password !== confirmation) { setMessage('Passwords do not match.'); return; }
    submitting.current = true;
    setBusy(true); setMessage('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'signup') {
        // Returning to signup must not bypass the pending email's resend cooldown.
        const pending = await signupConfirmation.get(email.trim());
        if (pending && resendSeconds(pending) > 0) {
          await signupConfirmation.select(email.trim());
          switchMode('login');
          router.push('/auth/confirm-email');
          return;
        }
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirect() } });
        if (error) throw error;
        // With confirmation on, Supabase hides existing accounts behind a user with no identities and sends no email.
        if (!data.session && data.user?.identities?.length === 0) {
          switchMode('login');
          setMessage('An account with this email already exists. Sign in, or use “Forgot password?” to reset it.');
          return;
        }
        if (!data.session) {
          await signupConfirmation.remember(email.trim());
          switchMode('login');
          router.push('/auth/confirm-email');
        } else {
          router.replace('/(tabs)/account');
        }
      } else if (mode === 'forgot') {
        await sendResetCode();
        switchMode('code');
      } else if (mode === 'code') {
        const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'recovery' });
        if (error) throw error.status === 429 ? error : new Error('That code is incorrect or has expired. Check your latest email or send a new code.');
        if (data.session) router.replace('/auth/reset-password');
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        router.replace('/(tabs)/account');
      }
      setPassword(''); setConfirmation('');
    } catch (error) {
      setCode('');
      // Supabase returns a terse 'email rate limit exceeded' when its email quota is used up.
      const limited = !!error && typeof error === 'object' && 'status' in error && error.status === 429;
      setMessage(limited ? 'Too many emails have been sent recently. Please wait a few minutes and try again.'
        : error instanceof Error ? error.message : 'Unable to connect. Please try again.');
    } finally { submitting.current = false; setBusy(false); }
  }
  async function resendCode() {
    if (!supabase || busy || submitting.current || remaining > 0) return;
    submitting.current = true;
    setBusy(true); setMessage(''); setCode('');
    try {
      await sendResetCode();
      setMessage('A new code is on its way. Only the latest code works.');
    } catch (error) {
      const limited = !!error && typeof error === 'object' && 'status' in error && error.status === 429;
      setMessage(limited ? 'Too many emails have been sent recently. Please wait a few minutes and try again.'
        : error instanceof Error ? error.message : 'Unable to connect. Please try again.');
    } finally { submitting.current = false; setBusy(false); }
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {mode !== 'reset' && mode !== 'code' && <><Text>Email</Text><TextInput accessibilityLabel="Email" style={[styles.input, { color }]} value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" /></>}
          {mode === 'code' && <><Text>Code</Text><TextInput accessibilityLabel={`${RESET_CODE_LENGTH}-digit reset code`} style={[styles.input, { color }]} value={code} onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, RESET_CODE_LENGTH))} editable={!busy} keyboardType="number-pad" maxLength={RESET_CODE_LENGTH} textContentType="oneTimeCode" autoComplete="one-time-code" onSubmitEditing={submit} /></>}
          {mode !== 'forgot' && mode !== 'code' && <><Text>{mode === 'reset' ? 'New password' : 'Password'}</Text><TextInput accessibilityLabel="Password" style={[styles.input, { color }]} value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></>}
          {(mode === 'signup' || mode === 'reset') && <><Text>Confirm password</Text><TextInput accessibilityLabel="Confirm password" style={[styles.input, { color }]} value={confirmation} onChangeText={setConfirmation} editable={!busy} secureTextEntry autoCapitalize="none" autoComplete="new-password" /></>}
          {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={[styles.button, busy && { opacity: 0.6 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}</Pressable>
          {!reset && <>
            {mode === 'login' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => switchMode('forgot')} style={styles.link}><Text>Forgot password?</Text></Pressable>}
            {mode === 'code' && <Pressable accessibilityRole="button" disabled={busy || remaining > 0} onPress={resendCode} style={styles.link}><Text>{remaining > 0 ? `Resend code in ${remaining}s` : 'Resend code'}</Text></Pressable>}
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')} style={styles.link}><Text>{mode === 'login' ? 'New here? Create an account' : 'Back to sign in'}</Text></Pressable>
          </>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.replace('/(tabs)')} style={styles.link}><Text>Continue planning trips</Text></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 12, paddingVertical: 20 },
  title: { fontSize: 28, fontWeight: '700' }, description: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#888', borderRadius: 10, padding: 14, fontSize: 16, minHeight: 48 },
  button: { backgroundColor: '#176b9c', borderRadius: 10, padding: 16, alignItems: 'center', minHeight: 52, marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { padding: 12, alignItems: 'center', minHeight: 44 }, message: { lineHeight: 22, paddingVertical: 8 },
});
