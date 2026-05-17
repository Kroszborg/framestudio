import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { colors, typography, spacing, radius } from '../lib/theme';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: May 14, 2026</Text>

        <Text style={styles.heading}>1. Information We Collect</Text>
        <Text style={styles.body}>
          FrameStudio does not collect, transmit, or store any personal data. All media editing is performed entirely on your device. We do not have access to your photos, videos, audio files, or project data.
        </Text>

        <Text style={styles.heading}>2. Local Storage</Text>
        <Text style={styles.body}>
          Project data, settings, and preferences are stored locally on your device using the app's sandboxed storage. This data is not accessible to other apps and is not transmitted to any server.
        </Text>

        <Text style={styles.heading}>3. Permissions</Text>
        <Text style={styles.body}>
          The App may request the following permissions:{'\n'}
          {'\u2022'} Media library access: To import photos, videos, and audio files for editing.{'\n'}
          {'\u2022'} Storage access: To save exported files to your device.{'\n'}
          {'\u2022'} Microphone: If you choose to record audio within the app.{'\n\n'}
          These permissions are used solely for the stated purposes and can be revoked at any time through your device settings.
        </Text>

        <Text style={styles.heading}>4. Third-Party Services</Text>
        <Text style={styles.body}>
          FrameStudio does not integrate any third-party analytics, advertising, or tracking services. No data is shared with third parties.
        </Text>

        <Text style={styles.heading}>5. Data Security</Text>
        <Text style={styles.body}>
          Since all data remains on your device, security depends on your device's own security measures. We recommend using device encryption and a screen lock to protect your content.
        </Text>

        <Text style={styles.heading}>6. Children's Privacy</Text>
        <Text style={styles.body}>
          FrameStudio does not knowingly collect information from children under 13. The App is intended for general audiences.
        </Text>

        <Text style={styles.heading}>7. Changes to This Policy</Text>
        <Text style={styles.body}>
          We may update this Privacy Policy from time to time. Changes will be reflected in the "Last updated" date above.
        </Text>

        <Text style={styles.heading}>8. Contact</Text>
        <Text style={styles.body}>
          If you have questions about this Privacy Policy, contact us at support@framestudio.app.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface1, borderRadius: radius.full,
  },
  navTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
  },
  content: {
    padding: spacing[4],
    paddingBottom: 60,
    gap: spacing[2],
  },
  updated: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing[3],
  },
  heading: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginTop: spacing[4],
  },
  body: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
