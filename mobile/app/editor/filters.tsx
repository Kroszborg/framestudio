import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Alert, TextInput, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, Add01Icon, Delete01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import {
  getFilterPresets, saveFilterPreset, deleteFilterPreset,
  FilterPreset,
} from '../../lib/database';
import { colors, typography, spacing, radius } from '../../lib/theme';

// Video thumbnails — native only
let getThumbnailAsync: ((uri: string, opts?: { time?: number; quality?: number }) => Promise<{ uri: string }>) | null = null;
if (Platform.OS !== 'web') {
  try {
    getThumbnailAsync = require('expo-video-thumbnails').getThumbnailAsync;
  } catch {}
}

const FILTERS = [
  // Original 12
  { id: null, name: 'None', preview: colors.surface2, overlay: null, css: 'none' },
  { id: 'vhs', name: 'VHS', preview: '#3D1520', overlay: { color: '#FF1493', opacity: 0.15 }, css: 'contrast(1.1) saturate(1.3) brightness(1.1)' },
  { id: 'bw', name: 'B&W', preview: '#444', overlay: { color: '#808080', opacity: 0.5 }, css: 'saturate(0)' },
  { id: 'glow', name: 'Glow', preview: '#4A3B00', overlay: { color: '#FFD700', opacity: 0.15 }, css: 'brightness(1.2) contrast(0.9)' },
  { id: 'cinematic', name: 'Cinema', preview: '#0D0D1F', overlay: { color: '#1a1a2e', opacity: 0.2 }, css: 'contrast(1.2) saturate(0.85) brightness(0.9)' },
  { id: 'sepia', name: 'Sepia', preview: '#3D2D1D', overlay: { color: '#704214', opacity: 0.35 }, css: 'sepia(0.8)' },
  { id: 'vintage', name: 'Vintage', preview: '#3D200A', overlay: { color: '#8B4513', opacity: 0.25 }, css: 'sepia(0.4) contrast(1.1) brightness(0.95)' },
  { id: 'cool', name: 'Cool', preview: '#003448', overlay: { color: '#1E90FF', opacity: 0.18 }, css: 'saturate(0.8) hue-rotate(20deg)' },
  { id: 'warm', name: 'Warm', preview: '#3D2000', overlay: { color: '#FF8C00', opacity: 0.18 }, css: 'saturate(1.2) hue-rotate(-10deg) brightness(1.05)' },
  { id: 'dramatic', name: 'Drama', preview: '#0E0E0E', overlay: { color: '#000000', opacity: 0.3 }, css: 'contrast(1.4) brightness(0.85) saturate(0.7)' },
  { id: 'neon', name: 'Neon', preview: '#1A0033', overlay: { color: '#9400D3', opacity: 0.18 }, css: 'saturate(1.5) brightness(1.1) contrast(1.2)' },
  { id: 'blur', name: 'Blur', preview: '#2A2A3A', overlay: { color: '#4A4A6A', opacity: 0.15 }, css: 'blur(2px)' },
  // Extended pack — 12 new filters
  { id: 'polaroid', name: 'Polaroid', preview: '#3D3020', overlay: { color: '#FFD27F', opacity: 0.2 }, css: 'contrast(0.9) brightness(1.1) saturate(1.2) sepia(0.15)' },
  { id: 'noir', name: 'Noir', preview: '#111', overlay: { color: '#000', opacity: 0.3 }, css: 'saturate(0) contrast(1.6) brightness(0.75)' },
  { id: 'chrome', name: 'Chrome', preview: '#253040', overlay: { color: '#4080C0', opacity: 0.1 }, css: 'saturate(1.3) contrast(1.1) brightness(0.95) hue-rotate(-10deg)' },
  { id: 'fade', name: 'Fade', preview: '#3A3025', overlay: { color: '#C8A060', opacity: 0.25 }, css: 'contrast(0.8) brightness(1.15) saturate(0.75)' },
  { id: 'lomo', name: 'Lomo', preview: '#1A2A10', overlay: { color: '#40C040', opacity: 0.1 }, css: 'contrast(1.5) saturate(1.5) brightness(0.8)' },
  { id: 'instant', name: 'Instant', preview: '#3D2010', overlay: { color: '#FF8040', opacity: 0.15 }, css: 'contrast(0.9) brightness(1.1) saturate(1.1) sepia(0.2)' },
  { id: 'daylight', name: 'Day', preview: '#203040', overlay: { color: '#60A0FF', opacity: 0.12 }, css: 'brightness(1.15) saturate(1.2) hue-rotate(5deg)' },
  { id: 'night', name: 'Night', preview: '#050A20', overlay: { color: '#000080', opacity: 0.35 }, css: 'brightness(0.6) saturate(0.6) hue-rotate(200deg)' },
  { id: 'tropical', name: 'Tropical', preview: '#002040', overlay: { color: '#00A0FF', opacity: 0.15 }, css: 'saturate(1.8) brightness(1.05) hue-rotate(-20deg)' },
  { id: 'mars', name: 'Mars', preview: '#401008', overlay: { color: '#C04010', opacity: 0.3 }, css: 'hue-rotate(25deg) saturate(1.5) contrast(1.2) brightness(0.85)' },
  { id: 'lunar', name: 'Lunar', preview: '#1A1A25', overlay: { color: '#8080C0', opacity: 0.2 }, css: 'saturate(0.3) contrast(1.3) brightness(0.8) hue-rotate(200deg)' },
  { id: 'velvia', name: 'Velvia', preview: '#103020', overlay: { color: '#008060', opacity: 0.15 }, css: 'saturate(2.0) contrast(1.3) brightness(0.9)' },
];

const { width: SCREEN_W } = Dimensions.get('window');
const NUM_COLS = 4;
const GRID_PAD = spacing[4];
const GRID_GAP = spacing[3];
const ITEM_W = (SCREEN_W - GRID_PAD * 2 - GRID_GAP * (NUM_COLS - 1)) / NUM_COLS;

export default function FiltersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getSelectedClip, updateClip, updateClipOptimistic, commitClipUpdate } = useProjectStore();
  const clip = getSelectedClip();
  const [customPresets, setCustomPresets] = useState<FilterPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [clipThumbUri, setClipThumbUri] = useState<string | null>(null);

  useEffect(() => {
    getFilterPresets().then(setCustomPresets);
  }, []);

  // Generate a thumbnail from the selected clip for filter preview swatches
  useEffect(() => {
    if (!clip) return;
    if (clip.type === 'image') {
      setClipThumbUri(clip.uri);
      return;
    }
    if (clip.type === 'video' && getThumbnailAsync) {
      let cancelled = false;
      getThumbnailAsync(clip.uri, { time: clip.trimStart + 500, quality: 0.3 })
        .then(r => { if (!cancelled) setClipThumbUri(r.uri); })
        .catch(() => {});
      return () => { cancelled = true; };
    }
  }, [clip?.uri]);

  const handleSelectFilter = useCallback((filterId: string | null) => {
    if (!clip) return;
    updateClip(clip.id, { filter: filterId, filterIntensity: 100 }, 'filter');
  }, [clip, updateClip]);

  const handleIntensityChange = useCallback((v: number) => {
    if (!clip) return;
    updateClipOptimistic(clip.id, { filterIntensity: v });
  }, [clip, updateClipOptimistic]);

  const handleIntensityCommit = useCallback(() => {
    if (!clip) return;
    commitClipUpdate(clip.id, 'filter intensity');
  }, [clip, commitClipUpdate]);

  async function handleSavePreset() {
    if (!clip || !presetName.trim()) return;
    const preset: FilterPreset = {
      id: `preset_${Date.now()}`,
      name: presetName.trim(),
      brightness: clip.brightness,
      contrast: clip.contrast,
      saturation: clip.saturation,
      temperature: clip.temperature,
      tint: clip.tint,
      highlights: clip.highlights,
      shadows: clip.shadows,
      sharpness: clip.sharpness,
      filter: clip.filter,
      filterIntensity: clip.filterIntensity,
    };
    await saveFilterPreset(preset);
    setCustomPresets(prev => [...prev, preset]);
    setShowSaveDialog(false);
    setPresetName('');
  }

  function handleApplyPreset(preset: FilterPreset) {
    if (!clip) return;
    updateClip(clip.id, {
      brightness: preset.brightness,
      contrast: preset.contrast,
      saturation: preset.saturation,
      temperature: preset.temperature,
      tint: preset.tint,
      highlights: preset.highlights,
      shadows: preset.shadows,
      sharpness: preset.sharpness,
      filter: preset.filter,
      filterIntensity: preset.filterIntensity,
    }, 'apply preset');
  }

  async function handleDeletePreset(id: string) {
    Alert.alert('Delete preset?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteFilterPreset(id);
          setCustomPresets(prev => prev.filter(p => p.id !== id));
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={Cancel01Icon} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Filters</Text>
        <TouchableOpacity
          style={styles.savePresetBtn}
          onPress={() => setShowSaveDialog(true)}
          activeOpacity={0.7}
          disabled={!clip}
        >
          <HugeiconsIcon icon={Add01Icon} size={16} color={clip ? colors.textPrimary : colors.textMuted} />
          <Text style={[styles.savePresetText, !clip && { color: colors.textMuted }]}>Save</Text>
        </TouchableOpacity>
      </View>

      {!clip && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Select a clip in the editor first</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}>
        {/* Intensity slider */}
        {clip?.filter && (
          <View style={styles.intensitySection}>
            <View style={styles.intensityHeader}>
              <Text style={styles.intensityLabel}>Intensity</Text>
              <Text style={styles.intensityValue}>{clip.filterIntensity}%</Text>
            </View>
            <Slider
              style={styles.intensitySlider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={clip.filterIntensity}
              onValueChange={handleIntensityChange}
              onSlidingComplete={handleIntensityCommit}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.surface3}
              thumbTintColor={colors.accent}
            />
          </View>
        )}

        {/* Built-in filters */}
        <Text style={styles.sectionLabel}>Built-in</Text>
        <View style={styles.grid}>
          {FILTERS.map(f => {
            const isActive = clip?.filter === f.id;
            return (
              <TouchableOpacity
                key={f.id ?? 'none'}
                style={[styles.item, isActive && styles.itemActive]}
                onPress={() => handleSelectFilter(f.id)}
                disabled={!clip}
                activeOpacity={0.7}
              >
                <View style={[styles.swatch, isActive && styles.swatchActive]}>
                  {clipThumbUri ? (
                    <>
                      {Platform.OS === 'web' ? (
                        <img
                          src={clipThumbUri}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 8,
                            filter: f.css || 'none',
                          } as any}
                        />
                      ) : (
                        <>
                          <Image
                            source={{ uri: clipThumbUri }}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode="cover"
                          />
                          {f.overlay && (
                            <View
                              style={[
                                StyleSheet.absoluteFillObject,
                                { backgroundColor: f.overlay.color, opacity: f.overlay.opacity, borderRadius: 8 },
                              ]}
                            />
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: f.preview, borderRadius: 8 }]} />
                  )}
                  {isActive && (
                    <View style={styles.swatchCheck}>
                      <HugeiconsIcon icon={Tick01Icon} size={16} color={colors.accent} />
                    </View>
                  )}
                </View>
                <Text style={[styles.name, isActive && styles.nameActive]}>{f.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom presets */}
        {customPresets.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Custom presets</Text>
            <View style={styles.grid}>
              {customPresets.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.item}
                  onPress={() => handleApplyPreset(p)}
                  onLongPress={() => handleDeletePreset(p.id)}
                  disabled={!clip}
                  activeOpacity={0.7}
                >
                  <View style={[styles.swatch, { backgroundColor: colors.surface2 }]}>
                    <Text style={styles.presetInitial}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Save preset dialog */}
        {showSaveDialog && (
          <View style={styles.saveDialog}>
            <Text style={styles.saveDialogTitle}>Save current settings as preset</Text>
            <TextInput
              style={styles.saveInput}
              value={presetName}
              onChangeText={setPresetName}
              placeholder="Preset name..."
              placeholderTextColor={colors.textMuted}
              autoFocus
              maxLength={30}
            />
            <View style={styles.saveDialogButtons}>
              <TouchableOpacity
                style={styles.saveDialogCancel}
                onPress={() => { setShowSaveDialog(false); setPresetName(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.saveDialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveDialogConfirm, !presetName.trim() && { opacity: 0.4 }]}
                onPress={handleSavePreset}
                disabled={!presetName.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.saveDialogConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  navBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface1, borderRadius: radius.full,
  },
  navTitle: { fontSize: typography.lg, fontWeight: typography.semibold, color: colors.textPrimary },
  savePresetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border,
  },
  savePresetText: { fontSize: typography.sm, color: colors.textPrimary, fontWeight: typography.medium },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: typography.base, color: colors.textMuted },
  scrollContent: { paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  // Intensity
  intensitySection: {
    marginBottom: spacing[4], backgroundColor: colors.surface1,
    borderRadius: radius.md, padding: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  intensityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  intensityLabel: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium },
  intensityValue: { fontSize: typography.sm, color: colors.textPrimary, fontWeight: typography.semibold },
  intensitySlider: { height: 32, marginHorizontal: -6 },
  // Section label
  sectionLabel: {
    fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[2],
  },
  // Grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3],
    marginBottom: spacing[4],
  },
  item: { alignItems: 'center', gap: spacing[2], width: ITEM_W },
  itemActive: {},
  swatch: {
    width: ITEM_W - 8, height: ITEM_W - 8, borderRadius: radius.md,
    borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  swatchActive: { borderColor: colors.accent },
  swatchCheck: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
  },
  name: { fontSize: typography.sm, color: colors.textSecondary },
  nameActive: { color: colors.accent, fontWeight: typography.semibold },
  presetInitial: { fontSize: typography.lg, fontWeight: typography.bold, color: colors.textMuted },
  // Save dialog
  saveDialog: {
    backgroundColor: colors.surface1, borderRadius: radius.lg,
    padding: spacing[4], gap: spacing[3],
    borderWidth: 1, borderColor: colors.border,
  },
  saveDialogTitle: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.semibold },
  saveInput: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing[3],
    fontSize: typography.base, color: colors.textPrimary,
  },
  saveDialogButtons: { flexDirection: 'row', gap: spacing[2], justifyContent: 'flex-end' },
  saveDialogCancel: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  saveDialogCancelText: { fontSize: typography.sm, color: colors.textMuted },
  saveDialogConfirm: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.md, backgroundColor: colors.accent,
  },
  saveDialogConfirmText: { fontSize: typography.sm, color: colors.bg, fontWeight: typography.semibold },
});
