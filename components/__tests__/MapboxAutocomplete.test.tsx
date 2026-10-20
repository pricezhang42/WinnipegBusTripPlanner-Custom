import React from 'react';
import { afterEach, jest, test, expect } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { TextInput, Pressable } from 'react-native';
import MapboxAutocomplete from '../MapboxAutocomplete';
import { Location } from '../../lib/savedTrips';
import axios from 'axios';
jest.mock('@expo/vector-icons/FontAwesome', () => 'Icon');
jest.mock('axios', () => ({ get: jest.fn() }));
const place: Location = { id: 'a', place_name: 'Home', geometry: { coordinates: [-97.1, 49.9] } };
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); jest.clearAllMocks(); });
test('favorites disappear on first character, return on clear, and hearts do not select', async () => {
  const select = jest.fn(); const toggle = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<MapboxAutocomplete placeholder="Origin" value={null} onSelect={select} favorites={[place]} onToggleFavorite={toggle} active onClose={() => {}} action={null} />); });
  const heart = () => tree.root.findAllByType(Pressable).find(node => node.props.accessibilityLabel === 'Remove favorite Home');
  expect(heart()).toBeDefined();
  await act(async () => { heart()!.props.onPress(); });
  expect(toggle).toHaveBeenCalledWith(place);
  expect(select).not.toHaveBeenCalled();
  await act(async () => { tree.root.findByType(TextInput).props.onChangeText('a'); });
  expect(heart()).toBeUndefined();
  expect(select).toHaveBeenCalledWith(null);
  await act(async () => { tree.root.findByType(TextInput).props.onChangeText(''); });
  expect(heart()).toBeDefined();
  await act(async () => { tree.unmount(); });
});
test('restoring a trip updates the visible input text', async () => {
  let tree!: ReactTestRenderer;
  const props = { placeholder: 'Origin', onSelect: jest.fn(), favorites: [], onToggleFavorite: jest.fn(), active: false, onClose: jest.fn(), action: null };
  await act(async () => { tree = renderer.create(<MapboxAutocomplete {...props} value={null} />); });
  await act(async () => { tree.update(<MapboxAutocomplete {...props} value={place} />); });
  expect(tree.root.findByType(TextInput).props.value).toBe('Home');
  await act(async () => { tree.unmount(); });
});

test('search keeps distinct places sharing coordinates and removes repeated features without key collisions', async () => {
  jest.useFakeTimers();
  const first: Location = { id: 'place.a', place_name: 'First place', geometry: { coordinates: [-94.4909, 49.7664] } };
  const second: Location = { ...first, id: 'place.b', place_name: 'Second place' };
  jest.mocked(axios.get).mockResolvedValueOnce({ data: { features: [first, second, { ...first }] } });
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  const select = jest.fn(); const toggle = jest.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<MapboxAutocomplete placeholder="Origin" value={null} onSelect={select}
      favorites={[first]} onToggleFavorite={toggle} active onClose={() => {}} action={null} />);
  });
  await act(async () => { tree.root.findByType(TextInput).props.onChangeText('place'); });
  await act(async () => { await jest.advanceTimersByTimeAsync(250); });
  const buttons = tree.root.findAllByType(Pressable);
  expect(buttons.filter(node => node.props.accessibilityLabel === 'Select First place')).toHaveLength(1);
  expect(buttons.filter(node => node.props.accessibilityLabel === 'Select Second place')).toHaveLength(1);
  // Favorites still use coordinate identity even though rendering distinguishes geocoder features.
  const heart = buttons.find(node => node.props.accessibilityLabel === 'Remove favorite Second place');
  expect(heart).toBeDefined();
  await act(async () => { heart!.props.onPress(); });
  expect(toggle).toHaveBeenCalledWith(second);
  expect(select).not.toHaveBeenCalledWith(second);
  await act(async () => { buttons.find(node => node.props.accessibilityLabel === 'Select Second place')!.props.onPress(); });
  expect(select).toHaveBeenCalledWith(second);
  expect(errors.mock.calls.filter(call => String(call[0]).includes('same key'))).toEqual([]);
  await act(async () => { tree.unmount(); });
});
