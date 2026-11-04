---
type: planning
entity: implementation-plan
plan: "ribbon-breakers-hitboxes-selector"
phase: 4
status: completed
created: "2026-11-04"
updated: "2026-11-04"
---

# Phase 4 Implementation Plan: Word-style ribbon shell

> Part of [Ribbon, breakers, hitboxes/labels, selector zones](../plan.md)
> Phase scope: [Phase 4](../phases/phase-4.md)

## Goal

Remove the permanent left/right panels. Add a top menu bar + Word-style ribbon above the component list, keep the component list and all controls, let the canvas fill the remaining space, add contextual Component/Wire tabs, collapse-to-tabs, narrow-width group dropdowns, and resize-aware canvas coordinates.

## Audit Ground Truth

Mounted UI only: `App.tsx -> DiagramBuilder`. No export/share, grid visibility toggle, snap toggle, fit-to-view, scan-interval editor, palette search, or Delete/Ctrl+V/Ctrl+S shortcuts exist. Do not invent them.

Current shell:

- `.builder-freeplay` three-column grid (`App.css:1077-1082`): left sidebar, stage, right rail.
- `.builder-sidebar { display: contents }` (`1084-1086`).
- `.builder-card--tools` (`DiagramBuilder.tsx:7956-8137`), `.builder-card--sheet` (`8139-8186`), `.builder-right-rail` (`8188-8499`) with state panel (`5981-6079`) and properties (`8191-8498`).
- Component palette `componentPalettePanel` (`5945-5980`), mounted in `.builder-stage__top-row` (`8503-8505`).
- Canvas scroll height is `clamp(480px, calc(100vh - 18rem), 860px)` (`App.css:1783-1799`).
- Header stats (`7947-7951`).
- Global shortcuts (`5024-5083`): Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y, Ctrl/Cmd+C, R, Shift+R, Escape; menu keys. No Delete/paste/save/open/new/select-all shortcuts.

## Control Mapping (nothing may be dropped)

### File tab

| Group | Control | Source | Action |
|---|---|---|---|
| Circuit | Load circuit | T13/T15 | hidden file input click |
| Circuit | Save circuit | T14 | `handleSaveCircuit` |
| Document | Project | S1 | `sheetMetadata.projectName` |
| Document | Date | S2 | `sheetMetadata.date` |
| Document | Scale | S3 | `sheetMetadata.scale` |
| Document | Page | S4 | `sheetMetadata.page` |

### Home tab

| Group | Control | Source | Action |
|---|---|---|---|
| History | Undo | K1/M13 | `undo`, shortcut Ctrl+Z |
| History | Redo | K2/K3/M14 | `redo`, shortcut Ctrl+Shift+Z |
| Clipboard | Copy | K4/M4 | `copySelectedComponents([...selectedComponentIds])`, Ctrl+C |
| Clipboard | Paste | M12 | new `pasteClipboardAtViewportCenter()` |
| Clipboard | Duplicate | M5 | `duplicateComponentWithHistory(primaryId)` |
| Edit | Delete | T11/M7/M8 | `handleDeleteSelection` |
| Edit | Rotate -90 | C10/M1/K6 | `rotateComponents(ids, "ccw")`, Shift+R |
| Edit | Rotate +90 | C11/M1/K5 | `rotateComponents(ids, "cw")`, R |
| Edit | Reset canvas | T12 | `handleResetCanvas` |
| Wiring | Wire mode | T3 | `toggleWireAuthoring`, active state |
| Wiring | Wire color | T4 | `updateWireColor` |
| Wiring | Thickness | T5 | `updateWireThickness` |
| Wiring | Finish wire | T9 | `handleFinishWire` |
| Wiring | Cancel wire | T10 | `clearWireInteraction` |

### Insert tab

| Group | Controls |
|---|---|
| Electrical | AC source, DC source, 1P breaker, 2P breaker, Single switch, NO push button, NC push button, E-stop, 3-pos selector, Limit switch NO, Limit switch NC, OL contact, Lamp, Motor |
| Logic | XIC, XIO, NOTC, NCTO, OTE |

Each button inserts via the same `createComponent(type)` + append + select + `setHasCustomLayout(true)` path as a palette click. The component list stays under the ribbon with the same drag-and-drop and click insertion.

### Simulation tab

| Group | Control | Source |
|---|---|---|
| Run | Run/Stop | R1, `onRunToggle`, disabled `runDisabled || fault` |
| Run | Reset fault | R2, conditional |
| Status | Running/Ready, scan ms, tick, connected/loose/live wires | ST2/ST7/ST6/ST8/ST9/ST10 (read-only) |

### View tab

| Group | Control | Source |
|---|---|---|
| Navigate | Pan mode | T2, `togglePanMode`, active state |
| Zoom | Zoom out | R3 |
| Zoom | 100% | R6 |
| Zoom | Zoom in | R5 |
| Canvas | Width | T6 |
| Canvas | Height | T7 |
| Canvas | Grid spacing | T8 |
| Debug | Terminal overlays | new state, default `?debugTerminals=1` |
| Debug | Hit/label overlays | new state, default `?debugHitboxes=1` |

### Contextual Component tab (only when a component is selected)

| Group | Controls |
|---|---|
| Properties | Symbol, label, terminals, rotation, delay (timed), current/voltage (source), state (breaker/switch), live V (running) |
| Edit | Label input, Rotate -90, Rotate +90 |
| Terminals | One label input per terminal |
| Parameters | On-delay (timed only), Source voltage (source only), Lamp glow (LAMP only), Open/Close switch (maintained only), Selector position 1/2/3 (SELECTOR_3POS only) |
| Arrange | Copy, Duplicate, Delete |

Hide inapplicable controls entirely; never render them disabled.

### Contextual Wire tab (only when a wire is selected)

| Group | Controls |
|---|---|
| Status | Connected/Loose/Invalid pill, solver chip, reconnect chip, points, color swatch, thickness, segments, bends, length |
| Appearance | Color input, thickness range |
| Geometry | Add bend, Reverse route, Simplify path |
| Endpoints | Start/End cards with Reconnect/Pick point and Disconnect |
| Edit | Delete |

### Status bar

- Simulator notice (`simulatorLabel: simulatorMessage`) and dynamic hint.
- Fault latched, Running/Ready, Wire on/off, Pan on/off, Move locked/ready, Tick, scan ms, connected/loose/live wires.
- Symbols/wires/runnable-rungs counts (H1-H3).
- Zoom %.
- Snapshot status (`circuitSnapshotStatus`).
- Selected component live voltage while running; selected wire status summary.

### Preserved elsewhere

- Context menu M1-M14 stays unchanged, with visible labels and lamp Color / selector Position submenus.
- Canvas gestures V1-V14 stay unchanged.
- Component list P1-P19 stays with the same drag/drop and click insertion.
- Sheet title-block rendering and all simulation behavior unchanged.

## Design

### 1. New presentational module `ui/src/Ribbon.tsx`

Export:

```ts
export type RibbonTabId = "file" | "home" | "insert" | "simulation" | "view" | "component" | "wire";

export interface RibbonTab { id: RibbonTabId; label: string; contextual?: boolean; }

export function RibbonTabBar(props: {
  activeTab: RibbonTabId;
  collapsed: boolean;
  onSelect: (tab: RibbonTabId) => void;
  onToggleCollapse: () => void;
  tabs: RibbonTab[];
}): JSX.Element;

export function RibbonBody(props: { collapsed: boolean; children: ReactNode }): JSX.Element;
export function RibbonGroup(props: { label: string; compact: boolean; children: ReactNode }): JSX.Element;
export function RibbonButton(props: {
  icon: ReactNode; label: string; shortcut?: string; active?: boolean;
  disabled?: boolean; onClick?: () => void; ariaPressed?: boolean;
}): JSX.Element;
export function RibbonField(props: { label: string; children: ReactNode }): JSX.Element;
export function useCompactRibbon(breakpoint?: number): boolean;
```

Behavior:

- Tabs render as buttons with `role="tab"`, `aria-selected`, horizontal overflow.
- Active tab double-click toggles `collapsed`; collapse button uses `aria-label="Collapse ribbon"` / `"Expand ribbon"`.
- Clicking a tab while collapsed selects it and expands.
- `RibbonGroup` in compact mode renders a `<details>` with the group label as `<summary>` and the controls in an absolute dropdown; wide mode renders label + inline body.
- `RibbonButton` renders icon + label, `title={label + (shortcut ? " (" + shortcut + ")" : "")}`, `aria-keyshortcuts` when a shortcut exists.
- `RibbonField` renders a labeled native input/select wrapper.
- `useCompactRibbon` uses `window.innerWidth < 1180` with a resize listener.

### 2. DiagramBuilder state

Add:

```ts
const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTabId>("home");
const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
const compactRibbon = useCompactRibbon();
const [showTerminalDebug, setShowTerminalDebug] = useState(() => queryFlag("debugTerminals"));
const [showHitboxDebug, setShowHitboxDebug] = useState(() => queryFlag("debugHitboxes") || queryFlag("debugTerminals"));
const [canvasLayoutVersion, setCanvasLayoutVersion] = useState(0);
```

- Remove the module/render-time `showTerminalDebug` constant; keep `queryFlag` helper.
- Keep the contextual tabs visible only when `selectedComponent` / `selectedWire`.
- If the active tab becomes unavailable, fall back to Home (effect).
- When a component/wire is selected, do not auto-switch; the contextual tab appears and is clickable (Word behavior).
- Add a `ResizeObserver` effect observing `canvasRef.current` and `stageScrollRef.current`, bumping `canvasLayoutVersion`. Put `data-layout-version={canvasLayoutVersion}` on the canvas so the state is used. The existing `getCanvasPointFromClient` keeps reading the live canvas rect, so drop/snap/wire coordinates follow layout changes.

### 3. Shell JSX

Replace the current header + sidebar/right-rail layout with:

```tsx
<section className="panel panel--builder builder-shell">
  <header className="builder-ribbon">
    <div className="builder-ribbon__titlebar">
      <div className="builder-ribbon__brand">PLC Sim <span>Graphic simulator</span></div>
      <div className="builder-ribbon__context">... selected component/wire label or sheet name ...</div>
    </div>
    <RibbonTabBar ... />
    <RibbonBody collapsed={ribbonCollapsed}>
      {activeRibbonTab === "file" ? fileRibbon : null}
      ...
    </RibbonBody>
  </header>

  <div className="builder-component-bar">{componentPalettePanel}</div>

  <div className="builder-freeplay">
    <div className="builder-stage">
      <div className="builder-stage__scroll">...existing canvas...</div>
    </div>
  </div>

  <footer className="builder-statusbar">...statuses...</footer>

  {hidden file input}
  {context menu / palette preview / toast}
</section>
```

- Remove `.builder-sidebar`, `.builder-right-rail`, `.builder-stage__top-row`, the old tools card, sheet card, state panel, and properties card from the render tree. Their controls move into the ribbon/status bar.
- Keep the canvas subtree exactly as-is (same handlers, same SVG layers, same context menu).
- Keep `componentPalettePanel` JSX; wrap it in `.builder-component-bar` and remove the redundant card shadow via CSS.
- The hidden file input can live at the end of the shell.
- Status bar uses the old state-panel status pills + header stats + snapshot status + hint.
- Context menu layer, palette drag preview portal, rotation toast remain at the end.

### 4. Tab content construction

Build the tab bodies before `return` using existing handlers/state:

- `fileRibbon`: two `RibbonGroup`s (Circuit, Document).
- `homeRibbon`: History, Clipboard, Edit, Wiring groups.
- `insertRibbon`: Electrical and Logic groups of `RibbonButton`s; `insertPaletteComponent(type)` helper.
- `simulationRibbon`: Run and Status groups.
- `viewRibbon`: Navigate, Zoom, Canvas, Debug groups.
- `componentRibbon`: reuse the current selected-component property/field JSX, wrapped in groups; conditionally render parameters; add selector position buttons.
- `wireRibbon`: reuse the current selected-wire JSX, wrapped in groups.
- `statusBar`: reuse the current status-pill JSX and hint.

Do not duplicate handlers or create parallel state; call the existing functions.

### 5. CSS

Replace the three-column layout:

```css
.dashboard--playground { width: 100%; max-width: none; }
.app-shell--playground { min-height: 100vh; display: flex; flex-direction: column; }
.dashboard--playground { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.panel--builder { display: flex; flex-direction: column; min-height: 0; padding: 0; }
.builder-shell { overflow: hidden; }
.builder-ribbon { flex: 0 0 auto; border-bottom: ...; background: ...; }
.builder-ribbon__titlebar { display: flex; justify-content: space-between; ... }
.builder-ribbon__tabs { display: flex; overflow-x: auto; ... }
.ribbon-tab { ... }
.ribbon-tab--active { ... }
.ribbon-body { display: flex; flex-wrap: wrap; gap: ...; padding: ...; overflow: visible; }
.ribbon-body[hidden] { display: none; }
.ribbon-group { display: flex; flex-direction: column; min-width: 0; padding: ...; border-right: ...; }
.ribbon-group__label { font-size: .68rem; text-transform: uppercase; ... }
.ribbon-group__body { display: flex; flex-wrap: wrap; gap: ...; align-items: flex-start; }
.ribbon-group--compact { position: relative; border-right: 0; }
.ribbon-group--compact > summary { ... cursor: pointer; }
.ribbon-group--compact > .ribbon-group__body { position: absolute; top: 100%; left: 0; z-index: 20; background: ...; box-shadow: ...; min-width: 220px; }
.ribbon-button { display: inline-flex; flex-direction: column; align-items: center; gap: .15rem; min-width: 54px; padding: .35rem .45rem; border: 1px solid transparent; border-radius: 10px; background: transparent; }
.ribbon-button:hover { background: ...; border-color: ...; }
.ribbon-button--active { ... }
.ribbon-button:disabled { opacity: .45; }
.ribbon-button__icon { font-size: 1.05rem; line-height: 1; }
.ribbon-button__label { font-size: .68rem; font-weight: 700; white-space: nowrap; }
.ribbon-field { display: grid; gap: .15rem; min-width: 110px; }
.ribbon-field__label { font-size: .65rem; ... }
.ribbon-field input, .ribbon-field select { ... compact ... }
.builder-component-bar { flex: 0 0 auto; padding: .5rem 1rem; border-bottom: ...; }
.builder-component-bar .builder-card--components { padding: 0; border: 0; box-shadow: none; background: transparent; border-radius: 0; }
.builder-component-bar .builder-card__title { font-size: .7rem; text-transform: uppercase; letter-spacing: .12em; color: var(--text-soft); }
.builder-freeplay { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0; }
.builder-stage { flex: 1; min-height: 0; display: flex; flex-direction: column; grid-column: auto; grid-row: auto; }
.builder-stage__scroll { flex: 1; min-height: 360px; height: auto; }
.builder-statusbar { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: .35rem .6rem; align-items: center; padding: .45rem 1rem; border-top: ...; font-size: .72rem; }
```

- Remove/override the old responsive grid rules for `.builder-card--tools`, `.builder-right-rail`, `.builder-stage` so they do not reintroduce columns.
- Keep the existing `.builder-palette-list--horizontal`, tiles, canvas, and context-menu styles.
- Ensure the ribbon body can grow/wrap and never clips; compact groups use absolute dropdowns above the component bar.
- Keep the canvas model size and zoom behavior unchanged.

### 6. Contextual Component details

- Reuse the current property grid but render only applicable rows.
- Add a `Selector position` group with three buttons (1, 2 OFF, 3) that call `applySelectorPosition([selectedComponent.id], n)`; active state from `selectorPosition ?? 2`.
- Add Copy/Duplicate/Delete actions.
- Keep terminal label inputs in a compact grid; use a `<details>` inside the group if the terminal count is > 2 to keep the ribbon height bounded. All inputs remain reachable.
- Label input keeps the same `handlePlaneLabelChange`/`handlePlaneLabelBlur` calls.
- Rotate buttons call `rotateComponents([selectedComponent.id], "ccw"/"cw")` or the existing `rotateComponent`; keep the running lock.
- Switch operate button only for maintained switches.
- Breaker state read-only `Fixed closed`; no operate control.
- Momentary buttons/ESTOP keep their direct press target; the contextual tab can show a read-only hint.

### 7. Contextual Wire details

- Reuse the existing wire status/readouts.
- Color input calls `updateWireColorById(selectedWire.id, value)`.
- Thickness range calls `updateWireThicknessById(selectedWire.id, value)`.
- Add bend/reverse/simplify and endpoint reconnect/disconnect keep the existing handlers and running locks.
- Delete calls `handleDeleteSelection`.

### 8. Debug toggles

- Terminal overlays: replaces the old URL-only flag; default from `?debugTerminals=1`.
- Hit/label overlays: default from `?debugHitboxes=1` or `?debugTerminals=1`.
- Pass `showTerminalDebug` to the existing terminal debug nodes and `showHitboxDebug` to the hit overlay/debug bounds.
- Pass a `debugZones` prop to `renderSelector3Pos`/`renderSymbolGraphic` so the selector zone debug follows the View toggle instead of only the URL flag. Do not change selector art/ring data.
- Keep URL flags working as initial defaults.

## Tests / Verification

1. Unit tests
   - Add `ui/src/Ribbon.spec.tsx` for tab rendering/selection, collapse double-click/collapse button, compact group `<details>`, and button tooltips/shortcut text.
   - Add a pure mapping test that every audit control ID maps to a ribbon/status destination (a static list; no DOM).
2. Existing tests
   - Full suite green; tsc 25 baseline; build OK.
3. Browser probes (phase 5, but phase 4 must be probe-ready)
   - Canvas size before/after at 3 window sizes.
   - Palette drop lands under cursor error <1 model unit, before/after pan/zoom.
   - Collapsed ribbon and narrow width: every tab/control reachable, no clipping.
   - Context menu labels and submenus still render.

## Guardrails

- Do not change canvas model size, zoom, grid spacing semantics, snapping, wire routing, anchors, glyph art, or stored wire points.
- Do not remove the component list or its drag/drop.
- Do not add features that did not exist (export/share, scan editor, grid/snap toggles, fit, search, new shortcuts).
- Do not commit.

## Acceptance

- No permanent left/right panels.
- Ribbon above the component list; canvas fills the rest.
- All audit controls reachable; contextual Component/Wire tabs hide inapplicable controls.
- Collapse to tabs; narrow groups become dropdowns; no clipping.
- Context menu and shortcuts still work.
- Canvas conversion uses the live rect and a ResizeObserver; drop alignment <1 model unit at 3 sizes and after pan/zoom.
- Full suite, tsc 25 baseline, build OK.
