import { Tabs } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Film01Icon, Settings01Icon } from '@hugeicons/core-free-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors, typography } from '../../lib/theme';

export default function TabLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  // On Android with gesture navigation, insets.bottom can be 0 even when gesture zone is active.
  // Use 20px minimum so tab bar content never overlaps the swipe-home gesture area.
  const bottomPad = Math.max(insets.bottom, 20);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
          // Ensure tab bar always renders above Android system UI
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.xs,
          fontWeight: typography.medium,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={Film01Icon} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <HugeiconsIcon icon={Settings01Icon} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
