import {
  StyleSheet,
  Alert,
  Platform,
  View,
  Pressable,
} from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { Text } from '@/components/Themed';
import { useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { playSoundAsync } from 'expo-audio';
import { mapLegs, Coordinate, RideLeg } from '@/lib/mapLegs';

const colorPalette = ['blue', 'black', 'green'];

const walkColor = '#6b7280';

const DEFAULT_LOCATION: Coordinate = {
  latitude: 49.8951,
  longitude: -97.1384,
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const route = useRoute();
  const { route: rawRoute, enableNapAlarm } = route.params || {};
  const ridesRef = useRef<RideLeg[]>([]);

  const [routeData, setRouteData] = useState<RideLeg[]>([]);
  const [walkData, setWalkData] = useState<Coordinate[][]>([]);
  const [locationMessage, setLocationMessage] = useState('Finding your location…');
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [alertedStops, setAlertedStops] = useState<Set<string>>(new Set());

  const squareDistanceOfTwoPoints = (a: Coordinate, b: Coordinate): number =>
    (a.latitude - b.latitude) ** 2 + (a.longitude - b.longitude) ** 2;

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;
    async function startLocation() {
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        const { status } = existing.granted ? existing : await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setLocationMessage('Allow location access in Settings to see your position.');
          return;
        }
        setLocationMessage('Waiting for a GPS signal…');
        subscription = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: false,
          timeInterval: 1000,
          distanceInterval: 0,
        }, location => {
          if (cancelled) return;
          setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
          setLocationMessage('');
        });
        if (cancelled) subscription.remove();
      } catch {
        if (!cancelled) setLocationMessage('Location unavailable. Check that device location is enabled.');
      }
    }
    void startLocation();
    return () => { cancelled = true; subscription?.remove(); };
  }, []);

  useEffect(() => {
    if (routeData.length === 0 || !mapRef.current) return;

    const allPoints: Coordinate[] = [...routeData.flatMap(route => route.points), ...walkData.flat()];
    if (allPoints.length === 0) return;

    mapRef.current.fitToCoordinates(allPoints, {
      edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
      animated: true,
    });
  }, [routeData, walkData]);

  // The backend attaches each ride's line (`path`) to the plan, so nothing else is fetched here.
  useEffect(() => {
    if (!rawRoute?.segments) return;
    const { rides, walks } = mapLegs(rawRoute.segments);
    ridesRef.current = rides;
    setRouteData(rides);
    setWalkData(walks);
  }, [rawRoute]);

  useEffect(() => {
    const rides = ridesRef.current;
    if (!enableNapAlarm || !rawRoute || !userLocation || rides.length === 0) return;

    (async () => {
      for (const ride of rides) {
        const stopName = ride.destination.name;
        if (alertedStops.has(stopName)) continue;

        const stopLocation: Coordinate = {
          latitude: ride.destination.latitude,
          longitude: ride.destination.longitude,
        };

        const distanceSq = squareDistanceOfTwoPoints(userLocation, stopLocation);
        if (distanceSq < 0.00001) {
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await playSoundAsync({ source: require('@/assets/alert.mp3') });
          } catch (e) {
            console.warn('Alarm error', e);
          }

          Alert.alert('Wake up!', `You're near: ${stopName}`);
          setAlertedStops(prev => new Set(prev).add(stopName));
          break;
        }
      }
    })();
  }, [userLocation]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: DEFAULT_LOCATION.latitude,
          longitude: DEFAULT_LOCATION.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
          maximumZ={19}
          zIndex={-1}
        />

        {walkData.map((points, index) => (
          <Polyline key={`walk-${index}`} coordinates={points} strokeWidth={3} strokeColor={walkColor} lineDashPattern={[6, 6]} zIndex={0} />
        ))}

        {routeData.map((route, index) => (
          <React.Fragment key={index}>
            {route.points && (
              <Polyline
                coordinates={route.points}
                strokeWidth={3}
                strokeColor={colorPalette[index % colorPalette.length]}
                zIndex={1}
              />
            )}
            <Marker coordinate={route.origin} pinColor={colorPalette[index % colorPalette.length]} title="Origin" />
            <Marker coordinate={route.destination} pinColor={colorPalette[index % colorPalette.length]} title="Destination" />
          </React.Fragment>
        ))}

        {userLocation && (
          <Marker
            coordinate={userLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Your location"
            zIndex={10}
          >
            <View collapsable={false} style={styles.userLocationDot} />
          </Marker>
        )}
      </MapView>

      <View style={styles.locationControls}>
        {!!locationMessage && <Text style={styles.locationMessage}>{locationMessage}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Center map on my location"
          disabled={!userLocation} style={[styles.locationButton, !userLocation && { opacity: 0.5 }]}
          onPress={() => { if (userLocation) mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }); }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>My location</Text>
        </Pressable>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  locationControls: { position: 'absolute', right: 16, bottom: 20, left: 16, alignItems: 'flex-end', gap: 8 },
  locationMessage: { backgroundColor: '#fff', color: '#333', padding: 10, borderRadius: 8 },
  locationButton: { backgroundColor: '#176b9c', padding: 14, borderRadius: 24, minHeight: 44 },
  userLocationDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(30, 144, 255, 0.35)',
    borderColor: 'rgba(30, 144, 255, 0.85)',
    borderWidth: 2,
  },
  container: {
    flex: 1,
  },
});
