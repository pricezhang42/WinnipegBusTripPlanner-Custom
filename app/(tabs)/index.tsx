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
} from 'react-native';
import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import RouteRetrieve from '@/components/RouteRetrieve';
import MapboxAutocomplete from '@/components/MapboxAutocomplete';

const MODES = ['depart-before', 'depart-after', 'arrive-before', 'arrive-after'];

export default function MainScreen() {
  const navigation = useNavigation();

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [dateTime, setDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [travelMode, setTravelMode] = useState('depart-after');
  const [useNow, setUseNow] = useState(true);

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shelters, setShelters] = useState({});

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
    fetchPlans();
  };

  const fetchPlans = async () => {
    if (!origin || !destination) return;

    const now = new Date();
    const dateObj = useNow ? now : dateTime;
    const date = formatDate(dateObj);
    const time = formatTime(dateObj);

    setLoading(true);
    const result = await routeRetrieve.getPlans(
      origin.geometry.coordinates,
      destination.geometry.coordinates,
      date,
      time,
      travelMode
    );

    const shelterMap = {};
    for (const plan of result || []) {
      let totalTimeSheltered = 0;
      for (const segment of plan.segments || []) {
        const stopKey = segment.to?.stop?.key;
        if (stopKey && !shelterMap[stopKey]) {
          try {
            const shelter = await routeRetrieve.fetchStopShelter(stopKey);
            shelterMap[stopKey] = shelter;
            if (
              (segment.type === 'transfer' || segment.type === 'walk') &&
              shelter !== 'Unsheltered' &&
              segment.times.durations.waiting
            ) {
              totalTimeSheltered += segment.times.durations.waiting;
            }
          } catch (e) {
            console.warn('Failed to fetch shelter for stop', stopKey, e);
          }
        }
      }
      plan['totalTimeSheltered'] = totalTimeSheltered;
    }

    setShelters(shelterMap);
    setPlans(result || []);
    setLoading(false);
  };

  const getShelterClass = (type) => {
    return {
      'Heated Shelter': styles.shelterHeated,
      'Unheated Shelter': styles.shelterUnheated,
      'Unsheltered': styles.unsheltered,
    }[type] || {};
  };

  const renderSegment = (segment, index) => {
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

  const renderCard = ({ item, index }) => (
    <Pressable
      key={index}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => navigation.navigate('map', { route: item })}
    >
      <Text style={styles.cardTitle}>Total Time: {item.times.durations.total} min</Text>
      <Text style={styles.cardTitle}>
        Time Outside: {item.times.durations.waiting + item.times.durations.walking} min ({item.totalTimeSheltered} min sheltered)
      </Text>
      {item.segments.map((seg, i) => renderSegment(seg, i))}
    </Pressable>
  );

  return (
    <FlatList
      data={plans}
      keyExtractor={(_, index) => index.toString()}
      renderItem={renderCard}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <>
          <MapboxAutocomplete placeholder="Enter Origin" onSelect={setOrigin} style={styles.input} />
          <MapboxAutocomplete placeholder="Enter Destination" onSelect={setDestination} style={styles.input} />

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

            <TouchableOpacity style={styles.goButton} onPress={handleGo}>
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
          {/* {!loading && plans.length === 0 && <Text>Please enter origin and destination.</Text>} */}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
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
    flexWrap: 'nowrap',
  },
  timeBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginRight: 10,
  },
  disabledBox: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ddd',
  },
  disabledText: {
    color: '#888',
  },
  switchWrapper: {
    marginLeft: 15,
    flexDirection: 'row',
    alignItems: 'center',
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
