import { StyleSheet } from 'react-native';

import { useRoute } from '@react-navigation/native';
import { Text, View } from '@/components/Themed';

export default function RouteScreen() {
  const route = useRoute();
  const { origin, destination } = route.params || {};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Origin:</Text>
      <Text>{origin?.place_name || 'Not provided'}</Text>
      <Text>{origin?.geometry.coordinates[1] || 'Not provided'}, {origin?.geometry.coordinates[0] || 'Not provided'}</Text>

      <Text style={styles.title}>Destination:</Text>
      <Text>{destination?.place_name || 'Not provided'}</Text>
      <Text>{destination?.geometry.coordinates[1] || 'Not provided'}, {destination?.geometry.coordinates[0] || 'Not provided'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
