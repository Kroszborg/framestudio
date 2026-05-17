/**
 * PhotoEditorPanel — dedicated editing UI for photo projects.
 * Shows tool category tabs with inline controls — no video timeline.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter, type Href } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  MixerIcon, PaintBrushIcon, FilterIcon, CropIcon, TextIcon,
  StarSquareIcon, ArrowReloadHorizontalIcon, Tick01Icon,
} from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { autoAdjustClip } from '../../lib/autoAdjust';
import { colors, typography, spacing, radius } from '../../lib/theme';

type Tab = 'adjust' | 'color' | 'filters' | 'crop' | 'text' | 'sticker' | 'mask';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'adjust', label: 'Adjust', icon: MixerIcon },
  { id: 'color', label: 'Color', icon: PaintBrushIcon },
  { id: 'filters', label: 'Filters', icon: FilterIcon },
  { id: 'crop', label: 'Crop', icon: CropIcon },
  { id: 'mask', label: 'Mask', icon: StarSquareIcon },
  { id: 'text', label: 'Text', icon: TextIcon },
  { id: 'sticker', label: 'Sticker', icon: StarSquareIcon },
];

const NAMED_FILTERS: { id: string; label: string }[] = [
  { id: 'none', label: 'Original' },
  { id: 'bw', label: 'B&W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'cool', label: 'Cool' },
  { id: 'warm', label: 'Warm' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'cinematic', label: 'Cinema' },
  { id: 'vhs', label: 'VHS' },
  { id: 'glow', label: 'Glow' },
  { id: 'neon', label: 'Neon' },
  // Cinematic additions
  { id: 'orange_teal', label: 'Orange Teal' },
  { id: 'moody', label: 'Moody' },
  { id: 'golden_hour', label: 'Golden Hr' },
  { id: 'matte', label: 'Matte' },
  { id: 'faded', label: 'Faded' },
  { id: 'tokyo', label: 'Tokyo' },
  { id: 'pacific', label: 'Pacific' },
  { id: 'noir', label: 'Noir' },
  { id: 'pastel', label: 'Pastel' },
  { id: 'kodak', label: 'Kodak' },
  { id: 'fuji', label: 'Fuji' },
];

// ── Slider row ────────────────────────────────────────────────────────────────
function SliderRow({
  label, value, min, max, step = 1, unit = '',
  onChange, onCommit,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string;
  onChange: (v: number) => void; onCommit?: () => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{value > 0 ? `+${value}` : value}{unit}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        onSlidingComplete={onCommit}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.surface3}
        thumbTintColor={colors.accent}
      />
    </View>
  );
}

// ── Adjust panel (opacity, transform) ────────────────────────────────────────
function AdjustPanel({ clip }: { clip: ReturnType<ReturnType<typeof useProjectStore>['getSelectedClip']> }) {
  const { updateClipOptimistic, commitClipUpdate } = useProjectStore();
  if (!clip) return <NoClipHint />;
  const opt = (k: keyof typeof clip, v: number) => updateClipOptimistic(clip.id, { [k]: v } as any);
  const com = (k: string) => commitClipUpdate(clip.id, k);
  return (
    <View style={styles.panel}>
      {/* Auto-adjust */}
      <TouchableOpacity
        style={{ backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginBottom: 8 }}
        onPress={async () => {
          try {
            const { updateClip } = useProjectStore.getState();
            const adjustments = await autoAdjustClip(clip.uri);
            updateClip(clip.id, { ...adjustments }, 'auto adjust');
          } catch {}
        }}
        activeOpacity={0.8}
      >
        <Text style={{ color: colors.accent === '#fff' ? '#000' : '#fff', fontWeight: '700', fontSize: 12 }}>✦ Auto Adjust</Text>
      </TouchableOpacity>
      <SliderRow label="Exposure" value={clip.exposure ?? 0} min={-3} max={3} step={0.05} unit=" EV" onChange={v => opt('exposure', v)} onCommit={() => com('exposure')} />
      <SliderRow label="Brightness" value={clip.brightness} min={-100} max={100} onChange={v => opt('brightness', v)} onCommit={() => com('brightness')} />
      <SliderRow label="Contrast" value={clip.contrast} min={-100} max={100} onChange={v => opt('contrast', v)} onCommit={() => com('contrast')} />
      <SliderRow label="Highlights" value={clip.highlights} min={-100} max={100} onChange={v => opt('highlights', v)} onCommit={() => com('highlights')} />
      <SliderRow label="Shadows" value={clip.shadows} min={-100} max={100} onChange={v => opt('shadows', v)} onCommit={() => com('shadows')} />
      <SliderRow label="Whites" value={clip.whites ?? 0} min={-100} max={100} onChange={v => opt('whites', v)} onCommit={() => com('whites')} />
      <SliderRow label="Blacks" value={clip.blacks ?? 0} min={-100} max={100} onChange={v => opt('blacks', v)} onCommit={() => com('blacks')} />
      <SliderRow label="Sharpness" value={clip.sharpness} min={0} max={100} onChange={v => opt('sharpness', v)} onCommit={() => com('sharpness')} />
      <SliderRow label="Clarity" value={clip.clarity ?? 0} min={-100} max={100} onChange={v => opt('clarity', v)} onCommit={() => com('clarity')} />
      <SliderRow label="Dehaze" value={clip.dehaze ?? 0} min={-100} max={100} onChange={v => opt('dehaze', v)} onCommit={() => com('dehaze')} />
      <SliderRow label="Vibrance" value={clip.vibrance ?? 0} min={-100} max={100} onChange={v => opt('vibrance', v)} onCommit={() => com('vibrance')} />
      <SliderRow label="Fade" value={clip.fade ?? 0} min={0} max={100} onChange={v => opt('fade', v)} onCommit={() => com('fade')} />
      <SliderRow label="Grain" value={clip.grain ?? 0} min={0} max={100} onChange={v => opt('grain', v)} onCommit={() => com('grain')} />
    </View>
  );
}

// ── HSL per-channel panel ─────────────────────────────────────────────────────
const HSL_CHANNELS = ['Reds', 'Oranges', 'Yellows', 'Greens', 'Cyans', 'Blues'];
const HSL_COLORS   = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6'];

function PhotoHSLPanel({ clip }: { clip: ReturnType<ReturnType<typeof useProjectStore>['getSelectedClip']> }) {
  const { updateClipOptimistic, commitClipUpdate, updateClip } = useProjectStore();
  const [activeChannel, setActiveChannel] = useState(0);
  if (!clip) return null;
  const hslHue = clip.hslHue ?? [0,0,0,0,0,0];
  const hslSat = clip.hslSat ?? [0,0,0,0,0,0];
  const hslLum = clip.hslLum ?? [0,0,0,0,0,0];

  const setHue = (i: number, v: number) => { const n = [...hslHue]; n[i] = v; updateClipOptimistic(clip.id, { hslHue: n } as any); };
  const setSat = (i: number, v: number) => { const n = [...hslSat]; n[i] = v; updateClipOptimistic(clip.id, { hslSat: n } as any); };
  const setLum = (i: number, v: number) => { const n = [...hslLum]; n[i] = v; updateClipOptimistic(clip.id, { hslLum: n } as any); };
  const com = () => commitClipUpdate(clip.id, 'hsl');
  const hasChanges = [...hslHue, ...hslSat, ...hslLum].some(v => v !== 0);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={[styles.sliderLabel, { fontWeight: '600', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }]}>HSL</Text>
        {hasChanges && (
          <TouchableOpacity onPress={() => updateClip(clip.id, { hslHue: [0,0,0,0,0,0], hslSat: [0,0,0,0,0,0], hslLum: [0,0,0,0,0,0] } as any, 'reset hsl')} activeOpacity={0.7}>
            <Text style={{ fontSize: 10, color: colors.textMuted }}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingBottom: 6 }}>
        {HSL_CHANNELS.map((ch, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setActiveChannel(i)}
            style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
              backgroundColor: activeChannel === i ? HSL_COLORS[i] + '33' : colors.surface1,
              borderWidth: 1, borderColor: activeChannel === i ? HSL_COLORS[i] : colors.border,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 10, color: activeChannel === i ? HSL_COLORS[i] : colors.textMuted, fontWeight: activeChannel === i ? '700' : '400' }}>{ch}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <SliderRow label="Hue" value={hslHue[activeChannel]} min={-180} max={180} step={1} unit="°" onChange={v => setHue(activeChannel, v)} onCommit={com} />
      <SliderRow label="Saturation" value={hslSat[activeChannel]} min={-100} max={100} onChange={v => setSat(activeChannel, v)} onCommit={com} />
      <SliderRow label="Luminance" value={hslLum[activeChannel]} min={-100} max={100} onChange={v => setLum(activeChannel, v)} onCommit={com} />
    </View>
  );
}

// ── Color panel ───────────────────────────────────────────────────────────────
function ColorPanel({ clip }: { clip: ReturnType<ReturnType<typeof useProjectStore>['getSelectedClip']> }) {
  const { updateClipOptimistic, commitClipUpdate, updateClip } = useProjectStore();
  if (!clip) return <NoClipHint />;
  const opt = (k: keyof typeof clip, v: number) => updateClipOptimistic(clip.id, { [k]: v } as any);
  const com = (k: string) => commitClipUpdate(clip.id, k);
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Color grading</Text>
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => updateClip(clip.id, {
            brightness: 0, contrast: 0, saturation: 0, temperature: 0,
            tint: 0, highlights: 0, shadows: 0, sharpness: 0,
            exposure: 0, vibrance: 0, clarity: 0, dehaze: 0,
            blacks: 0, whites: 0, fade: 0, grain: 0,
            hslHue: [0,0,0,0,0,0], hslSat: [0,0,0,0,0,0], hslLum: [0,0,0,0,0,0],
          }, 'reset color')}
          activeOpacity={0.7}
        >
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={13} color={colors.textMuted} />
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>
      <SliderRow label="Saturation" value={clip.saturation} min={-100} max={100} onChange={v => opt('saturation', v)} onCommit={() => com('saturation')} />
      <SliderRow label="Temperature" value={clip.temperature} min={-100} max={100} onChange={v => opt('temperature', v)} onCommit={() => com('temperature')} />
      <SliderRow label="Tint" value={clip.tint} min={-100} max={100} onChange={v => opt('tint', v)} onCommit={() => com('tint')} />

      {/* HSL Per-Channel */}
      <View style={{ marginTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[2] }}>
        <PhotoHSLPanel clip={clip} />
      </View>
    </View>
  );
}

// ── Filters panel ─────────────────────────────────────────────────────────────
const FILTER_COLORS: Record<string, string> = {
  none: '#1A1A1A', bw: '#444', sepia: '#7A4A14', vintage: '#6A3A10',
  cool: '#0A2040', warm: '#402010', dramatic: '#0A0A0A', cinematic: '#0A0A20',
  vhs: '#201020', glow: '#302010', neon: '#100A30',
};

// ── Mask panel ────────────────────────────────────────────────────────────────
function MaskPanel({ clip }: { clip: ReturnType<ReturnType<typeof useProjectStore>['getSelectedClip']> }) {
  const { updateClip, updateClipOptimistic, commitClipUpdate } = useProjectStore();
  if (!clip) return <NoClipHint />;
  const opt = (k: string, v: any) => updateClipOptimistic(clip.id, { [k]: v } as any);
  const com = (k: string) => commitClipUpdate(clip.id, k);
  const maskType = (clip as any).maskType ?? 'none';
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Selective editing</Text>
        {maskType !== 'none' && (
          <TouchableOpacity style={styles.resetBtn} onPress={() => updateClip(clip.id, { maskType: 'none' } as any, 'remove mask')} activeOpacity={0.7}>
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={13} color={colors.textMuted} />
            <Text style={styles.resetBtnText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Mask type selector */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing[3] }}>
        {(['none', 'radial', 'linear'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.filterItem, maskType === t && { opacity: 1 }]}
            onPress={() => updateClip(clip.id, { maskType: t } as any, 'mask type')}
            activeOpacity={0.7}
          >
            <View style={[styles.filterSwatch, maskType === t && styles.filterSwatchActive]}>
              <Text style={{ fontSize: 14 }}>{t === 'none' ? '✕' : t === 'radial' ? '◯' : '⬛'}</Text>
            </View>
            <Text style={[styles.filterLabel, maskType === t && styles.filterLabelActive]}>
              {t === 'none' ? 'Off' : t === 'radial' ? 'Radial' : 'Linear'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {maskType !== 'none' && (
        <>
          {maskType === 'radial' && (
            <>
              <SliderRow label="Center X" value={(clip as any).maskX ?? 0.5} min={0} max={1} step={0.01} onChange={v => opt('maskX', v)} onCommit={() => com('maskX')} />
              <SliderRow label="Center Y" value={(clip as any).maskY ?? 0.5} min={0} max={1} step={0.01} onChange={v => opt('maskY', v)} onCommit={() => com('maskY')} />
              <SliderRow label="Radius" value={(clip as any).maskRadius ?? 0.3} min={0.05} max={0.8} step={0.01} onChange={v => opt('maskRadius', v)} onCommit={() => com('maskRadius')} />
            </>
          )}
          {maskType === 'linear' && (
            <>
              <SliderRow label="Position X" value={(clip as any).maskX ?? 0.5} min={0} max={1} step={0.01} onChange={v => opt('maskX', v)} onCommit={() => com('maskX')} />
              <SliderRow label="Position Y" value={(clip as any).maskY ?? 0.5} min={0} max={1} step={0.01} onChange={v => opt('maskY', v)} onCommit={() => com('maskY')} />
              <SliderRow label="Angle" value={(clip as any).maskAngle ?? 0} min={-180} max={180} step={1} unit="°" onChange={v => opt('maskAngle', v)} onCommit={() => com('maskAngle')} />
            </>
          )}
          <SliderRow label="Feather" value={(clip as any).maskFeather ?? 0.1} min={0} max={0.5} step={0.01} onChange={v => opt('maskFeather', v)} onCommit={() => com('maskFeather')} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[2] }}>
            <Text style={styles.sliderLabel}>Invert mask</Text>
            <TouchableOpacity
              onPress={() => updateClip(clip.id, { maskInvert: !((clip as any).maskInvert ?? false) } as any, 'mask invert')}
              style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: (clip as any).maskInvert ? colors.accent : colors.surface2, borderWidth: 1, borderColor: (clip as any).maskInvert ? colors.accent : colors.border }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 11, color: (clip as any).maskInvert ? colors.bg : colors.textMuted, fontWeight: '600' }}>{(clip as any).maskInvert ? 'On' : 'Off'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 8, lineHeight: 14 }}>
            Mask affects all color adjustments in Adjust and Color tabs. Edit those tabs while the mask is active to apply changes only to the masked area.
          </Text>
        </>
      )}
    </View>
  );
}

// ── Filters panel ─────────────────────────────────────────────────────────────
function FiltersPanel({ clip }: { clip: ReturnType<ReturnType<typeof useProjectStore>['getSelectedClip']> }) {
  const { updateClip, updateClipOptimistic, commitClipUpdate } = useProjectStore();
  if (!clip) return <NoClipHint />;
  return (
    <View style={styles.panel}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {NAMED_FILTERS.map(f => {
          const active = (clip.filter ?? 'none') === f.id || (f.id === 'none' && !clip.filter);
          return (
            <TouchableOpacity
              key={f.id}
              style={styles.filterItem}
              onPress={() => updateClip(clip.id, { filter: f.id === 'none' ? null : f.id }, 'filter')}
              activeOpacity={0.7}
            >
              <View style={[styles.filterSwatch, { backgroundColor: FILTER_COLORS[f.id] ?? '#1A1A1A' }, active && styles.filterSwatchActive]}>
                {active && <HugeiconsIcon icon={Tick01Icon} size={14} color={colors.accent} />}
              </View>
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {clip.filter && (
        <View style={{ marginTop: spacing[3] }}>
          <SliderRow
            label="Intensity"
            value={clip.filterIntensity ?? 100}
            min={0} max={100} unit="%"
            onChange={v => updateClipOptimistic(clip.id, { filterIntensity: v })}
            onCommit={() => commitClipUpdate(clip.id, 'filter intensity')}
          />
        </View>
      )}
    </View>
  );
}

// ── No clip hint ──────────────────────────────────────────────────────────────
function NoClipHint() {
  return (
    <View style={styles.noClipHint}>
      <Text style={styles.noClipText}>Tap the photo to select it</Text>
    </View>
  );
}

// ── Main PhotoEditorPanel ────────────────────────────────────────────────────
interface Props {
  onAddMedia?: () => void;
  projectId?: string;
  currentTime?: number;
}

export default function PhotoEditorPanel({ onAddMedia, projectId, currentTime }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('adjust');
  const { getSelectedClip } = useProjectStore();
  const clip = getSelectedClip();

  function handleTabPress(tab: Tab) {
    setActiveTab(tab);
    if (tab === 'crop') {
      router.push('/editor/crop' as Href);
      return;
    }
    if (tab === 'text') {
      router.push('/editor/text' as Href);
      return;
    }
    if (tab === 'sticker') {
      if (!projectId) return;
      router.push(`/editor/sticker?id=${projectId}&time=${currentTime ?? 0}` as Href);
      return;
    }
  }

  const renderPanel = () => {
    switch (activeTab) {
      case 'adjust': return <AdjustPanel clip={clip} />;
      case 'color': return <ColorPanel clip={clip} />;
      case 'filters': return <FiltersPanel clip={clip} />;
      case 'mask': return <MaskPanel clip={clip} />;
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => handleTabPress(tab.id)}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={tab.icon}
                  size={17}
                  color={active ? colors.accent : colors.textMuted}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Active panel */}
      <ScrollView
        style={styles.panelScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderPanel()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    height: 52,
  },
  tabScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    height: 52,
    gap: 4,
  },
  tab: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
    gap: 2,
    minWidth: 60,
    height: 44,
  },
  tabActive: {
    backgroundColor: colors.accentMuted,
  },
  tabLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: typography.semibold,
  },
  // Panel
  panelScroll: { flex: 1 },
  panel: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[1],
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  panelTitle: {
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
  resetBtnText: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  // Slider
  sliderRow: { marginBottom: spacing[1] },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sliderLabel: { fontSize: typography.sm, color: colors.textSecondary },
  sliderValue: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: typography.medium,
    fontFamily: 'monospace',
    minWidth: 40,
    textAlign: 'right',
  },
  slider: { height: 28, marginHorizontal: -6 },
  // Filters
  filterRow: {
    paddingVertical: spacing[2],
    gap: spacing[3],
  },
  filterItem: {
    alignItems: 'center',
    gap: 6,
  },
  filterSwatch: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSwatchActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  filterLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  filterLabelActive: {
    color: colors.accent,
    fontWeight: typography.semibold,
  },
  // No clip
  noClipHint: {
    paddingVertical: spacing[6],
    alignItems: 'center',
  },
  noClipText: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
});
