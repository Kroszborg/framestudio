import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Add01Icon, FilterIcon, CursorPointer01Icon,
  CropIcon, SpeedTrain01Icon,
  GitMergeIcon, TextIcon, MusicNote01Icon,
  Copy01Icon, Scissor01Icon,
  StarSquareIcon, SoundcloudIcon,
  Image01Icon, PaintBrushIcon, Layers01Icon,
  MixerIcon, VideoReplayIcon, RatioIcon,
} from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { useToastStore } from '../../lib/toast';
import { colors, typography, spacing, radius } from '../../lib/theme';
import AudioMixerSheet from './AudioMixerSheet';

// Video mode tools
const VIDEO_TOOLS = [
  { id: 'select', icon: CursorPointer01Icon, label: 'Select' },
  { id: 'cut', icon: Scissor01Icon, label: 'Split' },
  { id: 'speed', icon: SpeedTrain01Icon, label: 'Speed' },
  { id: 'crop', icon: CropIcon, label: 'Crop' },
  { id: 'transition', icon: GitMergeIcon, label: 'Transition' },
  { id: 'text', icon: TextIcon, label: 'Text' },
  { id: 'audio', icon: MusicNote01Icon, label: 'Audio' },
  { id: 'auto', icon: MixerIcon, label: 'Auto' },
] as const;

// Photo mode tools
const PHOTO_TOOLS = [
  { id: 'select', icon: CursorPointer01Icon, label: 'Select' },
  { id: 'crop', icon: CropIcon, label: 'Crop' },
  { id: 'text', icon: TextIcon, label: 'Text' },
  { id: 'layers', icon: Layers01Icon, label: 'Layers' },
  { id: 'adjust', icon: MixerIcon, label: 'Adjust' },
  { id: 'retouch', icon: PaintBrushIcon, label: 'Retouch' },
] as const;

// Audio mode tools
const AUDIO_TOOLS = [
  { id: 'select', icon: CursorPointer01Icon, label: 'Select' },
  { id: 'cut', icon: Scissor01Icon, label: 'Split' },
  { id: 'speed', icon: SpeedTrain01Icon, label: 'Speed' },
  { id: 'audio', icon: MusicNote01Icon, label: 'Import' },
  { id: 'transition', icon: GitMergeIcon, label: 'Fade' },
] as const;

type ToolId = typeof VIDEO_TOOLS[number]['id'] | typeof PHOTO_TOOLS[number]['id'] | typeof AUDIO_TOOLS[number]['id'];

interface ToolbarProps {
  onAddMedia?: () => void;
  projectType?: 'video' | 'photo' | 'audio';
}

export default function Toolbar({ onAddMedia, projectType }: ToolbarProps) {
  const router = useRouter();
  const [mixerOpen, setMixerOpen] = useState(false);
  const {
    activeTool, setActiveTool, setActiveInspectorTab,
    selectedClipId, currentTime, splitClip, duplicateClip, projectId,
  } = useProjectStore();
  const showToast = useToastStore(s => s.show);

  const mode = projectType ?? 'video';
  const TOOLS = mode === 'photo' ? PHOTO_TOOLS : mode === 'audio' ? AUDIO_TOOLS : VIDEO_TOOLS;

  function handleToolPress(id: ToolId) {
    if (id === 'cut') {
      if (!selectedClipId) {
        showToast('Select a clip first', 'error', 1500);
        return;
      }
      splitClip(selectedClipId, currentTime).catch(() => {});
      return;
    }

    setActiveTool(id as any);

    if (id === 'text') {
      router.push('/editor/text' as Href);
      return;
    }
    if (id === 'audio') {
      router.push('/editor/audio' as Href);
      return;
    }
    if (id === 'crop') {
      router.push('/editor/crop' as Href);
      return;
    }
    if (id === 'speed') setActiveInspectorTab('clip');
    if (id === 'transition') setActiveInspectorTab('effects');
    if (id === 'adjust') setActiveInspectorTab('color');
    if (id === 'layers') setActiveInspectorTab('effects');
    if (id === 'retouch') setActiveInspectorTab('color');
    if (id === 'auto') {
      router.push('/editor/auto-edit' as Href);
      return;
    }
  }

  function handleDuplicate() {
    if (!selectedClipId) {
      showToast('Select a clip first', 'error', 1500);
      return;
    }
    duplicateClip(selectedClipId);
  }

  function handleSticker() {
    if (!projectId) {
      showToast('Open a project first', 'error', 1500);
      return;
    }
    router.push(`/editor/sticker?id=${projectId}&time=${currentTime}` as Href);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Add media button */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={onAddMedia}
          activeOpacity={0.7}
        >
          <HugeiconsIcon icon={Add01Icon} size={20} color={colors.bg} />
        </TouchableOpacity>

        <View style={styles.separator} />

        {/* Mode-specific quick actions */}
        {mode !== 'audio' && (
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => router.push('/editor/filters' as Href)}
            activeOpacity={0.7}
          >
            <HugeiconsIcon icon={FilterIcon} size={18} color={colors.textSecondary} />
            <Text style={styles.toolLabel}>Filters</Text>
          </TouchableOpacity>
        )}

        {mode === 'audio' && (
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setMixerOpen(true)}
            activeOpacity={0.7}
          >
            <HugeiconsIcon icon={MixerIcon} size={18} color={colors.textSecondary} />
            <Text style={styles.toolLabel}>Mixer</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.toolBtn}
          onPress={handleDuplicate}
          activeOpacity={0.7}
        >
          <HugeiconsIcon icon={Copy01Icon} size={18} color={colors.textSecondary} />
          <Text style={styles.toolLabel}>Duplicate</Text>
        </TouchableOpacity>

        {/* Sticker — video & photo only */}
        {mode !== 'audio' && (
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={handleSticker}
            activeOpacity={0.7}
          >
            <HugeiconsIcon icon={StarSquareIcon} size={18} color={colors.textSecondary} />
            <Text style={styles.toolLabel}>Sticker</Text>
          </TouchableOpacity>
        )}

        {/* Audio Mixer — video only */}
        {mode === 'video' && (
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setMixerOpen(true)}
            activeOpacity={0.7}
          >
            <HugeiconsIcon icon={SoundcloudIcon} size={18} color={colors.textSecondary} />
            <Text style={styles.toolLabel}>Mixer</Text>
          </TouchableOpacity>
        )}

        <View style={styles.separator} />

        {(TOOLS as readonly { id: string; icon: any; label: string }[]).map(tool => {
          const isActive = activeTool === tool.id;
          return (
            <TouchableOpacity
              key={tool.id}
              style={[styles.toolBtn, isActive && styles.toolBtnActive]}
              onPress={() => handleToolPress(tool.id as ToolId)}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={tool.icon}
                size={18}
                color={isActive ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.toolLabel, isActive && styles.toolLabelActive]}>
                {tool.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Audio Mixer bottom sheet */}
      <AudioMixerSheet visible={mixerOpen} onClose={() => setMixerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    gap: spacing[1],
    height: 60,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[1],
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing[2],
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.md,
    gap: 3,
    minWidth: 56,
    height: 48,
  },
  toolBtnActive: {
    backgroundColor: colors.accentMuted,
  },
  toolLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  toolLabelActive: {
    color: colors.accent,
  },
});
