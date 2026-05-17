/**
 * Auto Edit screen — Remove silence, auto-captions, auto color grade.
 * Accessible from the Toolbar's "Auto" button.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, MagicWand01Icon, ClosedCaptionIcon, MixerIcon } from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { colors, typography, spacing, radius } from '../../lib/theme';
import { useToastStore } from '../../lib/toast';

export default function AutoEditScreen() {
  const router = useRouter();
  const { projectId } = useProjectStore();
  const { clips, addClip, removeClip, updateClip, textOverlays } = useProjectStore();
  const showToast = useToastStore(s => s.show);
  const [running, setRunning] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const videoClips = clips.filter(c => c.trackIndex === 0 && (c.type === 'video' || c.type === 'image'));
  const audioClips = clips.filter(c => c.trackIndex === 2 || c.type === 'audio');

  async function handleRemoveSilence() {
    if (videoClips.length === 0 && audioClips.length === 0) {
      Alert.alert('No clips', 'Add some video or audio clips first.');
      return;
    }
    setRunning('silence');
    try {
      const { detectSilence, buildAutoEditClips } = require('../../lib/autoEdit');
      let processed = 0;
      for (const clip of [...videoClips, ...audioClips]) {
        const clipDuration = clip.duration - clip.trimStart - clip.trimEnd;
        const result = await detectSilence(clip.uri, clipDuration);
        if (result.silentDurationMs > 500 && result.audioSegments.length > 1) {
          setPreview(`Found ${result.silentSegments.length} silent sections (${(result.silentDurationMs / 1000).toFixed(1)}s) in "${clip.name}". Removing...`);
          // Build new clips from audio segments
          const newClips = buildAutoEditClips(clip, result.audioSegments);
          // Remove original, add segmented clips
          await removeClip(clip.id);
          for (const nc of newClips) {
            await addClip(nc);
          }
          processed++;
        }
      }
      if (processed === 0) {
        showToast('No significant silence found to remove', 'info', 2000);
      } else {
        showToast(`Removed silence from ${processed} clip(s)`, 'success', 2000);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not process clips');
    } finally {
      setRunning(null);
      setPreview(null);
    }
  }

  async function handleAutoColorGrade() {
    if (clips.length === 0) { Alert.alert('No clips', 'Add clips first.'); return; }
    setRunning('color');
    try {
      const { autoAdjustClip } = require('../../lib/autoAdjust');
      for (const clip of clips.filter(c => c.trackIndex === 0)) {
        const adjustments = await autoAdjustClip(clip.uri);
        await updateClip(clip.id, { ...adjustments }, 'auto adjust');
      }
      showToast('Auto color grade applied to all clips', 'success', 2000);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not auto color grade');
    } finally {
      setRunning(null);
    }
  }

  async function handleAddCaptions() {
    const targetClips = [...videoClips, ...audioClips];
    if (targetClips.length === 0) {
      Alert.alert('No clips', 'Add video or audio clips first.');
      return;
    }
    setRunning('captions');
    try {
      const { detectSilence } = require('../../lib/autoEdit');
      const { addTextOverlay } = useProjectStore.getState();
      let totalAdded = 0;

      for (const clip of targetClips) {
        const clipDuration = clip.duration - clip.trimStart - clip.trimEnd;
        const result = await detectSilence(clip.uri, clipDuration, 0.05, 300);

        // Speech segments = non-silent parts → each becomes a caption placeholder
        if (result.audioSegments.length > 0) {
          for (let i = 0; i < result.audioSegments.length; i++) {
            const seg = result.audioSegments[i];
            const segDuration = seg.endMs - seg.startMs;
            if (segDuration < 200) continue; // skip very short segments

            const overlayStartTime = clip.startTime + seg.startMs;
            await addTextOverlay({
              id: `cap_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
              projectId: clip.projectId,
              content: `Caption ${totalAdded + 1}`,
              positionX: 0.5,
              positionY: 0.82,
              startTime: overlayStartTime,
              duration: Math.min(segDuration, 4000),
              fontSize: 22,
              color: '#FFFFFF',
              fontFamily: 'System',
              shadow: true,
              outline: true,
              outlineColor: '#000000',
              backgroundColor: 'rgba(0,0,0,0.5)',
              animation: 'fade_in',
            });
            totalAdded++;
          }
        }
      }

      if (totalAdded === 0) {
        showToast('Could not detect speech segments', 'info', 2000);
      } else {
        showToast(`Added ${totalAdded} caption placeholder(s) — tap each to edit text`, 'success', 3000);
      }
    } catch (e: any) {
      // Fallback: offer to import SRT manually
      Alert.alert(
        'Auto-caption incomplete',
        'Could not detect speech. Would you like to import an .srt or .vtt subtitle file instead?',
        [
          { text: 'Import SRT', onPress: () => router.push('/editor/text' as any) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setRunning(null);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Auto Edit</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionLabel}>AI TOOLS</Text>

        <AutoOption
          icon={MagicWand01Icon}
          title="Remove Silence"
          description="Detects and removes silent parts from your clips. Keeps only the parts where audio is present."
          loading={running === 'silence'}
          onPress={handleRemoveSilence}
        />

        <AutoOption
          icon={ClosedCaptionIcon}
          title="Add Captions"
          description="Import an .srt or .vtt subtitle file to add timed captions with animations."
          loading={false}
          onPress={handleAddCaptions}
        />

        <AutoOption
          icon={MixerIcon}
          title="Auto Color Grade"
          description="Automatically analyzes and color corrects all your clips with optimal brightness, contrast, and exposure."
          loading={running === 'color'}
          onPress={handleAutoColorGrade}
        />

        {preview && (
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>{preview}</Text>
          </View>
        )}

        <Text style={styles.note}>
          Auto features process your clips locally on device. Results can be fine-tuned in the editor after applying.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function AutoOption({ icon, title, description, loading, onPress }: {
  icon: any; title: string; description: string; loading: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.option} onPress={onPress} disabled={loading} activeOpacity={0.8}>
      <View style={styles.optionIcon}>
        {loading ? <ActivityIndicator color={colors.accent} /> : <HugeiconsIcon icon={icon} size={22} color={colors.accent} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDesc}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface1, borderRadius: radius.full },
  title: { fontSize: typography.lg, fontWeight: typography.semibold, color: colors.textPrimary },
  body: { padding: spacing[4], gap: spacing[3] },
  sectionLabel: { fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.surface1, borderRadius: radius.lg,
    padding: spacing[4], borderWidth: 1, borderColor: colors.border,
  },
  optionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textPrimary, marginBottom: 3 },
  optionDesc: { fontSize: typography.sm, color: colors.textMuted, lineHeight: 18 },
  previewBox: { backgroundColor: colors.accentMuted, borderRadius: radius.md, padding: spacing[3], borderWidth: 1, borderColor: colors.accent },
  previewText: { fontSize: typography.sm, color: colors.accent },
  note: { fontSize: typography.xs, color: colors.textMuted, lineHeight: 18, textAlign: 'center', marginTop: spacing[2] },
});
