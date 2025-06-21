import { StyleSheet, Platform } from 'react-native';
import React, { useEffect, useState } from 'react';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { Text } from '@/components/Themed';
import { useRoute } from '@react-navigation/native';

// Define a color palette
const colorPalette = ['blue', 'black', 'green'];

// Type definitions
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
  // const { route: rawRoute } = useLocalSearchParams<{ route?: string }>();

  const [error, setError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<RouteData[]>([]);

  const squareDistanceOfTwoPoints = (a: Coordinate, b: Coordinate): number => {
    return (a.latitude - b.latitude) ** 2 + (a.longitude - b.longitude) ** 2;
  };

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

  const extractWayCoordinates = (
    relation: any,
    nodes: Coordinate[]
  ): Coordinate[] => {
    const coordinates: Coordinate[] = [];
    const ways = relation.members.filter(
      (m: any) => m.type === 'way' && m.geometry
    );

    ways.forEach((way: any, index: number) => {
      let startNodeOfWay: Coordinate =
        index === 0 ? nodes[0] : coordinates[coordinates.length - 1];

      const coords = way.geometry.map((pt: any) => ({
        latitude: pt.lat,
        longitude: pt.lon,
      }));

      const disStart = squareDistanceOfTwoPoints(coords[0], startNodeOfWay);
      const disEnd = squareDistanceOfTwoPoints(
        coords[coords.length - 1],
        startNodeOfWay
      );

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
      const originIndex = members.findIndex(
        (m: any) => m.ref === originNodeId
      );
      const destinationIndex = members.findIndex(
        (m: any) => m.ref === destinationNodeId
      );

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

    if (!response.ok) throw new Error('Failed to fetch Overpass data');
    return await response.json();
  };

  const getGeographic = (location: any): { latitude: string; longitude: string } | null => {
    if (location?.stop?.centre?.geographic) return location.stop.centre.geographic;
    if (location?.origin?.monument) return location.origin.monument.address.centre.geographic;
    if (location?.origin?.point) return location.origin.point.centre.geographic;
    if (location?.origin?.address) return location.origin.address.centre.geographic;
    if (location?.destination?.monument) return location.destination.monument.address.centre.geographic;
    if (location?.destination?.point) return location.destination.point.centre.geographic;
    if (location?.destination?.address) return location.destination.address.centre.geographic;
    return null;
  };

  const parsedRoute: Route | null = typeof rawRoute === 'string' ? parseRoute(rawRoute) : rawRoute;
  if (!parsedRoute) return null;

  const fetchRouteData = async (rides: Ride[]) => {
    try {
      setRouteData([]);

      const routeDataList = await Promise.all(
        rides.map(async (ride) => {
          const data = await fetchRouteAndNodes(ride);
          console.log(data);
          console.log(ride);
          const { originNode, destinationNode } = extractNodes(data, ride);
          if (!originNode || !destinationNode) {
            console.warn("Origin or destination node not found for ride:", ride);
            return [ride.origin, ride.destination];
          }
          

          const relation = findRelationWithNodes(data, originNode.id, destinationNode.id);
          if (!relation) {
            console.warn("No matching relation found for origin and destination nodes.");
            return {
              origin: originNode.coordinates,
              destination: destinationNode.coordinates,
              points: [originNode.coordinates, destinationNode.coordinates],
            };
          } 

          const nodes = extractAllNodes(relation);
          const points = extractWayCoordinates(relation, nodes);
          return {origin:originNode.coordinates, destination:destinationNode.coordinates, points:extractCoordinatesBetweenStops(points, originNode.coordinates, destinationNode.coordinates)};
        })
      );
      // console.log(routeDataList);
      setRouteData(routeDataList);
    } catch (err) {
      console.error('Error fetching route data:', err);
      setError('Failed to load route data');
    }
  };

  useEffect(() => {
    // const route = parseRoute(rawRoute);
    const route = rawRoute;
    if (!route) return;

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

        if (segment.route?.key && toGeo && fromGeo) {
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
      {error && <Text style={{ color: 'red', position: 'absolute', top: 10 }}>{error}</Text>}
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
