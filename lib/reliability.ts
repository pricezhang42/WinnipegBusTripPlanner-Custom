export type RideReliability = { status: 'unavailable'; reason: string } | {
  status: 'available'; passupRisk?: { level: 'low' | 'medium' | 'high' | 'unknown'; basis?: string }; observations: number; distinctDates: number; coverageStart: string; coverageEnd: string;
  medianSeconds: number; p10Seconds: number; p90Seconds: number; earlyShare: number; withinShare: number;
  lateShare: number; beforeScheduleShare: number; shareIntervals: number[][]; nearbyFullBusReports: number;
  hour: number; season: string; dayType: string;
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
    case 'insufficient_comparable_history': return 'Not enough history for this stop, direction, hour and season.';
    case 'historical_date_unsupported': return 'Historical estimates are unavailable for this past trip date.';
    default: return 'Historical reliability is currently unavailable.';
  }
}

export function passupRiskLabel(reliability?: RideReliability): string {
  const level = reliability?.status === 'available' ? reliability.passupRisk?.level : undefined;
  return level === 'low' ? 'Low' : level === 'medium' ? 'Medium' : level === 'high' ? 'High' : 'Unknown';
}
