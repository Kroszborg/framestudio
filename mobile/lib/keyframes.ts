/**
 * Keyframe interpolation utilities.
 * Evaluates animation tracks at a given time using cubic bezier easing.
 */

export type EasingType = 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out' | 'spring' | 'bounce' | 'custom';

export interface AnimKeyframe {
  time: number;       // ms relative to clip start
  value: number;      // raw value in the param's range
  easing: EasingType;
  cp1x?: number; cp1y?: number; cp2x?: number; cp2y?: number; // custom bezier
}

export interface ClipAnimTrack {
  param: 'scale' | 'posX' | 'posY' | 'rotation' | 'opacity' | 'brightness' | 'saturation';
  keyframes: AnimKeyframe[];
}

// Standard bezier control points for named easings
const EASING_PRESETS: Record<EasingType, [number, number, number, number]> = {
  linear:       [0,    0,    1,    1   ],
  ease_in:      [0.42, 0,    1,    1   ],
  ease_out:     [0,    0,    0.58, 1   ],
  ease_in_out:  [0.42, 0,    0.58, 1   ],
  spring:       [0.68, -0.55, 0.27, 1.55],
  bounce:       [0.36, 0.07, 0.19, 0.97],
  custom:       [0.25, 0.1,  0.25, 1   ],
};

/**
 * Evaluate a cubic bezier curve at parameter t (0..1).
 * Uses Newton-Raphson to solve for the x parameter, then returns y.
 */
function cubicBezier(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  // Cubic bezier value: B(t) = 3*(1-t)²*t*P1 + 3*(1-t)*t²*P2 + t³
  function sample(u: number, p1: number, p2: number): number {
    return 3 * p1 * u * (1 - u) ** 2 + 3 * p2 * u ** 2 * (1 - u) + u ** 3;
  }

  // Correct derivative: dB/dt = 3*P1*(1-t)*(1-3t) + 3*P2*t*(2-3t) + 3*t²
  // Derived from d/dt[3*(1-t)²*t*P1 + 3*(1-t)*t²*P2 + t³]
  function derivative(u: number, p1: number, p2: number): number {
    return 3 * p1 * (1 - u) * (1 - 3 * u) + 3 * p2 * u * (2 - 3 * u) + 3 * u ** 2;
  }

  // Newton-Raphson: solve for u such that sample(u, p1x, p2x) = t
  let u = t;
  for (let i = 0; i < 8; i++) {
    const xErr = sample(u, p1x, p2x) - t;
    if (Math.abs(xErr) < 1e-7) break;
    const d = derivative(u, p1x, p2x);
    if (Math.abs(d) < 1e-8) break; // avoid division by near-zero
    u = Math.max(0, Math.min(1, u - xErr / d));
  }

  return sample(u, p1y, p2y);
}

function applyEasing(t: number, easing: EasingType, cp1x?: number, cp1y?: number, cp2x?: number, cp2y?: number): number {
  const preset = EASING_PRESETS[easing] ?? EASING_PRESETS.linear;
  return cubicBezier(
    t,
    cp1x ?? preset[0], cp1y ?? preset[1],
    cp2x ?? preset[2], cp2y ?? preset[3]
  );
}

/**
 * Interpolate a value from a keyframe track at the given time (ms).
 * Returns the first keyframe value before the first keyframe, and the last after.
 */
export function interpolateTrack(track: ClipAnimTrack, timeMs: number): number {
  const kfs = track.keyframes;
  if (!kfs || kfs.length === 0) return 0;
  if (kfs.length === 1) return kfs[0].value;
  if (timeMs <= kfs[0].time) return kfs[0].value;
  if (timeMs >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

  // Find surrounding keyframes
  let prev = kfs[0];
  let next = kfs[kfs.length - 1];
  for (let i = 0; i < kfs.length - 1; i++) {
    if (kfs[i].time <= timeMs && kfs[i + 1].time >= timeMs) {
      prev = kfs[i];
      next = kfs[i + 1];
      break;
    }
  }

  const span = next.time - prev.time;
  if (span <= 0) return prev.value;
  const t = (timeMs - prev.time) / span;
  const easedT = applyEasing(t, prev.easing, prev.cp1x, prev.cp1y, prev.cp2x, prev.cp2y);
  return prev.value + (next.value - prev.value) * easedT;
}

/**
 * Get the animated transform style for a clip at the given time.
 * Returns scale, translateX, translateY, rotation for use in React Native transform.
 */
export function getAnimatedTransform(
  animTracks: ClipAnimTrack[] | undefined,
  timeMs: number
): { scale?: number; translateX?: number; translateY?: number; rotation?: number; opacity?: number } {
  if (!animTracks || animTracks.length === 0) return {};
  const result: Record<string, number> = {};
  for (const track of animTracks) {
    result[track.param] = interpolateTrack(track, timeMs);
  }
  return {
    scale: result.scale,
    translateX: result.posX,
    translateY: result.posY,
    rotation: result.rotation,
    opacity: result.opacity,
  };
}

/** Create a dolly zoom preset keyframe track */
export function createDollyZoomPreset(clipDurationMs: number): ClipAnimTrack[] {
  return [
    {
      param: 'scale',
      keyframes: [
        { time: 0, value: 1.0, easing: 'ease_in_out' },
        { time: clipDurationMs, value: 2.2, easing: 'ease_in_out' },
      ],
    },
    {
      param: 'posY',
      keyframes: [
        { time: 0, value: 0, easing: 'ease_in_out' },
        { time: clipDurationMs, value: -20, easing: 'ease_in_out' },
      ],
    },
  ];
}

/** Create a zoom-in preset */
export function createZoomInPreset(clipDurationMs: number): ClipAnimTrack[] {
  return [{
    param: 'scale',
    keyframes: [
      { time: 0, value: 1.0, easing: 'ease_in_out' },
      { time: clipDurationMs, value: 1.8, easing: 'ease_in_out' },
    ],
  }];
}

/** Create a zoom-out preset */
export function createZoomOutPreset(clipDurationMs: number): ClipAnimTrack[] {
  return [{
    param: 'scale',
    keyframes: [
      { time: 0, value: 1.8, easing: 'ease_in_out' },
      { time: clipDurationMs, value: 1.0, easing: 'ease_in_out' },
    ],
  }];
}
