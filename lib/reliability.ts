/** Only the fields the ride summary consumes; additional API statistics stay server-side. */
export type PassupRiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type RideReliability =
  | { status: 'unavailable'; reason: string }
  | {
      status: 'available';
      earlyShare: number;
      lateShare: number;
      passupRisk?: { level: PassupRiskLevel; basis?: string };
    };

export const ON_TIME_WINDOW = '>1 min early / >5 min late';
export const EARLY_NOTE_SHARE = 0.2;
export const NOT_ON_TIME_BANDS = { greenBelow: 20, redAbove: 45 } as const;
export type NotOnTimeLevel = 'good' | 'fair' | 'poor';

export const NOT_ON_TIME_COLORS: Record<'light' | 'dark', Record<NotOnTimeLevel, string>> = {
  light: { good: '#15803d', fair: '#1d4ed8', poor: '#b91c1c' },
  dark: { good: '#4ade80', fair: '#93c5fd', poor: '#fca5a5' },
};
export const NOT_ON_TIME_LEVEL_LABEL: Record<NotOnTimeLevel, string> = {
  good: 'mostly on time',
  fair: 'sometimes off schedule',
  poor: 'often off schedule',
};

export function unavailableReason(reason?: string): string {
  switch (reason) {
    case 'route_not_in_pilot': // Older backend response.
    case 'route_without_history':
      return 'No comparable historical data is available for this route.';
    case 'data_outdated':
      return 'Historical data needs refreshing for this trip date.';
    case 'holiday_calendar_unsupported':
      return 'Comparable holiday service data is unavailable.';
    case 'boarding_context_missing':
      return 'Boarding stop, direction or time could not be matched.';
    case 'insufficient_comparable_history':
      return 'Not enough history for this stop, direction and 2-hour window.';
    case 'historical_date_unsupported':
      return 'Historical estimates are unavailable for this past trip date.';
    default:
      return 'Historical reliability is currently unavailable.';
  }
}

function isShare(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function notOnTimePercent(reliability?: RideReliability): number | undefined {
  if (reliability?.status !== 'available') return undefined;
  if (!isShare(reliability.earlyShare) || !isShare(reliability.lateShare)) return undefined;
  const share = reliability.earlyShare + reliability.lateShare;
  return share <= 1 ? Math.round(share * 100) : undefined;
}

/** Round the displayed percentage first, then select its colour band. */
export function notOnTimeLevel(percent: number): NotOnTimeLevel {
  if (percent < NOT_ON_TIME_BANDS.greenBelow) return 'good';
  if (percent > NOT_ON_TIME_BANDS.redAbove) return 'poor';
  return 'fair';
}

type DepartureSummary =
  | { status: 'unavailable'; explanation: string }
  | { status: 'available'; percent: number; level: NotOnTimeLevel; details: string; explanation: string };

/** Derive display text once; the component only renders this presentation model. */
export function departureSummary(reliability?: RideReliability): DepartureSummary {
  const percent = notOnTimePercent(reliability);
  if (percent === undefined || reliability?.status !== 'available') {
    const reason = reliability?.status === 'unavailable' ? reliability.reason : undefined;
    return { status: 'unavailable', explanation: unavailableReason(reason) };
  }

  const level = notOnTimeLevel(percent);
  const oftenEarly = reliability.earlyShare >= EARLY_NOTE_SHARE;
  const earlyPercent = Math.round(reliability.earlyShare * 100);
  let details = ` not on time (${ON_TIME_WINDOW})`;
  let explanation = `Departure ${NOT_ON_TIME_LEVEL_LABEL[level]}: historically ${percent}% of departures were more than 1 minute early or more than 5 minutes late`;
  if (oftenEarly) {
    details += ` · ${earlyPercent}% left early`;
    explanation += `, including ${earlyPercent}% that left more than 1 minute early`;
  }
  explanation += '. Not a live prediction.';
  return { status: 'available', percent, level, details, explanation };
}

export function passupRiskLabel(reliability?: RideReliability): string {
  const level = reliability?.status === 'available' ? reliability.passupRisk?.level : undefined;
  switch (level) {
    case 'low': return 'Low';
    case 'medium': return 'Medium';
    case 'high': return 'High';
    default: return 'Unknown';
  }
}

export function showPassupWarning(reliability?: RideReliability): boolean {
  const level = reliability?.status === 'available' ? reliability.passupRisk?.level : undefined;
  return level === 'medium' || level === 'high';
}
