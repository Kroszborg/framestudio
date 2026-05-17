/**
 * Sticker screen — browse sticker packs + pick image from gallery
 * to add as a media overlay on top of the video.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon,
  Image01Icon,
  StarSquareIcon,
  Add01Icon,
} from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { StickerOverlay } from '../../lib/database';
import { colors, typography, spacing, radius } from '../../lib/theme';

// Built-in emoji stickers (rendered as text overlays visually)
const EMOJI_PACKS = [
  {
    name: 'Reactions',
    items: ['❤️', '😂', '🔥', '👏', '💯', '✨', '🎉', '😍', '🤩', '💪', '👍', '🙌'],
  },
  {
    name: 'Vibe',
    items: ['🌊', '⚡', '🌙', '☀️', '🌈', '🎵', '🎬', '🎯', '💫', '🚀', '⭐', '🌟'],
  },
  {
    name: 'Fun',
    items: ['😎', '🤪', '🥳', '😜', '🤓', '🥰', '😇', '🤗', '🫶', '🤙', '✌️', '🫠'],
  },
];

function generateId() {
  return `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function StickerScreen() {
  const router = useRouter();
  const { id: projectId, time } = useLocalSearchParams<{ id: string; time: string }>();
  const { addStickerOverlay, currentTime, clips } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'emoji' | 'gallery'>('emoji');

  // Total project duration
  const totalDuration = clips.reduce((acc, c) => {
    const eff = (c.duration - c.trimStart - c.trimEnd) / Math.max(0.01, c.speed);
    return Math.max(acc, c.startTime + eff);
  }, 5000);

  async function addEmoji(emoji: string) {
    if (!projectId) return;

    // Add as a text overlay with a giant emoji
    const { addTextOverlay } = useProjectStore.getState();
    const overlayId = generateId();
    const atTime = currentTime || 0;

    await addTextOverlay({
      id: overlayId,
      projectId,
      content: emoji,
      positionX: 0.5,
      positionY: 0.5,
      startTime: atTime,
      duration: Math.max(1000, Math.min(3000, totalDuration - atTime)),
      fontSize: 64,
      color: '#ffffff',
      fontFamily: 'System',
      shadow: false,
      outline: false,
      outlineColor: '#000000',
      backgroundColor: 'transparent',
      animation: 'none',
    } as any);

    router.back();
  }

  async function addFromGallery() {
    if (!projectId) return;

    try {
      let ImagePicker: any;
      if (Platform.OS !== 'web') {
        ImagePicker = require('expo-image-picker');
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          Alert.alert('Permission needed', 'Allow photo access to pick sticker images.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.9,
        });
        if (result.canceled || !result.assets?.[0]) return;

        const asset = result.assets[0];
        const atTime = currentTime || 0;

        const sticker: StickerOverlay = {
          id: generateId(),
          projectId,
          uri: asset.uri,
          positionX: 0.5,
          positionY: 0.5,
          scale: 0.3,
          rotation: 0,
          opacity: 1,
          startTime: atTime,
          duration: Math.max(1000, Math.min(3000, totalDuration - atTime)),
          flipH: false,
          flipV: false,
        };

        await addStickerOverlay(sticker);
        router.back();
      } else {
        // Web: file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const url = URL.createObjectURL(file);
          const atTime = currentTime || 0;

          const sticker: StickerOverlay = {
            id: generateId(),
            projectId,
            uri: url,
            positionX: 0.5,
            positionY: 0.5,
            scale: 0.3,
            rotation: 0,
            opacity: 1,
            startTime: atTime,
            duration: Math.max(1000, Math.min(3000, totalDuration - atTime)),
            flipH: false,
            flipV: false,
          };

          await addStickerOverlay(sticker);
          router.back();
        };
        input.click();
      }
    } catch (err) {
      console.warn('Gallery pick error', err);
    }
  }

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Sticker</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabs}>
        {(['emoji', 'gallery'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={tab === 'emoji' ? StarSquareIcon : Image01Icon}
              size={16}
              color={activeTab === tab ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'emoji' ? 'Emoji' : 'Gallery'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'emoji' ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {EMOJI_PACKS.map(pack => (
            <View key={pack.name}>
              <Text style={styles.packName}>{pack.name}</Text>
              <View style={styles.emojiGrid}>
                {pack.items.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.emojiBtn}
                    onPress={() => addEmoji(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.galleryTab}>
          <HugeiconsIcon icon={Image01Icon} size={56} color={colors.textMuted} />
          <Text style={styles.galleryTitle}>Add image overlay</Text>
          <Text style={styles.gallerySub}>Pick any image from your gallery to overlay on the video</Text>
          <TouchableOpacity style={styles.galleryBtn} onPress={addFromGallery} activeOpacity={0.8}>
            <HugeiconsIcon icon={Add01Icon} size={18} color="#fff" />
            <Text style={styles.galleryBtnText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing[2],
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    gap: 6,
    backgroundColor: colors.surface1,
  },
  tabActive: {
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  tabLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: 40,
  },
  packName: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing[2],
    marginTop: spacing[3],
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  emojiBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emojiText: {
    fontSize: 32,
  },
  galleryTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    gap: spacing[4],
  },
  galleryTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  gallerySub: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    marginTop: spacing[2],
  },
  galleryBtnText: {
    fontSize: typography.base,
    color: '#fff',
    fontWeight: '600',
  },
});
