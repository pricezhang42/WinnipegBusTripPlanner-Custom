import React from 'react';
import { test, expect } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { RideReliability } from '../RideReliability';
import { departureOffset, NOT_ON_TIME_COLORS, notOnTimeLevel, notOnTimePercent, passupRiskLabel, showPassupWarning } from '../../lib/reliability';
// Rows of the summary; the colored percent is nested inside the departure row.
const rows = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).filter(t => t.props.testID !== 'not-on-time-percent');
test('historical evidence is labeled separately from pass-up probability', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<RideReliability color="black" muted="gray" border="gray" reliability={{ status: 'available', observations: 60, distinctDates: 6, coverageStart: '2026-09-01', coverageEnd: '2026-09-24', medianSeconds: 90, p10Seconds: -120, p90Seconds: 600, earlyShare: .2, withinShare: .6, lateShare: .2, beforeScheduleShare: .3, shareIntervals: [[.1,.3],[.5,.7],[.1,.3]], nearbyFullBusReports: 0, hour: 13, dayType: 'weekday' }} />); });
  let text=JSON.stringify(tree.toJSON());
  expect(tree.root.findByProps({ testID: 'not-on-time-percent' }).props.children).toEqual([40, '%']); expect(text).toContain(' not on time (>1 min early / >5 min late)');
  expect(text).toContain('20'); expect(text).toContain('% left early');
  expect(text).not.toContain('Historical pass-up risk');
  expect(text).not.toContain('resampled-date');
  expect(rows(tree)).toHaveLength(1);
  expect(tree.root.findAllByType(Pressable)).toHaveLength(0);
  expect(text).not.toContain('nearby reports');
  expect(text).not.toContain('High');
  await act(async () => tree.unmount());
});
test('old backend remains usable without reliability', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree=renderer.create(<RideReliability color="black" muted="gray" border="gray" />); });
  expect(JSON.stringify(tree.toJSON())).toContain('Unavailable');
  expect(rows(tree)).toHaveLength(1);
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
test('pass-up line is a warning shown only for Medium or High', async () => {
  for (const [level, shown] of [['low', false], ['unknown', false], ['medium', true], ['high', true]] as const) {
    const reliability = { status: 'available', earlyShare: .05, lateShare: .1, passupRisk: { level } } as any;
    expect(showPassupWarning(reliability)).toBe(shown);
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<RideReliability color="black" muted="gray" border="gray" reliability={reliability} />); });
    const lines = rows(tree);
    expect(lines).toHaveLength(shown ? 2 : 1);
    expect(JSON.stringify(tree.toJSON())).not.toContain('left early');
    if (shown) {
      expect(JSON.stringify(lines[1].props.children)).toContain('⚠️');
      expect(lines[1].props.accessibilityLabel).toContain(level === 'high' ? 'High' : 'Medium');
    }
    await act(async () => tree.unmount());
  }
});
test('not-on-time percent combines early and late shares and rejects invalid values', () => {
  expect(notOnTimePercent({ status: 'available', earlyShare: .123, lateShare: .2 } as any)).toBe(32);
  expect(notOnTimePercent({ status: 'available', earlyShare: NaN, lateShare: .2 } as any)).toBeUndefined();
  expect(notOnTimePercent({ status: 'unavailable', reason: 'x' })).toBeUndefined();
});
test('not-on-time percent is colored by band after rounding', async () => {
  expect([0, 19, 20, 45, 46, 100].map(notOnTimeLevel)).toEqual(['good', 'good', 'fair', 'fair', 'poor', 'poor']);
  // 19.6% displays as 20%, so it must be blue, not green; 45.4% displays as 45%, so blue, not red.
  for (const [earlyShare, lateShare, shown, level] of [[.05, .146, '20%', 'fair'], [.01, .444, '45%', 'fair'], [0, .1, '10%', 'good'], [0, .6, '60%', 'poor']] as const) {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<RideReliability color="black" muted="gray" border="gray" reliability={{ status: 'available', earlyShare, lateShare } as any} />); });
    const percent = tree.root.findByProps({ testID: 'not-on-time-percent' });
    expect(percent.props.children).toEqual([Number(shown.slice(0, -1)), '%']);
    expect(percent.props.style[1].color).toBe(NOT_ON_TIME_COLORS.light[level]);
    const label = tree.root.findAllByType(Text)[0].props.accessibilityLabel;
    expect(label).toContain({ good: 'mostly on time', fair: 'sometimes off schedule', poor: 'often off schedule' }[level]);
    await act(async () => tree.unmount());
  }
});
