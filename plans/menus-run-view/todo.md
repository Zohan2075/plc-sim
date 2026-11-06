---
type: planning
entity: todo
plan: "menus-run-view"
updated: "2026-11-05"
---

# Todo: Menus, persistent Run, Adobe-style view controls

## Status: Completed

### Completed

- [x] Audit ribbon/context menus, keyboard, touch, narrow layout
- [x] Phase 1: menu icons, multi-select actions, keyboard/focus, touch targets, Ctrl+K command palette, title-bar Run cluster, F5/Shift+F5
- [x] Phase 2: imperative view transform, wheel pan/zoom, Shift/Ctrl/pinch, deltaMode, Space/middle pan, scrollbars, fit/zoom menu, 10-800%, grid LOD, persisted wheel setting
- [x] Phase 3: browser matrices, drop/hit/wire/label checks, render-count and 30-wire cost, hashes, suite/tsc/build

### Verification

- UI 32 spec files / 1117 tests; plc-engine 7 tests.
- tsc 25 baseline; full `pnpm -r build` OK.
- Glyph blocks and anchors identical to HEAD; selector art/wireRoute/wireTopology/grid unchanged.
- Anchor max error 0.00047 model units (5 points at 10%, 30.5%, 100%, 244%, 800%).
- Menu open leaves diagram render count unchanged; 80 ms close transition.
- Multi-select duplicate adds both selected components; labels show counts.
- Run cluster rects identical stopped/running; F5/Shift+F5 work; visible in every tab and collapsed.
- Drop error 0; wire anchor errors <0.00004; label gap 8 model units.
