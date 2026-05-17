import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  VolumeHighIcon, MuteIcon, Delete01Icon,
  PlayIcon, PauseIcon,
} from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { Clip } from '../../lib/database';
import { colors, typography, spacing, radius } from '../../lib/theme';
import { getWaveform } from '../../lib/audioWaveform';

// expo-av for audio preview playback
let Audio: any = null;
if (Platform.OS !== 'web') {
  try { Audio = require('expo-av').Audio; } catch {}
}

interface AudioTrackControlProps {
  clip: Clip;
}

export default function AudioTrackControl({ clip }: AudioTrackControlProps) {
  const { updateClip, updateClipOptimistic, commitClipUpdate, removeClip } = useProjectStore();
  const isMuted = clip.volume === 0;
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveform, setWaveform] = useState<number[] | null>(null);
  const [playbackPos, setPlaybackPos] = useState(0); // 0-1 fraction
  const soundRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load waveform
  useEffect(() => {
    let cancelled = false;
    getWaveform(clip.uri, 24).then(data => {
      if (!cancelled) setWaveform(data);
    });
    return () => { cancelled = true; };
  }, [clip.uri]);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync?.();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const togglePreview = useCallback(async () => {
    if (!Audio) return;

    if (isPlaying && soundRef.current) {
      await soundRef.current.pauseAsync?.();
      setIsPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    try {
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: clip.uri },
          {
            shouldPlay: true,
            volume: clip.volume,
            rate: clip.speed || 1,
            positionMillis: clip.trimStart,
          }
        );
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate?.((status: any) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPlaybackPos(0);
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        });
      } else {
        await soundRef.current.setVolumeAsync?.(clip.volume);
        await soundRef.current.playAsync?.();
      }

      setIsPlaying(true);

      // Track playback position
      intervalRef.current = setInterval(async () => {
        try {
          const status = await soundRef.current?.getStatusAsync?.();
          if (status?.isLoaded && status.durationMillis > 0) {
            const effectiveDur = clip.duration - clip.trimStart - clip.trimEnd;
            const pos = (status.positionMillis - clip.trimStart) / effectiveDur;
            setPlaybackPos(Math.max(0, Math.min(1, pos)));
          }
        } catch {}
      }, 100);
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying, clip.uri, clip.volume, clip.speed, clip.trimStart, clip.trimEnd, clip.duration]);

  // Update volume on playing sound
  useEffect(() => {
    if (soundRef.current && isPlaying) {
      soundRef.current.setVolumeAsync?.(clip.volume);
    }
  }, [clip.volume]);

  const formatDuration = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const effectiveDuration = (clip.duration - clip.trimStart - clip.trimEnd) / (clip.speed || 1);

  return (
    <View style={styles.container}>
      {/* Play/pause preview button */}
      {Audio && (
        <TouchableOpacity
          onPress={togglePreview}
          style={[styles.playBtn, isPlaying && styles.playBtnActive]}
          activeOpacity={0.7}
        >
          <HugeiconsIcon
            icon={isPlaying ? PauseIcon : PlayIcon}
            size={14}
            color={isPlaying ? colors.bg : colors.textPrimary}
          />
        </TouchableOpacity>
      )}

      {/* Mute toggle */}
      <TouchableOpacity
        onPress={() => updateClip(clip.id, { volume: isMuted ? 1 : 0 }, 'mute')}
        style={styles.muteBtn}
        activeOpacity={0.7}
      >
        <HugeiconsIcon
          icon={isMuted ? MuteIcon : VolumeHighIcon}
          size={18}
          color={isMuted ? colors.textMuted : colors.textPrimary}
        />
      </TouchableOpacity>

      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{clip.name}</Text>
          <Text style={styles.duration}>{formatDuration(effectiveDuration)}</Text>
        </View>

        {/* Mini waveform with playback position */}
        <View style={styles.waveformRow}>
          {waveform ? (
            waveform.map((amp, i) => {
              const isBehindPlayhead = isPlaying && (i / waveform.length) < playbackPos;
              return (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: 4 + amp * 16,
                      backgroundColor: isBehindPlayhead ? colors.accent : colors.surface3,
                    },
                  ]}
                />
              );
            })
          ) : (
            <View style={styles.waveformPlaceholder} />
          )}
        </View>

        {/* Volume slider */}
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          value={clip.volume}
          onValueChange={v => updateClipOptimistic(clip.id, { volume: v })}
          onSlidingComplete={() => commitClipUpdate(clip.id, 'volume')}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.surface3}
          thumbTintColor={colors.accent}
        />
      </View>

      <TouchableOpacity
        onPress={() => {
          soundRef.current?.unloadAsync?.();
          if (intervalRef.current) clearInterval(intervalRef.current);
          removeClip(clip.id);
        }}
        style={styles.deleteBtn}
        activeOpacity={0.7}
      >
        <HugeiconsIcon icon={Delete01Icon} size={16} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    gap: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
  },
  playBtnActive: {
    backgroundColor: colors.accent,
  },
  muteBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface1,
  },
  middle: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing[2],
  },
  duration: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 1,
    marginBottom: 4,
    overflow: 'hidden',
  },
  waveBar: {
    flex: 1,
    borderRadius: 1,
    minWidth: 2,
  },
  waveformPlaceholder: {
    flex: 1,
    height: 2,
    backgroundColor: colors.surface3,
    borderRadius: 1,
  },
  slider: { height: 24, marginHorizontal: -6 },
  deleteBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
