import {
  AppState,
  StyleSheet,
  Pressable,
  Alert,
  View,
  Text,
  Switch,
  Platform,
  TouchableOpacity,
  FlatList,
  Keyboard,
} from 'react-native';
import React, { useState, useRef, useEffect } from 'react';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/providers/AuthProvider';
import { useSavedTrips } from '@/hooks/useSavedTrips';
import { Location, Trip, tripKey } from '@/lib/savedTrips';
import { TripListModal } from '@/components/TripListModal';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import RouteRetrieve from '@/components/RouteRetrieve';
import {
  NOW_TRAVEL_MODE, TRAVEL_MODES, WINNIPEG_TIME_ZONE, tripSearchTime, winnipegDateTime, type TravelMode,
} from '@/lib/tripSearchTime';
import { TripCard } from '@/components/TripCard';
import MapboxAutocomplete from '@/components/MapboxAutocomplete';

export default function MainScreen() {
  const navigation = useNavigation();

  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [selectedDateTime, setSelectedDateTime] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [travelMode, setTravelMode] = useState<TravelMode>(NOW_TRAVEL_MODE);
  const [useNow, setUseNow] = useState(true);
  const [enableNapAlarm, setEnableNapAlarm] = useState(false);

  useEffect(() => {
    if (!useNow) return;
    const refreshClock = () => {
      const current = new Date();
      // Only the displayed minute changes; avoid rendering the whole list every second.
      setNow(previous => Math.floor(previous.getTime() / 60000) === Math.floor(current.getTime() / 60000)
        ? previous : current);
    };
    refreshClock();
    const interval = setInterval(refreshClock, 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refreshClock(); });
    return () => { clearInterval(interval); listener.remove(); };
  }, [useNow]);

  const displayedTime = winnipegDateTime(useNow ? now : selectedDateTime);
  const activeTravelMode = useNow ? NOW_TRAVEL_MODE : travelMode;

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [shelters, setShelters] = useState<Record<string, string>>({});
  const [expandedTrips, setExpandedTrips] = useState<Set<number>>(new Set());

  const { session } = useAuth();
  const saved = useSavedTrips();
  useFocusEffect(React.useCallback(() => { void saved.refresh(); }, [saved.refresh]));
  const [activeInput, setActiveInput] = useState<'origin' | 'destination' | null>(null);
  const [tripList, setTripList] = useState<'history' | 'favorites' | null>(null);
  const [plannedTrip, setPlannedTrip] = useState<Trip | null>(null);
  const requestVersion = useRef(0);
  useEffect(() => { setTripList(null); }, [session?.user.id]);
  useEffect(() => () => { requestVersion.current++; }, []);
  function requireAccount() {
    if (session) return true;
    Alert.alert('Sign in to save your trips', 'Your favorite places and trips will be available on your account.', [
      { text: 'Not now', style: 'cancel' }, { text: 'Sign in', onPress: () => router.push('/(tabs)/account') },
    ]);
    return false;
  }
  async function saveAction(action: () => Promise<void>) {
    if (!requireAccount()) return;
    try { await action(); } catch (error) { Alert.alert('Saved trips', error instanceof Error ? error.message : 'Please try again.'); }
  }
  function openTrips(kind: 'history' | 'favorites') {
    setActiveInput(null); Keyboard.dismiss();
    if (!requireAccount()) return;
    setTripList(kind); saved.refresh();
  }
  function changeLocation(kind: 'origin' | 'destination', value: Location | null) {
    requestVersion.current++;
    setLoading(false); setPlans([]); setPlannedTrip(null); setExpandedTrips(new Set());
    if (kind === 'origin') setOrigin(value); else setDestination(value);
  }
  const routeRetrieve = new RouteRetrieve();

  const showPicker = (type: 'date' | 'time') => {
    setPickerMode(type);
    setShowDatePicker(true);
  };

  const handleGo = () => {
    if (!origin || !destination) {
      Alert.alert('Please select both origin and destination');
      return;
    }
    if (!loading) fetchPlans();
  };

  const fetchPlans = async () => {
    if (!origin || !destination) return;

    const currentInstant = new Date();
    const searchTime = tripSearchTime({ useNow, selectedDateTime, travelMode }, currentInstant);
    if (useNow) setNow(currentInstant);

    const version = ++requestVersion.current;
    const searchedTrip = { origin, destination };
    setActiveInput(null); Keyboard.dismiss();
    setPlannedTrip(null);
    setLoading(true);
    const { plans: result, shelters: shelterMap } = await routeRetrieve.getPlans(
      origin.geometry.coordinates,
      destination.geometry.coordinates,
      searchTime.date,
      searchTime.time,
      searchTime.mode
    );

    if (requestVersion.current !== version) return;

    for (const plan of result) {
      let totalTimeSheltered = 0;
      for (const segment of plan.segments || []) {
        const stopKey = segment.to?.stop?.key;
        const shelter = stopKey != null ? shelterMap[String(stopKey)] : undefined;
        if (
          (shelter === 'Heated Shelter' || shelter === 'Unheated Shelter') &&
          (segment.type === 'transfer' || segment.type === 'walk') &&
          segment.times?.durations?.waiting
        ) {
          totalTimeSheltered += segment.times.durations.waiting;
        }
      }
      plan['totalTimeSheltered'] = totalTimeSheltered;
    }

    setShelters(shelterMap);
    setPlans(result);
    setLoading(false);
    setExpandedTrips(new Set());
    if (result.length) {
      setPlannedTrip(searchedTrip);
      try { await saved.recordTrip(searchedTrip); }
      catch (error) { Alert.alert('Trip history', error instanceof Error ? error.message : 'Could not save history.'); }
    }
  };

  const renderCard = ({ item, index }: { item: any; index: number }) => (
    <TripCard plan={item} number={index + 1} expanded={expandedTrips.has(index)}
      originName={plannedTrip?.origin.place_name} destinationName={plannedTrip?.destination.place_name} shelters={shelters}
      onToggle={() => setExpandedTrips(previous => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next; })}
      onViewMap={() => (navigation as any).navigate('map', { route: item, enableNapAlarm })} />
  );

  return (
    <>
    <FlatList
      keyboardShouldPersistTaps="handled"
      data={plans}
      extraData={expandedTrips}
      keyExtractor={(_, index) => index.toString()}
      renderItem={renderCard}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <>
          <MapboxAutocomplete placeholder="Enter Origin" value={origin} onSelect={value => changeLocation('origin', value)}
            favorites={saved.locations} favoritesLoading={saved.loading} favoritesError={saved.error} busy={saved.busy}
            onToggleFavorite={location => saveAction(() => saved.toggleLocation(location))}
            active={activeInput === 'origin'} onFocus={() => { setActiveInput('origin'); saved.refresh(); }} onClose={() => setActiveInput(null)}
            action={<Pressable accessibilityRole="button" accessibilityLabel="Trip history" style={styles.iconButton} onPress={() => openTrips('history')}><FontAwesome name="history" size={24} color="#333" /></Pressable>} />
          <MapboxAutocomplete placeholder="Enter Destination" value={destination} onSelect={value => changeLocation('destination', value)}
            favorites={saved.locations} favoritesLoading={saved.loading} favoritesError={saved.error} busy={saved.busy}
            onToggleFavorite={location => saveAction(() => saved.toggleLocation(location))}
            active={activeInput === 'destination'} onFocus={() => { setActiveInput('destination'); saved.refresh(); }} onClose={() => setActiveInput(null)}
            action={<Pressable accessibilityRole="button" accessibilityLabel="Favorite trips" style={styles.iconButton} onPress={() => openTrips('favorites')}><FontAwesome name="heart" size={24} color="#cc2446" /></Pressable>} />

          <Text style={styles.timeZoneLabel}>Date and time · Winnipeg</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.timeBox, useNow && styles.disabledBox]}
              accessibilityLabel="Trip date in Winnipeg"
              onPress={() => !useNow && showPicker('date')}
              disabled={useNow}
            >
              <Text style={useNow && styles.disabledText}>
                {displayedTime.date}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.timeBox, useNow && styles.disabledBox]}
              accessibilityLabel="Trip time in Winnipeg"
              onPress={() => !useNow && showPicker('time')}
              disabled={useNow}
            >
              <Text style={useNow && styles.disabledText}>
                {displayedTime.time.slice(0, 5)}
              </Text>
            </TouchableOpacity>

            <View style={styles.switchWrapper}>
              <Text style={styles.switchLabel}>Now</Text>
              <Switch accessibilityLabel="Use current Winnipeg departure time" value={useNow} onValueChange={enabled => {
                setShowDatePicker(false);
                if (enabled) setNow(new Date());
                setUseNow(enabled);
              }} />
            </View>

            <View style={styles.switchWrapper}>
              <Text style={styles.switchLabel}>Nap Alarm</Text>
              <Switch value={enableNapAlarm} onValueChange={setEnableNapAlarm} />
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.modePickerWrapper}>
              <Picker
                selectedValue={activeTravelMode}
                onValueChange={setTravelMode}
                enabled={!useNow}
              >
                {TRAVEL_MODES.map((mode) => (
                  <Picker.Item label={mode} value={mode} key={mode} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity style={[styles.goButton, loading && { opacity: 0.5 }]} accessibilityLabel="Search trips" disabled={loading} onPress={handleGo}>
              <Text style={styles.goButtonText}>Go</Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDateTime}
              timeZoneName={WINNIPEG_TIME_ZONE}
              mode={pickerMode}
              is24Hour={true}
              display={Platform.OS === 'android' ? 'spinner' : 'default'}
              minimumDate={pickerMode === 'date' ? new Date() : undefined}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (event.type === 'set' && selectedDate) setSelectedDateTime(selectedDate);
              }}
            />
          )}

          {loading && <Text>Loading route plans…</Text>}
          {plannedTrip && <Pressable accessibilityRole="button"
            disabled={saved.busy || saved.favorites.some(trip => tripKey(trip) === tripKey(plannedTrip))}
            style={styles.saveButton} onPress={() => saveAction(() => saved.saveTrip(plannedTrip))}>
            <FontAwesome name="heart" size={18} color="#cc2446" />
            <Text style={{ color: '#a11936', fontWeight: '600' }}>{saved.favorites.some(trip => tripKey(trip) === tripKey(plannedTrip)) ? 'Saved to Favorites' : saved.busy ? 'Saving…' : 'Save Trip to Fav'}</Text>
          </Pressable>}
        </>
      }
    />
    <TripListModal kind={tripList} trips={tripList === 'history' ? saved.history : saved.favorites}
      loading={saved.loading} error={saved.error} busy={saved.busy} onRetry={saved.refresh}
      onClose={() => setTripList(null)} onRemove={trip => saveAction(() => saved.removeTrip(trip))}
      onSelect={trip => { changeLocation('origin', { ...trip.origin }); changeLocation('destination', { ...trip.destination }); setTripList(null); setActiveInput(null); Keyboard.dismiss(); }} />
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: { padding: 12, minWidth: 48, minHeight: 48 },
  saveButton: { flexDirection: 'row', gap: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#e5a6b3', borderRadius: 8, marginTop: 8 },
  container: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  input: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  timeZoneLabel: { marginBottom: 8, color: '#555', fontSize: 13 },
  timeBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginRight: 10,
    marginBottom: 10,
  },
  disabledBox: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ddd',
  },
  disabledText: {
    color: '#888',
  },
  switchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 5,
    marginBottom: 10,
  },
  switchLabel: {
    marginRight: 5,
    fontSize: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modePickerWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginRight: 10,
  },
  goButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
