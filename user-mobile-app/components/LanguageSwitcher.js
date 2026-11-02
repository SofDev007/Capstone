import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LANGUAGES } from '../utils/translations';

export default function LanguageSwitcher({ language, onChange, label }) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {Object.entries(LANGUAGES).map(([code, name]) => {
          const active = language === code;
          return (
            <TouchableOpacity
              key={code}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(code)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#fff' },
});
