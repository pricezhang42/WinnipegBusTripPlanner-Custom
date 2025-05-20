import { StyleSheet, Alert, Button } from 'react-native';
import React, { useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { Text, View } from '@/components/Themed';
import MapboxAutocomplete from '@/components/MapboxAutocomplete';

export default function MainScreen() {
  const navigation = useNavigation();

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);

  const handleGo = () => {
    if (!origin || !destination) {
      Alert.alert('Please select both origin and destination');
      return;
    }

    navigation.navigate('route', {
      origin,
      destination,
    });
  };

  return (
    <View style={styles.container}>
      <MapboxAutocomplete placeholder="Enter Origin" onSelect={setOrigin} />
      <MapboxAutocomplete placeholder="Enter Destination" onSelect={setDestination} />
      <Button title="Go" onPress={handleGo} />
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
