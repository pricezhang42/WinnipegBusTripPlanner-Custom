import {
  StyleSheet,
  Alert,
  Platform,
  View,
  ActivityIndicator,
} from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import MapView, { Marker, Polyline, UrlTile, Circle } from 'react-native-maps';
import { Text } from '@/components/Themed';
import { useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { playSoundAsync } from 'expo-audio';
import axios from 'axios';
import { apiUrl } from '@/constants/Backend';

const colorPalette = ['blue', 'black', 'green'];

interface Coordinate {
  latitude: number;
  longitude: number;
}

type RouteData = {
  origin: Coordinate;
  destination: Coordinate;
  points: Coordinate[];
};

interface Ride {
  bus: string | number;
  origin: Coordinate & { name: string };
  destination: Coordinate & { name: string };
}

const DEFAULT_LOCATION: Coordinate = {
  latitude: 49.8951,
  longitude: -97.1384,
};

const ROUTE_SHAPE_TIMEOUT_MS = 10000;

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const route = useRoute();
  const { route: rawRoute, enableNapAlarm } = route.params || {};
  const ridesRef = useRef<Ride[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [userLocation, setUserLocation] = useState<Coordinate>(DEFAULT_LOCATION);
  const [pulseRadius, setPulseRadius] = useState(40);
  const [alertedStops, setAlertedStops] = useState<Set<string>>(new Set());

  const squareDistanceOfTwoPoints = (a: Coordinate, b: Coordinate): number =>
    (a.latitude - b.latitude) ** 2 + (a.longitude - b.longitude) ** 2;

  const fetchRouteShape = async (ride: Ride): Promise<Coordinate[] | null> => {
    if (ride.bus == null || !ride.origin || !ride.destination) return null;
    try {
      const response = await axios.get(apiUrl('/api/route-shape'), {
        params: {
          route: String(ride.bus),
          from: `${ride.origin.latitude},${ride.origin.longitude}`,
          to: `${ride.destination.latitude},${ride.destination.longitude}`,
        },
        timeout: ROUTE_SHAPE_TIMEOUT_MS,
      });
      const points = response.data?.points;
      if (!Array.isArray(points) || points.length < 2) return null;
      return points.map(([lat, lng]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      }));
    } catch (err) {
      console.warn('Route shape fetch failed:', err instanceof Error ? err.message : err);
      return null;
    }
  };

  const updateUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        maximumAge: 0,
      });
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (err) {
      console.warn('Location error:', err);
    }
  };

  useEffect(() => {
    updateUserLocation();
    const intervalId = setInterval(updateUserLocation, 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let growing = true;
    const pulseInterval = setInterval(() => {
      setPulseRadius(prev =>
        growing ? (prev >= 60 ? (growing = false, prev - 2) : prev + 2)
                : (prev <= 40 ? (growing = true, prev + 2) : prev - 2)
      );
    }, 100);
    return () => clearInterval(pulseInterval);
  }, []);

  useEffect(() => {
    if (routeData.length === 0 || !mapRef.current) return;

    const allPoints: Coordinate[] = routeData.flatMap(route => route.points);
    if (allPoints.length === 0) return;

    mapRef.current.fitToCoordinates(allPoints, {
      edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
      animated: true,
    });
  }, [routeData]);

  const fetchRouteData = async (rides: Ride[]) => {
    setLoading(true);
    setError(null);
    setRouteData([]);

    try {
      const results = await Promise.all(
        rides.map(async (ride): Promise<RouteData> => {
          const shape = await fetchRouteShape(ride);
          if (shape) {
            return {
              origin: { latitude: ride.origin.latitude, longitude: ride.origin.longitude },
              destination: { latitude: ride.destination.latitude, longitude: ride.destination.longitude },
              points: shape,
            };
          }
          return {
            origin: ride.origin,
            destination: ride.destination,
            points: [ride.origin, ride.destination],
          };
        })
      );
      setRouteData(results);
    } catch (err) {
      console.error('Route shape load error:', err);
      Alert.alert('Error', 'Failed to load one or more routes.');
      setError('Failed to load route data');
    } finally {
      setLoading(false);
    }
  };

  const getGeographic = (location: any): { latitude: string; longitude: string } | null => {
    try {
      if (location?.stop?.centre?.geographic) return location.stop.centre.geographic;
      if (location?.origin?.monument?.address?.centre?.geographic) return location.origin.monument.address.centre.geographic;
      if (location?.origin?.point?.centre?.geographic) return location.origin.point.centre.geographic;
      if (location?.origin?.address?.centre?.geographic) return location.origin.address.centre.geographic;
      if (location?.destination?.monument?.address?.centre?.geographic) return location.destination.monument.address.centre.geographic;
      if (location?.destination?.point?.centre?.geographic) return location.destination.point.centre.geographic;
      if (location?.destination?.address?.centre?.geographic) return location.destination.address.centre.geographic;
    } catch (err) {
      console.warn('Invalid location object:', location, err);
    }
    return null;
  };

  useEffect(() => {
    const route = rawRoute;
    if (!route || !route.segments) return;

    ridesRef.current = [];
    const rides = ridesRef.current;
    let skipSeg = false;

    route.segments.forEach((segment, index) => {
      if (!skipSeg && segment.type === 'ride') {
        let nextSeg = route.segments[index + 1];
        if (nextSeg?.type === 'ride') {
          nextSeg = route.segments[index + 2];
          skipSeg = true;
        }

        const toGeo = getGeographic(nextSeg?.from);
        const prevSeg = route.segments[index - 1];
        const fromGeo = getGeographic(prevSeg?.to);

        if (segment.route?.key != null && toGeo && fromGeo && prevSeg?.to?.stop?.name && nextSeg?.from?.stop?.name) {
          rides.push({
            bus: segment.route.key,
            origin: {
              latitude: parseFloat(fromGeo.latitude),
              longitude: parseFloat(fromGeo.longitude),
              name: prevSeg.to.stop.name,
            },
            destination: {
              latitude: parseFloat(toGeo.latitude),
              longitude: parseFloat(toGeo.longitude),
              name: nextSeg.from.stop.name,
            },
          });
        }
      } else {
        skipSeg = false;
      }
    });

    if (rides.length > 0) {
      fetchRouteData(rides);
    }
  }, [rawRoute]);

  useEffect(() => {
    const rides = ridesRef.current;
    if (!enableNapAlarm || !rawRoute || rides.length === 0) return;

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
          <Circle
            center={userLocation}
            radius={pulseRadius}
            strokeColor="rgba(30, 144, 255, 0.8)"
            fillColor="rgba(30, 144, 255, 0.3)"
            zIndex={2}
          />
        )}
      </MapView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}

      {error && <Text style={{ color: 'red', position: 'absolute', top: 10 }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    zIndex: 2,
  },
});
