import { StyleSheet, ScrollView, Pressable } from 'react-native';
import React, { useEffect, useState } from 'react';
import RouteRetrieve from '@/components/RouteRetrieve';
import { useRoute } from '@react-navigation/native';
import { Text, View } from '@/components/Themed';
import { useNavigation } from '@react-navigation/native';

export default function RouteScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { origin, destination, date, time, travelMode } = route.params || {};

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = async () => {
    if (!origin || !destination) return;
    const routeRetrieve = new RouteRetrieve();
    const result = await routeRetrieve.getPlans(
      origin.geometry.coordinates,
      destination.geometry.coordinates,
      date,
      time,
      travelMode
    );
    setPlans(result || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlans();
  }, [origin, destination, date, time, travelMode]);

  const renderSegment = (segment, index) => {
    const startTime = segment.times?.start?.substring(11, 16);
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
          {segment.to?.stop?.shelter ? ` (${segment.to.stop.shelter})` : ''}
        </Text>
      );
    } else if (segment.type === 'transfer') {
      return (
        <Text key={index} style={styles.segment}>
          ● <Text style={styles.bold}>Transfer:</Text> ({startTime}) Walking: {segment.times.durations.walking} min, Waiting: {segment.times.durations.waiting} min
          {segment.to?.stop?.shelter ? ` (${segment.to.stop.shelter})` : ''}
        </Text>
      );
    }
    return null;
  };

  const renderCard = (plan, index) => (
    <Pressable
      key={index}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed
      ]}
      onPress={() => {
        // Currently does nothing; ready for interaction
        console.log(`Pressed route ${index + 1}`);
        // console.log(plans[index]);
        navigation.navigate('map', {
          route: plans[index],
        });
      }}
    >
      <Text style={styles.cardTitle}>Route {index + 1}</Text>
      {plan.segments.map((segment, i) => renderSegment(segment, i))}
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Route Options</Text>
      <Text style={styles.subHeader}>Origin: {origin?.place_name || 'Not provided'}</Text>
      <Text style={styles.subHeader}>Destination: {destination?.place_name || 'Not provided'}</Text>

      {loading ? (
        <Text>Loading route plans...</Text>
      ) : plans.length === 0 ? (
        <Text>No route plans found.</Text>
      ) : (
        plans.map((plan, i) => renderCard(plan, i))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subHeader: {
    fontSize: 14,
    marginBottom: 4,
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  segment: {
    fontSize: 13,
    marginTop: 2,
  },
  bold: {
    fontWeight: 'bold',
  },
});


//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>Origin:</Text>
//       <Text>{origin?.place_name || 'Not provided'}</Text>
//       <Text>{origin?.geometry.coordinates[1]}, {origin?.geometry.coordinates[0]}</Text>

//       <Text style={styles.title}>Destination:</Text>
//       <Text>{destination?.place_name || 'Not provided'}</Text>
//       <Text>{destination?.geometry.coordinates[1]}, {destination?.geometry.coordinates[0]}</Text>

//       <Text style={styles.title}>Plans:</Text>
//       {loading ? (
//         <Text>Loading plans...</Text>
//       ) : (
//         plans.length === 0 ? (
//           <Text>No plans found.</Text>
//         ) : (
//           plans.map((plan, index) => (
//             <View key={index} style={{ marginTop: 10 }}>
//               <Text>Plan {index + 1}</Text>
//               {/* You can customize what to display based on `plan` structure */}
//               <Text>Segments: {plan.segments?.length ?? 0}</Text>
//             </View>
//           ))
//         )
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 20,
//     alignItems: 'flex-start',
//     justifyContent: 'flex-start',
//   },
//   title: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     marginTop: 10,
//   },
// });
