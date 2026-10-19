export const WINNIPEG_TIME_ZONE = 'America/Winnipeg';
export const NOW_TRAVEL_MODE = 'depart-after';
export const TRAVEL_MODES = ['depart-before', 'depart-after', 'arrive-before', 'arrive-after'] as const;
export type TravelMode = typeof TRAVEL_MODES[number];

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: WINNIPEG_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** Native picker values are instants; display and API strings are Winnipeg wall-clock time. */
export function winnipegDateTime(instant: Date): { date: string; time: string } {
  const parts = formatter.formatToParts(instant);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === name)!.value;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}:${part('second')}`,
  };
}

export function tripSearchTime(
  selection: { useNow: boolean; selectedDateTime: Date; travelMode: TravelMode },
  currentInstant = new Date(),
): { date: string; time: string; mode: TravelMode } {
  const fields = winnipegDateTime(selection.useNow ? currentInstant : selection.selectedDateTime);
  return {
    date: fields.date,
    // Manual controls select minutes. Now keeps seconds to avoid searching from the past minute.
    time: selection.useNow ? fields.time : `${fields.time.slice(0, 5)}:00`,
    mode: selection.useNow ? NOW_TRAVEL_MODE : selection.travelMode,
  };
}
