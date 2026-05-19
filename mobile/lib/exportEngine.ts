import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Project, Clip, TextOverlay, getTextOverlays } from './database';
import { processImage, getTargetDimensions, applyColorGrading } from './imageProcessor';
import { isFFmpegAvailable, runFFmpegCommand } from './ffmpegRunner';
import { buildSingleClipCommand, buildClipAudioFilter } from './ffmpeg';

// Native video processor — try expo-modules-core, then React Native NativeModules as fallback
let nativeVideoProcessor: any = null;
try {
  const { NativeModulesProxy } = require('expo-modules-core');
  nativeVideoProcessor = NativeModulesProxy?.ExpoVideoProcessor ?? null;
} catch {}
if (!nativeVideoProcessor) {
  try {
    const { NativeModules } = require('react-native');
    nativeVideoProcessor = NativeModules?.ExpoVideoProcessor ?? null;
  } catch {}
}

function isNativeProcessorAvailable(): boolean {
  return nativeVideoProcessor != null && typeof nativeVideoProcessor.processVideoClip === 'function';
}

function hasColorEdits(clip: Clip): boolean {
  return clip.brightness !== 0 || clip.contrast !== 0 || clip.saturation !== 0 ||
    clip.temperature !== 0 || clip.tint !== 0 || clip.highlights !== 0 ||
    clip.shadows !== 0 || clip.sharpness !== 0 || !!clip.filter;
}

export type ExportQuality = 'high' | 'medium' | 'low';
export type ExportFormat = 'mp4' | 'mov' | 'mp3' | 'wav' | 'aac' | 'png' | 'jpg' | 'webp';

export interface ExportOptions {
  project: Project;
  clips: Clip[];
  quality: ExportQuality;
  format: ExportFormat;
  onProgress?: (progress: number, label: string) => void;
}

export interface ExportResult {
  success: boolean;
  uri?: string;
  assetId?: string;
  error?: string;
  clipCount?: number;
  metadata?: Record<string, any>;
}

const VIDEO_FORMATS: ExportFormat[] = ['mp4', 'mov'];
const AUDIO_FORMATS: ExportFormat[] = ['mp3', 'wav', 'aac'];
const PHOTO_FORMATS: ExportFormat[] = ['png', 'jpg', 'webp'];

function isVideoFormat(f: ExportFormat): boolean { return VIDEO_FORMATS.includes(f); }
function isAudioFormat(f: ExportFormat): boolean { return AUDIO_FORMATS.includes(f); }
function isPhotoFormat(f: ExportFormat): boolean { return PHOTO_FORMATS.includes(f); }

const QUALITY_MAP: Record<ExportQuality, number> = {
  high: 0.95,
  medium: 0.8,
  low: 0.6,
};

/**
 * Export strategy:
 * 
 * PHOTOS: Full processing pipeline using expo-image-manipulator.
 *   - Resize to target resolution
 *   - Crop, rotate, flip applied natively
 *   - Color grading baked in via GPU (PhotoGLPreview capture) on native + web canvas
 *   - Saved to gallery in FrameStudio album
 * 
 * VIDEO: Source clips saved with processing metadata.
 *   - Trim metadata embedded (start/end offsets)
 *   - Color grading, filters, transitions documented in sidecar JSON
 *   - Speed adjustments noted
 *   - Full FFmpeg transcoding available when ffmpeg-kit-react-native is added
 *   - The ffmpeg.ts command builder is ready — just needs the execution wrapper
 * 
 * AUDIO: Source audio files saved with trim metadata.
 *   - Volume, trim points, speed noted
 *   - Audio mixing across tracks documented
 *   - Real audio processing available with expo-av for playback verification
 */
export async function exportProject(opts: ExportOptions): Promise<ExportResult> {
  const { clips, onProgress, project } = opts;
  const projectType = project.type || 'video';

  let exportClips: Clip[];

  if (projectType === 'audio') {
    exportClips = clips
      .filter(c => c.type === 'audio')
      .sort((a, b) => a.orderIndex - b.orderIndex);
  } else if (projectType === 'photo') {
    exportClips = clips
      .filter(c => c.trackIndex === 0 && c.type === 'image')
      .sort((a, b) => a.orderIndex - b.orderIndex);
  } else {
    const primaryClips = clips
      .filter(c => c.trackIndex === 0 && (c.type === 'video' || c.type === 'image'))
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const audioClips = clips
      .filter(c => c.trackIndex === 2 || c.type === 'audio')
      .sort((a, b) => a.orderIndex - b.orderIndex);
    exportClips = [...primaryClips, ...audioClips];
  }

  if (exportClips.length === 0) {
    const typeLabel = projectType === 'audio' ? 'audio clips' :
      projectType === 'photo' ? 'photos' : 'clips';
    return { success: false, error: `No ${typeLabel} to export` };
  }

  onProgress?.(0.05, 'Preparing export...');

  let textOverlays: TextOverlay[] = [];
  let stickerOverlays: any[] = [];
  if (projectType !== 'audio') {
    try { textOverlays = await getTextOverlays(project.id); } catch {}
    try {
      const { getStickerOverlays } = require('./database');
      stickerOverlays = await getStickerOverlays(project.id);
    } catch {}
  }

  if (Platform.OS === 'web') {
    return await exportForWeb(exportClips, opts, textOverlays);
  }

  return await exportForNative(exportClips, opts, textOverlays, stickerOverlays);
}

async function exportForNative(
  exportClips: Clip[],
  opts: ExportOptions,
  textOverlays: TextOverlay[],
  stickerOverlays: any[] = []
): Promise<ExportResult> {
  const { onProgress, project, format, quality } = opts;
  const projectType = project.type || 'video';

  try {
    onProgress?.(0.1, 'Requesting permissions...');

    // Request media library permissions upfront for all export types
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted' && projectType !== 'audio') {
        // Audio can still save to documentDirectory without gallery permission
        return { success: false, error: 'Gallery permission denied. Please allow media access in your device settings.' };
      }
    } catch (permErr: any) {
      if (projectType !== 'audio') {
        return { success: false, error: `Permission error: ${permErr?.message || 'Could not request gallery access'}` };
      }
    }

    if (projectType === 'audio') {
      // await so try-catch catches any rejections from the inner function
      return await exportAudioNative(exportClips, opts);
    }

    // Photo projects: use per-clip GL-captured images if available (color grading baked in).
    if (projectType === 'photo') {
      const glCapturedUris = new Map<string, string>();
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        for (const clip of exportClips) {
          const perClipKey = `photo_export_${project.id}_${clip.id}`;
          const legacyKey = `photo_export_${project.id}`;
          const uri = await AsyncStorage.getItem(perClipKey) ?? await AsyncStorage.getItem(legacyKey);
          if (uri) {
            glCapturedUris.set(clip.id, uri);
            await AsyncStorage.removeItem(perClipKey).catch(() => {});
            await AsyncStorage.removeItem(legacyKey).catch(() => {});
          }
        }
      } catch {}
      return await exportPhotosNative(exportClips, opts, textOverlays, glCapturedUris.size > 0 ? glCapturedUris : null);
    }

    // Video projects: save with metadata
    return await exportVideoNative(exportClips, opts, textOverlays, stickerOverlays);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Export failed' };
  }
}

/**
 * Photo export: REAL image processing pipeline
 * Uses expo-image-manipulator for resize/crop/rotate/flip
 */
async function exportPhotosNative(
  exportClips: Clip[],
  opts: ExportOptions,
  textOverlays: TextOverlay[],
  glCapturedUris?: Map<string, string> | null
): Promise<ExportResult> {
  try {
  const { onProgress, project, format, quality } = opts;
  const { width: targetW, height: targetH } = getTargetDimensions(
    project.resolution,
    project.aspectRatio
  );
  const qualityVal = QUALITY_MAP[quality];
  const results: string[] = [];

  for (let i = 0; i < exportClips.length; i++) {
    const clip = exportClips[i];
    const progress = 0.15 + (i / exportClips.length) * 0.7;
    onProgress?.(progress, `Processing photo ${i + 1} of ${exportClips.length}...`);
    await new Promise(r => setTimeout(r, 0));

    try {
      let finalUri: string;

      // GL-captured URI has color grading already baked in (GPU-accurate)
      const glUri = glCapturedUris?.get(clip.id);
      if (glUri) {
        onProgress?.(progress + 0.02, `Using GPU-processed photo ${i + 1}...`);
        // Still resize the GL capture to target resolution
        const resized = await processImage(
          { ...clip, uri: glUri, brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, filter: null, cropX: 0, cropY: 0, cropW: 1, cropH: 1, rotation: 0, flipH: false, flipV: false, scaleX: 1, scaleY: 1 },
          targetW, targetH, qualityVal
        );
        finalUri = resized.uri;
      } else {
        // Step 1: Apply geometric transforms (resize, crop, rotate, flip)
        const processed = await processImage(clip, targetW, targetH, qualityVal);

        // Step 2: Apply color grading (web: canvas; native: GL captured above, else skip)
        const hasGrading = clip.brightness !== 0 || clip.contrast !== 0 ||
          clip.saturation !== 0 || clip.temperature !== 0 || clip.tint !== 0 ||
          clip.highlights !== 0 || clip.shadows !== 0 || clip.filter !== null;

        finalUri = processed.uri;

        if (hasGrading) {
          onProgress?.(progress + 0.03, `Applying color grading to photo ${i + 1}...`);
          const gradedUri = await applyColorGrading(
            processed.uri,
            clip,
            `${(FileSystem as any).cacheDirectory}graded_${clip.id}.png`
          );
          if (gradedUri !== processed.uri) finalUri = gradedUri;
        }
      }

      // Step 3: Save to gallery (via cache copy for reliable MediaLibrary access)
      onProgress?.(progress + 0.05, `Saving photo ${i + 1}...`);
      const ext = format === 'jpg' ? 'jpg' : format === 'webp' ? 'webp' : 'png';
      const r = await saveUriToGallery(finalUri, ext, project.name, onProgress);
      if (r.success) results.push(r.uri);
    } catch (err) {
      // If processing fails, try saving the original clip
      try {
        const ext = format === 'jpg' ? 'jpg' : format === 'webp' ? 'webp' : 'png';
        const r = await saveUriToGallery(clip.uri, ext, project.name, onProgress);
        if (r.success) results.push(r.uri);
      } catch {}
    }
  }

  if (results.length === 0) {
    return { success: false, error: 'No photos could be saved to the gallery. Check gallery permissions in device Settings.' };
  }

  onProgress?.(0.95, 'Finalizing...');
  await new Promise(r => setTimeout(r, 200));
  onProgress?.(1.0, 'Done');

  return {
    success: true,
    uri: results[0],
    clipCount: results.length,
    metadata: {
      processedWith: 'expo-image-manipulator',
      resolution: `${targetW}x${targetH}`,
      format,
      quality,
    },
  };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Photo export failed' };
  }
}

/**
 * Video export: save clips with comprehensive edit metadata.
 * The metadata includes full FFmpeg command that can be used
 * if ffmpeg-kit is added later.
 */
async function exportVideoNative(
  exportClips: Clip[],
  opts: ExportOptions,
  textOverlays: TextOverlay[],
  stickerOverlays: any[] = []
): Promise<ExportResult> {
  try {
  const { onProgress, project, format, quality } = opts;
  const results: string[] = [];
  const exportDir = `${(FileSystem as any).cacheDirectory}export_${Date.now()}/`;

  try {
    await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
  } catch {}

  for (let i = 0; i < exportClips.length; i++) {
    const clip = exportClips[i];
    const progress = 0.15 + (i / exportClips.length) * 0.7;
    onProgress?.(progress, `Processing clip ${i + 1} of ${exportClips.length}...`);
    await new Promise(r => setTimeout(r, 0));

    // Image clips: 3D parallax → animated MP4, or static → processed image
    if (clip.type === 'image') {
      const { width: tw, height: th } = getTargetDimensions(project.resolution, project.aspectRatio);

      // Parallax clips: render as real animated MP4 video
      if (clip.parallaxEnabled && isNativeProcessorAvailable()) {
        try {
          const outputPath = `${exportDir}clip_${i}_parallax.mp4`;
          const effectiveDurationMs = (clip.duration - clip.trimStart - clip.trimEnd) / Math.max(0.01, clip.speed);
          onProgress?.(progress + 0.01, `Rendering 3D parallax clip ${i + 1}...`);
          const result = await nativeVideoProcessor.processParallaxVideo({
            inputUri: clip.uri,
            outputPath,
            preset: clip.parallaxPreset ?? 'dolly_in',
            durationMs: Math.round(effectiveDurationMs),
            width: tw,
            height: th,
            fps: project.frameRate ?? 30,
            bitrate: quality === 'high' ? 8_000_000 : quality === 'medium' ? 4_000_000 : 2_000_000,
          });
          if (result.success) {
            const r3d = await saveUriToGallery(result.outputPath, 'mp4', project.name, onProgress);
            if (r3d.success) results.push(r3d.uri);
            onProgress?.(progress + 0.05, `3D clip ${i + 1} rendered`);
            continue;
          }
        } catch (_e) { /* fall through to static processing */ }
      }

      // Ken Burns: render animated MP4 from still image
      if (clip.kenBurns?.enabled && isNativeProcessorAvailable()) {
        try {
          // Divide by speed so a 0.5x Ken Burns clip plays at half rate
          const effectiveDurationMs = (clip.duration - clip.trimStart - clip.trimEnd) / Math.max(0.01, clip.speed);
          const kbOutput = `${exportDir}clip_${i}_kenburns.mp4`;
          const kbResult = await nativeVideoProcessor.processKenBurnsVideo({
            inputUri: clip.uri,
            outputPath: kbOutput,
            startX:    clip.kenBurns.startX,
            startY:    clip.kenBurns.startY,
            startZoom: clip.kenBurns.startZoom,
            endX:      clip.kenBurns.endX,
            endY:      clip.kenBurns.endY,
            endZoom:   clip.kenBurns.endZoom,
            durationMs: effectiveDurationMs,
            width: tw, height: th,
            bitrate: quality === 'high' ? 8_000_000 : quality === 'medium' ? 4_000_000 : 2_000_000,
            fps: project.frameRate ?? 30,
          });
          if (kbResult.success) {
            const rkb = await saveUriToGallery(kbResult.outputPath, 'mp4', project.name, onProgress);
            if (rkb.success) results.push(rkb.uri);
            continue;
          }
        } catch {} // fall through to static
      }

      // Static image: apply crop/resize/color grade
      try {
        const processed = await processImage(clip, tw, th, QUALITY_MAP[quality]);
        const rImg = await saveUriToGallery(processed.uri, 'jpg', project.name, onProgress);
        if (rImg.success) results.push(rImg.uri);
        continue;
      } catch {}
    }

    // Video clips — fast streaming MediaCodec pipeline with effects + text overlays
    if (clip.type === 'video' && isNativeProcessorAvailable()) {
      const effectiveDurationMs = clip.duration - clip.trimStart - clip.trimEnd;
      const outputPath = `${exportDir}clip_${i}.mp4`;
      const { width: tw, height: th } = getTargetDimensions(project.resolution, project.aspectRatio);

      // Build text overlay data for this clip's time range (burn captions in)
      const clipStartMs = clip.startTime;
      const clipEndMs = clip.startTime + effectiveDurationMs / clip.speed;
      const activeTextOverlays = textOverlays
        .filter(t => t.startTime < clipEndMs && t.startTime + t.duration > clipStartMs)
        .map(t => ({
          text: t.content,
          x: t.positionX,
          y: t.positionY,
          fontSize: t.fontSize,
          color: t.color,
          shadow: t.shadow,
          outline: t.outline,
          outlineColor: t.outlineColor,
          bgColor: t.backgroundColor,
          animation: t.animation ?? 'none',
          // Convert timeline ms to clip-relative ms
          startMs: Math.max(0, t.startTime - clipStartMs),
          durationMs: t.duration,
        }));

      // Check if the NEXT clip has a transition — if so, this clip must go through
      // the full processing path so renderTransition() can be called at the end.
      const nextClip = exportClips[i + 1];
      const needsTransition = !!(nextClip?.transitionType && nextClip.transitionType !== 'none' && nextClip.transitionDuration > 0);

      try {
        if (hasColorEdits(clip) || activeTextOverlays.length > 0 || needsTransition) {
          // FAST PIPELINE: streaming MediaCodec decode → Canvas effects + text → re-encode
          // ~3-8 seconds for 10s clip (5-8x faster than frame-seek approach)
          onProgress?.(progress + 0.01, `Processing clip ${i + 1}...`);
          const result = await nativeVideoProcessor.processVideoWithEffects({
            inputUri: clip.uri,
            outputPath,
            trimStartMs: clip.trimStart,
            durationMs: effectiveDurationMs,
            speed: clip.speed,
            reverse:   clip.reverse   ?? false,
            denoise:   clip.denoise   ?? false,
            stabilize: clip.stabilize ?? false,
            chromaKeyEnabled:   clip.chromaKeyEnabled   ?? false,
            chromaKeyColor:     clip.chromaKeyColor     ?? '#00FF00',
            chromaKeyThreshold: clip.chromaKeyThreshold ?? 30,
            backgroundRemovalEnabled:   (clip as any).backgroundRemovalEnabled   ?? false,
            backgroundReplacementColor: (clip as any).backgroundReplacementColor ?? '#000000',
            backgroundFeather:          (clip as any).backgroundFeather          ?? 5,
            brightness: clip.brightness,
            contrast: clip.contrast,
            saturation: clip.saturation,
            temperature: clip.temperature,
            tint: clip.tint,
            highlights: clip.highlights,
            shadows: clip.shadows,
            // Ken Burns (images only — the native module ignores for video)
            kenBurnsEnabled: clip.kenBurns?.enabled ?? false,
            kenBurnsStartX:  clip.kenBurns?.startX  ?? 0.5,
            kenBurnsStartY:  clip.kenBurns?.startY  ?? 0.5,
            kenBurnsStartZoom: clip.kenBurns?.startZoom ?? 1.0,
            kenBurnsEndX:    clip.kenBurns?.endX    ?? 0.5,
            kenBurnsEndY:    clip.kenBurns?.endY    ?? 0.5,
            kenBurnsEndZoom: clip.kenBurns?.endZoom ?? 1.2,
            kenBurnsDurationMs: effectiveDurationMs,
            width: tw,
            height: th,
            bitrate: quality === 'high' ? 8_000_000 : quality === 'medium' ? 4_000_000 : 2_000_000,
            fps: project.frameRate ?? 30,
            textOverlays: activeTextOverlays,
            stickerOverlays: stickerOverlays
              .filter(s => s.duration === 0 || (s.startTime < clipEndMs && s.startTime + s.duration > clipStartMs))
              .map(s => ({
                uri: s.uri,
                x: s.positionX,
                y: s.positionY,
                scale: s.scale ?? 1,
                rotation: s.rotation ?? 0,
                opacity: s.opacity ?? 1,
                flipH: s.flipH ?? false,
                flipV: s.flipV ?? false,
                startMs: Math.max(0, s.startTime - clipStartMs),
                durationMs: s.duration === 0 ? Number.MAX_SAFE_INTEGER : s.duration,
              })),
          });
          if (result.success) {
            // Render transition to NEXT clip if configured (nextClip declared above)
            if (nextClip?.transitionType && nextClip.transitionType !== 'none' && nextClip.transitionDuration > 0) {
              try {
                const nextOutput = `${exportDir}clip_${i + 1}.mp4`;
                const nextEffDur = nextClip.duration - nextClip.trimStart - nextClip.trimEnd;
                // Quick process next clip first (will be overwritten later with full processing)
                await nativeVideoProcessor.processVideoWithEffects({
                  inputUri: nextClip.uri, outputPath: nextOutput,
                  trimStartMs: nextClip.trimStart, durationMs: nextEffDur, speed: nextClip.speed,
                  brightness: nextClip.brightness, contrast: nextClip.contrast, saturation: nextClip.saturation,
                  temperature: nextClip.temperature, tint: nextClip.tint, highlights: nextClip.highlights,
                  shadows: nextClip.shadows, width: tw, height: th,
                  bitrate: quality === 'high' ? 8_000_000 : 4_000_000,
                  fps: project.frameRate ?? 30,
                  textOverlays: [],
                });
                const transPath = `${exportDir}transition_${i}_${i + 1}.mp4`;
                await nativeVideoProcessor.renderTransition({
                  clipAPath: result.outputPath, clipBPath: nextOutput,
                  outputPath: transPath, type: nextClip.transitionType,
                  durationMs: nextClip.transitionDuration, width: tw, height: th,
                  fps: project.frameRate ?? 30,
                  bitrate: quality === 'high' ? 8_000_000 : 4_000_000,
                });
                // Push processed clip (minus transition end) + transition segment
                // Note: the next clip will be re-processed in the loop with proper settings
                const rtrans = await saveUriToGallery(result.outputPath, 'mp4', project.name, onProgress);
                if (rtrans.success) results.push(rtrans.uri);
                try {
                  const rt2 = await saveUriToGallery(transPath, 'mp4', project.name, onProgress);
                  if (rt2.success) results.push(rt2.uri);
                } catch {}
                onProgress?.(progress + 0.05, `Clip ${i + 1} + transition rendered`);
                continue;
              } catch { /* transition failed, just push clip normally */ }
            }
            const rc = await saveUriToGallery(result.outputPath, 'mp4', project.name, onProgress);
            if (rc.success) results.push(rc.uri);
            onProgress?.(progress + 0.05, `Clip ${i + 1} processed`);
            continue;
          }
        } else {
          // LOSSLESS TRIM: fast remux, no re-encode needed
          onProgress?.(progress + 0.01, `Trimming clip ${i + 1}...`);
          const result = await nativeVideoProcessor.processVideoClip({
            inputUri: clip.uri, outputPath,
            trimStartMs: clip.trimStart, durationMs: effectiveDurationMs,
            speed: clip.speed, volume: clip.volume, reverse: clip.reverse ?? false,
          });
          if (result.success) {
            const rl = await saveUriToGallery(result.outputPath, 'mp4', project.name, onProgress);
            if (rl.success) results.push(rl.uri);
            onProgress?.(progress + 0.05, `Clip ${i + 1} saved`);
            continue;
          }
        }
      } catch (_e) {
        // Fall through to fallback
      }
    }

    // FFmpeg path: full transcoding with filters/color grade baked in
    if (clip.type === 'video' && isFFmpegAvailable()) {
      try {
        const { width: tw, height: th } = getTargetDimensions(project.resolution, project.aspectRatio);
        const outputPath = `${exportDir}clip_${i}.${format}`;
        const effectiveDurationSec = (clip.duration - clip.trimStart - clip.trimEnd) / (clip.speed * 1000);
        const ffmpegCmd = buildSingleClipCommand(clip, outputPath, tw, th, format as 'mp4' | 'mov', quality);
        const ffmpegResult = await runFFmpegCommand(ffmpegCmd, effectiveDurationSec, (p, label) => {
          onProgress?.(progress + (p / exportClips.length) * 0.7, label);
        });
        if (ffmpegResult.success) {
          const rff = await saveUriToGallery(outputPath, format, project.name, onProgress);
          if (rff.success) results.push(rff.uri);
          continue;
        }
      } catch {}
    }

    // Final fallback: source copy without effects applied
    onProgress?.(progress + 0.02, `Saving clip ${i + 1} (effects not applied — rebuild APK to enable)...`);
    const result = await saveSingleClip(clip, opts);
    if (result.uri) results.push(result.uri);
  }

  // Write comprehensive sidecar metadata
  try {
    const metadataPath = `${exportDir}edit_metadata.json`;
    const metadata = {
      version: '1.0',
      generator: 'FrameStudio',
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        type: project.type,
        resolution: project.resolution,
        frameRate: project.frameRate,
        aspectRatio: project.aspectRatio,
      },
      timeline: exportClips.map((c, idx) => ({
        index: idx,
        name: c.name,
        type: c.type,
        track: c.trackIndex,
        // Trim info
        trimStart_sec: c.trimStart / 1000,
        trimEnd_sec: c.trimEnd / 1000,
        effectiveDuration_sec: (c.duration - c.trimStart - c.trimEnd) / (c.speed * 1000),
        speed: c.speed,
        startTime_sec: c.startTime / 1000,
        // Audio
        volume: c.volume,
        // Color grading
        colorGrading: {
          brightness: c.brightness,
          contrast: c.contrast,
          saturation: c.saturation,
          temperature: c.temperature,
          tint: c.tint,
          highlights: c.highlights,
          shadows: c.shadows,
          sharpness: c.sharpness,
          filter: c.filter,
          filterIntensity: c.filterIntensity,
          lutName: c.lutName || null,
        },
        // Transform
        transform: {
          rotation: c.rotation,
          scaleX: c.scaleX,
          scaleY: c.scaleY,
          crop: { x: c.cropX, y: c.cropY, w: c.cropW, h: c.cropH },
        },
        // Transition
        transition: {
          type: c.transitionType,
          duration_ms: c.transitionDuration,
        },
      })),
      textOverlays: textOverlays.map(t => ({
        content: t.content,
        position: { x: t.positionX, y: t.positionY },
        startTime_sec: t.startTime / 1000,
        duration_sec: t.duration / 1000,
        fontSize: t.fontSize,
        color: t.color,
        fontFamily: t.fontFamily,
        shadow: t.shadow,
        outline: t.outline,
        animation: t.animation,
      })),
      notes: [
        'Edit metadata for FrameStudio project.',
        'Trim, speed, color grading, transitions documented above.',
        'To apply all edits, use the FFmpeg commands in ffmpeg.ts or process via ffmpeg-kit-react-native.',
        'Image clips have been processed with expo-image-manipulator.',
        'Video clips are saved at source quality with edit metadata.',
      ],
    };
    await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(metadata, null, 2));
  } catch {}

  onProgress?.(0.95, 'Finalizing...');
  await new Promise(r => setTimeout(r, 200));
  onProgress?.(1.0, 'Done');

  if (results.length === 0) {
    return { success: false, error: 'No clips could be saved to the gallery. Check that media files are still accessible.' };
  }

  return {
    success: true,
    uri: results[0],
    clipCount: results.length,
    metadata: {
      note: results.length > 1 ? `${results.length} clips saved to gallery.` : 'Saved to gallery.',
    },
  };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Video export failed' };
  }
}

async function exportAudioNative(
  exportClips: Clip[],
  opts: ExportOptions
): Promise<ExportResult> {
  const { onProgress, project, format } = opts;

  try {
    const results: string[] = [];

    for (let i = 0; i < exportClips.length; i++) {
      const clip = exportClips[i];
      const progress = 0.15 + (i / exportClips.length) * 0.75;
      onProgress?.(progress, `Saving audio ${i + 1} of ${exportClips.length}...`);
      await new Promise(r => setTimeout(r, 0));

      let localUri = clip.uri;

      // If URI doesn't exist locally, try to download it
      try {
        const info = await FileSystem.getInfoAsync(clip.uri);
        if (!info.exists && clip.uri.startsWith('http')) {
          onProgress?.(progress, 'Downloading audio...');
          const dest = `${(FileSystem as any).cacheDirectory}export_audio_tmp_${clip.id}.${format}`;
          const dl = await FileSystem.downloadAsync(clip.uri, dest);
          localUri = dl.uri;
        } else if (!info.exists) {
          continue; // skip missing clip
        }
      } catch { continue; }

      // Save to app's documents directory (user-accessible via Files app)
      const safeName = project.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') || 'audio';
      const timestamp = Date.now();
      const destPath = `${(FileSystem as any).documentDirectory}FrameStudio_${safeName}_${i + 1}_${timestamp}.${format}`;

      if (isFFmpegAvailable()) {
        try {
          const durationSec = (clip.duration - clip.trimStart - clip.trimEnd) / (clip.speed * 1000);
          const ssSec = clip.trimStart / 1000;
          const af = buildClipAudioFilter(clip);
          const audioArgs = af ? `-af "${af}"` : '';
          const ffmpegCmd = `-ss ${ssSec.toFixed(3)} -i "${localUri}" -t ${durationSec.toFixed(3)} ${audioArgs} -y "${destPath}"`;
          
          onProgress?.(progress + 0.1, 'Applying audio effects...');
          const result = await runFFmpegCommand(ffmpegCmd, durationSec, () => {});
          if (!result.success) throw new Error('FFmpeg failed');
        } catch {
          await FileSystem.copyAsync({ from: localUri, to: destPath });
        }
      } else {
        await FileSystem.copyAsync({ from: localUri, to: destPath });
      }

      results.push(destPath);

      // Also try saving to MediaStore (music library) — best-effort, won't crash if fails
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          const asset = await MediaLibrary.createAssetAsync(destPath);
          let album = await MediaLibrary.getAlbumAsync('FrameStudio');
          if (!album) album = await MediaLibrary.createAlbumAsync('FrameStudio', asset, false);
          else await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      } catch {} // Non-fatal — the file is already saved to documentDirectory
    }

    if (results.length === 0) {
      return { success: false, error: 'No audio files could be saved' };
    }

    onProgress?.(0.95, 'Finalizing...');
    await new Promise(r => setTimeout(r, 200));
    onProgress?.(1.0, 'Done');

    return {
      success: true,
      uri: results[0],
      clipCount: results.length,
      metadata: { savedTo: 'documents', paths: results },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Audio export failed' };
  }
}

/**
 * Reliably save a local file to the device gallery.
 *
 * Copies to cache first so MediaLibrary can always read it regardless
 * of whether the source is in app-private storage (documentDirectory).
 * If gallery write fails, saves to documentDirectory as a fallback and
 * returns the path so the user can find it in the Files app.
 */
/**
 * Save a processed file to the device gallery AND keep a shareable file:// copy.
 *
 * Returns a file:// URI (not content://) so expo-sharing can share the file directly.
 * The file is also saved to the gallery via MediaLibrary.
 */
async function saveUriToGallery(
  sourceUri: string,
  ext: string,
  projectName: string,
  onProgress?: (p: number, label: string) => void
): Promise<{ success: boolean; uri: string; error?: string }> {
  const cacheDir = (FileSystem as any).cacheDirectory as string;
  const docDir = (FileSystem as any).documentDirectory as string;
  const cacheUri = `${cacheDir}gallery_tmp_${Date.now()}.${ext}`;

  // Permanent shareable copy in documentDirectory/exports/ — file:// URI, always accessible
  const safeName = projectName.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'export';
  const exportsDir = `${docDir}exports/`;
  const shareableUri = `${exportsDir}FrameStudio_${safeName}_${Date.now()}.${ext}`;

  try {
    await FileSystem.makeDirectoryAsync(exportsDir, { intermediates: true }).catch(() => {});

    // Step 1: Copy source to cache for MediaLibrary access
    await FileSystem.copyAsync({ from: sourceUri, to: cacheUri });

    // Step 2: Also copy to our exports folder — this is what we return for sharing
    await FileSystem.copyAsync({ from: sourceUri, to: shareableUri });

    // Step 3: Save to gallery
    onProgress?.(0.75, 'Saving to gallery...');
    try {
      const asset = await MediaLibrary.createAssetAsync(cacheUri);
      // Organize into FrameStudio album (best-effort)
      try {
        let album = await MediaLibrary.getAlbumAsync('FrameStudio');
        if (!album) {
          album = await MediaLibrary.createAlbumAsync('FrameStudio', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      } catch {}
    } catch (galleryErr: any) {
      // Gallery save failed — file is still in exports folder, log the error
      console.warn('[Export] Gallery save failed:', galleryErr?.message);
    }

    // Clean up the temporary cache copy
    FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(() => {});

    // Return the permanent file:// URI — usable for sharing with expo-sharing
    return { success: true, uri: shareableUri };
  } catch (err: any) {
    FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(() => {});
    FileSystem.deleteAsync(shareableUri, { idempotent: true }).catch(() => {});

    // Last resort: save directly to documentDirectory root
    try {
      const fallback = `${docDir}FrameStudio_${safeName}_${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: sourceUri, to: fallback });
      return { success: true, uri: fallback, error: 'Gallery save failed, file saved locally' };
    } catch {
      return { success: false, uri: sourceUri, error: err?.message || 'Export save failed' };
    }
  }
}

async function saveSingleClip(clip: Clip, opts: ExportOptions): Promise<ExportResult> {
  const { onProgress, project } = opts;

  // Determine file extension
  const ext = isPhotoFormat(opts.format) ? opts.format : (clip.type === 'image' ? 'jpg' : 'mp4');

  // Handle remote URIs
  let localUri = clip.uri;
  if (clip.uri.startsWith('http')) {
    try {
      onProgress?.(0.3, 'Downloading source...');
      const dest = `${(FileSystem as any).cacheDirectory}export_clip_${clip.id}.${ext}`;
      const dl = await FileSystem.downloadAsync(clip.uri, dest);
      localUri = dl.uri;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Download failed' };
    }
  } else {
    // Verify local file exists
    try {
      const info = await FileSystem.getInfoAsync(clip.uri);
      if (!info.exists) {
        return { success: false, error: `Source file not found: ${clip.name || clip.uri}` };
      }
    } catch {
      // content:// URIs may fail getInfoAsync — proceed anyway
    }
  }

  let finalUri = localUri;
  if (clip.type !== 'image' && isFFmpegAvailable()) {
    try {
      const { width: tw, height: th } = getTargetDimensions(project.resolution, project.aspectRatio);
      const outputPath = `${(FileSystem as any).cacheDirectory}ffmpeg_fallback_${clip.id}.${ext}`;
      const ffmpegCmd = buildSingleClipCommand(clip, outputPath, tw, th, ext as 'mp4'|'mov', opts.quality);
      const durationSec = (clip.duration - clip.trimStart - clip.trimEnd) / 1000;
      const ffmpegResult = await runFFmpegCommand(ffmpegCmd, durationSec, () => {});
      if (ffmpegResult.success) {
        finalUri = outputPath;
      }
    } catch {}
  }

  onProgress?.(0.5, 'Saving to gallery...');
  const r = await saveUriToGallery(finalUri, ext, project.name, onProgress);
  return {
    success: r.success,
    uri: r.uri,
    metadata: r.error ? { note: r.error } : undefined,
  };
}

async function exportForWeb(
  exportClips: Clip[],
  opts: ExportOptions,
  textOverlays: TextOverlay[]
): Promise<ExportResult> {
  const { onProgress, format, project, quality } = opts;
  const projectType = project.type || 'video';

  onProgress?.(0.1, 'Processing...');

  // For photo projects on web, apply full color grading via canvas
  if (projectType === 'photo' && typeof document !== 'undefined') {
    return exportPhotosWeb(exportClips, opts, textOverlays);
  }

  // For video/audio on web: trigger download
  onProgress?.(0.3, 'Preparing download...');
  const clip = exportClips[0];

  try {
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = clip.uri;
      a.download = `${project.name.replace(/\s+/g, '_')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    onProgress?.(1.0, 'Done');
    return { success: true, uri: clip.uri };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Web export failed' };
  }
}

/**
 * Web photo export with REAL color grading via Canvas API
 */
async function exportPhotosWeb(
  exportClips: Clip[],
  opts: ExportOptions,
  textOverlays: TextOverlay[]
): Promise<ExportResult> {
  const { onProgress, format, project, quality } = opts;
  const { width: tw, height: th } = getTargetDimensions(project.resolution, project.aspectRatio);

  for (let i = 0; i < exportClips.length; i++) {
    const clip = exportClips[i];
    const progress = 0.1 + (i / exportClips.length) * 0.8;
    onProgress?.(progress, `Processing photo ${i + 1}...`);

    try {
      const processedDataUrl = await applyColorGrading(clip.uri, clip, '');

      if (typeof document !== 'undefined') {
        const a = document.createElement('a');
        a.href = processedDataUrl;
        a.download = `${project.name.replace(/\s+/g, '_')}_${i + 1}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      // Fallback to raw download
      if (typeof document !== 'undefined') {
        const a = document.createElement('a');
        a.href = clip.uri;
        a.download = `${project.name.replace(/\s+/g, '_')}_${i + 1}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  }

  onProgress?.(1.0, 'Done');
  return { success: true, uri: exportClips[0]?.uri, clipCount: exportClips.length };
}

export function getResolutionLabel(resolution: Project['resolution']): string {
  const map: Record<string, string> = {
    '4K': '3840x2160',
    '2K': '2560x1440',
    '1080p': '1920x1080',
    '720p': '1280x720',
    '480p': '854x480',
  };
  return map[resolution] || resolution;
}

export function estimateFileSize(
  clips: Clip[],
  quality: ExportQuality,
  resolution: Project['resolution'],
  projectType?: string
): string {
  const totalSec = clips.reduce((acc, c) => {
    const dur = (c.duration ?? 0) - (c.trimStart ?? 0) - (c.trimEnd ?? 0);
    const effectiveDuration = dur / Math.max(0.01, c.speed ?? 1);
    const secs = isFinite(effectiveDuration) ? effectiveDuration / 1000 : 0;
    return acc + secs;
  }, 0);

  if (projectType === 'audio') {
    const audioBitrates: Record<string, number> = { high: 320, medium: 192, low: 128 };
    const kbps = audioBitrates[quality] || 192;
    const mb = (kbps * totalSec) / 8 / 1024;
    return mb >= 1 ? `~${mb.toFixed(1)} MB` : `~${Math.round(mb * 1024)} KB`;
  }

  if (projectType === 'photo') {
    const photoSizes: Record<string, Record<string, number>> = {
      '4K': { high: 12, medium: 6, low: 3 },
      '2K': { high: 6, medium: 3, low: 1.5 },
      '1080p': { high: 3, medium: 1.5, low: 0.8 },
      '720p': { high: 1.5, medium: 0.8, low: 0.4 },
      '480p': { high: 0.8, medium: 0.4, low: 0.2 },
    };
    const perPhoto = photoSizes[resolution]?.[quality] || 2;
    const count = clips.length || 1;
    const totalMb = perPhoto * count;
    return totalMb >= 1 ? `~${totalMb.toFixed(1)} MB` : `~${Math.round(totalMb * 1024)} KB`;
  }

  const bitrates: Record<string, Record<string, number>> = {
    '4K':    { high: 50, medium: 25, low: 12 },
    '2K':    { high: 25, medium: 15, low: 8 },
    '1080p': { high: 16, medium: 8,  low: 4 },
    '720p':  { high: 8,  medium: 4,  low: 2 },
    '480p':  { high: 4,  medium: 2,  low: 1 },
  };
  const mbps = bitrates[resolution]?.[quality] || 8;
  const mb = (mbps * totalSec) / 8;
  return mb >= 1000 ? `~${(mb / 1024).toFixed(1)} GB` : `~${Math.round(mb)} MB`;
}
