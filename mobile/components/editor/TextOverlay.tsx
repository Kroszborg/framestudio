import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography } from '../../lib/theme';

interface TextOverlayProps {
  text: string;
  positionX?: number; // 0-1
  positionY?: number; // 0-1
  fontSize?: number;
  color?: string;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function TextOverlay({
  text,
  positionX = 0.5,
  positionY = 0.5,
  fontSize: fs = 24,
  color = '#FFFFFF',
  isSelected,
  onSelect,
}: TextOverlayProps) {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          left: `${positionX * 100}%` as any,
          top: `${positionY * 100}%` as any,
          borderColor: isSelected ? colors.accent : 'transparent',
          borderWidth: isSelected ? 1 : 0,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <Text style={[styles.text, { fontSize: fs, color }]}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    transform: [{ translateX: '-50%' as any }, { translateY: '-50%' as any }],
    padding: 4,
    borderRadius: 4,
  },
  text: {
    fontWeight: typography.bold,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
