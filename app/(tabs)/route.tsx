import { StyleSheet, ScrollView, Pressable } from 'react-native';
import React, { useEffect, useState } from 'react';
import RouteRetrieve from '@/components/RouteRetrieve';
import { useRoute } from '@react-navigation/native';
import { Text } from '@/components/Themed';
import { useNavigation } from '@react-navigation/native';

export default function RouteScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { origin, destination, date, time, travelMode } = route.params || {};

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shelters, setShelters] = useState({});

  const routeRetrieve = new RouteRetrieve();

  const fetchPlans = async () => {
    if (!origin || !destination) return;
  
    setLoading(true);
    const result = await routeRetrieve.getPlans(
      origin.geometry.coordinates,
      destination.geometry.coordinates,
      date,
      time,
      travelMode
    );
  
    setPlans(result || []);
    setLoading(false);
  
    // Fetch shelters for all stops in all segments
    const shelterMap = {};
  
    for (const plan of result || []) {
      let totalTimeSheltered = 0;
      for (const segment of plan.segments || []) {
        const stopKey = segment.to?.stop?.key;
        if (stopKey && !shelterMap[stopKey]) {
          try {
            const shelter = await routeRetrieve.fetchStopShelter(stopKey);
            shelterMap[stopKey] = shelter;
            if ((segment.type === "transfer" || segment.type === "walk") && shelter !== 'Unsheltered' && segment.times.durations.waiting) {
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
  };

  const getShelterClass = (shelterType: string) => {
    switch (shelterType) {
      case 'Heated Shelter':
        return 'shelterHeated';
      case 'Unheated Shelter':
        return 'shelterUnheated';
      case 'Unsheltered':
        return 'unsheltered';
      default:
        return '';
    }
  };
  

  useEffect(() => {
    fetchPlans();
  }, [origin, destination, date, time, travelMode]);

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
          {shelter ? (
            <Text style={styles[getShelterClass(shelter)]}> ({shelter})</Text>
          ) : null}
        </Text>
      );
    } else if (segment.type === 'transfer') {
      return (
        <Text key={index} style={styles.segment}>
          ● <Text style={styles.bold}>Transfer:</Text> ({startTime}) Walking: {segment.times.durations.walking} min, Waiting: {segment.times.durations.waiting} min
          {shelter ? (
            <Text style={styles[getShelterClass(shelter)]}> ({shelter})</Text>
          ) : null}
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
        console.log(`Pressed route ${index + 1}`);
        navigation.navigate('map', {
          route: plans[index],
        });
      }}
    >
      <Text style={styles.cardTitle}>Total Time: {plan.times.durations.total} min</Text>
      <Text style={styles.cardTitle}>Time Outside: {plan.times.durations.waiting+plan.times.durations.walking} min ({plan.totalTimeSheltered} min sheltered)</Text>
      {plan.segments.map((segment, i) => renderSegment(segment, i))}
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* <Text style={styles.subHeader}>FROM: {origin?.place_name || 'Not provided'}</Text>
      <Text style={styles.subHeader}>TO: {destination?.place_name || 'Not provided'}</Text> */}

      {loading ? (
        <Text>Loading route plans...</Text>
      ) : plans.length === 0 ? (
        <Text>Please enter origin and destination.</Text>
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
