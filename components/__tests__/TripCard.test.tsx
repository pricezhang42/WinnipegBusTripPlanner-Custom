import React from 'react';
import { jest, test, expect } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Pressable } from 'react-native';
import { TripCard } from '../TripCard';
import { Itinerary } from '../../lib/itinerary';
jest.mock('@expo/vector-icons/FontAwesome', () => 'Icon');
const plan: Itinerary = { times: { start: '2026-09-25T11:05:00', end: '2026-09-25T11:18:00', durations: { total: 13, riding: 3, walking: 10, waiting: 0 } }, segments: [
  { type: 'walk', to: { stop: { key: 60130, name: 'Southbound Pembina at Thatcher' } }, times: { start: '2026-09-25T11:05:00', end: '2026-09-25T11:15:00', durations: { walking: 10 } } },
  { type: 'ride', route: { key: 'F8', name: 'Henderson - Pembina' }, variant: { name: 'University of Manitoba' }, to: { stop: { key: 60118, name: 'Southbound Pembina at Victoria Hospital' } }, times: { start: '2026-09-25T11:15:00', end: '2026-09-25T11:18:00', durations: { riding: 3 } } },
] };
test('expansion and map actions are independent and the timeline uses real details', async () => {
  const toggle = jest.fn(); const map = jest.fn(); let tree!: ReactTestRenderer;
  const props = { plan, number: 1, onToggle: toggle, onViewMap: map, shelters: { '60130': 'Heated Shelter' }, originName: '70 Thatcher Drive' };
  await act(async () => { tree = renderer.create(<TripCard {...props} expanded={false} />); });
  expect(tree.root.findAllByProps({ testID: 'trip-timeline' })).toHaveLength(0);
  await act(async () => { tree.root.findAllByType(Pressable)[0].props.onPress(); });
  expect(toggle).toHaveBeenCalledTimes(1); expect(map).not.toHaveBeenCalled();
  await act(async () => { tree.update(<TripCard {...props} expanded />); });
  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain('Southbound Pembina at Thatcher');
  expect(text).toContain('11:18 am'); expect(text).toContain('3 min'); expect(text).toContain('Heated Shelter');
  expect(tree.root.findAllByType(Pressable)[0].props.accessibilityState.expanded).toBe(true);
  await act(async () => { tree.root.findAllByType(Pressable)[1].props.onPress(); });
  expect(map).toHaveBeenCalledTimes(1); expect(toggle).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
});
