import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSavedTrips } from '@/hooks/useSavedTrips';
import { locationKey, SavedTrip, tripKey } from '@/lib/savedTrips';

export function SavedItemsManagement({ saved }: { saved: ReturnType<typeof useSavedTrips> }) {
  const [message, setMessage] = useState('');
  async function remove(operation: () => Promise<void>) {
    setMessage('');
    try { await operation(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete this item. Please try again.'); }
  }
  const row = (key: string, label: string, action: () => Promise<void>, detail?: string) => (
    <View key={key} style={styles.row}>
      <View style={styles.label}><Text>{label}</Text>{detail && <Text style={styles.detail}>{detail}</Text>}</View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${label}`} disabled={saved.busy || saved.loading}
        onPress={() => { void remove(action); }} style={({ pressed }) => [styles.delete, { opacity: saved.busy || saved.loading ? .45 : pressed ? .65 : 1 }]}>
        <Text style={styles.deleteText}>Delete</Text>
      </Pressable>
    </View>
  );
  const tripLabel = (trip: SavedTrip) => `${trip.origin.place_name} → ${trip.destination.place_name}`;
  return <View style={styles.container}>
    {!!(message || saved.error) && <Text accessibilityRole="alert" accessibilityLiveRegion="polite">{message || saved.error}</Text>}
    {saved.loading && <ActivityIndicator accessibilityLabel="Loading saved items" />}
    {!!saved.error && <Pressable accessibilityRole="button" onPress={() => { void saved.refresh(); }} style={styles.retry}><Text>Try again</Text></Pressable>}
    <Text style={styles.heading}>Favorite locations</Text>
    {!saved.loading && !saved.error && saved.locations.length === 0 && <Text>No favorite locations yet.</Text>}
    {saved.locations.map(location => row(locationKey(location), location.place_name, () => saved.removeLocation(location)))}
    <Text style={styles.heading}>Favorite trips</Text>
    {!saved.loading && !saved.error && saved.favorites.length === 0 && <Text>No favorite trips yet.</Text>}
    {saved.favorites.map(trip => row(trip.trip_key ?? tripKey(trip), tripLabel(trip), () => saved.removeTrip(trip)))}
    <Text style={styles.heading}>Trip history</Text>
    <Text style={styles.detail}>Your 10 most recently planned trips</Text>
    {!saved.loading && !saved.error && saved.history.length === 0 && <Text>No trip history yet.</Text>}
    {saved.history.map(trip => row(String(trip.id ?? tripKey(trip)), tripLabel(trip), () => saved.removeHistory(trip), new Date(trip.created_at).toLocaleString()))}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 8 }, heading: { fontSize: 20, fontWeight: '600', marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#888' },
  label: { flex: 1, gap: 6 }, detail: { fontSize: 13, opacity: .7 },
  delete: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#b42318' },
  deleteText: { color: '#fff', fontWeight: '600' }, retry: { minHeight: 44, justifyContent: 'center' },
});
