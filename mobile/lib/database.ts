import * as FileSystem from 'expo-file-system/legacy';

const DB_FILE = `${(FileSystem as any).documentDirectory}framestudio_db.json`;

export type ProjectType = 'video' | 'audio' | 'photo';

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  resolution: '4K' | '2K' | '1080p' | '720p' | '480p';
  frameRate: 24 | 25 | 30 | 50 | 60;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
  createdAt: number;
  updatedAt: number;
  thumbnailUri?: string;
  duration: number; // total ms
  folderId?: string; // folder grouping
}

export interface Folder {
  id: string;
  name: string;
  color: string; // hex
  createdAt: number;
}

export interface VolumeKeyframe {
  time: number;  // ms relative to clip start
  value: number; // 0-1
}

export interface KenBurnsConfig {
  enabled: boolean;
  startX: number; // 0-1
  startY: number;
  startZoom: number; // 1-2
  endX: number;
  endY: number;
  endZoom: number;
}

export type TextAnimation = 'none' | 'fade_in' | 'fade_out' | 'slide_up' | 'slide_down' | 'typewriter' | 'scale_in' | 'bounce' | 'zoom_out' | 'blur_in' | 'glitch' | 'shake' | 'roll_left' | 'pulse' | 'wave' | 'flicker' | 'neon_glow' | 'split_reveal' | 'spotlight' | 'rise';

export interface Clip {
  id: string;
  projectId: string;
  uri: string;
  type: 'video' | 'image' | 'audio';
  name: string;
  startTime: number;  // ms on timeline
  duration: number;   // ms
  trimStart: number;  // ms trim from source start
  trimEnd: number;    // ms trim from source end
  trackIndex: number; // 0=primary, 1=overlay, 2=audio
  orderIndex: number;
  volume: number;     // 0-1
  speed: number;      // 0.1-4.0, default 1.0
  // Color grading — basic
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
  saturation: number; // -100 to 100
  temperature: number; // -100 to 100
  tint: number;       // -100 to 100
  highlights: number; // -100 to 100
  shadows: number;    // -100 to 100
  sharpness: number;  // 0 to 100
  filter: string | null;
  filterIntensity: number; // 0-100, default 100
  // Color grading — advanced (Lightroom-level)
  exposure: number;   // -3.0 to 3.0 EV, default 0
  vibrance: number;   // -100 to 100, default 0
  clarity: number;    // -100 to 100, default 0
  dehaze: number;     // -100 to 100, default 0
  blacks: number;     // -100 to 100, default 0
  whites: number;     // -100 to 100, default 0
  fade: number;       // 0 to 100 (film fade), default 0
  grain: number;      // 0 to 100, default 0
  // HSL per-channel (6 zones: Reds, Oranges, Yellows, Greens, Cyans, Blues)
  hslHue: number[];   // 6 values, each -180 to 180, default [0,0,0,0,0,0]
  hslSat: number[];   // 6 values, each -100 to 100, default [0,0,0,0,0,0]
  hslLum: number[];   // 6 values, each -100 to 100, default [0,0,0,0,0,0]
  // Photo-only mask
  maskType?: 'none' | 'radial' | 'linear'; // default 'none'
  maskX?: number;     // 0-1, center X
  maskY?: number;     // 0-1, center Y
  maskRadius?: number; // 0-1
  maskAngle?: number;  // degrees (linear mask)
  maskFeather?: number; // 0-1
  maskInvert?: boolean;
  // Motion blur
  motionBlur: boolean;
  // Ken Burns (images only)
  kenBurns: KenBurnsConfig;
  // Volume keyframes
  volumeKeyframes: VolumeKeyframe[];
  // Crop / position
  cropX: number;      // 0-1 fraction of width
  cropY: number;      // 0-1 fraction of height
  cropW: number;      // 0-1 fraction of width
  cropH: number;      // 0-1 fraction of height
  positionX: number;  // -1 to 1 normalized offset
  positionY: number;
  scaleX: number;     // 0.1 to 4.0
  scaleY: number;
  rotation: number;   // degrees
  flipH: boolean;     // horizontal flip
  flipV: boolean;     // vertical flip
  // Transition to next clip
  transitionType: 'none' | 'fade' | 'dissolve' | 'slide_left' | 'slide_right' | 'zoom' | 'wipe' | 'blur' | 'spin' | 'glitch' | 'flash' | 'diagonal' | 'color_wipe' | 'barn_door' | 'push_left' | 'push_right' | 'circle_wipe' | 'cross_zoom' | 'pixelate' | 'flip' | 'whip_pan' | 'cube';
  transitionDuration: number; // ms
  // Custom LUT
  lutUri: string | null; // file:// path to imported .cube LUT
  lutName: string | null;
  // Speed ramp curve
  speedRampCurve?: 'constant' | 'ease_in' | 'ease_out' | 'ease_in_out' | 'freeze';
  // Clip opacity (0-1)
  opacity: number;
  // Chroma key (green screen)
  chromaKeyEnabled: boolean;
  chromaKeyColor: string;    // hex color to key out, default '#00FF00'
  chromaKeyThreshold: number; // 0-100 sensitivity
  // Video enhancement
  stabilize: boolean;
  denoise: boolean;
  // Playback direction
  reverse: boolean;
  // Audio fades (ms) — applied at clip start/end
  fadeIn: number;
  fadeOut: number;
  // Quality enhancer
  enhance?: boolean;
  // Background removal
  backgroundRemovalEnabled?: boolean;
  backgroundReplacementColor?: string; // hex or 'transparent'
  backgroundFeather?: number; // 0-20 edge softness
  // 3D Parallax camera effect
  parallaxEnabled?: boolean;
  parallaxPreset?: 'dolly_in' | 'pan_left' | 'pan_right' | 'orbit' | 'push_forward' | 'drift';
  parallaxSpeed?: number; // 0.3-3.0, default 1.0
  parallaxLayers?: Array<{ id: string; x: number; y: number; width: number; height: number; depth: number }>;
  // Clip In/Out transitions (entry and exit animations for this clip)
  clipTransitionIn?: 'none' | 'fade' | 'zoom_in' | 'zoom_out' | 'slide_left' | 'slide_right' | 'slide_up' | 'slide_down' | 'dissolve' | 'wipe';
  clipTransitionOut?: 'none' | 'fade' | 'zoom_in' | 'zoom_out' | 'slide_left' | 'slide_right' | 'slide_up' | 'slide_down' | 'dissolve' | 'wipe';
  clipTransitionInDuration?: number;  // ms, default 400
  clipTransitionOutDuration?: number; // ms, default 400
  // Keyframe animation tracks
  animTracks?: import('../lib/keyframes').ClipAnimTrack[];
}

export interface TextOverlay {
  id: string;
  projectId: string;
  content: string;
  positionX: number;  // 0-1
  positionY: number;  // 0-1
  startTime: number;  // ms
  duration: number;   // ms
  fontSize: number;
  color: string;
  fontFamily: string;
  shadow: boolean;
  outline: boolean;
  outlineColor: string;
  backgroundColor?: string;
  animation: TextAnimation;        // combined animation (legacy)
  animationIn?: TextAnimation;     // entry animation (takes priority over animation)
  animationOut?: TextAnimation;    // exit animation
  animationInDuration?: number;    // ms, default 400
  animationOutDuration?: number;   // ms, default 400
}

/** Sticker / image overlay on top of the video */
export interface StickerOverlay {
  id: string;
  projectId: string;
  uri: string;        // local image URI
  positionX: number;  // 0-1 fraction of preview width
  positionY: number;  // 0-1 fraction of preview height
  scale: number;      // 1 = 100%
  rotation: number;   // degrees
  opacity: number;    // 0-1
  startTime: number;  // ms
  duration: number;   // ms — 0 means whole project
  flipH: boolean;
  flipV: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  sharpness: number;
  filter: string | null;
  filterIntensity: number;
}

export interface HistoryEntry {
  id: string;
  projectId: string;
  action: string;
  snapshot: string; // JSON of clips at that point
  createdAt: number;
}

export interface DB {
  projects: Project[];
  clips: Clip[];
  textOverlays: TextOverlay[];
  stickerOverlays: StickerOverlay[];
  history: HistoryEntry[];
  folders: Folder[];
  filterPresets: FilterPreset[];
}

const DEFAULT_DB: DB = {
  projects: [], clips: [], textOverlays: [], stickerOverlays: [],
  history: [], folders: [], filterPresets: [],
};


let dbLock = Promise.resolve();
async function runWithLock<T>(fn: () => Promise<T>): Promise<T> {
  const currentLock = dbLock;
  let release: () => void = () => {};
  dbLock = new Promise<void>(resolve => { release = resolve; });
  try {
    await currentLock;
    return await fn();
  } finally {
    release();
  }
}

async function readDB(): Promise<DB> {
  try {
    const info = await FileSystem.getInfoAsync(DB_FILE);
    if (!info.exists) return { ...DEFAULT_DB };
    let raw: string;
    try {
      raw = await (FileSystem as any).readAsStringAsync(DB_FILE);
    } catch {
      try {
        const response = await fetch(DB_FILE);
        raw = await response.text();
      } catch {
        return { ...DEFAULT_DB };
      }
    }
    const parsed = JSON.parse(raw) as DB;
    return {
      projects: parsed.projects || [],
      clips: parsed.clips || [],
      textOverlays: parsed.textOverlays || [],
      stickerOverlays: parsed.stickerOverlays || [],
      history: parsed.history || [],
      folders: parsed.folders || [],
      filterPresets: parsed.filterPresets || [],
    };
  } catch {
    return { ...DEFAULT_DB };
  }
}

async function writeDB(db: DB): Promise<void> {
  try {
    await (FileSystem as any).writeAsStringAsync(DB_FILE, JSON.stringify(db));
  } catch (err) {
    console.error('[database] writeDB failed, retrying once:', err);
    try {
      await (FileSystem as any).writeAsStringAsync(DB_FILE, JSON.stringify(db));
      console.error('[database] writeDB retry also failed:', retryErr);
      throw retryErr;
    }
  }
}

export const DEFAULT_KEN_BURNS: KenBurnsConfig = {
  enabled: false,
  startX: 0.5, startY: 0.5, startZoom: 1,
  endX: 0.5, endY: 0.5, endZoom: 1.2,
};

export function makeClipDefaults(partial: Partial<Clip> & Pick<Clip, 'id' | 'projectId' | 'uri' | 'type' | 'name' | 'duration'>): Clip {
  return {
    startTime: 0,
    trimStart: 0,
    trimEnd: 0,
    trackIndex: 0,
    orderIndex: 0,
    volume: 1,
    speed: 1,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    sharpness: 0,
    filter: null,
    filterIntensity: 100,
    // Advanced color grading defaults
    exposure: 0,
    vibrance: 0,
    clarity: 0,
    dehaze: 0,
    blacks: 0,
    whites: 0,
    fade: 0,
    grain: 0,
    hslHue: [0, 0, 0, 0, 0, 0],
    hslSat: [0, 0, 0, 0, 0, 0],
    hslLum: [0, 0, 0, 0, 0, 0],
    maskType: 'none',
    animTracks: [],
    motionBlur: false,
    kenBurns: { ...DEFAULT_KEN_BURNS },
    volumeKeyframes: [],
    cropX: 0,
    cropY: 0,
    cropW: 1,
    cropH: 1,
    positionX: 0,
    positionY: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    transitionType: 'none',
    transitionDuration: 500,
    lutUri: null,
    lutName: null,
    speedRampCurve: 'constant',
    flipH: false,
    flipV: false,
    opacity: 1,
    chromaKeyEnabled: false,
    chromaKeyColor: '#00FF00',
    chromaKeyThreshold: 30,
    stabilize: false,
    denoise: false,
    reverse: false,
    fadeIn: 0,
    fadeOut: 0,
    enhance: false,
    parallaxEnabled: false,
    parallaxPreset: 'dolly_in',
    parallaxSpeed: 1.0,
    backgroundRemovalEnabled: false,
    clipTransitionIn: 'none',
    clipTransitionOut: 'none',
    clipTransitionInDuration: 400,
    clipTransitionOutDuration: 400,
    ...partial,
  };
}

// Unique project name helper
export async function getUniqueProjectName(baseName: string): Promise<string> {
  const db = await readDB();
  const existingNames = new Set(db.projects.map(p => p.name));
  if (!existingNames.has(baseName)) return baseName;
  let i = 2;
  while (existingNames.has(`${baseName} (${i})`)) i++;
  return `${baseName} (${i})`;
}

// ── Projects CRUD ──

export async function getProjects(): Promise<Project[]> {
  const db = await readDB();
  return db.projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await readDB();
  const proj = db.projects.find(p => p.id === id) || null;
  if (proj) {
    try {
      // Compute total duration from clips so the field is always accurate
      const projClips = db.clips.filter(c => c.projectId === id);
      const totalDuration = projClips.reduce((max, c) => {
        const dur = (c.duration ?? 0) - (c.trimStart ?? 0) - (c.trimEnd ?? 0);
        const eff = dur / Math.max(0.01, c.speed ?? 1);
        const end = (c.startTime ?? 0) + eff;
        return isFinite(end) ? Math.max(max, end) : max;
      }, 0);
      if (isFinite(totalDuration) && totalDuration >= 0) {
        proj.duration = Math.round(totalDuration);
      }
    } catch {} // non-fatal — keep stored duration if computation fails
  }
  return proj;
}

export async function createProject(project: Project): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.projects.push(project);
    await writeDB(db);
});
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    const idx = db.projects.findIndex(p => p.id === id);
    if (idx !== -1) {
      db.projects[idx] = { ...db.projects[idx], ...updates, updatedAt: Date.now() };
      await writeDB(db);
    }
});
}

export async function deleteProject(id: string): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.projects = db.projects.filter(p => p.id !== id);
    db.clips = db.clips.filter(c => c.projectId !== id);
    db.textOverlays = db.textOverlays.filter(t => t.projectId !== id);
    db.stickerOverlays = (db.stickerOverlays || []).filter(s => s.projectId !== id);
    db.history = db.history.filter(h => h.projectId !== id);
    await writeDB(db);
});
}

export async function duplicateProject(id: string): Promise<Project | null> {
  return runWithLock(async () => {
    const db = await readDB();
    const src = db.projects.find(p => p.id === id);
    if (!src) return null;
    const newId = `proj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const existingNames = new Set(db.projects.map(p => p.name));
    let newName = `${src.name} (copy)`;
    let i = 2;
    while (existingNames.has(newName)) { newName = `${src.name} (copy ${i})`; i++; }
    const newProject: Project = { ...src, id: newId, name: newName, createdAt: Date.now(), updatedAt: Date.now() };
    db.projects.push(newProject);
    // Duplicate clips
    const srcClips = db.clips.filter(c => c.projectId === id);
    for (const clip of srcClips) {
      db.clips.push({ ...clip, id: `${clip.id}_dup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, projectId: newId });
    }
    // Duplicate text overlays
    const srcStickers = (db.stickerOverlays || []).filter(s => s.projectId === id);
    srcStickers.forEach(s => {
      if (!db.stickerOverlays) db.stickerOverlays = [];
      db.stickerOverlays.push({ ...s, id: `${s.id}_dup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, projectId: newId });
    });
    const srcTexts = db.textOverlays.filter(t => t.projectId === id);
    for (const t of srcTexts) {
      db.textOverlays.push({ ...t, id: `${t.id}_dup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, projectId: newId });
    }
    await writeDB(db);
    return newProject;
});
}

// ── Clips CRUD ──

export async function getClips(projectId: string): Promise<Clip[]> {
  const db = await readDB();
  return db.clips
    .filter(c => c.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function createClip(clip: Clip): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.clips.push(clip);
    await writeDB(db);
});
}

export async function updateClip(id: string, updates: Partial<Clip>): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    const idx = db.clips.findIndex(c => c.id === id);
    if (idx !== -1) {
      db.clips[idx] = { ...db.clips[idx], ...updates };
      await writeDB(db);
    }
});
}

export async function updateClips(clips: Clip[]): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    for (const clip of clips) {
      const idx = db.clips.findIndex(c => c.id === clip.id);
      if (idx !== -1) db.clips[idx] = clip;
      else db.clips.push(clip);
    }
    await writeDB(db);
});
}

export async function deleteClip(id: string): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.clips = db.clips.filter(c => c.id !== id);
    await writeDB(db);
});
}

// ── Text Overlays CRUD ──

export async function getTextOverlays(projectId: string): Promise<TextOverlay[]> {
  const db = await readDB();
  return db.textOverlays.filter(t => t.projectId === projectId);
}

export async function createTextOverlay(overlay: TextOverlay): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.textOverlays.push(overlay);
    await writeDB(db);
});
}

export async function updateTextOverlay(id: string, updates: Partial<TextOverlay>): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    const idx = db.textOverlays.findIndex(t => t.id === id);
    if (idx !== -1) {
      db.textOverlays[idx] = { ...db.textOverlays[idx], ...updates };
      await writeDB(db);
    }
});
}

export async function deleteTextOverlay(id: string): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.textOverlays = db.textOverlays.filter(t => t.id !== id);
    await writeDB(db);
});
}

// ── Sticker Overlays CRUD ──

export async function getStickerOverlays(projectId: string): Promise<StickerOverlay[]> {
  const db = await readDB();
  return (db.stickerOverlays || []).filter(s => s.projectId === projectId);
}

export async function createStickerOverlay(sticker: StickerOverlay): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    if (!db.stickerOverlays) db.stickerOverlays = [];
    db.stickerOverlays.push(sticker);
    await writeDB(db);
});
}

export async function updateStickerOverlay(id: string, updates: Partial<StickerOverlay>): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    if (!db.stickerOverlays) db.stickerOverlays = [];
    const idx = db.stickerOverlays.findIndex(s => s.id === id);
    if (idx !== -1) {
      db.stickerOverlays[idx] = { ...db.stickerOverlays[idx], ...updates };
      await writeDB(db);
    }
});
}

export async function deleteStickerOverlay(id: string): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    if (!db.stickerOverlays) return;
    db.stickerOverlays = db.stickerOverlays.filter(s => s.id !== id);
    await writeDB(db);
});
}

// ── History ──

export async function saveHistory(entry: HistoryEntry): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.history.push(entry);
    const projectHistory = db.history.filter(h => h.projectId === entry.projectId);
    if (projectHistory.length > 50) {
      const toRemove = projectHistory.slice(0, projectHistory.length - 50).map(h => h.id);
      db.history = db.history.filter(h => !toRemove.includes(h.id));
    }
    await writeDB(db);
});
}

export async function getHistory(projectId: string): Promise<HistoryEntry[]> {
  const db = await readDB();
  return db.history
    .filter(h => h.projectId === projectId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function clearHistory(projectId: string): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.history = db.history.filter(h => h.projectId !== projectId);
    await writeDB(db);
});
}

// ── Folders CRUD ──

export async function getFolders(): Promise<Folder[]> {
  const db = await readDB();
  return db.folders.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFolder(folder: Folder): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.folders.push(folder);
    await writeDB(db);
});
}

export async function deleteFolder(id: string): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.folders = db.folders.filter(f => f.id !== id);
    // Unassign projects from deleted folder
    db.projects = db.projects.map(p => p.folderId === id ? { ...p, folderId: undefined } : p);
    await writeDB(db);
});
}

export async function moveProjectToFolder(projectId: string, folderId: string | undefined): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    const idx = db.projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      db.projects[idx] = { ...db.projects[idx], folderId, updatedAt: Date.now() };
      await writeDB(db);
    }
});
}

// ── Filter Presets CRUD ──

export async function getFilterPresets(): Promise<FilterPreset[]> {
  const db = await readDB();
  return db.filterPresets;
}

export async function saveFilterPreset(preset: FilterPreset): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.filterPresets.push(preset);
    await writeDB(db);
});
}

export async function deleteFilterPreset(id: string): Promise<void> {
  return runWithLock(async () => {
    const db = await readDB();
    db.filterPresets = db.filterPresets.filter(p => p.id !== id);
    await writeDB(db);
});
}

// Additional types used by ffmpeg.ts
export interface AudioTrack {
  id: string;
  projectId: string;
  sourceUri: string;
  startTime: number;
  duration: number;
  trimStart: number;
  volume: number;
  isMuted: boolean;
}
