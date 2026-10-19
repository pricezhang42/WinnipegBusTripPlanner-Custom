import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import {
  departureSummary,
  NOT_ON_TIME_COLORS,
  passupRiskLabel,
  showPassupWarning,
  type RideReliability as Reliability,
  type RidePassupRisk,
} from '@/lib/reliability';

type Props = {
  reliability?: Reliability;
  passupRisk?: RidePassupRisk;
  color: string;
  muted: string;
  border: string;
};

export function RideReliability({ reliability, passupRisk, color, muted, border }: Props) {
  const departure = departureSummary(reliability);
  const theme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const riskLabel = passupRiskLabel(reliability, passupRisk);

  return (
    <View style={[styles.box, { borderColor: border }]} testID="ride-reliability-summary">
      <Text style={[styles.line, { color }]} accessibilityLabel={departure.explanation}>
        Departure: {departure.status === 'available' ? (
          <>
            <Text
              testID="not-on-time-percent"
              style={[styles.percent, { color: NOT_ON_TIME_COLORS[theme][departure.level] }]}
            >
              {departure.percent}%
            </Text>
            {departure.details}
          </>
        ) : 'Unavailable'}
      </Text>
      {showPassupWarning(reliability, passupRisk) && (
        <Text
          style={[styles.line, { color: muted }]}
          accessibilityLabel={`Historical pass-up risk: ${riskLabel}. Relative reported history, not a probability or guarantee of boarding.`}
        >
          Historical pass-up risk: ⚠️
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 14, paddingTop: 10, borderTopWidth: 1 },
  line: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  percent: { fontWeight: '700' },
});
