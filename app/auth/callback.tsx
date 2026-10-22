import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { styles } from '@/components/AuthForm';
import { exchangeAuthCode } from '@/lib/authCallback';

// Only signup confirmation links land here. Password reset is code-only, so an old reset link
// (recovery=true) gets pointed at "Forgot password?" instead of being exchanged.
const OLD_RESET_LINK_MESSAGE = 'This password reset link is no longer used. Use Forgot password? to get a code.';
const INVALID_LINK_MESSAGE = 'This confirmation link is invalid or has expired. Request a new code from the confirmation page.';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; recovery?: string; error?: string }>();
  const [message, setMessage] = useState('');
  const { code, recovery, error } = params;
  const oldResetLink = recovery === 'true';
  useEffect(() => {
    if (oldResetLink) return;
    let active = true;
    setMessage('');
    async function complete() {
      try {
        if (error) throw new Error(INVALID_LINK_MESSAGE);
        if (!code || typeof code !== 'string') throw new Error('This confirmation link is missing its code. Request a new code from the confirmation page.');
        const { data, error: failure } = await exchangeAuthCode(code);
        if (failure || !data.session) throw new Error('This confirmation link could not be verified. Open it on the same device you signed up on, or enter the code from the email instead.');
        if (active) router.replace('/(tabs)/account');
      } catch (failure) { if (active) setMessage(failure instanceof Error ? failure.message : 'Unable to confirm your account. Please try again.'); }
    }
    complete();
    return () => { active = false; };
  }, [code, oldResetLink, error]);
  if (oldResetLink) return <View style={styles.container}>
    <Text style={styles.title}>Reset your password</Text><Text style={styles.message}>{OLD_RESET_LINK_MESSAGE}</Text>
    <Pressable accessibilityRole="button" testID="sign-in" style={styles.button} onPress={() => router.replace('/(tabs)/account')}><Text style={styles.buttonText}>Go to sign in</Text></Pressable>
  </View>;
  return <View style={styles.container}>{message ? <>
    <Text style={styles.title}>Unable to confirm</Text><Text style={styles.message}>{message}</Text>
    <Pressable accessibilityRole="button" testID="back" style={styles.button} onPress={() => router.replace('/(tabs)/account')}><Text style={styles.buttonText}>Back to account</Text></Pressable>
  </> : <><ActivityIndicator /><Text style={styles.message}>Confirming your account…</Text></>}</View>;
}
