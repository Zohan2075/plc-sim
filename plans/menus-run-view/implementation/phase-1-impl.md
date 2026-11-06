---
type: planning
entity: implementation-plan
plan: "menus-run-view"
phase: 1
status: ready
created: "2026-11-05"
updated: "2026-11-05"
---

# Phase 1: Menus, command search, persistent Run

## Goal

Fix the audited menu/ribbon issues, add Ctrl+K command search, and move Run/Stop into a stable title-bar cluster with F5/Shift+F5.

## Files

- `ui/src/Ribbon.tsx`, `ui/src/Ribbon.spec.tsx`
- `ui/src/diagram/contextMenu.tsx`, context-menu specs
- `ui/src/diagram/interaction.ts`, `ui/src/diagram/interaction.spec.ts`
- `ui/src/CommandPalette.tsx` (new), `ui/src/CommandPalette.spec.tsx` (new)
- `ui/src/DiagramBuilder.tsx`
- `ui/src/App.css`

## 1. Ribbon keyboard/touch/tooltips

- Add `onEscape?: () => void` to `RibbonTabBar`.
- Export `getNextRibbonTabIndex(currentIndex, count, direction: 1 | -1)` and `getRibbonTabEdgeIndex(count, edge: "first" | "last")` pure helpers.
- Tab buttons: roving `tabIndex` (active 0, others -1), `onKeyDown`:
  - ArrowRight/ArrowLeft -> focus/select next/prev tab with wrap.
  - Home/End -> first/last.
  - Escape -> `onEscape()`.
- `onEscape` passed from DiagramBuilder -> `canvasRef.current?.focus()`.
- `RibbonButton` keeps `title` with shortcut; add `aria-label` only if needed (visible label exists). Ensure every button has a title (already).
- CSS: `.ribbon-tab { min-height: 40px; }`; `@media (pointer: coarse) { .ribbon-tab, .ribbon-button { min-width:44px; min-height:44px; } }`.
- Context rows coarse min-height 44px; thickness buttons 44px.

## 2. Context menu

- Extend action/submenu `MenuItem` with `icon?: ReactNode`.
- Add icons to every action/submenu:
  - Rotate `↻`; cw `↻`; ccw `↺`; half `⟲`; angles `∠`; reset `↺`.
  - Position `⇅`; 1/2/3 items `↥`, `•`, `↧`.
  - Color `◐`; color options keep swatch.
  - Copy `⧉`; duplicate `⎘` or `＋`; rename `✎`; delete `🗑`.
  - Wire delete `🗑`; simplify `⌁`; canvas paste `📋`; undo `↶`; redo `↷`.
- `ContextMenuActionRow` and `ContextMenuSubmenuRow` render `item.icon` in the icon slot.
- Multi-select:
  - Add `deleteComponents(ids: string[])`, `duplicateComponents(ids: string[])` to `ContextMenuActions`.
  - `buildComponentMenu`: `count = selectedIds.length`; labels for multi: `Copy N components`, `Duplicate N components`, `Delete N components`, rotate submenu `Rotate N components`.
  - Use `actions.duplicateComponents(selectedIds)` and `actions.deleteComponents(selectedIds)`.
  - DiagramBuilder handlers: one undo snapshot, then duplicate/delete each id; select the duplicated set or clear after delete.
- Add Tab/Shift+Tab focus cycling in main and submenu panels (wrap within focusable items); Escape still closes.
- Add 80 ms closing state:
  - `const [closing, setClosing] = useState(false)`; `closeTimerRef`.
  - `close()` sets closing, waits 70-80 ms, then clears target/items/position and calls `onClose`.
  - `open()` clears the timer and closing state.
  - CSS `.context-menu--closing { opacity:0; transform:translateY(-3px); }`, `transition: opacity 80ms ease, transform 80ms ease`.
- Preserve focus return to canvas, viewport clamp, submenu left/right flip, and current context actions.

## 3. Command palette

- New `ui/src/CommandPalette.tsx`:
  - `CommandPaletteCommand { id; label; icon: ReactNode; shortcut?: string; keywords?: string; disabled?: boolean; run: () => void }`.
  - Props `{ open, commands, onClose }`.
  - Portal overlay + dialog; input placeholder `Search commands…`; list rows icon + label + shortcut right-aligned.
  - Filter by label/keywords/shortcut; ArrowUp/Down/Home/End; Enter runs selected non-disabled and closes; Escape closes; Tab trapped between input/list; click outside closes.
  - Reset query/active on open; autofocus input; `role="dialog" aria-modal`.
- CSS: fixed backdrop, centered dialog (max-width 640px, top 10vh), input, scrollable list, row min-height 40/44 coarse, active/hover states.
- DiagramBuilder:
  - `commandPaletteOpen` state.
  - Ctrl/Cmd+K global listener opens it (works even from inputs); close returns focus to canvas.
  - `commands` registry covering every existing action: File load/save; undo/redo; copy/paste/duplicate/delete; rotate ±90; reset canvas; rename selected component (switch to Component tab, focus label input via ref); wire mode toggle/finish/cancel; Insert all 19 palette symbols; run/stop/reset fault; pan mode; zoom out/100/in/fit/zoom-to-selection/wheel-zooms; terminal/hit overlays; component rotate angles, selector positions, lamp colors, switch open/close; wire delete/simplify/add bend/reverse route; thickness presets; canvas paste/undo/redo.
  - Commands are disabled when their action is unavailable (no selection, running, empty clipboard/draft, no fault).
  - Add `ref` to the Component tab label input.

## 4. Persistent Run cluster + shortcuts

- Title-bar cluster next to brand/context, outside `RibbonBody`:
  - Run/Stop button: icon `▶`/`■`, label `Run`/`Stop`, same `onRunToggle`; disabled `runDisabled || fault`.
  - Reset button: label `Reset`, same `onFaultReset`, disabled when no fault.
  - Status pill: `Stopped`/`Running` with color dot.
  - Fixed widths/min-widths so rects do not change between states.
- Keep the Simulation group `Run`/`Stop` and `Reset fault`; use the same handlers.
- Extend `resolveDiagramShortcut`:
  - `F5` -> run, `Shift+F5` -> stop.
  - `Ctrl/Cmd+0` -> fit, `Ctrl/Cmd+1` -> 100%, `Ctrl/Cmd++/=` -> zoom in, `Ctrl/Cmd+-` -> zoom out, `Ctrl/Cmd+K` -> command palette.
- Global handler handles run/stop/view/command shortcuts before the `running` early-return; `preventDefault` F5/Ctrl+0/1/K.
- Tooltips: cluster Run `Run simulator (F5)`, Stop `Stop simulator (Shift+F5)`; Simulation group mirrors.

## 5. Tests

- `Ribbon.spec.tsx`: tab roving/next/edge helpers; coarse class not testable in node, but static markup.
- `contextMenu.spec.ts`/render: every action/submenu has an icon; multi-select labels/actions; closing class; Tab cycling helper if extracted.
- `CommandPalette.spec.tsx`: filter, arrow selection, Enter run, Escape close, disabled no-op, shortcut display.
- `interaction.spec.ts`: F5/Shift+F5, Ctrl+0/1/plus/minus/K mappings.
- Full suite, tsc 25 baseline, build.

## Guardrails

- No glyph/ring/anchor/router/wire-point changes.
- No new editing features beyond command search, run cluster, and keyboard/menu fixes.
- Keep context menu M1-M14 behavior, labels, Position/Color submenus.
- No commit.
