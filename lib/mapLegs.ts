export type Coordinate = { latitude: number; longitude: number };
export type Stop = Coordinate & { name: string };
export type RideLeg = { bus: string | number; origin: Stop; destination: Stop; points: Coordinate[] };
export type MapLegs = { rides: RideLeg[]; walks: Coordinate[][] };

type Geographic = { latitude?: string | number; longitude?: string | number };
type Place = { centre?: { geographic?: Geographic } };
type Endpoint = {
  stop?: Place & { key?: unknown; name?: string };
  origin?: { monument?: { address?: Place }; point?: Place; address?: Place };
  destination?: { monument?: { address?: Place }; point?: Place; address?: Place };
};
export type Segment = { type?: string; route?: { key?: string | number }; from?: Endpoint; to?: Endpoint; path?: unknown };

function coordinate(value?: Geographic): Coordinate | null {
  const latitude = Number(value?.latitude), longitude = Number(value?.longitude);
  return value && Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}
/** Coordinates of a segment endpoint: a stop, or the trip's origin/destination address, monument or point. */
export function endpointCoordinate(endpoint?: Endpoint): Coordinate | null {
  const end = endpoint?.origin ?? endpoint?.destination;
  return coordinate(endpoint?.stop?.centre?.geographic ?? end?.monument?.address?.centre?.geographic ??
    end?.point?.centre?.geographic ?? end?.address?.centre?.geographic);
}
function path(value: unknown): Coordinate[] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const points = value.map(p => Array.isArray(p) ? coordinate({ latitude: p[0], longitude: p[1] }) : null);
  return points.every(Boolean) ? points as Coordinate[] : null;
}

/**
 * What the map draws for one plan. Each ride uses the `path` the backend attached
 * (the GTFS line between its boarding and exit stops) or, without one, a straight
 * line between those stops. Walks and transfers are straight lines between their ends.
 */
export function mapLegs(segments: Segment[] = []): MapLegs {
  const rides: RideLeg[] = [];
  const walks: Coordinate[][] = [];
  segments.forEach((segment, i) => {
    if (segment?.type === 'ride') {
      // Boarding and exit stops are carried by the neighbouring walk/transfer segments.
      const before = segments[i - 1]?.type !== 'ride' ? segments[i - 1]?.to : undefined;
      const after = segments[i + 1]?.type !== 'ride' ? segments[i + 1]?.from : undefined;
      const drawn = path(segment.path);
      const board = endpointCoordinate(segment.from ?? before) ?? drawn?.[0];
      const exit = endpointCoordinate(segment.to ?? after) ?? drawn?.[drawn.length - 1];
      if (!board || !exit || segment.route?.key == null) return;
      rides.push({
        bus: segment.route.key,
        origin: { ...board, name: (segment.from ?? before)?.stop?.name ?? 'Boarding stop' },
        destination: { ...exit, name: (segment.to ?? after)?.stop?.name ?? 'Exit stop' },
        points: drawn ?? [board, exit],
      });
    } else if (segment?.type === 'walk' || segment?.type === 'transfer') {
      const from = endpointCoordinate(segment.from), to = endpointCoordinate(segment.to);
      if (from && to && (from.latitude !== to.latitude || from.longitude !== to.longitude)) walks.push([from, to]);
    }
  });
  return { rides, walks };
}
