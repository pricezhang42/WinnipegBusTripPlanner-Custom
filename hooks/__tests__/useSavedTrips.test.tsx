import React from 'react';
import { beforeEach, jest, test, expect } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { useSavedTrips } from '../useSavedTrips';

let mockUser: string | undefined = 'user-a';
const mockPlace = { id: 'a', place_name: 'Private home', geometry: { coordinates: [-97, 49] as [number, number] } };
const mockRequest = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/providers/AuthProvider', () => ({ useAuth: () => ({ session: mockUser ? { user: { id: mockUser } } : null }) }));
jest.mock('@/lib/savedItemsApi', () => ({
  ...jest.requireActual<typeof import('@/lib/savedItemsApi')>('@/lib/savedItemsApi'),
  savedItemsRequest: (...args: any[]) => mockRequest(...args),
}));
jest.mock('@/lib/supabase', () => ({ supabase: null }));
let latest: ReturnType<typeof useSavedTrips>;
function Probe() { latest = useSavedTrips(); return null; }
const lists = { locations: [mockPlace], favorites: [], history: [] };
const deferred = () => { let resolve!: (value?: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { resolve, promise }; };
beforeEach(() => {
  mockUser = 'user-a'; mockRequest.mockReset();
  mockRequest.mockImplementation(async (_uid, path) => path === '/saved-items' ? lists : undefined);
});

test('logout immediately hides locations and rejects stale responses even after signing back into A', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Probe />); });
  expect(latest.locations).toHaveLength(1);
  const old = deferred();
  mockRequest.mockImplementationOnce(() => old.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = latest.refresh(); });
  const oldGuard = mockRequest.mock.calls.at(-1)![3] as () => boolean;
  mockUser = undefined;
  await act(async () => { tree.update(<Probe />); });
  expect(latest.locations).toHaveLength(0);
  expect(oldGuard()).toBe(false);
  mockUser = 'user-a';
  await act(async () => { tree.update(<Probe />); });
  expect(oldGuard()).toBe(false);
  await act(async () => { old.resolve({ ...lists, locations: [{ ...mockPlace, place_name: 'Stale' }] }); await pending; });
  expect(latest.locations[0].place_name).toBe('Private home');
  await act(async () => { tree.unmount(); });
});

test('uses backend deletions with encoded keys and rejects unidentified history', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Probe />); });
  await act(async () => { await latest.removeLocation(mockPlace); });
  await act(async () => { await latest.removeTrip({ origin: mockPlace, destination: mockPlace }); });
  await act(async () => { await latest.removeHistory({ id: 7, created_at: '2026-09-26', origin: mockPlace, destination: mockPlace }); });
  expect(mockRequest.mock.calls.filter(call => (call[2] as any)?.method === 'DELETE').map(call => call.slice(0, 2))).toEqual([
    ['user-a', '/favorite-locations/-97%2C49'], ['user-a', '/favorite-trips/-97%2C49%3E-97%2C49'], ['user-a', '/trip-history/7'],
  ]);
  await expect(latest.removeHistory({ created_at: '', origin: mockPlace, destination: mockPlace })).rejects.toThrow('identified');
  await act(async () => { tree.unmount(); });
});

test('blocks duplicate writes, preserves payloads, and refreshes after a successful save', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Probe />); });
  const saving = deferred();
  mockRequest.mockImplementationOnce(() => saving.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = latest.saveTrip({ origin: mockPlace, destination: mockPlace }); });
  expect(latest.busy).toBe(true);
  await expect(latest.saveTrip({ origin: mockPlace, destination: mockPlace })).rejects.toThrow('previous save');
  expect(mockRequest.mock.calls.at(-1)!.slice(0, 3)).toEqual(['user-a', '/favorite-trips', { method: 'POST', body: { origin: mockPlace, destination: mockPlace } }]);
  await act(async () => { saving.resolve(); await pending; });
  expect(latest.busy).toBe(false);
  expect(mockRequest.mock.calls.at(-1)![1]).toBe('/saved-items');
  await act(async () => { tree.unmount(); });
});

test('pending account-A mutation cannot refresh or clear account-B mutation state', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Probe />); });
  const a = deferred(); mockRequest.mockImplementationOnce(() => a.promise);
  let pendingA!: Promise<void>;
  await act(async () => { pendingA = latest.saveTrip({ origin: mockPlace, destination: mockPlace }); });
  mockUser = 'user-b';
  await act(async () => { tree.update(<Probe />); });
  const b = deferred(); mockRequest.mockImplementationOnce(() => b.promise);
  let pendingB!: Promise<void>;
  await act(async () => { pendingB = latest.saveTrip({ origin: mockPlace, destination: mockPlace }); });
  const count = mockRequest.mock.calls.length;
  await act(async () => { a.resolve(); await pendingA; });
  expect(mockRequest).toHaveBeenCalledTimes(count);
  expect(latest.busy).toBe(true);
  await act(async () => { b.resolve(); await pendingB; });
  expect(latest.busy).toBe(false);
  await act(async () => { tree.unmount(); });
});

test('history failure is nonfatal to trip planning, and guests do not record history', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Probe />); });
  mockRequest.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await expect(latest.recordTrip({ origin: mockPlace, destination: mockPlace })).rejects.toThrow('Trip found'); });
  expect(latest.busy).toBe(false);
  mockUser = undefined;
  await act(async () => { tree.update(<Probe />); });
  mockRequest.mockClear();
  await latest.recordTrip({ origin: mockPlace, destination: mockPlace });
  expect(mockRequest).not.toHaveBeenCalled();
  await act(async () => { tree.unmount(); });
});
