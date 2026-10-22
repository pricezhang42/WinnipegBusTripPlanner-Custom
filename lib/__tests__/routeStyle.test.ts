import { test, expect } from '@jest/globals';
import { routeStyle, routeKey, contrastRatio } from '../routeStyle';

// Exactly as the v3 trip planner returns a ride's route (checked 2026-10-22).
const apiBlue = { key: 'BLUE', 'badge-style': { 'class-names': { 'class-name': ['badge-label', 'blue'] }, 'background-color': '#0064b1', 'border-color': '#0064b1', color: '#ffffff' } };

test('official API badge-style is used as given', () => {
  expect(routeStyle(apiBlue)).toEqual({ label: 'BLUE', backgroundColor: '#0064b1', borderColor: '#0064b1', color: '#ffffff', lineColor: '#0064b1', category: 'blue' });
  const custom = routeStyle({ key: 'X1', 'badge-style': { 'background-color': '#ABCDEF' } });
  expect([custom.backgroundColor, custom.borderColor, custom.category]).toEqual(['#abcdef', '#abcdef', 'route']);
});

test('reviewed palette covers named, FX, F, D and numbered routes without API styles', () => {
  const pick = (key: string | number) => { const s = routeStyle({ key }); return [s.backgroundColor, s.borderColor, s.color, s.category]; };
  expect(pick('BLUE')).toEqual(['#0064b1', '#0064b1', '#ffffff', 'blue']);
  expect(pick('FX2')).toEqual(['#f37043', '#f37043', '#ffffff', 'FX2']);
  expect(pick('FX3')).toEqual(['#f27ea6', '#f27ea6', '#ffffff', 'FX3']);
  expect(pick('FX4')).toEqual(['#6450a1', '#6450a1', '#ffffff', 'FX4']);
  expect(pick('F8')).toEqual(['#00b262', '#00b262', '#ffffff', 'frequent']);
  expect(pick('D13')).toEqual(['#026c7e', '#026c7e', '#ffffff', 'direct']);
  expect(pick(22)).toEqual(['#052465', '#052465', '#ffffff', 'connector']);
  expect(pick(91)).toEqual(['#ffffff', '#052465', '#052465', 'community']);
  expect(pick(690)).toEqual(['#fff0d8', '#052465', '#052465', 'limited']);
});

test('FX never falls into the F family, and unknown routes get the neutral badge', () => {
  expect(routeStyle({ key: 'FX9' }).category).toBe('unknown');
  expect(routeStyle({ key: 'F12' }).category).toBe('frequent');
  for (const key of ['999', 'SPIRIT', undefined]) expect(routeStyle({ key }).backgroundColor).toBe('#ffffff');
  expect(routeStyle(undefined).label).toBe('Bus');
  expect(routeStyle({ key: 'Q', 'badge-style': { 'background-color': 'blue' } }).category).toBe('unknown');
});

test('labels are normalized and style follows the route, not trip order', () => {
  expect(routeKey(' fx2 ')).toBe('FX2');
  expect(routeStyle({ key: ' f5' })).toEqual(routeStyle({ key: 'F5' }));
  expect(routeStyle({ key: 22 })).toEqual(routeStyle({ key: '22' }));
});

test('text stays readable and pale badges get a visible map line', () => {
  expect(routeStyle({ key: 'Z', 'badge-style': { 'background-color': '#ffff00', color: '#ffffff' } }).color).toBe('#000000');
  for (const key of ['BLUE', 'FX2', 'FX3', 'FX4', 'F5', 'D10', 22, 91, 690, 'new']) {
    const s = routeStyle({ key });
    expect(contrastRatio(s.color, s.backgroundColor)).toBeGreaterThanOrEqual(2.5);
    expect(contrastRatio(s.lineColor, '#ffffff')).toBeGreaterThanOrEqual(2.5);
  }
  expect(routeStyle({ key: 91 }).lineColor).toBe('#999999');
});
