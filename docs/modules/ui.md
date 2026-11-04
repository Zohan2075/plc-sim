---
type: documentation
entity: module
module: "ui"
version: 1.0
---

# Module: ui

> Part of [jPLC Sim](../README.md)

## Overview

`ui/` (package `@plc-sim/ui`, React 18 + Vite) is the visualization and control surface: a
sheet-style ladder canvas, a physical side panel, the wiring→program compiler, a read-only
electrical view and the engine session. It contains **no simulation logic**: every tag value comes
from `@plc-sim/plc-engine` (D1).

### Responsibility

- **Is**: drawing (snap-to-grid sheet), editing, compiling the wiring to a `Program`, driving the
  one `PlcEngine` (inputs + scans), rendering engine state (sheet symbols, panel lamps, trace), and
  parsing/serializing project and snapshot data.
- **Is not**: deciding tag values (engine only), hosting HTTP APIs (server only), owning runtime
  types (`ladder-types` only).

### Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| `@plc-sim/ladder-types` | module | `InstructionType`, `Rung`, `Program` (pure types) |
| `@plc-sim/plc-engine` | module | `PlcEngine`, `ScanTrace` — the only tag writer |
| react / react-dom | library | Rendering |
| vite, vitest, @playwright/test | tooling | Dev server, unit tests, E2E (D5) |

## Structure

| Path | Type | Purpose |
|------|------|---------|
| `ui/src/App.tsx` | file | Root: holds the `EngineSession`, run loop, project state, panel/sheet layout |
| `ui/src/DiagramBuilder.tsx` | file | Canvas editor (~8k lines): palette, wiring, inspector, snapshot load/save, adaptive context-menu integration (`ContextMenuLayer`), multi-select, undo/redo (max 50) and clipboard |
| `ui/src/TracePanel.tsx` | file | Scan-trace table (reused inside the panel debug drawer) |
| `ui/src/projectData.ts` | file | `ProjectBundle`/`TagDefinition` types + exported parsers; data-file loaders removed in phase 6 |
| `ui/src/App.css`, `ui/src/styles.css` | file | Styling (grid gradient removed in phase 4: SVG is the single grid source) |
| `ui/src/diagram/` | dir | Sheet domain: model, grid, sheet, snapshot, symbols, geometry, palette, terminals, timing, inspection states, constants, electrical graph |
| `ui/src/diagram/contextMenu.tsx` | file | Portal-based adaptive context menu (`ContextMenuLayer`): fixed screen coords, viewport clamp/flip, submenus, keyboard, long-press helper |
| `ui/src/diagram/selector3pos.tsx` | file | `SELECTOR_3POS` art generated from the three supplied SVGs: every element in original order, one wrapper per state, ring centers/anchors, 3.5-unit stroke, generated stem/bar joint filler for states 1/3; `?debugTerminals=1` ring crosshairs |
| `ui/src/diagram/wireRoute.ts` | file | Display routing: `resolveWireDisplayPoints` plus the SELECTOR_3POS ring-rim endpoint trim (stored wire points and anchors unchanged) |
| `ui/src/compiler/` | dir | Wiring → `Program` compiler + device bindings |
| `ui/src/solver/` | dir | Read-only electrical view |
| `ui/src/runtime/` | dir | `EngineSession` (the one engine) |
| `ui/src/panel/` | dir | Side panel model, control kinds, actuation helpers, `SidePanel` |
| `ui/src/parity/` | dir | Parity fixtures/goldens/harness (regression of the compiled program) |
| `ui/control-panel/`, `ui/status-display/`, `ui/ladder-display/` | dir | Reused orphan components (D3): run controls, tag cards, rung cards |
| `ui/e2e/` | dir | Playwright specs (7 tests) + `.circuit.json` fixtures + helpers |
| `ui/playwright.config.ts`, `ui/vite.config.ts` | file | E2E config (dev server on 5173) / vite config (`publicDir: ../data`) |
| `ui/src/**/__fixtures__/`, `ui/src/diagram/__baseline__/` | dir | v1 snapshot fixture, symbol baseline (`symbols-14.baseline.json`) |

### Specs (vitest, `test.include = src/**`)

21 spec files, 1015 tests: `diagram/{alignment,contextMenu,contextMenu.render,electrical-latch,grid,interaction,operate,reference-circuit,rotation,selector3pos,selector3posArt,selector-wire-trim,sheet,short-circuit,snapshot,terminal-alignment,timer-reset,vertical-wires,wire-routing,wire-stubs,wireHops}`. Key spec counts: `diagram/alignment.spec.ts` (233), `diagram/contextMenu.spec.ts` (18), `diagram/contextMenu.render.spec.tsx` (8), `diagram/rotation.spec.ts` (31), `diagram/interaction.spec.ts` (19), `diagram/operate.spec.ts` (4), `diagram/selector3pos.spec.ts` (7), `diagram/selector3posArt.spec.ts` (3), `diagram/selector-wire-trim.spec.ts` (2), `diagram/snapshot.spec.ts` (14), `diagram/terminal-alignment.spec.ts` (304), `diagram/wire-routing.spec.ts` (8), `diagram/wire-stubs.spec.ts` (319), `diagram/short-circuit.spec.ts` (2).

## Key Symbols

### Root and builder

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `App` | function | `ui/src/App.tsx:43` | Root; owns `EngineSession` (`useRef`), run loop via `setInterval`, fault handling, `SYS:RESET` fallback pulse (`App.tsx:192`) |
| `DiagramBuilder` | forwardRef component | `ui/src/DiagramBuilder.tsx:4294` | Sheet editor; props include `engineTrace`, `tagValues`, `onProgramChange`, `onDeviceInputsChange`, `onDeviceInventoryChange` |
| `DiagramBuilderHandle` | interface | `ui/src/DiagramBuilder.tsx:62` | Panel channel: `actuateDevice(id, closed)`, `setMomentaryPressed(id, pressed)` (OD5-1) |
| `TracePanel` | function | `ui/src/TracePanel.tsx:8` | Renders `ScanTrace` + tags (debug drawer tab) |

### `src/diagram`

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `BuilderComponentType` / `BuilderComponent` / `BuilderWire` / `CircuitSnapshot` | type | `diagram/model.ts:27,45,62,119` | Scene model; `SheetMetadata` (`model.ts:104`), `DiagramFault` (`model.ts:111`) |
| `clampPointToPlane`, `snapPointToGrid`, `snapComponentToPlaneGrid`, `createOrthogonalPath`, `normalizeWirePoints`, `requantizeSceneToPlaneGrid`, `sanitizePlaneSettings` | function | `diagram/grid.ts:27,35,147,237,283,215,92` | Snap-to-grid, clamping, orthogonal routing, grid requantization |
| `buildGridLines`, `computeZoneMarks`, `computeSheetFrame`, `computeTitleBlockRect`, `zoneLabel`, `createDefaultSheetMetadata`, `SheetLayer` | function | `diagram/sheet.tsx:43,69,88,98,55,123,142` | SVG sheet: major/minor grid, zone marks (from major grid), frame, title block |
| `CIRCUIT_SNAPSHOT_VERSION`, `migrateCircuitSnapshot`, `parseCircuitSnapshot`, `readCircuitSnapshotFile`, `createCircuitSnapshot`, `downloadCircuitSnapshot` | function/const | `diagram/constants.ts:63`, `diagram/snapshot.ts:417,438,482,82,115` | Snapshot v2; v1→v2 migration; unknown versions rejected |
| `renderSymbolGraphic`, `getInstructionSymbol` | function | `diagram/symbols.tsx:62,5` | ANSI/NEMA SVG glyph per type + text fallback glyph |
| `SYMBOL_GEOMETRY` | const | `diagram/symbolGeometry.ts:26` | Single terminal/geometry table for all 29 types |
| `instructionPalette` | const | `diagram/palette.ts:13` | 29 Spanish palette entries in 5 groups |
| `getTerminalDefinitions`, `getComponentTerminals`, `getConductiveTerminalPairs`, `snapPointToTerminalLattice`, `getComponentName`, `isCoilType`, `isDeviceType`, … | function | `diagram/terminals.ts:247,411,145,453,476,7,30` | Terminal model, conduction pairs, Spanish names |
| `getTimedContactDelayMs`, `clampTimedContactDelayMs` | function | `diagram/timing.ts:13,5` | Delay preset per component (ms) |
| `INSPECTION_STATE_OPTIONS`, `getActiveInspectionState`, `applyInspectionState`, `isEngineTripStateType` | const/function | `diagram/inspectionStates.ts:16,40,45,50` | Inspector states: OLR/GUARDAMOTOR `normal|tripped`, FUSE `intacto|fundido`, DISCONNECT `cerrado|abierto` |
| `buildElectricalNodeGraph`, `collectReachableNodesWithParents`, `collectCurrentFlowPathNodeIds` | function | `diagram/electricalGraph.ts:164,100,123` | Port graph used by both compiler and view |
| `constants` (`DEFAULT_PLANE_WIDTH/HEIGHT`, `DEFAULT_GRID_SPACING`, zoom/limits, `PALETTE_DRAG_THRESHOLD`) | const | `diagram/constants.ts` | Sheet defaults (1720×940, grid 18 px) and limits |
| `ContextMenuLayer` | forwardRef component | `diagram/contextMenu.tsx:532` | Portal menu to `document.body` with `position: fixed`; imperative `open`/`close` through `ContextMenuHandle` (`contextMenu.tsx:50`) |
| `clampMenuPosition`, `getSubmenuSide`, `getNextMenuIndex`, `isLongPressCancelled` | function | `diagram/contextMenu.tsx:80,109,129,141` | Pure menu helpers: 8 px viewport clamp/flip, submenu side, arrow-key wrap, long-press cancel threshold |
| `updateComponentSelection`, `resolveCanvasContextMenuAction` | function | `diagram/interaction.ts:6,27` | Additive selection set (Shift/Ctrl/Meta); canvas right-click resolves cancel-wire vs open-menu |
| `LAMP_GLOW_COLOR_OPTIONS`, `getLampGlowColorValue` | const/function | `DiagramBuilder.tsx:344,490` | 7 lamp colors: red, green, yellow, amber, orange, blue, white (default yellow); maps each to fill/stroke/symbol |
| `isBreakerClosed`, `toggleComponentOperateState` | function | `DiagramBuilder.tsx:631,678` | Breaker default-closed state and latched operate for breakers + maintained switches; no running dependency |
| `rotateComponentInScene`, `formatRotationRemovalMessage` | function | `DiagramBuilder.tsx:2196,2065` | Primary-terminal snap, attached-wire + transitive orphan-branch deletion, no re-route; toast text |
| `renderSelector3Pos`, `Selector3PosPosition` | component/type | `diagram/selector3pos.tsx` | 3-state 4-terminal selector art generated from the supplied SVGs; all elements in original order; per-state wrapper; local ring centers (53,24)/(107,24)/(53,78)/(107,78) = terminal anchors; 3.5-unit stroke; generated stem/bar joint filler for states 1/3; `currentColor` + `diagram-symbol--energized`; `selectorPosition` 1/2/3; `?debugTerminals=1` draws ring crosshairs |
| `getNextSelectorPosition` | function | `DiagramBuilder.tsx` | Direction-aware 1-2-3-2-1 click cycle for the maintained 3-position selector |
| `trimSelectorWireEndpoint`, `wireHasSelectorEndpoint` | function | `diagram/wireRoute.ts` | Shortens only the drawn SELECTOR_3POS wire end to the rendered ring outer ellipse; stored points and other components unchanged |

### `src/compiler`

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `compileDiagram(components, wires, options)` | function | `compiler/compileDiagram.ts:74` | Pure wiring→program: one rung per simple source→coil path; returns `{program, deviceInputs, tags, resolvedWires, runnableRungs, diagnostics}` (`CompileResult`, L32) |
| `MAX_PATH_COMBINATIONS` = 256 | const | `compiler/compileDiagram.ts:20` | Path-combination cap; exceeding it leaves the coil out + `too-many-paths` diagnostic (L26) |
| `DEVICE_TAG_PREFIX`, `SYSTEM_RESET_DEVICE_TAG`, `DEVICE_BINDINGS` | const | `compiler/deviceMapping.ts:4,7,19` | Device tag naming (`__builder_device__:<id>`) and per-type binding |
| `getDeviceBinding`, `getDeviceTag`, `getDeviceContactState` | function | `compiler/deviceMapping.ts:40,44,53` | Instruction/kind/fixed tag; contact state rules (D13 healthy-by-default) |

### `src/solver` (read-only)

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `ElectricalView` / `ElectricalViewInput` | interface | `solver/electricalView.ts:8,18` | Energy/fault output; `tagValues` are read-only inputs |
| `computeElectricalView` | function | `solver/electricalView.ts:143` | Energy flow, wire current, `fault` (short circuit); never writes tags (`electricalView.ts:7`) |
| `getViewConductivePairs`, `getLoadTag`, `isOverloadTripped`, `isContactActuated` | function | `solver/electricalView.ts:42,28,80,93` | Conduction for the view (devices from contact state, XIC/XIO from engine tags, NOTC/NCTO from the trace) |

### `src/runtime`

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `EngineSession` | class | `runtime/engineSession.ts:9` | Owns the single `PlcEngine`; `applyProgram` (keeps tag memory), `setDeviceInputs`, `setInput`, `start`/`stop`, `tick(elapsedMs)` → `ScanTrace`; one-scan pulse hold only for `SYS:RESET` (OD5-4, L37-46) |

### `src/panel`

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `PanelControlKind`, `PanelDevice` | type | `panel/model.ts:4,7` | `momentary | maintained | emergency | sensor | trip | lamp | motor` |
| `getPanelControlKind`, `getPanelDevices` | function | `panel/panelControls.ts:30,38` | Kind per type; device inventory derived from `deviceMapping` |
| `setMomentaryPressed`, `setDeviceClosed` | function | `panel/panelActuation.ts:9,17` | Update the diagram component behind a panel control |
| `SidePanel` | function | `panel/SidePanel.tsx:179` | Run controls (`ControlPanel`), device controls/indicators, `StatusDisplay`, debug drawer (`TracePanel` + `LadderDisplay`) |

### `src/parity`

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `runEngine` | function | `parity/harness.ts:60` | Runs a fixture scene through `compileDiagram` + `EngineSession` + `computeElectricalView`; device inputs via `setDeviceInputs(compileDiagram(...).deviceInputs)` (`harness.ts:81`) |
| `buildScene`, `applyDeviceStates` | function | `parity/scene.ts:43,86` | Fixture JSON → components/wires |
| `parity.spec` | spec | `parity/parity.spec.ts` | F01-F12 diagram goldens, M01-M06 motor fixtures, `data/program-data` round-trip |

### `projectData.ts`

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `PROJECT_FORMAT_VERSION` = 1 | const | `projectData.ts:3` | `ProjectBundle` version |
| `parseProgram`, `parseTagDefinitions`, `parseProjectSettings`, `parseProjectCatalog`, `parseProjectBundle` | function | `projectData.ts:126,196,115,67,98` | Whitelist parsers (exported in phase 6 for the sample tests) |
| `captureInputValues` | function | `projectData.ts:52` | Snapshot of input tag values (engine → bundle) |

Phase 6 removed the 7 orphan loaders (`loadProjectCatalog`, `loadBuiltInProject`,
`hasSavedProjectSnapshot`, `tryLoadSavedProject`, `saveProjectSnapshot`, `readProjectBundleFile`,
`downloadProjectBundle`) — none had callers since phase 2 (analysis §5).

## Data Flow

1. `App` holds the project (`ProjectBundle`) and the one `EngineSession`.
2. Edits in `DiagramBuilder` → `compileDiagram` → `onProgramChange(program, tags)` → `session.applyProgram` (tag memory preserved, D2/bug 6).
3. `App` renders `<SidePanel>` + `<DiagramBuilder>`; the panel actuates devices through
   `builderHandle.actuateDevice/setMomentaryPressed` → the builder recomputes
   `deviceInputs` → `onDeviceInputsChange` → `session.setDeviceInputs` (D18).
4. Run loop: `session.tick(scanIntervalMs)` → `ScanTrace` → sheet (`electricalView`) and panel.
5. Lamps/motors read their device tag from the engine (`tagValues`), never from local state.

## Configuration

- `ui/vite.config.ts`: `publicDir: ../data` (data files served at site root), dev port 5173,
  `test.include` restricted to `src/**` (Playwright specs are not vitest tests).
- `ui/playwright.config.ts`: `testDir: ./e2e`, single worker, chromium, `webServer: pnpm dev`.
- Scan interval comes from project settings (`scanIntervalMs`, default 150; minimum 25 in
  `projectData.ts`).

## Inventory Notes

- **Coverage**: full for files and exported symbols; internal helpers of `DiagramBuilder.tsx`
  (~8k lines) are described by role, not exhaustively.
- **Notes**: derived from the tree on 2026-10-30; gates at that date: `tsc --noEmit` 0 errors,
  vitest 501/501 in 20 files, Playwright 7/7.
