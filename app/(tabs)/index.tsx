import {
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
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import RouteRetrieve from '@/components/RouteRetrieve';
import MapboxAutocomplete from '@/components/MapboxAutocomplete';

const MODES = ['depart-before', 'depart-after', 'arrive-before', 'arrive-after'];

export default function MainScreen() {
  const navigation = useNavigation();

  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [dateTime, setDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [travelMode, setTravelMode] = useState('depart-after');
  const [useNow, setUseNow] = useState(true);
  const [enableNapAlarm, setEnableNapAlarm] = useState(false);

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [shelters, setShelters] = useState<Record<string, string>>({});
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { session } = useAuth();
  const saved = useSavedTrips();
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
    setLoading(false); setPlans([]); setPlannedTrip(null);
    if (kind === 'origin') setOrigin(value); else setDestination(value);
  }
  const routeRetrieve = new RouteRetrieve();

  const showPicker = (type: 'date' | 'time') => {
    setPickerMode(type);
    setShowDatePicker(true);
  };

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

  const handleGo = () => {
    if (!origin || !destination) {
      Alert.alert('Please select both origin and destination');
      return;
    }
    if (!loading) fetchPlans();
  };

  const fetchPlans = async () => {
    if (!origin || !destination) return;

    const now = new Date();
    const dateObj = useNow ? now : dateTime;
    const date = formatDate(dateObj);
    const time = formatTime(dateObj);

    const version = ++requestVersion.current;
    const searchedTrip = { origin, destination };
    setActiveInput(null); Keyboard.dismiss();
    setPlannedTrip(null);
    setLoading(true);
    const { plans: result, shelters: shelterMap } = await routeRetrieve.getPlans(
      origin.geometry.coordinates,
      destination.geometry.coordinates,
      date,
      time,
      travelMode
    );

    if (requestVersion.current !== version) return;

    for (const plan of result) {
      let totalTimeSheltered = 0;
      for (const segment of plan.segments || []) {
        const stopKey = segment.to?.stop?.key;
        const shelter = stopKey != null ? shelterMap[String(stopKey)] : undefined;
        if (
          shelter &&
          shelter !== 'Unsheltered' &&
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
    setSelectedIndex(null);
    if (result.length) {
      setPlannedTrip(searchedTrip);
      try { await saved.recordTrip(searchedTrip); }
      catch (error) { Alert.alert('Trip history', error instanceof Error ? error.message : 'Could not save history.'); }
    }
  };

  const getShelterClass = (type: string) => {
    return ({
      'Heated Shelter': styles.shelterHeated,
      'Unheated Shelter': styles.shelterUnheated,
      'Unsheltered': styles.unsheltered,
    } as Record<string, object>)[type] || {};
  };

  const renderSegment = (segment: any, index: number) => {
    const startTime = segment.times?.start?.substring(11, 16);
    const stopKey = segment.to?.stop?.key;
    const shelter = stopKey ? shelters[stopKey] : null;

    if (segment.type === 'ride') {
      return (
        <Text key={index} style={styles.segment}>
          ● <Text style={styles.bold}>Ride:</Text> ({startTime}) {segment.times.durations.riding} min, Bus: {segment.route?.key}
        </Text>
      );
    } else if (segment.type === 'walk') {
      return (
        <Text key={index} style={styles.segment}>
          ● <Text style={styles.bold}>Walk:</Text> ({startTime}) {segment.times.durations.walking} min
          {shelter && <Text style={getShelterClass(shelter)}> ({shelter})</Text>}
        </Text>
      );
    } else if (segment.type === 'transfer') {
      return (
        <Text key={index} style={styles.segment}>
          ● <Text style={styles.bold}>Transfer:</Text> ({startTime}) Walking: {segment.times.durations.walking} min, Waiting: {segment.times.durations.waiting} min
          {shelter && <Text style={getShelterClass(shelter)}> ({shelter})</Text>}
        </Text>
      );
    }
    return null;
  };

  const renderCard = ({ item, index }: { item: any; index: number }) => (
    <Pressable
      key={index}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        selectedIndex === index && styles.cardSelected,
      ]}
      onPress={() => {
        setSelectedIndex(index);
        (navigation as any).navigate('map', { route: item, enableNapAlarm });
      }}
    >
      <Text style={styles.cardTitle}>Total Time: {item.times.durations.total} min</Text>
      <Text style={styles.cardTitle}>
        Time Outside: {item.times.durations.waiting + item.times.durations.walking} min ({item.totalTimeSheltered} min sheltered)
      </Text>
      {item.segments.map((seg: any, i: number) => renderSegment(seg, i))}
    </Pressable>
  );

  return (
    <>
    <FlatList
      keyboardShouldPersistTaps="handled"
      data={plans}
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

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.timeBox, useNow && styles.disabledBox]}
              onPress={() => !useNow && showPicker('date')}
              disabled={useNow}
            >
              <Text style={useNow && styles.disabledText}>
                {dateTime.toLocaleDateString('en-CA', { timeZone: 'America/Winnipeg' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.timeBox, useNow && styles.disabledBox]}
              onPress={() => !useNow && showPicker('time')}
              disabled={useNow}
            >
              <Text style={useNow && styles.disabledText}>
                {dateTime.toLocaleTimeString('en-CA', {
                  timeZone: 'America/Winnipeg',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </Text>
            </TouchableOpacity>

            <View style={styles.switchWrapper}>
              <Text style={styles.switchLabel}>Now</Text>
              <Switch value={useNow} onValueChange={setUseNow} />
            </View>

            <View style={styles.switchWrapper}>
              <Text style={styles.switchLabel}>Nap Alarm</Text>
              <Switch value={enableNapAlarm} onValueChange={setEnableNapAlarm} />
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.modePickerWrapper}>
              <Picker
                selectedValue={travelMode}
                onValueChange={setTravelMode}
                enabled={!useNow}
              >
                {MODES.map((mode) => (
                  <Picker.Item label={mode} value={mode} key={mode} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity style={[styles.goButton, loading && { opacity: 0.5 }]} disabled={loading} onPress={handleGo}>
              <Text style={styles.goButtonText}>Go</Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={dateTime}
              mode={pickerMode}
              is24Hour={true}
              display={Platform.OS === 'android' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDateTime(selectedDate);
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
  card: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  cardPressed: {
    backgroundColor: '#e0e0e0',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#d0e8ff',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  segment: {
    fontSize: 13,
    marginTop: 2,
  },
  bold: {
    fontWeight: 'bold',
  },
  shelterHeated: {
    color: 'green',
  },
  shelterUnheated: {
    color: 'blue',
  },
  unsheltered: {
    color: 'red',
  },
});
