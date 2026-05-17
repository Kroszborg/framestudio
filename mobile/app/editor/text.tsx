import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, ClosedCaptionIcon, Upload01Icon } from '@hugeicons/core-free-icons';
import { colors, typography, spacing, radius } from '../../lib/theme';
import { useProjectStore } from '../../lib/projectStore';
import { TextOverlay, TextAnimation } from '../../lib/database';

const FONTS = [
  { id: 'System', label: 'System' },
  { id: 'monospace', label: 'Mono' },
  { id: 'serif', label: 'Serif' },
  { id: 'sans-serif', label: 'Sans' },
  { id: 'Georgia', label: 'Georgia' },
  { id: 'Courier New', label: 'Courier' },
  { id: 'Arial Black', label: 'Black' },
  { id: 'Times New Roman', label: 'Times' },
  // Extended font set using system fonts available on Android
  { id: 'sans-serif-condensed', label: 'Condensed' },
  { id: 'sans-serif-light', label: 'Light' },
  { id: 'sans-serif-thin', label: 'Thin' },
  { id: 'sans-serif-medium', label: 'Medium' },
  { id: 'serif-monospace', label: 'Serif Mono' },
  { id: 'casual', label: 'Casual' },
  { id: 'cursive', label: 'Cursive' },
  { id: 'monospace', label: 'Code' },
];

const ANIMATIONS: { id: TextAnimation; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'fade_in', label: 'Fade In' },
  { id: 'fade_out', label: 'Fade Out' },
  { id: 'slide_up', label: 'Slide Up' },
  { id: 'slide_down', label: 'Slide Down' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'scale_in', label: 'Scale In' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'zoom_out', label: 'Zoom Out' },
  { id: 'blur_in', label: 'Blur In' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'shake', label: 'Shake' },
  { id: 'roll_left', label: 'Roll Left' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'wave', label: 'Wave' },
  { id: 'flicker', label: 'Flicker' },
  { id: 'neon_glow', label: 'Neon Glow' },
  { id: 'split_reveal', label: 'Split' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'rise', label: 'Rise' },
];

export default function TextScreen() {
  const router = useRouter();
  const { overlayId } = useLocalSearchParams<{ overlayId?: string }>();
  const { projectId, currentTime, textOverlays, addTextOverlay, updateTextOverlay } = useProjectStore();
  const isEditing = !!overlayId;

  const [text, setText] = useState('');
  const [size, setSize] = useState(24);
  const [color, setColor] = useState('#FFFFFF');
  const [fontFamily, setFontFamily] = useState('System');
  const [animation, setAnimation] = useState<TextAnimation>('none');
  const [animationIn, setAnimationIn] = useState<string>('fade');
  const [animationOut, setAnimationOut] = useState<string>('fade');
  const [animationInDuration, setAnimationInDuration] = useState(400);
  const [animationOutDuration, setAnimationOutDuration] = useState(400);
  const [posX, setPosX] = useState(0.5);
  const [posY, setPosY] = useState(0.5);
  const [shadow, setShadow] = useState(true);
  const [outline, setOutline] = useState(false);
  const [duration, setDuration] = useState(2000);
  const [saving, setSaving] = useState(false);

  // Pre-load existing overlay when editing — depends on both overlayId AND textOverlays
  // (textOverlays may load async after mount, so we need it in deps to retry)
  useEffect(() => {
    if (!overlayId || textOverlays.length === 0) return;
    const existing = textOverlays.find(t => t.id === overlayId);
    if (!existing) return;
    setText(existing.content);
    setSize(existing.fontSize);
    setColor(existing.color);
    setFontFamily(existing.fontFamily);
    setAnimation(existing.animation ?? 'none');
    setAnimationIn((existing as any).animationIn ?? 'fade');
    setAnimationOut((existing as any).animationOut ?? 'fade');
    setAnimationInDuration((existing as any).animationInDuration ?? 400);
    setAnimationOutDuration((existing as any).animationOutDuration ?? 400);
    setPosX(existing.positionX);
    setPosY(existing.positionY);
    setShadow(existing.shadow);
    setOutline(existing.outline);
    setDuration(existing.duration);
  }, [overlayId, textOverlays]);

  const COLORS = ['#FFFFFF', '#000000', '#9A9A9A', '#EF4444', '#22C55E', '#3B82F6', '#F59E0B', '#A855F7'];
  const DURATIONS = [1000, 2000, 3000, 5000, 10000];

  async function handleAdd() {
    if (!text.trim() || !projectId) return;
    setSaving(true);
    try {
      if (isEditing && overlayId) {
        // Update existing overlay
        await updateTextOverlay(overlayId, {
          content: text.trim(),
          positionX: posX,
          positionY: posY,
          duration,
          fontSize: size,
          color,
          fontFamily,
          shadow,
          outline,
          outlineColor: '#000000',
          animation,
          animationIn,
          animationOut,
          animationInDuration,
          animationOutDuration,
        } as any);
      } else {
        // Create new overlay
        const overlay: TextOverlay = {
          id: `txt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          projectId,
          content: text.trim(),
          positionX: posX,
          positionY: posY,
          startTime: currentTime,
          duration,
          fontSize: size,
          color,
          fontFamily,
          shadow,
          outline,
          outlineColor: '#000000',
          animation,
          animationIn,
          animationOut,
          animationInDuration,
          animationOutDuration,
        } as any;
        await addTextOverlay(overlay);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save text');
      setSaving(false);
    }
  }

  /** Parse .srt or .vtt subtitle file and add as multiple text overlays */
  async function handleImportSubtitles() {
    if (!projectId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'application/x-subrip'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      let content: string;
      try {
        content = await (FileSystem as any).readAsStringAsync(asset.uri);
      } catch {
        Alert.alert('Error', 'Could not read subtitle file');
        return;
      }

      const isVTT = asset.name?.endsWith('.vtt') || content.startsWith('WEBVTT');
      const subtitles = isVTT ? parseVTT(content) : parseSRT(content);

      if (subtitles.length === 0) {
        Alert.alert('No subtitles found', 'Could not parse any subtitle entries');
        return;
      }

      setSaving(true);
      for (const sub of subtitles) {
        const overlay: TextOverlay = {
          id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          projectId,
          content: sub.text,
          positionX: 0.5,
          positionY: 0.85,
          startTime: sub.startMs,
          duration: sub.endMs - sub.startMs,
          fontSize: 18,
          color: '#FFFFFF',
          fontFamily: 'System',
          shadow: true,
          outline: true,
          outlineColor: '#000000',
          animation: 'none',
        };
        await addTextOverlay(overlay);
      }
      Alert.alert('Imported', `Added ${subtitles.length} subtitle${subtitles.length > 1 ? 's' : ''}`);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Import failed');
      setSaving(false);
    }
  }

  const fontStyle = fontFamily !== 'System' ? { fontFamily } : {};

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} activeOpacity={0.7}>
            <HugeiconsIcon icon={Cancel01Icon} size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{isEditing ? 'Edit text' : 'Add text'}</Text>
          <TouchableOpacity
            style={[styles.doneBtn, (!text.trim() || saving) && styles.doneBtnDisabled]}
            disabled={!text.trim() || saving}
            onPress={handleAdd}
            activeOpacity={0.8}
          >
            <Text style={styles.doneBtnText}>{saving ? '...' : isEditing ? 'Update' : 'Add'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.preview}>
          <Text
            style={[
              styles.previewText,
              fontStyle,
              {
                fontSize: size,
                color,
                textShadowColor: shadow ? 'rgba(0,0,0,0.8)' : 'transparent',
                textShadowOffset: shadow ? { width: 2, height: 2 } : { width: 0, height: 0 },
                textShadowRadius: shadow ? 3 : 0,
              },
            ]}
          >
            {text || 'Preview text'}
          </Text>
        </View>

        <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type your text..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={200}
            autoFocus
          />

          {/* Import subtitles */}
          <TouchableOpacity style={styles.importBtn} onPress={handleImportSubtitles} activeOpacity={0.7}>
            <HugeiconsIcon icon={ClosedCaptionIcon} size={16} color={colors.textSecondary} />
            <Text style={styles.importBtnText}>Import subtitles (.srt / .vtt)</Text>
            <HugeiconsIcon icon={Upload01Icon} size={14} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Font picker */}
          <View style={styles.section}>
            <Text style={styles.label}>Font</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontRow}>
              {FONTS.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.fontChip, fontFamily === f.id && styles.fontChipActive]}
                  onPress={() => setFontFamily(f.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.fontChipText,
                      fontFamily === f.id && styles.fontChipTextActive,
                      f.id !== 'System' && { fontFamily: f.id },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* In/Out Transitions */}
          <View style={styles.section}>
            <Text style={styles.label}>Entry Animation (In)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontRow}>
              {[
                { id: 'none', label: 'None' }, { id: 'fade', label: 'Fade' },
                { id: 'zoom_in', label: 'Zoom In' }, { id: 'slide_up', label: 'Slide Up' },
                { id: 'slide_left', label: 'Slide ←' }, { id: 'slide_right', label: 'Slide →' },
                { id: 'dissolve', label: 'Dissolve' }, { id: 'shake', label: 'Shake' },
                { id: 'roll', label: 'Roll In' }, { id: 'zoom_out', label: 'Zoom Out' },
              ].map(a => (
                <TouchableOpacity key={a.id} style={[styles.fontChip, animationIn === a.id && styles.fontChipActive]}
                  onPress={() => setAnimationIn(a.id)} activeOpacity={0.7}>
                  <Text style={[styles.fontChipText, animationIn === a.id && styles.fontChipTextActive]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Exit Animation (Out)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontRow}>
              {[
                { id: 'none', label: 'None' }, { id: 'fade', label: 'Fade' },
                { id: 'zoom_in', label: 'Zoom In' }, { id: 'slide_up', label: 'Slide Up' },
                { id: 'slide_left', label: 'Slide ←' }, { id: 'slide_right', label: 'Slide →' },
                { id: 'dissolve', label: 'Dissolve' }, { id: 'shake', label: 'Shake' },
                { id: 'roll', label: 'Roll Out' }, { id: 'zoom_out', label: 'Zoom Out' },
              ].map(a => (
                <TouchableOpacity key={a.id} style={[styles.fontChip, animationOut === a.id && styles.fontChipActive]}
                  onPress={() => setAnimationOut(a.id)} activeOpacity={0.7}>
                  <Text style={[styles.fontChipText, animationOut === a.id && styles.fontChipTextActive]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Legacy combined animation */}
          <View style={styles.section}>
            <Text style={styles.label}>Combined Effect (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontRow}>
              {ANIMATIONS.map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.fontChip, animation === a.id && styles.fontChipActive]}
                  onPress={() => setAnimation(a.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fontChipText, animation === a.id && styles.fontChipTextActive]}>
                    {a.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Size: {size}pt</Text>
            <View style={styles.sizeRow}>
              {[16, 20, 24, 32, 40, 56, 72].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sizeChip, size === s && styles.sizeChipActive]}
                  onPress={() => setSize(s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sizeChipText, size === s && styles.sizeChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchActive]}
                  onPress={() => setColor(c)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Duration</Text>
            <View style={styles.sizeRow}>
              {DURATIONS.map(d => (
                <TouchableOpacity
                  key={d}
                  style={[styles.sizeChip, duration === d && styles.sizeChipActive]}
                  onPress={() => setDuration(d)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sizeChipText, duration === d && styles.sizeChipTextActive]}>
                    {d / 1000}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Position</Text>
            <View style={styles.positionGrid}>
              {[
                { x: 0.1, y: 0.1, label: 'TL' },
                { x: 0.5, y: 0.1, label: 'TC' },
                { x: 0.9, y: 0.1, label: 'TR' },
                { x: 0.1, y: 0.5, label: 'ML' },
                { x: 0.5, y: 0.5, label: 'MC' },
                { x: 0.9, y: 0.5, label: 'MR' },
                { x: 0.1, y: 0.85, label: 'BL' },
                { x: 0.5, y: 0.85, label: 'BC' },
                { x: 0.9, y: 0.85, label: 'BR' },
              ].map(p => {
                const active = Math.abs(posX - p.x) < 0.05 && Math.abs(posY - p.y) < 0.05;
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.posBtn, active && styles.posBtnActive]}
                    onPress={() => { setPosX(p.x); setPosY(p.y); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.posBtnText, active && styles.posBtnTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Style</Text>
            <View style={styles.sizeRow}>
              <TouchableOpacity
                style={[styles.sizeChip, shadow && styles.sizeChipActive]}
                onPress={() => setShadow(!shadow)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sizeChipText, shadow && styles.sizeChipTextActive]}>Shadow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sizeChip, outline && styles.sizeChipActive]}
                onPress={() => setOutline(!outline)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sizeChipText, outline && styles.sizeChipTextActive]}>Outline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── SRT / VTT parsers ──

interface SubEntry {
  startMs: number;
  endMs: number;
  text: string;
}

function parseTimestamp(ts: string): number {
  // Formats: HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm
  const cleaned = ts.trim().replace(',', '.');
  const parts = cleaned.split(':');
  let h = 0, m = 0, s = 0;
  if (parts.length === 3) {
    h = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    s = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    m = parseInt(parts[0], 10);
    s = parseFloat(parts[1]);
  }
  return Math.round((h * 3600 + m * 60 + s) * 1000);
}

function parseSRT(content: string): SubEntry[] {
  const entries: SubEntry[] = [];
  const blocks = content.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const timeLine = lines[1];
    const match = timeLine.match(/(.+?)\s*-->\s*(.+)/);
    if (!match) continue;
    const startMs = parseTimestamp(match[1]);
    const endMs = parseTimestamp(match[2]);
    const text = lines.slice(2).join('\n').replace(/<[^>]+>/g, '').trim();
    if (text) entries.push({ startMs, endMs, text });
  }
  return entries;
}

function parseVTT(content: string): SubEntry[] {
  const entries: SubEntry[] = [];
  const lines = content.split('\n');
  let i = 0;
  // Skip header
  while (i < lines.length && !lines[i].includes('-->')) i++;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const match = line.match(/(.+?)\s*-->\s*(.+)/);
      if (match) {
        const startMs = parseTimestamp(match[1]);
        const endMs = parseTimestamp(match[2].split(/\s/)[0]);
        const textLines: string[] = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }
        const text = textLines.join('\n').replace(/<[^>]+>/g, '').trim();
        if (text) entries.push({ startMs, endMs, text });
      }
    }
    i++;
  }
  return entries;
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
  doneBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  doneBtnDisabled: { opacity: 0.4 },
  doneBtnText: { fontSize: typography.sm, fontWeight: typography.semibold, color: colors.bg },
  preview: {
    aspectRatio: 16 / 9, backgroundColor: colors.surface1,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: spacing[4], marginVertical: spacing[3],
    borderRadius: radius.md, overflow: 'hidden',
  },
  previewText: { fontWeight: typography.bold, textAlign: 'center', paddingHorizontal: 16 },
  controls: { flex: 1 },
  controlsContent: { padding: spacing[4], gap: spacing[4], paddingBottom: 80 },
  input: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing[3],
    fontSize: typography.md, color: colors.textPrimary,
    minHeight: 80, textAlignVertical: 'top',
  },
  // Import button
  importBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderRadius: radius.md, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border,
  },
  importBtnText: { flex: 1, fontSize: typography.sm, color: colors.textSecondary },
  section: { gap: spacing[2] },
  label: {
    fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  // Font picker
  fontRow: { gap: spacing[2], paddingRight: spacing[4] },
  fontChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border, minWidth: 64, alignItems: 'center',
  },
  fontChipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  fontChipText: { fontSize: typography.sm, color: colors.textSecondary },
  fontChipTextActive: { color: colors.accent, fontWeight: typography.semibold },
  // Sizes
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  sizeChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: radius.md, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border,
  },
  sizeChipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  sizeChipText: { fontSize: typography.sm, color: colors.textSecondary },
  sizeChipTextActive: { color: colors.accent, fontWeight: typography.semibold },
  colorRow: { flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' },
  colorSwatch: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: 'transparent',
  },
  colorSwatchActive: { borderColor: colors.accent },
  positionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  posBtn: {
    width: 44, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border,
  },
  posBtnActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  posBtnText: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.medium },
  posBtnTextActive: { color: colors.accent, fontWeight: typography.semibold },
});
