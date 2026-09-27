import { test, expect } from '@jest/globals';
import { mapLegs, endpointCoordinate, Segment } from '../mapLegs';

const stop = (key: number, name: string, latitude: number, longitude: number) =>
  ({ stop: { key, name, centre: { geographic: { latitude: String(latitude), longitude: String(longitude) } } } });
const home = { origin: { address: { centre: { geographic: { latitude: '49.89523', longitude: '-97.13438' } } } } };
const work = { destination: { address: { centre: { geographic: { latitude: '49.80000', longitude: '-97.14000' } } } } };
// Same shape as a Winnipeg Transit plan: walk, ride, transfer, ride, walk.
const segments: Segment[] = [
  { type: 'walk', from: home, to: stop(10638, 'Main at Portage', 49.89407, -97.13792) },
  { type: 'ride', route: { key: 'BLUE' }, path: [[49.894, -97.138], [49.85, -97.15], [49.822, -97.156]] },
  { type: 'transfer', from: stop(61211, 'Plaza Station', 49.82186, -97.15621), to: stop(60721, 'Pembina Ramp', 49.82114, -97.15241) },
  { type: 'ride', route: { key: 'F9' } },
  { type: 'walk', from: stop(60112, 'Thatcher', 49.801, -97.141), to: work },
];

test('each ride is drawn separately, from its own path or a straight line between its stops', () => {
  const { rides, walks } = mapLegs(segments);
  expect(rides.map(r => [r.bus, r.origin.name, r.destination.name, r.points.length])).toEqual([
    ['BLUE', 'Main at Portage', 'Plaza Station', 3],
    ['F9', 'Pembina Ramp', 'Thatcher', 2],
  ]);
  expect(rides[0].points[1]).toEqual({ latitude: 49.85, longitude: -97.15 });
  expect(rides[1].points).toEqual([{ latitude: 49.82114, longitude: -97.15241 }, { latitude: 49.801, longitude: -97.141 }]);
  // Walk to the first stop, the transfer walk, and the walk from the last stop.
  expect(walks).toHaveLength(3);
  expect(walks[0][0]).toEqual({ latitude: 49.89523, longitude: -97.13438 });
});

test('bad paths fall back to straight lines and incomplete rides are skipped', () => {
  const broken = segments.map((s, i) => i === 1 ? { ...s, path: [[49.9, 'x']] } : s);
  expect(mapLegs(broken).rides[0].points).toHaveLength(2);
  expect(mapLegs([{ type: 'ride', route: { key: 'BLUE' } }]).rides).toHaveLength(0);
  expect(mapLegs(undefined)).toEqual({ rides: [], walks: [] });
  expect(endpointCoordinate({ stop: { centre: { geographic: { latitude: 'n/a', longitude: '1' } } } })).toBeNull();
});
