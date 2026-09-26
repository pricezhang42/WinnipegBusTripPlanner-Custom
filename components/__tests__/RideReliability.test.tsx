import React from 'react';
import { test, expect } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { RideReliability } from '../RideReliability';
import { departureOffset, passupRiskLabel } from '../../lib/reliability';
test('historical evidence is labeled separately from pass-up probability', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<RideReliability color="black" muted="gray" border="gray" reliability={{ status: 'available', observations: 60, distinctDates: 6, coverageStart: '2026-09-01', coverageEnd: '2026-09-24', medianSeconds: 90, p10Seconds: -120, p90Seconds: 600, earlyShare: .2, withinShare: .6, lateShare: .2, beforeScheduleShare: .3, shareIntervals: [[.1,.3],[.5,.7],[.1,.3]], nearbyFullBusReports: 0, hour: 13, season: 'transition', dayType: 'weekday' }} />); });
  let text=JSON.stringify(tree.toJSON());
  expect(text).toContain('1.5 min late'); expect(text).toContain('Historical pass-up risk: ');
  expect(text).not.toContain('resampled-date');
  expect(tree.root.findAllByType(Text)).toHaveLength(2);
  expect(tree.root.findAllByType(Pressable)).toHaveLength(0);
  expect(text).not.toContain('nearby reports');
  expect(text).not.toContain('High');
  await act(async () => tree.unmount());
});
test('old backend remains usable without reliability', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree=renderer.create(<RideReliability color="black" muted="gray" border="gray" />); });
  expect(JSON.stringify(tree.toJSON())).toContain('Unavailable');
  expect(tree.root.findAllByType(Text)).toHaveLength(2);
  expect(departureOffset(-120)).toBe('2 min early');
  expect(departureOffset(0)).toBe('on schedule');
  await act(async () => tree.unmount());
});

test('maps historical risk categories and fails closed for unknown values', () => {
  for (const [level, label] of [['low','Low'], ['medium','Medium'], ['high','High'], ['unknown','Unknown'], ['broken','Unknown']]) {
    expect(passupRiskLabel({ status: 'available', passupRisk: { level } } as any)).toBe(label);
  }
  expect(passupRiskLabel({ status: 'unavailable', reason: 'stale' })).toBe('Unknown');
});
test('shows a historical category without percentages or extra rows', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<RideReliability color="black" muted="gray" border="gray" reliability={{ status: 'available', medianSeconds: 90, passupRisk: { level: 'high' } } as any} />); });
  const text=JSON.stringify(tree.toJSON());
  expect(text).toContain('High');
  expect(text).not.toContain('%');
  expect(tree.root.findAllByType(Text)).toHaveLength(2);
  await act(async () => tree.unmount());
});
