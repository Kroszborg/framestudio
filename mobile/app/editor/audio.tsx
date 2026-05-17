import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, Add01Icon, MusicNote01Icon, Mic01Icon, StopIcon } from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { makeClipDefaults } from '../../lib/database';
import { colors, typography, spacing, radius } from '../../lib/theme';
import AudioTrackControl from '../../components/editor/AudioTrackControl';
import * as FileSystem from 'expo-file-system/legacy';

// Lazy-load expo-av Audio
let Audio: any = null;
if (Platform.OS !== 'web') {
  try { Audio = require('expo-av').Audio; } catch {}
}

export default function AudioScreen() {
  const router = useRouter();
  const { clips, projectId, addClip } = useProjectStore();
  const audioClips = clips.filter(c => c.trackIndex === 2 || c.type === 'audio');

  const [recording, setRecording] = useState<any>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (recordTimer.current) clearInterval(recordTimer.current);
      recording?.stopAndUnloadAsync?.().catch(() => {});
    };
  }, []);

  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!projectId) return;
      const clip = makeClipDefaults({
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        projectId,
        uri: asset.uri,
        type: 'audio',
        name: asset.name || 'Audio',
        duration: 30000,
        trackIndex: 2,
        orderIndex: clips.filter(c => c.trackIndex === 2).length,
      });
      await addClip(clip);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not import audio');
    }
  }

  async function startRecording() {
    if (!projectId) return;
    try {
      const AvAudio = Audio ?? require('expo-av').Audio;
      const { status } = await AvAudio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Microphone access is needed to record audio.');
        return;
      }
      await AvAudio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await AvAudio.Recording.createAsync(
        AvAudio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setRecordingDuration(0);
      recordTimer.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (e: any) {
      Alert.alert('Microphone error', e?.message || 'Could not start recording');
    }
  }

  async function stopRecording() {
    if (!recording) return;
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const durationMs = recordingDuration * 1000;
      setRecording(null);
      setRecordingDuration(0);

      if (!uri || !projectId) return;

      // Copy to permanent location
      const destUri = `${(FileSystem as any).documentDirectory}recording_${Date.now()}.m4a`;
      await FileSystem.copyAsync({ from: uri, to: destUri });

      const clip = makeClipDefaults({
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        projectId,
        uri: destUri,
        type: 'audio',
        name: `Recording ${new Date().toLocaleTimeString()}`,
        duration: Math.max(durationMs, 1000),
        trackIndex: 2,
        orderIndex: clips.filter(c => c.trackIndex === 2).length,
      });
      await addClip(clip);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save recording');
      setRecording(null);
    }
  }

  function formatDur(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }

  const isRecording = !!recording;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={Cancel01Icon} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Audio</Text>
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          {/* Voice record button — always visible on native */}
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={isRecording ? stopRecording : startRecording}
              style={[styles.addBtn, isRecording && styles.recordingBtn]}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={isRecording ? StopIcon : Mic01Icon}
                size={18}
                color={colors.bg}
              />
            </TouchableOpacity>
          )}
          {/* Import button */}
          <TouchableOpacity onPress={handleImport} style={styles.addBtn} activeOpacity={0.7}>
            <HugeiconsIcon icon={Add01Icon} size={20} color={colors.bg} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingBar}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>Recording {formatDur(recordingDuration)} — tap ■ to stop</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {audioClips.length === 0 && !isRecording ? (
          <View style={styles.empty}>
            <HugeiconsIcon icon={MusicNote01Icon} size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No audio tracks</Text>
            <Text style={styles.emptySub}>
              Tap + to import audio{Audio ? ' or 🎙 to record' : ''}
            </Text>
          </View>
        ) : (
          audioClips.map(clip => (
            <AudioTrackControl key={clip.id} clip={clip} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
  navBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface1, borderRadius: radius.full,
  },
  navTitle: { fontSize: typography.lg, fontWeight: typography.semibold, color: colors.textPrimary },
  addBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderRadius: radius.full,
  },
  recordingBtn: {
    backgroundColor: colors.error,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2] + 2,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239,68,68,0.3)',
  },
  recDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.error,
  },
  recText: {
    fontSize: typography.sm,
    color: colors.error,
    fontWeight: typography.medium,
  },
  empty: {
    paddingTop: 80,
    alignItems: 'center',
    gap: spacing[3],
  },
  emptyTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary },
  emptySub: { fontSize: typography.base, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
