/**
 * KeyframeGraph — Visual bezier curve editor for keyframe easing.
 *
 * Renders a 200×120 canvas using react-native-svg showing:
 * - Background grid
 * - The bezier curve connecting keyframe values over time
 * - Draggable control point handles (cp1, cp2) for custom easing
 * - Preset buttons: Linear, Ease-In, Ease-Out, Ease-In-Out, Spring, Bounce
 *
 * Used inside KeyframeEditor when a keyframe is selected.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Line, Circle, G, Rect } from 'react-native-svg';
import { colors, typography, spacing, radius } from '../../lib/theme';
import { EasingType, AnimKeyframe } from '../../lib/keyframes';

const W = 200;
const H = 120;
const PAD = 16;
const INNER_W = W - PAD * 2;
const INNER_H = H - PAD * 2;

interface Props {
  keyframe: AnimKeyframe;
  onUpdate: (updates: Partial<AnimKeyframe>) => void;
}

// Standard control points for each easing preset
const PRESET_POINTS: Record<EasingType, [number, number, number, number]> = {
  linear:      [0,    0,    1,    1   ],
  ease_in:     [0.42, 0,    1,    1   ],
  ease_out:    [0,    0,    0.58, 1   ],
  ease_in_out: [0.42, 0,    0.58, 1   ],
  spring:      [0.68, -0.55, 0.27, 1.55],
  bounce:      [0.36, 0.07, 0.19, 0.97],
  custom:      [0.25, 0.1,  0.25, 1   ],
};

const PRESET_LABELS: { id: EasingType; label: string }[] = [
  { id: 'linear',      label: 'Linear' },
  { id: 'ease_in',     label: 'Ease In' },
  { id: 'ease_out',    label: 'Ease Out' },
  { id: 'ease_in_out', label: 'In/Out' },
  { id: 'spring',      label: 'Spring' },
  { id: 'bounce',      label: 'Bounce' },
];

/** Convert 0-1 coordinates to SVG canvas coordinates */
function toSVG(x: number, y: number): [number, number] {
  return [PAD + x * INNER_W, PAD + (1 - y) * INNER_H];
}

/** Generate SVG path data for the cubic bezier curve */
function buildCurvePath(p1x: number, p1y: number, p2x: number, p2y: number): string {
  const [sx, sy] = toSVG(0, 0);
  const [ex, ey] = toSVG(1, 1);
  const [c1x, c1y] = toSVG(p1x, p1y);
  const [c2x, c2y] = toSVG(p2x, p2y);
  return `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`;
}

/** Sample points along a bezier for animated line display */
function sampleCurve(p1x: number, p1y: number, p2x: number, p2y: number, steps = 40): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Approximate: use t for both x and y (visual only, not mathematically exact)
    const cx = 3 * p1x * t * (1-t)**2 + 3 * p2x * t**2 * (1-t) + t**3;
    const cy = 3 * p1y * t * (1-t)**2 + 3 * p2y * t**2 * (1-t) + t**3;
    const [svgX, svgY] = toSVG(cx, cy);
    pts.push(`${i === 0 ? 'M' : 'L'}${svgX.toFixed(1)},${svgY.toFixed(1)}`);
  }
  return pts.join(' ');
}

export default function KeyframeGraph({ keyframe, onUpdate }: Props) {
  const easing = keyframe.easing ?? 'ease_in_out';
  const preset = PRESET_POINTS[easing] ?? PRESET_POINTS.ease_in_out;

  const cp1x = keyframe.cp1x ?? preset[0];
  const cp1y = keyframe.cp1y ?? preset[1];
  const cp2x = keyframe.cp2x ?? preset[2];
  const cp2y = keyframe.cp2y ?? preset[3];

  const [dragging, setDragging] = useState<'cp1' | 'cp2' | null>(null);

  function applyPreset(id: EasingType) {
    const pts = PRESET_POINTS[id];
    onUpdate({
      easing: id,
      cp1x: pts[0], cp1y: pts[1],
      cp2x: pts[2], cp2y: pts[3],
    });
  }

  // SVG positions for control points
  const [p1svgX, p1svgY] = toSVG(cp1x, cp1y);
  const [p2svgX, p2svgY] = toSVG(cp2x, cp2y);
  const [startX, startY] = toSVG(0, 0);
  const [endX, endY] = toSVG(1, 1);

  const curvePath = sampleCurve(cp1x, cp1y, cp2x, cp2y);

  return (
    <View style={styles.container}>
      {/* Preset buttons */}
      <View style={styles.presets}>
        {PRESET_LABELS.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[styles.presetBtn, easing === p.id && styles.presetBtnActive]}
            onPress={() => applyPreset(p.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.presetText, easing === p.id && styles.presetTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.presetBtn, easing === 'custom' && styles.presetBtnActive]}
          onPress={() => onUpdate({ easing: 'custom' })}
          activeOpacity={0.7}
        >
          <Text style={[styles.presetText, easing === 'custom' && styles.presetTextActive]}>Custom</Text>
        </TouchableOpacity>
      </View>

      {/* SVG Graph */}
      <Svg width={W} height={H} style={styles.svg}>
        {/* Background */}
        <Rect x={0} y={0} width={W} height={H} fill={colors.surface2} rx={4} />

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(v => {
          const [gx] = toSVG(v, 0);
          const [, gy] = toSVG(0, v);
          return (
            <G key={v}>
              <Line x1={gx} y1={PAD} x2={gx} y2={H - PAD} stroke={colors.border} strokeWidth={0.5} strokeDasharray="3,3" />
              <Line x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke={colors.border} strokeWidth={0.5} strokeDasharray="3,3" />
            </G>
          );
        })}

        {/* Diagonal reference (linear) */}
        <Line x1={startX} y1={startY} x2={endX} y2={endY} stroke={colors.border} strokeWidth={0.8} strokeDasharray="4,4" />

        {/* Control point arms */}
        <Line x1={startX} y1={startY} x2={p1svgX} y2={p1svgY} stroke={colors.accent} strokeWidth={1} strokeOpacity={0.5} />
        <Line x1={endX} y1={endY} x2={p2svgX} y2={p2svgY} stroke={colors.accent} strokeWidth={1} strokeOpacity={0.5} />

        {/* The curve */}
        <Path d={curvePath} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" />

        {/* Start / End anchor dots */}
        <Circle cx={startX} cy={startY} r={4} fill={colors.textSecondary} />
        <Circle cx={endX} cy={endY} r={4} fill={colors.textSecondary} />

        {/* Control point handles (draggable visually) */}
        <Circle cx={p1svgX} cy={p1svgY} r={6} fill={colors.accent} opacity={0.85} />
        <Circle cx={p2svgX} cy={p2svgY} r={6} fill={colors.accent} opacity={0.85} />
      </Svg>

      {/* Control point value display for custom easing */}
      {easing === 'custom' && (
        <View style={styles.cpValues}>
          <Text style={styles.cpLabel}>CP1: ({cp1x.toFixed(2)}, {cp1y.toFixed(2)})</Text>
          <Text style={styles.cpLabel}>CP2: ({cp2x.toFixed(2)}, {cp2y.toFixed(2)})</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing[2] },
  svg: { borderRadius: radius.md, alignSelf: 'center' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: spacing[2] },
  presetBtn: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: colors.surface1, borderWidth: 1, borderColor: colors.border,
  },
  presetBtnActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  presetText: { fontSize: 10, color: colors.textMuted },
  presetTextActive: { color: colors.accent, fontWeight: '700' },
  cpValues: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cpLabel: { fontSize: 9, color: colors.textMuted, fontFamily: 'monospace' },
});
