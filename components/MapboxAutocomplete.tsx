import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet, ActivityIndicator, Keyboard } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import axios from 'axios';
import { apiUrl } from '@/constants/Backend';
import { Location, isLocation, locationKey } from '@/lib/savedTrips';

type Props = {
  placeholder: string; value: Location | null; onSelect: (value: Location | null) => void;
  favorites: Location[]; onToggleFavorite: (location: Location) => void;
  favoritesLoading?: boolean; favoritesError?: string; busy?: boolean;
  onFocus?: () => void; active: boolean; onClose: () => void; action: React.ReactNode;
};
export default function MapboxAutocomplete({ placeholder, value, onSelect, favorites, onToggleFavorite, favoritesLoading, favoritesError, busy, onFocus, active, onClose, action }: Props) {
  const [query, setQuery] = useState(value?.place_name ?? '');
  const [typed, setTyped] = useState(false);
  const [results, setResults] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<TextInput>(null);
  useEffect(() => { if (value) { setQuery(value.place_name); setTyped(false); setResults([]); } }, [value]);
  useEffect(() => {
    if (!active) input.current?.blur();
  }, [active]);
  useEffect(() => {
    setResults([]); setError(''); setLoading(false);
    if (!active || !typed || query.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await axios.get(apiUrl('/api/geocode'), { params: { q: query }, timeout: 8000, signal: controller.signal });
        if (!controller.signal.aborted) setResults((response.data?.features ?? []).filter(isLocation));
      } catch { if (!controller.signal.aborted) setError('Unable to search locations. Please try again.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, typed, active]);
  const showFavorites = !typed || query.length === 0;
  const items = showFavorites ? favorites : results;
  function select(item: Location) { onSelect(item); setQuery(item.place_name); setTyped(false); onClose(); Keyboard.dismiss(); }
  return <View style={styles.container}>
    <View style={styles.row}>
      <TextInput ref={input} accessibilityLabel={placeholder} placeholder={placeholder} style={styles.input} value={query}
        onFocus={() => { setTyped(false); onFocus?.(); }}
        onChangeText={text => { setQuery(text); setTyped(text.length > 0); setResults([]); onSelect(null); }} />
      {action}
    </View>
    {active && <View style={styles.list}>
      <Text style={styles.heading}>{showFavorites ? 'Favorite locations' : 'Search results'}</Text>
      {(showFavorites ? favoritesLoading : loading) && <ActivityIndicator />}
      {!!(showFavorites ? favoritesError : error) && <Text style={styles.message}>{showFavorites ? favoritesError : error}</Text>}
      {items.map(item => <View style={styles.row} key={locationKey(item)}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Select ${item.place_name}`} style={styles.item} onPress={() => select(item)}><Text>{item.place_name}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${favorites.some(f => locationKey(f) === locationKey(item)) ? 'Remove' : 'Save'} favorite ${item.place_name}`} disabled={busy} onPress={() => onToggleFavorite(item)} style={styles.heart}>
          <FontAwesome name={favorites.some(f => locationKey(f) === locationKey(item)) ? 'heart' : 'heart-o'} color="#cc2446" size={23} />
        </Pressable>
      </View>)}
      {!items.length && !loading && !favoritesLoading && !error && !favoritesError && <Text style={styles.message}>{showFavorites ? 'Save locations with the heart beside a search result.' : query.trim().length < 3 ? 'Type at least 3 characters to search.' : 'No matching locations.'}</Text>}
      <Pressable accessibilityRole="button" onPress={() => { onClose(); Keyboard.dismiss(); }} style={styles.heart}><Text>Close</Text></Pressable>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  container: { marginBottom: 16 }, row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#bbb', padding: 12, borderRadius: 8, minHeight: 48, color: '#111', backgroundColor: '#fff' },
  list: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginTop: 4 },
  heading: { padding: 12, fontWeight: '600', color: '#444' }, message: { padding: 12, color: '#555' },
  item: { flex: 1, padding: 12, minHeight: 48 }, heart: { padding: 12, minWidth: 48, minHeight: 48, alignItems: 'center' },
});
