import { create } from 'zustand';
import { Platform } from 'react-native';
import {
  Clip, TextOverlay, StickerOverlay,
  getClips, updateClips, saveHistory, getHistory,
  getTextOverlays, createTextOverlay as dbCreateTextOverlay,
  updateTextOverlay as dbUpdateTextOverlay,
  deleteTextOverlay as dbDeleteTextOverlay,
  getStickerOverlays, createStickerOverlay as dbCreateSticker,
  updateStickerOverlay as dbUpdateSticker,
  deleteStickerOverlay as dbDeleteSticker,
  DEFAULT_KEN_BURNS,
} from './database';
import { useToastStore } from './toast';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lazy-load expo-haptics to avoid crashing on web
let Haptics: any = null;
if (Platform.OS !== 'web') {
  try { Haptics = require('expo-haptics'); } catch {}
}

const SETTINGS_KEY = 'framestudio_settings_v2';

// Module-level playback interval — stable across Zustand state updates
let _playIntervalId: ReturnType<typeof setInterval> | null = null;

let _hapticsCached: boolean | null = null;
let _hapticsLoadPromise: Promise<boolean> | null = null;

function getHapticsEnabled(): Promise<boolean> {
  if (_hapticsCached !== null) return Promise.resolve(_hapticsCached);
  if (_hapticsLoadPromise) return _hapticsLoadPromise;
  _hapticsLoadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        _hapticsCached = s.haptics !== false;
        return _hapticsCached;
      }
    } catch {}
    _hapticsCached = true;
    return true;
  })();
  _hapticsLoadPromise.finally(() => { _hapticsLoadPromise = null; });
  return _hapticsLoadPromise;
}

/** Call when settings change to bust the cache */
export function invalidateHapticsCache() { _hapticsCached = null; }

async function hapticLight() {
  if (!Haptics) return;
  if (await getHapticsEnabled()) {
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light);
  }
}

async function hapticMedium() {
  if (!Haptics) return;
  if (await getHapticsEnabled()) {
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle?.Medium);
  }
}

async function hapticNotification(type: 'success' | 'error' | 'warning' = 'success') {
  if (!Haptics) return;
  if (await getHapticsEnabled()) {
    const t = type === 'success' ? Haptics.NotificationFeedbackType?.Success
      : type === 'error' ? Haptics.NotificationFeedbackType?.Error
      : Haptics.NotificationFeedbackType?.Warning;
    Haptics.notificationAsync?.(t);
  }
}

// ── Debounced save ──
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingClips: Clip[] | null = null;

function debouncedPersist(clips: Clip[], delay = 300) {
  _pendingClips = clips;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    if (_pendingClips) {
      await updateClips(_pendingClips);
      _pendingClips = null;
    }
  }, delay);
}

async function flushPendingSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  if (_pendingClips) {
    await updateClips(_pendingClips);
    _pendingClips = null;
  }
}

interface UndoFrame {
  clips: Clip[];
  textOverlays: TextOverlay[];
  stickerOverlays: StickerOverlay[];
  label: string;
}

interface ProjectStore {
  projectId: string | null;
  clips: Clip[];
  textOverlays: TextOverlay[];
  stickerOverlays: StickerOverlay[];
  selectedClipId: string | null;
  selectedClipIds: string[]; // multi-select
  currentTime: number; // ms
  isPlaying: boolean;
  activeTool: 'select' | 'cut' | 'crop' | 'speed' | 'transition' | 'text' | 'audio';
  activeInspectorTab: 'clip' | 'color' | 'effects' | 'audio' | 'keyframes';
  zoom: number; // timeline zoom, px per second
  snapEnabled: boolean;
  snapIndicator: { x: number; visible: boolean };

  undoStack: UndoFrame[];
  redoStack: UndoFrame[];
  // Captured "before" state for slider/optimistic edits — ensures undo restores pre-drag value
  pendingUndoClips: Clip[] | null;

  // Load project clips
  loadProject: (projectId: string) => Promise<void>;
  // Save clips to DB + push undo
  saveClips: (clips: Clip[], label?: string) => Promise<void>;
  // Direct update (no undo) — optimistic, debounced persist
  setClips: (clips: Clip[]) => void;
  // Undo/redo
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setSelectedClipId: (id: string | null) => void;
  setCurrentTime: (ms: number) => void;
  setIsPlaying: (v: boolean) => void;
  setActiveTool: (t: ProjectStore['activeTool']) => void;
  setActiveInspectorTab: (t: ProjectStore['activeInspectorTab']) => void;
  setZoom: (z: number) => void;
  setSnapEnabled: (v: boolean) => void;
  setSnapIndicator: (x: number, visible: boolean) => void;

  updateClip: (id: string, updates: Partial<Clip>, label?: string) => Promise<void>;
  // Optimistic update (no undo push, debounced save) — for sliders
  updateClipOptimistic: (id: string, updates: Partial<Clip>) => void;
  // Commit the optimistic update with undo frame
  commitClipUpdate: (id: string, label?: string) => Promise<void>;
  addClip: (clip: Clip) => Promise<void>;
  removeClip: (id: string) => Promise<void>;
  reorderClips: (clips: Clip[]) => Promise<void>;
  splitClip: (id: string, atMs: number) => Promise<void>;
  duplicateClip: (id: string) => Promise<void>;

  // Multi-select
  toggleClipSelection: (id: string) => void;
  clearSelection: () => void;
  batchDeleteClips: () => Promise<void>;
  batchMoveClips: (trackIndex: number) => Promise<void>;

  // Text overlays
  addTextOverlay: (overlay: TextOverlay) => Promise<void>;
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => Promise<void>;
  removeTextOverlay: (id: string) => Promise<void>;

  // Sticker overlays
  addStickerOverlay: (sticker: StickerOverlay) => Promise<void>;
  updateStickerOverlay: (id: string, updates: Partial<StickerOverlay>) => Promise<void>;
  removeStickerOverlay: (id: string) => Promise<void>;

  getSelectedClip: () => Clip | null;
  reset: () => Promise<void>;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projectId: null,
  clips: [],
  textOverlays: [],
  stickerOverlays: [],
  selectedClipId: null,
  selectedClipIds: [],
  currentTime: 0,
  isPlaying: false,
  activeTool: 'select',
  activeInspectorTab: 'clip',
  zoom: 100,
  snapEnabled: true,
  snapIndicator: { x: 0, visible: false },
  undoStack: [],
  redoStack: [],
  pendingUndoClips: null,

  loadProject: async (projectId) => {
    await flushPendingSave();
    const [clips, textOverlays, stickerOverlays, history] = await Promise.all([
      getClips(projectId),
      getTextOverlays(projectId),
      getStickerOverlays(projectId),
      getHistory(projectId),
    ]);
    const undoStack: UndoFrame[] = history
      .map(h => {
        try { 
          const snap = JSON.parse(h.snapshot);
          return { clips: snap.clips || snap, textOverlays: snap.textOverlays || [], stickerOverlays: snap.stickerOverlays || [], label: h.action }; 
        }
        catch { return null; }
      })
      .filter(Boolean) as UndoFrame[];
    set({ projectId, clips, textOverlays, stickerOverlays, undoStack, redoStack: [], selectedClipId: null, selectedClipIds: [], currentTime: 0 });
  },

  saveClips: async (clips, label = 'edit') => {
    const { projectId, undoStack, clips: prevClips, textOverlays: prevText, stickerOverlays: prevStickers } = get();
    if (!projectId) return;
    const newUndoStack = [...undoStack, { clips: prevClips, textOverlays: prevText, stickerOverlays: prevStickers, label }].slice(-50);
    set({ clips, undoStack: newUndoStack, redoStack: [] });
    await updateClips(clips);
    await saveHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      projectId,
      action: label,
      snapshot: JSON.stringify({ clips: prevClips, textOverlays: prevText, stickerOverlays: prevStickers }),
      createdAt: Date.now(),
    });
  },

  setClips: (clips) => {
    set({ clips });
    debouncedPersist(clips);
  },

  undo: async () => {
    const { undoStack, clips, redoStack } = get();
    if (undoStack.length === 0) return;
    const frame = undoStack[undoStack.length - 1];
    const { textOverlays, stickerOverlays } = get();
    const newRedoStack = [{ clips, textOverlays, stickerOverlays, label: 'redo' }, ...redoStack].slice(0, 50);
    const newUndoStack = undoStack.slice(0, -1);
    set({ clips: frame.clips, textOverlays: frame.textOverlays || [], stickerOverlays: frame.stickerOverlays || [], undoStack: newUndoStack, redoStack: newRedoStack });
    await updateClips(frame.clips);
    hapticLight();
    useToastStore.getState().show(`Undo: ${frame.label}`, 'info', 1500);
  },

  redo: async () => {
    const { redoStack, clips, undoStack } = get();
    if (redoStack.length === 0) return;
    const frame = redoStack[0];
    const { textOverlays, stickerOverlays } = get();
    const newUndoStack = [...undoStack, { clips, textOverlays, stickerOverlays, label: 'undo' }].slice(-50);
    set({ clips: frame.clips, textOverlays: frame.textOverlays || [], stickerOverlays: frame.stickerOverlays || [], undoStack: newUndoStack, redoStack: redoStack.slice(1).slice(0, 50) });
    await updateClips(frame.clips);
    hapticLight();
    useToastStore.getState().show('Redo', 'info', 1500);
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  setSelectedClipId: (id) => { set({ selectedClipId: id }); if (id) hapticLight(); },
  setCurrentTime: (ms) => set({ currentTime: ms }),
  setIsPlaying: (v) => {
    if (_playIntervalId !== null) { clearInterval(_playIntervalId); _playIntervalId = null; }
    set({ isPlaying: v });
    if (v) {
      const TICK = 33;
      _playIntervalId = setInterval(() => {
        const { isPlaying: playing, currentTime: t, clips } = get();
        if (!playing) { clearInterval(_playIntervalId!); _playIntervalId = null; return; }
        const totalDuration = Math.max(1000, clips.reduce((max, c) => {
          const effectiveDuration = (c.duration - c.trimStart - c.trimEnd) / Math.max(0.01, c.speed);
          return Math.max(max, c.startTime + effectiveDuration);
        }, 0));

        // Speed ramp: apply ease curves to the playback advancement rate
        const activeClip = clips
          .filter(c => c.trackIndex === 0)
          .find(c => {
            const effDur = (c.duration - c.trimStart - c.trimEnd) / Math.max(0.01, c.speed);
            return t >= c.startTime && t < c.startTime + effDur;
          });

        if (activeClip?.speedRampCurve && activeClip.speedRampCurve !== 'constant') {
          const effDur = (activeClip.duration - activeClip.trimStart - activeClip.trimEnd) / Math.max(0.01, activeClip.speed);
          const localT = Math.max(0, Math.min(1, (t - activeClip.startTime) / Math.max(1, effDur)));

          if (activeClip.speedRampCurve === 'freeze') {
            // Hold at midpoint — freeze on that frame
            const midpoint = activeClip.startTime + effDur / 2;
            if (t >= midpoint) {
              set({ currentTime: midpoint });
              return;
            }
          } else {
            // Ease curves: adjust how fast currentTime advances within this clip.
            // Each curve remaps localT so the effective speed varies:
            // - ease_in:  slow start → fast end
            // - ease_out: fast start → slow end
            // - ease_in_out: slow → fast → slow
            let speedMultiplier = 1;
            if (activeClip.speedRampCurve === 'ease_in') {
              speedMultiplier = 0.3 + 1.4 * localT; // 0.3x at start → 1.7x at end (avg ≈ 1)
            } else if (activeClip.speedRampCurve === 'ease_out') {
              speedMultiplier = 1.7 - 1.4 * localT; // 1.7x at start → 0.3x at end
            } else if (activeClip.speedRampCurve === 'ease_in_out') {
              // Gaussian-shaped bell: slow at both ends, fast in middle
              speedMultiplier = 0.2 + 1.6 * Math.sin(localT * Math.PI);
            }
            const next = t + TICK * speedMultiplier;
            if (next >= totalDuration) {
              clearInterval(_playIntervalId!); _playIntervalId = null;
              set({ currentTime: totalDuration, isPlaying: false });
            } else {
              set({ currentTime: next });
            }
            return;
          }
        }

        const next = t + TICK;
        if (next >= totalDuration) {
          clearInterval(_playIntervalId!); _playIntervalId = null;
          set({ currentTime: totalDuration, isPlaying: false });
        } else {
          set({ currentTime: next });
        }
      }, TICK);
    }
  },
  setActiveTool: (t) => set({ activeTool: t }),
  setActiveInspectorTab: (t) => set({ activeInspectorTab: t }),
  setZoom: (z) => set({ zoom: Math.max(20, Math.min(500, z)) }),
  setSnapEnabled: (v) => set({ snapEnabled: v }),
  setSnapIndicator: (x, visible) => set({ snapIndicator: { x, visible } }),

  updateClip: async (id, updates, label = 'edit') => {
    const { clips } = get();
    const newClips = clips.map(c => c.id === id ? { ...c, ...updates } : c);
    await get().saveClips(newClips, label);
    hapticLight();
  },

  updateClipOptimistic: (id, updates) => {
    const { clips, pendingUndoClips } = get();
    // Capture the pre-edit state once (on first optimistic update in a drag sequence)
    const newPendingUndoClips = pendingUndoClips ?? clips;
    const newClips = clips.map(c => c.id === id ? { ...c, ...updates } : c);
    set({ clips: newClips, pendingUndoClips: newPendingUndoClips });
    debouncedPersist(newClips, 500);
  },

  commitClipUpdate: async (id, label = 'edit') => {
    await flushPendingSave();
    const { clips, undoStack, pendingUndoClips, projectId } = get();
    // Push pre-drag snapshot as undo frame so undo actually restores the previous value
    const beforeClips = pendingUndoClips ?? clips;
    const { textOverlays, stickerOverlays } = get();
    const newUndoStack = [...undoStack, { clips: beforeClips, textOverlays, stickerOverlays, label }].slice(-50);
    set({ undoStack: newUndoStack, redoStack: [], pendingUndoClips: null });
    if (projectId) {
      await saveHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        projectId,
        action: label,
        snapshot: JSON.stringify({ clips: beforeClips, textOverlays: get().textOverlays, stickerOverlays: get().stickerOverlays }),
        createdAt: Date.now(),
      });
    }
  },

  addClip: async (clip) => {
    const { clips } = get();
    const newClips = [...clips, clip];
    await get().saveClips(newClips, 'add clip');
    hapticMedium();
  },

  removeClip: async (id) => {
    const { clips } = get();
    const newClips = clips.filter(c => c.id !== id);
    await get().saveClips(newClips, 'remove clip');
    hapticNotification('warning');
  },

  reorderClips: async (clips) => {
    await get().saveClips(clips, 'reorder');
    hapticLight();
  },

  splitClip: async (id, atMs) => {
    const { clips } = get();
    const clip = clips.find(c => c.id === id);
    if (!clip) return;

    const clipRelativeTimeline = atMs - clip.startTime;           // ms on timeline
    const clipRelative = clipRelativeTimeline * clip.speed;        // ms in source media
    if (clipRelative <= 0 || clipRelative >= clip.duration - clip.trimStart - clip.trimEnd) return;

    const partA: Clip = {
      ...clip,
      id: `${clip.id}_a_${Date.now()}`,
      duration: clip.duration,
      trimEnd: clip.duration - clip.trimStart - clipRelative,
      kenBurns: { ...DEFAULT_KEN_BURNS },
    };
    const partB: Clip = {
      ...clip,
      id: `${clip.id}_b_${Date.now()}`,
      startTime: clip.startTime + clipRelativeTimeline,
      trimStart: clip.trimStart + clipRelative,
      trimEnd: clip.trimEnd,
      duration: clip.duration,
      orderIndex: clip.orderIndex + 0.5,
      kenBurns: { ...DEFAULT_KEN_BURNS },
    };

    const newClips = clips.filter(c => c.id !== id);
    newClips.push(partA, partB);
    newClips.sort((a, b) => a.startTime - b.startTime);

    await get().saveClips(newClips, 'split clip');
    set({ selectedClipId: partA.id });
    hapticMedium();
    useToastStore.getState().show('Clip split', 'success', 1500);
  },

  duplicateClip: async (id) => {
    const { clips } = get();
    const clip = clips.find(c => c.id === id);
    if (!clip) return;

    const effectiveDuration = (clip.duration - clip.trimStart - clip.trimEnd) / Math.max(0.01, clip.speed);
    const duplicate: Clip = {
      ...clip,
      id: `${clip.id}_dup_${Date.now()}`,
      startTime: clip.startTime + effectiveDuration,
      orderIndex: clip.orderIndex + 1,
    };

    const newClips = [...clips, duplicate];
    await get().saveClips(newClips, 'duplicate clip');
    set({ selectedClipId: duplicate.id });
    hapticMedium();
    useToastStore.getState().show('Clip duplicated', 'success', 1500);
  },

  // Multi-select
  toggleClipSelection: (id) => {
    set(s => {
      const has = s.selectedClipIds.includes(id);
      return {
        selectedClipIds: has
          ? s.selectedClipIds.filter(x => x !== id)
          : [...s.selectedClipIds, id],
      };
    });
  },

  clearSelection: () => set({ selectedClipIds: [] }),

  batchDeleteClips: async () => {
    const { clips, selectedClipIds } = get();
    if (selectedClipIds.length === 0) return;
    const count = selectedClipIds.length;
    const newClips = clips.filter(c => !selectedClipIds.includes(c.id));
    set({ selectedClipIds: [], selectedClipId: null });
    await get().saveClips(newClips, `delete ${count} clips`);
    hapticNotification('warning');
    useToastStore.getState().show(`Deleted ${count} clip${count > 1 ? 's' : ''}`, 'success', 2000);
  },

  batchMoveClips: async (trackIndex) => {
    const { clips, selectedClipIds } = get();
    if (selectedClipIds.length === 0) return;
    const count = selectedClipIds.length;
    const newClips = clips.map(c =>
      selectedClipIds.includes(c.id) ? { ...c, trackIndex } : c
    );
    set({ selectedClipIds: [] });
    await get().saveClips(newClips, `move ${count} clips to track ${trackIndex}`);
    hapticLight();
    useToastStore.getState().show(`Moved ${count} clip${count > 1 ? 's' : ''} to track`, 'success', 2000);
  },

  // Text overlays
  addTextOverlay: async (overlay) => {
    await dbCreateTextOverlay(overlay);
    set(s => ({ textOverlays: [...s.textOverlays, overlay] }));
  },

  updateTextOverlay: async (id, updates) => {
    await dbUpdateTextOverlay(id, updates);
    set(s => ({
      textOverlays: s.textOverlays.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  },

  removeTextOverlay: async (id) => {
    await dbDeleteTextOverlay(id);
    set(s => ({ textOverlays: s.textOverlays.filter(t => t.id !== id) }));
  },

  addStickerOverlay: async (sticker) => {
    await dbCreateSticker(sticker);
    set(s => ({ stickerOverlays: [...s.stickerOverlays, sticker] }));
  },
  updateStickerOverlay: async (id, updates) => {
    await dbUpdateSticker(id, updates);
    set(s => ({
      stickerOverlays: s.stickerOverlays.map(s2 => s2.id === id ? { ...s2, ...updates } : s2),
    }));
  },
  removeStickerOverlay: async (id) => {
    await dbDeleteSticker(id);
    set(s => ({ stickerOverlays: s.stickerOverlays.filter(s2 => s2.id !== id) }));
  },

  getSelectedClip: () => {
    const { clips, selectedClipId } = get();
    return clips.find(c => c.id === selectedClipId) || null;
  },

  reset: async () => {
    if (_playIntervalId !== null) { clearInterval(_playIntervalId); _playIntervalId = null; }
    await flushPendingSave();
    set({
      projectId: null,
      clips: [],
      textOverlays: [],
      stickerOverlays: [],
      selectedClipId: null,
      selectedClipIds: [],
      currentTime: 0,
      isPlaying: false,
      activeTool: 'select',
      activeInspectorTab: 'clip',
      zoom: 100,
      snapEnabled: true,
      snapIndicator: { x: 0, visible: false },
      undoStack: [],
      redoStack: [],
      pendingUndoClips: null,
    });
  },
}));
