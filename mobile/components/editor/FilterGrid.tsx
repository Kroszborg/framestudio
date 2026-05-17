import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useProjectStore } from '../../lib/projectStore';
import { colors, typography, spacing, radius } from '../../lib/theme';

const FILTERS = [
  { id: null, name: 'None', bg: colors.surface2 },
  { id: 'vhs', name: 'VHS', bg: '#8B0000' },
  { id: 'bw', name: 'B&W', bg: '#555' },
  { id: 'glow', name: 'Glow', bg: '#B8860B' },
  { id: 'cinematic', name: 'Cinema', bg: '#1a1a3a' },
  { id: 'sepia', name: 'Sepia', bg: '#7B5B3A' },
  { id: 'vintage', name: 'Vintage', bg: '#8B4513' },
  { id: 'cool', name: 'Cool', bg: '#00688B' },
  { id: 'warm', name: 'Warm', bg: '#8B4500' },
  { id: 'dramatic', name: 'Drama', bg: '#1C1C1C' },
];

export default function FilterGrid() {
  const { getSelectedClip, updateClip } = useProjectStore();
  const clip = getSelectedClip();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Filters</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {FILTERS.map(f => {
          const isActive = clip?.filter === f.id;
          return (
            <TouchableOpacity
              key={f.id ?? 'none'}
              style={styles.item}
              onPress={() => clip && updateClip(clip.id, { filter: f.id }, 'filter')}
              disabled={!clip}
              activeOpacity={0.7}
            >
              <View style={[styles.swatch, { backgroundColor: f.bg }, isActive && styles.swatchActive]} />
              <Text style={[styles.name, isActive && styles.nameActive]}>{f.name}</Text>
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
  scroll: { paddingHorizontal: spacing[4], gap: spacing[3] },
  item: { alignItems: 'center', gap: 4 },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: colors.accent },
  name: { fontSize: 10, color: colors.textSecondary },
  nameActive: { color: colors.accent, fontWeight: typography.semibold },
});
