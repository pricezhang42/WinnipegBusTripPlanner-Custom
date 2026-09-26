export type Location = { id: string; place_name: string; geometry: { coordinates: [number, number] } };
export type Trip = { origin: Location; destination: Location };
export type SavedTrip = Trip & { trip_key?: string; id?: number; created_at: string };
export const locationKey = (location: Location) => location.geometry.coordinates.join(',');
export const tripKey = (trip: Trip) => `${locationKey(trip.origin)}>${locationKey(trip.destination)}`;
// Matches trip_point_key in the database: coordinates rounded to 4 decimals (about 10 m).
const roundedKey = (location: Location) => location.geometry.coordinates.map(value => value.toFixed(4)).join(',');
export const historyKey = (trip: Trip) => `${roundedKey(trip.origin)}>${roundedKey(trip.destination)}`;
// History arrives newest first; keep only the latest entry for each trip.
export function latestPerTrip<T extends Trip>(trips: T[]): T[] {
  const seen = new Set<string>();
  return trips.filter(trip => { const key = historyKey(trip); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function isLocation(value: unknown): value is Location {
  const item = value as Location | null;
  return !!item && typeof item.id === 'string' && typeof item.place_name === 'string' &&
    Array.isArray(item.geometry?.coordinates) && item.geometry.coordinates.length === 2 &&
    item.geometry.coordinates.every(Number.isFinite) && Math.abs(item.geometry.coordinates[0]) <= 180 && Math.abs(item.geometry.coordinates[1]) <= 90;
}
