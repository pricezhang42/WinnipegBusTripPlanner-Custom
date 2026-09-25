import React from 'react';
import { jest, test, expect } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { useSavedTrips } from '../useSavedTrips';

let mockUser: string | undefined = 'user-a';
let mockDelay = false;
let mockResolve: (() => void)[] = [];
const mockPlace = { id: 'a', place_name: 'Private home', geometry: { coordinates: [-97, 49] } };
jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => ({ session: mockUser ? { user: { id: mockUser } } : null }) }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => {
  const query = {
    select: () => query, eq: () => query, order: () => query, limit: () => query,
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
