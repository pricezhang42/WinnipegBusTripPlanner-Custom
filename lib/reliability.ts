export type RideReliability = { status: 'unavailable'; reason: string } | {
  status: 'available'; passupRisk?: { level: 'low' | 'medium' | 'high' | 'unknown'; basis?: string }; observations: number; distinctDates: number; coverageStart: string; coverageEnd: string;
  medianSeconds: number; p10Seconds: number; p90Seconds: number; earlyShare: number; withinShare: number;
  lateShare: number; beforeScheduleShare: number; shareIntervals: number[][]; nearbyFullBusReports: number;
  hour: number; windowMinutes?: number; dayType: string;
};
export function departureOffset(seconds: number) {
  if (seconds === 0) return 'on schedule';
  const magnitude = Math.abs(seconds);
  const amount = magnitude < 60 ? `${Math.round(magnitude)} sec` : `${Math.round(magnitude / 6) / 10} min`;
  return `${amount} ${seconds < 0 ? 'early' : 'late'}`;
}
export function unavailableReason(reason?: string) {
  switch (reason) {
    case 'route_not_in_pilot':
    case 'route_without_history': return 'No comparable historical data is available for this route.';
    case 'data_outdated': return 'Historical data needs refreshing for this trip date.';
    case 'holiday_calendar_unsupported': return 'Comparable holiday service data is unavailable.';
    case 'boarding_context_missing': return 'Boarding stop, direction or time could not be matched.';
    case 'insufficient_comparable_history': return 'Not enough history for this stop, direction and 2-hour window.';
    case 'historical_date_unsupported': return 'Historical estimates are unavailable for this past trip date.';
    default: return 'Historical reliability is currently unavailable.';
  }
}

// Not on time uses the artifact's window: more than 1 min early or more than 5 min late.
export const ON_TIME_WINDOW = '>1 min early / >5 min late';
export function notOnTimePercent(reliability?: RideReliability): number | undefined {
  if (reliability?.status !== 'available') return undefined;
  const share = reliability.earlyShare + reliability.lateShare;
  return Number.isFinite(share) && share >= 0 && share <= 1 ? Math.round(share * 100) : undefined;
}
// Color bands for the rounded not-on-time percent: green below 20, blue 20-45, red above 45.
export const NOT_ON_TIME_BANDS = { greenBelow: 20, redAbove: 45 } as const;
export type NotOnTimeLevel = 'good' | 'fair' | 'poor';
export function notOnTimeLevel(percent: number): NotOnTimeLevel {
  return percent < NOT_ON_TIME_BANDS.greenBelow ? 'good' : percent > NOT_ON_TIME_BANDS.redAbove ? 'poor' : 'fair';
}
export const NOT_ON_TIME_COLORS: Record<'light' | 'dark', Record<NotOnTimeLevel, string>> = {
  light: { good: '#15803d', fair: '#1d4ed8', poor: '#b91c1c' },
  dark: { good: '#4ade80', fair: '#93c5fd', poor: '#fca5a5' },
};
export const NOT_ON_TIME_LEVEL_LABEL: Record<NotOnTimeLevel, string> = { good: 'mostly on time', fair: 'sometimes off schedule', poor: 'often off schedule' };
// Leaving early is what makes riders miss the bus, so call it out when it is common.
export const EARLY_NOTE_SHARE = .2;
export function oftenEarly(reliability?: RideReliability) {
  return reliability?.status === 'available' && Number.isFinite(reliability.earlyShare) && reliability.earlyShare >= EARLY_NOTE_SHARE;
}
export function showPassupWarning(reliability?: RideReliability) {
  const level = reliability?.status === 'available' ? reliability.passupRisk?.level : undefined;
  return level === 'medium' || level === 'high';
}
export function passupRiskLabel(reliability?: RideReliability): string {
  const level = reliability?.status === 'available' ? reliability.passupRisk?.level : undefined;
  return level === 'low' ? 'Low' : level === 'medium' ? 'Medium' : level === 'high' ? 'High' : 'Unknown';
}
