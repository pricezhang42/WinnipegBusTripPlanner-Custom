export type Location = { id: string; place_name: string; geometry: { coordinates: [number, number] } };
export type Trip = { origin: Location; destination: Location };
export type SavedTrip = Trip & { trip_key?: string; id?: number; created_at: string };
export const locationKey = (location: Location) => location.geometry.coordinates.join(',');
export const tripKey = (trip: Trip) => `${locationKey(trip.origin)}>${locationKey(trip.destination)}`;
export function isLocation(value: unknown): value is Location {
  const item = value as Location | null;
  return !!item && typeof item.id === 'string' && typeof item.place_name === 'string' &&
    Array.isArray(item.geometry?.coordinates) && item.geometry.coordinates.length === 2 &&
    item.geometry.coordinates.every(Number.isFinite) && Math.abs(item.geometry.coordinates[0]) <= 180 && Math.abs(item.geometry.coordinates[1]) <= 90;
}
