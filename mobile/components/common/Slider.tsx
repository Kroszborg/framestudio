import { View, Text, StyleSheet } from 'react-native';
import RNSlider from '@react-native-community/slider';
import { colors, typography, spacing } from '../../lib/theme';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  formatter?: (value: number) => string;
  icon?: React.ReactNode;
}

export default function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onValueChange,
  formatter,
  icon,
}: SliderProps) {
  const displayValue = formatter ? formatter(value) : value.toFixed(2);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {icon}
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{displayValue}</Text>
      </View>
      <RNSlider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: 2,
  },
  label: {
    flex: 1,
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  value: {
    fontSize: typography.sm,
    color: colors.textPrimary,
    fontWeight: typography.medium,
    fontFamily: 'monospace',
    minWidth: 48,
    textAlign: 'right',
  },
  slider: {
    width: '100%',
    height: 32,
  },
});
