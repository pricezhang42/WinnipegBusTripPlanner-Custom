import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { NOT_ON_TIME_COLORS, NOT_ON_TIME_LEVEL_LABEL, notOnTimeLevel, notOnTimePercent, oftenEarly, ON_TIME_WINDOW, passupRiskLabel, RideReliability as Reliability, showPassupWarning, unavailableReason } from '@/lib/reliability';

export function RideReliability({ reliability, color, muted, border }: { reliability?: Reliability; color: string; muted: string; border: string }) {
  const percent = notOnTimePercent(reliability);
  const early = oftenEarly(reliability) && reliability?.status === 'available' ? Math.round(reliability.earlyShare * 100) : undefined;
  const theme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const level = percent === undefined ? undefined : notOnTimeLevel(percent);
  const details = ` not on time (${ON_TIME_WINDOW})${early === undefined ? '' : ` · ${early}% left early`}`;
  const timingExplanation = percent === undefined || !level
    ? unavailableReason(reliability?.status === 'unavailable' ? reliability.reason : undefined)
    : `Departure ${NOT_ON_TIME_LEVEL_LABEL[level]}: historically ${percent}% of departures were more than 1 minute early or more than 5 minutes late${early === undefined ? '' : `, including ${early}% that left more than 1 minute early`}. Not a live prediction.`;
  const risk = passupRiskLabel(reliability);
  return <View style={[styles.box, { borderColor: border }]} testID="ride-reliability-summary">
    <Text style={[styles.line, { color }]} accessibilityLabel={timingExplanation}>Departure: {percent === undefined || !level ? 'Unavailable' : <>
      <Text testID="not-on-time-percent" style={[styles.percent, { color: NOT_ON_TIME_COLORS[theme][level] }]}>{percent}%</Text>{details}
    </>}</Text>
    {showPassupWarning(reliability) && <Text style={[styles.line, { color: muted }]} accessibilityLabel={`Historical pass-up risk: ${risk}. Relative reported history, not a probability or guarantee of boarding.`}>Historical pass-up risk: ⚠️</Text>}
  </View>;
}
const styles = StyleSheet.create({ box: { marginTop: 14, paddingTop: 10, borderTopWidth: 1 }, line: { fontSize: 13, lineHeight: 20, marginTop: 4 }, percent: { fontWeight: '700' } });
