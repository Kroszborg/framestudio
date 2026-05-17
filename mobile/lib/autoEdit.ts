/**
 * Auto-edit utilities: silence removal, speech onset detection.
 * Uses the native waveform extractor to find silent segments,
 * then builds a set of clip segments from the non-silent parts.
 */

export interface SilenceSegment {
  startMs: number;
  endMs: number;
}

export interface AudioSegment {
  startMs: number;
  endMs: number;
  isSilent: boolean;
}

export interface AutoEditResult {
  silentSegments: SilenceSegment[];
  audioSegments: AudioSegment[]; // non-silent parts only
  totalDurationMs: number;
  silentDurationMs: number;
}

/**
 * Detect silence in an audio/video file.
 * @param uri File URI of the audio or video clip
 * @param clipDurationMs Total clip duration in ms
 * @param threshold Amplitude below which is considered silent (0..1, default 0.06)
 * @param minSilenceDurationMs Minimum silence duration to cut (default 400ms)
 */
export async function detectSilence(
  uri: string,
  clipDurationMs: number,
  threshold = 0.06,
  minSilenceDurationMs = 400
): Promise<AutoEditResult> {
  const BAR_COUNT = 200;

  let amplitudes: number[] = [];
  try {
    // Use native waveform extractor
    let nativeProc: any = null;
    try {
      const { NativeModulesProxy } = require('expo-modules-core');
      nativeProc = NativeModulesProxy?.ExpoVideoProcessor ?? null;
    } catch {}
    if (!nativeProc) {
      const { NativeModules } = require('react-native');
      nativeProc = NativeModules?.ExpoVideoProcessor ?? null;
    }
    if (nativeProc?.extractWaveform) {
      amplitudes = await nativeProc.extractWaveform({ uri, numBars: BAR_COUNT });
    }
  } catch {}

  if (amplitudes.length === 0) {
    // Fallback: import from audioWaveform lib
    try {
      const { getWaveform } = require('./audioWaveform');
      amplitudes = await getWaveform(uri, BAR_COUNT);
    } catch {}
  }

  if (amplitudes.length === 0) {
    // No waveform data available
    return {
      silentSegments: [],
      audioSegments: [{ startMs: 0, endMs: clipDurationMs, isSilent: false }],
      totalDurationMs: clipDurationMs,
      silentDurationMs: 0,
    };
  }

  const barDurationMs = clipDurationMs / BAR_COUNT;
  const segments: AudioSegment[] = [];
  let currentSilent = amplitudes[0] < threshold;
  let segStart = 0;

  for (let i = 1; i <= amplitudes.length; i++) {
    const isSilent = i < amplitudes.length ? amplitudes[i] < threshold : !currentSilent;
    if (isSilent !== currentSilent) {
      segments.push({
        startMs: Math.round(segStart * barDurationMs),
        endMs: Math.round(i * barDurationMs),
        isSilent: currentSilent,
      });
      segStart = i;
      currentSilent = isSilent;
    }
  }

  // Filter out silences shorter than minSilenceDurationMs (they're likely brief pauses)
  const filteredSegments = segments.map(seg => {
    if (seg.isSilent && (seg.endMs - seg.startMs) < minSilenceDurationMs) {
      return { ...seg, isSilent: false }; // Don't cut short silences
    }
    return seg;
  });

  const audioSegments = filteredSegments.filter(s => !s.isSilent);
  const silentSegments = filteredSegments
    .filter(s => s.isSilent)
    .map(s => ({ startMs: s.startMs, endMs: s.endMs }));
  const silentDurationMs = silentSegments.reduce((acc, s) => acc + (s.endMs - s.startMs), 0);

  return {
    silentSegments,
    audioSegments,
    totalDurationMs: clipDurationMs,
    silentDurationMs,
  };
}

/**
 * Given a clip and its non-silent segments, produce a list of new clip configs
 * that represent the trimmed, concatenated non-silent parts.
 */
export function buildAutoEditClips(
  originalClip: any, // Clip type
  audioSegments: AudioSegment[]
): any[] {
  if (audioSegments.length === 0) return [originalClip];

  let currentStartTime = originalClip.startTime;
  return audioSegments.map((seg, i) => {
    const duration = seg.endMs - seg.startMs;
    const clip = {
      ...originalClip,
      id: `${originalClip.id}_auto_${i}`,
      trimStart: seg.startMs,
      trimEnd: originalClip.duration - seg.endMs,
      startTime: currentStartTime,
    };
    currentStartTime += duration / Math.max(0.01, originalClip.speed);
    return clip;
  });
}
