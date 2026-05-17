import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { colors, typography, spacing, radius } from '../lib/theme';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Terms of Service</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: May 14, 2026</Text>

        <Text style={styles.heading}>1. Acceptance of Terms</Text>
        <Text style={styles.body}>
          By downloading, installing, or using FrameStudio ("the App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.
        </Text>

        <Text style={styles.heading}>2. Use of the App</Text>
        <Text style={styles.body}>
          FrameStudio is a mobile video, photo, and audio editing application. You may use the App for personal and commercial content creation. You are responsible for all content you create, edit, and share using the App.
        </Text>

        <Text style={styles.heading}>3. User Content</Text>
        <Text style={styles.body}>
          You retain all rights to the media you import and create. FrameStudio does not claim ownership of your content. All editing is performed locally on your device. We do not upload, store, or access your media files on any server.
        </Text>

        <Text style={styles.heading}>4. Prohibited Uses</Text>
        <Text style={styles.body}>
          You agree not to use the App to create content that is illegal, harmful, threatening, abusive, defamatory, or violates the rights of others. You may not reverse engineer, decompile, or attempt to extract the source code of the App.
        </Text>

        <Text style={styles.heading}>5. Intellectual Property</Text>
        <Text style={styles.body}>
          The App, including its design, code, features, and branding, is owned by the developers of FrameStudio and is protected by copyright and intellectual property laws.
        </Text>

        <Text style={styles.heading}>6. Disclaimer of Warranties</Text>
        <Text style={styles.body}>
          The App is provided "as is" without warranties of any kind, express or implied. We do not guarantee uninterrupted or error-free operation.
        </Text>

        <Text style={styles.heading}>7. Limitation of Liability</Text>
        <Text style={styles.body}>
          In no event shall FrameStudio be liable for any indirect, incidental, special, or consequential damages arising from use of the App, including loss of data or content.
        </Text>

        <Text style={styles.heading}>8. Changes to Terms</Text>
        <Text style={styles.body}>
          We reserve the right to modify these terms at any time. Continued use of the App after changes constitutes acceptance of the updated terms.
        </Text>

        <Text style={styles.heading}>9. Contact</Text>
        <Text style={styles.body}>
          For questions about these terms, contact us at support@framestudio.app.
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
