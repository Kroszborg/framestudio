/**
 * KeyframeEditor — inline keyframe timeline strip in the inspector.
 * Shows a mini timeline with diamond markers for each keyframe.
 * Allows adding, deleting, and selecting keyframes.
 * When a keyframe is selected, a bezier graph view appears below.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, PanResponder,
} from 'react-native';
import { colors, typography, spacing, radius } from '../../lib/theme';
import { ClipAnimTrack, AnimKeyframe, EasingType } from '../../lib/keyframes';
import KeyframeGraph from './KeyframeGraph';

const PARAM_LABELS: Record<string, string> = {
  scale: 'Scale', posX: 'Position X', posY: 'Position Y',
  rotation: 'Rotation', opacity: 'Opacity',
  brightness: 'Brightness', saturation: 'Saturation',
};

const EASING_PRESETS: { id: EasingType; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'ease_in', label: 'Ease In' },
  { id: 'ease_out', label: 'Ease Out' },
  { id: 'ease_in_out', label: 'Ease In/Out' },
  { id: 'spring', label: 'Spring' },
  { id: 'bounce', label: 'Bounce' },
];

interface Props {
  track: ClipAnimTrack;
  clipDurationMs: number;
  currentTimeMs: number;
  onUpdateTrack: (updated: ClipAnimTrack) => void;
  onDeleteTrack: () => void;
}

export default function KeyframeEditor({
  track, clipDurationMs, currentTimeMs, onUpdateTrack, onDeleteTrack,
}: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const STRIP_W = 240;

  function timeToX(t: number) { return (t / Math.max(1, clipDurationMs)) * STRIP_W; }
  function xToTime(x: number) { return Math.max(0, Math.min(clipDurationMs, (x / STRIP_W) * clipDurationMs)); }

  function addKeyframeAtCurrentTime() {
    const existing = track.keyframes.find(k => Math.abs(k.time - currentTimeMs) < 100);
    if (existing) return;
    const nearestValue = track.keyframes.length > 0
      ? track.keyframes[track.keyframes.length - 1].value
      : getDefaultValue(track.param);
    const newKf: AnimKeyframe = { time: currentTimeMs, value: nearestValue, easing: 'ease_in_out' };
    const updated = [...track.keyframes, newKf].sort((a, b) => a.time - b.time);
    onUpdateTrack({ ...track, keyframes: updated });
  }

  function deleteKeyframe(idx: number) {
    const updated = track.keyframes.filter((_, i) => i !== idx);
    onUpdateTrack({ ...track, keyframes: updated });
    setSelectedIdx(null);
  }

  function updateEasing(idx: number, easing: EasingType) {
    const updated = track.keyframes.map((k, i) => i === idx ? { ...k, easing } : k);
    onUpdateTrack({ ...track, keyframes: updated });
  }

  const selected = selectedIdx !== null ? track.keyframes[selectedIdx] : null;

  return (
    <View style={styles.container}>
      {/* Track header */}
      <View style={styles.header}>
        <Text style={styles.trackLabel}>{PARAM_LABELS[track.param] ?? track.param}</Text>
        <TouchableOpacity onPress={addKeyframeAtCurrentTime} style={styles.addBtn} activeOpacity={0.7}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDeleteTrack} style={styles.delTrackBtn} activeOpacity={0.7}>
          <Text style={styles.delTrackBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Timeline strip */}
      <View style={[styles.strip, { width: STRIP_W }]}>
        {/* Current time indicator */}
        <View style={[styles.playhead, { left: timeToX(currentTimeMs) }]} />
        {/* Keyframe diamonds */}
        {track.keyframes.map((kf, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.diamond, { left: timeToX(kf.time) - 6 }, selectedIdx === i && styles.diamondSelected]}
            onPress={() => setSelectedIdx(selectedIdx === i ? null : i)}
            activeOpacity={0.8}
          />
        ))}
      </View>

      {/* Selected keyframe controls */}
      {selected !== null && selectedIdx !== null && (
        <View style={styles.kfControls}>
          <Text style={styles.kfTime}>{Math.round(selected.time)}ms</Text>
          {/* Easing presets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingVertical: 4 }}>
            {EASING_PRESETS.map(e => (
              <TouchableOpacity
                key={e.id}
                style={[styles.easingChip, selected.easing === e.id && styles.easingChipActive]}
                onPress={() => updateEasing(selectedIdx, e.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.easingChipText, selected.easing === e.id && styles.easingChipTextActive]}>{e.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Bezier graph — shown for all easings, interactive for 'custom' */}
          <KeyframeGraph
            keyframe={selected}
            onUpdate={(updates) => {
              const updated = track.keyframes.map((k, i) => i === selectedIdx ? { ...k, ...updates } : k);
              onUpdateTrack({ ...track, keyframes: updated });
            }}
          />

          <TouchableOpacity onPress={() => deleteKeyframe(selectedIdx)} style={styles.delKfBtn} activeOpacity={0.7}>
            <Text style={styles.delKfBtnText}>Delete keyframe</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function getDefaultValue(param: string): number {
  switch (param) {
    case 'scale': return 1.0;
    case 'opacity': return 1.0;
    default: return 0;
  }
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface1, borderRadius: radius.md, padding: spacing[2], marginBottom: spacing[2] },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  trackLabel: { flex: 1, fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.semibold },
  addBtn: { backgroundColor: colors.accentMuted, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, marginRight: 4 },
  addBtnText: { fontSize: 10, color: colors.accent, fontWeight: '700' },
  delTrackBtn: { paddingHorizontal: 6, paddingVertical: 3 },
  delTrackBtnText: { fontSize: 11, color: colors.error },
  strip: { height: 24, backgroundColor: colors.surface2, borderRadius: 4, overflow: 'visible', marginBottom: 4 },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.accent },
  diamond: {
    position: 'absolute', width: 12, height: 12, top: 6,
    backgroundColor: colors.textMuted,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  diamondSelected: { backgroundColor: colors.accent, width: 14, height: 14, top: 5 },
  kfControls: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  kfTime: { fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  easingChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  easingChipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  easingChipText: { fontSize: 10, color: colors.textMuted },
  easingChipTextActive: { color: colors.accent, fontWeight: '700' },
  delKfBtn: { marginTop: 6, paddingVertical: 4, alignItems: 'center' },
  delKfBtnText: { fontSize: 10, color: colors.error },
});
