import { StyleSheet, Alert  } from 'react-native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { Text, View } from '@/components/Themed';
import MapboxAutocomplete from '@/components/MapboxAutocomplete';

export default function TabOneScreen() {
  const handleSelect = (place) => {
    // Alert.alert('Selected Place', place.place_name);
    // Or use place.geometry.coordinates for latitude/longitude
  };

  return (
    <View style={styles.container}>
      <MapboxAutocomplete placeholder="Enter Origin" onSelect={handleSelect} />
      <MapboxAutocomplete placeholder="Enter Destination" onSelect={handleSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20, // Pushes content down from the very top
    alignItems: 'center', // Make children full width
    justifyContent: 'flex-start', // Align children from the top
    // justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});
