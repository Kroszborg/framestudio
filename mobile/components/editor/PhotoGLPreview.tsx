/**
 * PhotoGLPreview — GPU-accelerated photo preview using expo-gl.
 *
 * Renders the photo with full color grading applied via GLSL shaders:
 * brightness, contrast, saturation, temperature, tint, highlights, shadows,
 * and all 11 named filter presets.
 *
 * Exposes captureAsync() so the export pipeline can capture the exact
 * rendered output — what you see is what you export.
 */
import React, { useRef, useCallback, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { GLView } from 'expo-gl';
import type { Clip } from '../../lib/database';

// ── Shader source ────────────────────────────────────────────────────────────

const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = vec2(aPos.x * 0.5 + 0.5, 1.0 - (aPos.y * 0.5 + 0.5));
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision mediump float;
uniform sampler2D uTex;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uTemperature;
uniform float uTint;
uniform float uHighlights;
uniform float uShadows;
uniform float uFilter;
uniform float uIntensity;
uniform float uViewAspect;
uniform float uImgAspect;
// Advanced color grading
uniform float uExposure;    // EV (-3..3)
uniform float uVibrance;    // -1..1
uniform float uClarity;     // -1..1 micro-contrast
uniform float uDehaze;      // -1..1 haze removal
uniform float uBlacks;      // -1..1 lift blacks
uniform float uWhites;      // -1..1 compress whites
uniform float uFade;        // 0..1 film fade
uniform float uGrain;       // 0..1 film grain
// HSL per-channel (6 zones: Reds, Oranges, Yellows, Greens, Cyans, Blues)
uniform float uHslHue[6];   // H shift -1..1 (maps to -180..180 degrees)
uniform float uHslSat[6];   // S shift -1..1
uniform float uHslLum[6];   // L shift -1..1
// Mask
uniform float uMaskType;    // 0=none, 1=radial, 2=linear
uniform float uMaskX;
uniform float uMaskY;
uniform float uMaskRadius;
uniform float uMaskAngle;
uniform float uMaskFeather;
uniform float uMaskInvert;
// Chroma key (green/blue screen removal)
uniform float uChromaEnabled;   // 0 = off, 1 = on
uniform vec3  uChromaColor;     // key color RGB 0-1
uniform float uChromaThreshold; // 0-1 sensitivity
// 3D LUT (flattened to 2D strip texture: width=N, height=N*N)
uniform sampler2D uLut;
uniform float uLutEnabled;  // 0 = off, 1 = on
uniform float uLutSize;     // LUT grid resolution (e.g. 17 or 33)
// Motion blur (zoom-out radial blur)
uniform float uMotionBlur;  // 0-1
varying vec2 vUV;

// Standard luminance weights
const vec3 LUM = vec3(0.299, 0.587, 0.114);

vec3 applyNamedFilter(vec3 c, float f) {
  if (f < 0.5) return c;                    // 0 = none
  vec3 r = c;
  float g = dot(c, LUM);
  if (f < 1.5) { return vec3(g); }          // 1 = bw
  if (f < 2.5) {                             // 2 = sepia
    return vec3(g*1.1, g*0.85, g*0.65);
  }
  if (f < 3.5) {                             // 3 = vintage
    r = vec3(g*0.95+c.r*0.3, g*0.8+c.g*0.2, g*0.6+c.b*0.15);
    r = (r - 0.5)*1.1 + 0.5;
    return r;
  }
  if (f < 4.5) {                             // 4 = cool
    r.r *= 0.88; r.g *= 0.95; r.b = min(1.0, r.b*1.15);
    return r;
  }
  if (f < 5.5) {                             // 5 = warm
    r.r = min(1.0, r.r*1.15); r.g *= 1.05; r.b *= 0.88;
    return r;
  }
  if (f < 6.5) {                             // 6 = dramatic
    r = (r - 0.5)*1.4 + 0.5;
    r *= 0.85;
    r = mix(vec3(g), r, 0.7);
    return r;
  }
  if (f < 7.5) {                             // 7 = cinematic
    r = (r - 0.5)*1.2 + 0.5;
    r = mix(vec3(g), r, 0.85);
    r *= 0.9;
    r.b = min(1.0, r.b + 0.05);
    return r;
  }
  if (f < 8.5) {                             // 8 = vhs
    r.r = min(1.0, r.r*1.1);
    r = (r - 0.5)*1.1 + 0.5;
    r = mix(vec3(g), r, 1.3);
    return clamp(r, 0.0, 1.0);
  }
  if (f < 9.5) {                             // 9 = glow
    r = mix(r, vec3(1.0), 0.05);
    r = (r - 0.5)*0.9 + 0.5;
    return r;
  }
  if (f < 10.5) {                            // 10 = neon
    r = mix(vec3(g), r, 2.5);
    r = (r - 0.5)*1.2 + 0.5;
    return clamp(r, 0.0, 1.0);
  }
  // ── Cinematic filters (11-21) ─────────────────────────────────────────────
  if (f < 11.5) {                            // 11 = orange_teal
    r.r = min(1.0, r.r*1.2 + 0.04);
    r.b = r.b * 1.3 - g * 0.1;
    r.g = r.g * 0.85;
    r = (r - 0.5)*1.1 + 0.5;
    return clamp(r, 0.0, 1.0);
  }
  if (f < 12.5) {                            // 12 = moody
    r = (r - 0.5)*1.35 + 0.5;
    r *= 0.8;
    r.b = min(1.0, r.b + 0.03);
    return clamp(r, 0.0, 1.0);
  }
  if (f < 13.5) {                            // 13 = golden_hour
    r.r = min(1.0, r.r*1.15 + 0.06);
    r.g = min(1.0, r.g*1.05 + 0.02);
    r.b = r.b * 0.75;
    return clamp(r, 0.0, 1.0);
  }
  if (f < 14.5) {                            // 14 = matte
    r = r * 0.85 + 0.07;  // lift blacks, compress whites
    r = mix(vec3(g), r, 0.9);
    return clamp(r, 0.0, 1.0);
  }
  if (f < 15.5) {                            // 15 = faded
    r = r * 0.7 + 0.1;
    r = mix(vec3(g * 0.9 + 0.05), r, 0.6);
    return clamp(r, 0.0, 1.0);
  }
  if (f < 16.5) {                            // 16 = tokyo
    r.b = min(1.0, r.b*1.25 + 0.05);
    r.r = min(1.0, r.r + g * 0.15);
    r = (r - 0.5)*1.15 + 0.5;
    return clamp(r, 0.0, 1.0);
  }
  if (f < 17.5) {                            // 17 = pacific
    r.b = min(1.0, r.b*1.1 + 0.05);
    r.g = min(1.0, r.g*1.15);
    r.r = r.r * 0.85;
    return clamp(r, 0.0, 1.0);
  }
  if (f < 18.5) {                            // 18 = noir
    float bw2 = dot(r, vec3(0.21, 0.72, 0.07));
    r = vec3(bw2);
    r = (r - 0.5)*1.5 + 0.5;
    r = mix(r, r * vec3(0.95, 0.97, 1.05), 0.4);
    return clamp(r, 0.0, 1.0);
  }
  if (f < 19.5) {                            // 19 = pastel
    r = mix(vec3(g), r, 0.55);
    r = r * 0.9 + 0.08;
    return clamp(r, 0.0, 1.0);
  }
  if (f < 20.5) {                            // 20 = kodak
    r.r = min(1.0, r.r*1.08 + 0.02);
    r.g = min(1.0, r.g*1.04);
    r.b = r.b * 0.9 + 0.01;
    r = (r - 0.5)*0.95 + 0.5;
    return clamp(r, 0.0, 1.0);
  }
  if (f < 21.5) {                            // 21 = fuji
    r.g = min(1.0, r.g*1.06 + 0.01);
    r.b = min(1.0, r.b*1.04 + 0.02);
    r = mix(vec3(g), r, 1.05);
    return clamp(r, 0.0, 1.0);
  }
  return c;
}

void main() {
  // Correct UV for aspect ratio (contain mode — letterbox/pillarbox, no stretching)
  vec2 uv = vUV;
  if (uViewAspect > uImgAspect) {
    float scale = uImgAspect / uViewAspect;
    uv.x = (uv.x - 0.5) / scale + 0.5;
  } else {
    float scale = uViewAspect / uImgAspect;
    uv.y = (uv.y - 0.5) / scale + 0.5;
  }
  // Black for letterbox/pillarbox areas
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec4 orig = texture2D(uTex, uv);
  vec3 c = orig.rgb;

  // Brightness: multiplicative scale (matches CSS brightness() — avoids full-white blowout)
  // uBrightness range -0.67..0.67  →  multiplier 0.33..1.67
  c = c * (1.0 + uBrightness);

  // Contrast: -1..1 → scale around midpoint
  c = (c - 0.5) * (1.0 + uContrast) + 0.5;

  // Saturation: -1..1 → blend with grey
  float lum = dot(c, LUM);
  c = mix(vec3(lum), c, 1.0 + uSaturation);

  // Temperature: -1..1 → red/blue balance
  c.r += uTemperature * 0.15;
  c.b -= uTemperature * 0.15;

  // Tint: -1..1 → green/magenta
  c.g += uTint * 0.10;

  // Highlights: affect bright areas
  float hl = max(0.0, dot(c, LUM) - 0.5) * 2.0;
  c += uHighlights * hl * 0.45;

  // Shadows: affect dark areas
  float sh = max(0.0, 0.5 - dot(c, LUM)) * 2.0;
  c += uShadows * sh * 0.45;

  c = clamp(c, 0.0, 1.0);

  // ── Advanced color grading ────────────────────────────────────────────────

  // Exposure: EV-based multiplicative (more natural than brightness)
  if (abs(uExposure) > 0.01) { c = c * pow(2.0, uExposure); }

  // Blacks: lift / crush black point
  if (abs(uBlacks) > 0.01) {
    float bk = uBlacks * 0.25;
    float shadow_range = 1.0 - smoothstep(0.0, 0.5, dot(c, LUM));
    c += bk * shadow_range;
  }

  // Whites: compress / expand white point
  if (abs(uWhites) > 0.01) {
    float wh = uWhites * 0.25;
    float highlight_range = smoothstep(0.5, 1.0, dot(c, LUM));
    c += wh * highlight_range;
  }

  // Vibrance: intelligent saturation (boosts less-saturated colors more)
  if (abs(uVibrance) > 0.01) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float sat = maxC - minC;
    float vib = uVibrance * (1.0 - sat);
    float lum2 = dot(c, LUM);
    c = mix(vec3(lum2), c, 1.0 + vib);
  }

  // Clarity: micro-contrast boost via 4-tap box blur on aspect-ratio-corrected UV
  // Using uv (not vUV) prevents sampling into the letterbox area which caused
  // image duplication and pixelation artifacts at non-zero clarity values.
  if (abs(uClarity) > 0.01) {
    vec2 off = vec2(0.004, 0.004);
    vec3 blurC = vec3(0.0);
    blurC += texture2D(uTex, clamp(uv + vec2(-off.x, 0.0), 0.0, 1.0)).rgb * 0.25;
    blurC += texture2D(uTex, clamp(uv + vec2( off.x, 0.0), 0.0, 1.0)).rgb * 0.25;
    blurC += texture2D(uTex, clamp(uv + vec2(0.0, -off.y), 0.0, 1.0)).rgb * 0.25;
    blurC += texture2D(uTex, clamp(uv + vec2(0.0,  off.y), 0.0, 1.0)).rgb * 0.25;
    float luminance_diff = dot(c - blurC, LUM);
    c = clamp(c + uClarity * luminance_diff * 1.5, 0.0, 1.0);
  }

  // Dehaze: remove atmospheric haze (increase clarity in bright areas)
  if (abs(uDehaze) > 0.01) {
    float lum3 = dot(c, LUM);
    float midMask = smoothstep(0.3, 0.7, lum3);
    if (uDehaze > 0.0) {
      c = mix(c, (c - 0.5) * (1.0 + uDehaze * midMask) + 0.5, uDehaze);
    } else {
      c = mix(c, (c - 0.5) * (1.0 + uDehaze * 0.5) + 0.5, abs(uDehaze));
    }
  }

  // Fade: lift shadows + compress highlights (film matte look)
  if (uFade > 0.01) {
    float fadeAmount = uFade * 0.18;
    c = c * (1.0 - fadeAmount * 2.0) + fadeAmount; // lift blacks, compress whites
  }

  // HSL per-channel adjustments
  // Convert RGB → HSL, apply per-zone shifts, convert back
  {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float delta = maxC - minC;
    if (delta > 0.01) {
      float h = 0.0;
      if (maxC == c.r)      h = mod((c.g - c.b) / delta, 6.0);
      else if (maxC == c.g) h = (c.b - c.r) / delta + 2.0;
      else                  h = (c.r - c.g) / delta + 4.0;
      h = h / 6.0; // normalize 0..1
      // Determine zone: 0=Reds(0-30°), 1=Oranges(30-60°), 2=Yellows(60-90°),
      //                 3=Greens(90-150°), 4=Cyans(150-210°), 5=Blues(210-360°)
      int zone = 0;
      if      (h < 0.083) zone = 0;
      else if (h < 0.167) zone = 1;
      else if (h < 0.25)  zone = 2;
      else if (h < 0.417) zone = 3;
      else if (h < 0.583) zone = 4;
      else                zone = 5;
      float hShift = 0.0; float sShift = 0.0; float lShift = 0.0;
      if (zone == 0) { hShift = uHslHue[0]; sShift = uHslSat[0]; lShift = uHslLum[0]; }
      else if (zone == 1) { hShift = uHslHue[1]; sShift = uHslSat[1]; lShift = uHslLum[1]; }
      else if (zone == 2) { hShift = uHslHue[2]; sShift = uHslSat[2]; lShift = uHslLum[2]; }
      else if (zone == 3) { hShift = uHslHue[3]; sShift = uHslSat[3]; lShift = uHslLum[3]; }
      else if (zone == 4) { hShift = uHslHue[4]; sShift = uHslSat[4]; lShift = uHslLum[4]; }
      else                { hShift = uHslHue[5]; sShift = uHslSat[5]; lShift = uHslLum[5]; }
      if (abs(hShift) > 0.001 || abs(sShift) > 0.001 || abs(lShift) > 0.001) {
        // Apply saturation shift
        float lum4 = dot(c, LUM);
        c = mix(vec3(lum4), c, 1.0 + sShift);
        // Apply luminance shift
        c += lShift * 0.5;
        // Hue shift: rotate in color space via temperature/tint approximation
        c.r += hShift * 0.15;
        c.b -= hShift * 0.10;
        c.g += abs(hShift) * 0.05;
      }
    }
  }

  // Grain: film grain noise
  if (uGrain > 0.01) {
    float noise = fract(sin(dot(vUV + vec2(0.127, 0.311), vec2(12.989, 78.233))) * 43758.545);
    float grain = (noise - 0.5) * uGrain * 0.08;
    c += grain;
  }

  // Mask: selective editing (radial or linear)
  float maskStrength = 1.0;
  if (uMaskType > 0.5) {
    vec2 uv2 = vUV;
    if (uMaskType < 1.5) {
      // Radial mask
      float dist = length(uv2 - vec2(uMaskX, uMaskY));
      float r = max(uMaskRadius, 0.001);
      float feather = max(uMaskFeather, 0.001);
      maskStrength = 1.0 - smoothstep(r - feather, r + feather, dist);
    } else {
      // Linear mask
      float angle = uMaskAngle * 3.14159 / 180.0;
      float d = (uv2.x - uMaskX) * cos(angle) + (uv2.y - uMaskY) * sin(angle);
      float feather = max(uMaskFeather, 0.001);
      maskStrength = 1.0 - smoothstep(-feather, feather, d);
    }
    if (uMaskInvert > 0.5) maskStrength = 1.0 - maskStrength;
  }
  // Re-apply original color where mask is 0 (mask only affects color-graded areas)
  if (uMaskType > 0.5) { c = mix(orig.rgb, c, maskStrength); }

  c = clamp(c, 0.0, 1.0);

  // Named filter blended by intensity
  if (uFilter > 0.5) {
    vec3 filtered = applyNamedFilter(c, uFilter);
    c = mix(c, filtered, uIntensity);
  }

  // 3D LUT (trilinear interpolation from flattened 2D strip texture)
  if (uLutEnabled > 0.5 && uLutSize > 1.5) {
    float N = uLutSize;
    float invN = 1.0 / N;
    float invN2 = invN * invN;
    vec3 sc = clamp(c, 0.0, 1.0) * (N - 1.0);
    float r0 = floor(sc.r); float r1 = min(r0 + 1.0, N - 1.0);
    float g0 = floor(sc.g); float g1 = min(g0 + 1.0, N - 1.0);
    float b0 = floor(sc.b); float b1 = min(b0 + 1.0, N - 1.0);
    float fr = sc.r - r0; float fg = sc.g - g0; float fb = sc.b - b0;
    // Texture coords: x = r/N, y = (g + b*N)/(N*N)
    vec3 c000 = texture2D(uLut, vec2((r0+0.5)*invN, (g0+b0*N+0.5)*invN2)).rgb;
    vec3 c100 = texture2D(uLut, vec2((r1+0.5)*invN, (g0+b0*N+0.5)*invN2)).rgb;
    vec3 c010 = texture2D(uLut, vec2((r0+0.5)*invN, (g1+b0*N+0.5)*invN2)).rgb;
    vec3 c110 = texture2D(uLut, vec2((r1+0.5)*invN, (g1+b0*N+0.5)*invN2)).rgb;
    vec3 c001 = texture2D(uLut, vec2((r0+0.5)*invN, (g0+b1*N+0.5)*invN2)).rgb;
    vec3 c101 = texture2D(uLut, vec2((r1+0.5)*invN, (g0+b1*N+0.5)*invN2)).rgb;
    vec3 c011 = texture2D(uLut, vec2((r0+0.5)*invN, (g1+b1*N+0.5)*invN2)).rgb;
    vec3 c111 = texture2D(uLut, vec2((r1+0.5)*invN, (g1+b1*N+0.5)*invN2)).rgb;
    c = mix(mix(mix(c000,c100,fr),mix(c010,c110,fr),fg),
            mix(mix(c001,c101,fr),mix(c011,c111,fr),fg), fb);
  }

  // Motion blur: zoom-radial blur (samples along zoom-out direction)
  if (uMotionBlur > 0.02) {
    vec3 blurred = c;
    for (int i = 1; i <= 6; i++) {
      float t = float(i) / 6.0;
      vec2 offset = (vUV - 0.5) * uMotionBlur * 0.04 * t;
      blurred += texture2D(uTex, clamp(vUV - offset, 0.0, 1.0)).rgb;
    }
    c = mix(c, blurred / 7.0, uMotionBlur);
  }

  // Chroma key: remove pixels close to the key color
  float finalAlpha = orig.a;
  if (uChromaEnabled > 0.5) {
    vec3 diff = abs(c - uChromaColor);
    float dist = max(diff.r, max(diff.g, diff.b));
    finalAlpha *= smoothstep(uChromaThreshold * 0.4, uChromaThreshold, dist);
  }

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), finalAlpha);
}
`;

// ── Filter name → index map ──────────────────────────────────────────────────
const FILTER_IDX: Record<string, number> = {
  none: 0, bw: 1, sepia: 2, vintage: 3, cool: 4,
  warm: 5, dramatic: 6, cinematic: 7, vhs: 8, glow: 9, neon: 10,
  // Cinematic additions
  orange_teal: 11, moody: 12, golden_hour: 13, matte: 14, faded: 15,
  tokyo: 16, pacific: 17, noir: 18, pastel: 19, kodak: 20, fuji: 21,
};

// ── GL helpers ───────────────────────────────────────────────────────────────

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[PhotoGL] shader error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function buildProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vert || !frag) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[PhotoGL] link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

// ── Component interface ──────────────────────────────────────────────────────

export interface PhotoGLPreviewRef {
  /** Capture the current rendered frame and return a file:// URI */
  captureAsync: () => Promise<string | null>;
  /** Returns true if the current clip's texture is loaded and rendered */
  isTextureReady: () => boolean;
  /** Waits until texture is loaded (or timeout ms), returns whether it succeeded */
  waitForTexture: (timeoutMs?: number) => Promise<boolean>;
}

interface Props {
  clip: Clip | null;
  style?: any;
}

const PhotoGLPreview = forwardRef<PhotoGLPreviewRef, Props>(function PhotoGLPreview(
  { clip, style },
  ref,
) {
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const texRef = useRef<WebGLTexture | null>(null);
  const lutTexRef = useRef<WebGLTexture | null>(null);
  const lutSizeRef = useRef<number>(0);
  const glViewRef = useRef<any>(null);
  const imgAspectRef = useRef<number>(1);
  const [glReady, setGlReady] = useState(false);

  // Expose captureAsync
  useImperativeHandle(ref, () => ({
    captureAsync: async () => {
      if (!glRef.current || !glViewRef.current) return null;
      try {
        renderFrame();
        const gl = glRef.current as any;
        gl.endFrameEXP?.();
        const snap = await GLView.takeSnapshotAsync(gl, {
          format: 'png',
          compress: 0.95,
          rect: undefined,
        });
        return typeof snap.uri === 'string' ? snap.uri : null;
      } catch (e) {
        console.warn('[PhotoGL] capture error:', e);
        return null;
      }
    },
    isTextureReady: () => texRef.current !== null,
    waitForTexture: async (timeoutMs = 4000) => {
      const deadline = Date.now() + timeoutMs;
      while (texRef.current === null && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 80));
      }
      return texRef.current !== null;
    },
  }));

  // Current uniforms from clip
  const getUniforms = useCallback(() => {
    if (!clip) return null;
    // Parse chroma key color hex → RGB 0-1
    let chromaR = 0, chromaG = 1, chromaB = 0; // default green
    if (clip.chromaKeyEnabled && clip.chromaKeyColor) {
      const hex = clip.chromaKeyColor.replace('#', '');
      if (hex.length === 6) {
        chromaR = parseInt(hex.slice(0, 2), 16) / 255;
        chromaG = parseInt(hex.slice(2, 4), 16) / 255;
        chromaB = parseInt(hex.slice(4, 6), 16) / 255;
      }
    }
    const hslHue = clip.hslHue ?? [0,0,0,0,0,0];
    const hslSat = clip.hslSat ?? [0,0,0,0,0,0];
    const hslLum = clip.hslLum ?? [0,0,0,0,0,0];
    return {
      uBrightness: (clip.brightness ?? 0) / 150,
      uContrast:   (clip.contrast ?? 0) / 150,
      uSaturation: (clip.saturation ?? 0) / 100,
      uTemperature:(clip.temperature ?? 0) / 100,
      uTint:       (clip.tint ?? 0) / 100,
      uHighlights: (clip.highlights ?? 0) / 100,
      uShadows:    (clip.shadows ?? 0) / 100,
      uFilter:     FILTER_IDX[clip.filter ?? 'none'] ?? 0,
      uIntensity:  (clip.filterIntensity ?? 100) / 100,
      // Advanced color grading
      uExposure:   (clip.exposure ?? 0),
      uVibrance:   (clip.vibrance ?? 0) / 100,
      uClarity:    (clip.clarity ?? 0) / 100,
      uDehaze:     (clip.dehaze ?? 0) / 100,
      uBlacks:     (clip.blacks ?? 0) / 100,
      uWhites:     (clip.whites ?? 0) / 100,
      uFade:       (clip.fade ?? 0) / 100,
      uGrain:      (clip.grain ?? 0) / 100,
      // HSL per-channel (normalized)
      _hslHue: hslHue.map(v => v / 180),
      _hslSat: hslSat.map(v => v / 100),
      _hslLum: hslLum.map(v => v / 100),
      // Mask
      uMaskType:    clip.maskType === 'radial' ? 1 : clip.maskType === 'linear' ? 2 : 0,
      uMaskX:       clip.maskX ?? 0.5,
      uMaskY:       clip.maskY ?? 0.5,
      uMaskRadius:  clip.maskRadius ?? 0.3,
      uMaskAngle:   clip.maskAngle ?? 0,
      uMaskFeather: clip.maskFeather ?? 0.1,
      uMaskInvert:  clip.maskInvert ? 1 : 0,
      // Chroma key
      uChromaEnabled: clip.chromaKeyEnabled ? 1 : 0,
      uChromaThreshold: (clip.chromaKeyThreshold ?? 30) / 100,
      uLutEnabled: (clip.lutUri && lutTexRef.current) ? 1 : 0,
      uLutSize: lutSizeRef.current || 17,
      uMotionBlur: clip.motionBlur ? 0.6 : 0,
      // vec3 uniforms set separately
      _chromaR: chromaR,
      _chromaG: chromaG,
      _chromaB: chromaB,
    };
  }, [clip]);

  function renderFrame() {
    const gl = glRef.current;
    const prog = progRef.current;
    if (!gl || !prog || !texRef.current) return;

    gl.useProgram(prog);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Set uniforms
    const u = getUniforms();
    if (u) {
      Object.entries(u).forEach(([name, val]) => {
        if (name.startsWith('_')) return; // internal fields, not direct uniforms
        const loc = gl.getUniformLocation(prog, name);
        if (loc !== null) gl.uniform1f(loc, val as number);
      });
      // vec3 chroma color
      const chromaLoc = gl.getUniformLocation(prog, 'uChromaColor');
      if (chromaLoc !== null) gl.uniform3f(chromaLoc, u._chromaR as number, u._chromaG as number, u._chromaB as number);
      // HSL array uniforms (float[6])
      const hslHueLoc = gl.getUniformLocation(prog, 'uHslHue[0]');
      if (hslHueLoc !== null) (gl as any).uniform1fv(hslHueLoc, new Float32Array(u._hslHue as number[]));
      const hslSatLoc = gl.getUniformLocation(prog, 'uHslSat[0]');
      if (hslSatLoc !== null) (gl as any).uniform1fv(hslSatLoc, new Float32Array(u._hslSat as number[]));
      const hslLumLoc = gl.getUniformLocation(prog, 'uHslLum[0]');
      if (hslLumLoc !== null) (gl as any).uniform1fv(hslLumLoc, new Float32Array(u._hslLum as number[]));
    }

    // Aspect ratio uniforms — prevent image stretching
    const viewW = gl.drawingBufferWidth;
    const viewH = gl.drawingBufferHeight;
    const viewAspect = viewH > 0 ? viewW / viewH : 1;
    const viewLoc = gl.getUniformLocation(prog, 'uViewAspect');
    const imgLoc  = gl.getUniformLocation(prog, 'uImgAspect');
    if (viewLoc !== null) gl.uniform1f(viewLoc, viewAspect);
    if (imgLoc  !== null) gl.uniform1f(imgLoc, imgAspectRef.current);

    // Bind main image texture to unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texRef.current);
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);

    // Bind LUT texture to unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lutTexRef.current || texRef.current);
    gl.uniform1i(gl.getUniformLocation(prog, 'uLut'), 1);
    gl.activeTexture(gl.TEXTURE0);

    // Draw full-screen quad (vertices already uploaded on context create)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Commit frame
    (gl as any).endFrameEXP?.();
  }

  // Re-render when clip params change
  useEffect(() => {
    if (glRef.current && progRef.current && texRef.current) {
      renderFrame();
    }
  }, [
    clip?.brightness, clip?.contrast, clip?.saturation,
    clip?.temperature, clip?.tint, clip?.highlights, clip?.shadows,
    clip?.filter, clip?.filterIntensity,
    clip?.exposure, clip?.vibrance, clip?.clarity, clip?.dehaze,
    clip?.blacks, clip?.whites, clip?.fade, clip?.grain,
    // HSL — stringify for deep comparison
    JSON.stringify(clip?.hslHue), JSON.stringify(clip?.hslSat), JSON.stringify(clip?.hslLum),
    clip?.maskType, clip?.maskX, clip?.maskY, clip?.maskRadius, clip?.maskAngle, clip?.maskFeather, clip?.maskInvert,
    clip?.chromaKeyEnabled, clip?.chromaKeyColor, clip?.chromaKeyThreshold,
    clip?.motionBlur, clip?.lutUri,
  ]);

  // Load / reload 3D LUT texture when lutUri changes
  useEffect(() => {
    const gl = glRef.current;
    const prog = progRef.current;
    if (!gl || !prog || !glReady) return;
    if (!clip?.lutUri) {
      // Clear LUT
      if (lutTexRef.current) { gl.deleteTexture(lutTexRef.current); lutTexRef.current = null; lutSizeRef.current = 0; }
      renderFrame();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { parseCubeLUT } = require('../../lib/imageProcessor');
        const lut = await parseCubeLUT(clip.lutUri);
        if (!lut || cancelled) return;
        const N = Math.min(lut.size, 33);
        // Build N × N² RGBA pixel array (R along x, G+B combined along y)
        const pixels = new Uint8Array(N * N * N * 4);
        for (let b = 0; b < N; b++) {
          for (let g = 0; g < N; g++) {
            for (let r = 0; r < N; r++) {
              const lutIdx = r + g * N + b * N * N;
              const texIdx = (r + (g + b * N) * N) * 4;
              if (lutIdx < lut.table.length) {
                pixels[texIdx]     = Math.round(lut.table[lutIdx][0] * 255);
                pixels[texIdx + 1] = Math.round(lut.table[lutIdx][1] * 255);
                pixels[texIdx + 2] = Math.round(lut.table[lutIdx][2] * 255);
                pixels[texIdx + 3] = 255;
              }
            }
          }
        }
        if (cancelled) return;
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N * N, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        if (lutTexRef.current) gl.deleteTexture(lutTexRef.current);
        lutTexRef.current = tex;
        lutSizeRef.current = N;
        gl.activeTexture(gl.TEXTURE0);
        renderFrame();
      } catch (e) { console.warn('[PhotoGL] LUT load error:', e); }
    })();
    return () => { cancelled = true; };
  }, [glReady, clip?.lutUri]);

  // Load / reload texture whenever GL is ready OR the image URI changes
  useEffect(() => {
    if (!glReady || !clip?.uri) return;
    let cancelled = false;
    const gl = glRef.current;
    const prog = progRef.current;
    if (!gl || !prog) return;

    (async () => {
      try {
        // Delete old texture before loading new one
        if (texRef.current) {
          gl.deleteTexture(texRef.current);
          texRef.current = null;
        }

        const tex = gl.createTexture();
        if (!tex) return;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Use expo-image-manipulator to decode the image reliably (same as export pipeline)
        // This handles file://, content://, and all URI types correctly on Android
        const ImageManipulator = require('expo-image-manipulator');
        const result = await ImageManipulator.manipulateAsync(
          clip.uri,
          [],
          { format: 'jpeg', compress: 0.95 }
        );

        if (cancelled) return;

        imgAspectRef.current = result.width / Math.max(1, result.height);

        // expo-gl 16.x texImage2D requires a downloaded expo-asset Asset object.
        // After manipulateAsync the result.uri is a local file:// path — wrap it properly.
        const { Asset } = require('expo-asset');
        const glAsset = await Asset.fromURI(result.uri).downloadAsync();
        if (cancelled) return;

        (gl as any).texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
          glAsset as any
        );
        texRef.current = tex;
        renderFrame();
      } catch (e) {
        console.warn('[PhotoGL] texture error:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [glReady, clip?.uri]);

  // onContextCreate: only sets up GL program + geometry; texture loading is handled by the effect above
  const onContextCreate = useCallback(async (gl: WebGLRenderingContext) => {
    glRef.current = gl;

    // Build shader program
    const prog = buildProgram(gl);
    if (!prog) return;
    progRef.current = prog;
    gl.useProgram(prog);

    // Full-screen quad in NDC
    const verts = new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const aPosLoc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    // Signal that GL is ready — triggers the texture loading effect
    setGlReady(true);
  }, []);

  if (Platform.OS === 'web' || !clip) {
    return <View style={[styles.fallback, style]} />;
  }

  return (
    <GLView
      ref={glViewRef}
      style={[styles.glView, style]}
      onContextCreate={onContextCreate}
    />
  );
});

export default PhotoGLPreview;

const styles = StyleSheet.create({
  glView: { flex: 1, backgroundColor: '#000' },
  fallback: { flex: 1, backgroundColor: '#0A0A0A' },
});
