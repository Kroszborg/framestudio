import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../../lib/theme';

interface TrackRowProps {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  height?: number;
}

const DEFAULT_H = 48;

export default function TrackRow({ label, icon, children, height = DEFAULT_H }: TrackRowProps) {
  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.labelCol}>
        {icon}
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={[styles.trackArea, { height }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  labelCol: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.bgElevated,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  labelText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.semibold,
  },
  trackArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.bg,
  },
});
