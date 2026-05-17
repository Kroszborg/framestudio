import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../lib/theme';

interface TimeRulerProps {
  durationMs: number;
  pxPerSec: number;
  offsetLeft?: number;
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TimeRuler({ durationMs, pxPerSec, offsetLeft = 0 }: TimeRulerProps) {
  const totalSec = Math.ceil(durationMs / 1000) + 2;
  const step = pxPerSec >= 200 ? 0.5 : pxPerSec >= 100 ? 1 : pxPerSec >= 50 ? 2 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= totalSec; t += step) ticks.push(t);

  return (
    <View style={[styles.ruler, { width: offsetLeft + totalSec * pxPerSec + 40 }]}>
      <View style={{ width: offsetLeft }} />
      {ticks.map(t => (
        <View key={t} style={[styles.tick, { left: offsetLeft + t * pxPerSec }]}>
          {t % 1 === 0 && (
            <Text style={styles.label}>{formatSec(t)}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ruler: {
    height: 24,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  tick: {
    position: 'absolute',
    bottom: 0,
    width: 1,
    height: 8,
    backgroundColor: colors.timeRuler,
  },
  label: {
    position: 'absolute',
    bottom: 10,
    left: 2,
    fontSize: 9,
    color: colors.textMuted,
  },
});
