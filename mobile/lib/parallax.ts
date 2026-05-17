/**
 * Parallax camera system for FrameStudio
 * Implements 2.5D / pseudo-3D camera effects on still images.
 * Each "layer" of the image moves at a different speed based on its depth.
 * Near layers (depth=1) move the most; far layers (depth=0) move the least.
 */

export type ParallaxPreset = 'dolly_in' | 'pan_left' | 'pan_right' | 'orbit' | 'push_forward' | 'drift';

export interface ParallaxLayer {
  id: string;
  x: number;      // normalized 0-1 left edge
  y: number;      // normalized 0-1 top edge
  width: number;  // normalized 0-1
  height: number; // normalized 0-1
  depth: number;  // 0 = far (less movement), 1 = near (more movement)
}

export interface CameraState {
  tx: number;    // horizontal translate in px (at 1x scale)
  ty: number;    // vertical translate in px
  scale: number; // zoom level (1 = no zoom)
}

export interface LayerTransform {
  translateX: number;
  translateY: number;
  scale: number;
}

/**
 * Get camera position at progress t (0→1) for the given preset.
 * All values are in "virtual camera units" — the parallaxFactor
 * scales them per-layer.
 */
export function getCameraTransform(preset: ParallaxPreset, t: number): CameraState {
  // Ease in-out for all presets
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  switch (preset) {
    case 'dolly_in':
      return { tx: 0, ty: 0, scale: 1 + eased * 0.35 };

    case 'pan_left':
      return { tx: -eased * 90, ty: 0, scale: 1.08 };

    case 'pan_right':
      return { tx: eased * 90, ty: 0, scale: 1.08 };

    case 'orbit': {
      const angle = eased * Math.PI * 2;
      return {
        tx: Math.sin(angle) * 50,
        ty: Math.cos(angle) * 25,
        scale: 1 + Math.sin(angle * 0.5) * 0.08 + 0.05,
      };
    }

    case 'push_forward': {
      const zoom = 1 + eased * 0.5;
      return { tx: (eased - 0.5) * -20, ty: (eased - 0.5) * -10, scale: zoom };
    }

    case 'drift': {
      const angle = eased * Math.PI;
      return {
        tx: Math.sin(angle) * 30,
        ty: -eased * 15,
        scale: 1 + eased * 0.1,
      };
    }

    default:
      return { tx: 0, ty: 0, scale: 1 };
  }
}

/**
 * Compute the transform for a single layer at a given camera state.
 * Layers with depth=1 (near) move MORE; depth=0 (far) move LESS.
 */
export function getLayerTransform(camera: CameraState, depth: number): LayerTransform {
  // Parallax factor: 0.15 (far background) to 1.0 (foreground)
  const parallaxFactor = 0.15 + depth * 0.85;

  return {
    translateX: camera.tx * parallaxFactor,
    translateY: camera.ty * parallaxFactor,
    scale: 1 + (camera.scale - 1) * parallaxFactor,
  };
}

/**
 * Default layers for a photo with no user customization.
 * Creates a simple 3-depth setup: background, midground, foreground.
 */
export function getDefaultLayers(): ParallaxLayer[] {
  return [
    { id: 'bg', x: 0, y: 0, width: 1, height: 1, depth: 0 },       // full image, far
    { id: 'mid', x: 0.1, y: 0.1, width: 0.8, height: 0.8, depth: 0.5 }, // center region, mid
    { id: 'fg', x: 0.2, y: 0.2, width: 0.6, height: 0.6, depth: 1 },    // inner region, near
  ];
}
