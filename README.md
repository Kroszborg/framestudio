# FrameStudio

> Professional video, photo & audio editor for Android — free, no watermarks, no ads.

FrameStudio is a full-featured mobile video editor built with React Native + Expo. It ships with a multi-track timeline, 12+ filters, text/sticker overlays, Ken Burns effects, an audio mixer, transitions, and 4K export.

---

## Packages

| Package | Description |
|---------|-------------|
| `packages/mobile` | React Native / Expo app — the video editor |
| `packages/web` | Landing website + APK download page (Vite + React + Hono) |
| `packages/desktop` | Electron shell (loads web app) |

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| [Bun](https://bun.sh) | 1.2+ |
| [Node.js](https://nodejs.org) | 18+ |
| [Java JDK](https://adoptium.net) | 17 |
| [Android Studio](https://developer.android.com/studio) | Latest (for Android SDK) |

### Install all dependencies

```bash
bun install
```

### Run the website locally

```bash
bun dev           # from project root — starts Vite on localhost:3000
```

### Run the mobile app (Expo)

```bash
bun dev:mobile    # starts Expo dev server
# Then press A for Android emulator or scan QR with Expo Go
```

---

## Building the Android APK

### 1. Install deps (if not done)

```bash
bun install
```

### 2. Clean + build release APK

```bash
# Quick build (clears metro cache only)
npm run build:release

# Full clean build (clears all caches + android build)
npm run build:release:clean
```

The APK lands at:

```
packages/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### 3. Deploy APK to the website

```bash
cp packages/mobile/android/app/build/outputs/apk/release/app-release.apk \
   packages/web/public/download/FrameStudio-v1.0.apk
```

Then rebuild and deploy the website:

```bash
cd packages/web && bun run build
```

---

## Project Structure

```
framestudio/
├── packages/
│   ├── mobile/                    React Native video editor
│   │   ├── app/                   Expo Router screens
│   │   │   ├── (tabs)/            Home + Settings tabs
│   │   │   ├── editor/            Editor screens (main, text, filters,
│   │   │   │                      audio, crop, sticker, export)
│   │   │   └── new-project.tsx    Create project modal
│   │   ├── components/
│   │   │   ├── editor/            Timeline, VideoPreview, InspectorPanel,
│   │   │   │                      Toolbar, AudioMixerSheet, ...
│   │   │   └── common/            Button, Slider, IconButton, BottomSheet
│   │   ├── lib/
│   │   │   ├── projectStore.ts    Zustand state (clips, overlays, undo/redo)
│   │   │   ├── database.ts        JSON file persistence + all data interfaces
│   │   │   ├── exportEngine.ts    Export pipeline (photo: real; video: FFmpeg)
│   │   │   ├── ffmpegRunner.ts    ffmpeg-kit-react-native wrapper
│   │   │   ├── ffmpeg.ts          FFmpeg command builder
│   │   │   ├── imageProcessor.ts  expo-image-manipulator processing
│   │   │   ├── audioWaveform.ts   Waveform extraction for timeline
│   │   │   └── theme.ts           Dark/light palettes + useThemeColors hook
│   │   ├── assets/                Icons, splash screen (PNG + SVG sources)
│   │   ├── scripts/
│   │   │   └── generate-assets.js Regenerate PNG icons from SVG sources
│   │   ├── android/               Android native project
│   │   ├── app.json               Expo config (name, package ID, permissions)
│   │   └── task.md                Feature checklist
│   │
│   ├── web/                       Landing page + download site
│   │   ├── src/web/pages/index.tsx Full landing page with APK download
│   │   ├── src/api/               Hono API routes
│   │   ├── public/download/       Place APK here: FrameStudio-v1.0.apk
│   │   └── dist/                  Production build output
│   │
│   └── desktop/                   Electron wrapper (loads web app)
│
├── bun.lock                        Lockfile — always commit this
├── package.json                    Bun workspace root
├── turbo.json                      Turborepo task config
└── .env                            Secrets (gitignored) — copy from .env.template
```

---

## Feature Status

| Feature | Status |
|---------|--------|
| Multi-track timeline (trim, cut, split, reorder) | ✅ |
| Drag-to-reposition with magnetic snap | ✅ |
| 12+ filter presets + full color grading | ✅ |
| LUT import (.cube files) | ✅ |
| Text overlays — 8 fonts, 8 animations | ✅ |
| Sticker/image overlays — pinch/rotate | ✅ |
| Ken Burns (pan/zoom on images) | ✅ |
| 7 transitions with smoothstep easing | ✅ |
| Speed ramp 0.1×–4× with curves | ✅ |
| Audio import + mixer (mute/solo/volume) | ✅ |
| Volume keyframe automation | ✅ |
| Chroma key (green screen) | ✅ |
| Crop tool with aspect ratio presets | ✅ |
| Motion blur, stabilize, denoise toggles | ✅ |
| Undo/Redo — 50 frames, pre-drag capture | ✅ |
| Auto-save with debounce | ✅ |
| Dark / Light / System theme | ✅ |
| Photo export — real processing | ✅ |
| Video export — FFmpeg transcoding | ✅ (with `ffmpeg-kit-react-native`) |
| Subtitle import (.srt / .vtt) | ✅ |
| Project folders + duplication | ✅ |
| Beat sync (tap BPM → snap clips to beat grid) | ✅ |
| Voice recording in editor | ✅ |

---

## State Management

All editor state lives in **Zustand** (`lib/projectStore.ts`).

### Slider pattern — always use optimistic + commit

```ts
// ✅ Correct — one undo frame per gesture, no per-frame DB writes
onValueChange={v => updateClipOptimistic(id, { brightness: v })}
onSlidingComplete={() => commitClipUpdate(id, 'brightness')}

// ❌ Wrong — creates hundreds of undo frames while dragging
onValueChange={v => updateClip(id, { brightness: v })}
```

`updateClipOptimistic` captures the **pre-drag** clip state on the first call.  
`commitClipUpdate` pushes that snapshot as the undo frame, then clears it.

---

## Adding FFmpeg (activates real video export)

```bash
cd packages/mobile
bun add ffmpeg-kit-react-native

# Then rebuild Android:
npm run clean:android
npm run build:release
```

Without FFmpeg, video clips are saved as source files with a metadata sidecar. Photo export always uses real processing via `expo-image-manipulator`.

---

## Regenerating App Icons

Edit the SVG sources in `packages/mobile/assets/`:
- `icon.svg` → app icon (1024×1024)
- `splash-icon.svg` → splash screen (1284×2778)

Then convert to PNG:

```bash
cd packages/mobile
bun add -d sharp
node scripts/generate-assets.js
```

---

## Environment Variables

Copy `.env.template` to `.env` and fill in values. Only `VITE_`-prefixed variables are exposed to the browser. API server code uses `process.env.*` directly.

```bash
cp .env.template .env
```

---

## Build Scripts Reference

| Command | Description |
|---------|-------------|
| `bun install` | Install all workspace deps |
| `bun dev` | Start website dev server |
| `bun dev:mobile` | Start Expo dev server |
| `npm run clean:metro` | Clear Metro bundler cache |
| `npm run clean:android` | Clean Android build artifacts |
| `npm run build:release` | Build release APK |
| `npm run build:release:clean` | Full clean + release APK |
| `npm run build:aab` | Build AAB for Play Store |
| `cd packages/web && bun run build` | Build website |

---

## Tech Stack

**Mobile**
- React Native 0.81.5 + Expo SDK 54
- TypeScript, Expo Router (file-based navigation)
- Zustand (state), expo-video (playback), expo-image-manipulator (photo processing)
- ffmpeg-kit-react-native (video transcoding)
- @react-native-community/slider, react-native-gesture-handler, react-native-reanimated

**Website**
- Vite 7 + React 19 + Tailwind CSS v4
- Hono (API), Drizzle ORM (database), Wouter (routing)

**Desktop**
- Electron (loads web app)

---

## License

MIT — free to use, modify, and distribute.
