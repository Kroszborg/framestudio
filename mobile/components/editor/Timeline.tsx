import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  GestureResponderEvent,
  PanResponder,
  Animated,
  Platform,
  UIManager,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  PlayIcon, PauseIcon, PreviousIcon, NextIcon,
  Remove01Icon, Add01Icon,
  Film01Icon, Layers01Icon, MusicNote01Icon,
  Magnet01Icon, AudioWave01Icon, MusicNote02Icon,
} from '@hugeicons/core-free-icons';
import { useProjectStore } from '../../lib/projectStore';
import { Clip, TextOverlay, StickerOverlay } from '../../lib/database';
import { colors, typography, spacing, radius } from '../../lib/theme';

// Video thumbnails — native only
let getThumbnailAsync: ((uri: string, opts?: { time?: number; quality?: number }) => Promise<{ uri: string; width: number; height: number }>) | null = null;
if (Platform.OS !== 'web') {
  try {
    getThumbnailAsync = require('expo-video-thumbnails').getThumbnailAsync;
  } catch {}
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TRACK_HEIGHT = 52;
const TRACK_LABEL_W = 52;
const HANDLE_HIT_W = 20;
const TRANSITION_MARKER_W = 12;
const SNAP_THRESHOLD_PX = 8;

interface TimelineProps {
  projectId: string;
}

function TransitionMarker({ type }: { type: string }) {
  if (type === 'none') return null;
  const labelMap: Record<string, string> = {
    fade: 'F', dissolve: 'D', slide_left: 'SL', slide_right: 'SR',
    slide_up: 'SU', slide_down: 'SD', zoom_in: 'ZI', zoom_out: 'ZO',
    zoom: 'Z', wipe: 'W', shake: 'SH', roll: 'R', bounce: 'B', 
    glitch: 'G', pixelate: 'PX', barn_door: 'BD', flip: 'FL', 
    whip_pan: 'WP', cube: 'C', cross_zoom: 'CZ', flash: 'F!',
    color_wipe: 'CW', push_left: 'PL', push_right: 'PR', circle_wipe: 'CW!'
  };
  const label = labelMap[type] || '?';
  return (
    <View style={styles.transitionMarker}>
      <Text style={styles.transitionMarkerText}>{label}</Text>
    </View>
  );
}

/** Mini waveform bars for audio clips — uses real waveform data when available */
function MiniWaveform({ width: w, clipUri }: { width: number; clipUri?: string }) {
  const barCount = Math.max(4, Math.min(60, Math.floor(w / 4)));
  const [amplitudes, setAmplitudes] = useState<number[] | null>(null);

  useEffect(() => {
    if (!clipUri) return;
    let cancelled = false;
    // Lazy import to avoid circular deps
    import('../../lib/audioWaveform').then(({ getWaveform }) => {
      getWaveform(clipUri, barCount).then(data => {
        if (!cancelled) setAmplitudes(data);
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [clipUri, barCount]);

  return (
    <View style={styles.waveformContainer}>
      {Array.from({ length: barCount }).map((_, i) => {
        const amplitude = amplitudes ? amplitudes[i] ?? 0.3 : 0.3;
        const h = 3 + amplitude * 17; // Scale 0-1 to 3-20px
        return <View key={i} style={[styles.waveformBarMini, { height: Math.max(3, h) }]} />;
      })}
    </View>
  );
}

/** Thumbnail strip for video/image clips — uses real thumbnails on native */
function ThumbnailStrip({ clip, width: w }: { clip: Clip; width: number }) {
  const thumbCount = Math.max(1, Math.min(8, Math.floor(w / 24)));
  const isAudio = clip.type === 'audio';
  if (isAudio) return <MiniWaveform width={w} clipUri={clip.uri} />;

  // For images, show the actual image repeated
  if (clip.type === 'image') {
    return (
      <View style={styles.thumbnailStrip}>
        {Array.from({ length: thumbCount }).map((_, i) => (
          <Image
            key={i}
            source={{ uri: clip.uri }}
            style={styles.thumbImage}
            resizeMode="cover"
          />
        ))}
      </View>
    );
  }

  // For video: generate real thumbnails on native
  return <VideoThumbnailStrip clip={clip} thumbCount={thumbCount} />;
}

/** Generates real video frame thumbnails using expo-video-thumbnails */
function VideoThumbnailStrip({ clip, thumbCount }: { clip: Clip; thumbCount: number }) {
  const [thumbUris, setThumbUris] = useState<(string | null)[]>(() =>
    Array(thumbCount).fill(null)
  );

  useEffect(() => {
    if (!getThumbnailAsync || clip.type !== 'video') return;
    let cancelled = false;

    const effectiveDuration = clip.duration - clip.trimStart - clip.trimEnd;
    const promises = Array.from({ length: thumbCount }).map(async (_, i) => {
      const timeMs = clip.trimStart + (effectiveDuration / thumbCount) * (i + 0.5);
      try {
        const result = await getThumbnailAsync!(clip.uri, {
          time: timeMs,
          quality: 0.2,
        });
        return result.uri;
      } catch {
        return null;
      }
    });

    Promise.all(promises).then(uris => {
      if (!cancelled) setThumbUris(uris);
    });

    return () => { cancelled = true; };
  }, [clip.uri, clip.trimStart, clip.trimEnd, clip.duration, thumbCount]);

  return (
    <View style={styles.thumbnailStrip}>
      {thumbUris.map((uri, i) => (
        uri ? (
          <Image key={i} source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <View
            key={i}
            style={[styles.thumbBlock, {
              backgroundColor: i % 2 === 0 ? colors.surface2 : colors.surface3,
              opacity: 0.4,
            }]}
          />
        )
      ))}
    </View>
  );
}

/** J/L cut indicator: shows when audio extends beyond video trim */
function JLCutIndicator({ clip, pxPerSec }: { clip: Clip; pxPerSec: number }) {
  if (clip.type === 'audio') return null;
  const hasJCut = clip.trimEnd > 0 && clip.volume > 0;
  const hasLCut = clip.trimStart > 0 && clip.volume > 0;
  if (!hasJCut && !hasLCut) return null;
  return (
    <View style={styles.jlIndicator}>
      {hasLCut && <View style={[styles.jlDot, styles.jlDotLeft]} />}
      {hasJCut && <View style={[styles.jlDot, styles.jlDotRight]} />}
    </View>
  );
}

function ClipBlock({
  clip,
  pxPerSec,
  isMultiSelected,
  onLongPressDrag,
}: {
  clip: Clip;
  pxPerSec: number;
  isMultiSelected: boolean;
  onLongPressDrag: (clipId: string) => void;
}) {
  const {
    selectedClipId, setSelectedClipId, activeTool, removeClip, updateClip,
    toggleClipSelection, selectedClipIds,
  } = useProjectStore();
  const isSelected = selectedClipId === clip.id;
  const isInMultiSelectMode = selectedClipIds.length > 0;
  const effectiveDuration = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed;
  const w = Math.max(32, (effectiveDuration / 1000) * pxPerSec);
  const x = (clip.startTime / 1000) * pxPerSec;

  const trackColors: Record<number, { bg: string; border: string }> = {
    0: { bg: colors.clipTrack1, border: colors.clipTrack1Border },
    1: { bg: colors.clipTrack2, border: colors.clipTrack2Border },
    2: { bg: colors.audioTrack, border: colors.audioTrackBorder },
  };
  const tc = trackColors[clip.trackIndex] || trackColors[0];

  const trimStartRef = useRef(0);
  const trimEndRef = useRef(0);

  const leftPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const currentClip = useProjectStore.getState().clips.find(c => c.id === clip.id);
        trimStartRef.current = currentClip?.trimStart ?? clip.trimStart;
      },
      onPanResponderMove: (_, gs) => {
        const deltaMs = (gs.dx / pxPerSec) * 1000;
        const currentClip = useProjectStore.getState().clips.find(c => c.id === clip.id);
        const cTrimEnd = currentClip?.trimEnd ?? clip.trimEnd;
        const cDuration = currentClip?.duration ?? clip.duration;
        const newTrimStart = Math.max(0, Math.min(cDuration - cTrimEnd - 100, trimStartRef.current + deltaMs));
        useProjectStore.getState().setClips(
          useProjectStore.getState().clips.map(c =>
            c.id === clip.id ? { ...c, trimStart: newTrimStart } : c
          )
        );
      },
      onPanResponderRelease: () => {
        const current = useProjectStore.getState().clips.find(c => c.id === clip.id);
        if (current) updateClip(clip.id, { trimStart: current.trimStart }, 'trim start');
      },
    })
  ).current;

  const rightPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const currentClip = useProjectStore.getState().clips.find(c => c.id === clip.id);
        trimEndRef.current = currentClip?.trimEnd ?? clip.trimEnd;
      },
      onPanResponderMove: (_, gs) => {
        const deltaMs = (-gs.dx / pxPerSec) * 1000;
        const currentClip = useProjectStore.getState().clips.find(c => c.id === clip.id);
        const cTrimStart = currentClip?.trimStart ?? clip.trimStart;
        const cDuration = currentClip?.duration ?? clip.duration;
        const newTrimEnd = Math.max(0, Math.min(cDuration - cTrimStart - 100, trimEndRef.current + deltaMs));
        useProjectStore.getState().setClips(
          useProjectStore.getState().clips.map(c =>
            c.id === clip.id ? { ...c, trimEnd: newTrimEnd } : c
          )
        );
      },
      onPanResponderRelease: () => {
        const current = useProjectStore.getState().clips.find(c => c.id === clip.id);
        if (current) updateClip(clip.id, { trimEnd: current.trimEnd }, 'trim end');
      },
    })
  ).current;

  const borderColor = isMultiSelected
    ? colors.textPrimary
    : isSelected
    ? colors.accent
    : tc.border;

  return (
    <View style={[styles.clipBlockOuter, { left: x, width: w }]}>
      <TouchableOpacity
        style={[
          styles.clipBlock,
          {
            backgroundColor: tc.bg,
            borderColor,
            borderWidth: isMultiSelected ? 2 : isSelected ? 2 : 1,
          },
        ]}
        onPress={() => {
          if (isInMultiSelectMode) {
            toggleClipSelection(clip.id);
          } else {
            setSelectedClipId(isSelected ? null : clip.id);
          }
        }}
        onLongPress={() => {
          if (activeTool === 'cut') {
            removeClip(clip.id);
          } else {
            if (!isInMultiSelectMode) toggleClipSelection(clip.id);
            onLongPressDrag(clip.id);
          }
        }}
        delayLongPress={300}
        activeOpacity={0.8}
      >
        {/* Thumbnail strip / waveform */}
        <ThumbnailStrip clip={clip} width={w} />

        {/* Multi-select indicator */}
        {isMultiSelected && <View style={styles.multiSelectDot} />}

        <View style={styles.clipLabelRow}>
          <Text style={styles.clipLabel} numberOfLines={1}>{clip.name}</Text>
        </View>

        {clip.speed !== 1 && (
          <View style={styles.speedBadge}>
            <Text style={styles.speedText}>{clip.speed}x</Text>
          </View>
        )}
        {(clip.trimStart > 0 || clip.trimEnd > 0) && (
          <View style={styles.trimBadge}>
            <Text style={styles.trimBadgeText}>T</Text>
          </View>
        )}
        {clip.motionBlur && (
          <View style={[styles.trimBadge, { right: 36 }]}>
            <Text style={styles.trimBadgeText}>MB</Text>
          </View>
        )}
        {clip.reverse && (
          <View style={[styles.trimBadge, { right: 54 }]}>
            <Text style={styles.trimBadgeText}>↩</Text>
          </View>
        )}
        {((clip.fadeIn ?? 0) > 0 || (clip.fadeOut ?? 0) > 0) && (
          <View style={[styles.trimBadge, { right: clip.reverse ? 72 : 54 }]}>
            <Text style={styles.trimBadgeText}>~</Text>
          </View>
        )}
        {/* J/L cut indicators */}
        <JLCutIndicator clip={clip} pxPerSec={pxPerSec} />
      </TouchableOpacity>

      {/* Transition marker — outside overflow:hidden so it's visible at the right edge */}
      {clip.transitionType && clip.transitionType !== 'none' && (
        <TransitionMarker type={clip.transitionType} />
      )}

      {isSelected && !isInMultiSelectMode && (
        <>
          <View {...leftPan.panHandlers} style={styles.handleTouchLeft}>
            <View style={[styles.handle, styles.handleLeft]} />
          </View>
          <View {...rightPan.panHandlers} style={styles.handleTouchRight}>
            <View style={[styles.handle, styles.handleRight]} />
          </View>
        </>
      )}
    </View>
  );
}

function Playhead({ currentTime, pxPerSec }: { currentTime: number; pxPerSec: number }) {
  const x = TRACK_LABEL_W + (currentTime / 1000) * pxPerSec;
  return (
    <View style={[styles.playhead, { left: x }]} pointerEvents="none">
      <View style={styles.playheadHead} />
      <View style={styles.playheadLine} />
    </View>
  );
}

/** Magnetic snap indicator line */
function SnapIndicatorLine({ x, visible }: { x: number; visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={[styles.snapLine, { left: TRACK_LABEL_W + x }]} pointerEvents="none">
      <View style={styles.snapLineInner} />
    </View>
  );
}

function TimeRuler({ duration, pxPerSec }: { duration: number; pxPerSec: number }) {
  const totalSec = Math.ceil(duration / 1000) + 2;
  const step = pxPerSec >= 200 ? 0.5 : pxPerSec >= 100 ? 1 : pxPerSec >= 50 ? 2 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= totalSec; t += step) ticks.push(t);

  return (
    <View style={[styles.ruler, { width: totalSec * pxPerSec + TRACK_LABEL_W + 40 }]}>
      <View style={{ width: TRACK_LABEL_W }} />
      {ticks.map(t => (
        <View key={t} style={[styles.tick, { left: TRACK_LABEL_W + t * pxPerSec }]}>
          {t % 1 === 0 && <Text style={styles.tickLabel}>{formatTime(t)}</Text>}
        </View>
      ))}
    </View>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const TRACKS = [
  { index: 0, label: 'V1', icon: Film01Icon },
  { index: 1, label: 'V2', icon: Layers01Icon },
  { index: 2, label: 'A1', icon: MusicNote01Icon },
];

/** Draggable + resizable block for a text or sticker overlay in the timeline */
function OverlayBlock({
  id, startTime, duration, label, color, onDragEnd, onResizeEnd, onPress,
}: {
  id: string; startTime: number; duration: number; label: string;
  color: string;
  onDragEnd: (id: string, newStartTime: number) => void;
  onResizeEnd: (id: string, newDuration: number) => void;
  onPress?: () => void;
}) {
  // Always read fresh zoom + totalDuration from store to avoid stale closures
  const startRef = useRef(startTime);
  const durRef = useRef(0);

  // Keep refs in sync with props
  useEffect(() => { startRef.current = startTime; }, [startTime]);

  const { zoom: pxPerSec, clips } = useProjectStore();
  const totalDuration = Math.max(1000, clips.reduce((max, c) => {
    const eff = (c.duration - c.trimStart - c.trimEnd) / Math.max(0.01, c.speed);
    return Math.max(max, c.startTime + eff);
  }, 0));

  const effDur = duration > 0 ? duration : totalDuration;
  // No + TRACK_LABEL_W — trackArea already starts after the label
  const left = (startTime / 1000) * pxPerSec;
  const width = Math.max(40, (effDur / 1000) * pxPerSec);

  const dragOffsetX = useRef(new Animated.Value(0)).current;
  const dragWidth = useRef(new Animated.Value(0)).current;

  const bodyPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4,
      onPanResponderGrant: () => { dragOffsetX.setValue(0); },
      onPanResponderMove: Animated.event(
        [null, { dx: dragOffsetX }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gs) => {
        dragOffsetX.setValue(0);
        const zoom = useProjectStore.getState().zoom;
        const deltaMs = (gs.dx / zoom) * 1000;
        const newStart = Math.max(0, startRef.current + deltaMs);
        onDragEnd(id, Math.round(newStart));
      },
    })
  ).current;

  const resizePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { durRef.current = effDur; dragWidth.setValue(0); },
      onPanResponderMove: Animated.event(
        [null, { dx: dragWidth }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gs) => {
        dragWidth.setValue(0);
        const zoom = useProjectStore.getState().zoom;
        const deltaMs = (gs.dx / zoom) * 1000;
        const newDur = Math.max(500, durRef.current + deltaMs);
        onResizeEnd(id, Math.round(newDur));
      },
    })
  ).current;

  return (
    <Animated.View
      style={{
        position: 'absolute', left, top: 4, height: TRACK_HEIGHT - 8,
        width: Animated.add(new Animated.Value(width), dragWidth),
        transform: [{ translateX: dragOffsetX }],
        zIndex: 10
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={{
          flex: 1, backgroundColor: color, borderRadius: 4, flexDirection: 'row',
          overflow: 'hidden', alignItems: 'center',
        }}
      >
        {/* Drag body */}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 4 }} {...bodyPan.panHandlers}>
          <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }} numberOfLines={1}>{label}</Text>
        </View>
        {/* Right edge resize handle */}
        <View
          style={{ width: 8, height: '100%', backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}
          {...resizePan.panHandlers}
        >
          <View style={{ width: 2, height: 14, backgroundColor: '#fff', borderRadius: 1 }} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function Timeline({ projectId }: TimelineProps) {
  const router = useRouter();
  const {
    clips, currentTime, zoom, setCurrentTime, setZoom,
    isPlaying, setIsPlaying, selectedClipIds, reorderClips,
    snapEnabled, setSnapEnabled, snapIndicator, setSnapIndicator,
    textOverlays, stickerOverlays, updateTextOverlay, updateStickerOverlay,
  } = useProjectStore();

  const lastPinchScale = useRef(1);
  const pinchBaseZoom = useRef(zoom);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);

  // ── Beat sync state ──────────────────────────────────────────────────────
  const [bpm, setBpm] = useState<number | null>(null);
  const [beatSyncActive, setBeatSyncActive] = useState(false);
  const tapTimestamps = useRef<number[]>([]);

  function handleBpmTap() {
    const now = Date.now();
    const taps = [...tapTimestamps.current, now].filter(t => now - t < 5000); // keep last 5s
    tapTimestamps.current = taps;
    if (taps.length >= 2) {
      // Average interval between consecutive taps
      let totalInterval = 0;
      for (let i = 1; i < taps.length; i++) totalInterval += taps[i] - taps[i - 1];
      const avgInterval = totalInterval / (taps.length - 1);
      const detectedBpm = Math.round(60000 / avgInterval);
      if (detectedBpm >= 40 && detectedBpm <= 240) {
        setBpm(detectedBpm);
      }
    } else {
      setBpm(null);
    }
  }

  function handleBeatSnap() {
    if (!bpm) return;
    const beatMs = 60000 / bpm;
    const store = useProjectStore.getState();
    const snapped = store.clips.map(c => ({
      ...c,
      startTime: Math.round(c.startTime / beatMs) * beatMs,
    }));
    reorderClips(snapped);
    setBeatSyncActive(false);
  }

  function resetBpm() {
    setBpm(null);
    setBeatSyncActive(false);
    tapTimestamps.current = [];
  }
  const dragOffsetX = useRef(new Animated.Value(0)).current;
  const dragOffsetY = useRef(new Animated.Value(0)).current;

  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!draggingClipId,
      onMoveShouldSetPanResponder: (_, gs) => {
        return !!draggingClipId && (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5);
      },
      onPanResponderMove: (_, gs) => {
        dragOffsetX.setValue(gs.dx);
        dragOffsetY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (draggingClipId) {
          const store = useProjectStore.getState();
          const clip = store.clips.find(c => c.id === draggingClipId);
          if (clip) {
            const pxPerSec = store.zoom;
            const deltaTimeMs = (gs.dx / pxPerSec) * 1000;
            let newStartTime = Math.max(0, clip.startTime + deltaTimeMs);

            // Magnetic snapping
            if (store.snapEnabled) {
              const SNAP_THRESHOLD_MS = Math.min((SNAP_THRESHOLD_PX / pxPerSec) * 1000, 200);
              const snapTargets: number[] = [0, store.currentTime];
              store.clips.forEach(c => {
                if (c.id === draggingClipId) return;
                snapTargets.push(c.startTime);
                const effDur = (c.duration - c.trimStart - c.trimEnd) / c.speed;
                snapTargets.push(c.startTime + effDur);
              });
              for (const target of snapTargets) {
                if (Math.abs(newStartTime - target) < SNAP_THRESHOLD_MS) {
                  newStartTime = target;
                  setSnapIndicator((target / 1000) * pxPerSec, true);
                  setTimeout(() => setSnapIndicator(0, false), 400);
                  break;
                }
              }
            }

            const trackDelta = Math.round(gs.dy / TRACK_HEIGHT);
            const newTrack = Math.max(0, Math.min(2, clip.trackIndex + trackDelta));
            const updatedClips = store.clips.map(c =>
              c.id === draggingClipId
                ? { ...c, startTime: newStartTime, trackIndex: newTrack }
                : c
            );
            reorderClips(updatedClips);
          }
        }
        setDraggingClipId(null);
        dragOffsetX.setValue(0);
        dragOffsetY.setValue(0);
      },
    })
  ).current;

  const handleLongPressDrag = useCallback((clipId: string) => {
    setDraggingClipId(clipId);
  }, []);

  const totalDuration = useMemo(() => clips.reduce((max, c) => {
    const effectiveDuration = (c.duration - c.trimStart - c.trimEnd) / c.speed;
    return Math.max(max, c.startTime + effectiveDuration);
  }, 5000), [clips]);

  const pxPerSec = zoom;
  const totalWidth = (totalDuration / 1000) * pxPerSec + TRACK_LABEL_W + 80;

  const handleTouchStart = useCallback((e: any) => {
    if (e.nativeEvent.touches?.length === 2) {
      const t = e.nativeEvent.touches;
      const dist = Math.hypot(t[1].pageX - t[0].pageX, t[1].pageY - t[0].pageY);
      lastPinchScale.current = dist;
      pinchBaseZoom.current = useProjectStore.getState().zoom;
    }
  }, []);

  const handleTouchMove = useCallback((e: any) => {
    if (e.nativeEvent.touches?.length === 2) {
      const t = e.nativeEvent.touches;
      const dist = Math.hypot(t[1].pageX - t[0].pageX, t[1].pageY - t[0].pageY);
      if (lastPinchScale.current > 0) {
        const scale = dist / lastPinchScale.current;
        const newZoom = Math.max(20, Math.min(500, pinchBaseZoom.current * scale));
        setZoom(newZoom);
      }
    }
  }, [setZoom]);

  function handleRulerPress(e: GestureResponderEvent) {
    const x = e.nativeEvent.locationX - TRACK_LABEL_W;
    const t = Math.max(0, (x / pxPerSec) * 1000);
    setCurrentTime(Math.min(t, totalDuration));
  }

  // Ruler pan responder — uses getState() to avoid stale closures on zoom/duration changes
  const rulerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const store = useProjectStore.getState();
        if (store.isPlaying) store.setIsPlaying(false);
        const zoom = store.zoom;
        const dur = Math.max(1000, store.clips.reduce((max, c) => {
          const eff = (c.duration - c.trimStart - c.trimEnd) / Math.max(0.01, c.speed);
          return Math.max(max, c.startTime + eff);
        }, 0));
        const x = e.nativeEvent.locationX - TRACK_LABEL_W;
        store.setCurrentTime(Math.max(0, Math.min((x / zoom) * 1000, dur)));
      },
      onPanResponderMove: (e) => {
        const store = useProjectStore.getState();
        const zoom = store.zoom;
        const dur = Math.max(1000, store.clips.reduce((max, c) => {
          const eff = (c.duration - c.trimStart - c.trimEnd) / Math.max(0.01, c.speed);
          return Math.max(max, c.startTime + eff);
        }, 0));
        const x = e.nativeEvent.locationX - TRACK_LABEL_W;
        store.setCurrentTime(Math.max(0, Math.min((x / zoom) * 1000, dur)));
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Transport controls */}
      <View style={styles.transport}>
        <TouchableOpacity onPress={() => setCurrentTime(0)} style={styles.transportBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <HugeiconsIcon icon={PreviousIcon} size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setIsPlaying(!isPlaying)}
          style={styles.playBtn}
          activeOpacity={0.7}
        >
          <HugeiconsIcon icon={isPlaying ? PauseIcon : PlayIcon} size={18} color={colors.bg} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCurrentTime(totalDuration)} style={styles.transportBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <HugeiconsIcon icon={NextIcon} size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.timeCode}>{formatTime(currentTime / 1000)}</Text>
        <View style={styles.spacer} />
        {/* Snap toggle */}
        <TouchableOpacity
          onPress={() => setSnapEnabled(!snapEnabled)}
          style={[styles.transportBtn, snapEnabled && styles.transportBtnActive]}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <HugeiconsIcon icon={Magnet01Icon} size={14} color={snapEnabled ? colors.accent : colors.textMuted} />
        </TouchableOpacity>
        {/* Beat sync — tap to detect BPM */}
        <TouchableOpacity
          onPress={() => {
            if (!beatSyncActive) { setBeatSyncActive(true); resetBpm(); }
            else handleBpmTap();
          }}
          onLongPress={bpm ? handleBeatSnap : undefined}
          style={[styles.transportBtn, beatSyncActive && styles.transportBtnActive]}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {bpm ? (
            <Text style={{ fontSize: 7, color: colors.accent, fontWeight: '800' }}>{bpm}</Text>
          ) : (
            <HugeiconsIcon icon={MusicNote02Icon} size={13} color={beatSyncActive ? colors.accent : colors.textMuted} />
          )}
        </TouchableOpacity>
        {bpm && (
          <TouchableOpacity onPress={handleBeatSnap} style={[styles.transportBtn, styles.transportBtnActive]} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 7, color: colors.accent, fontWeight: '800' }}>SNAP</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setZoom(zoom * 0.75)} style={styles.transportBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <HugeiconsIcon icon={Remove01Icon} size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.zoomLabel}>{Math.round(zoom)}px/s</Text>
        <TouchableOpacity onPress={() => setZoom(zoom * 1.33)} style={styles.transportBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <HugeiconsIcon icon={Add01Icon} size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Track area */}
      <ScrollView
        horizontal
        style={styles.scrollH}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <View style={{ width: totalWidth }}>
          {/* Ruler supports both tap (onPress via pan grant) and drag scrubbing */}
          <View {...rulerPan.panHandlers}>
            <TimeRuler duration={totalDuration} pxPerSec={pxPerSec} />
          </View>

          <ScrollView style={styles.scrollV} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {clips.length === 0 ? (
              <View style={styles.emptyTimeline}>
                <HugeiconsIcon icon={Film01Icon} size={32} color={colors.textMuted} />
                <Text style={styles.emptyTimelineText}>Add media to get started</Text>
              </View>
            ) : (
              <>
                {TRACKS.map(track => {
                  const trackClips = clips.filter(c => c.trackIndex === track.index);
                  return (
                    <View key={track.index} style={styles.trackRow}>
                      <View style={styles.trackLabel}>
                        <HugeiconsIcon icon={track.icon} size={12} color={colors.textMuted} />
                        <Text style={styles.trackLabelText}>{track.label}</Text>
                      </View>
                      <View style={[styles.trackArea, { width: totalWidth - TRACK_LABEL_W }]}>
                        {trackClips.map(clip => (
                          <ClipBlock
                            key={clip.id}
                            clip={clip}
                            pxPerSec={pxPerSec}
                            isMultiSelected={selectedClipIds.includes(clip.id)}
                            onLongPressDrag={handleLongPressDrag}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}

                {/* Text overlay track — shows added text elements so timing can be dragged */}
                {textOverlays.length > 0 && (
                  <View style={styles.trackRow}>
                    <View style={styles.trackLabel}>
                      <Text style={[styles.trackLabelText, { fontSize: 8 }]}>TXT</Text>
                    </View>
                    <View style={[styles.trackArea, { width: totalWidth - TRACK_LABEL_W, position: 'relative' }]}>
                      {textOverlays.map(t => (
                        <OverlayBlock
                          key={t.id}
                          id={t.id}
                          startTime={t.startTime}
                          duration={t.duration}
                          label={t.content || 'Text'}
                          color="#7C3AED"
                          onDragEnd={(id, newStart) => updateTextOverlay(id, { startTime: newStart })}
                          onResizeEnd={(id, newDur) => updateTextOverlay(id, { duration: newDur })}
                          onPress={() => router.push(`/editor/text?overlayId=${t.id}` as Href)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {/* Sticker overlay track */}
                {stickerOverlays.length > 0 && (
                  <View style={styles.trackRow}>
                    <View style={styles.trackLabel}>
                      <Text style={[styles.trackLabelText, { fontSize: 8 }]}>STK</Text>
                    </View>
                    <View style={[styles.trackArea, { width: totalWidth - TRACK_LABEL_W, position: 'relative' }]}>
                      {stickerOverlays.map(s => (
                        <OverlayBlock
                          key={s.id}
                          id={s.id}
                          startTime={s.startTime}
                          duration={s.duration}
                          label="Sticker"
                          color="#D97706"
                          onDragEnd={(id, newStart) => updateStickerOverlay(id, { startTime: newStart })}
                          onResizeEnd={(id, newDur) => updateStickerOverlay(id, { duration: newDur })}
                          onPress={() => router.push(`/editor/sticker?id=${projectId}&time=${Math.round(useProjectStore.getState().currentTime)}` as Href)}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Playhead overlay */}
          <Playhead currentTime={currentTime} pxPerSec={pxPerSec} />

          {/* Snap indicator line */}
          <SnapIndicatorLine x={snapIndicator.x} visible={snapIndicator.visible} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  transport: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing[1] + 2,
  },
  transportBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.surface1,
  },
  transportBtnActive: {
    backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent,
  },
  playBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.accent,
  },
  timeCode: {
    fontSize: typography.sm, color: colors.textSecondary,
    fontVariant: ['tabular-nums'] as any, fontWeight: typography.medium,
    minWidth: 44,
  },
  spacer: { flex: 1 },
  zoomLabel: {
    fontSize: typography.xs, color: colors.textMuted, minWidth: 48, textAlign: 'center',
  },
  scrollH: { flex: 1 },
  scrollV: { flex: 1 },
  ruler: {
    height: 24, backgroundColor: colors.bgElevated,
    flexDirection: 'row', alignItems: 'flex-end',
    borderBottomWidth: 1, borderBottomColor: colors.border, position: 'relative',
  },
  tick: {
    position: 'absolute', bottom: 0, width: 1, height: 8,
    backgroundColor: colors.timeRuler,
  },
  tickLabel: { position: 'absolute', bottom: 10, left: 2, fontSize: 9, color: colors.textMuted },
  trackRow: {
    height: TRACK_HEIGHT, flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  trackLabel: {
    width: TRACK_LABEL_W, alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: colors.bgElevated, borderRightWidth: 1, borderRightColor: colors.border,
  },
  trackLabelText: { fontSize: 10, color: colors.textMuted, fontWeight: typography.semibold },
  trackArea: { flex: 1, height: TRACK_HEIGHT, position: 'relative', backgroundColor: colors.bg },
  // Clip
  clipBlockOuter: { position: 'absolute', height: TRACK_HEIGHT - 8, top: 4 },
  clipBlock: {
    flex: 1, borderRadius: radius.sm, borderWidth: 1,
    overflow: 'hidden', justifyContent: 'flex-end',
  },
  clipLabelRow: {
    paddingHorizontal: 6, paddingBottom: 3,
  },
  clipLabel: { fontSize: 10, color: colors.textPrimary, fontWeight: typography.medium },
  speedBadge: {
    position: 'absolute', top: 2, right: 4,
    backgroundColor: colors.overlay60, paddingHorizontal: 3, borderRadius: 3,
  },
  speedText: { fontSize: 9, color: colors.accentText, fontWeight: typography.semibold },
  trimBadge: {
    position: 'absolute', top: 2, right: 20,
    backgroundColor: colors.overlay60, paddingHorizontal: 3, borderRadius: 3,
  },
  trimBadgeText: { fontSize: 8, color: colors.accentText, fontWeight: typography.bold },
  // Waveform (mini)
  waveformContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    flex: 1, gap: 1, paddingHorizontal: 2, opacity: 0.5,
  },
  waveformBarMini: {
    width: 2, backgroundColor: colors.textMuted, borderRadius: 1, minHeight: 3,
  },
  // Thumbnail strip
  thumbnailStrip: {
    flexDirection: 'row', flex: 1, overflow: 'hidden',
  },
  thumbBlock: { flex: 1, minWidth: 12 },
  thumbImage: { flex: 1, minWidth: 12, height: '100%' },
  // J/L cut indicators
  jlIndicator: {
    position: 'absolute', bottom: 1, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2,
  },
  jlDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: colors.accent, opacity: 0.6,
  },
  jlDotLeft: {},
  jlDotRight: {},
  // Transition markers
  transitionMarker: {
    position: 'absolute', right: -TRANSITION_MARKER_W / 2, top: -2,
    width: TRANSITION_MARKER_W, height: TRANSITION_MARKER_W,
    borderRadius: TRANSITION_MARKER_W / 2, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
  },
  transitionMarkerText: { fontSize: 7, color: colors.bg, fontWeight: '700' as any },
  // Multi-select dot
  multiSelectDot: {
    position: 'absolute', top: 3, left: 4,
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textPrimary,
  },
  // Trim handles
  handleTouchLeft: {
    position: 'absolute', left: -HANDLE_HIT_W / 2, top: 0, bottom: 0,
    width: HANDLE_HIT_W, alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  handleTouchRight: {
    position: 'absolute', right: -HANDLE_HIT_W / 2, top: 0, bottom: 0,
    width: HANDLE_HIT_W, alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  handle: { width: 4, height: '60%', backgroundColor: colors.accent, borderRadius: 2 },
  handleLeft: {},
  handleRight: {},
  // Empty
  emptyTimeline: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing[6], gap: spacing[3], opacity: 0.6,
  },
  emptyTimelineText: { fontSize: typography.sm, color: colors.textMuted, textAlign: 'center' },
  // Playhead
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 1, zIndex: 10 },
  playheadHead: {
    width: 10, height: 10, backgroundColor: colors.playhead,
    borderRadius: 5, marginLeft: -4.5, marginTop: 24,
  },
  playheadLine: { width: 1, flex: 1, backgroundColor: colors.playhead, marginLeft: 0, opacity: 0.8 },
  // Snap indicator
  snapLine: { position: 'absolute', top: 0, bottom: 0, width: 1, zIndex: 9 },
  snapLineInner: {
    flex: 1, width: 1, backgroundColor: colors.accent, opacity: 0.6,
    borderStyle: 'dashed' as any,
  },
});
