import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowReloadHorizontalIcon } from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { colors, typography, spacing, radius } from '../../lib/theme';
import { Clip } from '../../lib/database';

const CONTROLS: { key: keyof Clip; label: string; min: number; max: number; step: number }[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100, step: 1 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1 },
  { key: 'temperature', label: 'Temperature', min: -100, max: 100, step: 1 },
  { key: 'tint', label: 'Tint', min: -100, max: 100, step: 1 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 1 },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100, step: 1 },
];

export default function ColorGrading() {
  const { getSelectedClip, updateClip, updateClipOptimistic, commitClipUpdate } = useProjectStore();
  const clip = getSelectedClip();

  if (!clip) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Select a clip to grade</Text>
      </View>
    );
  }

  async function handleReset() {
    if (!clip) return;
    await updateClip(clip.id, {
      brightness: 0, contrast: 0, saturation: 0,
      temperature: 0, tint: 0, highlights: 0, shadows: 0, sharpness: 0,
    }, 'reset color');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Color</Text>
        <TouchableOpacity onPress={handleReset} style={styles.resetBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={14} color={colors.textMuted} />
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>
      {CONTROLS.map(ctrl => {
        const val = (clip as any)[ctrl.key] as number;
        return (
          <View key={ctrl.key} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.label}>{ctrl.label}</Text>
              <Text style={styles.value}>{val}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={ctrl.min}
              maximumValue={ctrl.max}
              step={ctrl.step}
              value={val}
              onValueChange={v => updateClipOptimistic(clip.id, { [ctrl.key]: v })}
              onSlidingComplete={() => commitClipUpdate(clip.id, ctrl.label)}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.surface3}
              thumbTintColor={colors.accent}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing[3] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  title: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
  },
  resetText: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  row: { marginBottom: spacing[1] },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: { fontSize: typography.xs, color: colors.textSecondary },
  value: { fontSize: typography.xs, color: colors.textPrimary, fontWeight: typography.semibold },
  slider: { height: 28, marginHorizontal: -6 },
  empty: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
});
