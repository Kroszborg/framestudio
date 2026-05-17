import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, radius } from '../../lib/theme';

interface ClipBlockProps {
  label: string;
  durationMs: number;
  startMs: number;
  pxPerSec: number;
  trackColor: string;
  borderColor: string;
  isSelected: boolean;
  reverse?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  onPress: () => void;
}

export default function ClipBlock({
  label, durationMs, startMs, pxPerSec, trackColor, borderColor,
  isSelected, reverse, fadeIn, fadeOut, onPress,
}: ClipBlockProps) {
  const w = Math.max(32, (durationMs / 1000) * pxPerSec);
  const x = (startMs / 1000) * pxPerSec;
  const hasFade = (fadeIn ?? 0) > 0 || (fadeOut ?? 0) > 0;

  return (
    <TouchableOpacity
      style={[
        styles.block,
        {
          left: x,
          width: w,
          backgroundColor: trackColor,
          borderColor: isSelected ? colors.accent : borderColor,
          borderWidth: isSelected ? 2 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {reverse && <Text style={styles.badge}>↩</Text>}
        {hasFade && <Text style={styles.badge}>~</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  label: {
    flex: 1,
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: typography.medium,
  },
  badge: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: typography.semibold,
  },
});
