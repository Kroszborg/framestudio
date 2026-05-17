import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  Alert,
  Appearance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Film01Icon, SpeedTrain01Icon, CropIcon,
  File01Icon, StarIcon,
  SaveIcon, PhoneDeveloperModeIcon, ChartBarIncreasingIcon,
  PlayIcon, ServerStack01Icon, Delete01Icon,
  InformationCircleIcon, CodeIcon,
  Tick01Icon, ArrowRight01Icon,
  DocumentValidationIcon, SecurityCheckIcon,
  Share01Icon, Moon01Icon, Sun01Icon, Settings01Icon,
} from '@hugeicons/core-free-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter, type Href } from 'expo-router';
import { useThemeColors, typography, spacing, radius } from '../../lib/theme';
import { syncProjects, canSync } from '../../lib/sync';
import { getAuthState } from '../../lib/auth';

const ShieldIcon = SecurityCheckIcon;

const SETTINGS_KEY = 'framestudio_settings_v2';
const THEME_KEY = 'framestudio_theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface Settings {
  defaultResolution: '4K' | '2K' | '1080p' | '720p' | '480p';
  defaultFrameRate: 24 | 25 | 30 | 50 | 60;
  defaultAspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
  defaultFormat: 'mp4' | 'mov';
  defaultQuality: 'high' | 'medium' | 'low';
  autoSave: boolean;
  haptics: boolean;
  showFps: boolean;
  proxyPlayback: boolean;
}

const DEFAULTS: Settings = {
  defaultResolution: '1080p',
  defaultFrameRate: 30,
  defaultAspectRatio: '16:9',
  defaultFormat: 'mp4',
  defaultQuality: 'high',
  autoSave: true,
  haptics: true,
  showFps: false,
  proxyPlayback: false,
};

function SectionHeader({ title }: { title: string }) {
  const colors = useThemeColors();
  return (
    <Text style={{
      fontSize: typography.xs, fontWeight: typography.semibold, color: colors.textMuted,
      textTransform: 'uppercase', letterSpacing: 1,
      paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: spacing[2],
    }}>{title}</Text>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  children,
  danger,
}: {
  icon: any;
  label: string;
  value?: string;
  onPress?: () => void;
  children?: React.ReactNode;
  danger?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing[4], paddingVertical: spacing[3] + 2, minHeight: 52,
      }}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={{
          width: 30, height: 30, borderRadius: radius.sm + 2,
          backgroundColor: danger ? 'rgba(239,68,68,0.1)' : colors.accentMuted,
          alignItems: 'center', justifyContent: 'center', marginRight: spacing[3],
        }}>
          <HugeiconsIcon icon={icon} size={17} color={danger ? colors.error : colors.textPrimary} />
        </View>
        <Text style={{
          fontSize: typography.base, color: danger ? colors.error : colors.textPrimary,
          fontWeight: typography.medium,
        }}>{label}</Text>
      </View>
      {children ?? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          {value && <Text style={{ fontSize: typography.sm, color: colors.textMuted }}>{value}</Text>}
          {onPress && <HugeiconsIcon icon={ArrowRight01Icon} size={14} color={colors.textMuted} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

function PickerSheet<T extends string | number>({
  visible,
  options,
  current,
  onSelect,
  onClose,
  title,
}: {
  visible: boolean;
  options: { label: string; value: T }[];
  current: T;
  onSelect: (v: T) => void;
  onClose: () => void;
  title: string;
}) {
  const colors = useThemeColors();
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay60, justifyContent: 'flex-end', zIndex: 100 }]}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
      <View style={{
        backgroundColor: colors.bgElevated, borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl, padding: spacing[4], paddingBottom: spacing[8], gap: 2,
      }}>
        <Text style={{
          fontSize: typography.md, fontWeight: typography.bold, color: colors.textPrimary,
          marginBottom: spacing[3], textAlign: 'center',
        }}>{title}</Text>
        {options.map(o => (
          <TouchableOpacity
            key={String(o.value)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: spacing[4], paddingVertical: spacing[3] + 2, borderRadius: radius.md,
            }}
            onPress={() => { onSelect(o.value); onClose(); }}
            activeOpacity={0.7}
          >
            <Text style={{
              fontSize: typography.base,
              color: o.value === current ? colors.accent : colors.textSecondary,
              fontWeight: o.value === current ? typography.semibold : typography.regular,
            }}>
              {o.label}
            </Text>
            {o.value === current && <HugeiconsIcon icon={Tick01Icon} size={16} color={colors.accent} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useThemeColors();
  const styles = makeStyles(colors);
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [storageUsed, setStorageUsed] = useState<string>('...');
  const [sheet, setSheet] = useState<keyof Settings | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  useEffect(() => {
    loadSettings();
    loadStorageInfo();
    loadTheme();
  }, []);

  async function loadTheme() {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeMode(saved);
      }
    } catch {}
  }

  async function applyTheme(mode: ThemeMode) {
    setThemeMode(mode);
    await AsyncStorage.setItem(THEME_KEY, mode);
    if (mode === 'system') {
      Appearance.setColorScheme(null as any);
    } else {
      Appearance.setColorScheme(mode);
    }
  }

  async function loadSettings() {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }

  async function saveSettings(next: Settings) {
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    saveSettings({ ...settings, [key]: value });
  }

  async function loadStorageInfo() {
    if (Platform.OS === 'web') { setStorageUsed('N/A'); return; }
    try {
      const info = await FileSystem.getFreeDiskStorageAsync();
      const total = await FileSystem.getTotalDiskCapacityAsync();
      const usedGB = ((total - info) / 1e9).toFixed(1);
      const totalGB = (total / 1e9).toFixed(0);
      setStorageUsed(`${usedGB} / ${totalGB} GB`);
    } catch {
      setStorageUsed('Unknown');
    }
  }

  async function clearCache() {
    Alert.alert('Clear cache', 'This removes temporary files. Your projects are safe.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          try {
            const cacheDir = (FileSystem as any).cacheDirectory;
            if (cacheDir) {
              const files = await FileSystem.readDirectoryAsync(cacheDir);
              for (const f of files) {
                await FileSystem.deleteAsync(cacheDir + f, { idempotent: true });
              }
            }
            Alert.alert('Done', 'Cache cleared');
          } catch {
            Alert.alert('Error', 'Could not clear cache');
          }
        }
      },
    ]);
  }

  const sheetConfig: Record<string, { title: string; options: { label: string; value: any }[] }> = {
    defaultResolution: {
      title: 'Default resolution',
      options: [
        { label: '4K \u2014 3840\u00D72160', value: '4K' },
        { label: '2K \u2014 2560\u00D71440', value: '2K' },
        { label: '1080p \u2014 1920\u00D71080', value: '1080p' },
        { label: '720p \u2014 1280\u00D7720', value: '720p' },
        { label: '480p \u2014 854\u00D7480', value: '480p' },
      ],
    },
    defaultFrameRate: {
      title: 'Default frame rate',
      options: [24, 25, 30, 50, 60].map(fps => ({ label: `${fps} fps`, value: fps })),
    },
    defaultAspectRatio: {
      title: 'Default aspect ratio',
      options: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'].map(v => ({ label: v, value: v })),
    },
    defaultFormat: {
      title: 'Export format',
      options: [
        { label: 'MP4 (H.264)', value: 'mp4' },
        { label: 'MOV (ProRes)', value: 'mov' },
      ],
    },
    defaultQuality: {
      title: 'Export quality',
      options: [
        { label: 'High', value: 'high' },
        { label: 'Medium', value: 'medium' },
        { label: 'Low', value: 'low' },
      ],
    },
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <SectionHeader title="Export defaults" />
        <View style={styles.card}>
          <Row
            icon={Film01Icon}
            label="Resolution"
            value={settings.defaultResolution}
            onPress={() => setSheet('defaultResolution')}
          />
          <View style={styles.divider} />
          <Row
            icon={SpeedTrain01Icon}
            label="Frame rate"
            value={`${settings.defaultFrameRate} fps`}
            onPress={() => setSheet('defaultFrameRate')}
          />
          <View style={styles.divider} />
          <Row
            icon={CropIcon}
            label="Aspect ratio"
            value={settings.defaultAspectRatio}
            onPress={() => setSheet('defaultAspectRatio')}
          />
          <View style={styles.divider} />
          <Row
            icon={File01Icon}
            label="Format"
            value={settings.defaultFormat.toUpperCase()}
            onPress={() => setSheet('defaultFormat')}
          />
          <View style={styles.divider} />
          <Row
            icon={StarIcon}
            label="Quality"
            value={settings.defaultQuality.charAt(0).toUpperCase() + settings.defaultQuality.slice(1)}
            onPress={() => setSheet('defaultQuality')}
          />
        </View>

        <SectionHeader title="Editor" />
        <View style={styles.card}>
          <Row icon={SaveIcon} label="Auto-save">
            <Switch
              value={settings.autoSave}
              onValueChange={v => update('autoSave', v)}
              trackColor={{ true: colors.accent, false: colors.surface2 }}
              thumbColor={colors.textPrimary}
            />
          </Row>
          <View style={styles.divider} />
          <Row icon={PhoneDeveloperModeIcon} label="Haptics">
            <Switch
              value={settings.haptics}
              onValueChange={v => update('haptics', v)}
              trackColor={{ true: colors.accent, false: colors.surface2 }}
              thumbColor={colors.textPrimary}
            />
          </Row>
          <View style={styles.divider} />
          <Row icon={ChartBarIncreasingIcon} label="Show FPS overlay">
            <Switch
              value={settings.showFps}
              onValueChange={v => update('showFps', v)}
              trackColor={{ true: colors.accent, false: colors.surface2 }}
              thumbColor={colors.textPrimary}
            />
          </Row>
          <View style={styles.divider} />
          <Row icon={PlayIcon} label="Proxy playback">
            <Switch
              value={settings.proxyPlayback}
              onValueChange={v => update('proxyPlayback', v)}
              trackColor={{ true: colors.accent, false: colors.surface2 }}
              thumbColor={colors.textPrimary}
            />
          </Row>
        </View>

        <SectionHeader title="Appearance" />
        <View style={styles.card}>
          <View style={styles.themeRow}>
            {([
              { mode: 'light' as ThemeMode, icon: Sun01Icon, label: 'Light' },
              { mode: 'system' as ThemeMode, icon: Settings01Icon, label: 'System' },
              { mode: 'dark' as ThemeMode, icon: Moon01Icon, label: 'Dark' },
            ]).map(({ mode, icon, label }) => (
              <TouchableOpacity
                key={mode}
                style={[styles.themeOption, themeMode === mode && styles.themeOptionActive]}
                onPress={() => applyTheme(mode)}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={icon}
                  size={20}
                  color={themeMode === mode ? colors.accent : colors.textMuted}
                />
                <Text style={[styles.themeLabel, themeMode === mode && styles.themeLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <SectionHeader title="Storage" />
        <View style={styles.card}>
          <Row icon={ServerStack01Icon} label="Disk usage" value={storageUsed} />
          <View style={styles.divider} />
          <Row icon={Delete01Icon} label="Clear cache" onPress={clearCache} />
        </View>

        <SectionHeader title="Cloud sync" />
        <View style={styles.card}>
          <Row
            icon={Share01Icon}
            label="Sync projects"
            value={syncing ? 'Syncing...' : (canSync() ? 'Connected' : 'Sign in required')}
            onPress={canSync() ? async () => {
              setSyncing(true);
              await syncProjects();
              setSyncing(false);
            } : undefined}
          />
          {!canSync() && (
            <>
              <View style={styles.divider} />
              <View style={[styles.row, { paddingVertical: 8 }]}>
                <Text style={{ fontSize: 12, color: colors.textMuted, paddingLeft: 46 }}>
                  Sign in to enable cross-device project sync
                </Text>
              </View>
            </>
          )}
        </View>

        <SectionHeader title="Legal" />
        <View style={styles.card}>
          <Row
            icon={DocumentValidationIcon}
            label="Terms of Service"
            onPress={() => router.push('/terms' as Href)}
          />
          <View style={styles.divider} />
          <Row
            icon={ShieldIcon}
            label="Privacy Policy"
            onPress={() => router.push('/privacy' as Href)}
          />
        </View>

        <SectionHeader title="About" />
        <View style={styles.card}>
          <Row icon={InformationCircleIcon} label="Version" value="2.0.0" />
          <View style={styles.divider} />
          <Row icon={CodeIcon} label="Build" value="production" />
        </View>
      </ScrollView>

      {sheet && sheetConfig[sheet] && (
        <PickerSheet
          visible={true}
          title={sheetConfig[sheet].title}
          options={sheetConfig[sheet].options}
          current={(settings as any)[sheet]}
          onSelect={(v) => update(sheet as keyof Settings, v)}
          onClose={() => setSheet(null)}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography['2xl'],
    fontWeight: typography.bold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  sectionHeader: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
  },
  card: {
    marginHorizontal: spacing[4],
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing[4] + 36 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
    minHeight: 52,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  rowIconDanger: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  rowLabel: { fontSize: typography.base, color: colors.textPrimary, fontWeight: typography.medium },
  rowLabelDanger: { color: colors.error },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  rowValue: { fontSize: typography.sm, color: colors.textMuted },
  // Sheet
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay60,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[4],
    paddingBottom: spacing[8],
    gap: 2,
  },
  sheetTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
    borderRadius: radius.md,
  },
  sheetOptionText: { fontSize: typography.base, color: colors.textSecondary },
  sheetOptionActive: { color: colors.accent, fontWeight: typography.semibold },
  // Theme toggle
  themeRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    gap: 6,
    backgroundColor: colors.surface1,
  },
  themeOptionActive: {
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  themeLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontWeight: typography.medium,
  },
  themeLabelActive: {
    color: colors.accent,
    fontWeight: typography.semibold,
  },
  });
}
