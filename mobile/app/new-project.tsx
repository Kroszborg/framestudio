import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Video01Icon, Image01Icon, MusicNote01Icon,
  ArrowLeft01Icon, ArrowRight01Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createProject, createClip, makeClipDefaults, getUniqueProjectName, Project, ProjectType } from '../lib/database';
import { colors, typography, spacing, radius } from '../lib/theme';

type Resolution = Project['resolution'];
type FrameRate = Project['frameRate'];
type AspectRatio = Project['aspectRatio'];

const PROJECT_TYPES: { id: ProjectType; label: string; icon: any; desc: string }[] = [
  { id: 'video', label: 'Video', icon: Video01Icon, desc: 'Edit video clips with timeline' },
  { id: 'photo', label: 'Photo', icon: Image01Icon, desc: 'Edit & compose photos' },
  { id: 'audio', label: 'Audio', icon: MusicNote01Icon, desc: 'Mix & edit audio tracks' },
];

const RESOLUTIONS: { label: string; value: Resolution; sub: string }[] = [
  { label: '4K', value: '4K', sub: '3840x2160' },
  { label: '2K', value: '2K', sub: '2560x1440' },
  { label: '1080p', value: '1080p', sub: '1920x1080' },
  { label: '720p', value: '720p', sub: '1280x720' },
  { label: '480p', value: '480p', sub: '854x480' },
];

const FRAME_RATES: FrameRate[] = [24, 25, 30, 50, 60];

const ASPECT_RATIOS: { label: string; value: AspectRatio }[] = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '21:9', value: '21:9' },
];

const PHOTO_RATIOS: { label: string; value: AspectRatio }[] = [
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
];

function OptionChip({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>{label}</Text>
      {sub ? <Text style={[styles.chipSub, selected && styles.chipSubActive]}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

export default function NewProjectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('video');
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [frameRate, setFrameRate] = useState<FrameRate>(30);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (creating) return; // prevent double-tap
    setCreating(true);

    try {
      const baseName = name.trim() || `Project ${new Date().toLocaleDateString()}`;
      // Ensure unique name
      const uniqueName = await getUniqueProjectName(baseName);

      const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const project: Project = {
        id: projectId,
        name: uniqueName,
        type: projectType,
        resolution: projectType === 'audio' ? '1080p' : resolution,
        frameRate: projectType === 'audio' ? 30 : frameRate,
        aspectRatio: projectType === 'audio' ? '16:9' : aspectRatio,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        duration: 0,
      };
      await createProject(project);

      // Pick media FIRST (picker needs active context), then navigate
      let clipsAdded = false;
      if (projectType === 'video') clipsAdded = await pickVideoMedia(projectId);
      else if (projectType === 'photo') clipsAdded = await pickPhotoMedia(projectId);
      else if (projectType === 'audio') clipsAdded = await pickAudioMedia(projectId);

      if (!clipsAdded) {
        // User cancelled picker — delete empty project and stay on screen
        const { deleteProject } = require('../lib/database');
        await deleteProject(projectId);
        setCreating(false);
        return;
      }

      router.replace(`/editor/${projectId}` as Href);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create project');
      setCreating(false);
    }
  }

  async function pickVideoMedia(projectId: string): Promise<boolean> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (!result.canceled && result.assets.length > 0) {
        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          const prevClipEnd = i === 0 ? 0 : result.assets.slice(0, i).reduce(
            (acc, a) => acc + (a.duration && a.duration > 0 ? Math.round(a.duration) : 5000), 0
          );
          // Copy content:// to file:// — store in documentDirectory so Android won't delete it
          let videoUri = asset.uri;
          if (Platform.OS === 'android') {
            try {
              const FS = require('expo-file-system/legacy');
              const mediaDir = `${FS.documentDirectory}media/`;
              await FS.makeDirectoryAsync(mediaDir, { intermediates: true }).catch(() => {});
              const ext = (asset.fileName?.split('.').pop() || 'mp4').toLowerCase();
              const dest = `${mediaDir}vid_${Date.now()}_${i}.${ext}`;
              await FS.copyAsync({ from: asset.uri, to: dest });
              videoUri = dest;
            } catch {}
          }
          const clip = makeClipDefaults({
            id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${i}`,
            projectId,
            uri: videoUri,
            type: 'video',
            name: asset.fileName || `Clip ${i + 1}`,
            duration: asset.duration && asset.duration > 0 ? Math.round(asset.duration) : 10000,
            orderIndex: i,
            startTime: prevClipEnd,
          });
          await createClip(clip);
        }
        return true;
      }
    } catch { /* user cancelled or permission denied */ }
    return false;
  }

  async function pickPhotoMedia(projectId: string): Promise<boolean> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (!result.canceled && result.assets.length > 0) {
        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          // Copy content:// to file:// — store in documentDirectory so Android won't delete it
          let photoUri = asset.uri;
          if (Platform.OS === 'android') {
            try {
              const FS = require('expo-file-system/legacy');
              const mediaDir = `${FS.documentDirectory}media/`;
              await FS.makeDirectoryAsync(mediaDir, { intermediates: true }).catch(() => {});
              const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
              const dest = `${mediaDir}photo_${Date.now()}_${i}.${ext}`;
              await FS.copyAsync({ from: asset.uri, to: dest });
              photoUri = dest;
            } catch {}
          }
          const clip = makeClipDefaults({
            id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${i}`,
            projectId,
            uri: photoUri,
            type: 'image',
            name: asset.fileName || `Photo ${i + 1}`,
            duration: 5000,
            orderIndex: i,
            startTime: i * 5000,
          });
          await createClip(clip);
        }
        return true;
      }
    } catch { /* user cancelled */ }
    return false;
  }

  async function pickAudioMedia(projectId: string): Promise<boolean> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        let cumulativeStart = 0;
        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];

          // Copy to documentDirectory/media/ so Android won't delete it
          let audioUri = asset.uri;
          if (Platform.OS === 'android') {
            try {
              const FS = require('expo-file-system/legacy');
              const mediaDir = `${FS.documentDirectory}media/`;
              await FS.makeDirectoryAsync(mediaDir, { intermediates: true }).catch(() => {});
              const ext = (asset.name?.split('.').pop() || 'mp3').toLowerCase();
              const dest = `${mediaDir}audio_${Date.now()}_${i}.${ext}`;
              await FS.copyAsync({ from: asset.uri, to: dest });
              audioUri = dest;
            } catch {}
          }

          // Get real audio duration
          let duration = 30000;
          try {
            const { Sound } = require('expo-av');
            const { sound, status } = await Sound.createAsync({ uri: audioUri }, { shouldPlay: false });
            if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
              duration = Math.round(status.durationMillis);
            }
            await sound.unloadAsync();
          } catch {}

          const clip = makeClipDefaults({
            id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${i}`,
            projectId,
            uri: audioUri,
            type: 'audio',
            name: asset.name || `Audio ${i + 1}`,
            duration,
            trackIndex: 2,
            orderIndex: i,
            startTime: cumulativeStart,
          });
          cumulativeStart += duration;
          await createClip(clip);
        }
        return true;
      }
    } catch { /* user cancelled */ }
    return false;
  }

  const showResolution = projectType === 'video' || projectType === 'photo';
  const showFrameRate = projectType === 'video';
  const showAspectRatio = projectType === 'video' || projectType === 'photo';
  const ratioOptions = projectType === 'photo' ? PHOTO_RATIOS : ASPECT_RATIOS;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>New Project</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Project type tabs */}
        <View style={styles.section}>
          <Text style={styles.label}>Project type</Text>
          <View style={styles.typeRow}>
            {PROJECT_TYPES.map(pt => {
              const active = projectType === pt.id;
              return (
                <TouchableOpacity
                  key={pt.id}
                  style={[styles.typeCard, active && styles.typeCardActive]}
                  onPress={() => {
                    setProjectType(pt.id);
                    // Only reset aspect ratio if switching TO photo (uses different ratio set)
                    // For video/audio, keep whatever the user selected
                    if (pt.id === 'photo' && !['1:1', '4:3', '3:4', '16:9', '9:16'].includes(aspectRatio)) {
                      setAspectRatio('1:1');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <HugeiconsIcon
                    icon={pt.icon}
                    size={24}
                    color={active ? colors.accent : colors.textMuted}
                  />
                  <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{pt.label}</Text>
                  <Text style={[styles.typeDesc, active && styles.typeDescActive]}>{pt.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Project name */}
        <View style={styles.section}>
          <Text style={styles.label}>Project name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Untitled project"
            placeholderTextColor={colors.textMuted}
            maxLength={60}
          />
        </View>

        {/* Resolution (video & photo only) */}
        {showResolution && (
          <View style={styles.section}>
            <Text style={styles.label}>Resolution</Text>
            <View style={styles.chipRow}>
              {RESOLUTIONS.map(r => (
                <OptionChip
                  key={r.value}
                  label={r.label}
                  sub={r.sub}
                  selected={resolution === r.value}
                  onPress={() => setResolution(r.value)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Frame rate (video only) */}
        {showFrameRate && (
          <View style={styles.section}>
            <Text style={styles.label}>Frame rate</Text>
            <View style={styles.chipRow}>
              {FRAME_RATES.map(fps => (
                <OptionChip
                  key={fps}
                  label={`${fps} fps`}
                  selected={frameRate === fps}
                  onPress={() => setFrameRate(fps)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Aspect ratio (video & photo only) */}
        {showAspectRatio && (
          <View style={styles.section}>
            <Text style={styles.label}>Aspect ratio</Text>
            <View style={styles.chipRow}>
              {ratioOptions.map(ar => (
                <OptionChip
                  key={ar.value}
                  label={ar.label}
                  selected={aspectRatio === ar.value}
                  onPress={() => setAspectRatio(ar.value)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Resolution warning */}
        {showResolution && (resolution === '4K' || resolution === '2K') && (
          <View style={styles.noteBox}>
            <HugeiconsIcon icon={InformationCircleIcon} size={16} color={colors.textSecondary} />
            <Text style={styles.noteText}>
              {resolution} requires a capable device for smooth playback.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Create button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[4] }]}>
        <TouchableOpacity
          style={[styles.createBtn, creating && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.8}
        >
          <HugeiconsIcon
            icon={projectType === 'video' ? Video01Icon : projectType === 'photo' ? Image01Icon : MusicNote01Icon}
            size={18}
            color={colors.bg}
          />
          <Text style={styles.createBtnText}>
            {creating ? 'Creating...' : `Create ${projectType} project`}
          </Text>
          {!creating && <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.bg} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface1,
    borderRadius: radius.full,
  },
  navTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[4], gap: spacing[6], paddingBottom: 120 },
  section: { gap: spacing[2] + 2 },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  // Type selector
  typeRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
    borderRadius: radius.lg,
    backgroundColor: colors.surface1,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing[1] + 2,
  },
  typeCardActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  typeLabel: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
  },
  typeLabelActive: {
    color: colors.accent,
  },
  typeDesc: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  typeDescActive: {
    color: colors.accentText,
  },
  // Inputs
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
    fontSize: typography.md,
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[3] + 2,
    paddingVertical: spacing[2] + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipLabel: {
    fontSize: typography.base,
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.accent,
    fontWeight: typography.semibold,
  },
  chipSub: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  chipSubActive: {
    color: colors.accentText,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.accentMuted,
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteText: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[4],
    paddingBottom: spacing[4],
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.bg,
  },
});
