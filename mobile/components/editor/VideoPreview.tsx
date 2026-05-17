import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PanResponder,
  Animated,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  PlayIcon, PauseIcon, MusicNote01Icon,
  Image01Icon, Film01Icon, DiscIcon,
  PaintBrush01Icon, Move01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { Clip, Project, TextOverlay, StickerOverlay } from '../../lib/database';
import { useProjectStore } from '../../lib/projectStore';
import { colors, typography } from '../../lib/theme';
import { getCameraTransform, getLayerTransform, getDefaultLayers, type ParallaxPreset } from '../../lib/parallax';
import PhotoGLPreview from './PhotoGLPreview';
import { getAnimatedTransform } from '../../lib/keyframes';

// Lazy parallax preview (avoids circular import)
function ParallaxPreviewLazy({ clip, currentTime, containerWidth, containerHeight }: {
  clip: Clip; currentTime: number; containerWidth: number; containerHeight: number;
}) {
  const effDurMs = (clip.duration - clip.trimStart - clip.trimEnd) / Math.max(0.01, clip.speed);
  const localTime = currentTime - clip.startTime;
  const t = Math.max(0, Math.min(1, localTime / Math.max(1, effDurMs)));
  const preset = (clip.parallaxPreset ?? 'dolly_in') as ParallaxPreset;
  const layers = clip.parallaxLayers?.length ? clip.parallaxLayers : getDefaultLayers();
  const camera = getCameraTransform(preset, t);
  return (
    <View style={{ flex: 1, backgroundColor: '#000', overflow: 'hidden' as const }}>
      {layers.map(layer => {
        const lt = getLayerTransform(camera, layer.depth);
        return (
          <View key={layer.id} style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' as const }]} pointerEvents="none">
            <Image
              source={{ uri: clip.uri }}
              style={{ width: '115%' as any, height: '115%' as any, marginLeft: '-7.5%' as any, marginTop: '-7.5%' as any, transform: [{ translateX: lt.translateX }, { translateY: lt.translateY }, { scale: lt.scale }] }}
              resizeMode="cover"
            />
          </View>
        );
      })}
    </View>
  );
}

// expo-video only on native
let VideoView: any = null;
let useVideoPlayer: any = null;

if (Platform.OS !== 'web') {
  try {
    const ev = require('expo-video');
    VideoView = ev.VideoView;
    useVideoPlayer = ev.useVideoPlayer;
  } catch {}
}

// Cache of pre-rendered reversed/chroma clips: key → file:// URI
const reversedClipCache = new Map<string, string>();
const chromaPreviewCache = new Map<string, string>();
const reverseInProgress = new Set<string>();
const chromaInProgress = new Set<string>();

interface VideoPreviewProps {
  clips: Clip[];
  currentTime: number;
  project: Project;
}

/** Build CSS filter string for web preview */
function getCSSFilterString(clip: Clip): string {
  const parts: string[] = [];

  // Brightness: -100..100 → CSS brightness(0.33..1.67)
  if (clip.brightness !== 0) {
    parts.push(`brightness(${1 + clip.brightness / 150})`);
  }
  // Contrast: -100..100 → CSS contrast(0.5..1.5)
  if (clip.contrast !== 0) {
    parts.push(`contrast(${1 + clip.contrast / 200})`);
  }
  // Saturation: -100..100 → CSS saturate(0..2)
  if (clip.saturation !== 0) {
    parts.push(`saturate(${1 + clip.saturation / 100})`);
  }

  // Named filter presets
  if (clip.filter) {
    switch (clip.filter) {
      case 'bw':
        parts.push('saturate(0)');
        break;
      case 'sepia':
        parts.push('sepia(0.8)');
        break;
      case 'vintage':
        parts.push('sepia(0.4) contrast(1.1) brightness(0.95)');
        break;
      case 'cool':
        parts.push('saturate(0.8) hue-rotate(20deg)');
        break;
      case 'warm':
        parts.push('saturate(1.2) hue-rotate(-10deg) brightness(1.05)');
        break;
      case 'dramatic':
        parts.push('contrast(1.4) brightness(0.85) saturate(0.7)');
        break;
      case 'cinematic':
        parts.push('contrast(1.2) saturate(0.85) brightness(0.9)');
        break;
      case 'vhs':
        parts.push('contrast(1.1) saturate(1.3) brightness(1.1)');
        break;
      case 'glow':
        parts.push('brightness(1.2) contrast(0.9)');
        break;
      case 'neon':
        parts.push('saturate(2.5) brightness(1.1) contrast(1.2)');
        break;
      case 'blur':
        parts.push('blur(3px)');
        break;
      // New cinematic filters
      case 'orange_teal': parts.push('saturate(1.3) contrast(1.1) hue-rotate(5deg)'); break;
      case 'moody': parts.push('contrast(1.35) brightness(0.8) saturate(0.7)'); break;
      case 'golden_hour': parts.push('sepia(0.2) saturate(1.4) brightness(1.05) hue-rotate(-15deg)'); break;
      case 'matte': parts.push('contrast(0.9) brightness(0.85)'); break;
      case 'faded': parts.push('contrast(0.75) brightness(0.9) saturate(0.6)'); break;
      case 'tokyo': parts.push('saturate(1.2) hue-rotate(15deg) contrast(1.1)'); break;
      case 'pacific': parts.push('saturate(1.3) hue-rotate(-15deg) brightness(1.05)'); break;
      case 'noir': parts.push('saturate(0) contrast(1.5) brightness(0.9)'); break;
      case 'pastel': parts.push('saturate(0.5) brightness(1.1) contrast(0.85)'); break;
      case 'kodak': parts.push('sepia(0.15) saturate(1.15) contrast(1.05) brightness(1.02)'); break;
      case 'fuji': parts.push('hue-rotate(-5deg) saturate(1.1) contrast(1.05)'); break;
    }
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}

/** Native: build overlay color + opacity for filter simulation */
function getFilterOverlay(clip: Clip): { color: string; opacity: number } | null {
  if (clip.filter) {
    switch (clip.filter) {
      case 'bw':
        return null; // handled by tintColor approach
      case 'sepia':
        return { color: '#704214', opacity: 0.3 };
      case 'vintage':
        return { color: '#8B4513', opacity: 0.2 };
      case 'cool':
        return { color: '#1E90FF', opacity: 0.12 };
      case 'warm':
        return { color: '#FF8C00', opacity: 0.12 };
      case 'dramatic':
        return { color: '#000000', opacity: 0.2 };
      case 'cinematic':
        return { color: '#1a1a2e', opacity: 0.15 };
      case 'vhs':
        return { color: '#FF1493', opacity: 0.08 };
      case 'glow':
        return { color: '#FFD700', opacity: 0.1 };
      // New cinematic filter overlays
      case 'orange_teal': return { color: '#FF6B00', opacity: 0.12 };
      case 'moody': return { color: '#0D0D1A', opacity: 0.25 };
      case 'golden_hour': return { color: '#FFB347', opacity: 0.18 };
      case 'matte': return { color: '#2D2D2D', opacity: 0.12 };
      case 'faded': return { color: '#B8B8A0', opacity: 0.2 };
      case 'tokyo': return { color: '#0066FF', opacity: 0.1 };
      case 'pacific': return { color: '#00B4D8', opacity: 0.12 };
      case 'noir': return { color: '#000000', opacity: 0.15 };
      case 'pastel': return { color: '#FFB3C1', opacity: 0.12 };
      case 'kodak': return { color: '#C19A6B', opacity: 0.08 };
      case 'fuji': return { color: '#90E0EF', opacity: 0.08 };
    }
  }
  return null;
}

/** Get opacity for NEGATIVE brightness (darkens image) */
function getNativeOpacity(clip: Clip): number {
  if (clip.brightness < 0) {
    return Math.max(0.15, 1 + clip.brightness / 120);
  }
  return 1;
}

/** Get white overlay opacity for POSITIVE brightness (lightens without blowing out) */
function getBrightnessOverlay(clip: Clip): number {
  if (clip.brightness > 0) {
    // Map 0→100 to 0→0.55 opacity (subtle brightening, not full white)
    return Math.min(0.55, clip.brightness / 180);
  }
  return 0;
}

function getTransformStyle(clip: Clip) {
  const transforms: any[] = [];
  if (clip.rotation !== 0) transforms.push({ rotate: `${clip.rotation}deg` });
  const sx = clip.scaleX * ((clip.flipH ?? false) ? -1 : 1);
  const sy = clip.scaleY * ((clip.flipV ?? false) ? -1 : 1);
  if (sx !== 1) transforms.push({ scaleX: sx });
  if (sy !== 1) transforms.push({ scaleY: sy });
  return transforms.length > 0 ? { transform: transforms } : {};
}

function hasColorGrading(clip: Clip): boolean {
  return clip.brightness !== 0 || clip.contrast !== 0 || clip.saturation !== 0 ||
    clip.temperature !== 0 || clip.tint !== 0 || clip.highlights !== 0 ||
    clip.shadows !== 0 || clip.sharpness !== 0 || !!clip.filter;
}

export default function VideoPreview({ clips, currentTime, project }: VideoPreviewProps) {
  const { isPlaying, setIsPlaying, setCurrentTime, textOverlays, stickerOverlays } = useProjectStore();
  const projectType = project.type || 'video';

  // Audio projects: show audio visualization
  if (projectType === 'audio') {
    const audioClips = clips
      .filter(c => c.type === 'audio')
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return (
      <AudioPreview
        clips={audioClips}
        currentTime={currentTime}
        project={project}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
      />
    );
  }

  const primaryClips = clips
    .filter(c => c.trackIndex === 0 && (c.type === 'video' || c.type === 'image'))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // Find active clip at currentTime
  const activeClip = primaryClips.length === 0 ? undefined : (
    primaryClips.find(c => {
      const effectiveDuration = (c.duration - c.trimStart - c.trimEnd) / Math.max(0.01, c.speed);
      return currentTime >= c.startTime && currentTime < c.startTime + effectiveDuration;
    }) || primaryClips[0]
  );

  // Transition logic: detect if we're in a transition zone between two clips
  let transitionInfo: {
    type: string;
    progress: number; // 0..1
    prevClip: Clip;
    nextClip: Clip;
  } | null = null;

  if (activeClip) {
    const activeIdx = primaryClips.indexOf(activeClip);
    // Check transition INTO this clip (from previous)
    if (activeIdx > 0 && activeClip.transitionType !== 'none') {
      const transDur = activeClip.transitionDuration || 500;
      const elapsed = currentTime - activeClip.startTime;
      if (elapsed < transDur) {
        transitionInfo = {
          type: activeClip.transitionType,
          progress: elapsed / transDur,
          prevClip: primaryClips[activeIdx - 1],
          nextClip: activeClip,
        };
      }
    }
    // Check transition OUT of this clip (into next)
    if (!transitionInfo && activeIdx < primaryClips.length - 1) {
      const nextClip = primaryClips[activeIdx + 1];
      if (nextClip.transitionType !== 'none') {
        const transDur = nextClip.transitionDuration || 500;
        const clipEnd = activeClip.startTime + (activeClip.duration - activeClip.trimStart - activeClip.trimEnd) / activeClip.speed;
        const timeToEnd = clipEnd - currentTime;
        if (timeToEnd < transDur && timeToEnd >= 0) {
          transitionInfo = {
            type: nextClip.transitionType,
            progress: 1 - (timeToEnd / transDur),
            prevClip: activeClip,
            nextClip,
          };
        }
      }
    }
  }

  // Find visible text overlays at currentTime
  const visibleOverlays = textOverlays.filter(t => {
    return currentTime >= t.startTime && currentTime < t.startTime + t.duration;
  });

  // Find visible sticker overlays at currentTime
  const visibleStickers = (stickerOverlays || []).filter(s => {
    if (s.duration === 0) return true; // whole project
    return currentTime >= s.startTime && currentTime < s.startTime + s.duration;
  });

  // Web fallback
  if (Platform.OS === 'web' || !VideoView || !useVideoPlayer) {
    return (
      <WebPreview
        clips={primaryClips}
        activeClip={activeClip}
        project={project}
        textOverlays={visibleOverlays}
        stickerOverlays={visibleStickers}
        projectType={projectType}
        transitionInfo={transitionInfo}
      />
    );
  }

  return (
    <NativePreview
      clips={primaryClips}
      activeClip={activeClip}
      currentTime={currentTime}
      isPlaying={isPlaying}
      setIsPlaying={setIsPlaying}
      setCurrentTime={setCurrentTime}
      project={project}
      textOverlays={visibleOverlays}
      stickerOverlays={visibleStickers}
      projectType={projectType}
      transitionInfo={transitionInfo}
    />
  );
}

/** Audio project preview */
function AudioPreview({
  clips, currentTime, project, isPlaying, onTogglePlay,
}: {
  clips: Clip[];
  currentTime: number;
  project: Project;
  isPlaying: boolean;
  onTogglePlay: () => void;
}) {
  const activeClip = clips.find(c => {
    const effectiveDuration = (c.duration - c.trimStart - c.trimEnd) / c.speed;
    return currentTime >= (c.startTime || 0) && currentTime < (c.startTime || 0) + effectiveDuration;
  }) || clips[0];

  const [waveformData, setWaveformData] = useState<number[] | null>(null);

  useEffect(() => {
    const activeUri = activeClip?.uri;
    if (!activeUri) return;
    let cancelled = false;
    import('../../lib/audioWaveform').then(({ getWaveform }) => {
      getWaveform(activeUri, 32).then(data => {
        if (!cancelled) setWaveformData(data);
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeClip?.uri]);

  return (
    <View style={[styles.container, styles.audioContainer]}>
      {/* Waveform — full area, no floating icon blocking it */}
      <View style={styles.audioVisual}>
        <View style={styles.waveformBars}>
          {Array.from({ length: 32 }).map((_, i) => {
            const baseAmplitude = waveformData ? waveformData[i] ?? 0.4 : 0.4;
            const playOffset = isPlaying ? Math.sin(currentTime * 0.005 + i * 0.3) * 0.08 : 0;
            const heightPct = 10 + (baseAmplitude + playOffset) * 70;
            return (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  { height: `${Math.min(90, Math.max(10, heightPct))}%` },
                  isPlaying && { backgroundColor: colors.textPrimary },
                ]}
              />
            );
          })}
        </View>
      </View>

      {clips.length === 0 && (
        <Text style={styles.audioEmptyText}>Add audio clips to start</Text>
      )}

      {/* Bottom info bar: play/pause + clip name — no overlap */}
      <View style={styles.audioInfoBar}>
        <TouchableOpacity style={styles.playPauseSmall} onPress={onTogglePlay} activeOpacity={0.8}>
          <HugeiconsIcon
            icon={isPlaying ? PauseIcon : PlayIcon}
            size={18}
            color="#fff"
          />
        </TouchableOpacity>
        {activeClip && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <HugeiconsIcon icon={DiscIcon} size={12} color={colors.textSecondary} />
            <Text style={styles.audioClipName} numberOfLines={1}>{activeClip.name}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** Visual transition overlay rendered during clip transitions */
function TransitionOverlay({ type, progress }: { type: string; progress: number }) {
  // Smoothstep easing for all transitions
  const eased = progress * progress * (3 - 2 * progress);
  // Crossfade / dissolve: just a black overlay that fades in then out (peak at 0.5)
  if (type === 'fade' || type === 'dissolve') {
    const opacity = eased < 0.5 ? eased * 2 : (1 - eased) * 2;
    return (
      <View
        style={[StyleSheet.absoluteFillObject, {
          backgroundColor: type === 'dissolve' ? '#000' : '#000',
          opacity: opacity * 0.7,
        }]}
        pointerEvents="none"
      />
    );
  }
  // Slide left/right: a moving edge wipe
  if (type === 'slide_left' || type === 'slide_right') {
    const fromLeft = type === 'slide_left';
    return (
      <View
        style={[StyleSheet.absoluteFillObject, {
          backgroundColor: '#000',
          opacity: 0.8,
          ...(fromLeft
            ? { right: `${(1 - eased) * 100}%` as any }
            : { left: `${(1 - eased) * 100}%` as any }),
        }]}
        pointerEvents="none"
      />
    );
  }
  // Wipe: horizontal bar sweep
  if (type === 'wipe') {
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{
          position: 'absolute',
          left: `${Math.max(0, eased * 100 - 5)}%` as any,
          width: '10%',
          top: 0,
          bottom: 0,
          backgroundColor: colors.textPrimary,
          opacity: 0.3,
        }} />
      </View>
    );
  }
  // Zoom: scale pulse
  if (type === 'zoom') {
    const scale = eased < 0.5 ? 1 + eased * 0.3 : 1 + (1 - eased) * 0.3;
    return (
      <View
        style={[StyleSheet.absoluteFillObject, {
          backgroundColor: '#000',
          opacity: (eased < 0.5 ? eased : 1 - eased) * 0.5,
          transform: [{ scale }],
        }]}
        pointerEvents="none"
      />
    );
  }
  // Blur: black overlay that peaks at center
  if (type === 'blur') {
    const blurOpacity = eased < 0.5 ? eased * 1.4 : (1 - eased) * 1.4;
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: Math.min(0.9, blurOpacity) }]} pointerEvents="none" />
    );
  }
  // Spin: rotating black overlay
  if (type === 'spin') {
    const rotation = eased * 180;
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: eased < 0.5 ? eased * 2 : (1 - eased) * 2, transform: [{ rotate: `${rotation}deg` }] }]} pointerEvents="none" />
    );
  }
  // Glitch: sharp black flicker
  if (type === 'glitch') {
    const flicker = Math.abs(Math.sin(eased * 30)) * 0.8;
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#fff', opacity: eased < 0.5 ? flicker * eased : flicker * (1 - eased) }]} pointerEvents="none" />
    );
  }
  // Flash: white flash at cut point
  if (type === 'flash') {
    const flashOpacity = eased < 0.3 ? (eased / 0.3) : eased > 0.7 ? ((1 - eased) / 0.3) : 1;
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#fff', opacity: flashOpacity * 0.95 }]} pointerEvents="none" />
    );
  }
  // Diagonal: diagonal wipe from corner
  if (type === 'diagonal') {
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ position: 'absolute', top: 0, left: 0, width: `${eased * 150}%` as any, height: `${eased * 150}%` as any, backgroundColor: '#000', opacity: 0.85, transform: [{ rotate: '-45deg' }, { translateX: -50 }, { translateY: -50 }] }} />
      </View>
    );
  }
  // Color wipe: colored overlay sweep
  if (type === 'color_wipe') {
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#6366f1', opacity: eased < 0.5 ? eased * 2 : (1 - eased) * 2, left: `${(1 - eased) * 50}%` as any }]} pointerEvents="none" />
    );
  }
  // Barn door: two panels opening from center
  if (type === 'barn_door') {
    const pct = `${(0.5 - eased * 0.5) * 100}%` as any;
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ position: 'absolute', top: 0, left: 0, right: pct, bottom: 0, backgroundColor: '#000' }} />
        <View style={{ position: 'absolute', top: 0, left: pct, right: 0, bottom: 0, backgroundColor: '#000' }} />
      </View>
    );
  }
  // Push left: new clip slides in from right, pushing old to left
  if (type === 'push_left') {
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: 0.3 * eased }} />
      </View>
    );
  }
  // Push right: new clip slides in from left
  if (type === 'push_right') {
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', opacity: 0.15 * eased }} />
      </View>
    );
  }
  // Circle wipe: circular reveal from center
  if (type === 'circle_wipe') {
    const size = eased * 200;
    return (
      <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#000', opacity: eased < 0.5 ? 1 - eased * 2 : (eased - 0.5) * 2 }} />
      </View>
    );
  }
  // Cross zoom: zoom + dissolve
  if (type === 'cross_zoom') {
    const scale = 1 + eased * 0.4;
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: eased < 0.5 ? eased : 1 - eased }]} pointerEvents="none" />
    );
  }
  // Pixelate: pixelation transition
  if (type === 'pixelate') {
    const blocks = Math.max(1, Math.round((1 - Math.abs(eased - 0.5) * 2) * 20));
    const blockSize = `${100 / blocks}%` as any;
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: Math.abs(eased - 0.5) * 0.8 }]} pointerEvents="none" />
    );
  }
  // Flip: horizontal flip transition
  if (type === 'flip') {
    const flipOpacity = eased < 0.5 ? eased * 2 : 2 - eased * 2;
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: flipOpacity * 0.8 }]} pointerEvents="none" />
    );
  }
  // Whip pan: motion blur streak + fast white flash
  if (type === 'whip_pan') {
    const peak = 1 - Math.abs(eased - 0.5) * 2;
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#fff', opacity: peak * 0.4 }} />
        <View style={{ position: 'absolute', top: '40%' as any, bottom: '40%' as any, left: 0, right: 0, backgroundColor: '#fff', opacity: peak * 0.3 }} />
      </View>
    );
  }
  // Cube: simulated 3D cube rotation via offset panels
  if (type === 'cube') {
    const angle = eased * 90;
    const faceOpacity = eased < 0.5 ? 1 - eased * 1.6 : (eased - 0.5) * 1.6;
    return (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} pointerEvents="none">
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${eased * 100}%` as any, right: 0, backgroundColor: '#000', opacity: 0.6 }} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${(1 - eased) * 100}%` as any, opacity: faceOpacity, backgroundColor: 'transparent', borderRightWidth: 2, borderRightColor: 'rgba(0,0,0,0.4)' }} />
      </View>
    );
  }
  return null;
}

/** Compute a single directional animation style (used for In or Out) */
function getSingleAnimStyle(anim: string, t: number, isOut: boolean): { opacity: number; transform?: any[] } {
  // For Out animations, reverse t so it goes from 1→0
  const progress = isOut ? 1 - t : t;
  switch (anim) {
    case 'fade': return { opacity: progress };
    case 'zoom_in': return { opacity: Math.min(1, t * 3 + (isOut ? 0 : 0)), transform: [{ scale: isOut ? 1 + t * 0.3 : 0.7 + progress * 0.3 }] };
    case 'zoom_out': return { opacity: Math.min(1, t * 3), transform: [{ scale: isOut ? 1 - t * 0.3 : 1.3 - progress * 0.3 }] };
    case 'slide_left': return { opacity: Math.min(1, progress * 4), transform: [{ translateX: isOut ? -60 * t : 60 * (1 - progress) }] };
    case 'slide_right': return { opacity: Math.min(1, progress * 4), transform: [{ translateX: isOut ? 60 * t : -60 * (1 - progress) }] };
    case 'slide_up': return { opacity: Math.min(1, progress * 4), transform: [{ translateY: isOut ? -40 * t : 40 * (1 - progress) }] };
    case 'slide_down': return { opacity: Math.min(1, progress * 4), transform: [{ translateY: isOut ? 40 * t : -40 * (1 - progress) }] };
    case 'shake': {
      const sx = t < (isOut ? 0.9 : 0.5) ? Math.sin(t * 40) * 6 * (1 - t * (isOut ? 1 : 2)) : 0;
      return { opacity: progress > 0.1 ? 1 : progress * 10, transform: [{ translateX: sx }] };
    }
    case 'roll': return { opacity: Math.min(1, progress * 4), transform: [{ translateX: isOut ? -60 * t : 60 * (1 - progress) }, { rotate: `${isOut ? -15 * t : 15 * (1 - progress)}deg` as any }] };
    case 'dissolve': return { opacity: isOut ? 1 - t : t };
    default: return { opacity: 1 };
  }
}

function getTextAnimStyle(overlay: TextOverlay, currentTime: number): { opacity: number; transform?: any[] } {
  const elapsed = currentTime - overlay.startTime;
  const dur = overlay.duration;
  if (elapsed < 0 || elapsed > dur) return { opacity: 0 };
  const t = elapsed / dur;

  // Support separate In/Out animations when set
  const animIn = (overlay as any).animationIn;
  const animOut = (overlay as any).animationOut;
  const inDur = Math.min(((overlay as any).animationInDuration ?? 400), dur * 0.45);
  const outDur = Math.min(((overlay as any).animationOutDuration ?? 400), dur * 0.45);

  if (animIn && animIn !== 'none' && elapsed < inDur) {
    return getSingleAnimStyle(animIn, elapsed / inDur, false);
  }
  if (animOut && animOut !== 'none' && elapsed > dur - outDur) {
    return getSingleAnimStyle(animOut, (elapsed - (dur - outDur)) / outDur, true);
  }
  if ((animIn && animIn !== 'none') || (animOut && animOut !== 'none')) {
    return { opacity: 1 }; // Middle of overlay — fully visible
  }

  switch (overlay.animation) {
    case 'fade_in':
      return { opacity: Math.min(1, t * 3) };
    case 'fade_out':
      return { opacity: Math.max(0, 1 - (t - 0.7) * 3.33) };
    case 'slide_up':
      return { opacity: Math.min(1, t * 4), transform: [{ translateY: Math.max(0, 30 * (1 - t * 4)) }] };
    case 'slide_down':
      return { opacity: Math.min(1, t * 4), transform: [{ translateY: Math.min(0, -30 * (1 - t * 4)) }] };
    case 'scale_in':
      return { opacity: Math.min(1, t * 5), transform: [{ scale: 0.5 + Math.min(0.5, t * 2.5) }] };
    case 'bounce': {
      const bt = Math.min(1, t * 5);
      const scale = bt < 0.6 ? 1 + 0.3 * (bt / 0.6) : 1.3 - 0.3 * ((bt - 0.6) / 0.4);
      return { opacity: 1, transform: [{ scale }] };
    }
    case 'zoom_out':
      return { opacity: Math.min(1, t * 3), transform: [{ scale: 2 - Math.min(1, t * 2) }] };
    case 'blur_in':
      return { opacity: Math.min(1, t * 4) };
    case 'glitch': {
      const gx = t < 0.3 ? (Math.random() - 0.5) * 12 : 0;
      return { opacity: 1, transform: [{ translateX: gx }] };
    }
    case 'shake': {
      const sx = t < 0.5 ? Math.sin(t * 40) * 6 * (1 - t * 2) : 0;
      return { opacity: 1, transform: [{ translateX: sx }] };
    }
    case 'roll_left':
      return { opacity: Math.min(1, t * 4), transform: [{ translateX: Math.max(0, -60 * (1 - t * 4)) }] };
    case 'pulse': {
      const ps = 1 + Math.sin(t * Math.PI * 4) * 0.06 * (1 - t);
      return { opacity: 1, transform: [{ scale: ps }] };
    }
    // New animations
    case 'wave': {
      const wx = Math.sin(t * Math.PI * 6) * 5 * Math.max(0, 1 - t * 2);
      const wy = Math.cos(t * Math.PI * 4) * 3 * Math.max(0, 1 - t * 2);
      return { opacity: Math.min(1, t * 5), transform: [{ translateX: wx }, { translateY: wy }] };
    }
    case 'flicker': {
      const flic = t < 0.3 ? Math.round(Math.sin(t * 80)) * 0.5 + 0.5 : 1;
      return { opacity: flic };
    }
    case 'neon_glow': {
      const glow = 0.7 + Math.sin(t * Math.PI * 8) * 0.3;
      return { opacity: glow };
    }
    case 'split_reveal': {
      const sr = Math.min(1, t * 4);
      return { opacity: sr, transform: [{ scaleX: 0.5 + sr * 0.5 }] };
    }
    case 'spotlight': {
      return { opacity: Math.min(1, t * 2.5) };
    }
    case 'rise': {
      const rt = Math.min(1, t * 3);
      return { opacity: rt, transform: [{ translateY: Math.max(0, 40 * (1 - rt)) }, { rotate: `${(1 - rt) * 8}deg` as any }] };
    }
    default:
      return { opacity: 1 };
  }
}

function DraggableTextOverlay({
  overlay,
  currentTime,
  containerWidth,
  containerHeight,
  onMove,
}: {
  overlay: TextOverlay;
  currentTime: number;
  containerWidth: number;
  containerHeight: number;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const posRef = useRef({ x: overlay.positionX, y: overlay.positionY });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        const dx = gs.dx / containerWidth;
        const dy = gs.dy / containerHeight;
        const newX = Math.max(0, Math.min(0.9, posRef.current.x + dx));
        const newY = Math.max(0, Math.min(0.9, posRef.current.y + dy));
        onMove(overlay.id, newX, newY);
      },
      onPanResponderRelease: (_, gs) => {
        const dx = gs.dx / containerWidth;
        const dy = gs.dy / containerHeight;
        posRef.current = {
          x: Math.max(0, Math.min(0.9, posRef.current.x + dx)),
          y: Math.max(0, Math.min(0.9, posRef.current.y + dy)),
        };
      },
    })
  ).current;

  const animStyle = getTextAnimStyle(overlay, currentTime);
  const displayText = overlay.animation === 'typewriter'
    ? overlay.content.slice(0, Math.max(1, Math.floor(
        Math.min(1, (currentTime - overlay.startTime) / overlay.duration) * overlay.content.length
      )))
    : overlay.content;

  return (
    <View
      {...pan.panHandlers}
      style={[
        styles.textOverlayWrapper,
        {
          left: `${overlay.positionX * 100}%` as any,
          top: `${overlay.positionY * 100}%` as any,
          opacity: animStyle.opacity,
          transform: [
            { translateX: '-50%' as any },
            { translateY: '-50%' as any },
            ...(animStyle.transform ?? [] as any[]),
          ],
        },
      ]}
    >
      <Text
        style={[
          styles.textOverlayText,
          {
            fontSize: overlay.fontSize,
            color: overlay.color,
            fontFamily: overlay.fontFamily !== 'System' ? overlay.fontFamily : undefined,
            textShadowColor: overlay.shadow ? 'rgba(0,0,0,0.8)' : 'transparent',
            textShadowOffset: overlay.shadow ? { width: 2, height: 2 } : { width: 0, height: 0 },
            textShadowRadius: overlay.shadow ? 3 : 0,
            backgroundColor: overlay.backgroundColor || 'transparent',
          },
          overlay.outline && {
            textShadowColor: overlay.outlineColor,
            textShadowRadius: 2,
          },
        ]}
      >
        {displayText}
      </Text>
      <View style={styles.dragHandle} pointerEvents="none">
        <HugeiconsIcon icon={Move01Icon} size={10} color="rgba(255,255,255,0.6)" />
      </View>
    </View>
  );
}

function DraggableStickerOverlay({ sticker, containerWidth, containerHeight, onMove, onUpdate, onDelete }: {
  sticker: StickerOverlay;
  containerWidth: number;
  containerHeight: number;
  onMove: (id: string, x: number, y: number) => void;
  onUpdate: (id: string, updates: Partial<StickerOverlay>) => void;
  onDelete: (id: string) => void;
}) {
  const panX = useRef(0);
  const panY = useRef(0);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  const rotStartAngle = useRef(0);
  const rotStartValue = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const cur = useProjectStore.getState().stickerOverlays.find(s => s.id === sticker.id);
        panX.current = cur?.positionX ?? sticker.positionX;
        panY.current = cur?.positionY ?? sticker.positionY;
        if (e.nativeEvent.touches.length === 2) {
          const t = e.nativeEvent.touches;
          const dx = t[1].pageX - t[0].pageX;
          const dy = t[1].pageY - t[0].pageY;
          pinchStartDist.current = Math.sqrt(dx * dx + dy * dy);
          pinchStartScale.current = cur?.scale ?? sticker.scale;
          rotStartAngle.current = Math.atan2(dy, dx) * (180 / Math.PI);
          rotStartValue.current = cur?.rotation ?? sticker.rotation ?? 0;
        }
      },
      onPanResponderMove: (e, gs) => {
        if (e.nativeEvent.touches.length === 2 && pinchStartDist.current !== null) {
          const t = e.nativeEvent.touches;
          const dx = t[1].pageX - t[0].pageX;
          const dy = t[1].pageY - t[0].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const newScale = Math.max(0.1, Math.min(4, pinchStartScale.current * (dist / pinchStartDist.current)));
          const newRotation = rotStartValue.current + (angle - rotStartAngle.current);
          onUpdate(sticker.id, { scale: newScale, rotation: newRotation });
        } else {
          const newX = Math.max(0, Math.min(1, panX.current + gs.dx / containerWidth));
          const newY = Math.max(0, Math.min(1, panY.current + gs.dy / containerHeight));
          onMove(sticker.id, newX, newY);
        }
      },
      onPanResponderRelease: (e, gs) => {
        const wasPinch = pinchStartDist.current !== null;
        pinchStartDist.current = null;
        if (!wasPinch) {
          const newX = Math.max(0, Math.min(1, panX.current + gs.dx / containerWidth));
          const newY = Math.max(0, Math.min(1, panY.current + gs.dy / containerHeight));
          onMove(sticker.id, newX, newY);
        }
      },
    })
  ).current;

  const size = 80 * (sticker.scale || 0.3) * 3.33;

  return (
    <View
      style={{
        position: 'absolute',
        left: `${(sticker.positionX ?? 0.5) * 100}%` as any,
        top: `${(sticker.positionY ?? 0.5) * 100}%` as any,
        transform: [
          { translateX: -size / 2 },
          { translateY: -size / 2 },
          { rotate: `${sticker.rotation ?? 0}deg` },
          { scaleX: sticker.flipH ? -1 : 1 },
          { scaleY: sticker.flipV ? -1 : 1 },
        ],
        opacity: sticker.opacity ?? 1,
      }}
      {...pan.panHandlers}
    >
      <Image
        source={{ uri: sticker.uri }}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      <TouchableOpacity
        style={styles.stickerDelete}
        onPress={() => onDelete(sticker.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <HugeiconsIcon icon={Cancel01Icon} size={10} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function getKenBurnsStyle(clip: Clip, currentTime: number, containerW: number, containerH: number) {
  const kb = clip.kenBurns;
  if (!kb?.enabled) return {};
  const effDur = (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed;
  const localTime = currentTime - clip.startTime;
  const t = Math.max(0, Math.min(1, localTime / Math.max(1, effDur)));
  const zoom = kb.startZoom + (kb.endZoom - kb.startZoom) * t;
  const panX = kb.startX + (kb.endX - kb.startX) * t;
  const panY = kb.startY + (kb.endY - kb.startY) * t;
  const tx = (panX - 0.5) * containerW * (zoom - 1);
  const ty = (panY - 0.5) * containerH * (zoom - 1);
  return { transform: [{ scale: zoom }, { translateX: tx }, { translateY: ty }] };
}

function NativePreview({
  clips, activeClip, currentTime, isPlaying, setIsPlaying, setCurrentTime, project, textOverlays, stickerOverlays, projectType, transitionInfo,
}: {
  clips: Clip[];
  activeClip?: Clip;
  currentTime: number;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  setCurrentTime: (v: number) => void;
  project: Project;
  textOverlays: TextOverlay[];
  stickerOverlays: StickerOverlay[];
  projectType: string;
  transitionInfo: { type: string; progress: number; prevClip: Clip; nextClip: Clip } | null;
}) {
  const { updateTextOverlay, updateStickerOverlay, removeStickerOverlay } = useProjectStore();
  // Container size for accurate drag/pinch calculations
  const [containerSize, setContainerSize] = useState({ width: 320, height: 180 });
  // Pinch-to-zoom state
  const [previewScale, setPreviewScale] = useState(1);
  const pinchDistRef = useRef<number | null>(null);
  const pinchScaleRef = useRef(1);
  // Reversed clip preview URI (pre-rendered via native module)
  const [reversedUri, setReversedUri] = useState<string | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  // Chroma-key pre-rendered preview URI
  const [chromaUri, setChromaUri] = useState<string | null>(null);
  const [chromaLoading, setChromaLoading] = useState(false);

  // Pre-render reversed clip for preview when clip.reverse is toggled
  useEffect(() => {
    if (!activeClip || activeClip.type !== 'video' || !activeClip.reverse) {
      setReversedUri(null);
      return;
    }
    const cacheKey = `${activeClip.id}:${activeClip.uri}`;
    const cached = reversedClipCache.get(cacheKey);
    if (cached) { setReversedUri(cached); return; }
    if (reverseInProgress.has(cacheKey)) { setReverseLoading(true); return; }

    reverseInProgress.add(cacheKey);
    setReverseLoading(true);
    (async () => {
      try {
        let nativeProc: any = null;
        try { const { NativeModulesProxy } = require('expo-modules-core'); nativeProc = NativeModulesProxy?.ExpoVideoProcessor; } catch {}
        if (!nativeProc) { setReverseLoading(false); return; }

        const FS = require('expo-file-system/legacy');
        const outPath = `${FS.cacheDirectory}rev_preview_${activeClip.id}.mp4`;
        const effDurMs = activeClip.duration - activeClip.trimStart - activeClip.trimEnd;
        const result = await nativeProc.processVideoWithEffects({
          inputUri: activeClip.uri, outputPath: outPath,
          trimStartMs: activeClip.trimStart, durationMs: effDurMs,
          speed: activeClip.speed, reverse: true,
          brightness: 0, contrast: 0, saturation: 0,
          temperature: 0, tint: 0, highlights: 0, shadows: 0,
          width: 480, height: 270, // low-res for fast preview generation
          bitrate: 2_000_000, fps: 30,
          textOverlays: [], stickerOverlays: [],
        });
        if (result.success) {
          reversedClipCache.set(cacheKey, outPath);
          setReversedUri(outPath);
        }
      } catch (e) { console.warn('[Reverse preview]', e); }
      finally { reverseInProgress.delete(cacheKey); setReverseLoading(false); }
    })();
  }, [activeClip?.id, activeClip?.reverse, activeClip?.uri]);
  // Compute fade + keyframe adjusted volume based on position within clip
  function getFadeVolume(clip: Clip, ct: number): number {
    const localMs = ct - clip.startTime;
    const effDurMs = (clip.duration - clip.trimStart - clip.trimEnd) / Math.max(0.01, clip.speed);
    const fi = clip.fadeIn ?? 0;
    const fo = clip.fadeOut ?? 0;
    let vol = clip.volume ?? 1;

    // Apply volume keyframe envelope (linear interpolation between keyframes)
    const kfs = clip.volumeKeyframes;
    if (kfs && kfs.length > 0) {
      const sorted = [...kfs].sort((a, b) => a.time - b.time);
      if (localMs <= sorted[0].time) {
        vol *= sorted[0].value;
      } else if (localMs >= sorted[sorted.length - 1].time) {
        vol *= sorted[sorted.length - 1].value;
      } else {
        for (let i = 0; i < sorted.length - 1; i++) {
          if (localMs >= sorted[i].time && localMs < sorted[i + 1].time) {
            const t = (localMs - sorted[i].time) / (sorted[i + 1].time - sorted[i].time);
            vol *= sorted[i].value + (sorted[i + 1].value - sorted[i].value) * t;
            break;
          }
        }
      }
    }

    if (fi > 0 && localMs < fi) vol *= localMs / fi;
    if (fo > 0 && localMs > effDurMs - fo) vol *= (effDurMs - localMs) / fo;
    return Math.max(0, Math.min(1, vol));
  }

  // Pre-render chroma key for video clips (debounced on threshold change)
  useEffect(() => {
    if (!activeClip || activeClip.type !== 'video' || !activeClip.chromaKeyEnabled) {
      setChromaUri(null);
      return;
    }
    const cacheKey = `${activeClip.id}:chroma:${activeClip.chromaKeyColor}:${activeClip.chromaKeyThreshold}`;
    const cached = chromaPreviewCache.get(cacheKey);
    if (cached) { setChromaUri(cached); return; }
    if (chromaInProgress.has(cacheKey)) { setChromaLoading(true); return; }

    chromaInProgress.add(cacheKey);
    setChromaLoading(true);
    const timer = setTimeout(async () => {
      try {
        let nativeProc: any = null;
        try { const { NativeModulesProxy } = require('expo-modules-core'); nativeProc = NativeModulesProxy?.ExpoVideoProcessor; } catch {}
        if (!nativeProc) { setChromaLoading(false); return; }
        const FS = require('expo-file-system/legacy');
        const outPath = `${FS.cacheDirectory}chroma_prev_${activeClip.id}_${Date.now()}.mp4`;
        const effDurMs = activeClip.duration - activeClip.trimStart - activeClip.trimEnd;
        const result = await nativeProc.processVideoWithEffects({
          inputUri: activeClip.uri, outputPath: outPath,
          trimStartMs: activeClip.trimStart, durationMs: effDurMs,
          speed: activeClip.speed, reverse: false,
          brightness: 0, contrast: 0, saturation: 0,
          temperature: 0, tint: 0, highlights: 0, shadows: 0,
          chromaKeyEnabled: true,
          chromaKeyColor: activeClip.chromaKeyColor ?? '#00FF00',
          chromaKeyThreshold: activeClip.chromaKeyThreshold ?? 30,
          width: 480, height: 270, bitrate: 2_000_000, fps: 30,
          textOverlays: [], stickerOverlays: [],
        });
        if (result.success) { chromaPreviewCache.set(cacheKey, outPath); setChromaUri(outPath); }
      } catch (e) { console.warn('[Chroma preview]', e); }
      finally { chromaInProgress.delete(cacheKey); setChromaLoading(false); }
    }, 800); // debounce 800ms so rapid slider changes don't flood the queue
    return () => clearTimeout(timer);
  }, [activeClip?.id, activeClip?.chromaKeyEnabled, activeClip?.chromaKeyColor, activeClip?.chromaKeyThreshold]);

  // Use pre-rendered reversed URI if available, otherwise source URI
  const uri = (activeClip?.type === 'video' && activeClip?.uri)
    ? (activeClip.reverse && reversedUri ? reversedUri
       : activeClip.chromaKeyEnabled && chromaUri ? chromaUri
       : activeClip.uri)
    : '';
  const player = useVideoPlayer?.(uri || '', (p: any) => {
    if (p && uri) {
      p.loop = false;
      p.volume = activeClip ? getFadeVolume(activeClip, currentTime) : 1;
      p.playbackRate = activeClip?.speed ?? 1;
    }
  });

  // Playback timer: sync currentTime from player while playing
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!player || !activeClip || activeClip.type !== 'video') return;
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        try {
          const pTime = player.currentTime ?? 0;
          const timelineMs = activeClip.startTime + pTime * 1000;
          setCurrentTime(timelineMs);
        } catch {}
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, player, activeClip]);

  useEffect(() => {
    if (!player) return;
    try {
      if (isPlaying) {
        player.play?.();
      } else {
        player.pause?.();
      }
    } catch {}
  }, [isPlaying, player]);

  // Sync playback rate when clip speed changes (not just at player creation)
  useEffect(() => {
    if (!player || !activeClip) return;
    try { player.playbackRate = activeClip.speed ?? 1; } catch {}
  }, [player, activeClip?.speed]);

  // Update fade volume as time changes during playback
  useEffect(() => {
    if (!player || !activeClip) return;
    try { player.volume = getFadeVolume(activeClip, currentTime); } catch {}
  }, [currentTime, activeClip, player]);

  // Seek on scrub (only when NOT playing — prevents fight with timer)
  useEffect(() => {
    if (!player || !activeClip || activeClip.type !== 'video' || isPlaying) return;
    try {
      const localTime = (currentTime - activeClip.startTime) / 1000;
      const clamped = Math.max(0, Math.min(
        (activeClip.duration - activeClip.trimStart - activeClip.trimEnd) / 1000,
        localTime,
      ));
      if (Math.abs(clamped - (player.currentTime ?? 0)) > 0.15) {
        player.currentTime = clamped;
      }
    } catch {}
  }, [currentTime, player, activeClip]);

  // Handle end of clip
  useEffect(() => {
    if (!player || !activeClip) return;
    const sub = player.addListener?.('playToEnd', () => {
      setIsPlaying(false);
    });
    return () => sub?.remove?.();
  }, [player]);

  const handleTextMove = useCallback((id: string, x: number, y: number) => {
    updateTextOverlay(id, { positionX: x, positionY: y });
  }, [updateTextOverlay]);

  const handleStickerMove = useCallback((id: string, x: number, y: number) => {
    updateStickerOverlay(id, { positionX: x, positionY: y });
  }, [updateStickerOverlay]);

  const handleStickerUpdate = useCallback((id: string, updates: Partial<StickerOverlay>) => {
    updateStickerOverlay(id, updates);
  }, [updateStickerOverlay]);

  const handleStickerDelete = useCallback((id: string) => {
    removeStickerOverlay(id);
  }, [removeStickerOverlay]);

  // Pinch-to-zoom gesture on preview container
  const containerPinch = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onPanResponderGrant: (e) => {
        if (e.nativeEvent.touches.length === 2) {
          const t = e.nativeEvent.touches;
          const dx = t[1].pageX - t[0].pageX;
          const dy = t[1].pageY - t[0].pageY;
          pinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
          pinchScaleRef.current = previewScale;
        }
      },
      onPanResponderMove: (e) => {
        if (e.nativeEvent.touches.length === 2 && pinchDistRef.current !== null) {
          const t = e.nativeEvent.touches;
          const dx = t[1].pageX - t[0].pageX;
          const dy = t[1].pageY - t[0].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const newScale = Math.max(0.5, Math.min(4, pinchScaleRef.current * (dist / pinchDistRef.current)));
          setPreviewScale(newScale);
        }
      },
      onPanResponderRelease: () => {
        pinchDistRef.current = null;
      },
    })
  ).current;

  if (!activeClip) {
    return <EmptyPreview projectType={projectType} />;
  }

  // Apply keyframe animation transforms
  const localTimeMs = currentTime - activeClip.startTime;
  const animTransform = activeClip.animTracks && activeClip.animTracks.length > 0
    ? getAnimatedTransform(activeClip.animTracks, Math.max(0, localTimeMs))
    : null;

  const baseTransformStyle = getTransformStyle(activeClip);
  const transformStyle = animTransform ? {
    ...baseTransformStyle,
    transform: [
      ...(animTransform.scale != null ? [{ scale: animTransform.scale * (activeClip.scaleX ?? 1) }] : (baseTransformStyle.transform ?? [])),
      ...(animTransform.translateX != null ? [{ translateX: animTransform.translateX }] : []),
      ...(animTransform.translateY != null ? [{ translateY: animTransform.translateY }] : []),
    ],
  } : baseTransformStyle;

  const filterOverlay = getFilterOverlay(activeClip);
  const isBW = activeClip.filter === 'bw';
  const nativeOpacity = getNativeOpacity(activeClip);
  const brightnessOverlayOpacity = getBrightnessOverlay(activeClip);
  // Compute clip In/Out transition opacity and transform
  const clipEffDur = (activeClip.duration - activeClip.trimStart - activeClip.trimEnd) / Math.max(0.01, activeClip.speed);
  const clipLocalMs = currentTime - activeClip.startTime;
  const clipInDur = Math.min((activeClip as any).clipTransitionInDuration ?? 400, clipEffDur * 0.45);
  const clipOutDur = Math.min((activeClip as any).clipTransitionOutDuration ?? 400, clipEffDur * 0.45);
  const clipTransIn = (activeClip as any).clipTransitionIn ?? 'none';
  const clipTransOut = (activeClip as any).clipTransitionOut ?? 'none';

  let clipTransitionStyle: { opacity: number; transform?: any[] } = { opacity: animTransform?.opacity ?? (activeClip.opacity ?? 1) };
  if (clipTransIn !== 'none' && clipLocalMs >= 0 && clipLocalMs < clipInDur) {
    const inT = clipLocalMs / clipInDur;
    const inStyle = getSingleAnimStyle(clipTransIn, inT, false);
    clipTransitionStyle = { ...inStyle, opacity: (inStyle.opacity) * (animTransform?.opacity ?? (activeClip.opacity ?? 1)) };
  } else if (clipTransOut !== 'none' && clipLocalMs > clipEffDur - clipOutDur && clipLocalMs <= clipEffDur) {
    const outT = (clipLocalMs - (clipEffDur - clipOutDur)) / clipOutDur;
    const outStyle = getSingleAnimStyle(clipTransOut, outT, true);
    clipTransitionStyle = { ...outStyle, opacity: (outStyle.opacity) * (animTransform?.opacity ?? (activeClip.opacity ?? 1)) };
  }

  const clipOpacity = clipTransitionStyle.opacity;
  const grading = hasColorGrading(activeClip);

  return (
    <View
      style={styles.container}
      {...containerPinch.panHandlers}
      onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <View style={{ transform: [{ scale: previewScale }], flex: 1, opacity: clipOpacity }}>
      {activeClip.type === 'video' && VideoView && player ? (
        <View style={[styles.mediaWrapper, transformStyle]}>
          <VideoView
            style={[styles.video, { opacity: nativeOpacity }]}
            player={player}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            contentFit="contain"
          />
          {/* Reverse-render loading indicator */}
          {activeClip.reverse && reverseLoading && (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Generating reverse preview…</Text>
            </View>
          )}
          {/* B&W overlay for native */}
          {isBW && <View style={styles.bwOverlay} />}
          {/* Named filter color overlay */}
          {filterOverlay && (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: filterOverlay.color, opacity: filterOverlay.opacity }]} pointerEvents="none" />
          )}
          {/* Positive brightness: soft white blend (does NOT blow out to solid white) */}
          {brightnessOverlayOpacity > 0 && (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#FFFFFF', opacity: brightnessOverlayOpacity }]} pointerEvents="none" />
          )}
        </View>
      ) : activeClip.type === 'image' ? (
        <View style={[styles.mediaWrapper, transformStyle, { overflow: 'hidden' }]}>
          {activeClip.parallaxEnabled ? (
            // 3D Parallax Camera: animated parallax layer rendering
            <ParallaxPreviewLazy
              clip={activeClip}
              currentTime={currentTime}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
            />
          ) : activeClip.kenBurns?.enabled ? (
            // Ken Burns: GPU animation via transform — keep Image for pan/zoom effect
            <>
              <Image
                source={{ uri: activeClip.uri }}
                style={[
                  styles.imageMedia,
                  { opacity: nativeOpacity },
                  getKenBurnsStyle(activeClip, currentTime, containerSize.width, containerSize.height),
                ]}
                resizeMode="contain"
              />
              {isBW && <View style={styles.bwOverlay} />}
              {filterOverlay && (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: filterOverlay.color, opacity: filterOverlay.opacity }]} pointerEvents="none" />
              )}
              {brightnessOverlayOpacity > 0 && (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#FFFFFF', opacity: brightnessOverlayOpacity }]} pointerEvents="none" />
              )}
            </>
          ) : (
            // Full GPU color grading via the same GL shader as the photo editor
            <PhotoGLPreview clip={activeClip} style={StyleSheet.absoluteFillObject} />
          )}
        </View>
      ) : (
        <View style={styles.imagePlaceholder}>
          <HugeiconsIcon icon={Image01Icon} size={40} color={colors.textMuted} />
        </View>
      )}

      {/* Transition overlay */}
      {transitionInfo && (
        <TransitionOverlay type={transitionInfo.type} progress={transitionInfo.progress} />
      )}

      {/* Sticker overlays — draggable with pinch/rotate */}
      {stickerOverlays.map(sticker => (
        <DraggableStickerOverlay
          key={sticker.id}
          sticker={sticker}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          onMove={handleStickerMove}
          onUpdate={handleStickerUpdate}
          onDelete={handleStickerDelete}
        />
      ))}

      {/* Text overlays — draggable with animations */}
      {textOverlays.map(overlay => (
        <DraggableTextOverlay
          key={overlay.id}
          overlay={overlay}
          currentTime={currentTime}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          onMove={handleTextMove}
        />
      ))}

      {/* Color grading badge */}
      {grading && (
        <View style={styles.gradingBadge}>
          <HugeiconsIcon icon={PaintBrush01Icon} size={10} color={colors.accentText} />
          <Text style={styles.gradingBadgeText}>
            {activeClip.filter || 'Graded'}
          </Text>
        </View>
      )}
      </View>

      <PreviewOverlay
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        project={project}
        currentTime={currentTime}
        projectType={projectType}
      />
    </View>
  );
}

function WebPreview({ clips, activeClip, project, textOverlays, stickerOverlays, projectType, transitionInfo }: {
  clips: Clip[];
  activeClip?: Clip;
  project: Project;
  textOverlays: TextOverlay[];
  stickerOverlays: StickerOverlay[];
  projectType: string;
  transitionInfo: { type: string; progress: number; prevClip: Clip; nextClip: Clip } | null;
}) {
  const { isPlaying, setIsPlaying, currentTime, setCurrentTime, updateTextOverlay, updateStickerOverlay, removeStickerOverlay } = useProjectStore();
  const videoRef = useRef<any>(null);

  // Play/pause
  useEffect(() => {
    if (!videoRef.current || activeClip?.type !== 'video') return;
    if (isPlaying) {
      videoRef.current.play?.().catch(() => {});
    } else {
      videoRef.current.pause?.();
    }
  }, [isPlaying]);

  // Seek on scrub
  useEffect(() => {
    if (!videoRef.current || activeClip?.type !== 'video' || isPlaying) return;
    const localTime = (currentTime - (activeClip?.startTime ?? 0)) / 1000;
    if (Math.abs(videoRef.current.currentTime - localTime) > 0.15) {
      videoRef.current.currentTime = localTime;
    }
  }, [currentTime]);

  const handleWebTimeUpdate = useCallback(() => {
    if (!videoRef.current || !activeClip || !isPlaying) return;
    const timelineMs = (activeClip.startTime ?? 0) + videoRef.current.currentTime * 1000;
    setCurrentTime(timelineMs);
  }, [activeClip, isPlaying, setCurrentTime]);

  const handleTextMove = useCallback((id: string, x: number, y: number) => {
    updateTextOverlay(id, { positionX: x, positionY: y });
  }, [updateTextOverlay]);

  const handleStickerMove = useCallback((id: string, x: number, y: number) => {
    updateStickerOverlay(id, { positionX: x, positionY: y });
  }, [updateStickerOverlay]);

  const handleStickerUpdate = useCallback((id: string, updates: Partial<StickerOverlay>) => {
    updateStickerOverlay(id, updates);
  }, [updateStickerOverlay]);

  const handleStickerDelete = useCallback((id: string) => {
    removeStickerOverlay(id);
  }, [removeStickerOverlay]);

  if (!activeClip) return <EmptyPreview projectType={projectType} />;

  const transformStyle = getTransformStyle(activeClip);
  const cssFilter = getCSSFilterString(activeClip);

  return (
    <View style={styles.container}>
      {activeClip.type === 'video' ? (
        <View style={[styles.mediaWrapper, transformStyle]}>
          <video
            ref={videoRef}
            src={activeClip.uri}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              backgroundColor: '#000',
              filter: cssFilter,
            } as any}
            playsInline
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={handleWebTimeUpdate}
          />
        </View>
      ) : activeClip.type === 'image' ? (
        <View style={[styles.mediaWrapper, transformStyle]}>
          <img
            src={activeClip.uri}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: cssFilter,
            } as any}
          />
        </View>
      ) : (
        <View style={styles.imagePlaceholder}>
          <HugeiconsIcon icon={Image01Icon} size={40} color={colors.textMuted} />
        </View>
      )}

      {/* Transition overlay */}
      {transitionInfo && (
        <TransitionOverlay type={transitionInfo.type} progress={transitionInfo.progress} />
      )}

      {/* Text overlays — draggable with animations */}
      {textOverlays.map(overlay => (
        <DraggableTextOverlay
          key={overlay.id}
          overlay={overlay}
          currentTime={currentTime}
          containerWidth={640}
          containerHeight={360}
          onMove={handleTextMove}
        />
      ))}

      {/* Sticker overlays */}
      {stickerOverlays.map(sticker => (
        <DraggableStickerOverlay
          key={sticker.id}
          sticker={sticker}
          containerWidth={640}
          containerHeight={360}
          onMove={handleStickerMove}
          onUpdate={handleStickerUpdate}
          onDelete={handleStickerDelete}
        />
      ))}

      <PreviewOverlay
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        project={project}
        currentTime={currentTime}
        projectType={projectType}
      />
    </View>
  );
}

function PreviewOverlay({
  isPlaying, onTogglePlay, project, currentTime, projectType,
}: {
  isPlaying: boolean;
  onTogglePlay: () => void;
  project: Project;
  currentTime: number;
  projectType: string;
}) {
  const isPhoto = projectType === 'photo';

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {projectType !== 'audio' && (
        <View style={styles.infoBadge}>
          <Text style={styles.infoBadgeText}>
            {isPhoto
              ? project.resolution
              : `${project.resolution} \u00B7 ${project.frameRate}fps`
            }
          </Text>
        </View>
      )}
      {!isPhoto && (
        <TouchableOpacity style={styles.playPauseBtn} onPress={onTogglePlay} activeOpacity={0.8}>
          <HugeiconsIcon
            icon={isPlaying ? PauseIcon : PlayIcon}
            size={26}
            color="#fff"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyPreview({ projectType }: { projectType: string }) {
  const icon = projectType === 'audio' ? MusicNote01Icon :
    projectType === 'photo' ? Image01Icon : Film01Icon;
  const label = projectType === 'audio' ? 'Add audio clips to start' :
    projectType === 'photo' ? 'Add photos to start' : 'Add clips to start';

  return (
    <View style={[styles.container, styles.empty]}>
      <HugeiconsIcon icon={icon} size={40} color={colors.textMuted} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  audioContainer: {
    backgroundColor: colors.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flex: 1,
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    width: '80%',
    gap: 2,
  },
  waveformBar: {
    flex: 1,
    backgroundColor: colors.textMuted,
    borderRadius: 2,
    opacity: 0.5,
  },
  // Bottom info bar replaces floating icon + centered overlay
  audioInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.overlay60,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  playPauseSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioClipName: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  audioEmptyText: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },
  mediaWrapper: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageMedia: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface1,
  },
  // B&W overlay (desaturation simulation on native)
  bwOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#808080',
    opacity: 0.5,
    // mixBlendMode not available on native, but this approximation works
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.overlay60,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  infoBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  gradingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.overlay60,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gradingBadgeText: {
    fontSize: 9,
    color: colors.accentText,
    fontWeight: '600',
  },
  playPauseBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.overlay60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.surface1,
  },
  emptyText: {
    fontSize: typography.base,
    color: colors.textMuted,
  },
  // Text overlays
  textOverlayWrapper: {
    position: 'absolute',
    maxWidth: '80%',
  },
  textOverlayText: {
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dragHandle: {
    position: 'absolute',
    top: -14,
    right: 0,
    width: 18,
    height: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerDelete: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
