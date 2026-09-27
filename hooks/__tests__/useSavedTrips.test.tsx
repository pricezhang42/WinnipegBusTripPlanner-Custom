import React from 'react';
import { jest, test, expect } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { useSavedTrips } from '../useSavedTrips';

let mockUser: string | undefined = 'user-a';
let mockDelay = false;
let mockDeletes: { table: string; filters: [string, unknown][] }[] = [];
let mockResolve: (() => void)[] = [];
const mockPlace = { id: 'a', place_name: 'Private home', geometry: { coordinates: [-97, 49] } };
jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => ({ session: mockUser ? { user: { id: mockUser } } : null }) }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => {
  let deletion: { table: string; filters: [string, unknown][] } | undefined;
  const query = {
    delete: () => { deletion = { table, filters: [] }; mockDeletes.push(deletion); return query; },
    select: () => query, eq: (name: string, value: unknown) => { deletion?.filters.push([name, value]); return query; }, order: () => query, limit: () => query,
    then: (resolve: (value: unknown) => void) => {
      const finish = () => resolve({ data: table === 'favorite_locations' ? [{ location: mockPlace }] : [], error: null });
      if (mockDelay) mockResolve.push(finish); else finish();
    },
  };
  return query;
} } }));
let latest: ReturnType<typeof useSavedTrips>;
function Probe() { latest = useSavedTrips(); return null; }

test('logout immediately hides personal locations and pending responses cannot restore them', async () => {
  mockUser = 'user-a'; mockDelay = false;
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Probe />); });
  expect(latest.locations).toHaveLength(1);
  mockDelay = true;
  let pending!: Promise<void>;
  await act(async () => { pending = latest.refresh(); });
  mockUser = undefined;
  await act(async () => { tree.update(<Probe />); });
  expect(latest.locations).toHaveLength(0);
  await act(async () => { mockResolve.forEach(resolve => resolve()); await pending; });
  expect(latest.locations).toHaveLength(0);
  await act(async () => { tree.unmount(); });
  mockResolve = []; mockDelay = false;
});


test('deletes only the signed-in user’s selected saved items and rejects unidentified history', async () => {
  mockUser = 'user-a'; mockDelay = false; mockDeletes = [];
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Probe />); });
  const place = { ...mockPlace, geometry: { coordinates: [-97, 49] as [number, number] } };
  await act(async () => { await latest.removeLocation(place); });
  await act(async () => { await latest.removeTrip({ origin: place, destination: place }); });
  await act(async () => { await latest.removeHistory({ id: 7, created_at: '2026-09-26', origin: place, destination: place }); });
  expect(mockDeletes).toEqual([
    { table: 'favorite_locations', filters: [['user_id', 'user-a'], ['location_key', '-97,49']] },
    { table: 'favorite_trips', filters: [['user_id', 'user-a'], ['trip_key', '-97,49>-97,49']] },
    { table: 'trip_history', filters: [['user_id', 'user-a'], ['id', 7]] },
  ]);
  await expect(latest.removeHistory({ created_at: '', origin: place, destination: place })).rejects.toThrow('identified');
  expect(mockDeletes).toHaveLength(3);
  await act(async () => { tree.unmount(); });
});
