import { test, expect } from '@jest/globals';
import { locationKey, tripKey, isLocation, latestPerTrip, Location } from '../savedTrips';
const a: Location = { id: 'a', place_name: 'A', geometry: { coordinates: [-97, 49] } };
const b: Location = { id: 'b', place_name: 'B', geometry: { coordinates: [-98, 50] } };
test('favorites deduplicate coordinates independent of search-result labels', () => {
  expect(locationKey(a)).toBe(locationKey({ ...a, id: 'different', place_name: 'Renamed' }));
  expect(tripKey({ origin: a, destination: b })).not.toBe(tripKey({ origin: b, destination: a }));
});
test('malformed locations cannot populate saved inputs', () => {
  expect(isLocation(a)).toBe(true);
  expect(isLocation({ ...a, geometry: { coordinates: ['-97', 49] } })).toBe(false);
  expect(isLocation({ ...a, geometry: { coordinates: [0, 200] } })).toBe(false);
  expect(isLocation(null)).toBe(false);
});
test('history keeps only the latest entry per trip, allowing ~10 m geocoder jitter', () => {
  const jitter: Location = { ...a, id: 'a2', place_name: 'A again', geometry: { coordinates: [-97.00003, 49.00002] } };
  const history = [
    { origin: jitter, destination: b, created_at: '3' },
    { origin: b, destination: a, created_at: '2' },
    { origin: a, destination: b, created_at: '1' },
  ];
  expect(latestPerTrip(history).map(trip => trip.created_at)).toEqual(['3', '2']);
  expect(latestPerTrip([{ origin: a, destination: b }, { origin: { ...a, geometry: { coordinates: [-97.001, 49] } }, destination: b }])).toHaveLength(2);
});
