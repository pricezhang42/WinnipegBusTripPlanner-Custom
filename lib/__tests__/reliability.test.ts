import { test, expect } from '@jest/globals';
import { departureSummary, notOnTimePercent, type RideReliability } from '../reliability';

function available(earlyShare: number, lateShare: number): RideReliability {
  return { status: 'available', earlyShare, lateShare };
}

test('invalid individual shares cannot cancel each other into a plausible percentage', () => {
  for (const [early, late] of [[-.2, .4], [1.1, -.2], [.8, .4], [NaN, .2], [0, Infinity]]) {
    expect(notOnTimePercent(available(early, late))).toBeUndefined();
    expect(departureSummary(available(early, late)).status).toBe('unavailable');
  }
  expect(notOnTimePercent(available(0, 0))).toBe(0);
  expect(notOnTimePercent(available(.4, .6))).toBe(100);
});

test('early-departure note starts at a 20% share before rounding', () => {
  const below = departureSummary(available(.1999, .1));
  const boundary = departureSummary(available(.2, .1));
  expect(below.status).toBe('available');
  expect(boundary.status).toBe('available');
  if (below.status !== 'available' || boundary.status !== 'available') return;
  expect(below.percent).toBe(30);
  expect(below.details).not.toContain('left early');
  expect(boundary.details).toContain('20% left early');
  expect(boundary.explanation).toContain('Not a live prediction');
});

test('unavailable summaries explain the backend reason without inventing statistics', () => {
  expect(departureSummary({ status: 'unavailable', reason: 'insufficient_comparable_history' }))
    .toEqual({ status: 'unavailable', explanation: 'Not enough history for this stop, direction and 2-hour window.' });
  expect(departureSummary().status).toBe('unavailable');
});
