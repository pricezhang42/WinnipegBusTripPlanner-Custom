import React from 'react';
import { jest, test, expect } from '@jest/globals';
import renderer, { act } from 'react-test-renderer';
import { Pressable } from 'react-native';
import { SavedItemsManagement } from '../SavedItemsManagement';
import { useSavedTrips } from '@/hooks/useSavedTrips';
jest.mock('@/components/Themed', () => ({ Text: require('react-native').Text, View: require('react-native').View }));
const place = { id: 'home', place_name: 'Home', geometry: { coordinates: [-97, 49] as [number, number] } };
const trip = { origin: place, destination: { ...place, place_name: 'Work' }, id: 1, created_at: '2026-09-26T16:00:00Z' };
test('management offers deletion for all three lists and displays failures', async () => {
  const saved = { locations: [place], favorites: [trip], history: [trip], loading: false, busy: false, error: '',
    removeLocation: jest.fn<() => Promise<void>>().mockResolvedValue(undefined), removeTrip: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    removeHistory: jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Could not delete history.')), refresh: jest.fn(),
  } as unknown as ReturnType<typeof useSavedTrips>;
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<SavedItemsManagement saved={saved} />); });
  const buttons = tree.root.findAllByType(Pressable);
  expect(buttons).toHaveLength(3);
  for (const button of buttons) await act(async () => { button.props.onPress(); });
  expect(saved.removeLocation).toHaveBeenCalledWith(place);
  expect(saved.removeTrip).toHaveBeenCalledWith(trip);
  expect(saved.removeHistory).toHaveBeenCalledWith(trip);
  expect(JSON.stringify(tree.toJSON())).toContain('Could not delete history.');
  await act(async () => { tree.update(<SavedItemsManagement saved={{ ...saved, busy: true }} />); });
  expect(tree.root.findAllByType(Pressable).every(button => button.props.disabled)).toBe(true);
  await act(async () => { tree.unmount(); });
});
