import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon, Share01Icon, UndoIcon, RedoIcon,
  Settings01Icon, Video01Icon, Image01Icon, MusicNote01Icon,
  Film01Icon, Delete01Icon, Cancel01Icon, Layers01Icon,
} from '@hugeicons/core-free-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getProject, updateProject, Project, Clip, makeClipDefaults } from '../../lib/database';
import { useProjectStore } from '../../lib/projectStore';
import { useToastStore } from '../../lib/toast';
import { colors, typography, spacing, radius } from '../../lib/theme';

import VideoPreview from '../../components/editor/VideoPreview';
import Timeline from '../../components/editor/Timeline';
import Toolbar from '../../components/editor/Toolbar';
import InspectorPanel from '../../components/editor/InspectorPanel';
import PhotoEditorPanel from '../../components/editor/PhotoEditorPanel';
import PhotoGLPreview, { type PhotoGLPreviewRef } from '../../components/editor/PhotoGLPreview';

if (Platform.OS !== 'web') {
  try {
    const ScreenOrientation = require('expo-screen-orientation');
    ScreenOrientation.unlockAsync?.();
  } catch {}
}

function isLandscape() {
  const { width, height } = Dimensions.get('window');
  return width > height;
}

// Inspector max height: 40% of screen, min 280, max 380
const INSPECTOR_MAX_H = Math.min(380, Math.max(280, Dimensions.get('window').height * 0.4));

/** Convert project aspectRatio string to numeric ratio for View's aspectRatio prop */
function getProjectAspectRatio(ar: string | undefined): number {
  const map: Record<string, number> = {
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    '1:1': 1,
    '4:3': 4 / 3,
    '3:4': 3 / 4,
    '21:9': 21 / 9,
    '4:5': 4 / 5,
  };
  return map[ar ?? '16:9'] ?? 16 / 9;
}

export default function EditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [landscape, setLandscape] = useState(isLandscape());
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbnailGeneratedRef = useRef(false);
  const inspectorAnim = useRef(new Animated.Value(0)).current;
  const photoGLRef = useRef<PhotoGLPreviewRef>(null);

  const {
    clips, selectedClipId, currentTime, isPlaying,
    activeTool, activeInspectorTab,
    loadProject, addClip, setActiveTool,
    undo, redo, canUndo, canRedo,
    selectedClipIds, clearSelection, batchDeleteClips, batchMoveClips,
    removeClip, duplicateClip, setIsPlaying,
  } = useProjectStore();
  const toasts = useToastStore(s => s.toasts);
  const dismissToast = useToastStore(s => s.dismiss);

  // Web keyboard shortcuts
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      // Space — toggle play/pause (only when not typing in an input)
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        useProjectStore.getState().setIsPlaying(!useProjectStore.getState().isPlaying);
        return;
      }
      // Cmd+Z — undo
      if (meta && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        useProjectStore.getState().undo();
        return;
      }
      // Cmd+Shift+Z — redo
      if (meta && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        useProjectStore.getState().redo();
        return;
      }
      // Delete / Backspace — remove selected clip
      if ((e.key === 'Delete' || e.key === 'Backspace') && (e.target as HTMLElement)?.tagName !== 'INPUT' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
        const { selectedClipId } = useProjectStore.getState();
        if (selectedClipId) {
          e.preventDefault();
          useProjectStore.getState().removeClip(selectedClipId);
        }
        return;
      }
      // Cmd+D — duplicate selected clip
      if (meta && e.key === 'd') {
        const { selectedClipId } = useProjectStore.getState();
        if (selectedClipId) {
          e.preventDefault();
          useProjectStore.getState().duplicateClip(selectedClipId);
        }
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Orientation listener
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setLandscape(window.width > window.height);
    });
    return () => sub?.remove?.();
  }, []);

  // Load project — always clear loading, auto-select first clip for photo projects
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const proj = await getProject(id);
        setProject(proj);
        await loadProject(id);
        if (proj?.type === 'photo') {
          const store = useProjectStore.getState();
          const firstClip = store.clips[0];
          if (firstClip) store.setSelectedClipId(firstClip.id);
        }
      } catch (e) {
        console.warn('[Editor] loadProject error:', e);
      } finally {
        setLoading(false); // ALWAYS clear loading state
      }
    })();
  }, [id]);

  // Auto-open inspector when clip selected, close when deselected (prevents black gap)
  useEffect(() => {
    if (project?.type === 'video' || project?.type === 'audio') {
      setInspectorOpen(!!selectedClipId);
    }
  }, [selectedClipId, project?.type]);

  // Inspector animation
  useEffect(() => {
    Animated.timing(inspectorAnim, {
      toValue: inspectorOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [inspectorOpen]);

  // Auto-save: debounce 2s after any clip change, show badge
  useEffect(() => {
    if (!id || loading) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await updateProject(id, { updatedAt: Date.now() });
        setSavedAt(new Date());
        setShowSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setShowSaved(false), 2500);
      } catch {}
    }, 2000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [clips, id, loading]);

  const toggleInspector = useCallback(() => setInspectorOpen(v => !v), []);

  async function handleAddMedia() {
    const projectType = project?.type || 'video';

    if (projectType === 'audio') {
      pickAudio();
      return;
    }

    if (projectType === 'photo') {
      pickPhoto();
      return;
    }

    // Video project
    Alert.alert('Add media', 'Choose source', [
      { text: 'Video from library', onPress: pickVideo },
      { text: 'Photo from library', onPress: pickPhoto },
      { text: 'Audio file', onPress: pickAudio },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function pickVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      // Copy content:// to file:// — expo-video requires file:// on Android
      // Store in documentDirectory (not cacheDirectory) so Android can't delete it
      let videoUri = asset.uri;
      if (Platform.OS === 'android') {
        const importingId = useToastStore.getState().show('Importing video…', 'info', 60000);
        try {
          const FS = require('expo-file-system/legacy');
          const mediaDir = `${FS.documentDirectory}media/`;
          await FS.makeDirectoryAsync(mediaDir, { intermediates: true }).catch(() => {});
          const ext = (asset.fileName?.split('.').pop() || 'mp4').toLowerCase();
          const dest = `${mediaDir}vid_${Date.now()}.${ext}`;
          await FS.copyAsync({ from: asset.uri, to: dest });
          videoUri = dest;
          useToastStore.getState().dismiss(importingId);
          useToastStore.getState().show('Video ready', 'success', 1500);
        } catch {
          useToastStore.getState().dismiss(importingId);
          useToastStore.getState().show('Using original file', 'info', 1500);
        }
      }

      const maxEnd = clips
        .filter(c => c.trackIndex === 0)
        .reduce((max, c) => Math.max(max, c.startTime + (c.duration - c.trimStart - c.trimEnd) / c.speed), 0);
      const clip = makeClipDefaults({
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        projectId: id!,
        uri: videoUri,
        type: 'video',
        name: asset.fileName || 'Video clip',
        duration: asset.duration && asset.duration > 0 ? Math.round(asset.duration) : 5000,
        orderIndex: clips.filter(c => c.trackIndex === 0).length,
        startTime: maxEnd,
      });
      await addClip(clip);
      // Auto-generate thumbnail with 5s timeout so video never gets stuck at loading
      if (!thumbnailGeneratedRef.current && id && Platform.OS !== 'web') {
        thumbnailGeneratedRef.current = true;
        Promise.race([
          (async () => {
            const VT = require('expo-video-thumbnails');
            const { uri } = await VT.getThumbnailAsync(asset.uri, { time: 500, quality: 0.5 });
            return uri as string;
          })(),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]).then(async (thumbUri) => {
          if (thumbUri && id) {
            await updateProject(id, { thumbnailUri: thumbUri });
            setProject(p => p ? { ...p, thumbnailUri: thumbUri } : p);
          }
        }).catch(() => {}); // thumbnail failure is non-fatal
      }
    }
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      // Copy content:// to file:// — store in documentDirectory so Android won't delete it
      let photoUri = asset.uri;
      if (Platform.OS === 'android') {
        try {
          const FS = require('expo-file-system/legacy');
          const mediaDir = `${FS.documentDirectory}media/`;
          await FS.makeDirectoryAsync(mediaDir, { intermediates: true }).catch(() => {});
          const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
          const dest = `${mediaDir}photo_${Date.now()}.${ext}`;
          await FS.copyAsync({ from: asset.uri, to: dest });
          photoUri = dest;
        } catch {}
      }

      const maxEnd = clips
        .filter(c => c.trackIndex === 0)
        .reduce((max, c) => Math.max(max, c.startTime + (c.duration - c.trimStart - c.trimEnd) / c.speed), 0);
      const clip = makeClipDefaults({
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        projectId: id!,
        uri: photoUri,
        type: 'image',
        name: asset.fileName || 'Photo',
        duration: 5000,
        orderIndex: clips.filter(c => c.trackIndex === 0).length,
        startTime: maxEnd,
      });
      await addClip(clip);
      // Auto-thumbnail: use photo itself as project thumbnail
      if (!thumbnailGeneratedRef.current && id) {
        thumbnailGeneratedRef.current = true;
        try {
          await updateProject(id, { thumbnailUri: asset.uri });
          setProject(p => p ? { ...p, thumbnailUri: asset.uri } : p);
        } catch {}
      }
    }
  }

  async function pickAudio() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Copy to documentDirectory/media/ so Android won't delete it (DocumentPicker uses cache)
        let audioUri = asset.uri;
        if (Platform.OS === 'android') {
          try {
            const FS = require('expo-file-system/legacy');
            const mediaDir = `${FS.documentDirectory}media/`;
            await FS.makeDirectoryAsync(mediaDir, { intermediates: true }).catch(() => {});
            const ext = (asset.name?.split('.').pop() || 'mp3').toLowerCase();
            const dest = `${mediaDir}audio_${Date.now()}.${ext}`;
            await FS.copyAsync({ from: asset.uri, to: dest });
            audioUri = dest;
          } catch {}
        }

        // Get actual audio duration using expo-av
        let duration = 30000;
        try {
          const { Sound } = require('expo-av');
          const { sound, status } = await Sound.createAsync(
            { uri: audioUri },
            { shouldPlay: false }
          );
          if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
            duration = Math.round(status.durationMillis);
          }
          await sound.unloadAsync();
        } catch {}

        const clip = makeClipDefaults({
          id: `clip_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          projectId: id!,
          uri: audioUri,
          type: 'audio',
          name: asset.name || 'Audio',
          duration,
          trackIndex: 2,
          orderIndex: clips.filter(c => c.trackIndex === 2).length,
        });
        await addClip(clip);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not import audio');
    }
  }

  async function handleExport() {
    // For photo projects, capture GL-rendered frame for each clip before exporting.
    // We iterate through clips, temporarily set each as selected, wait for the GL
    // texture to load, then capture. Results are stored keyed by clip ID.
    if (project?.type === 'photo' && photoGLRef.current) {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const photoClips = clips.filter(c => c.trackIndex === 0);
        const { setSelectedClipId } = useProjectStore.getState();

        for (const photoClip of photoClips) {
          setSelectedClipId(photoClip.id);
          // Wait until the GL texture is actually loaded (polls texRef every 80ms, up to 4s)
          await photoGLRef.current!.waitForTexture?.(4000);
          const capturedUri = await photoGLRef.current!.captureAsync().catch(() => null);
          if (capturedUri) {
            await AsyncStorage.setItem(`photo_export_${id}_${photoClip.id}`, capturedUri).catch(() => {});
          }
        }
        // Restore original selection
        if (photoClips.length > 0) setSelectedClipId(photoClips[0].id);
      } catch {} // non-fatal — export proceeds with fallback
    }
    if (!id) {
      useToastStore.getState().show('Cannot export — project not loaded', 'error', 2000);
      return;
    }
    router.push(`/editor/export?id=${id}` as Href);
  }

  async function handleRename(name: string) {
    if (!project || !id) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) return; // no-op if unchanged or empty
    await updateProject(id, { name: trimmed });
    setProject(prev => prev ? { ...prev, name: trimmed } : prev);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <HugeiconsIcon icon={Film01Icon} size={40} color={colors.textMuted} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Project not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.accent, marginTop: 8 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const inspectorH = inspectorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, INSPECTOR_MAX_H],
  });

  if (landscape) {
    return (
      <View style={[styles.landscapeContainer, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <StatusBar hidden />
        <View style={styles.landscapeLeft}>
          <VideoPreview clips={clips} currentTime={currentTime} project={project} />
          <Animated.View style={{ height: inspectorH, overflow: 'hidden' }}>
            <InspectorPanel onClose={() => setInspectorOpen(false)} />
          </Animated.View>
        </View>
        <View style={styles.landscapeRight}>
          <EditorTopBar
            project={project}
            onBack={() => router.back()}
            onExport={handleExport}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo()}
            canRedo={canRedo()}
            onInspector={toggleInspector}
            inspectorOpen={inspectorOpen}
            showSaved={showSaved}
            onRename={handleRename}
          />
          <Toolbar onAddMedia={handleAddMedia} projectType={project.type} />
          {selectedClipIds.length > 0 && (
            <MultiSelectBar
              count={selectedClipIds.length}
              onDelete={batchDeleteClips}
              onMoveTrack={batchMoveClips}
              onClear={clearSelection}
            />
          )}
          <Timeline projectId={id!} />
        </View>
        <ToastOverlay toasts={toasts} onDismiss={dismissToast} />
      </View>
    );
  }

  // Portrait layout
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <EditorTopBar
        project={project}
        onBack={() => router.back()}
        onExport={handleExport}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo()}
        canRedo={canRedo()}
        onInspector={toggleInspector}
        inspectorOpen={inspectorOpen}
        showSaved={showSaved}
        onRename={handleRename}
      />

      {/* Preview — aspect ratio from project settings, never hardcoded 16:9 */}
      <View style={[
        styles.previewWrapper,
        project.type === 'audio' ? styles.previewWrapperAudio :
        project.type === 'photo' ? styles.previewWrapperPhoto :
        { aspectRatio: getProjectAspectRatio(project.aspectRatio) },
      ]}>
        {project.type === 'photo' ? (
          // PhotoGLPreview — aspect-ratio-correct GL preview with pixel-accurate color grade
          // Shader now uses uViewAspect/uImgAspect uniforms to letterbox/pillarbox correctly
          <PhotoGLPreview
            ref={photoGLRef}
            clip={clips.find(c => c.id === selectedClipId) ?? clips[0] ?? null}
            style={{ flex: 1 }}
          />
        ) : (
          <VideoPreview clips={clips} currentTime={currentTime} project={project} />
        )}
      </View>

      {/* Photo project: dedicated photo editor panel (no timeline) */}
      {project.type === 'photo' ? (
        <View style={{ flex: 1 }}>
          <PhotoEditorPanel
            onAddMedia={handleAddMedia}
            projectId={project.id}
            currentTime={currentTime}
          />
        </View>
      ) : (
        <>
          {/* Toolbar */}
          <Toolbar onAddMedia={handleAddMedia} projectType={project.type} />

          {/* Inspector (collapsible) */}
          <Animated.View style={{ height: inspectorH, overflow: 'hidden' }}>
            <InspectorPanel onClose={() => setInspectorOpen(false)} />
          </Animated.View>

          {/* Multi-select action bar */}
          {selectedClipIds.length > 0 && (
            <MultiSelectBar
              count={selectedClipIds.length}
              onDelete={batchDeleteClips}
              onMoveTrack={batchMoveClips}
              onClear={clearSelection}
            />
          )}

          {/* Timeline */}
          <View style={styles.timelineWrapper}>
            <Timeline projectId={id!} />
          </View>
        </>
      )}

      {/* Toast overlay */}
      <ToastOverlay toasts={toasts} onDismiss={dismissToast} />
    </View>
  );
}

/** Toast snackbar overlay at bottom */
function ToastOverlay({ toasts, onDismiss }: { toasts: any[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <View style={styles.toastContainer} pointerEvents="box-none">
      {toasts.map(t => (
        <TouchableOpacity
          key={t.id}
          style={[
            styles.toast,
            t.type === 'error' && styles.toastError,
            t.type === 'success' && styles.toastSuccess,
          ]}
          onPress={() => onDismiss(t.id)}
          activeOpacity={0.9}
        >
          <Text style={styles.toastText}>{t.message}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Multi-select action bar */
function MultiSelectBar({
  count,
  onDelete,
  onMoveTrack,
  onClear,
}: {
  count: number;
  onDelete: () => void;
  onMoveTrack: (track: number) => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.multiSelectBar}>
      <View style={styles.multiSelectLeft}>
        <TouchableOpacity onPress={onClear} style={styles.multiSelectBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={Cancel01Icon} size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.multiSelectCount}>{count} selected</Text>
      </View>
      <View style={styles.multiSelectActions}>
        <TouchableOpacity onPress={() => onMoveTrack(0)} style={styles.multiSelectBtn} activeOpacity={0.7}>
          <Text style={styles.multiSelectActionText}>V1</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onMoveTrack(1)} style={styles.multiSelectBtn} activeOpacity={0.7}>
          <Text style={styles.multiSelectActionText}>V2</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={[styles.multiSelectBtn, styles.multiSelectDeleteBtn]} activeOpacity={0.7}>
          <HugeiconsIcon icon={Delete01Icon} size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EditorTopBar({
  project, onBack, onExport, onUndo, onRedo, canUndo, canRedo, onInspector, inspectorOpen, showSaved, onRename,
}: {
  project: Project;
  onBack: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onInspector: () => void;
  inspectorOpen: boolean;
  showSaved: boolean;
  onRename?: (name: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(project.name);
  const typeIcon = project.type === 'audio' ? MusicNote01Icon :
    project.type === 'photo' ? Image01Icon : Film01Icon;

  function submitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== project.name) onRename?.(trimmed);
    setEditing(false);
  }

  return (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onBack} style={styles.topBarBtn} activeOpacity={0.7}>
        <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.topBarCenter}>
        <HugeiconsIcon icon={typeIcon} size={14} color={colors.textMuted} />
        {editing ? (
          <TextInput
            style={styles.topBarRenameInput}
            value={draft}
            onChangeText={setDraft}
            onBlur={submitRename}
            onSubmitEditing={submitRename}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            maxLength={60}
          />
        ) : (
          <TouchableOpacity onPress={() => { setDraft(project.name); setEditing(true); }} activeOpacity={0.7}>
            <Text style={styles.topBarTitle} numberOfLines={1}>{project.name}</Text>
          </TouchableOpacity>
        )}
        {showSaved && !editing && (
          <View style={styles.savedBadge}>
            <Text style={styles.savedBadgeText}>✓ Saved</Text>
          </View>
        )}
      </View>

      <View style={styles.topBarRight}>
        <TouchableOpacity
          onPress={onUndo}
          style={[styles.topBarBtn, !canUndo && styles.topBarBtnDisabled]}
          disabled={!canUndo}
          activeOpacity={0.7}
        >
          <HugeiconsIcon icon={UndoIcon} size={18} color={canUndo ? colors.textPrimary : colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRedo}
          style={[styles.topBarBtn, !canRedo && styles.topBarBtnDisabled]}
          disabled={!canRedo}
          activeOpacity={0.7}
        >
          <HugeiconsIcon icon={RedoIcon} size={18} color={canRedo ? colors.textPrimary : colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onInspector}
          style={[styles.topBarBtn, inspectorOpen && styles.topBarBtnActive]}
          activeOpacity={0.7}
        >
          <HugeiconsIcon icon={Settings01Icon} size={18} color={inspectorOpen ? colors.accent : colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onExport} style={styles.exportBtn} activeOpacity={0.8}>
          <HugeiconsIcon icon={Share01Icon} size={16} color={colors.bg} />
          <Text style={styles.exportBtnText}>Export</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingText: { color: colors.textSecondary, fontSize: typography.base },
  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  topBarCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: spacing[2],
  },
  topBarTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  topBarRenameInput: {
    fontSize: typography.base,
    fontWeight: typography.semibold as any,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    minWidth: 80,
    maxWidth: 160,
    paddingVertical: 1,
    paddingHorizontal: 2,
  },
  savedBadge: {
    backgroundColor: 'rgba(52,199,89,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.3)',
  },
  savedBadgeText: {
    fontSize: 11,
    color: '#34C759',
    fontWeight: '600' as const,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  topBarBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  topBarBtnDisabled: { opacity: 0.35 },
  topBarBtnActive: { backgroundColor: colors.accentMuted },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    gap: 4,
    marginLeft: spacing[1],
  },
  exportBtnText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.bg,
  },
  previewWrapper: {
    width: '100%',
    backgroundColor: '#000',
  },
  previewWrapperVideo: {
    aspectRatio: 16 / 9,  // fallback only — runtime uses getProjectAspectRatio()
  },
  previewWrapperPhoto: {
    height: 240,
    backgroundColor: '#000',
  },
  previewWrapperAudio: {
    height: 140,
  },
  timelineWrapper: { flex: 1 },
  // Landscape
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg,
  },
  landscapeLeft: {
    flex: 0.55,
    backgroundColor: '#000',
  },
  landscapeRight: {
    flex: 0.45,
    backgroundColor: colors.bgElevated,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  // Toast overlay
  toastContainer: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 6,
    zIndex: 999,
  },
  toast: {
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2] + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 320,
  },
  toastError: {
    borderColor: colors.error,
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  toastSuccess: {
    borderColor: colors.accent,
  },
  toastText: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: typography.medium,
    textAlign: 'center',
  },
  // Multi-select bar
  multiSelectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.surface1,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  multiSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  multiSelectCount: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
  multiSelectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  multiSelectBtn: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  multiSelectDeleteBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  multiSelectActionText: {
    fontSize: typography.xs,
    color: colors.textPrimary,
    fontWeight: typography.semibold,
  },
});
