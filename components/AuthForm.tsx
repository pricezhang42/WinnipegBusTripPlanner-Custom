import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Text, View, useThemeColor } from './Themed';
import { supabase, authRedirect } from '@/lib/supabase';

export type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';
export function AuthForm({ reset = false }: { reset?: boolean }) {
  const [mode, setMode] = useState<AuthMode>(reset ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const color = useThemeColor({}, 'text');
  const title = { login: 'Welcome back', signup: 'Create your account', forgot: 'Forgot password?', reset: 'Choose a new password' }[mode];
  const label = { login: 'Sign in', signup: 'Create account', forgot: 'Send reset link', reset: 'Save password' }[mode];
  const switchMode = (next: AuthMode) => { setMode(next); setPassword(''); setConfirmation(''); setMessage(''); };
  async function submit() {
    if (!supabase || busy) return;
    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage('Enter a valid email address.'); return; }
    if (mode !== 'forgot' && (!password || (mode !== 'login' && password.length < 8))) { setMessage(mode === 'login' ? 'Enter your password.' : 'Use at least 8 characters for your password.'); return; }
    if ((mode === 'signup' || mode === 'reset') && password !== confirmation) { setMessage('Passwords do not match.'); return; }
    setBusy(true); setMessage('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirect() } });
        if (error) throw error;
        if (!data.session) setMessage('Check your email to confirm your account. Open the link on this device, then sign in.');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect(true) });
        if (error) throw error;
        setMessage('If an account exists for this email, a reset link will arrive shortly. Open it on this device.');
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        router.replace('/(tabs)/account');
      }
      setPassword(''); setConfirmation('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to connect. Please try again.');
    } finally { setBusy(false); }
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{mode === 'forgot' ? 'We’ll email you a link to reset your password.' : 'Your next trip starts here. Trip planning is always available without an account.'}</Text>
          {mode !== 'reset' && <><Text>Email</Text><TextInput accessibilityLabel="Email" style={[styles.input, { color }]} value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" /></>}
          {mode !== 'forgot' && <><Text>{mode === 'reset' ? 'New password' : 'Password'}</Text><TextInput accessibilityLabel="Password" style={[styles.input, { color }]} value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></>}
          {(mode === 'signup' || mode === 'reset') && <><Text>Confirm password</Text><TextInput accessibilityLabel="Confirm password" style={[styles.input, { color }]} value={confirmation} onChangeText={setConfirmation} editable={!busy} secureTextEntry autoCapitalize="none" autoComplete="new-password" /></>}
          {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={[styles.button, busy && { opacity: 0.6 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}</Pressable>
          {!reset && <>
            {mode === 'login' && <Pressable accessibilityRole="button" disabled={busy} onPress={() => switchMode('forgot')} style={styles.link}><Text>Forgot password?</Text></Pressable>}
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
