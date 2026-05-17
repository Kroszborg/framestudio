/**
 * Audio waveform extraction using expo-av
 * Provides real amplitude data for timeline waveform visualization.
 * 
 * Strategy:
 * - On native: Use expo-av's Audio.Sound to get playback status during rapid seek
 *   which gives us metering data. Alternatively, read raw file bytes for WAV/PCM.
 * - Fallback: Generate perlin-noise-like waveform that at least varies per clip (seeded by URI hash).
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// Cache waveform data to avoid re-computation
const waveformCache = new Map<string, number[]>();

/**
 * Generate a deterministic pseudo-waveform based on file URI hash.
 * Not real audio data but unique per clip and visually plausible.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generate deterministic waveform from file metadata.
 * Uses file size + URI hash to create a unique-per-clip waveform.
 */
async function generateDeterministicWaveform(
  uri: string,
  barCount: number,
  fileSize?: number
): Promise<number[]> {
  const hash = hashString(uri);
  const rand = seededRandom(hash + (fileSize || 0));
  
  // Generate smooth waveform using low-frequency noise
  const bars: number[] = [];
  const numOctaves = 3;
  
  for (let i = 0; i < barCount; i++) {
    let val = 0;
    for (let oct = 0; oct < numOctaves; oct++) {
      const freq = (oct + 1) * 2;
      const phase = rand() * Math.PI * 2;
      val += Math.sin((i / barCount) * freq * Math.PI + phase) / (oct + 1);
    }
    // Add some high-frequency detail
    val += (rand() - 0.5) * 0.3;
    // Normalize to 0-1 range with bias toward middle
    val = Math.max(0.08, Math.min(1, (val + 1.5) / 3));
    bars.push(val);
  }
  
  return bars;
}

/**
 * Try to extract real waveform data from WAV files by reading raw PCM data.
 * WAV files have a predictable header structure.
 */
async function extractWavWaveform(
  uri: string,
  barCount: number
): Promise<number[] | null> {
  if (Platform.OS === 'web') return null;
  
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || !('size' in info)) return null;
    
    const fileSize = (info as any).size as number;
    if (fileSize < 44) return null; // Too small for WAV header
    
    // Read WAV header (44 bytes) to check format
    const headerB64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 44,
      position: 0,
    });
    
    // Decode base64 header
    const headerBytes = Uint8Array.from(atob(headerB64), c => c.charCodeAt(0));
    
    // Check RIFF/WAVE signature
    const riff = String.fromCharCode(headerBytes[0], headerBytes[1], headerBytes[2], headerBytes[3]);
    const wave = String.fromCharCode(headerBytes[8], headerBytes[9], headerBytes[10], headerBytes[11]);
    
    if (riff !== 'RIFF' || wave !== 'WAVE') return null;
    
    // Parse header fields
    const channels = headerBytes[22] | (headerBytes[23] << 8);
    const bitsPerSample = headerBytes[34] | (headerBytes[35] << 8);
    const bytesPerSample = bitsPerSample / 8;
    const dataSize = fileSize - 44;
    const totalSamples = Math.floor(dataSize / (bytesPerSample * channels));
    
    if (totalSamples < barCount) return null;
    
    const samplesPerBar = Math.floor(totalSamples / barCount);
    const bytesPerBar = samplesPerBar * bytesPerSample * channels;
    const bars: number[] = [];
    
    // Sample at evenly spaced points
    for (let i = 0; i < barCount; i++) {
      const offset = 44 + i * bytesPerBar;
      const readSize = Math.min(bytesPerBar, 512); // Read a small chunk per bar
      
      try {
        const chunkB64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
          length: readSize,
          position: offset,
        });
        
        const bytes = Uint8Array.from(atob(chunkB64), c => c.charCodeAt(0));
        
        // Calculate RMS amplitude
        let sumSq = 0;
        let count = 0;
        
        for (let j = 0; j < bytes.length - bytesPerSample + 1; j += bytesPerSample * channels) {
          let sample: number;
          if (bytesPerSample === 2) {
            // 16-bit signed
            sample = (bytes[j] | (bytes[j + 1] << 8));
            if (sample > 32767) sample -= 65536;
            sample /= 32768;
          } else if (bytesPerSample === 1) {
            // 8-bit unsigned
            sample = (bytes[j] - 128) / 128;
          } else {
            sample = 0;
          }
          sumSq += sample * sample;
          count++;
        }
        
        const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
        bars.push(Math.max(0.05, Math.min(1, rms * 3))); // Scale for visibility
      } catch {
        bars.push(0.1);
      }
    }
    
    return bars;
  } catch {
    return null;
  }
}

/**
 * Get waveform data for a clip.
 * Returns array of amplitudes (0-1) for visualization.
 */
export async function getWaveform(
  uri: string,
  barCount: number = 40
): Promise<number[]> {
  const cacheKey = `${uri}:${barCount}`;
  if (waveformCache.has(cacheKey)) return waveformCache.get(cacheKey)!;

  let bars: number[] | null = null;

  // 1. Try native MediaCodec extraction (works for MP3, AAC, WAV, M4A — all formats)
  if (Platform.OS !== 'web') {
    try {
      let nativeProcessor: any = null;
      try {
        const { NativeModulesProxy } = require('expo-modules-core');
        nativeProcessor = NativeModulesProxy?.ExpoVideoProcessor ?? null;
      } catch {}
      if (!nativeProcessor) {
        const { NativeModules } = require('react-native');
        nativeProcessor = NativeModules?.ExpoVideoProcessor ?? null;
      }
      if (nativeProcessor?.extractWaveform) {
        const result: number[] = await nativeProcessor.extractWaveform({ uri, numBars: barCount });
        if (result && result.length > 0) bars = result;
      }
    } catch {}
  }

  // 2. For WAV files, try direct PCM parsing
  if (!bars && uri.toLowerCase().endsWith('.wav')) {
    bars = await extractWavWaveform(uri, barCount);
  }

  // 3. Deterministic fallback using file metadata as seed
  if (!bars) {
    let fileSize: number | undefined;
    if (Platform.OS !== 'web') {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && 'size' in info) fileSize = (info as any).size;
      } catch {}
    }
    bars = await generateDeterministicWaveform(uri, barCount, fileSize);
  }

  waveformCache.set(cacheKey, bars);
  return bars;
}

/**
 * Clear cached waveform data for a URI
 */
export function clearWaveformCache(uri?: string) {
  if (uri) {
    for (const key of waveformCache.keys()) {
      if (key.startsWith(uri)) waveformCache.delete(key);
    }
  } else {
    waveformCache.clear();
  }
}
