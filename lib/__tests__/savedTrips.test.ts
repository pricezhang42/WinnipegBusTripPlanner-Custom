import { test, expect } from '@jest/globals';
import { locationKey, tripKey, isLocation, Location } from '../savedTrips';
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
