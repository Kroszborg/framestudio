import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  PanResponder,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, Tick01Icon, ArrowReloadHorizontalIcon } from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { colors, typography, spacing, radius } from '../../lib/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const ASPECT_PRESETS: { label: string; ratio: [number, number] | null }[] = [
  { label: 'Free', ratio: null },
  { label: '16:9', ratio: [16, 9] },
  { label: '9:16', ratio: [9, 16] },
  { label: '1:1', ratio: [1, 1] },
  { label: '4:3', ratio: [4, 3] },
  { label: '3:4', ratio: [3, 4] },
  { label: '21:9', ratio: [21, 9] },
  { label: '4:5', ratio: [4, 5] },
];

interface CropRect {
  x: number; // 0-1
  y: number;
  w: number;
  h: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function CropScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateClip } = useProjectStore();
  // Reactive selector — subscribes to store so clip is always current
  const clip = useProjectStore(s => s.clips.find(c => c.id === s.selectedClipId) ?? null);

  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const selectedPresetRef = useRef(selectedPreset);
  const [crop, setCrop] = useState<CropRect>({
    x: clip?.cropX ?? 0,
    y: clip?.cropY ?? 0,
    w: clip?.cropW ?? 1,
    h: clip?.cropH ?? 1,
  });
  const cropRef = useRef(crop);

  const [imageSize, setImageSize] = useState({ w: 1, h: 1 });
  const [sizeLoaded, setSizeLoaded] = useState(false);

  React.useEffect(() => {
    if (clip?.uri) {
      Image.getSize(
        clip.uri,
        (w, h) => {
          setImageSize({ w: w || 1, h: h || 1 });
          setSizeLoaded(true);
        },
        () => {
          setImageSize({ w: 1, h: 1 });
          setSizeLoaded(true);
        }
      );
    }
  }, [clip?.uri]);

  // Preview container — scale to fit image aspect ratio exactly
  const MAX_W = SCREEN_W - spacing[4] * 2;
  const imageAspect = imageSize.w / imageSize.h;
  let PREVIEW_W = MAX_W;
  let PREVIEW_H = MAX_W;
  if (imageAspect > 1) {
    PREVIEW_H = MAX_W / imageAspect;
  } else {
    PREVIEW_W = MAX_W * imageAspect;
  }

  // Convert normalized crop to px
  function toPx(c: CropRect) {
    return {
      left: c.x * PREVIEW_W,
      top: c.y * PREVIEW_H,
      width: c.w * PREVIEW_W,
      height: c.h * PREVIEW_H,
    };
  }

  function toNorm(left: number, top: number, width: number, height: number): CropRect {
    return {
      x: clamp(left / PREVIEW_W, 0, 1),
      y: clamp(top / PREVIEW_H, 0, 1),
      w: clamp(width / PREVIEW_W, 0.05, 1),
      h: clamp(height / PREVIEW_H, 0.05, 1),
    };
  }

  const applyAspect = useCallback((ratio: [number, number] | null) => {
    if (!ratio) return;
    const [rw, rh] = ratio;
    // Since the preview container is square, the aspect ratio maps directly
    // rw:rh in normalized space means w/h = rw/rh
    const targetAspect = rw / rh;
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;

    // Start from the larger dimension and fit the other
    let newW: number, newH: number;
    if (targetAspect >= 1) {
      // Landscape or square: constrain height
      newW = Math.min(1, crop.w);
      newH = newW / targetAspect;
      if (newH > 1) { newH = 1; newW = newH * targetAspect; }
    } else {
      // Portrait: constrain width
      newH = Math.min(1, crop.h);
      newW = newH * targetAspect;
      if (newW > 1) { newW = 1; newH = newW / targetAspect; }
    }

    const newX = clamp(cx - newW / 2, 0, 1 - newW);
    const newY = clamp(cy - newH / 2, 0, 1 - newH);
    const next = { x: newX, y: newY, w: Math.max(0.05, newW), h: Math.max(0.05, newH) };
    setCrop(next);
    cropRef.current = next;
  }, [crop]);

  function handlePresetPress(idx: number) {
    setSelectedPreset(idx);
    selectedPresetRef.current = idx;
    const preset = ASPECT_PRESETS[idx];
    if (preset.ratio) applyAspect(preset.ratio);
  }

  // Pan responders for the 4 corner handles + body drag
  const dragStart = useRef({ x: 0, y: 0, cropSnapshot: crop });

  // Corner handles: tl, tr, bl, br + edge handles
  type Handle = 'tl' | 'tr' | 'bl' | 'br' | 'move';

  function makeHandlePan(handle: Handle) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStart.current = { x: 0, y: 0, cropSnapshot: { ...cropRef.current } };
      },
      onPanResponderMove: (_, gs) => {
        const snap = dragStart.current.cropSnapshot;
        const dx = gs.dx / PREVIEW_W;
        const dy = gs.dy / PREVIEW_H;
        let { x, y, w, h } = snap;
        const minSize = 0.1;
        const lockedAspect = ASPECT_PRESETS[selectedPresetRef.current].ratio;

        if (handle === 'move') {
          x = clamp(snap.x + dx, 0, 1 - snap.w);
          y = clamp(snap.y + dy, 0, 1 - snap.h);
        } else if (handle === 'tl') {
          const newX = clamp(snap.x + dx, 0, snap.x + snap.w - minSize);
          const newY = clamp(snap.y + dy, 0, snap.y + snap.h - minSize);
          w = snap.w - (newX - snap.x);
          h = snap.h - (newY - snap.y);
          if (lockedAspect) {
            const [rw, rh] = lockedAspect;
            h = w / (rw / rh);
          }
          x = newX; y = newY;
        } else if (handle === 'tr') {
          const newW = clamp(snap.w + dx, minSize, 1 - snap.x);
          const newY = clamp(snap.y + dy, 0, snap.y + snap.h - minSize);
          h = snap.h - (newY - snap.y);
          if (lockedAspect) {
            const [rw, rh] = lockedAspect;
            h = newW / (rw / rh);
          }
          w = newW; y = newY;
        } else if (handle === 'bl') {
          const newX = clamp(snap.x + dx, 0, snap.x + snap.w - minSize);
          const newH = clamp(snap.h + dy, minSize, 1 - snap.y);
          w = snap.w - (newX - snap.x);
          if (lockedAspect) {
            const [rw, rh] = lockedAspect;
            w = newH * (rw / rh);
          }
          x = newX; h = newH;
        } else if (handle === 'br') {
          const newW = clamp(snap.w + dx, minSize, 1 - snap.x);
          const newH = clamp(snap.h + dy, minSize, 1 - snap.y);
          if (lockedAspect) {
            const [rw, rh] = lockedAspect;
            const aspect = rw / rh;
            w = Math.min(newW, newH * aspect);
            h = w / aspect;
          } else {
            w = newW; h = newH;
          }
        }
        // Clamp to preview bounds
        w = clamp(w, minSize, 1 - x);
        h = clamp(h, minSize, 1 - y);
        const next = { x, y, w, h };
        setCrop(next);
        cropRef.current = next;
      },
    });
  }

  const panMove = useRef(makeHandlePan('move')).current;
  const panTL = useRef(makeHandlePan('tl')).current;
  const panTR = useRef(makeHandlePan('tr')).current;
  const panBL = useRef(makeHandlePan('bl')).current;
  const panBR = useRef(makeHandlePan('br')).current;

  async function handleApply() {
    if (!clip) { router.back(); return; }
    await updateClip(clip.id, {
      cropX: cropRef.current.x,
      cropY: cropRef.current.y,
      cropW: cropRef.current.w,
      cropH: cropRef.current.h,
    }, 'crop');
    router.back();
  }

  async function handleReset() {
    const next = { x: 0, y: 0, w: 1, h: 1 };
    setCrop(next);
    cropRef.current = next;
    setSelectedPreset(0);
    selectedPresetRef.current = 0;
  }

  const px = toPx(crop);

  // Show actual crop ratio based on normalized values (w:h, simplified)
  const cropRatioDisplay = (() => {
    const selectedPresetRatio = ASPECT_PRESETS[selectedPreset]?.ratio;
    if (selectedPresetRatio) return ASPECT_PRESETS[selectedPreset].label;
    const w = Math.round(crop.w * 100);
    const h = Math.round(crop.h * 100);
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const g = gcd(w, h);
    if (!g || g === 0) return 'Free';
    return `${Math.round(w/g)}:${Math.round(h/g)}`;
  })();

  if (!clip) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted }}>Select a clip first</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.accent }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? 0 : spacing[2] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crop · {cropRatioDisplay}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleReset} style={styles.headerBtn} activeOpacity={0.7}>
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleApply} style={[styles.headerBtn, styles.applyBtn]} activeOpacity={0.7}>
            <HugeiconsIcon icon={Tick01Icon} size={18} color={colors.accentText} />
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Preview with crop overlay */}
      <View style={[styles.previewContainer, { width: PREVIEW_W, height: PREVIEW_H }]}>
        {clip?.uri ? (
          <Image
            source={{ uri: clip.uri }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.previewPlaceholder} />
        )}

        {/* Dimmed outside crop area */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {/* top */}
          <View style={[styles.dimOverlay, { top: 0, left: 0, right: 0, height: px.top }]} />
          {/* bottom */}
          <View style={[styles.dimOverlay, { bottom: 0, left: 0, right: 0, height: PREVIEW_H - px.top - px.height }]} />
          {/* left */}
          <View style={[styles.dimOverlay, { top: px.top, left: 0, width: px.left, height: px.height }]} />
          {/* right */}
          <View style={[styles.dimOverlay, { top: px.top, right: 0, width: PREVIEW_W - px.left - px.width, height: px.height }]} />
        </View>

        {/* Crop rect border + drag body */}
        <View
          {...panMove.panHandlers}
          style={[styles.cropRect, {
            left: px.left,
            top: px.top,
            width: px.width,
            height: px.height,
          }]}
        >
          {/* Rule-of-thirds grid */}
          <View style={styles.gridLine1H} pointerEvents="none" />
          <View style={styles.gridLine2H} pointerEvents="none" />
          <View style={styles.gridLine1V} pointerEvents="none" />
          <View style={styles.gridLine2V} pointerEvents="none" />
        </View>

        {/* Corner handles */}
        <View {...panTL.panHandlers} style={[styles.handle, styles.handleTL, { left: px.left - 8, top: px.top - 8 }]} />
        <View {...panTR.panHandlers} style={[styles.handle, styles.handleTR, { left: px.left + px.width - 8, top: px.top - 8 }]} />
        <View {...panBL.panHandlers} style={[styles.handle, styles.handleBL, { left: px.left - 8, top: px.top + px.height - 8 }]} />
        <View {...panBR.panHandlers} style={[styles.handle, styles.handleBR, { left: px.left + px.width - 8, top: px.top + px.height - 8 }]} />
      </View>

      {/* Aspect ratio presets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.presetsScroll}
        contentContainerStyle={styles.presetsContent}
      >
        {ASPECT_PRESETS.map((p, idx) => (
          <TouchableOpacity
            key={p.label}
            style={[styles.presetChip, selectedPreset === idx && styles.presetChipActive]}
            onPress={() => handlePresetPress(idx)}
            activeOpacity={0.7}
          >
            <Text style={[styles.presetLabel, selectedPreset === idx && styles.presetLabelActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Current crop info */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          {`X: ${(crop.x * 100).toFixed(0)}%  Y: ${(crop.y * 100).toFixed(0)}%  W: ${(crop.w * 100).toFixed(0)}%  H: ${(crop.h * 100).toFixed(0)}%`}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const HANDLE_SIZE = 16;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    padding: spacing[2],
    borderRadius: radius.md,
  },
  headerTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.md,
  },
  applyText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.accentText,
  },
  previewContainer: {
    alignSelf: 'center',
    marginTop: spacing[4],
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { flex: 1, backgroundColor: colors.surface1 },
  dimOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cropRect: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    overflow: 'hidden',
  },
  gridLine1H: {
    position: 'absolute',
    top: '33.3%',
    left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  gridLine2H: {
    position: 'absolute',
    top: '66.6%',
    left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  gridLine1V: {
    position: 'absolute',
    left: '33.3%',
    top: 0, bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  gridLine2V: {
    position: 'absolute',
    left: '66.6%',
    top: 0, bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    backgroundColor: colors.textPrimary,
    borderRadius: 2,
  },
  handleTL: { borderTopLeftRadius: 4 },
  handleTR: { borderTopRightRadius: 4 },
  handleBL: { borderBottomLeftRadius: 4 },
  handleBR: { borderBottomRightRadius: 4 },
  presetsScroll: { marginTop: spacing[4] },
  presetsContent: {
    paddingHorizontal: spacing[3],
    gap: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
  },
  presetChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface1,
  },
  presetChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  presetLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: typography.medium,
  },
  presetLabelActive: {
    color: colors.accentText,
    fontWeight: typography.semibold,
  },
  infoBar: {
    alignItems: 'center',
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  infoText: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
});
