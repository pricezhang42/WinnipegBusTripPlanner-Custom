import {
  StyleSheet,
  Alert,
  Platform,
  View,
  ActivityIndicator,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { Text } from '@/components/Themed';
import { useRoute } from '@react-navigation/native';

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
  bus: string;
  origin: {
    latitude: number;
    longitude: number;
    name: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    name: string;
  };
}

interface Segment {
  type: string;
  route?: { key: string };
  from: any;
  to: any;
}

interface Route {
  segments: Segment[];
}

export default function MapScreen() {
  const route = useRoute();
  const { route: rawRoute } = route.params || {};

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState<RouteData[]>([]);

  const squareDistanceOfTwoPoints = (a: Coordinate, b: Coordinate): number =>
    (a.latitude - b.latitude) ** 2 + (a.longitude - b.longitude) ** 2;

  const extractCoordinatesBetweenStops = (
    coordinates: Coordinate[],
    origin: Coordinate,
    destination: Coordinate
  ): Coordinate[] => {
    let startIndex = 0;
    let endIndex = 0;
    let closestDistanceStart = Infinity;
    let closestDistanceEnd = Infinity;

    for (let i = 0; i < coordinates.length; i++) {
      const disStart = squareDistanceOfTwoPoints(coordinates[i], origin);
      const disEnd = squareDistanceOfTwoPoints(coordinates[i], destination);

      if (disStart < closestDistanceStart) {
        closestDistanceStart = disStart;
        startIndex = i;
      }
      if (disEnd < closestDistanceEnd) {
        closestDistanceEnd = disEnd;
        endIndex = i;
      }
    }

    return coordinates.slice(startIndex, endIndex + 1);
  };

  const extractWayCoordinates = (relation: any, nodes: Coordinate[]): Coordinate[] => {
    const coordinates: Coordinate[] = [];
    const ways = relation.members.filter((m: any) => m.type === 'way' && m.geometry);

    ways.forEach((way: any, index: number) => {
      let startNodeOfWay: Coordinate =
        index === 0 ? nodes[0] : coordinates[coordinates.length - 1];

      const coords = way.geometry.map((pt: any) => ({
        latitude: pt.lat,
        longitude: pt.lon,
      }));

      const disStart = squareDistanceOfTwoPoints(coords[0], startNodeOfWay);
      const disEnd = squareDistanceOfTwoPoints(coords[coords.length - 1], startNodeOfWay);

      if (disStart > disEnd) coords.reverse();

      coords.forEach((pt: Coordinate) => {
        if (
          coordinates.length === 0 ||
          pt.latitude !== coordinates[coordinates.length - 1].latitude ||
          pt.longitude !== coordinates[coordinates.length - 1].longitude
        ) {
          coordinates.push(pt);
        }
      });
    });

    return coordinates;
  };

  const extractAllNodes = (relation: any): Coordinate[] => {
    return relation.members
      .filter((m: any) => m.type === 'node' && m.lat && m.lon)
      .map((node: any) => ({
        latitude: node.lat,
        longitude: node.lon,
      }));
  };

  const findRelationWithNodes = (
    data: any,
    originNodeId: number,
    destinationNodeId: number
  ): any => {
    return data.elements.find((element: any) => {
      if (element.type !== 'relation') return false;

      const members = element.members;
      const originIndex = members.findIndex((m: any) => m.ref === originNodeId);
      const destinationIndex = members.findIndex((m: any) => m.ref === destinationNodeId);

      return originIndex !== -1 && destinationIndex !== -1 && originIndex < destinationIndex;
    });
  };

  const extractNodes = (
    data: any,
    ride: Ride
  ): { originNode: { id: number; coordinates: Coordinate } | null; destinationNode: { id: number; coordinates: Coordinate } | null } => {
    let originNode = null;
    let destinationNode = null;

    data.elements.forEach((element: any) => {
      if (element.type === 'node') {
        const coordinates = {
          latitude: element.lat,
          longitude: element.lon,
        };
        if (element.tags?.name === ride.origin.name)
          originNode = { id: element.id, coordinates };
        if (element.tags?.name === ride.destination.name)
          destinationNode = { id: element.id, coordinates };
      }
    });

    return { originNode, destinationNode };
  };

  const fetchRouteAndNodes = async (ride: Ride): Promise<any> => {
    try {
      const query = `
        [out:json][timeout:25];
        area[name="Winnipeg"]->.searchArea;
        (
          relation["type"="route"]["route"="bus"]["ref"="${ride.bus}"](area.searchArea);
          node["public_transport"="platform"]["name"="${ride.origin.name}"](area.searchArea);
          node["highway"="bus_stop"]["name"="${ride.origin.name}"](area.searchArea);
          node["public_transport"="platform"]["name"="${ride.destination.name}"](area.searchArea);
          node["highway"="bus_stop"]["name"="${ride.destination.name}"](area.searchArea);
        );
        out geom;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });

      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.warn('Overpass fetch error:', err);
      Alert.alert('Error fetching routes', getErrorMessage(err));
      throw new Error('Could not load route data from Overpass API.');
    }
  };

  const getErrorMessage = (err: any) => {
    if (typeof err === 'string') return err;
    if (err?.message) return err.message;
    if (typeof err === 'object') return JSON.stringify(err);
    return 'Unknown error';
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

  const fetchRouteData = async (rides: Ride[]) => {
    setLoading(true);
    setError(null);
    setRouteData([]);

    try {
      const routeDataList: RouteData[] = [];

      for (const ride of rides) {
        try {
          const data = await fetchRouteAndNodes(ride);
          const { originNode, destinationNode } = extractNodes(data, ride);

          if (!originNode || !destinationNode) {
            routeDataList.push({
              origin: ride.origin,
              destination: ride.destination,
              points: [ride.origin, ride.destination],
            });
            continue;
          }

          const relation = findRelationWithNodes(data, originNode.id, destinationNode.id);
          const nodes = relation ? extractAllNodes(relation) : [];

          routeDataList.push({
            origin: originNode.coordinates,
            destination: destinationNode.coordinates,
            points: relation
              ? extractCoordinatesBetweenStops(
                  extractWayCoordinates(relation, nodes),
                  originNode.coordinates,
                  destinationNode.coordinates
                )
              : [originNode.coordinates, destinationNode.coordinates],
          });
        } catch (subErr) {
          console.warn('Failed to process one ride segment:', subErr);
        }
      }

      setRouteData(routeDataList);
    } catch (err) {
      console.error('Global route load error:', err);
      Alert.alert('Error', 'Failed to load one or more routes.');
      setError('Failed to load route data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const route = rawRoute;
    if (!route || !route.segments) return;

    const rides: Ride[] = [];
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

        if (segment.route?.key && toGeo && fromGeo && prevSeg?.to?.stop?.name && nextSeg?.from?.stop?.name) {
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

  return (
    <View style={styles.container}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 49.8951,
          longitude: -97.1384,
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
