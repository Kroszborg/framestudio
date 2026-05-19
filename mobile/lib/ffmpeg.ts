/**
 * FFmpeg command builder for FrameStudio
 * Generates FFmpeg filter chains for video processing
 *
 * NOTE: In production, this would use ffmpeg-expo (kingjnr4) or similar
 * FFmpeg wrapper for Expo. The command builder is framework-agnostic.
 */

import type { Clip, AudioTrack, TextOverlay } from './database';

interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm';
  outputPath: string;
}

// Filter definitions mapped to FFmpeg filter chains
const FILTER_MAP: Record<string, string> = {
  vhs: 'colorbalance=rs=0.1:gs=-0.1:bs=0.2,noise=alls=20:allf=t+u,curves=vintage',
  bw: 'hue=s=0',
  glow: 'unsharp=3:3:-1.5:3:3:-1.5,eq=brightness=0.06:saturation=1.3',
  cinematic: 'colorbalance=rs=-0.1:gs=0.05:bs=0.15:rh=-0.1:gh=0.05:bh=0.1,eq=contrast=1.1',
  blur: 'boxblur=10:1',
  neon: 'eq=contrast=1.5:brightness=0.1:saturation=2.5',
  sepia: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
  vintage: 'curves=vintage,eq=brightness=0.04:saturation=0.8',
  cool: 'colorbalance=bs=0.15:bm=0.1:bh=0.05',
  warm: 'colorbalance=rs=0.1:rm=0.05:gs=0.05:gm=0.03',
  dramatic: 'eq=contrast=1.5:brightness=-0.05:saturation=0.7',
};

/**
 * Build FFmpeg video filter string for a single clip
 */
export function buildClipFilter(clip: Clip): string {
  const filters: string[] = [];

  // Apply named filter
  if (clip.filter && FILTER_MAP[clip.filter]) {
    filters.push(FILTER_MAP[clip.filter]);
  }

  // Color adjustments (defaults are 0 for brightness/contrast/saturation)
  const eqParts: string[] = [];
  if (clip.brightness !== 0) eqParts.push(`brightness=${clip.brightness / 100}`);
  if (clip.contrast !== 0) eqParts.push(`contrast=${1 + clip.contrast / 100}`);
  if (clip.saturation !== 0) eqParts.push(`saturation=${1 + clip.saturation / 100}`);
  if (eqParts.length > 0) {
    filters.push(`eq=${eqParts.join(':')}`);
  }

  // Transform
  if (clip.rotation !== 0) {
    filters.push(`rotate=${(clip.rotation * Math.PI) / 180}`);
  }
  if (clip.scaleX !== 1 || clip.scaleY !== 1) {
    filters.push(`scale=iw*${clip.scaleX}:ih*${clip.scaleY}`);
  }

  // Reverse video
  if (clip.reverse) {
    filters.push('reverse');
  }

  // Quality enhancer: unsharp mask + 3D denoise
  if ((clip as any).enhance) {
    filters.push('unsharp=3:3:1.5:3:3:0,hqdn3d=1.5:1.5:6:6');
  }

  return filters.join(',');
}

/**
 * Build audio filter string for a clip (volume, fades)
 */
export function buildClipAudioFilter(clip: Clip): string {
  const filters: string[] = [];
  const effDurSec = (clip.duration - clip.trimStart - clip.trimEnd) / (clip.speed * 1000);

  // Volume
  if (clip.volume !== 1) filters.push(`volume=${clip.volume.toFixed(3)}`);

  // Fade in/out
  if ((clip.fadeIn ?? 0) > 0) {
    filters.push(`afade=t=in:d=${((clip.fadeIn ?? 0) / 1000).toFixed(3)}`);
  }
  if ((clip.fadeOut ?? 0) > 0) {
    const start = Math.max(0, effDurSec - (clip.fadeOut ?? 0) / 1000);
    filters.push(`afade=t=out:st=${start.toFixed(3)}:d=${((clip.fadeOut ?? 0) / 1000).toFixed(3)}`);
  }

  // Reverse audio (must match video reverse)
  if (clip.reverse) filters.push('areverse');

  return filters.join(',');
}

/**
 * Build FFmpeg drawtext filter for text overlays
 */
export function buildTextFilter(overlay: TextOverlay, width: number, height: number): string {
  const x = Math.round(overlay.positionX * width);
  const y = Math.round(overlay.positionY * height);
  const escapedText = overlay.content.replace(/'/g, "\\'").replace(/:/g, '\\:');

  const parts = [
    `text='${escapedText}'`,
    `fontsize=${overlay.fontSize}`,
    `fontcolor=${overlay.color}`,
    `x=${x}`,
    `y=${y}`,
    `enable='between(t,${overlay.startTime},${overlay.startTime + overlay.duration})'`,
  ];

  if (overlay.shadow) {
    parts.push('shadowcolor=black', 'shadowx=2', 'shadowy=2');
  }

  if (overlay.outline) {
    parts.push(`bordercolor=${overlay.outlineColor}`, 'borderw=2');
  }

  if (overlay.backgroundColor) {
    parts.push(`box=1`, `boxcolor=${overlay.backgroundColor}`, `boxborderw=5`);
  }

  return `drawtext=${parts.join(':')}`;
}

/**
 * Build the complete FFmpeg command for export
 */
export function buildExportCommand(
  clips: Clip[],
  audioTracks: AudioTrack[],
  textOverlays: TextOverlay[],
  options: ExportOptions
): string[] {
  const args: string[] = [];

  // Input files
  clips.forEach((clip) => {
    args.push('-i', clip.uri);
  });
  audioTracks
    .filter((a) => !a.isMuted)
    .forEach((track) => {
      args.push('-i', track.sourceUri);
    });

  // Build complex filter graph
  const filterParts: string[] = [];
  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);

  sortedClips.forEach((clip, i) => {
    const clipFilter = buildClipFilter(clip);
    const trimStartSec = clip.trimStart / 1000;
    const durationSec = (clip.duration - clip.trimStart - clip.trimEnd) / 1000;
    const trimFilter = `trim=start=${trimStartSec}:duration=${durationSec},setpts=PTS-STARTPTS`;
    const scaleFilter = `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2`;

    const fullFilter = [trimFilter, scaleFilter, clipFilter].filter(Boolean).join(',');
    filterParts.push(`[${i}:v]${fullFilter}[v${i}]`);
  });

  // Concat video clips
  if (sortedClips.length > 0) {
    const inputs = sortedClips.map((_, i) => `[v${i}]`).join('');
    filterParts.push(`${inputs}concat=n=${sortedClips.length}:v=1:a=0[vout]`);
  }

  // Add text overlays
  let lastOutput = 'vout';
  textOverlays.forEach((overlay, i) => {
    const textFilter = buildTextFilter(overlay, options.width, options.height);
    const newOutput = `vtxt${i}`;
    filterParts.push(`[${lastOutput}]${textFilter}[${newOutput}]`);
    lastOutput = newOutput;
  });

  if (filterParts.length > 0) {
    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', `[${lastOutput}]`);
  }

  // Audio mixing
  const activeTracks = audioTracks.filter((a) => !a.isMuted);
  if (activeTracks.length > 0) {
    const audioInputs = activeTracks
      .map((track, i) => {
        const idx = clips.length + i;
        return `[${idx}:a]volume=${track.volume},atrim=start=${track.trimStart}:duration=${track.duration},asetpts=PTS-STARTPTS,adelay=${Math.round(track.startTime * 1000)}|${Math.round(track.startTime * 1000)}[a${i}]`;
      });
    filterParts.push(...audioInputs);

    if (activeTracks.length > 1) {
      const aMix = activeTracks.map((_, i) => `[a${i}]`).join('');
      filterParts.push(`${aMix}amix=inputs=${activeTracks.length}[aout]`);
      args.push('-map', '[aout]');
    } else {
      args.push('-map', '[a0]');
    }
  }

  // Output settings
  args.push('-r', String(options.fps));
  if (options.format === 'mp4') {
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23');
    args.push('-c:a', 'aac', '-b:a', '192k');
    args.push('-pix_fmt', 'yuv420p');
  } else {
    args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0');
    args.push('-c:a', 'libopus');
  }

  args.push('-y', options.outputPath);

  return args;
}

/**
 * Build a single-clip FFmpeg command for video export.
 * Used by ffmpegRunner when ffmpeg-kit-react-native is available.
 */
export function buildSingleClipCommand(
  clip: Clip,
  outputPath: string,
  width: number,
  height: number,
  format: 'mp4' | 'mov',
  quality: 'high' | 'medium' | 'low'
): string {
  const ssSec = clip.trimStart / 1000;
  const durationSec = (clip.duration - clip.trimStart - clip.trimEnd) / (clip.speed * 1000);
  const videoBitrate = quality === 'high' ? '8M' : quality === 'medium' ? '4M' : '2M';
  const clipFilterStr = buildClipFilter(clip);
  const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
  const speedFilter = clip.speed !== 1 && !clip.reverse ? `setpts=${(1 / clip.speed).toFixed(4)}*PTS` : '';
  const vf = [clipFilterStr, scaleFilter, speedFilter].filter(Boolean).join(',');
  const af = buildClipAudioFilter(clip);
  const codec = format === 'mov' ? 'prores' : 'libx264';
  const preset = format === 'mov' ? '' : ' -preset fast';
  const audioArgs = af ? ` -af "${af}"` : '';
  return `-ss ${ssSec.toFixed(3)} -i "${clip.uri}" -t ${durationSec.toFixed(3)} -vf "${vf}"${audioArgs} -b:v ${videoBitrate} -c:v ${codec}${preset} -c:a aac -y "${outputPath}"`;
}

/**
 * Get resolution dimensions from string
 */
export function getResolutionDimensions(
  resolution: string,
  aspectRatio: string
): { width: number; height: number } {
  const [aw, ah] = aspectRatio.split(':').map(Number);
  const aspect = aw / ah;

  const heightMap: Record<string, number> = {
    '480p': 480,
    '720p': 720,
    '1080p': 1080,
    '2K': 1440,
    '4K': 2160,
  };

  const height = heightMap[resolution] || 1080;

  if (aspect >= 1) {
    return { width: Math.round(height * aspect), height };
  }
  const width = Math.round(height * aspect);
  return { width, height };
}
