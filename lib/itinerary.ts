export type Endpoint = { stop?: { key?: string | number; name?: string }; origin?: unknown; destination?: unknown };
export type Times = { start?: string; end?: string; durations?: { total?: number; riding?: number; walking?: number; waiting?: number } };
export type Segment = { type?: string; from?: Endpoint; to?: Endpoint; route?: { key?: string | number; name?: string }; variant?: { name?: string }; times?: Times };
export type Itinerary = { times?: Times; segments?: Segment[]; totalTimeSheltered?: number };
export function minutes(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${Math.round(value * 10) / 10} min` : 'Duration unavailable';
}
// Offset-free API times are Winnipeg wall-clock values, not the device timezone.
export function localTime(value?: string): { time: string; date?: string } {
  if (!value) return { time: 'Time unavailable' };
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Winnipeg', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(date);
      const part = (type: string) => parts.find(p => p.type === type)?.value;
      return { time: `${part('hour')}:${part('minute')} ${part('dayPeriod')?.toLowerCase().replace(/\./g, '')}`, date: `${part('year')}-${part('month')}-${part('day')}` };
    }
  }
  const match = value.match(/^(?:(\d{4}-\d{2}-\d{2})T)?(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!match || +match[2] > 23 || +match[3] > 59) return { time: 'Time unavailable' };
  return { time: `${+match[2] % 12 || 12}:${match[3]} ${+match[2] < 12 ? 'am' : 'pm'}`, date: match[1] };
}
export function timeLabel(value?: string, base?: string): string {
  const parsed = localTime(value); const first = localTime(base);
  return parsed.date && first.date && parsed.date !== first.date ? `${parsed.time}\n${parsed.date}` : parsed.time;
}
export function endpointLabel(endpoint?: Endpoint, fallback = 'Stop details unavailable'): string {
  if (endpoint?.stop) return endpoint.stop.name || (endpoint.stop.key != null ? `Stop ${endpoint.stop.key}` : fallback);
  return fallback;
}
export function segmentEndpoints(segments: Segment[], index: number) {
  const segment = segments[index];
  // Ride endpoints are often supplied by the adjacent walk/transfer segments.
  // Never jump over another ride to invent an intermediate boarding/alighting stop.
  return {
    from: segment.from ?? (segment.type === 'ride' && segments[index - 1]?.type !== 'ride' ? segments[index - 1]?.to : undefined),
    to: segment.to ?? (segment.type === 'ride' && segments[index + 1]?.type !== 'ride' ? segments[index + 1]?.from : undefined),
  };
}
export function durationSummary(plan: Itinerary, field: 'riding' | 'walking' | 'waiting') {
  const provided = plan.times?.durations?.[field];
  if (provided != null) return minutes(provided);
  const values = (plan.segments ?? []).map(segment => segment.times?.durations?.[field]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  return values.length ? minutes(values.reduce((a, b) => a + b, 0)) : '—';
}
