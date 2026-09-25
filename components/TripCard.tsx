import React from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { outsideMinutes, durationSummary, endpointLabel, Itinerary, minutes, Segment, segmentEndpoints, timeLabel, Endpoint } from '@/lib/itinerary';

type Palette = { background: string; text: string; muted: string; line: string; badge: string };
const routeColors = ['#087d54', '#0964a0', '#8352a4', '#a9501b'];
function RouteBadge({ segment, index }: { segment: Segment; index: number }) {
  return <View style={[styles.badge, { backgroundColor: routeColors[index % routeColors.length] }]}><Text style={styles.badgeText}>{segment.route?.key ?? 'Bus'}</Text></View>;
}
function StopRow({ endpoint, label, time, base, color, palette, timeWidth }: { endpoint?: Endpoint; label: string; time?: string; base?: string; color?: string; palette: Palette; timeWidth: number }) {
  return <View style={styles.timelineRow}>
    <Text style={[styles.time, { color: palette.muted, width: timeWidth }]}>{timeLabel(time, base)}</Text>
    <View style={styles.rail}><View style={[styles.dot, { borderColor: color ?? palette.line, backgroundColor: palette.background }]} /></View>
    <View style={styles.stopContent}>
      {endpoint?.stop?.key != null && <Text style={[styles.stopId, { backgroundColor: palette.badge, color: palette.text }]}>Stop {endpoint.stop.key}</Text>}
      <Text style={[styles.stopName, { color: palette.text }]}>{endpointLabel(endpoint, label)}</Text>
    </View>
  </View>;
}
// Each ride owns its details so reliability can later be added here without changing navigation.
export function RideDetails({ segment, index, palette }: { segment: Segment; index: number; palette: Palette }) {
  return <>
    <Text style={[styles.detail, { color: palette.text }]}><FontAwesome name="bus" /> Ride for {minutes(segment.times?.durations?.riding ?? segment.times?.durations?.total)}</Text>
    <View style={styles.routeRow}><RouteBadge segment={segment} index={index} /><View style={styles.routeText}>
      {!!segment.route?.name && <Text style={[styles.routeName, { color: palette.text }]}>{segment.route.name}</Text>}
      {!!segment.variant?.name && <Text style={[styles.secondary, { color: palette.muted }]}>{segment.variant.name}</Text>}
    </View></View>
  </>;
}
export function TripCard({ plan, expanded, onToggle, onViewMap, originName, destinationName, shelters, number }: {
  plan: Itinerary; expanded: boolean; onToggle: () => void; onViewMap: () => void; originName?: string; destinationName?: string; shelters: Record<string, string>; number: number;
}) {
  const dark = useColorScheme() === 'dark';
  const { width, fontScale } = useWindowDimensions();
  const palette: Palette = dark ? { background: '#202020', text: '#f4f4f4', muted: '#c3c3c3', line: '#767676', badge: '#164564' } : { background: '#fff', text: '#20252b', muted: '#535d68', line: '#9ca6af', badge: '#e2eff9' };
  const compact = width < 380 || fontScale > 1.25;
  const timeWidth = compact ? 68 : 82;
  const segments = plan.segments ?? [];
  const rides = segments.filter(s => s.type === 'ride');
  const outside = outsideMinutes(plan);
  const outsideColors = dark ? { color: '#ffdc91', backgroundColor: '#463415', borderColor: '#a87924' }
    : { color: '#754700', backgroundColor: '#fff1ce', borderColor: '#d9a43b' };
  const shelterColors: Record<string, { color: string; backgroundColor: string }> = dark ? {
    'Heated Shelter': { color: '#8fe5ad', backgroundColor: '#163d29' },
    'Unheated Shelter': { color: '#ffc17a', backgroundColor: '#4b2d13' },
    'Unsheltered': { color: '#ffa3a3', backgroundColor: '#4a2228' },
  } : {
    'Heated Shelter': { color: '#166534', backgroundColor: '#dcfce7' },
    'Unheated Shelter': { color: '#9a4309', backgroundColor: '#ffedd5' },
    'Unsheltered': { color: '#b91c1c', backgroundColor: '#fee2e2' },
  };
  const base = plan.times?.start ?? segments[0]?.times?.start;
  return <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.line }]}>
    <View style={styles.header}>
      <View style={styles.summary}>
        <View style={styles.badges}>{rides.map((segment, index) => <RouteBadge key={index} segment={segment} index={index} />)}{!rides.length && <Text style={{ color: palette.text }}>{segments.length ? 'Walking trip' : 'Trip'}</Text>}</View>
        <Text style={[styles.summaryTime, { color: palette.text }]}>{timeLabel(base, base)} → {timeLabel(plan.times?.end ?? segments[segments.length - 1]?.times?.end, base)}</Text>
        <Text style={[styles.secondary, { color: palette.muted }]}>{minutes(plan.times?.durations?.total)} total</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} trip ${number} details`} accessibilityState={{ expanded }} onPress={onToggle} style={styles.expand}>
        <FontAwesome name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={palette.text} />
      </Pressable>
    </View>
    <View style={styles.metrics}>
      {([['bus', `${durationSummary(plan, 'riding')} riding`], ['road', `${durationSummary(plan, 'walking')} walking`], ['hourglass-o', `${durationSummary(plan, 'waiting')} waiting`]] as const).map(([icon, label]) => <Text key={icon} style={[styles.metric, { color: palette.muted }]}><FontAwesome name={icon} /> {label}</Text>)}
    </View>
    <Text style={[styles.outside, outsideColors]} accessibilityLabel={outside == null ? 'Time outside unavailable' : `Time outside ${minutes(outside)}, walking plus waiting without shelter`}>
      <FontAwesome name="sun-o" /> Time outside: {outside == null ? 'Unavailable' : minutes(outside)}
    </Text>
    {typeof plan.totalTimeSheltered === 'number' && plan.totalTimeSheltered > 0 && <Text style={[styles.secondary, { color: palette.muted }]}>{minutes(plan.totalTimeSheltered)} waiting with shelter</Text>}
    {expanded && <View testID="trip-timeline" style={[styles.timeline, { borderColor: palette.line }]}>
      <Text style={[styles.timezone, { color: palette.muted }]}>Planned times · Winnipeg</Text>
      {!segments.length && <Text style={{ color: palette.muted }}>Itinerary details unavailable.</Text>}
      {segments.map((segment, index) => {
        const endpoints = segmentEndpoints(segments, index);
        const next = segments[index + 1];
        const nextFrom = next ? segmentEndpoints(segments, index + 1).from : undefined;
        const sharedStop = endpoints.to?.stop?.key != null && endpoints.to.stop.key === nextFrom?.stop?.key;
        const sharedBoundary = sharedStop && !!segment.times?.end && segment.times.end === next?.times?.start;
        const waiting = segment.times?.durations?.waiting;
        const shelter = endpoints.to?.stop?.key != null ? shelters[String(endpoints.to.stop.key)] : undefined;
        const rideIndex = segments.slice(0, index).filter(s => s.type === 'ride').length;
        return <React.Fragment key={index}>
          <StopRow endpoint={endpoints.from} label={index === 0 ? originName ?? 'Origin' : 'Boarding or transfer stop unavailable'} time={segment.times?.start} base={base} color={index === 0 ? '#0aa76e' : undefined} palette={palette} timeWidth={timeWidth} />
          <View style={styles.timelineRow}>
            <View style={{ width: timeWidth }} />
            <View style={styles.connectorRail}>{segment.type === 'ride' ? <View style={[styles.solidLine, { borderColor: palette.line }]} /> : <View style={styles.dots}>{[0,1,2,3,4].map(i => <View key={i} style={[styles.smallDot, { backgroundColor: palette.line }]} />)}</View>}</View>
            <View style={styles.segmentContent}>
              {segment.type === 'ride' ? <RideDetails segment={segment} index={rideIndex} palette={palette} /> : <>
                <Text style={[styles.detail, { color: palette.text }]}>{segment.type === 'transfer' ? (segment.times?.durations?.walking != null ? 'Transfer walk' : 'Transfer') : segment.type === 'walk' ? 'Walk' : 'Travel'} · {minutes(segment.times?.durations?.walking ?? segment.times?.durations?.total)}</Text>
                {!!waiting && waiting > 0 && <Text style={[styles.secondary, { color: palette.text }]}>Wait {minutes(waiting)} at {endpointLabel(endpoints.to, 'the boarding stop')}</Text>}
                {!!shelter && <Text style={[styles.shelter, shelterColors[shelter] ?? { color: palette.muted, backgroundColor: palette.badge }]}>At next stop: {shelter === 'Unsheltered' ? 'No shelter' : shelter}</Text>}
              </>}
            </View>
          </View>
          {!sharedBoundary && <StopRow endpoint={endpoints.to} label={index === segments.length - 1 ? destinationName ?? 'Destination' : 'Alighting or transfer stop unavailable'} time={segment.times?.end} base={base} color={index === segments.length - 1 ? '#0964a0' : undefined} palette={palette} timeWidth={timeWidth} />}
        </React.Fragment>;
      })}
    </View>}
    <Pressable accessibilityRole="button" accessibilityLabel={`View trip ${number} on map`} onPress={onViewMap} style={[styles.mapButton, { borderColor: palette.line }]}><FontAwesome name="map-o" size={16} color={palette.text} /><Text style={{ color: palette.text, fontWeight: '600' }}>View Map</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  outside: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  shelter: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  card: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1 }, header: { flexDirection: 'row', alignItems: 'flex-start' }, summary: { flex: 1, minWidth: 0 }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  badge: { borderRadius: 7, paddingHorizontal: 11, paddingVertical: 9, alignSelf: 'flex-start' }, badgeText: { color: '#fff', fontWeight: '700', fontSize: 18 }, expand: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  summaryTime: { fontSize: 17, fontWeight: '600', lineHeight: 25 }, secondary: { fontSize: 14, lineHeight: 21, marginTop: 4 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }, metric: { fontSize: 13, lineHeight: 21 },
  timeline: { marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 }, timezone: { fontSize: 12, marginBottom: 16 }, timelineRow: { flexDirection: 'row', alignItems: 'stretch' }, time: { fontSize: 12, paddingTop: 4, paddingRight: 4, lineHeight: 19 },
  rail: { width: 26, alignItems: 'center', paddingTop: 3 }, dot: { width: 19, height: 19, borderRadius: 10, borderWidth: 2 }, stopContent: { flex: 1, minWidth: 0, paddingLeft: 9, paddingBottom: 10 }, stopName: { fontSize: 16, lineHeight: 23 }, stopId: { fontSize: 12, borderRadius: 5, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, marginBottom: 5 },
  connectorRail: { width: 26, alignItems: 'center' }, solidLine: { flex: 1, width: 7, borderLeftWidth: 2, borderRightWidth: 2, marginVertical: 2 }, dots: { flex: 1, minHeight: 70, justifyContent: 'space-evenly', alignItems: 'center' }, smallDot: { height: 5, width: 5, borderRadius: 3 },
  segmentContent: { flex: 1, minWidth: 0, paddingLeft: 9, paddingTop: 14, paddingBottom: 22 }, detail: { fontSize: 15, lineHeight: 23 }, routeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }, routeText: { flexGrow: 1, flexShrink: 1, minWidth: 80 }, routeName: { fontSize: 16, fontWeight: '600', lineHeight: 23 }, mapButton: { flexDirection: 'row', gap: 9, justifyContent: 'center', alignItems: 'center', minHeight: 46, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 10 },
});
