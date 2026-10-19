import { test, expect } from '@jest/globals';
import { NOW_TRAVEL_MODE, TRAVEL_MODES, tripSearchTime, winnipegDateTime } from '../tripSearchTime';

const manualDate = new Date('2026-10-19T21:40:37Z');

test('display and manual query share Winnipeg date/minute regardless of device timezone', () => {
  const display = winnipegDateTime(manualDate);
  expect(display).toEqual({ date: '2026-10-19', time: '16:40:37' });
  for (const travelMode of TRAVEL_MODES) {
    expect(tripSearchTime({ useNow: false, selectedDateTime: manualDate, travelMode }))
      .toEqual({ date: display.date, time: '16:40:00', mode: travelMode });
  }
});

test('midnight uses the Winnipeg calendar date and 00 rather than 24', () => {
  expect(winnipegDateTime(new Date('2026-01-10T05:59:59Z')))
    .toEqual({ date: '2026-01-09', time: '23:59:59' });
  expect(winnipegDateTime(new Date('2026-01-10T06:00:00Z')))
    .toEqual({ date: '2026-01-10', time: '00:00:00' });
});

test('named timezone follows both daylight-saving transitions', () => {
  expect(winnipegDateTime(new Date('2026-03-08T07:59:59Z')).time).toBe('01:59:59');
  expect(winnipegDateTime(new Date('2026-03-08T08:00:00Z')).time).toBe('03:00:00');
  expect(winnipegDateTime(new Date('2026-11-01T06:30:00Z')))
    .toEqual({ date: '2026-11-01', time: '01:30:00' });
  expect(winnipegDateTime(new Date('2026-11-01T07:30:00Z')))
    .toEqual({ date: '2026-11-01', time: '01:30:00' });
});

test('Now ignores stale manual selections and all previous modes, preserving current seconds', () => {
  const current = new Date('2026-10-19T05:00:12Z');
  for (const travelMode of TRAVEL_MODES) {
    expect(tripSearchTime({ useNow: true, selectedDateTime: manualDate, travelMode }, current))
      .toEqual({ date: '2026-10-19', time: '00:00:12', mode: NOW_TRAVEL_MODE });
  }
});
