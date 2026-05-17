import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Alert, ScrollView, Share, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon, ServerStack01Icon, InformationCircleIcon,
  MusicNote01Icon, Image01Icon, Film01Icon,
  Tick01Icon, Cancel01Icon, Share01Icon,
} from '@hugeicons/core-free-icons';

import { getProject, getClips, Project } from '../../lib/database';
import { exportProject, estimateFileSize, ExportQuality, ExportFormat, getResolutionLabel } from '../../lib/exportEngine';

function checkNativeProcessorAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const { NativeModulesProxy } = require('expo-modules-core');
    if (NativeModulesProxy?.ExpoVideoProcessor) return true;
  } catch {}
  try {
    const { NativeModules } = require('react-native');
    if (NativeModules?.ExpoVideoProcessor) return true;
  } catch {}
  return false;
}
import { colors, typography, spacing, radius } from '../../lib/theme';

type Step = 'options' | 'exporting' | 'done' | 'error';

const VIDEO_FORMATS: { label: string; value: ExportFormat; desc: string }[] = [
  { label: 'MP4', value: 'mp4', desc: 'Universal, best compatibility' },
  { label: 'MOV', value: 'mov', desc: 'Apple ecosystem' },
];

const AUDIO_FORMATS: { label: string; value: ExportFormat; desc: string }[] = [
  { label: 'MP3', value: 'mp3', desc: 'Universal audio' },
  { label: 'WAV', value: 'wav', desc: 'Lossless, large file' },
  { label: 'AAC', value: 'aac', desc: 'Modern, smaller size' },
];

const PHOTO_FORMATS: { label: string; value: ExportFormat; desc: string }[] = [
  { label: 'PNG', value: 'png', desc: 'Lossless, transparency' },
  { label: 'JPEG', value: 'jpg', desc: 'Smaller file size' },
  { label: 'WebP', value: 'webp', desc: 'Modern, best ratio' },
];

const RESOLUTIONS = [
  { label: '4K', value: '4K', pixels: '3840\u00D72160' },
  { label: '2K', value: '2K', pixels: '2560\u00D71440' },
  { label: '1080p', value: '1080p', pixels: '1920\u00D71080' },
  { label: '720p', value: '720p', pixels: '1280\u00D7720' },
  { label: '480p', value: '480p', pixels: '854\u00D7480' },
];

const BITRATE_PRESETS = [
  { label: 'High', value: 'high', desc: 'Best quality, larger file' },
  { label: 'Medium', value: 'medium', desc: 'Balanced quality & size' },
  { label: 'Low', value: 'low', desc: 'Smallest file, lower quality' },
];

function getFormatsForType(type: string) {
  switch (type) {
    case 'audio': return AUDIO_FORMATS;
    case 'photo': return PHOTO_FORMATS;
    default: return VIDEO_FORMATS;
  }
}

function getDefaultFormat(type: string): ExportFormat {
  switch (type) {
    case 'audio': return 'mp3';
    case 'photo': return 'png';
    default: return 'mp4';
  }
}

function getExportIcon(type: string) {
  switch (type) {
    case 'audio': return MusicNote01Icon;
    case 'photo': return Image01Icon;
    default: return Film01Icon;
  }
}

export default function ExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('options');
  const [quality, setQuality] = useState<ExportQuality>('high');
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [resolution, setResolution] = useState('1080p');
  // customBitrate removed — quality preset (high/medium/low) controls bitrate
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [project, setProject] = useState<Project | null>(null);
  const [exportedUri, setExportedUri] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadProject(); }, [id]);
  useEffect(() => { loadEstimate(); }, [quality, project, resolution]);

  async function loadProject() {
    if (!id) return;
    const proj = await getProject(id);
    setProject(proj);
    if (proj) {
      setFormat(getDefaultFormat(proj.type || 'video'));
      setResolution(proj.resolution || '1080p');
    }
  }

  async function loadEstimate() {
    if (!id || !project) return;
    try {
      const clips = await getClips(id);
      const est = estimateFileSize(clips, quality, resolution as Project['resolution'], project.type || 'video');
      setFileSize(est);
    } catch {}
  }

  async function handleExport() {
    if (!id) return;
    setStep('exporting');
    setProgress(0);
    try {
      const [proj, clips] = await Promise.all([getProject(id), getClips(id)]);
      if (!proj) { setErrorMsg('Project not found'); setStep('error'); return; }
      const result = await exportProject({
        project: { ...proj, resolution: resolution as Project['resolution'] },
        clips,
        quality,
        format,
        onProgress: (p, label) => {
          setProgress(p);
          setProgressLabel(label);
          Animated.timing(progressAnim, { toValue: p, duration: 150, useNativeDriver: false }).start();
        },
      });
      if (result.success) {
        setExportedUri(result.uri || null);
        setStep('done');
      } else {
        setErrorMsg(result.error || 'Export failed');
        setStep('error');
      }
    } catch (e: any) {
      const msg = e?.message || e?.toString() || 'Unexpected error during export';
      setErrorMsg(msg.length > 200 ? msg.slice(0, 200) + '...' : msg);
      setStep('error');
    }
  }

  /** Save file to a user-chosen location via system file picker (Android SAF) */
  async function handleDownload() {
    if (!exportedUri || downloading) return;
    setDownloading(true);
    try {
      if (Platform.OS === 'android') {
        const FileSystemModule = require('expo-file-system/legacy');
        const SAF = FileSystemModule.StorageAccessFramework;
        if (SAF) {
          try {
            const perms = await SAF.requestDirectoryPermissionsAsync();
            if (perms.granted) {
              const ext = exportedUri.split('.').pop()?.toLowerCase() || 'mp4';
              const mimeTypes: Record<string, string> = {
                mp4: 'video/mp4', mov: 'video/quicktime',
                mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
                png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp',
              };
              const mime = mimeTypes[ext] || 'application/octet-stream';
              const safeName = `FrameStudio_${project?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'export'}_${Date.now()}.${ext}`;
              const destUri = await SAF.createFileAsync(perms.directoryUri, safeName, mime);
              // SAF content:// URIs require base64 read/write — copyAsync doesn't support them
              // Use base64 for SAF content:// destinations
              const base64Content = await FileSystemModule.readAsStringAsync(exportedUri, { encoding: 'base64' });
              await SAF.writeAsStringAsync(destUri, base64Content, { encoding: 'base64' });
              Alert.alert('Saved ✓', 'Saved to your chosen folder.');
              return;
            }
            // User cancelled folder picker — fall through to Share
          } catch {
            // SAF failed — fall through to Share sheet
          }
        }
      }

      // Share sheet: user can tap "Save to Downloads", "Save to Files", etc.
      try {
        const Sharing = require('expo-sharing');
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(exportedUri, {
            mimeType: project?.type === 'audio' ? 'audio/*' : project?.type === 'photo' ? 'image/*' : 'video/*',
            dialogTitle: 'Save / Share your export',
          });
          return;
        }
      } catch {}
      Alert.alert(
        'Download',
        'Your file is already saved to the gallery. Use the Share button above to send it anywhere.',
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      Alert.alert('Download failed', e?.message || 'Could not save file');
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare() {
    if (!exportedUri) {
      Alert.alert('Nothing to share', 'Export your project first.');
      return;
    }
    try {
      const Sharing = require('expo-sharing');

      // Derive exact MIME type from the file extension for best compatibility
      const ext = exportedUri.split('.').pop()?.toLowerCase() || '';
      const mimeMap: Record<string, string> = {
        mp4: 'video/mp4', mov: 'video/quicktime',
        mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
      };
      const mimeType = mimeMap[ext] ||
        (project?.type === 'audio' ? 'audio/mpeg' :
         project?.type === 'photo' ? 'image/jpeg' : 'video/mp4');

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(exportedUri, {
          mimeType,
          dialogTitle: `Share ${project?.name || 'FrameStudio export'}`,
          UTI: mimeType, // iOS UTI hint
        });
        return;
      }

      // Expo sharing not available — try React Native Share with URL
      const canUseRN = Platform.OS === 'ios'; // RN Share.share url only works on iOS
      if (canUseRN) {
        await Share.share({ url: exportedUri, title: project?.name || 'FrameStudio export' });
        return;
      }

      Alert.alert(
        'Sharing not available',
        'Your file is saved in the gallery and in the FrameStudio exports folder on this device.'
      );
    } catch (e: any) {
      Alert.alert('Share failed', e?.message || 'Could not open share sheet');
    }
  }

  const projectType = project?.type || 'video';
  const formats = getFormatsForType(projectType);
  const ExportIcon = getExportIcon(projectType);
  const showResolution = projectType === 'video' || projectType === 'photo';

  const progressW = progressAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Export</Text>
        <View style={{ width: 36 }} />
      </View>

      {step === 'options' && (
        <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 100 }]}>
          {/* Resolution (video/photo) */}
          {showResolution && (
            <View style={styles.section}>
              <Text style={styles.label}>Resolution</Text>
              <View style={styles.optionRow}>
                {RESOLUTIONS.map(r => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.resBtn, resolution === r.value && styles.resBtnActive]}
                    onPress={() => setResolution(r.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.resBtnLabel, resolution === r.value && styles.resBtnLabelActive]}>
                      {r.label}
                    </Text>
                    <Text style={[styles.resBtnSub, resolution === r.value && styles.resBtnSubActive]}>
                      {r.pixels}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Quality / Bitrate */}
          <View style={styles.section}>
            <Text style={styles.label}>Quality</Text>
            <View style={styles.qualityRow}>
              {BITRATE_PRESETS.map(b => (
                <TouchableOpacity
                  key={b.value}
                  style={[styles.qualityCard, quality === b.value && styles.qualityCardActive]}
                  onPress={() => setQuality(b.value as ExportQuality)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.qualityLabel, quality === b.value && styles.qualityLabelActive]}>
                    {b.label}
                  </Text>
                  <Text style={[styles.qualityDesc, quality === b.value && styles.qualityDescActive]}>
                    {b.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Format */}
          <View style={styles.section}>
            <Text style={styles.label}>Format</Text>
            <View style={styles.formatRow}>
              {formats.map(f => (
                <TouchableOpacity
                  key={f.value}
                  style={[styles.formatCard, format === f.value && styles.formatCardActive]}
                  onPress={() => setFormat(f.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.formatLabel, format === f.value && styles.formatLabelActive]}>
                    .{f.label}
                  </Text>
                  <Text style={[styles.formatDesc, format === f.value && styles.formatDescActive]}>
                    {f.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Estimate */}
          {fileSize ? (
            <View style={styles.estimateBox}>
              <HugeiconsIcon icon={ServerStack01Icon} size={16} color={colors.textMuted} />
              <View>
                <Text style={styles.estimateText}>Estimated size: {fileSize}</Text>
                {showResolution && (
                  <Text style={styles.estimateSub}>
                    {getResolutionLabel(resolution as Project['resolution'])} \u00B7 {quality} quality \u00B7 .{format}
                  </Text>
                )}
              </View>
            </View>
          ) : null}

          {/* Warning: video effects not baked in when native processor is missing */}
          {projectType === 'video' && !checkNativeProcessorAvailable() && (
            <View style={[styles.noteBox, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: '#EF4444' }]}>
              <HugeiconsIcon icon={InformationCircleIcon} size={15} color="#EF4444" />
              <Text style={[styles.noteText, { color: '#EF4444' }]}>
                Native video processor not linked — clips will export as source files without effects, color grade, transitions, or text overlays applied. Run: cd packages/mobile {'&&'} npm install ffmpeg-kit-react-native@min then rebuild the APK to enable full processing.
              </Text>
            </View>
          )}
          <View style={styles.noteBox}>
            <HugeiconsIcon icon={InformationCircleIcon} size={15} color={colors.accent} />
            <Text style={styles.noteText}>
              {projectType === 'video' && (checkNativeProcessorAvailable()
                ? 'Video exported with effects, color grade, transitions and text overlays applied.'
                : 'Video saved to gallery. Source clips exported with trim points as metadata.')}
              {projectType === 'audio' && `Audio saved as .${format} to device storage. Tap Share on the next screen to open it in your Files app.`}
              {projectType === 'photo' && `Photo exported with all edits applied — crop, color grade, filters, text and sticker overlays included.`}
            </Text>
          </View>
        </ScrollView>
      )}

      {step === 'options' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[4] }]}>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.8}>
            <HugeiconsIcon icon={ExportIcon} size={18} color={colors.bg} />
            <Text style={styles.exportBtnText}>Export {projectType}</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'exporting' && (
        <View style={styles.centerBody}>
          <HugeiconsIcon icon={ExportIcon} size={48} color={colors.accent} />
          <Text style={styles.progressTitle}>Exporting\u2026</Text>
          <Text style={styles.progressLabel}>{progressLabel}</Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressW }]} />
          </View>
          <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
        </View>
      )}

      {step === 'done' && (
        <View style={styles.centerBody}>
          <View style={styles.doneIcon}>
            <HugeiconsIcon icon={Tick01Icon} size={40} color={colors.bg} />
          </View>
          <Text style={styles.doneTitle}>Export complete</Text>
          <Text style={styles.doneSub}>
            {projectType === 'audio'
              ? 'Audio saved to device storage. Use Download to pick where to save it, or Share to send it.'
              : projectType === 'photo'
              ? 'Photo processed and saved to gallery (FrameStudio album). Tap Download to also save it to a custom location.'
              : 'Video saved to gallery (FrameStudio album). Tap Download to save to a folder of your choice.'}
          </Text>

          {/* Primary: Download to chosen folder */}
          <TouchableOpacity
            style={[styles.downloadBtn, downloading && { opacity: 0.6 }]}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.8}
          >
            <Text style={styles.downloadBtnText}>{downloading ? 'Saving…' : 'Download / Save to folder'}</Text>
          </TouchableOpacity>

          <View style={styles.doneActions}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
              <HugeiconsIcon icon={Share01Icon} size={16} color={colors.textPrimary} />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>Back to editor</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'error' && (
        <View style={styles.centerBody}>
          <View style={[styles.doneIcon, { backgroundColor: colors.error }]}>
            <HugeiconsIcon icon={Cancel01Icon} size={40} color="#fff" />
          </View>
          <Text style={styles.doneTitle}>Export failed</Text>
          <Text style={styles.doneSub}>{errorMsg}</Text>

          {/* If error is permissions-related, offer to open Settings */}
          {(errorMsg?.toLowerCase().includes('permission') || errorMsg?.toLowerCase().includes('denied')) && (
            <TouchableOpacity
              style={[styles.downloadBtn, { marginTop: spacing[3] }]}
              onPress={() => {
                try { require('expo-linking').openSettings(); } catch {}
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.downloadBtnText}>Open device Settings to grant permissions</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.surface2, marginTop: spacing[4] }]}
            onPress={() => setStep('options')}
            activeOpacity={0.8}
          >
            <Text style={[styles.doneBtnText, { color: colors.textPrimary }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface1, borderRadius: radius.full,
  },
  navTitle: { fontSize: typography.lg, fontWeight: typography.semibold, color: colors.textPrimary },
  body: { flex: 1 },
  bodyContent: { padding: spacing[4], gap: spacing[5] },
  centerBody: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing[4], padding: spacing[4],
  },
  section: { gap: spacing[2] + 2 },
  label: {
    fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  // Resolution picker
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  resBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  resBtnActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  resBtnLabel: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textSecondary },
  resBtnLabelActive: { color: colors.accent },
  resBtnSub: { fontSize: typography.xs, color: colors.textMuted, marginTop: 1 },
  resBtnSubActive: { color: colors.accentText },
  // Quality
  qualityRow: { flexDirection: 'row', gap: spacing[2] },
  qualityCard: {
    flex: 1, paddingVertical: spacing[3], paddingHorizontal: spacing[2],
    alignItems: 'center', borderRadius: radius.md,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.border,
    gap: 4,
  },
  qualityCardActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  qualityLabel: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textSecondary },
  qualityLabelActive: { color: colors.accent },
  qualityDesc: { fontSize: typography.xs, color: colors.textMuted, textAlign: 'center' },
  qualityDescActive: { color: colors.accentText },
  // Format
  formatRow: { flexDirection: 'row', gap: spacing[2] },
  formatCard: {
    flex: 1, paddingVertical: spacing[3], paddingHorizontal: spacing[2],
    alignItems: 'center', borderRadius: radius.md,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.border,
    gap: 4,
  },
  formatCardActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  formatLabel: { fontSize: typography.md, fontWeight: typography.bold, color: colors.textSecondary },
  formatLabelActive: { color: colors.accent },
  formatDesc: { fontSize: typography.xs, color: colors.textMuted, textAlign: 'center' },
  formatDescActive: { color: colors.accentText },
  // Estimate
  estimateBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.surface1, padding: spacing[3],
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  estimateText: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: typography.medium },
  estimateSub: { fontSize: typography.xs, color: colors.textMuted, marginTop: 1 },
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: colors.accentMuted, padding: spacing[3],
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent,
  },
  noteText: { flex: 1, fontSize: typography.sm, color: colors.textSecondary, lineHeight: 18 },
  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing[4], backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingVertical: spacing[4], gap: spacing[2],
  },
  exportBtnText: { fontSize: typography.md, fontWeight: typography.bold, color: colors.bg },
  // Progress
  progressTitle: { fontSize: typography['2xl'], fontWeight: typography.bold, color: colors.textPrimary },
  progressLabel: { fontSize: typography.base, color: colors.textSecondary },
  progressTrack: {
    width: '100%', height: 6, backgroundColor: colors.surface2,
    borderRadius: radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.full },
  progressPct: { fontSize: typography.sm, color: colors.textMuted },
  // Done
  doneIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center',
  },
  doneTitle: { fontSize: typography['2xl'], fontWeight: typography.bold, color: colors.textPrimary },
  doneSub: {
    fontSize: typography.base, color: colors.textSecondary,
    textAlign: 'center', paddingHorizontal: spacing[8],
  },
  doneActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderRadius: radius.full, backgroundColor: colors.surface2,
    borderWidth: 1, borderColor: colors.border,
  },
  shareBtnText: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textPrimary },
  doneBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing[6], paddingVertical: spacing[3],
    borderRadius: radius.full,
  },
  doneBtnText: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.bg },
  // Download button — full-width, prominent
  downloadBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: spacing[4],
  },
  downloadBtnText: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.bg,
    textAlign: 'center',
  },
});
