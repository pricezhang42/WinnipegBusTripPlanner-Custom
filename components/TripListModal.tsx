import React from 'react';
import { Modal, View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SavedTrip } from '@/lib/savedTrips';
export function TripListModal({ kind, trips, loading, error, busy, onClose, onSelect, onRemove, onRetry }: {
  kind: 'history' | 'favorites' | null; trips: SavedTrip[]; loading: boolean; error: string; busy: boolean;
  onClose: () => void; onSelect: (trip: SavedTrip) => void; onRemove: (trip: SavedTrip) => void; onRetry: () => void;
}) {
  return <Modal visible={!!kind} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}><View style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.row}><Text style={styles.title}>{kind === 'history' ? 'Recent trips' : 'Favorite trips'}</Text><Pressable accessibilityRole="button" onPress={onClose} style={styles.button}><Text>Close</Text></Pressable></View>
      {loading && <ActivityIndicator />}
      {!!error && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}><Text>{error} Tap to retry.</Text></Pressable>}
      <FlatList data={trips} keyExtractor={item => String(item.id ?? item.trip_key)} ListEmptyComponent={!loading && !error ? <Text style={styles.button}>{kind === 'history' ? 'Your last 10 successful trip searches will appear here.' : 'Plan a trip, then tap “Save Trip to Fav”.'}</Text> : null}
        renderItem={({ item }) => <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Use trip from ${item.origin.place_name} to ${item.destination.place_name}`} style={styles.trip} onPress={() => onSelect(item)}>
            <Text style={styles.name}>{item.origin.place_name}</Text><Text style={styles.destination}>To {item.destination.place_name}</Text>
            {kind === 'history' && <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>}
          </Pressable>
          {kind === 'favorites' && <Pressable accessibilityRole="button" accessibilityLabel={`Remove favorite trip to ${item.destination.place_name}`} disabled={busy} onPress={() => onRemove(item)} style={styles.button}><FontAwesome name="heart" size={24} color="#cc2446" /></Pressable>}
        </View>} />
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }, sheet: { backgroundColor: 'white', borderRadius: 16, padding: 16, maxHeight: '80%' }, row: { flexDirection: 'row', alignItems: 'center' }, title: { flex: 1, fontSize: 22, fontWeight: '700' }, button: { padding: 12, minHeight: 48 }, trip: { flex: 1, paddingVertical: 16, borderBottomWidth: 1, borderColor: '#eee' }, name: { fontWeight: '600' }, destination: { marginTop: 5 }, date: { color: '#666', marginTop: 8, fontSize: 12 } });
