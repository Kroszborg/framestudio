import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Animated,
  Dimensions,
  TextInput,
  Image,
} from 'react-native';

import { Modal } from 'react-native';
function PromptModal({ visible, title, placeholder, onCancel, onSubmit }: any) {
  const [val, setVal] = useState('');
  useEffect(() => { if (visible) setVal(''); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '80%', backgroundColor: colors.surface1, borderRadius: radius.lg, padding: spacing[4] }}>
          <Text style={{ color: colors.textPrimary, fontSize: typography.base, fontWeight: '600', marginBottom: spacing[2] }}>{title}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface2, color: colors.textPrimary, borderRadius: radius.sm, padding: spacing[2], marginBottom: spacing[4] }}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            value={val}
            onChangeText={setVal}
            autoFocus
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[3] }}>
            <TouchableOpacity onPress={onCancel}><Text style={{ color: colors.textMuted, fontSize: typography.sm }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => onSubmit(val)}><Text style={{ color: colors.accent, fontSize: typography.sm, fontWeight: '600' }}>Create</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Add01Icon, Film01Icon, Video01Icon, Image01Icon,
  MusicNote01Icon, Search01Icon, Sorting01Icon,
  Folder01Icon, FolderAddIcon, Copy01Icon, Delete01Icon,
  MoreVerticalIcon, Clock01Icon, Cancel01Icon,
} from '@hugeicons/core-free-icons';
import {
  getProjects, deleteProject, duplicateProject,
  getFolders, createFolder, moveProjectToFolder, deleteFolder,
  Project, Folder,
} from '../../lib/database';
import { colors, typography, spacing, radius, shadows } from '../../lib/theme';

type SortBy = 'date' | 'name' | 'type';
type ViewMode = 'all' | 'recents' | 'folder';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const COLS = width >= 600 ? 3 : 2;
const CARD_W = (width - spacing[4] * 2 - CARD_GAP * (COLS - 1)) / COLS;

function ShimmerBlock({ style }: { style?: any }) {
  const translateX = useRef(new Animated.Value(-CARD_W)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, { toValue: CARD_W, duration: 1200, useNativeDriver: true })
    ).start();
  }, []);
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: colors.surface2 }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <ShimmerBlock style={styles.skeletonThumb} />
      <View style={styles.skeletonMeta}>
        <ShimmerBlock style={styles.skeletonLine1} />
        <ShimmerBlock style={styles.skeletonLine2} />
      </View>
    </View>
  );
}

const TIPS = [
  { step: '1', label: 'Create a project', sub: 'Choose video, photo, or audio' },
  { step: '2', label: 'Import media', sub: 'Add clips, music & photos' },
  { step: '3', label: 'Edit & trim', sub: 'Cut, color-grade, add text' },
  { step: '4', label: 'Export', sub: 'Share in HD or 4K' },
];

function EmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={styles.emptyWrap}>
      <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 20 }}>
        <HugeiconsIcon icon={Film01Icon} size={64} color={colors.accent} />
      </Animated.View>
      <Text style={styles.emptyTitle}>Welcome to FrameStudio</Text>
      <Text style={styles.emptySub}>Your creative workspace for video, photo & audio.</Text>
      <View style={styles.tipsList}>
        {TIPS.map(t => (
          <View key={t.step} style={styles.tipRow}>
            <View style={styles.tipBadge}><Text style={styles.tipBadgeText}>{t.step}</Text></View>
            <View style={styles.tipText}>
              <Text style={styles.tipLabel}>{t.label}</Text>
              <Text style={styles.tipSub}>{t.sub}</Text>
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.emptyBtn} onPress={onCreatePress} activeOpacity={0.8}>
        <HugeiconsIcon icon={Add01Icon} size={18} color={colors.bg} />
        <Text style={styles.emptyBtnText}>Create first project</Text>
      </TouchableOpacity>
    </View>
  );
}

function getTypeIcon(type: string) {
  if (type === 'audio') return MusicNote01Icon;
  if (type === 'photo') return Image01Icon;
  return Video01Icon;
}

function ProjectCard({ project, onPress, onLongPress }: {
  project: Project;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const durationSec = Math.floor(project.duration / 1000);
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const date = new Date(project.updatedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
  const typeIcon = getTypeIcon(project.type);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardThumb}>
        {project.thumbnailUri ? (
          <Image source={{ uri: project.thumbnailUri }} style={styles.thumbImage} />
        ) : (
          <View style={styles.thumbPlaceholderBox}>
            <HugeiconsIcon icon={typeIcon} size={28} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{durationStr}</Text>
        </View>
        <View style={styles.resBadge}>
          <Text style={styles.resText}>{project.resolution}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <HugeiconsIcon icon={typeIcon} size={12} color={colors.textSecondary} />
          <Text style={styles.cardTitle} numberOfLines={1}>{project.name}</Text>
        </View>
        <Text style={styles.cardSub}>{date} {'\u00B7'} {project.type || 'video'}</Text>
      </View>
    </TouchableOpacity>
  );
}

function FolderChip({ folder, active, onPress, onLongPress }: {
  folder: Folder;
  active: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.folderChip, active && styles.folderChipActive]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <HugeiconsIcon icon={Folder01Icon} size={14} color={active ? colors.accent : colors.textMuted} />
      <Text style={[styles.folderChipText, active && styles.folderChipTextActive]} numberOfLines={1}>
        {folder.name}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [searchVisible, setSearchVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderPromptVisible, setFolderPromptVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    try {
      const [data, flds] = await Promise.all([getProjects(), getFolders()]);
      setProjects(data || []);
      setFolders(flds || []);
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start();
    } catch {
      setProjects([]);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }

  const recentProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 4);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Folder filter
    if (viewMode === 'folder' && activeFolderId) {
      result = result.filter(p => p.folderId === activeFolderId);
    } else if (viewMode === 'recents') {
      result = result.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) || (p.type || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'type') {
      result.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    } else {
      result.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return result;
  }, [projects, searchQuery, sortBy, viewMode, activeFolderId]);

  function cycleSortBy() {
    setSortBy(s => s === 'date' ? 'name' : s === 'name' ? 'type' : 'date');
  }

  function handleLongPress(project: Project) {
    const folderItems = folders.map(f => ({
      text: `Move to ${f.name}`,
      onPress: async () => {
        await moveProjectToFolder(project.id, f.id);
        loadData();
      },
    }));

    Alert.alert(project.name, 'What do you want to do?', [
      { text: 'Open', onPress: () => router.push(`/editor/${project.id}` as Href) },
      {
        text: 'Duplicate', onPress: async () => {
          const dup = await duplicateProject(project.id);
          if (dup) loadData();
        },
      },
      ...(folders.length > 0 ? [{
        text: 'Move to folder...', onPress: () => {
          const items = [
            ...folderItems.map(f => ({ text: f.text, onPress: f.onPress })),
            ...(project.folderId ? [{ text: 'Remove from folder', onPress: async () => { await moveProjectToFolder(project.id, undefined); loadData(); } }] : []),
            { text: 'Cancel', style: 'cancel' as const },
          ];
          Alert.alert('Move to folder', '', items);
        },
      }] : []),
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteProject(project.id);
          setProjects(prev => prev.filter(p => p.id !== project.id));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleCreateFolder() {
    Alert.prompt?.('New folder', 'Enter folder name', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Create',
        onPress: async (name?: string) => {
          if (!name?.trim()) return;
          const folder: Folder = {
            id: `fld_${Date.now()}`,
            name: name.trim(),
            color: colors.textMuted,
            createdAt: Date.now(),
          };
          await createFolder(folder);
          setFolders(prev => [...prev, folder]);
        },
      },
    ]) ?? Alert.alert('New folder', 'Enter a name in settings');
  }

  function handleDeleteFolder(folder: Folder) {
    Alert.alert(`Delete "${folder.name}"?`, 'Projects inside won\'t be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteFolder(folder.id);
          if (activeFolderId === folder.id) {
            setActiveFolderId(null);
            setViewMode('all');
          }
          loadData();
        },
      },
    ]);
  }

  const renderItem = ({ item }: { item: Project }) => (
    <ProjectCard
      project={item}
      onPress={() => router.push(`/editor/${item.id}` as Href)}
      onLongPress={() => handleLongPress(item)}
    />
  );

  const sortLabel = sortBy === 'date' ? 'Date' : sortBy === 'name' ? 'Name' : 'Type';

  const ListHeader = useMemo(() => {
    if (viewMode !== 'all' || searchQuery || projects.length < 3) return null;
    return (
      <View style={styles.recentsSection}>
        <View style={styles.recentsHeader}>
          <HugeiconsIcon icon={Clock01Icon} size={14} color={colors.textMuted} />
          <Text style={styles.recentsTitle}>Recent</Text>
        </View>
        <FlatList
          horizontal
          data={recentProjects}
          keyExtractor={p => `recent_${p.id}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentsList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.recentCard}
              onPress={() => router.push(`/editor/${item.id}` as Href)}
              activeOpacity={0.7}
            >
              <View style={styles.recentThumb}>
                {item.thumbnailUri ? (
                  <Image source={{ uri: item.thumbnailUri }} style={styles.recentThumbImg} />
                ) : (
                  <HugeiconsIcon icon={getTypeIcon(item.type)} size={20} color={colors.textMuted} />
                )}
              </View>
              <Text style={styles.recentName} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
        <View style={styles.sectionDivider} />
        <Text style={styles.allProjectsLabel}>All projects</Text>
      </View>
    );
  }, [viewMode, searchQuery, projects.length, recentProjects]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Projects</Text>
          <Text style={styles.headerSub}>
            {loading ? '...' : `${filteredProjects.length}${searchQuery ? `/${projects.length}` : ''} project${projects.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setSearchVisible(v => !v)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <HugeiconsIcon icon={Search01Icon} size={18} color={searchVisible ? colors.textPrimary : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={cycleSortBy}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <HugeiconsIcon icon={Sorting01Icon} size={18} color={colors.textSecondary} />
            <Text style={styles.sortLabel}>{sortLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/new-project' as Href)}
            activeOpacity={0.8}
          >
            <HugeiconsIcon icon={Add01Icon} size={20} color={colors.bg} />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Folder bar */}
      {(folders.length > 0 || projects.length > 0) && (
        <View style={styles.folderBar}>
          <TouchableOpacity
            style={[styles.folderChip, viewMode === 'all' && styles.folderChipActive]}
            onPress={() => { setViewMode('all'); setActiveFolderId(null); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.folderChipText, viewMode === 'all' && styles.folderChipTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.folderChip, viewMode === 'recents' && styles.folderChipActive]}
            onPress={() => { setViewMode('recents'); setActiveFolderId(null); }}
            activeOpacity={0.7}
          >
            <HugeiconsIcon icon={Clock01Icon} size={13} color={viewMode === 'recents' ? colors.accent : colors.textMuted} />
            <Text style={[styles.folderChipText, viewMode === 'recents' && styles.folderChipTextActive]}>Recent</Text>
          </TouchableOpacity>
          {folders.map(f => (
            <FolderChip
              key={f.id}
              folder={f}
              active={viewMode === 'folder' && activeFolderId === f.id}
              onPress={() => { setViewMode('folder'); setActiveFolderId(f.id); }}
              onLongPress={() => handleDeleteFolder(f)}
            />
          ))}
          <TouchableOpacity style={styles.addFolderBtn} onPress={handleCreateFolder} activeOpacity={0.7}>
            <HugeiconsIcon icon={FolderAddIcon} size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {searchVisible && (
        <View style={styles.searchBar}>
          <HugeiconsIcon icon={Search01Icon} size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects\u2026"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <HugeiconsIcon icon={Cancel01Icon} size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : projects.length === 0 ? (
        <EmptyState onCreatePress={() => router.push('/new-project' as Href)} />

      ) : filteredProjects.length === 0 ? (
        <View style={styles.empty}>
          <HugeiconsIcon icon={Search01Icon} size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No results</Text>
          <Text style={styles.emptySub}>Try a different search</Text>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={filteredProjects}
            renderItem={renderItem}
            keyExtractor={p => p.id}
            numColumns={COLS}
            contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 16 }]}
            columnWrapperStyle={COLS > 1 ? styles.row : undefined}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={ListHeader}
          />
        </Animated.View>
      )}
      <PromptModal
        visible={folderPromptVisible}
        title="New folder"
        placeholder="Enter folder name"
        onCancel={() => setFolderPromptVisible(false)}
        onSubmit={onFolderSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography['2xl'], fontWeight: typography.bold,
    color: colors.textPrimary, letterSpacing: -0.5,
  },
  headerSub: { fontSize: typography.sm, color: colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  iconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: spacing[2], paddingVertical: spacing[2],
    borderRadius: radius.md, backgroundColor: colors.surface1,
  },
  sortLabel: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.medium },
  // Folder bar
  folderBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2] + 2,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  folderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: radius.full, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border,
  },
  folderChipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  folderChipText: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.medium },
  folderChipTextActive: { color: colors.accent, fontWeight: typography.semibold },
  addFolderBtn: {
    width: 32, height: 28, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.surface1,
    borderWidth: 1, borderColor: colors.border,
  },
  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  searchInput: {
    flex: 1, fontSize: typography.base, color: colors.textPrimary, paddingVertical: spacing[2],
  },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2] + 2,
    borderRadius: radius.full, gap: 4,
  },
  newBtnText: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.bg },
  // Recents
  recentsSection: { paddingTop: spacing[3], gap: spacing[2] },
  recentsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing[4],
  },
  recentsTitle: {
    fontSize: typography.sm, fontWeight: typography.semibold,
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  recentsList: { paddingHorizontal: spacing[4], gap: spacing[3] },
  recentCard: {
    width: 100, alignItems: 'center', gap: spacing[1],
  },
  recentThumb: {
    width: 100, height: 56, borderRadius: radius.md,
    backgroundColor: colors.surface1, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
  },
  recentThumbImg: { width: '100%', height: '100%' },
  recentName: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: typography.medium },
  sectionDivider: {
    height: 1, backgroundColor: colors.border,
    marginHorizontal: spacing[4], marginTop: spacing[2],
  },
  allProjectsLabel: {
    fontSize: typography.sm, fontWeight: typography.semibold,
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: spacing[4], marginBottom: spacing[1],
  },
  // Grid
  grid: { padding: spacing[4], gap: CARD_GAP },
  row: { gap: CARD_GAP, marginBottom: CARD_GAP },
  card: {
    width: CARD_W, backgroundColor: colors.bgCard, borderRadius: radius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadows.sm,
  },
  cardThumb: {
    width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surface1,
    position: 'relative', alignItems: 'center', justifyContent: 'center',
  },
  thumbPlaceholderBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  durationBadge: {
    position: 'absolute', bottom: 6, right: 6, backgroundColor: colors.overlay60,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm,
  },
  durationText: { fontSize: typography.xs, color: colors.textPrimary, fontWeight: typography.medium },
  resBadge: {
    position: 'absolute', top: 6, left: 6, backgroundColor: colors.accentMuted,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  resText: { fontSize: typography.xs, color: colors.accentText, fontWeight: typography.semibold },
  cardMeta: { padding: spacing[3] },
  cardTitle: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textPrimary },
  cardSub: { fontSize: typography.xs, color: colors.textMuted, marginTop: 2 },
  // Skeleton
  skeletonGrid: {
    padding: spacing[4], flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP,
  },
  skeletonCard: {
    width: CARD_W, backgroundColor: colors.bgCard, borderRadius: radius.lg,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
  },
  skeletonThumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surface2 },
  skeletonMeta: { padding: spacing[3], gap: 6 },
  skeletonLine1: { height: 14, backgroundColor: colors.surface2, borderRadius: radius.sm, width: '70%' },
  skeletonLine2: { height: 10, backgroundColor: colors.surface3, borderRadius: radius.sm, width: '40%' },
  // Empty
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing[3], paddingHorizontal: spacing[8],
  },
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[6], paddingVertical: spacing[8],
  },
  emptyTitle: { fontSize: typography.xl, fontWeight: typography.bold, color: colors.textPrimary, marginTop: spacing[2], textAlign: 'center' },
  emptySub: { fontSize: typography.base, color: colors.textMuted, textAlign: 'center', marginBottom: spacing[2] },
  tipsList: {
    width: '100%', maxWidth: 300, gap: spacing[3], marginBottom: spacing[4],
  },
  tipRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.lg,
    padding: spacing[3],
  },
  tipBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.accent + '22', alignItems: 'center', justifyContent: 'center',
  },
  tipBadgeText: { fontSize: 13, fontWeight: '700' as const, color: colors.accent },
  tipText: { flex: 1 },
  tipLabel: { fontSize: typography.base, fontWeight: '600' as const, color: colors.textPrimary },
  tipSub: { fontSize: typography.sm, color: colors.textMuted, marginTop: 1 },
  emptyBtn: {
    backgroundColor: colors.accent, paddingHorizontal: spacing[6],
    paddingVertical: spacing[3] + 2, borderRadius: radius.full,
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    shadowColor: '#fff', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  emptyBtnText: { fontSize: typography.base, fontWeight: typography.bold, color: colors.bg },
});
