import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../../lib/theme';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  size?: number;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}

export default function IconButton({
  icon,
  onPress,
  size = 40,
  variant = 'default',
  disabled = false,
  style,
}: IconButtonProps) {
  const bgColors: Record<string, string> = {
    default: colors.surface2,
    primary: colors.accent,
    danger: colors.error,
    ghost: 'transparent',
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColors[variant],
          opacity: disabled ? 0.4 : 1,
        },
        variant === 'default' && styles.bordered,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
