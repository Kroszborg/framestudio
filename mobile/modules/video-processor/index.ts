import { NativeModulesProxy } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface VideoProcessorClip {
  /** Local file URI (file:// or content://) */
  inputUri: string;
  /** Output file path (absolute) */
  outputPath: string;
  /** Trim start in ms from source beginning */
  trimStartMs: number;
  /** Effective duration to extract in ms (source time, before speed) */
  durationMs: number;
  /** Playback speed multiplier — 0.5 = half speed, 2.0 = double speed */
  speed: number;
  /** Volume multiplier 0-2 */
  volume?: number;
  /** Reverse the clip (requires full re-encode — slower) */
  reverse?: boolean;
}

export interface VideoProcessorResult {
  outputPath: string;
  durationMs: number;
  success: boolean;
}

// Lazy-load native module — gracefully returns null on web / if module not linked
const VideoProcessorNative: any =
  Platform.OS !== 'web' ? NativeModulesProxy.ExpoVideoProcessor : null;

export function isVideoProcessorAvailable(): boolean {
  return VideoProcessorNative != null;
}

/**
 * Process a single video clip: trim to the specified range and adjust speed.
 * Uses Android MediaExtractor + MediaMuxer — no re-encoding, lossless quality.
 *
 * Note: color grading / filters require a full decode-encode pipeline and
 * are NOT applied by this module (they require OpenGL shaders or FFmpeg).
 */
export async function processVideoClip(
  clip: VideoProcessorClip
): Promise<VideoProcessorResult> {
  if (!VideoProcessorNative) {
    throw new Error('ExpoVideoProcessor native module is not available on this platform.');
  }
  return VideoProcessorNative.processVideoClip({
    inputUri: clip.inputUri,
    outputPath: clip.outputPath,
    trimStartMs: clip.trimStartMs,
    durationMs: clip.durationMs,
    speed: clip.speed ?? 1.0,
    volume: clip.volume ?? 1.0,
    reverse: clip.reverse ?? false,
  });
}

/**
 * Concatenate multiple pre-processed clips into one output file.
 * All clips must already be trimmed / speed-adjusted.
 * Clips must share the same codec (same source file or already re-encoded).
 */
export async function concatenateClips(
  inputPaths: string[],
  outputPath: string,
  onProgress?: (progress: number) => void
): Promise<VideoProcessorResult> {
  if (!VideoProcessorNative) {
    throw new Error('ExpoVideoProcessor native module is not available on this platform.');
  }
  return VideoProcessorNative.concatenateClips({ inputPaths, outputPath });
}

export interface ParallaxVideoOptions {
  inputUri: string;
  outputPath: string;
  preset: 'dolly_in' | 'pan_left' | 'pan_right' | 'orbit' | 'push_forward' | 'drift';
  durationMs: number;
  width: number;
  height: number;
  fps?: number;
  bitrate?: number;
}

/**
 * Render a 3D parallax camera animation from a still image → real MP4 video.
 * Uses Android Canvas + MediaCodec — no FFmpeg needed.
 * Each frame: camera transform applied to source image, encoded to H.264.
 */
export async function processParallaxVideo(opts: ParallaxVideoOptions): Promise<VideoProcessorResult> {
  if (!VideoProcessorNative) {
    throw new Error('ExpoVideoProcessor native module is not available on this platform.');
  }
  return VideoProcessorNative.processParallaxVideo({
    inputUri: opts.inputUri,
    outputPath: opts.outputPath,
    preset: opts.preset,
    durationMs: opts.durationMs,
    width: opts.width,
    height: opts.height,
    fps: opts.fps ?? 30,
    bitrate: opts.bitrate ?? 8_000_000,
  });
}
