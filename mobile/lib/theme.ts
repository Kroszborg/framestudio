// FrameStudio — Monochrome theme (dark default, light available)
// Black · White · Grey — no color accent

import { useColorScheme } from 'react-native';

export const darkColors = {
  // Base
  bg: '#0A0A0A',
  bgElevated: '#141414',
  bgCard: '#1A1A1A',
  bgInput: '#1C1C1C',

  // Surface layers
  surface1: '#1E1E1E',
  surface2: '#252525',
  surface3: '#2E2E2E',

  // Border
  border: '#2A2A2A',
  borderSubtle: '#1A1A1A',

  // Accent — white (monochrome, no color)
  accent: '#FFFFFF',
  accentDim: '#C0C0C0',
  accentMuted: 'rgba(255,255,255,0.08)',
  accentText: '#D0D0D0',

  // Text
  textPrimary: '#F5F5F5',
  textSecondary: '#9A9A9A',
  textMuted: '#555555',
  textDisabled: '#383838',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Timeline specific
  clipTrack1: '#1A1A1A',
  clipTrack1Border: '#444444',
  clipTrack2: '#1E1E1E',
  clipTrack2Border: '#3A3A3A',
  audioTrack: '#1A1A1A',
  audioTrackBorder: '#555555',
  transitionClip: '#222222',
  transitionBorder: '#666666',
  playhead: '#FFFFFF',
  timeRuler: '#555555',

  // Overlay
  overlay20: 'rgba(0,0,0,0.2)',
  overlay40: 'rgba(0,0,0,0.4)',
  overlay60: 'rgba(0,0,0,0.6)',
  overlay80: 'rgba(0,0,0,0.8)',
};

export const lightColors = {
  bg: '#F7F7F7',
  bgElevated: '#EFEFEF',
  bgCard: '#E8E8E8',
  bgInput: '#E0E0E0',
  surface1: '#DCDCDC',
  surface2: '#D5D5D5',
  surface3: '#CECECE',
  border: '#C8C8C8',
  borderSubtle: '#D8D8D8',
  accent: '#111111',
  accentDim: '#444444',
  accentMuted: 'rgba(0,0,0,0.07)',
  accentText: '#222222',
  textPrimary: '#0A0A0A',
  textSecondary: '#555555',
  textMuted: '#888888',
  textDisabled: '#BBBBBB',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  clipTrack1: '#E8E8E8',
  clipTrack1Border: '#AAAAAA',
  clipTrack2: '#F0F0F0',
  clipTrack2Border: '#BBBBBB',
  audioTrack: '#E8E8E8',
  audioTrackBorder: '#999999',
  transitionClip: '#DDDDDD',
  transitionBorder: '#888888',
  playhead: '#111111',
  timeRuler: '#888888',
  overlay20: 'rgba(255,255,255,0.2)',
  overlay40: 'rgba(255,255,255,0.4)',
  overlay60: 'rgba(255,255,255,0.6)',
  overlay80: 'rgba(255,255,255,0.8)',
};

// Static backward-compat export (dark) — existing components continue to work
export const colors = darkColors;

// Dynamic hook — use in components that should respond to theme changes
export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'light' ? lightColors : darkColors;
}

export const typography = {
  // Font sizes
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,

  // Font weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '900' as const,

  // Line heights
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Hit target minimum
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

export default {
  colors,
  typography,
  spacing,
  radius,
  shadows,
  hitSlop,
};
