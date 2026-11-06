---
type: planning
entity: implementation-plan
plan: "menus-run-view"
phase: 2
status: ready
created: "2026-11-05"
updated: "2026-11-05"
---

# Phase 2: Adobe-style canvas view transform

## Goal

Replace wheel-zoom/state-driven zoom with one imperative view transform: wheel pans by default, Shift pans horizontally, Ctrl/Cmd/pinch zooms at the cursor, Space/middle-drag pans, visible scrollbars, fit/100%/zoom menu, 10–800% range, grid LOD, persisted wheel preference, and no diagram re-render during zoom/pan.

## Current state (post phase 1)

- `canvasZoom` is React state; `canvasZoomRef` mirrors it; `updateCanvasZoom` calls `setCanvasZoom`.
- `canvasViewportStyle`/`canvasStyle` are React styles; viewport size = `plane * zoom`, canvas `transform: scale(zoom)`.
- Stage scrollbars are hidden (`scrollbar-width:none`); stage padding 12.
- Native wheel always zooms (`handleNativeStageWheel`), no pan/shift/space/middle behavior.
- Zoom range 50–200; linear 0.1 step; no fit/zoom selection; no zoom menu; no persisted wheel setting.
- `SheetLayer` minor lines always opacity 1.
- `getCanvasPointFromClient` is the single screen→model conversion and uses the live canvas rect + `canvasZoomRef.current`.

## New modules

### `ui/src/viewSettings.ts`

```ts
export interface ViewSettings { mouseWheelZooms: boolean }
export const DEFAULT_VIEW_SETTINGS: ViewSettings = { mouseWheelZooms: false };
export const VIEW_SETTINGS_STORAGE_KEY = "plc-sim.view-settings";
export function parseViewSettings(value: unknown): ViewSettings;
export function loadViewSettings(storage?: Pick<Storage, "getItem">): ViewSettings;
export function saveViewSettings(settings: ViewSettings, storage?: Pick<Storage, "setItem">): void;
```

- Invalid/missing data returns the default.
- localStorage is separate from the circuit snapshot; never written into `createCircuitSnapshot`.

### `ui/src/canvasView.ts`

```ts
export const MIN_VIEW_ZOOM = 0.1;
export const MAX_VIEW_ZOOM = 8;
export const VIEW_ZOOM_STEP = 1.25;
export const VIEW_MARGIN = 48;

export function clampViewZoom(value: number): number;
export function normalizeWheelAxis(delta: number, deltaMode: number): number;
export function resolveWheelIntent(event: {
  ctrlKey: boolean; metaKey: boolean; shiftKey: boolean;
  deltaX: number; deltaY: number; deltaMode: number;
}, mouseWheelZooms: boolean): { type: "zoom"; factor: number } | { type: "pan"; dx: number; dy: number } | null;
export function computeAnchoredScroll(input: {
  oldZoom: number; newZoom: number; scrollLeft: number; scrollTop: number;
  focusX: number; focusY: number; margin: number;
}): { scrollLeft: number; scrollTop: number };
export function computeGridMinorOpacity(spacingPx: number): number;
export function computeFitView(input: {
  contentWidth: number; contentHeight: number;
  viewportWidth: number; viewportHeight: number; margin: number;
}): { zoom: number; scrollLeft: number; scrollTop: number };
```

- `normalizeWheelAxis`: pixels = delta; lines = delta × 16; pages = delta × 120; cap each axis to ±240.
- Wheel intent:
  - `ctrlKey || metaKey` → zoom (pinch arrives as ctrlKey wheel).
  - else if `mouseWheelZooms` → zoom.
  - else pan:
    - Shift: horizontal delta = `deltaX !== 0 ? deltaX : deltaY`, vertical 0 (handles browsers that swap axes).
    - Otherwise: both deltaX and deltaY.
  - Return null if both axes and zoom delta are zero.
- Zoom factor: `Math.exp(-clamp(delta, -240, 240) * 0.0015)`.
- Anchored scroll: `focusModel = (scroll + focus - margin) / oldZoom`; `newScroll = focusModel * newZoom - focus + margin`. Clamp later by DOM.
- Grid LOD: `spacingPx < 3 → 0`, `< 7 → 0.35`, otherwise 1.
- Fit: available = viewport - 2*margin; zoom = clamp(min(available/content)); scroll 0.

### `ui/src/canvasZoomStore.ts`

```ts
export interface CanvasZoomStore {
  getSnapshot(): number;
  set(value: number): void;
  subscribe(listener: () => void): () => void;
}
export function createCanvasZoomStore(initial: number): CanvasZoomStore;
```

### `ui/src/CanvasZoomControls.tsx`

- `useCanvasZoom(store)` uses `useSyncExternalStore`.
- `CanvasZoomRibbonButtons({ store, onZoomOut, onActual, onZoomIn, onFit })` renders `RibbonButton`s for Zoom out, 100%, Zoom in, Fit; uses the store only for a readout `aria-live` percentage if needed.
- `CanvasZoomIndicator({ store, onFit, onActual, onPreset, onZoomSelection, hasSelection })`:
  - Button `aria-haspopup="menu"` showing `NN%`.
  - Menu: Fit, 100%, 50%, 200%, Zoom to selection (disabled when no selection).
  - Click outside/Escape closes; Arrow/Home/End/Enter keyboard; returns focus to the trigger.
  - The indicator re-renders via the store; DiagramBuilder does not.

## DiagramBuilder refactor

1. **State/refs**
   - Remove `const [canvasZoom, setCanvasZoom]`.
   - Add `const zoomStoreRef = useRef(createCanvasZoomStore(DEFAULT_CANVAS_ZOOM)); const zoomStore = zoomStoreRef.current;`
   - Add `const canvasViewportRef = useRef<HTMLDivElement>(null);`
   - Keep `canvasZoomRef` as the imperative current zoom; remove the effect that mirrors React state.
   - Add `const renderCountRef = useRef(0); renderCountRef.current += 1;` and `data-render-count={renderCountRef.current}` on the canvas for verification.
   - Add `const [mouseWheelZooms, setMouseWheelZooms] = useState(() => loadViewSettings().mouseWheelZooms);` and `mouseWheelZoomsRef` mirrored in an effect.
   - Add `spaceHeldRef`, `isSpacePanning` state (for cursor), pending wheel refs and `wheelFrameRef`.

2. **Initial styles**
   - `canvasViewportStyle`: `{ width: Math.ceil(planeSettings.width * canvasZoomRef.current + VIEW_MARGIN * 2), height: Math.ceil(planeSettings.height * canvasZoomRef.current + VIEW_MARGIN * 2) }`.
   - `canvasStyle`: `{ position: "absolute", left: VIEW_MARGIN, top: VIEW_MARGIN, width: planeSettings.width, height: planeSettings.height, transform: scale(currentZoom), transformOrigin: "top left" }`.
   - React re-renders reuse the current `canvasZoomRef` so styles stay correct.

3. **`applyView`**
   ```ts
   function applyView(next: { zoom?: number; scrollLeft?: number; scrollTop?: number }): void
   ```
   - Resolve/clamp zoom; set `canvasZoomRef.current`.
   - Set viewport width/height = `ceil(planeW*zoom + 2*M)`, `ceil(planeH*zoom + 2*M)`.
   - Set canvas `transform = scale(zoom)`; left/top = margin.
   - Clamp/set stage `scrollLeft/scrollTop`.
   - Set `canvas.style.setProperty("--grid-minor-opacity", String(computeGridMinorOpacity(gridSpacing*zoom)))`.
   - `zoomStore.set(zoom)`.
   - No React setState.

4. **Initial/plane effect**
   - `useLayoutEffect(() => { applyView({ zoom: canvasZoomRef.current, scrollLeft: stage?.scrollLeft ?? 0, scrollTop: ... }); }, [planeSettings.width, planeSettings.height, planeSettings.gridSpacing])`.
   - ResizeObserver on stage: after resize, call `applyView({ zoom: currentZoom })` to clamp scroll; bump `canvasLayoutVersion` as today.

5. **Zoom/anchor methods**
   - `updateCanvasZoom(nextZoom, focusClientPoint?)`: compute focus viewport coords from stage rect; use `computeAnchoredScroll`; `applyView({ zoom, scrollLeft, scrollTop })`. No state.
   - `fitCanvasToStage()`: use `computeFitView` with stage client size and plane size; apply.
   - `zoomToSelection()`: keep existing selection bounds logic; use `computeFitView` on the bounds + margin; center scroll.
   - `zoomByStep(direction)`: `canvasZoomRef.current * (direction > 0 ? VIEW_ZOOM_STEP : 1/VIEW_ZOOM_STEP)` about stage center.
   - `zoomToPreset(percent)`: exact `updateCanvasZoom(percent/100, stage center)`.
   - `Ctrl+1` uses exact 1; `Ctrl+plus/minus` use `zoomByStep`.

6. **Wheel**
   - Replace `handleNativeStageWheel` with `resolveWheelIntent`.
   - Always `event.preventDefault()` and `stopPropagation()` when the pointer is over the stage; the page must not scroll/zoom.
   - Zoom: schedule one rAF; accumulate `pendingZoomTarget` from `canvasZoomRef.current` (or the pending target) and last focus; flush via `updateCanvasZoom`.
   - Pan: schedule one rAF; accumulate `pendingPan`; flush by `stage.scrollLeft += dx; stage.scrollTop += dy` (native scrollbar extents clamp).
   - No React state.
   - Keep the palette wheel listener as-is (horizontal palette scroll).

7. **Space/middle pan**
   - Global keydown/keyup: Space (not in input/button/menu/command palette) sets `spaceHeldRef` + `isSpacePanning` state and prevents page scroll; keyup clears.
   - `handleStageScrollMouseDown` accepts left/space and middle button:
     - `wantsPan = isPanModeEnabled || spaceHeldRef.current || event.button === 1`.
     - For space/middle, allow over components and `stopPropagation` so component drag does not start.
     - For normal pan mode, keep the existing interactive-target exclusion.
     - Start `panState` with scroll offsets; `preventDefault`.
   - Pan move keeps writing `stage.scrollLeft/Top` directly; no state per move. Cursor classes: `--pan`, `--hand` (space), `--panning`.
   - On release/space-up, restore the previous tool/cursor (the persistent `isPanModeEnabled` state is unchanged).

8. **Scrollbars/margins**
   - `.builder-stage__scroll`: `padding: 0; scrollbar-width: thin; scrollbar-color: ...;` remove `scrollbar-width:none` and `::-webkit-scrollbar { display:none }`.
   - Add 12px webkit scrollbar/thumb via CSS.
   - `.freeplay-canvas-viewport`: `position: relative; min-width: 0; min-height: 0;` (remove grid alignment).
   - `.freeplay-canvas`: `position: absolute; transform-origin: top left;` inline width/height remain.
   - Scrollbar extents = `canvas*zoom + 2*VIEW_MARGIN`.

9. **Grid LOD**
   - CSS `.sheet-grid__line--minor { opacity: var(--grid-minor-opacity, 1); }`.
   - `applyView` sets the CSS variable via `computeGridMinorOpacity`. Major lines remain. No SheetLayer re-render.

10. **View controls**
    - Replace the View tab zoom buttons with `CanvasZoomRibbonButtons` (Zoom out, 100%, Zoom in, Fit).
    - Add `Wheel zooms` `RibbonButton` active state; toggle persists via `saveViewSettings`.
    - Replace the status-bar zoom pill with `CanvasZoomIndicator`.
    - Command palette: update zoom commands to `zoomByStep`/`zoomToPreset`/`fit`/selection; add `Wheel zooms`; remove `canvasZoom` state-based disabled flags.
    - Tooltips: Fit `Ctrl+0`, 100% `Ctrl+1`, Zoom in `Ctrl++`, Zoom out `Ctrl+-`.

11. **GetCanvasPoint / spawn**
    - `getCanvasPointFromClient` uses `canvasZoomRef.current` (unchanged).
    - `getNextComponentSpawnPoint` uses `(scrollLeft - VIEW_MARGIN)/zoom` and `(scrollTop - VIEW_MARGIN)/zoom`.
    - No other client→model math.

## Tests

- `ui/src/viewSettings.spec.ts`: default, invalid, round-trip with a fake storage.
- `ui/src/canvasView.spec.ts`:
  - deltaMode 0/1/2 normalization and ±240 cap.
  - plain wheel → pan (vertical), shift → horizontal with swapped deltaX/deltaY, ctrl/meta → zoom, setting ON → zoom.
  - anchored scroll preserves the focus model point at 10%, 25%, 100%, 200%, 800%.
  - fit view with margin, clamp, grid opacity thresholds.
- `ui/src/CanvasZoomControls.spec.tsx`: indicator shows %, menu presets, 50/100/200, zoom-to-selection disabled without selection; keyboard selection of a preset.
- `ui/src/DiagramBuilder` tests: existing only; full suite.
- Browser phase 3 covers the real wheel/pan/scrollbars/drop-hit-wire-label matrices.

## Guardrails

- No glyph/ring/anchor/router/wire-point/snapshot changes.
- No view state in circuit snapshots.
- Do not change `getCanvasPointFromClient` into a second transform; it stays the single screen→model conversion.
- No new editing features.
- No commit.

## Acceptance

- Plain wheel pans vertically; Shift+wheel horizontally; Ctrl/Cmd/pinch zooms at cursor; setting swaps plain wheel to zoom.
- Zoom 10–800%, Ctrl+0 fit, Ctrl+1 100%, Ctrl+plus/minus center step, Space/middle pan restore the previous tool.
- Visible draggable scrollbars; extents = diagram + margin.
- Grid minor LOD; line widths crisp.
- Zoom/pan does not change `data-render-count`.
- Drop/hit/wire/labels remain correct after zoom/pan.
- Full suite, tsc 25 baseline, build.
