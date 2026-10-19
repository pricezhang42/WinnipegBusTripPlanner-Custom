import React from 'react';
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, Text, type AppStateStatus } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import MainScreen from '../../app/(tabs)/index';
import MapboxAutocomplete from '../MapboxAutocomplete';

const mockGetPlans = jest.fn(async () => ({ plans: [], shelters: {} }));
const mockSaved = {
  locations: [], favorites: [], history: [], loading: false, busy: false, error: '',
  refresh: jest.fn(async () => {}), recordTrip: jest.fn(async () => {}),
};
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@expo/vector-icons/FontAwesome', () => 'Icon');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }), useFocusEffect: jest.fn(),
}));
jest.mock('../../providers/AuthProvider', () => ({ useAuth: () => ({ session: null }) }));
jest.mock('../../hooks/useSavedTrips', () => ({ useSavedTrips: () => mockSaved }));
jest.mock('../RouteRetrieve', () => ({ __esModule: true, default: jest.fn(() => ({ getPlans: mockGetPlans })) }));
jest.mock('../MapboxAutocomplete', () => 'LocationInput');
jest.mock('../TripListModal', () => ({ TripListModal: () => null }));
jest.mock('../TripCard', () => ({ TripCard: () => null }));
jest.mock('@react-native-community/datetimepicker', () => 'NativeDatePicker');
jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  return { Picker: Object.assign((props: any) => React.createElement('ModePicker', props, props.children), { Item: 'ModeItem' }) };
});

let tree: ReactTestRenderer | undefined;
let resume: (state: AppStateStatus) => void;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-19T04:59:40Z'));
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, handler) => {
    resume = handler;
    return { remove: jest.fn() };
  });
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function renderSearch() {
  await act(async () => { tree = renderer.create(<MainScreen />); });
  await act(async () => {
    const fields = tree!.root.findAllByType(MapboxAutocomplete);
    fields[0].props.onSelect({ place_name: 'Origin', geometry: { coordinates: [-97.134455, 49.89523] } });
    fields[1].props.onSelect({ place_name: 'Destination', geometry: { coordinates: [-97.144433, 49.816532] } });
  });
}
async function toggleNow(value: boolean) {
  await act(async () => {
    tree!.root.findByProps({ accessibilityLabel: 'Use current Winnipeg departure time' }).props.onValueChange(value);
  });
}
async function press(label: string) {
  await act(async () => { tree!.root.findByProps({ accessibilityLabel: label }).props.onPress(); });
}
function expectDisplayed(date: string, time: string) {
  const labels = tree!.root.findAllByType(Text).map(node => node.props.children);
  expect(labels).toContain(date);
  expect(labels).toContain(time);
}

test('Now refreshes across Winnipeg midnight and submits the displayed date with current seconds', async () => {
  await renderSearch();
  expectDisplayed('2026-10-18', '23:59');
  await act(async () => { jest.advanceTimersByTime(30000); });
  expectDisplayed('2026-10-19', '00:00');
  await press('Search trips');
  expect(mockGetPlans).toHaveBeenLastCalledWith(
    [-97.134455, 49.89523], [-97.144433, 49.816532], '2026-10-19', '00:00:10', 'depart-after',
  );
});

test('picker uses Winnipeg; arrival mode switches to departure for Now and restores manual selection', async () => {
  await renderSearch();
  await toggleNow(false);
  await press('Trip date in Winnipeg');
  let picker = tree!.root.findByType(DateTimePicker);
  expect(picker.props.timeZoneName).toBe('America/Winnipeg');
  await act(async () => { picker.props.onChange({ type: 'set' }, new Date('2026-10-19T21:40:00Z')); });
  await press('Trip time in Winnipeg');
  picker = tree!.root.findByType(DateTimePicker);
  expect(picker.props.timeZoneName).toBe('America/Winnipeg');
  expect(picker.props.minimumDate).toBeUndefined();
  expect(picker.props.value.toISOString()).toBe('2026-10-19T21:40:00.000Z');
  await act(async () => { picker.props.onChange({ type: 'dismissed' }, new Date('2026-10-20T22:00:00Z')); });
  await act(async () => { tree!.root.findByType(Picker).props.onValueChange('arrive-before'); });
  expectDisplayed('2026-10-19', '16:40');
  await press('Search trips');
  expect(mockGetPlans).toHaveBeenLastCalledWith(
    [-97.134455, 49.89523], [-97.144433, 49.816532], '2026-10-19', '16:40:00', 'arrive-before',
  );
  await toggleNow(true);
  expect(tree!.root.findByType(Picker).props.selectedValue).toBe('depart-after');
  expect(tree!.root.findByType(Picker).props.enabled).toBe(false);
  await press('Search trips');
  expect(mockGetPlans).toHaveBeenLastCalledWith(
    [-97.134455, 49.89523], [-97.144433, 49.816532], '2026-10-18', '23:59:40', 'depart-after',
  );
  await toggleNow(false);
  expectDisplayed('2026-10-19', '16:40');
  expect(tree!.root.findByType(Picker).props.selectedValue).toBe('arrive-before');
});

test('returning to the app refreshes Now without waiting for the next clock tick', async () => {
  await renderSearch();
  jest.setSystemTime(new Date('2026-10-19T14:15:23Z'));
  await act(async () => { resume('active'); });
  expectDisplayed('2026-10-19', '09:15');
  await press('Search trips');
  expect(mockGetPlans.mock.calls[0].slice(2)).toEqual(['2026-10-19', '09:15:23', 'depart-after']);
});
