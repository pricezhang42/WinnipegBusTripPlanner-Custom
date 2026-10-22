/**
 * One route's look everywhere it appears: summary badges, ride details and map lines.
 * Colours depend only on the route, never on its position in a trip.
 *
 * Source of truth is the `badge-style` Winnipeg Transit attaches to every route object,
 * including the trip planner's ride routes that /api/plans passes through unchanged.
 * When that is missing or malformed, the reviewed palette below is used. It was copied from
 * the v4 Routes API `badge-style` on 2026-10-22 and matches GTFS routes.txt route_color /
 * route_text_color (feed 2026-09-06 to 2026-12-12). See docs/route-colors.md.
 */
export type RouteStyle = {
  /** The text shown in the badge: the route key, e.g. "BLUE", "FX2", "22". */
  label: string;
  backgroundColor: string;
  borderColor: string;
  color: string;
  /** The ride's map polyline and pins. */
  lineColor: string;
  /** Winnipeg Transit's class name, e.g. "frequent", or "unknown" for the fallback. */
  category: string;
};

type Badge = { background: string; border: string; text: string; category: string };
type ApiBadgeStyle = {
  'class-names'?: { 'class-name'?: unknown };
  'background-color'?: unknown;
  'border-color'?: unknown;
  color?: unknown;
};
export type StyledRoute = { key?: string | number; 'badge-style'?: ApiBadgeStyle };

const NAVY = '#052465';
const CONNECTOR: Badge = { background: NAVY, border: NAVY, text: '#ffffff', category: 'connector' };
const COMMUNITY: Badge = { background: '#ffffff', border: NAVY, text: NAVY, category: 'community' };
const LIMITED: Badge = { background: '#fff0d8', border: NAVY, text: NAVY, category: 'limited' };
const DIRECT: Badge = { background: '#026c7e', border: '#026c7e', text: '#ffffff', category: 'direct' };
const FREQUENT: Badge = { background: '#00b262', border: '#00b262', text: '#ffffff', category: 'frequent' };
// Same neutral badge winnipegtransit.com uses when a route has no style.
const UNKNOWN: Badge = { background: '#ffffff', border: '#d9d9d9', text: '#000000', category: 'unknown' };

// Exact routes win over families. Each FX route has its own colour, so FX is never a family.
const NAMED: Record<string, Badge> = {
  BLUE: { background: '#0064b1', border: '#0064b1', text: '#ffffff', category: 'blue' },
  FX2: { background: '#f37043', border: '#f37043', text: '#ffffff', category: 'FX2' },
  FX3: { background: '#f27ea6', border: '#f27ea6', text: '#ffffff', category: 'FX3' },
  FX4: { background: '#6450a1', border: '#6450a1', text: '#ffffff', category: 'FX4' },
};
// Numbered routes are not split by number range (91 is community, 690 limited), so list them.
const NUMBERED: Array<[Badge, number[]]> = [
  [CONNECTOR, [22, 28, 31, 37, 38, 39, 43, 48, 70, 74]],
  [COMMUNITY, [91, 220, 223, 224, 330, 332, 334, 336, 440, 442, 444, 446, 551, 552, 556, 557, 558,
    641, 642, 649, 650, 662, 664, 671, 672, 676, 677, 678, 679, 680]],
  [LIMITED, [690, 691, 694, 833, 881, 883, 884, 885, 886, 887, 888, 889, 895]],
];
const NUMBERED_BADGES = new Map(NUMBERED.flatMap(([badge, numbers]) => numbers.map(n => [String(n), badge] as const)));

/** "  fx2 " and 22 both become their API key form: "FX2", "22". */
export function routeKey(key: unknown): string {
  return key == null ? '' : String(key).trim().toUpperCase();
}

function reviewedBadge(key: string): Badge {
  if (NAMED[key]) return NAMED[key];
  if (NUMBERED_BADGES.has(key)) return NUMBERED_BADGES.get(key)!;
  if (/^FX\d+$/.test(key)) return UNKNOWN; // A new FX route: don't guess its colour.
  if (/^F\d+$/.test(key)) return FREQUENT;
  if (/^D\d+$/.test(key)) return DIRECT;
  return UNKNOWN;
}

function hex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!match) return null;
  const digits = match[1].length === 3 ? match[1].replace(/./g, c => c + c) : match[1];
  return `#${digits.toLowerCase()}`;
}

function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function apiBadge(style?: ApiBadgeStyle): Badge | null {
  const background = hex(style?.['background-color']);
  if (!background) return null;
  const given = hex(style?.color);
  // Keep the official text colour unless it would be unreadable on its own background.
  const text = given && contrastRatio(given, background) >= 3 ? given
    : contrastRatio('#ffffff', background) >= contrastRatio('#000000', background) ? '#ffffff' : '#000000';
  const names = style?.['class-names']?.['class-name'];
  const category = Array.isArray(names) ? String(names.find(n => n !== 'badge-label') ?? 'route') : 'route';
  return { background, border: hex(style?.['border-color']) ?? background, text, category };
}

// Pale badges (community, limited) would vanish on the map, so their line is darkened by 40%,
// as winnipegtransit.com does for its own route map.
function lineColor(badge: Badge): string {
  if (luminance(badge.background) < 0.5) return badge.background;
  if (badge === UNKNOWN) return '#4b5563';
  return `#${[1, 3, 5].map(i => Math.round(parseInt(badge.background.slice(i, i + 2), 16) * 0.6).toString(16).padStart(2, '0')).join('')}`;
}

export function routeStyle(route?: StyledRoute | null): RouteStyle {
  const key = routeKey(route?.key);
  const badge = apiBadge(route?.['badge-style']) ?? reviewedBadge(key);
  return { label: key || 'Bus', backgroundColor: badge.background, borderColor: badge.border, color: badge.text, lineColor: lineColor(badge), category: badge.category };
}
