import React from 'react';
import { test, expect } from '@jest/globals';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { RideReliability } from '../RideReliability';
import { NOT_ON_TIME_COLORS, notOnTimeLevel, notOnTimePercent, passupRiskLabel, showPassupRisk } from '../../lib/reliability';
// Rows of the summary; the colored percent is nested inside the departure row.
const rows = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).filter(t => t.props.testID !== 'not-on-time-percent');
test('historical evidence is labeled separately from pass-up probability', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = renderer.create(<RideReliability color="black" muted="gray" border="gray" reliability={{ status: 'available', earlyShare: .2, lateShare: .2 }} />); });
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
  await act(async () => tree.unmount());
});

test('maps historical risk categories and fails closed for unknown values', () => {
  for (const [level, label] of [['low','Low'], ['medium','Medium'], ['high','High'], ['unknown','Unknown'], ['broken','Unknown']]) {
    expect(passupRiskLabel({ status: 'available', passupRisk: { level } } as any)).toBe(label);
  }
  expect(passupRiskLabel({ status: 'unavailable', reason: 'stale' })).toBe('Unknown');
});
test('pass-up line displays Low, Medium or High as text and hides Unknown', async () => {
  for (const [level, shown] of [['low', true], ['unknown', false], ['medium', true], ['high', true]] as const) {
    const reliability = { status: 'available', earlyShare: .05, lateShare: .1, passupRisk: { level } } as any;
    expect(showPassupRisk(reliability)).toBe(shown);
    let tree!: ReactTestRenderer;
    await act(async () => { tree = renderer.create(<RideReliability color="black" muted="gray" border="gray" reliability={reliability} />); });
    const lines = rows(tree);
    expect(lines).toHaveLength(shown ? 2 : 1);
    expect(JSON.stringify(tree.toJSON())).not.toContain('left early');
    if (shown) {
      const label = passupRiskLabel(reliability);
      expect(lines[1].props.children).toEqual(['Historical pass-up risk: ', label]);
      expect(lines[1].props.accessibilityLabel).toContain(label);
      expect(lines[1].props.style[1].color).toBe({ Low: '#15803d', Medium: '#8a6500', High: '#b91c1c' }[label as 'Low' | 'Medium' | 'High']);
      expect(JSON.stringify(tree.toJSON())).not.toContain('⚠️');
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


test('report-based label works without departure timing and never displays a numeric report ratio', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<RideReliability color="black" muted="gray" border="gray"
      reliability={{ status: 'unavailable', reason: 'insufficient_comparable_history' }}
      passupRisk={{ level: 'high', policyVersion: 'report-scheduled-visit-ratio-v1' }} />);
  });
  const lines = rows(tree);
  expect(lines).toHaveLength(2);
  expect(JSON.stringify(lines[0].props.children)).toContain('Unavailable');
  expect(lines[1].props.children).toEqual(['Historical pass-up risk: ', 'High']);
  expect(lines[1].props.accessibilityLabel).toContain('High');
  expect(JSON.stringify(tree.toJSON())).not.toContain('2.5%');
  await act(async () => tree.unmount());
});

test('explicit report-based Unknown takes precedence over a legacy High category', () => {
  const timing = { status: 'available', earlyShare: .1, lateShare: .1,
    passupRisk: { level: 'high' } } as const;
  expect(showPassupRisk(timing, { level: 'unknown' })).toBe(false);
  expect(passupRiskLabel(timing, { level: 'unknown' })).toBe('Unknown');
  expect(showPassupRisk(timing)).toBe(true); // Compatibility with older backends.
  expect(showPassupRisk(timing, null as any)).toBe(false);
  expect(passupRiskLabel(timing, null as any)).toBe('Unknown');
});
