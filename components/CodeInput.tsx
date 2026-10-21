import React, { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { Text, View } from './Themed';

type Props = { value: string; onChange: (value: string) => void; onSubmit: () => void; editable: boolean; length: number; accessibilityLabel: string };

/** One box per digit over a hidden input, so paste and one-time-code autofill keep working. */
export function CodeInput({ value, onChange, onSubmit, editable, length, accessibilityLabel }: Props) {
  const [focused, setFocused] = useState(false);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const active = Math.min(value.length, length - 1);
  return <View style={codeStyles.codeRow}>
    {digits.map((digit, i) => <View key={i} style={[codeStyles.codeBox, focused && i === active && codeStyles.codeBoxActive]}>
      <Text style={codeStyles.codeDigit}>{digit}</Text>
    </View>)}
    <TextInput accessibilityLabel={accessibilityLabel} value={value}
      onChangeText={next => onChange(next.replace(/\D/g, '').slice(0, length))}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onSubmitEditing={onSubmit}
      editable={editable} keyboardType="number-pad" maxLength={length}
      textContentType="oneTimeCode" autoComplete="one-time-code" caretHidden style={codeStyles.codeInput} />
  </View>;
}

export const codeStyles = StyleSheet.create({
  badge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#e2eff9', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  center: { textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24 },
  email: { fontSize: 17, fontWeight: '600', marginTop: -8 },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 8 },
  codeBox: { flex: 1, maxWidth: 52, height: 56, borderWidth: 1, borderColor: '#888', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeBoxActive: { borderColor: '#176b9c', borderWidth: 2 },
  codeDigit: { fontSize: 24, fontWeight: '600' },
  codeInput: { ...StyleSheet.absoluteFillObject, opacity: 0 },
  linkText: { color: '#176b9c', fontWeight: '600' },
  buttonDisabled: { backgroundColor: '#e5e7eb' },
  buttonTextDisabled: { color: '#6b7280' },
  hint: { color: '#6b7280', fontSize: 14 },
});
