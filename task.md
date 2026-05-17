# FrameStudio Full Polish Task

## Safe Area Fixes
- [x] (tabs)/_layout.tsx — tab bar dynamic insets
- [x] editor/[id].tsx — portrait bottom + landscape notch + toast position (already done in file)
- [x] new-project.tsx — footer already uses insets.bottom
- [x] settings.tsx — SafeAreaView edges=['top','bottom'] already set; sheet paddingBottom needs insets
- [x] sign-in.tsx — already has bottom edge + closeBtn bg
- [x] sign-up.tsx — already has bottom edge + closeBtn bg
- [ ] filters.tsx — responsive grid width fix (item width calc wrong - uses fixed 72px swatch not item width)
- [ ] text.tsx — paddingBottom: 40 → insets.bottom + 40
- [x] Timeline.tsx — hitSlop already applied
- [ ] audio.tsx — ScrollView missing contentContainerStyle paddingBottom

## Features to Add
- [ ] splitClip + duplicateClip in projectStore + UI (toolbar cut tool wires to split)
- [ ] haptics — wire expo-haptics to key actions (add clip, delete, undo, select)
- [ ] thumbnail generation — generate thumbnail from first clip on editor save/load
- [ ] project search+sort on home screen
- [ ] empty timeline state — prompt to add media
- [ ] clip snapping — snap to adjacent clips and playhead on drag
- [ ] keyboard shortcuts (web) — Space=play, Cmd+Z=undo, Delete=delete, Cmd+D=duplicate
- [ ] undo/redo toast already works (undo shows toast)

## Progress
Starting now — batch all writes simultaneously
