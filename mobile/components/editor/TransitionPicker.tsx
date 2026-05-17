import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  CropIcon, TransitionLeftIcon, TransitionRightIcon,
  ArrowLeft01Icon, ArrowRight01Icon, ExpandIcon,
  Remove01Icon, EyeIcon, BlurIcon, Loading03Icon,
  ZapIcon, Sun01Icon, ArrowDiagonalIcon, DoorIcon,
} from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { Clip } from '../../lib/database';
import { colors, typography, spacing, radius } from '../../lib/theme';

const TRANSITIONS: { id: Clip['transitionType']; label: string; icon: any }[] = [
  { id: 'none', label: 'Cut', icon: CropIcon },
  { id: 'fade', label: 'Fade', icon: EyeIcon },
  { id: 'dissolve', label: 'Dissolve', icon: TransitionLeftIcon },
  { id: 'slide_left', label: 'Slide L', icon: ArrowLeft01Icon },
  { id: 'slide_right', label: 'Slide R', icon: ArrowRight01Icon },
  { id: 'zoom', label: 'Zoom', icon: ExpandIcon },
  { id: 'wipe', label: 'Wipe', icon: Remove01Icon },
  { id: 'blur', label: 'Blur', icon: BlurIcon },
  { id: 'spin', label: 'Spin', icon: Loading03Icon },
  { id: 'glitch', label: 'Glitch', icon: ZapIcon },
  { id: 'flash', label: 'Flash', icon: Sun01Icon },
  { id: 'diagonal', label: 'Diagonal', icon: ArrowDiagonalIcon },
  { id: 'color_wipe', label: 'Color', icon: TransitionRightIcon },
  { id: 'barn_door', label: 'Barn Door', icon: DoorIcon },
];

export default function TransitionPicker() {
  const { getSelectedClip, updateClip } = useProjectStore();
  const clip = getSelectedClip();

  if (!clip) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Select a clip to set transition</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transition to next clip</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {TRANSITIONS.map(t => {
          const isActive = clip.transitionType === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => updateClip(clip.id, { transitionType: t.id }, 'transition')}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={t.icon}
                size={18}
                color={isActive ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  title: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  scroll: { paddingHorizontal: spacing[4], gap: spacing[2] },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 64,
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.accent,
    fontWeight: typography.semibold,
  },
  empty: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
});
