import {
  StyleSheet,
  Alert,
  Button,
  View,
  Text,
  Switch,
  Platform,
  TouchableOpacity,
} from 'react-native';
import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

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
  const [useNow, setUseNow] = useState(false);

  const showPicker = (type: 'date' | 'time') => {
    setPickerMode(type);
    setShowDatePicker(true);
  };

  const pad = (n: number) => n.toString().padStart(2, '0');

  const formatDate = (d: Date) => {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const formatTime = (d: Date) => {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  };

  const handleGo = () => {
    if (!origin || !destination) {
      Alert.alert('Please select both origin and destination');
      return;
    }

    const now = new Date();
    const dateObj = useNow ? now : dateTime;

    const date = formatDate(dateObj);
    const time = formatTime(dateObj);

    navigation.navigate('route', {
      origin,
      destination,
      date,
      time,
      travelMode,
    });
  };

  return (
    <View style={styles.container}>
      <MapboxAutocomplete
        placeholder="Enter Origin"
        onSelect={setOrigin}
        style={styles.input}
      />
      <MapboxAutocomplete
        placeholder="Enter Destination"
        onSelect={setDestination}
        style={styles.input}
      />

      {/* Row 1: Date + Time + Now */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.timeBox, useNow && styles.disabledBox]}
          onPress={() => !useNow && showPicker('date')}
          disabled={useNow}
        >
          <Text style={useNow && styles.disabledText}>
            {dateTime.toLocaleDateString('en-CA', {
              timeZone: 'America/Winnipeg',
            })}
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

      {/* Row 2: Mode + Go Button */}
      <View style={styles.bottomRow}>
        <View style={styles.modePickerWrapper}>
          <Picker
            selectedValue={travelMode}
            onValueChange={(itemValue) => setTravelMode(itemValue)}
            // style={styles.modePicker}
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
            if (selectedDate) {
              setDateTime(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
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
  modePicker: {
    height: 40,
    width: '100%',
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
