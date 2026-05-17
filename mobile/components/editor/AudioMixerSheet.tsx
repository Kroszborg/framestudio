/**
 * AudioMixerSheet — per-clip volume + mute + solo controls
 * Presents as a bottom sheet over the editor.
 */
import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Cancel01Icon,
  VolumeHighIcon,
  VolumeMuteIcon,
  MusicNote01Icon,
  Film01Icon,
  Image01Icon,
  SoundcloudIcon,
} from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { Clip } from '../../lib/database';
import { colors, typography, spacing, radius } from '../../lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const TRACK_LABELS: Record<number, string> = {
  0: 'Primary',
  1: 'Overlay',
  2: 'Audio',
};

function ClipIcon({ clip }: { clip: Clip }) {
  if (clip.type === 'audio') return <HugeiconsIcon icon={MusicNote01Icon} size={14} color={colors.textMuted} />;
  if (clip.type === 'image') return <HugeiconsIcon icon={Image01Icon} size={14} color={colors.textMuted} />;
  return <HugeiconsIcon icon={Film01Icon} size={14} color={colors.textMuted} />;
}

function MixerRow({ clip, onVolumeChange, onVolumeCommit, onMute, onSolo, soloId }: {
  clip: Clip;
  onVolumeChange: (id: string, vol: number) => void;
  onVolumeCommit: (id: string) => void;
  onMute: (id: string) => void;
  onSolo: (id: string) => void;
  soloId: string | null;
}) {
  const isMuted = clip.volume === 0;
  const isSoloed = soloId === clip.id;
  const otherSoloed = soloId !== null && soloId !== clip.id;

  return (
    <View style={[styles.row, otherSoloed && styles.rowDimmed]}>
      <View style={styles.rowLeft}>
        <ClipIcon clip={clip} />
        <View style={styles.rowInfo}>
          <Text style={styles.clipName} numberOfLines={1}>{clip.name}</Text>
          <Text style={styles.trackLabel}>{TRACK_LABELS[clip.trackIndex] ?? 'Track'}</Text>
        </View>
      </View>
      <View style={styles.rowControls}>
        {/* Mute */}
        <TouchableOpacity
          style={[styles.iconBtn, isMuted && styles.iconBtnActive]}
          onPress={() => onMute(clip.id)}
          activeOpacity={0.7}
        >
          <HugeiconsIcon
            icon={isMuted ? VolumeMuteIcon : VolumeHighIcon}
            size={16}
            color={isMuted ? colors.error : colors.textSecondary}
          />
        </TouchableOpacity>
        {/* Solo */}
        <TouchableOpacity
          style={[styles.iconBtn, isSoloed && styles.iconBtnSolo]}
          onPress={() => onSolo(clip.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.soloText, isSoloed && styles.soloTextActive]}>S</Text>
        </TouchableOpacity>
        {/* Volume slider */}
        <View style={styles.sliderWrap}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={2}
            value={clip.volume}
            onValueChange={v => onVolumeChange(clip.id, v)}
            onSlidingComplete={() => onVolumeCommit(clip.id)}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.accent}
          />
        </View>
        {/* Volume % */}
        <Text style={styles.volPct}>{Math.round(clip.volume * 100)}%</Text>
      </View>
    </View>
  );
}

export default function AudioMixerSheet({ visible, onClose }: Props) {
  const { clips, updateClipOptimistic, commitClipUpdate } = useProjectStore();
  const [soloId, setSoloId] = React.useState<string | null>(null);

  // Show clips that have audio (all video + audio clips, not images without audio)
  const audioClips = useMemo(() =>
    clips.filter(c => c.type !== 'image'),
    [clips]
  );

  const handleVolume = useCallback((id: string, vol: number) => {
    updateClipOptimistic(id, { volume: parseFloat(vol.toFixed(2)) });
  }, [updateClipOptimistic]);

  const handleVolumeCommit = useCallback((id: string) => {
    commitClipUpdate(id, 'volume');
  }, [commitClipUpdate]);

  const handleMute = useCallback((id: string) => {
    const clip = useProjectStore.getState().clips.find(c => c.id === id);
    if (!clip) return;
    const newVol = clip.volume === 0 ? 1 : 0;
    updateClipOptimistic(id, { volume: newVol });
    commitClipUpdate(id, 'mute');
  }, [updateClipOptimistic, commitClipUpdate]);

  const handleSolo = useCallback((id: string) => {
    setSoloId(prev => prev === id ? null : id);
  }, []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HugeiconsIcon icon={SoundcloudIcon} size={18} color={colors.accent} />
              <Text style={styles.title}>Audio Mixer</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {/* Column headers */}
          <View style={styles.colHeaders}>
            <Text style={styles.colLabel}>CLIP</Text>
            <View style={styles.colHeaderRight}>
              <Text style={[styles.colLabel, { width: 28, textAlign: 'center' }]}>M</Text>
              <Text style={[styles.colLabel, { width: 28, textAlign: 'center' }]}>S</Text>
              <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>VOLUME</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {audioClips.length === 0 ? (
            <View style={styles.empty}>
              <HugeiconsIcon icon={MusicNote01Icon} size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>No audio clips in project</Text>
              <Text style={styles.emptySub}>Add a video or audio clip to mix</Text>
            </View>
          ) : (
            audioClips.map(clip => (
              <MixerRow
                key={clip.id}
                clip={clip}
                onVolumeChange={handleVolume}
                onVolumeCommit={handleVolumeCommit}
                onMute={handleMute}
                onSolo={handleSolo}
                soloId={soloId}
              />
            ))
          )}
          {/* Master volume section */}
          {audioClips.length > 0 && (
            <View style={styles.masterSection}>
              <Text style={styles.masterLabel}>MASTER</Text>
              <View style={styles.masterRow}>
                <HugeiconsIcon icon={VolumeHighIcon} size={16} color={colors.accent} />
                <Slider
                  style={[styles.slider, { flex: 1, marginHorizontal: 12 }]}
                  minimumValue={0}
                  maximumValue={2}
                  value={1}
                  minimumTrackTintColor={colors.accent}
                  maximumTrackTintColor={colors.border}
                  thumbTintColor={colors.accent}
                />
                <Text style={styles.volPct}>100%</Text>
              </View>
              <Text style={styles.masterNote}>
                Master volume adjusts playback only — individual clip volumes saved automatically.
              </Text>
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  title: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: spacing[1],
  },
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[2],
    marginTop: spacing[1],
  },
  colHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  colLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowDimmed: {
    opacity: 0.4,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
    gap: 8,
  },
  rowInfo: {
    flex: 1,
  },
  clipName: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  trackLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  rowControls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  iconBtnSolo: {
    backgroundColor: 'rgba(99,102,241,0.2)',
  },
  soloText: {
    fontSize: 12,
    fontWeight: typography.bold,
    color: colors.textMuted,
  },
  soloTextActive: {
    color: colors.accent,
  },
  sliderWrap: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  slider: {
    height: 28,
  },
  volPct: {
    fontSize: 11,
    color: colors.textMuted,
    width: 36,
    textAlign: 'right',
  },
  masterSection: {
    margin: spacing[4],
    padding: spacing[4],
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  masterLabel: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing[2],
  },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masterNote: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing[2],
    lineHeight: 16,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptySub: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
