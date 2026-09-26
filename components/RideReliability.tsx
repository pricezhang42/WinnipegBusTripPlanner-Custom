import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { departureOffset, passupRiskLabel, RideReliability as Reliability, unavailableReason } from '@/lib/reliability';

export function RideReliability({ reliability, color, muted, border }: { reliability?: Reliability; color: string; muted: string; border: string }) {
  const risk = passupRiskLabel(reliability);
  const timing = reliability?.status === 'available' && Number.isFinite(reliability.medianSeconds)
    ? departureOffset(reliability.medianSeconds) : 'Unavailable';
  const timingExplanation = reliability?.status === 'available'
    ? `Historical typical departure: ${timing}. Not a live arrival prediction.`
    : unavailableReason(reliability?.reason);
  return <View style={[styles.box, { borderColor: border }]} testID="ride-reliability-summary">
    <Text style={[styles.line, { color }]} accessibilityLabel={timingExplanation}>Typical departure: {timing}</Text>
    <Text style={[styles.line, { color: muted }]} accessibilityLabel={`Historical pass-up risk: ${risk}. Relative reported history, not a probability or guarantee of boarding.`}>Historical pass-up risk: {risk}</Text>
  </View>;
}
const styles = StyleSheet.create({ box: { marginTop: 14, paddingTop: 10, borderTopWidth: 1 }, line: { fontSize: 13, lineHeight: 20, marginTop: 4 } });
