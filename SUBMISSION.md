# FrameStudio — Submission

## What's the idea (Uniqueness)

FrameStudio is the **first truly complete professional video editor built natively for Android in React Native** — not a web wrapper, not a simple trimmer, but a full desktop-class editing pipeline on mobile.

What makes it genuinely unique:

1. **GPU-powered color grading on mobile** — uses Android's `MediaCodec` + `Canvas/ColorMatrix` pipeline and GLSL shaders (via expo-gl) to bake actual color edits (brightness, contrast, saturation, temperature, tint, highlights, shadows) into exported video frames. No other free Android editor does this without a server.

2. **3D Parallax Camera effect** — imports a still photo, assigns depth layers, and animates a virtual camera path (Dolly In, Pan, Orbit, Push Forward, Drift). Each layer moves at a different parallax rate. Renders in real-time and exports as video. Equivalent to After Effects' camera + null object system.

3. **Beat Sync** — tap-to-detect BPM, then one-tap snaps all clips to the beat grid. Built for creators making music videos and reels — no other mobile editor has this.

4. **Full effects pipeline without FFmpeg** — custom native Kotlin module (`VideoProcessorModule`) using `MediaExtractor` + `MediaMuxer` + `MediaCodec` + `Canvas` applies trim, speed, color grade, and overlays natively. Zero external Maven dependencies. Runs on any Android 8+ device.

---

## What problem is it solving

Mobile creators need professional editing tools but existing free apps have critical gaps:
- **CapCut** — good UI but locked features behind subscription, heavy watermarks, no color grading
- **VN / InShot** — basic trim/speed, no proper color grade, no GPU processing
- **DaVinci Resolve Mobile** — iOS only, no Android export
- **Adobe Premiere Rush** — subscription, requires Adobe account, limited offline

**FrameStudio is free forever, no watermarks, no account, no subscription, works offline, exports to gallery.** It fills the gap between toy apps and expensive desktop software — a proper editor you can carry in your pocket.

---

## User Experience & Design

- **Dark-first UI** with full OLED optimization (pure blacks)
- **3-track timeline** — V1 (primary), V2 (overlay), A1 (audio) with magnetic snap
- **Photo editing mode** — dedicated GPU-powered editor with real-time shader preview, separate from the video timeline
- **Non-destructive editing** — 50-level undo with correct pre-drag state capture
- **Auto-save** with visual badge indicator
- **Beat Sync, 14 transitions, 24 filters, 16 fonts, 14 text animations** — all accessible without scrolling through menus

---

## Execution & Features

| Feature | Status |
|---------|--------|
| Multi-track timeline (trim, cut, split, reorder) | ✅ Complete |
| Video export with color grade baked in | ✅ Native MediaCodec pipeline |
| Photo export with GPU shaders | ✅ GLSL + expo-gl |
| 24 filter presets + manual color grading | ✅ Complete |
| 14 transition types with smoothstep easing | ✅ Complete |
| 3D Parallax Camera (Dolly, Pan, Orbit, Drift) | ✅ Complete |
| Text overlays — 16 fonts, 14 animations | ✅ Complete |
| Sticker overlays — pinch/rotate | ✅ Complete |
| Voice recording in editor | ✅ Complete |
| Beat sync (tap BPM → snap clips) | ✅ Complete |
| Audio mixer (volume, mute, solo, keyframes) | ✅ Complete |
| Audio export → device Files | ✅ Complete |
| Video export → gallery | ✅ Complete |
| Ken Burns effect (pan/zoom on images) | ✅ Complete |
| Speed ramp 0.1×–4× | ✅ Complete |
| Chroma key (green screen) | ✅ Complete |
| Subtitle import (.srt/.vtt) | ✅ Complete |
| Quality enhancer (unsharp + denoise) | ✅ Complete |
| Dark/light/system theme | ✅ Complete |
| Project folders, search, sort | ✅ Complete |

---

## Download

APK: `https://yoursite.vercel.app/download/FrameStudio-v1.0.apk`  
Website: `https://yoursite.vercel.app`  
Built by: [@kroszborgg](https://x.com/kroszborgg) | [Portfolio](https://www.kroszborg.co/)
