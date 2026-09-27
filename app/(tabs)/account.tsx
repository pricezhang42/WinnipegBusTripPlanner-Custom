import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSavedTrips } from '@/hooks/useSavedTrips';
import { SavedItemsManagement } from '@/components/SavedItemsManagement';
import { Text, View } from '@/components/Themed';
import { AuthForm, styles } from '@/components/AuthForm';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';

export default function AccountScreen() {
  const { session, loading, error } = useAuth();
  const saved = useSavedTrips();
  useFocusEffect(React.useCallback(() => { void saved.refresh(); }, [saved.refresh]));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch { setMessage('Could not sign out. Please check your connection and try again.'); }
    finally { setBusy(false); }
  }
  if (loading) return <View style={styles.container}><ActivityIndicator accessibilityLabel="Restoring account" /></View>;
  if (!supabase) return <View style={styles.container}><Text style={styles.title}>Accounts are coming soon</Text><Text style={styles.description}>Sign-in isn’t available yet. You can still search for trips and explore the map.</Text></View>;
  if (!session) return <View style={{ flex: 1 }}>{!!error && <Text style={styles.message}>{error}</Text>}<AuthForm /></View>;
  return <View style={{ flex: 1 }}><ScrollView contentContainerStyle={{ padding: 24 }}><View style={styles.card}>
    <Text style={styles.title}>Your account</Text><Text style={styles.description}>Signed in as {session.user.email}</Text>
    {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
    <Pressable accessibilityRole="button" disabled={busy} onPress={signOut} style={styles.button}><Text style={styles.buttonText}>{busy ? 'Signing out…' : 'Sign out'}</Text></Pressable>
    <SavedItemsManagement key={session.user.id} saved={saved} />
  </View></ScrollView></View>;
}
