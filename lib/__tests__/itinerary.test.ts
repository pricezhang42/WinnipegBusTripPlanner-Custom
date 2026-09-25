import { test, expect } from '@jest/globals';
import { localTime, timeLabel, segmentEndpoints, minutes, durationSummary } from '../itinerary';
test('Winnipeg wall-clock times are preserved and midnight dates are explicit', () => {
  expect(localTime('2026-09-25T23:55:00').time).toBe('11:55 pm');
  expect(timeLabel('2026-09-26T00:05:00', '2026-09-25T23:55:00')).toBe('12:05 am\n2026-09-26');
  expect(localTime('2026-09-26T04:55:00Z').time).toBe('11:55 pm');
  expect(localTime('not a date').time).toBe('Time unavailable');
});
test('ride endpoints come from adjacent segments but never skip over another ride', () => {
  const stopA = { stop: { key: 1, name: 'A' } }; const stopB = { stop: { key: 2, name: 'B' } };
  expect(segmentEndpoints([{ type: 'walk', to: stopA }, { type: 'ride' }, { type: 'walk', from: stopB }], 1)).toEqual({ from: stopA, to: stopB });
  expect(segmentEndpoints([{ type: 'ride' }, { type: 'ride' }, { type: 'walk', from: stopB }], 0).to).toBeUndefined();
});
test('missing durations are not silently displayed as zero', () => {
  expect(minutes(undefined)).toBe('Duration unavailable');
  expect(minutes(0)).toBe('0 min');
  expect(minutes(-1)).toBe('Duration unavailable');
  expect(durationSummary({ segments: [] }, 'waiting')).toBe('—');
  expect(durationSummary({ segments: [{ times: { durations: { walking: 3 } } }, { times: { durations: { walking: 4 } } }] }, 'walking')).toBe('7 min');
});
