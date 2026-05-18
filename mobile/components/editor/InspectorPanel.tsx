import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { KeyframeIcon, BlurIcon, Move01Icon, ArrowReloadHorizontalIcon, SpeedTrain01Icon, VideoReplayIcon, BrushIcon, MixerIcon, FlipHorizontalIcon, FlipVerticalIcon } from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { colors, typography, spacing, radius } from '../../lib/theme';
import { Clip, KenBurnsConfig, VolumeKeyframe, DEFAULT_KEN_BURNS } from '../../lib/database';
import { autoAdjustClip } from '../../lib/autoAdjust';
import { createDollyZoomPreset, createZoomInPreset, createZoomOutPreset } from '../../lib/keyframes';
import KeyframeEditor from './KeyframeEditor';

const TABS = [
  { id: 'clip', label: 'Clip' },
  { id: 'color', label: 'Color' },
  { id: 'effects', label: 'FX' },
  { id: 'audio', label: 'Audio' },
  { id: 'keyframes', label: 'Keys' },
] as const;

function SliderRow({
  label, value, min, max, step = 1, unit = '', onChange, onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>
          {typeof value === 'number' ? `${value.toFixed(step < 0.1 ? 2 : 0)}${unit}` : '\u2014'}
        </Text>
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

function ToggleRow({ label, value, onChange, icon }: {
  label: string; value: boolean; onChange: (v: boolean) => void; icon?: any;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLeft}>
        {icon && <HugeiconsIcon icon={icon} size={14} color={colors.textSecondary} />}
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surface3, true: colors.accent }}
        thumbColor={colors.textPrimary}
        style={{ transform: [{ scale: 0.8 }] }}
      />
    </View>
  );
}

type SpeedRampCurve = 'constant' | 'ease_in' | 'ease_out' | 'ease_in_out' | 'freeze';

const SPEED_RAMP_CURVES: { id: SpeedRampCurve; label: string; icon: string }[] = [
  { id: 'constant', label: 'Const', icon: '—' },
  { id: 'ease_in', label: 'Ease in', icon: '⟶' },
  { id: 'ease_out', label: 'Ease out', icon: '⟵' },
  { id: 'ease_in_out', label: 'S-Curve', icon: '∿' },
  { id: 'freeze', label: 'Freeze', icon: '||' },
];

function SpeedRampSection({ clip, updateClip, updateClipOptimistic }: {
  clip: Clip;
  updateClip: (id: string, updates: Partial<Clip>, label?: string) => Promise<void>;
  updateClipOptimistic: (id: string, updates: Partial<Clip>) => void;
}) {
  const rampCurve: SpeedRampCurve = clip.speedRampCurve ?? 'constant';
  const isFrozen = rampCurve === 'freeze';

  function handleCurve(c: SpeedRampCurve) {
    updateClip(clip.id, { speedRampCurve: c }, 'speed ramp curve');
  }

  return (
    <View style={styles.speedRampSection}>
      <View style={styles.subSectionHeader}>
        <HugeiconsIcon icon={SpeedTrain01Icon} size={14} color={colors.textMuted} />
        <Text style={styles.subSectionTitle}>Speed</Text>
        <Text style={styles.speedValue}>{isFrozen ? 'FROZEN' : `${clip.speed.toFixed(2)}×`}</Text>
      </View>

      {/* Speed slider (hidden when frozen) */}
      {!isFrozen && (
        <View style={styles.speedSliderRow}>
          {[0.25, 0.5, 1, 1.5, 2, 3, 4].map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.speedPresetBtn, Math.abs(clip.speed - v) < 0.02 && styles.speedPresetActive]}
              onPress={() => updateClip(clip.id, { speed: v }, 'speed preset')}
              activeOpacity={0.7}
            >
              <Text style={[styles.speedPresetText, Math.abs(clip.speed - v) < 0.02 && styles.speedPresetTextActive]}>
                {v === 1 ? '1×' : v < 1 ? `${v}×` : `${v}×`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Ramp curve picker */}
      <View style={styles.rampRow}>
        {SPEED_RAMP_CURVES.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.rampChip, rampCurve === c.id && styles.rampChipActive]}
            onPress={() => handleCurve(c.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.rampIcon, rampCurve === c.id && { color: colors.accentText }]}>{c.icon}</Text>
            <Text style={[styles.rampLabel, rampCurve === c.id && styles.rampLabelActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/** Ken Burns editor for image clips */
function KenBurnsSection({ clip }: { clip: Clip }) {
  const { updateClip, updateClipOptimistic, commitClipUpdate } = useProjectStore();
  const kb = clip.kenBurns || DEFAULT_KEN_BURNS;

  const updateKB = useCallback((updates: Partial<KenBurnsConfig>) => {
    updateClipOptimistic(clip.id, { kenBurns: { ...kb, ...updates } });
  }, [clip.id, kb, updateClipOptimistic]);

  const commitKB = useCallback(async () => {
    await commitClipUpdate(clip.id, 'ken burns');
  }, [clip.id, commitClipUpdate]);

  return (
    <View style={styles.subSection}>
      <ToggleRow
        label="Ken Burns effect"
        value={kb.enabled}
        onChange={v => updateClip(clip.id, { kenBurns: { ...kb, enabled: v } }, 'ken burns toggle')}
        icon={Move01Icon}
      />
      {kb.enabled && (
        <>
          <Text style={styles.subLabel}>Start position</Text>
          <SliderRow label="Pan X" value={kb.startX} min={0} max={1} step={0.01} onChange={v => updateKB({ startX: v })} onCommit={commitKB} />
          <SliderRow label="Pan Y" value={kb.startY} min={0} max={1} step={0.01} onChange={v => updateKB({ startY: v })} onCommit={commitKB} />
          <SliderRow label="Zoom" value={kb.startZoom} min={1} max={2} step={0.01} unit="\u00D7" onChange={v => updateKB({ startZoom: v })} onCommit={commitKB} />
          <Text style={styles.subLabel}>End position</Text>
          <SliderRow label="Pan X" value={kb.endX} min={0} max={1} step={0.01} onChange={v => updateKB({ endX: v })} onCommit={commitKB} />
          <SliderRow label="Pan Y" value={kb.endY} min={0} max={1} step={0.01} onChange={v => updateKB({ endY: v })} onCommit={commitKB} />
          <SliderRow label="Zoom" value={kb.endZoom} min={1} max={2} step={0.01} unit="\u00D7" onChange={v => updateKB({ endZoom: v })} onCommit={commitKB} />
        </>
      )}
    </View>
  );
}

/** Volume envelope / keyframes */
function VolumeEnvelopeSection({ clip }: { clip: Clip }) {
  const { updateClip, commitClipUpdate } = useProjectStore();
  const keyframes = clip.volumeKeyframes || [];
  const effectiveDuration = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed;

  function addKeyframe() {
    const time = effectiveDuration / 2;
    const newKf: VolumeKeyframe = { time, value: clip.volume };
    const updated = [...keyframes, newKf].sort((a, b) => a.time - b.time);
    updateClip(clip.id, { volumeKeyframes: updated }, 'add volume keyframe');
  }

  function removeKeyframe(idx: number) {
    const updated = keyframes.filter((_, i) => i !== idx);
    updateClip(clip.id, { volumeKeyframes: updated }, 'remove volume keyframe');
  }

  return (
    <View style={styles.subSection}>
      <View style={styles.subSectionHeader}>
        <HugeiconsIcon icon={KeyframeIcon} size={14} color={colors.textMuted} />
        <Text style={styles.subSectionTitle}>Volume envelope</Text>
        <TouchableOpacity style={styles.addKeyframeBtn} onPress={addKeyframe} activeOpacity={0.7}>
          <Text style={styles.addKeyframeBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Visual envelope */}
      <View style={styles.envelopeTrack}>
        <View style={styles.envelopeLine} />
        {keyframes.map((kf, i) => {
          const leftPct = effectiveDuration > 0 ? (kf.time / effectiveDuration) * 100 : 0;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.envelopeDot, { left: `${leftPct}%` as any, bottom: `${kf.value * 100}%` as any }]}
              onLongPress={() => removeKeyframe(i)}
              activeOpacity={0.7}
            >
              <View style={styles.envelopeDotInner} />
            </TouchableOpacity>
          );
        })}
      </View>

      {keyframes.length === 0 && (
        <Text style={styles.envelopeHint}>Tap + Add to create volume automation points</Text>
      )}

      {keyframes.map((kf, i) => (
        <View key={i} style={styles.kfRow}>
          <Text style={styles.kfLabel}>KF {i + 1}: {(kf.time / 1000).toFixed(1)}s</Text>
          <Slider
            style={styles.kfSlider}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={kf.value}
            onValueChange={v => {
              const updated = [...keyframes];
              updated[i] = { ...updated[i], value: v };
              useProjectStore.getState().updateClipOptimistic(clip.id, { volumeKeyframes: updated });
            }}
            onSlidingComplete={() => {
              commitClipUpdate(clip.id, 'volume keyframe');
            }}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.surface3}
            thumbTintColor={colors.accent}
          />
          <Text style={styles.kfValue}>{Math.round(kf.value * 100)}%</Text>
        </View>
      ))}
    </View>
  );
}

const HSL_CHANNELS = ['Reds', 'Oranges', 'Yellows', 'Greens', 'Cyans', 'Blues'];
const HSL_COLORS   = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6'];

function HSLPanel({ clip, updateClip, updateClipOptimistic, commitClipUpdate }: {
  clip: Clip;
  updateClip: (id: string, u: Partial<Clip>, l?: string) => Promise<void>;
  updateClipOptimistic: (id: string, u: Partial<Clip>) => void;
  commitClipUpdate: (id: string, l?: string) => Promise<void>;
}) {
  const [activeChannel, setActiveChannel] = useState(0);
  const hslHue = clip.hslHue ?? [0,0,0,0,0,0];
  const hslSat = clip.hslSat ?? [0,0,0,0,0,0];
  const hslLum = clip.hslLum ?? [0,0,0,0,0,0];

  function setHue(idx: number, v: number) {
    const n = [...hslHue]; n[idx] = v;
    updateClipOptimistic(clip.id, { hslHue: n });
  }
  function setSat(idx: number, v: number) {
    const n = [...hslSat]; n[idx] = v;
    updateClipOptimistic(clip.id, { hslSat: n });
  }
  function setLum(idx: number, v: number) {
    const n = [...hslLum]; n[idx] = v;
    updateClipOptimistic(clip.id, { hslLum: n });
  }
  function commit() { commitClipUpdate(clip.id, 'hsl'); }

  const hasChanges = [...hslHue, ...hslSat, ...hslLum].some(v => v !== 0);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>HSL</Text>
        {hasChanges && (
          <TouchableOpacity
            onPress={() => updateClip(clip.id, { hslHue: [0,0,0,0,0,0], hslSat: [0,0,0,0,0,0], hslLum: [0,0,0,0,0,0] }, 'reset hsl')}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 10, color: colors.textMuted }}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>
      {/* Channel selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingBottom: 6 }}>
        {HSL_CHANNELS.map((ch, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setActiveChannel(i)}
            style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
              backgroundColor: activeChannel === i ? HSL_COLORS[i] + '33' : colors.surface2,
              borderWidth: 1, borderColor: activeChannel === i ? HSL_COLORS[i] : colors.border,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 10, color: activeChannel === i ? HSL_COLORS[i] : colors.textMuted, fontWeight: activeChannel === i ? '700' : '400' }}>{ch}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* H/S/L sliders for active channel */}
      <SliderRow label="Hue" value={hslHue[activeChannel]} min={-180} max={180} step={1} unit="°" onChange={v => setHue(activeChannel, v)} onCommit={commit} />
      <SliderRow label="Saturation" value={hslSat[activeChannel]} min={-100} max={100} onChange={v => setSat(activeChannel, v)} onCommit={commit} />
      <SliderRow label="Luminance" value={hslLum[activeChannel]} min={-100} max={100} onChange={v => setLum(activeChannel, v)} onCommit={commit} />
    </View>
  );
}

export default function InspectorPanel() {
  const { activeInspectorTab, setActiveInspectorTab, selectedClipId, getSelectedClip, updateClip, updateClipOptimistic, commitClipUpdate } = useProjectStore();
  const clip = getSelectedClip();

  // Reset to 'clip' tab when a different clip is selected
  const prevClipId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedClipId && selectedClipId !== prevClipId.current) {
      setActiveInspectorTab('clip');
      prevClipId.current = selectedClipId;
    }
  }, [selectedClipId]);

  const optimistic = useCallback((key: keyof Clip, value: any) => {
    if (!clip) return;
    updateClipOptimistic(clip.id, { [key]: value });
  }, [clip, updateClipOptimistic]);

  const commit = useCallback(async (key: string) => {
    if (!clip) return;
    await commitClipUpdate(clip.id, `set ${key}`);
  }, [clip, commitClipUpdate]);

  const update = useCallback((key: keyof Clip, value: any) => {
    if (!clip) return;
    // Use optimistic update first for instant visual feedback, then commit
    updateClipOptimistic(clip.id, { [key]: value });
    commitClipUpdate(clip.id, `set ${key}`);
  }, [clip, updateClip, updateClipOptimistic, commitClipUpdate]);

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeInspectorTab === tab.id && styles.tabActive]}
            onPress={() => setActiveInspectorTab(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeInspectorTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!clip ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Select a clip to inspect</Text>
        </View>
      ) : (
        <ScrollView horizontal={false} showsVerticalScrollIndicator={false} style={styles.content} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {activeInspectorTab === 'clip' && (
            <View style={styles.section}>
              <SliderRow label="Opacity" value={clip.opacity ?? 1} min={0} max={1} step={0.01} onChange={v => optimistic('opacity', v)} onCommit={() => commit('opacity')} />
              <SliderRow label="Volume" value={clip.volume} min={0} max={1} step={0.01} onChange={v => optimistic('volume', v)} onCommit={() => commit('volume')} />
              <SliderRow label="Rotation" value={clip.rotation} min={-180} max={180} step={1} unit="\u00B0" onChange={v => optimistic('rotation', v)} onCommit={() => commit('rotation')} />
              <SliderRow label="Scale X" value={clip.scaleX} min={0.1} max={4} step={0.05} unit="\u00D7" onChange={v => optimistic('scaleX', v)} onCommit={() => commit('scaleX')} />
              <SliderRow label="Scale Y" value={clip.scaleY} min={0.1} max={4} step={0.05} unit="\u00D7" onChange={v => optimistic('scaleY', v)} onCommit={() => commit('scaleY')} />
              {/* Flip buttons */}
              <View style={styles.flipRow}>
                <Text style={styles.sliderLabel}>Flip</Text>
                <View style={styles.flipBtns}>
                  <TouchableOpacity
                    style={[styles.flipBtn, (clip.flipH ?? false) && styles.flipBtnActive]}
                    onPress={() => update('flipH', !(clip.flipH ?? false))}
                    activeOpacity={0.7}
                  >
                    <HugeiconsIcon icon={FlipHorizontalIcon} size={14} color={(clip.flipH ?? false) ? colors.accent : colors.textMuted} />
                    <Text style={[(clip.flipH ?? false) ? styles.flipLabelActive : styles.flipLabel]}>H</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.flipBtn, (clip.flipV ?? false) && styles.flipBtnActive]}
                    onPress={() => update('flipV', !(clip.flipV ?? false))}
                    activeOpacity={0.7}
                  >
                    <HugeiconsIcon icon={FlipVerticalIcon} size={14} color={(clip.flipV ?? false) ? colors.accent : colors.textMuted} />
                    <Text style={[(clip.flipV ?? false) ? styles.flipLabelActive : styles.flipLabel]}>V</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* Motion blur toggle */}
              <ToggleRow label="Motion blur" value={clip.motionBlur} onChange={v => update('motionBlur', v)} icon={BlurIcon} />
              {/* Reverse — play clip backwards (applied at export via FFmpeg) */}
              {clip.type === 'video' && (
                <ToggleRow label="Reverse (play backwards)" value={clip.reverse ?? false} onChange={v => update('reverse', v)} icon={VideoReplayIcon} />
              )}
              {/* Ken Burns for images */}
              {clip.type === 'image' && <KenBurnsSection clip={clip} />}
              {/* Speed ramp section */}
              <SpeedRampSection clip={clip} updateClip={updateClip} updateClipOptimistic={updateClipOptimistic} />
            </View>
          )}

          {activeInspectorTab === 'color' && (
            <View style={styles.section}>
              <View style={styles.colorResetRow}>
                <Text style={styles.sectionTitle}>Color grading</Text>
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
                  <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={12} color={colors.textMuted} />
                  <Text style={styles.resetBtnText}>Reset</Text>
                </TouchableOpacity>
              </View>
              {/* Quick color grade presets */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {([
                  { name: 'Cinematic', values: { brightness: -10, contrast: 20, saturation: -15, temperature: -10, highlights: -20, shadows: 10 } },
                  { name: 'Portrait', values: { brightness: 8, contrast: -5, saturation: 10, temperature: 15, highlights: -10, shadows: 5 } },
                  { name: 'Landscape', values: { brightness: 5, contrast: 15, saturation: 25, temperature: -5, highlights: -15, shadows: 15 } },
                  { name: 'Night', values: { brightness: -20, contrast: 30, saturation: -30, temperature: -20, highlights: -30, shadows: 20 } },
                  { name: 'Vintage', values: { brightness: -5, contrast: 10, saturation: -20, temperature: 25, tint: 10, highlights: -10 } },
                ] as const).map(preset => (
                  <TouchableOpacity
                    key={preset.name}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => updateClip(clip.id, { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, sharpness: 0, ...preset.values }, `preset ${preset.name}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: typography.medium }}>{preset.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Auto-adjust button */}
              <TouchableOpacity
                style={{ backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginBottom: 8 }}
                onPress={async () => {
                  try {
                    const adjustments = await autoAdjustClip(clip.uri);
                    updateClip(clip.id, { ...adjustments, autoAdjusted: true }, 'auto adjust');
                  } catch {}
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: colors.bg, fontWeight: '700', fontSize: 12 }}>✦ Auto Adjust</Text>
              </TouchableOpacity>

              {/* Light */}
              <Text style={[styles.subLabel, { marginTop: 4 }]}>LIGHT</Text>
              <SliderRow label="Exposure" value={clip.exposure ?? 0} min={-3} max={3} step={0.05} unit=" EV" onChange={v => optimistic('exposure', v)} onCommit={() => commit('exposure')} />
              <SliderRow label="Brightness" value={clip.brightness} min={-100} max={100} onChange={v => optimistic('brightness', v)} onCommit={() => commit('brightness')} />
              <SliderRow label="Contrast" value={clip.contrast} min={-100} max={100} onChange={v => optimistic('contrast', v)} onCommit={() => commit('contrast')} />
              <SliderRow label="Highlights" value={clip.highlights} min={-100} max={100} onChange={v => optimistic('highlights', v)} onCommit={() => commit('highlights')} />
              <SliderRow label="Shadows" value={clip.shadows} min={-100} max={100} onChange={v => optimistic('shadows', v)} onCommit={() => commit('shadows')} />
              <SliderRow label="Whites" value={clip.whites ?? 0} min={-100} max={100} onChange={v => optimistic('whites', v)} onCommit={() => commit('whites')} />
              <SliderRow label="Blacks" value={clip.blacks ?? 0} min={-100} max={100} onChange={v => optimistic('blacks', v)} onCommit={() => commit('blacks')} />
              {/* Colour */}
              <Text style={[styles.subLabel, { marginTop: 4 }]}>COLOUR</Text>
              <SliderRow label="Temperature" value={clip.temperature} min={-100} max={100} onChange={v => optimistic('temperature', v)} onCommit={() => commit('temperature')} />
              <SliderRow label="Tint" value={clip.tint} min={-100} max={100} onChange={v => optimistic('tint', v)} onCommit={() => commit('tint')} />
              <SliderRow label="Saturation" value={clip.saturation} min={-100} max={100} onChange={v => optimistic('saturation', v)} onCommit={() => commit('saturation')} />
              <SliderRow label="Vibrance" value={clip.vibrance ?? 0} min={-100} max={100} onChange={v => optimistic('vibrance', v)} onCommit={() => commit('vibrance')} />
              {/* Detail */}
              <Text style={[styles.subLabel, { marginTop: 4 }]}>DETAIL</Text>
              <SliderRow label="Sharpness" value={clip.sharpness} min={0} max={100} onChange={v => optimistic('sharpness', v)} onCommit={() => commit('sharpness')} />
              <SliderRow label="Clarity" value={clip.clarity ?? 0} min={-100} max={100} onChange={v => optimistic('clarity', v)} onCommit={() => commit('clarity')} />
              <SliderRow label="Dehaze" value={clip.dehaze ?? 0} min={-100} max={100} onChange={v => optimistic('dehaze', v)} onCommit={() => commit('dehaze')} />
              {/* Effects */}
              <Text style={[styles.subLabel, { marginTop: 4 }]}>EFFECTS</Text>
              <SliderRow label="Fade" value={clip.fade ?? 0} min={0} max={100} onChange={v => optimistic('fade', v)} onCommit={() => commit('fade')} />
              <SliderRow label="Grain" value={clip.grain ?? 0} min={0} max={100} onChange={v => optimistic('grain', v)} onCommit={() => commit('grain')} />

              {/* HSL Per-Channel */}
              <View style={styles.divider} />
              <HSLPanel clip={clip} updateClip={updateClip} updateClipOptimistic={updateClipOptimistic} commitClipUpdate={commitClipUpdate} />

              {/* LUT import */}
              <View style={styles.lutSection}>
                <Text style={styles.subLabel}>LUT Import</Text>
                {clip.lutName ? (
                  <View style={styles.lutActiveRow}>
                    <Text style={styles.lutActiveName} numberOfLines={1}>{clip.lutName}</Text>
                    <TouchableOpacity
                      onPress={() => updateClip(clip.id, { lutUri: null, lutName: null }, 'remove LUT')}
                      activeOpacity={0.7}
                      style={styles.lutRemoveBtn}
                    >
                      <Text style={styles.lutRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.lutBtn}
                    activeOpacity={0.7}
                    onPress={async () => {
                      try {
                        const result = await DocumentPicker.getDocumentAsync({
                          type: Platform.OS === 'ios' ? 'public.data' : '*/*',
                          copyToCacheDirectory: true,
                        });
                        if (result.canceled) return;
                        const asset = result.assets[0];
                        const name = asset.name || 'Unknown LUT';
                        if (!name.toLowerCase().endsWith('.cube')) {
                          Alert.alert('Invalid file', 'Please select a .cube LUT file');
                          return;
                        }
                        // Copy to permanent storage
                        const lutDir = `${(FileSystem as any).documentDirectory}luts/`;
                        await FileSystem.makeDirectoryAsync(lutDir, { intermediates: true }).catch(() => {});
                        const destPath = `${lutDir}${Date.now()}_${name}`;
                        await FileSystem.copyAsync({ from: asset.uri, to: destPath });
                        updateClip(clip.id, { lutUri: destPath, lutName: name }, 'import LUT');
                      } catch (e: any) {
                        Alert.alert('Error', e?.message || 'Could not import LUT');
                      }
                    }}
                  >
                    <Text style={styles.lutBtnText}>Import .cube LUT</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.envelopeHint}>LUT will be applied during export with FFmpeg</Text>
              </View>
            </View>
          )}

          {activeInspectorTab === 'effects' && (
            <View style={styles.section}>
              {/* Clip In/Out animations */}
              <Text style={styles.sectionTitle}>Clip Entry & Exit</Text>
              <Text style={[styles.envelopeHint, { marginBottom: 6 }]}>Control how this clip appears and disappears</Text>

              {/* In Transition */}
              <Text style={styles.subLabel}>IN TRANSITION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4, marginBottom: 6 }}>
                {([
                  { id: 'none', label: 'None' }, { id: 'fade', label: 'Fade In' },
                  { id: 'zoom_in', label: 'Zoom In' }, { id: 'zoom_out', label: 'Zoom Out' },
                  { id: 'slide_left', label: 'Slide ←' }, { id: 'slide_right', label: 'Slide →' },
                  { id: 'slide_up', label: 'Slide ↑' }, { id: 'slide_down', label: 'Slide ↓' },
                  { id: 'dissolve', label: 'Dissolve' }, { id: 'shake', label: 'Shake In' },
                ] as { id: string; label: string }[]).map(t => {
                  const active = (clip.clipTransitionIn ?? 'none') === t.id;
                  return (
                    <TouchableOpacity key={t.id} style={[styles.transChip, active && styles.transChipActive]}
                      onPress={() => update('clipTransitionIn' as any, t.id)} activeOpacity={0.7}>
                      <Text style={[styles.transChipText, active && styles.transChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {(clip.clipTransitionIn ?? 'none') !== 'none' && (
                <SliderRow label="In duration" value={clip.clipTransitionInDuration ?? 400} min={100} max={1500} step={50} unit="ms"
                  onChange={v => optimistic('clipTransitionInDuration' as any, v)} onCommit={() => commit('clipTransitionInDuration')} />
              )}

              {/* Out Transition */}
              <Text style={[styles.subLabel, { marginTop: 8 }]}>OUT TRANSITION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4, marginBottom: 6 }}>
                {([
                  { id: 'none', label: 'None' }, { id: 'fade', label: 'Fade Out' },
                  { id: 'zoom_in', label: 'Zoom In' }, { id: 'zoom_out', label: 'Zoom Out' },
                  { id: 'slide_left', label: 'Slide ←' }, { id: 'slide_right', label: 'Slide →' },
                  { id: 'slide_up', label: 'Slide ↑' }, { id: 'slide_down', label: 'Slide ↓' },
                  { id: 'dissolve', label: 'Dissolve' }, { id: 'shake', label: 'Shake Out' },
                ] as { id: string; label: string }[]).map(t => {
                  const active = (clip.clipTransitionOut ?? 'none') === t.id;
                  return (
                    <TouchableOpacity key={t.id} style={[styles.transChip, active && styles.transChipActive]}
                      onPress={() => update('clipTransitionOut' as any, t.id)} activeOpacity={0.7}>
                      <Text style={[styles.transChipText, active && styles.transChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {(clip.clipTransitionOut ?? 'none') !== 'none' && (
                <SliderRow label="Out duration" value={clip.clipTransitionOutDuration ?? 400} min={100} max={1500} step={50} unit="ms"
                  onChange={v => optimistic('clipTransitionOutDuration' as any, v)} onCommit={() => commit('clipTransitionOutDuration')} />
              )}

              <View style={styles.divider} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.sectionTitle}>Transition to next clip</Text>
                <Text style={{ fontSize: 9, color: colors.textMuted, fontStyle: 'italic' }}>▶ visible during playback</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {(['none', 'fade', 'dissolve', 'slide_left', 'slide_right', 'zoom', 'wipe', 'blur', 'spin', 'glitch', 'flash', 'diagonal', 'color_wipe', 'barn_door', 'push_left', 'push_right', 'circle_wipe', 'cross_zoom', 'pixelate', 'flip', 'whip_pan', 'cube'] as Clip['transitionType'][]).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.transChip, clip.transitionType === t && styles.transChipActive]}
                    onPress={() => update('transitionType', t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.transChipText, clip.transitionType === t && styles.transChipTextActive]}>
                      {t === 'none' ? 'Cut' : t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {clip.transitionType !== 'none' && (
                <SliderRow label="Duration" value={clip.transitionDuration} min={100} max={2000} step={50} unit="ms" onChange={v => optimistic('transitionDuration', v)} onCommit={() => commit('transitionDuration')} />
              )}
              {/* Named filter selection */}
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Filters</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {([
                  { id: null, label: 'None' },
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
                ] as { id: string | null; label: string }[]).map(f => {
                  const active = (clip.filter ?? null) === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id ?? 'none'}
                      style={[styles.transChip, active && styles.transChipActive]}
                      onPress={() => updateClip(clip.id, { filter: f.id }, 'filter')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.transChipText, active && styles.transChipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {clip.filter && (
                <SliderRow label="Filter intensity" value={clip.filterIntensity ?? 100} min={0} max={100} step={1} unit="%" onChange={v => optimistic('filterIntensity', v)} onCommit={() => commit('filterIntensity')} />
              )}
              {/* Enhancement */}
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Enhancement</Text>
              <ToggleRow label="Quality Enhance" value={clip.enhance ?? false} onChange={v => update('enhance', v)} icon={MixerIcon} />
              <ToggleRow label="Stabilize" value={clip.stabilize ?? false} onChange={v => update('stabilize', v)} icon={VideoReplayIcon} />
              <ToggleRow label="Denoise" value={clip.denoise ?? false} onChange={v => update('denoise', v)} icon={MixerIcon} />
              {/* Chroma key */}
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Chroma Key</Text>
              <ToggleRow label="Green screen" value={clip.chromaKeyEnabled ?? false} onChange={v => update('chromaKeyEnabled', v)} icon={BrushIcon} />
              {(clip.chromaKeyEnabled ?? false) && (
                <>
                  <SliderRow label="Threshold" value={clip.chromaKeyThreshold ?? 30} min={0} max={100} step={1} unit="%" onChange={v => optimistic('chromaKeyThreshold', v)} onCommit={() => commit('chromaKeyThreshold')} />
                  <View style={styles.chromaColorRow}>
                    <Text style={styles.sliderLabel}>Key color</Text>
                    <View style={styles.chromaColors}>
                      {['#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FFFFFF'].map(c => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.chromaSwatch, { backgroundColor: c }, (clip.chromaKeyColor ?? '#00FF00') === c && styles.chromaSwatchActive]}
                          onPress={() => update('chromaKeyColor', c)}
                          activeOpacity={0.7}
                        />
                      ))}
                    </View>
                  </View>
                </>
              )}

              {/* 3D Parallax Camera — image clips only */}
              {clip.type === 'image' && (
                <>
                  <View style={styles.divider} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.sectionTitle}>3D Camera</Text>
                    <TouchableOpacity
                      onPress={() => update('parallaxEnabled', !(clip.parallaxEnabled ?? false))}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10,
                        backgroundColor: (clip.parallaxEnabled ?? false) ? colors.accent : colors.surface2,
                        borderWidth: 1, borderColor: (clip.parallaxEnabled ?? false) ? colors.accent : colors.border,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: (clip.parallaxEnabled ?? false) ? colors.bg : colors.textMuted }}>
                        {(clip.parallaxEnabled ?? false) ? 'ON' : 'OFF'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {(clip.parallaxEnabled ?? false) && (
                    <View style={{ gap: 8, marginTop: 6 }}>
                      {/* Visual camera preset cards */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {([
                          { id: 'dolly_in', icon: '🎬', label: 'Dolly In', desc: 'Zoom towards subject' },
                          { id: 'pan_left', icon: '⬅️', label: 'Pan Left', desc: 'Slide camera left' },
                          { id: 'pan_right', icon: '➡️', label: 'Pan Right', desc: 'Slide camera right' },
                          { id: 'orbit', icon: '🔄', label: 'Orbit', desc: 'Circle around center' },
                          { id: 'push_forward', icon: '⬆️', label: 'Push In', desc: 'Move into scene' },
                          { id: 'drift', icon: '🌊', label: 'Drift', desc: 'Gentle floating motion' },
                        ] as const).map(p => {
                          const active = (clip.parallaxPreset ?? 'dolly_in') === p.id;
                          return (
                            <TouchableOpacity
                              key={p.id}
                              style={{
                                width: '47%', padding: 10,
                                borderRadius: radius.md, borderWidth: active ? 1.5 : 1,
                                backgroundColor: active ? colors.accentMuted : colors.surface1,
                                borderColor: active ? colors.accent : colors.border,
                              }}
                              onPress={() => update('parallaxPreset', p.id)}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</Text>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colors.accent : colors.textPrimary }}>{p.label}</Text>
                              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{p.desc}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {/* Speed control */}
                      <SliderRow
                        label="Camera speed"
                        value={(clip as any).parallaxSpeed ?? 1.0}
                        min={0.3} max={3.0} step={0.1} unit="×"
                        onChange={v => optimistic('parallaxSpeed' as any, v)}
                        onCommit={() => commit('parallaxSpeed')}
                      />
                      <Text style={styles.envelopeHint}>
                        3D camera renders as animated video at export
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Background removal (video clips only) */}
              {clip.type === 'video' && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Background Removal</Text>
                  <ToggleRow
                    label="Remove background"
                    value={(clip as any).backgroundRemovalEnabled ?? false}
                    onChange={v => update('backgroundRemovalEnabled' as any, v)}
                    icon={BrushIcon}
                  />
                  {(clip as any).backgroundRemovalEnabled && (
                    <>
                      <SliderRow
                        label="Edge feather"
                        value={(clip as any).backgroundFeather ?? 5}
                        min={0} max={20} step={1} unit="px"
                        onChange={v => optimistic('backgroundFeather' as any, v)}
                        onCommit={() => commit('backgroundFeather')}
                      />
                      <Text style={styles.envelopeHint}>Background removal applied at export (requires APK rebuild)</Text>
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {activeInspectorTab === 'audio' && (
            <View style={styles.section}>
              <SliderRow label="Volume" value={clip.volume} min={0} max={1} step={0.01} onChange={v => optimistic('volume', v)} onCommit={() => commit('volume')} />
              {/* Fade in/out — applied at export and previewed during playback */}
              <SliderRow label="Fade in" value={clip.fadeIn ?? 0} min={0} max={3000} step={100} unit="ms" onChange={v => optimistic('fadeIn', v)} onCommit={() => commit('fadeIn')} />
              <SliderRow label="Fade out" value={clip.fadeOut ?? 0} min={0} max={3000} step={100} unit="ms" onChange={v => optimistic('fadeOut', v)} onCommit={() => commit('fadeOut')} />
              <VolumeEnvelopeSection clip={clip} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Type</Text>
                <Text style={styles.infoValue}>{clip.type}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Duration</Text>
                <Text style={styles.infoValue}>{(clip.duration / 1000).toFixed(2)}s</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Speed</Text>
                <Text style={styles.infoValue}>{clip.speed}\u00D7</Text>
              </View>
            </View>
          )}

          {activeInspectorTab === 'keyframes' && (
            <View style={styles.section}>
              <View style={styles.keyframesHeader}>
                <HugeiconsIcon icon={KeyframeIcon} size={16} color={colors.textMuted} />
                <Text style={styles.sectionTitle}>Animation Keyframes</Text>
              </View>

              {/* Preset buttons */}
              <Text style={styles.subLabel}>PRESETS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {[
                  { label: 'Dolly Zoom', fn: 'dolly' },
                  { label: 'Zoom In', fn: 'zoom_in' },
                  { label: 'Zoom Out', fn: 'zoom_out' },
                  { label: 'Pan Left', fn: 'pan_left' },
                  { label: 'Pan Right', fn: 'pan_right' },
                  { label: 'Fade In', fn: 'fade_in' },
                ].map(p => (
                  <TouchableOpacity
                    key={p.fn}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent }}
                    onPress={() => {
                      const effDur = (clip.duration - clip.trimStart - clip.trimEnd) / Math.max(0.01, clip.speed);
                      let tracks: any[] = [];
                      if (p.fn === 'dolly') tracks = createDollyZoomPreset(effDur);
                      else if (p.fn === 'zoom_in') tracks = createZoomInPreset(effDur);
                      else if (p.fn === 'zoom_out') tracks = createZoomOutPreset(effDur);
                      else if (p.fn === 'pan_left') tracks = [{ param: 'posX', keyframes: [{ time: 0, value: 0, easing: 'ease_in_out' }, { time: effDur, value: -80, easing: 'ease_in_out' }] }];
                      else if (p.fn === 'pan_right') tracks = [{ param: 'posX', keyframes: [{ time: 0, value: 0, easing: 'ease_in_out' }, { time: effDur, value: 80, easing: 'ease_in_out' }] }];
                      else if (p.fn === 'fade_in') tracks = [{ param: 'opacity', keyframes: [{ time: 0, value: 0, easing: 'ease_in' }, { time: Math.min(500, effDur), value: 1, easing: 'ease_in' }] }];
                      updateClip(clip.id, { animTracks: tracks }, `preset ${p.fn}`);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11, color: colors.accent, fontWeight: typography.semibold }}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
                {clip.animTracks && clip.animTracks.length > 0 && (
                  <TouchableOpacity
                    style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.error }}
                    onPress={() => updateClip(clip.id, { animTracks: [] }, 'clear keyframes')}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11, color: colors.error }}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Keyframe tracks */}
              {(clip.animTracks ?? []).map((track, i) => {
                const { currentTime } = useProjectStore.getState();
                const localTime = currentTime - clip.startTime;
                return (
                  <KeyframeEditor
                    key={`${track.param}-${i}`}
                    track={track}
                    clipDurationMs={(clip.duration - clip.trimStart - clip.trimEnd) / Math.max(0.01, clip.speed)}
                    currentTimeMs={Math.max(0, localTime)}
                    onUpdateTrack={(updated: any) => {
                      const newTracks = [...(clip.animTracks ?? [])];
                      newTracks[i] = updated;
                      updateClip(clip.id, { animTracks: newTracks }, 'edit keyframe');
                    }}
                    onDeleteTrack={() => {
                      const newTracks = (clip.animTracks ?? []).filter((_: any, j: number) => j !== i);
                      updateClip(clip.id, { animTracks: newTracks }, 'delete track');
                    }}
                  />
                );
              })}

              <VolumeEnvelopeSection clip={clip} />
              {clip.type === 'image' && <KenBurnsSection clip={clip} />}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgElevated, borderTopWidth: 1, borderTopColor: colors.border },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing[2] + 2 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { fontSize: typography.xs + 1, color: colors.textMuted, fontWeight: typography.medium },
  tabTextActive: { color: colors.accent, fontWeight: typography.semibold },
  empty: { height: 60, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: typography.sm, color: colors.textMuted },
  content: { flex: 1 },
  section: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: spacing[1] },
  sectionTitle: {
    fontSize: typography.xs, fontWeight: typography.semibold,
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  colorResetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
    borderRadius: radius.md, backgroundColor: colors.surface1,
  },
  resetBtnText: { fontSize: typography.xs, color: colors.textMuted },
  sliderRow: { gap: 2, marginBottom: spacing[1] },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { fontSize: typography.xs, color: colors.textSecondary },
  sliderValue: { fontSize: typography.xs, color: colors.textPrimary, fontWeight: typography.semibold },
  slider: { height: 28, marginHorizontal: -6 },
  // Toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleLabel: { fontSize: typography.sm, color: colors.textSecondary },
  // Sub-sections
  subSection: { marginTop: spacing[2], gap: spacing[1] },
  subSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  subSectionTitle: {
    fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, flex: 1,
  },
  subLabel: {
    fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textMuted,
    marginTop: spacing[2], marginBottom: spacing[1],
  },
  // Keyframe buttons
  addKeyframeBtn: {
    paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: radius.sm, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border,
  },
  addKeyframeBtnText: { fontSize: typography.xs, color: colors.textSecondary },
  // Volume envelope
  envelopeTrack: {
    height: 40, backgroundColor: colors.surface1, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, position: 'relative', overflow: 'hidden',
  },
  envelopeLine: {
    position: 'absolute', top: '50%', left: 0, right: 0,
    height: 1, backgroundColor: colors.textMuted, opacity: 0.3,
  },
  envelopeDot: {
    position: 'absolute', width: 16, height: 16, marginLeft: -8, marginBottom: -8,
    alignItems: 'center', justifyContent: 'center',
  },
  envelopeDotInner: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent,
    borderWidth: 1, borderColor: colors.bg,
  },
  envelopeHint: { fontSize: typography.xs, color: colors.textMuted, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[2] },
  kfRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: 2,
  },
  kfLabel: { fontSize: typography.xs, color: colors.textSecondary, minWidth: 70 },
  kfSlider: { flex: 1, height: 24 },
  kfValue: { fontSize: typography.xs, color: colors.textPrimary, fontWeight: typography.semibold, minWidth: 32, textAlign: 'right' },
  // Keyframes tab
  keyframesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing[1] },
  // Transitions
  transitionGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[2],
  },
  transChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: radius.md, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border,
  },
  transChipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  transChipText: { fontSize: typography.xs, color: colors.textSecondary },
  transChipTextActive: { color: colors.accent, fontWeight: typography.semibold },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing[1] + 2,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  infoLabel: { fontSize: typography.sm, color: colors.textMuted },
  infoValue: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium },
  // LUT
  lutSection: { marginTop: spacing[2], gap: spacing[1] },
  lutBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  lutBtnText: { fontSize: typography.sm, color: colors.textSecondary },
  lutActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  lutActiveName: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing[2],
  },
  lutRemoveBtn: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  lutRemoveText: { fontSize: typography.xs, color: colors.error },
  // Speed ramp
  speedRampSection: {
    marginTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing[2],
    gap: spacing[2],
  },
  speedValue: {
    fontSize: typography.xs,
    color: colors.accent,
    fontWeight: typography.semibold,
    marginLeft: 'auto' as any,
  },
  speedSliderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
  },
  speedPresetBtn: {
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: spacing[1],
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speedPresetActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  speedPresetText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  speedPresetTextActive: {
    color: colors.accent,
    fontWeight: typography.semibold,
  },
  rampRow: {
    flexDirection: 'row',
    gap: spacing[1],
    flexWrap: 'wrap',
  },
  rampChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    gap: 2,
  },
  rampChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  rampIcon: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  rampLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  rampLabelActive: {
    color: colors.accentText,
    fontWeight: typography.semibold,
  },
  // Flip row
  flipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  flipBtns: { flexDirection: 'row', gap: 6 },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  flipBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  flipLabel: { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.medium },
  flipLabelActive: { fontSize: typography.xs, color: colors.accent, fontWeight: typography.semibold },
  // Chroma key
  chromaColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  chromaColors: { flexDirection: 'row', gap: 6 },
  chromaSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chromaSwatchActive: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
});
