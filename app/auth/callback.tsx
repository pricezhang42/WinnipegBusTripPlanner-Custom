import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { styles } from '@/components/AuthForm';
import { exchangeAuthCode } from '@/lib/authCallback';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; recovery?: string; error?: string; error_description?: string }>();
  const [message, setMessage] = useState('');
  const { code, recovery, error, error_description } = params;
  useEffect(() => {
    let active = true;
    setMessage('');
    async function complete() {
      try {
        if (error) throw new Error('This email link is invalid or has expired. Request a new link from Account.');
        if (!code || typeof code !== 'string') throw new Error('This link is missing its confirmation code. Request a new email from Account.');
        const { data, error: failure } = await exchangeAuthCode(code);
        if (failure || !data.session) throw new Error('This link could not be verified. Open it on the same device that requested it, or request a new link.');
        if (active) router.replace(recovery === 'true' ? '/auth/reset-password' : '/(tabs)/account');
      } catch (failure) { if (active) setMessage(failure instanceof Error ? failure.message : 'Unable to verify this link. Please try again.'); }
    }
    complete();
    return () => { active = false; };
  }, [code, recovery, error, error_description]);
  return <View style={styles.container}>{message ? <>
    <Text style={styles.title}>Unable to confirm</Text><Text style={styles.message}>{message}</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.replace('/(tabs)/account')}><Text style={styles.buttonText}>Back to account</Text></Pressable>
  </> : <><ActivityIndicator /><Text style={styles.message}>Confirming your account…</Text></>}</View>;
}
