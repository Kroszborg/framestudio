import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { PlayIcon, PauseIcon, PreviousIcon, NextIcon } from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { colors, typography, spacing, radius } from '../../lib/theme';

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const frame = Math.floor((ms % 1000) / 33);
  return `${m}:${sec.toString().padStart(2, '0')}.${frame.toString().padStart(2, '0')}`;
}

export default function PreviewControls() {
  const { currentTime, isPlaying, setCurrentTime, setIsPlaying, clips } = useProjectStore();

  const totalDuration = clips.reduce((max, c) => {
    const end = c.startTime + c.duration / c.speed;
    return Math.max(max, end);
  }, 0);

  function toggle() {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentTime >= totalDuration && totalDuration > 0) setCurrentTime(0);
      setIsPlaying(true);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.time}>{formatTime(currentTime)}</Text>
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => setCurrentTime(Math.max(0, currentTime - 1000))} style={styles.btn} activeOpacity={0.7}>
          <HugeiconsIcon icon={PreviousIcon} size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggle} style={styles.playBtn} activeOpacity={0.8}>
          <HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} size={22} color={colors.bg} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentTime(Math.min(totalDuration, currentTime + 1000))} style={styles.btn} activeOpacity={0.7}>
          <HugeiconsIcon icon={NextIcon} size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.time}>{formatTime(totalDuration)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  time: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'] as any,
    minWidth: 64,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  btn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
