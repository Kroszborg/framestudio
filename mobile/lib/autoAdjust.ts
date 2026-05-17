/**
 * Auto-adjust: analyze an image and suggest optimal color grading values.
 * Uses expo-image-manipulator to downsample, then reads pixel data via
 * a small canvas-like approach. Returns suggested clip property overrides.
 */

import { Platform } from 'react-native';

export interface AutoAdjustResult {
  brightness: number;
  contrast: number;
  saturation: number;
  highlights: number;
  shadows: number;
  exposure: number;
  whites: number;
  blacks: number;
  vibrance: number;
  clarity: number;
}

/**
 * Analyze a clip's source image and compute auto-adjust values.
 * Uses a 64×64 downscale for fast histogram analysis.
 */
export async function autoAdjustClip(uri: string): Promise<AutoAdjustResult> {
  try {
    const ImageManipulator = require('expo-image-manipulator');
    // Downsample to 64×64 for fast pixel analysis
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 64, height: 64 } }],
      { format: 'jpeg', compress: 0.8 }
    );

    // On web, use canvas for pixel analysis
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return await analyzeWithCanvas(result.uri);
    }

    // On native: use a heuristic based on image metadata
    return await analyzeNative(uri, result);
  } catch {
    return getDefaultAdjustments();
  }
}

async function analyzeWithCanvas(uri: string): Promise<AutoAdjustResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(getDefaultAdjustments()); return; }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        resolve(computeAdjustments(data));
      } catch { resolve(getDefaultAdjustments()); }
    };
    img.onerror = () => resolve(getDefaultAdjustments());
    img.src = uri;
  });
}

async function analyzeNative(originalUri: string, downsampled: { uri: string; width: number; height: number }): Promise<AutoAdjustResult> {
  // Native heuristic: estimate from file size + basic image properties
  // For a proper implementation, we'd use a NativeModule to read pixel data
  // This gives a reasonable auto-adjust that improves most images
  try {
    const FS = require('expo-file-system/legacy');
    const info = await FS.getInfoAsync(originalUri);
    const fileSize = (info as any).size ?? 0;

    // Estimate exposure from file size relative to resolution (compressed dark images are smaller)
    const estimatedCompression = fileSize / Math.max(1, downsampled.width * downsampled.height * 3);

    if (estimatedCompression < 0.3) {
      // Likely dark/underexposed image
      return {
        brightness: 5, contrast: 10, saturation: 5,
        highlights: -10, shadows: 20, exposure: 0.3,
        whites: 5, blacks: 15, vibrance: 15, clarity: 10,
      };
    } else if (estimatedCompression > 0.8) {
      // Likely bright/overexposed image
      return {
        brightness: -5, contrast: 15, saturation: 5,
        highlights: -20, shadows: 5, exposure: -0.2,
        whites: -15, blacks: 5, vibrance: 10, clarity: 10,
      };
    }
    // Normal exposure - gentle enhancement
    return {
      brightness: 0, contrast: 10, saturation: 8,
      highlights: -5, shadows: 10, exposure: 0.1,
      whites: 5, blacks: 5, vibrance: 20, clarity: 15,
    };
  } catch {
    return getDefaultAdjustments();
  }
}

function computeAdjustments(pixelData: Uint8ClampedArray): AutoAdjustResult {
  let rSum = 0, gSum = 0, bSum = 0;
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  let darkPixels = 0, brightPixels = 0;
  const pixelCount = pixelData.length / 4;

  for (let i = 0; i < pixelData.length; i += 4) {
    const r = pixelData[i], g = pixelData[i + 1], b = pixelData[i + 2];
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    rSum += r; gSum += g; bSum += b;
    if (r < rMin) rMin = r; if (r > rMax) rMax = r;
    if (g < gMin) gMin = g; if (g > gMax) gMax = g;
    if (b < bMin) bMin = b; if (b > bMax) bMax = b;
    if (lum < 50) darkPixels++;
    if (lum > 200) brightPixels++;
  }

  const avgR = rSum / pixelCount / 255;
  const avgG = gSum / pixelCount / 255;
  const avgB = bSum / pixelCount / 255;
  const avgLum = (avgR * 0.299 + avgG * 0.587 + avgB * 0.114);
  const darkRatio = darkPixels / pixelCount;
  const brightRatio = brightPixels / pixelCount;
  const dynamicRange = Math.max(rMax - rMin, gMax - gMin, bMax - bMin) / 255;

  // Compute adjustments to normalize the image
  const exposureCorrection = -(avgLum - 0.45) * 1.5; // target 0.45 average
  const contrastBoost = Math.max(0, (0.6 - dynamicRange) * 40);
  const shadowLift = darkRatio > 0.3 ? Math.min(30, darkRatio * 60) : 5;
  const highlightReduce = brightRatio > 0.3 ? -Math.min(30, brightRatio * 60) : -5;
  const satBoost = dynamicRange < 0.4 ? 15 : 8; // desaturated images get more boost

  return {
    brightness: Math.round(Math.max(-30, Math.min(30, (0.45 - avgLum) * 60))),
    contrast: Math.round(Math.min(30, contrastBoost)),
    saturation: Math.round(satBoost),
    highlights: Math.round(Math.max(-30, highlightReduce)),
    shadows: Math.round(Math.min(30, shadowLift)),
    exposure: Math.round(exposureCorrection * 10) / 10,
    whites: Math.round(highlightReduce * 0.5),
    blacks: Math.round(shadowLift * 0.5),
    vibrance: Math.round(satBoost + 5),
    clarity: 10,
  };
}

function getDefaultAdjustments(): AutoAdjustResult {
  return {
    brightness: 0, contrast: 10, saturation: 8,
    highlights: -5, shadows: 8, exposure: 0,
    whites: 5, blacks: 5, vibrance: 15, clarity: 10,
  };
}
