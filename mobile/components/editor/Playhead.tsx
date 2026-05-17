import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';

interface PlayheadProps {
  position: number; // px from left
}

export default function Playhead({ position }: PlayheadProps) {
  return (
    <View style={[styles.container, { left: position }]} pointerEvents="none">
      <View style={styles.head} />
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: 10,
  },
  head: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.playhead,
    marginLeft: -4,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.playhead,
    opacity: 0.85,
  },
});
