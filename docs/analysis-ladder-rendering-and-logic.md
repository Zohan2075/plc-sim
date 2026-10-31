# Analysis: ladder rendering, symbols, engine logic, UI coupling

> **SUPERSEDED (historical).** This is the pre-plan exploration snapshot (2026-10-29) that grounded
> plan `hoja-plano-logica-y-ui`; phases 1-6 implemented and changed most of what it describes
> (line numbers, orphan components, snapshot v1, CSS-only grid, the UI tag solver). Kept as
> rationale/history — **do not use it as current documentation**. Current docs:
> [modules/](modules/ui.md) · [rules-contract.md](rules-contract.md) ·
> [symbol-catalog.md](symbol-catalog.md) · [README.md](README.md).
> Sections below known to be superseded: §2 (grid is now SVG via `diagram/sheet.tsx`), §3/§4/§5
> (symbols, engine logic and UI coupling fixed by phases 1-5; the legacy tag solver is gone, D1),
> §7 (circuits are `CircuitSnapshot` **v2** with v1 migration) and §8 (tests are vitest + Playwright).

Status: exploration snapshot (2026-10-29). Read-only analysis; no source changed.
Grounds the plan for: (a) sheet-style rendering, (b) ANSI/NEMA symbols, (c) interlock / E-stop / overload logic, (d) sheet + physical control panel UI.

## 1. Module inventory

| Package / file | Responsibility |
|---|---|
| `ladder-types/src/index.ts` | Pure types: `InstructionType` (XIC, XIO, NOTC, NCTO, OTE, OTL, OTU), `Rung`, `Program`, `InstructionBase`. No positions. |
| `plc-engine/src/index.ts` | `PlcEngine` facade: `loadProgram`, `setInput`, `scan`, `scanWithTrace`, `getTag`. |
| `plc-engine/src/programRunner.ts` | Scan cycle, per-instruction evaluation (`evaluateInstruction` L102, `...WithTrace` L144), timers (`advanceTimedContact` L236). |
| `plc-engine/src/tagMemory.ts` | `TagMemory`: `inputs`, `current` maps; snapshot, read-during-scan, commit. |
| `plc-engine/src/types.ts` | `TraceStep`, `TraceRung`, `ScanTrace`, `PlcEngineApi`. |
| `plc-engine/test/engine.spec.ts` | 7 vitest cases (XIC/OTE, XIO, NOTC, NCTO, same-label timers, OTE deferral, OTL/OTU). |
| `ui/src/App.tsx` | Root. Holds `PlcEngine`, run loop (`setInterval`, L69-80), rebuilds engine on every program change (`buildEngine` L28). Renders only `<DiagramBuilder>`. |
| `ui/src/DiagramBuilder.tsx` (6866 lines) | Entire live UI: freeform schematic canvas, palette, symbols, wiring, snapshot save/load, **and a second electrical simulator** (see §4/§6). |
| `ui/src/projectData.ts` | `ProjectBundle` types + parsers/serializers, catalog loader, localStorage helpers. **Loaders are unused by any .tsx.** |
| `ui/src/TracePanel.tsx` | Trace view over `ScanTrace`. **Not imported anywhere (orphan).** |
| `ui/ladder-display/LadderDisplay.tsx` | Rung-card list (rail + instruction cards). **Orphan** (only in tsconfig include). |
| `ui/control-panel/ControlPanel.tsx` | Start/stop/single-scan buttons + scan-cycle text. **Orphan.** |
| `ui/status-display/StatusDisplay.tsx` | Tag cards grouped input/output/internal with Set ON/OFF for inputs. **Orphan.** |
| `ui/src/App.css` (2462 lines), `ui/src/styles.css` | Styling; grid background at App.css L1789-1830; symbol styles `.diagram-symbol` (L342). |
| `ui/vite.config.ts` | `publicDir: ../data` → `data/*` served at site root (`/program-data/...`, `/settings/...`). |
| `server/src/index.ts` | Express: static `ui/dist`, `/healthz`, SPA fallback. **No API.** |
| `data/{program,tag,settings}-data/*.json`, `data/settings/project-catalog.json` | Built-in demo projects (served as static files; not loaded by live App). |
| `sample-programs/*.project.json` | Portable `ProjectBundle` examples. Not referenced by code. |
| `docs/README.md`, `docs/DEPLOYMENT.md` | Design intent (engine deterministic; ladder-types pure; ui has no simulation logic). |

Note: `git status` shows 48 modified files; `git diff --ignore-cr-at-eol` is empty → working tree differs from HEAD only by line endings (CRLF). Ignore for plan purposes.

## 2. How the ladder is rendered today

- **There is no rung-based rendering in the live app.** The live view is a freeform 2D schematic: `DiagramBuilder` (`export function DiagramBuilder`, L3932). Rungs are *derived* from the drawing (`deriveProgram` L3623 → `collectRungPaths` L3554, DFS from each source port along pass-through components to a coil).
- Canvas = `<div className="builder-freeplay">` (L6018) containing a plane (`freeplay-plane-overlay`, L6501) and an SVG `freeplay-svg` sized `planeSettings.width × height` (L6511). Wires are `<polyline>`s (L6524) plus hit-lines (L6544) and node `<circle>`s (L6595). Components are absolutely positioned HTML/SVG blocks (`renderSymbolGraphic`, call at L6807).
- **Grid = pure CSS**: `--grid-spacing` (default 18px) and `--major-grid-spacing` (18×5 = 90px) set inline at L4653-4654; repeating-gradient background in `App.css` L1789-1830. Nothing in the SVG draws grid lines → alignment depends on snapping math only.
- **Snapping/coordinates**:
  - Plane defaults: `DEFAULT_PLANE_WIDTH=1720`, `HEIGHT=940`, `DEFAULT_GRID_SPACING=18` (L226-228); clamps: width 960-4200, height 600-2400, grid 8-96 (L229-234).
  - `snapPointToGrid` (L1603) rounds to `gridSpacing`; `snapPointToTerminalLattice` (L1823) uses `TERMINAL_LATTICE_X/Y_OFFSET` (L257-258; with current constants ≈ 8 and 15 px) so terminals sit on a lattice offset from the grid.
  - Component anchor: `getComponentPlaneSnapOffset` (L1645), `snapComponentToPlaneGrid` (L1691), `requantizeSceneToPlaneGrid` (L1759) when grid spacing changes.
  - Component box: `COMPONENT_WIDTH=160`, `COMPONENT_HEIGHT=136`, glyph 102 (L219-221). Symbol viewBox mapped via `projectSymbolPoint` (L1098) into a 160×84 viewport.
  - Wires: orthogonal routing `createOrthogonalPath` (L1780), `normalizeWirePoints` (L1841), `simplifyWirePoints` (L1861); snap to other wires `findNearestWireSegmentAnchor` (L2803).
- **No cuadro de título, no border/sheet frame, no column/row reference, no symmetric layout, no rung numbering on the sheet.** `LadderDisplay` (orphan) has rung numbers but no grid.
- Data model (positions live in the UI, **not** in `ladder-types`):
  - `BuilderComponent` (L32-56: id, type, x, y, rotation, tag, label, sourceVoltage, delayMs, isClosed, isPressed, lampGlowColor, terminalLabels). **Fields x/y/rotation/label/tag/... are declared twice** (L41-55) — same types, so legal in TS but a merge artifact to clean up.
  - `BuilderWire` (L58: id, points[], startPortId, endPortId, color, thickness).
  - `BuilderScene` (L88: components, wires). `BuilderPlaneSettings` (L93: width, height, gridSpacing).
  - `CircuitSnapshot` (L107; `CIRCUIT_SNAPSHOT_VERSION=1` L250): components, wires, program, tags, settings{gridSpacing,width,height,scanIntervalMs}. Export `downloadCircuitSnapshot` L2051, import `parseCircuitSnapshot` L2360 (file read ~L2401). `DiagramFault` L99.
  - Terminals: `TerminalDefinition` (L67) from `getTerminalDefinitions` (L1120-1217); runtime `BuilderTerminal` (L76) via `getComponentTerminals` (L2545); port id = `getPortId` (L1588).
  - Netlist: `buildResolvedPortGraph` L3491, `buildElectricalNodeGraph` L3513, `buildElectricalSimulationGraph` L785.

## 3. Symbols supported today

Types (`BuilderComponentType`, L18): `InstructionType` ∪ {BREAKER_1P, BREAKER_2P, SWITCH_1P, PUSH_BUTTON_NO, PUSH_BUTTON_NC, POWER_SOURCE, DC_SOURCE, LAMP, MOTOR}.

Palette (`instructionPalette`, L295-313): AC source, DC source, 1P breaker, 2P breaker, single switch, NO PB, NC PB, Lamp, XIC, XIO, NOTC, NCTO, OTE. **Not in palette:** MOTOR, OTL, OTU (they exist in the snapshot whitelist L268-285 and in `renderSymbolGraphic`).

Per-type code locations (all in DiagramBuilder.tsx):
- Classification helpers: L321-412 (`componentNeedsTag`, `isCoilType`, `isContactType`, `isPassThroughType` L359, `getSymbolCategory` L387).
- Terminals: `getTerminalDefinitions` L1120-1217 (sources L1122, breakers L1132/L1151, switch L1142, lamp/motor L1165, PB L1175, contacts L1185-1204, coils L1205).
- Labels/symbol text: `getInstructionSymbol` L915, `getComponentName` L952, `getDefaultComponentLabel` L1051.
- Symbol SVG: `renderSymbolGraphic` L1272-1564 (viewBox 128×60/64/72). Approximate order: AC source ~L1319 (circle with sine), DC source ~L1334 (−/+ circle), switch ~L1344 (arc, in/out), 2P breaker ~L1356 (4 terminals, linkage), 1P breaker ~L1376, lamp ~L1392 (circle + X), motor ~L1401 (circle, rotor, "M"), push button ~L1419/L1439 (plunger bar; NO/NC variants), XIC ~L1465, XIO ~L1486 (slash), NOTC/NCTO ~L1508/L1526 (`renderTimedContactGlyph` L1289), OTE ~L1535 (circle + core), OTL ~L1544 ("L"), OTU ~L1554 ("U"). Verify exact ranges before editing.
- Styles: `.diagram-symbol*` in `ui/src/App.css` (L342 onward).
- Contact/PB/lamp behaviour: `isBreakerClosed` L572 (**always true for any breaker type → breakers cannot open/trip**), `isMaintainedSwitchClosed` L576, `isMomentaryPushButtonPressed` L580, `isContactClosed` L591, `isContactActuated` L617.
- Lamp color: `LAMP_GLOW_COLOR_OPTIONS` L286, `getLampGlowColorValue` L418. Status badge: `getComponentStatusBadge` L3900 (LAMP L3921, MOTOR L3925).
- Timer visual: `getTimedContactTimerDisplay` L514; countdown formatting L492-510; display at L6672.

Missing vs. goal (b): NC/NO contact symbols exist only as XIC/XIO (ANSI-ish); no ANSI overload relay, guardamotor, selector switch, pilot light (LAMP is a generic lamp), limit switch, TON/TOF naming (only NOTC/NCTO), emergency stop (no red mushroom), start/stop PB styling (red NC / green NO).

## 4. Engine (plc-engine)

Scan (programRunner.ts):
- `runScan` L30: snapshot inputs (`memory.snapshotInputs`), new `pendingWrites` Map, evaluate each rung left-to-right with `power=true` (L60-72), then `memory.commitWrites` (L39).
- Reads: `readDuringScan` (tagMemory.ts L18) prefers the frozen input image, else committed value. Writes only go to `pendingWrites` (OTE L125-128, OTL L129-132, OTU L133-136).
- Timers: `advanceTimedContact` L236-277. Constants: `TIMED_CONTACT_ACTUATION_DELAY_MS = 250` (L15, hidden extra delay added to every timer). NOTC closed when done; NCTO closed while timing and opens when done. State keyed by `instruction.id` (L23), cleared when input false (L244).
- Trace: `runScanWithTrace` L42, `TraceStep` (types.ts L3-14).

Ambiguities / bugs (ordered by impact):
1. **OR via parallel branches is wrong.** `collectRungPaths` (DiagramBuilder L3554) creates one rung per path, so two parallel contacts feeding one coil become two rungs writing the same tag. Engine `pendingWrites` is last-writer-wins (`set`, L126): a later rung with power false overwrites an earlier true → coil drops. Physical sim is correct (OR), engine is not → divergence.
2. **Pass-through devices are invisible to the engine.** Breakers, switches, push buttons (`isPassThroughType` L359) produce no instruction (only `componentNeedsTag` types get one, L592-601). A PB→coil path becomes a rung with no contacts, so the OTE is always true in the engine. The UI masks this for pure OTE tags (physical override, see 5), but **OTL/OTU and mixed tags use the engine value and ignore buttons/switches entirely.**
3. **Timers are not power-gated in the engine.** `evaluateInstruction` calls `advanceTimedContact` even when `powerBefore` is false (L119-124, L175-180); timing depends only on the contact's own tag. ANSI TON/TOF semantics (enable = rung power) are not implemented.
4. **Same-scan OTE vs OTL on one tag**: last rung wins; no priority concept.
5. **Input tags are never driven in the live UI.** `setInput` is only called by the orphan `StatusDisplay`; App never passes a setter to DiagramBuilder. `buildEngine` (App.tsx L28-42) sets inputs from `project.inputValues`, which are only captured from the engine itself. So an XIC on an `input`-kind tag is effectively constant in the live app.
6. **Engine state is discarded on every rebuild.** `handleBuilderProgramChange`, `handleRunToggle` (App.tsx L98-177) call `buildEngine` → new `PlcEngine`, so OTL-latched internal/output bits reset on Run/Stop/program edit.
7. No E-stop priority, no interlock primitive, no overload/trip concept, no fault latching in engine.

Tests: `plc-engine/test/engine.spec.ts` (7 cases, all green when run: `npx vitest run` in `plc-engine/`, 1.6 s). None cover parallel branches, pass-through devices, OTE/OTL conflicts, or NCTO reset edge cases beyond basic.

Status after phase 2 (`implementation/phase-2-impl.md`, `ui/src/parity/`):
- Bug 1 (OR) and bug 2 (pass-through devices): **superados** in the engine path. `compileDiagram` emits one rung per path and a `__builder_device__:<id>` tag per device; the engine ORs the rungs (D9).
- Bug 3 (timers not power-gated): fixed in the engine in phase 1. The UI countdown reads the engine trace in engine mode. Declared divergence R-GATE (legacy solver only) in fixture F05.
- Bug 5 (input tags never driven): partial. Device inputs are driven through `EngineSession.setDeviceInputs`; label input tags still come from the project only (phase 5 adds the panel).
- Bug 6 (engine recreated): **superado**. `EngineSession` owns one `PlcEngine`; Run/Stop/program edits do not recreate it.
- Section 5 (solver): in engine mode the solver is a read-only view (`solver/electricalView.ts`) and only reads tags. The legacy solver remains behind `TAG_SOURCE = "legacy-solver"` until its removal is approved.

## 5. UI behaviour and coupling

- `App.tsx`: state = `builderProgram`, `project`, `engine`, `running`, `tick`, `fault`, `errorMessage`. Loop at L69-80: `engine.scanWithTrace(scanIntervalMs)` every interval. `tagValues` = `engine.getTag` for every tag (L125-131) → passed to DiagramBuilder. Blank project created in code (L12-26); data/ files **not loaded**.
- `DiagramBuilder` props (L200-217): fault, onCircuitLoad, onFaultDetected, onFaultReset, onProgramChange, onRunToggle, program, runDisabled, running, scanIntervalMs, simulatorLabel/Message/Tone, tags, tagValues, tick.
- **Second simulator inside the UI.** `computeElectricalState` (L3668-3840) is a physical circuit solver: energizes wires/components from sources through conductive pairs; detects short circuit (L3745-3765, returns `fault`). `resolvePhysicalInstructionTagValues` (L822-913) recomputes **pure OTE tags from the drawing** (fixed-point, 1-scan feedback lag) and keeps engine values for latched/mixed tags. This conflicts with docs/README.md ("ui has no simulation logic") and with goal (c).
- Run button is inside DiagramBuilder (`onClick={onRunToggle}` L4765). Fault reset also in DiagramBuilder. Electrical sim runs only when `running` (L3689).
- Electrical timing: `electricalElapsedMs = scanIntervalMs` when tick changed (L4620); timer state persisted in refs (L4002-4004, L4859-4870).
- Program sync: `useEffect` L4872-4888 calls `onProgramChange(derivedState.program, builderTags)` when derived program signature changes; App rebuilds engine.
- Interaction: palette drag (L4725-4760), selection (`BuilderSelection` L22), wire draw/cut/reconnect (L6512-6630), zoom/pan (`canvasZoom` 0.5-2, L240-243), plane settings inputs (L6084-6114), snapshot save/load (L5518-5540).
- Orphans (not imported): `TracePanel`, `LadderDisplay`, `ControlPanel`, `StatusDisplay`, and `projectData` loaders (`loadBuiltInProject`, `loadProjectCatalog`, `tryLoadSavedProject`, `saveProjectSnapshot`, `downloadProjectBundle`, `readProjectBundleFile`).

## 6. Server

- `server/src/index.ts`: Express app (L1-31): serves `ui/dist` statically, `/healthz` → "ok", SPA fallback `*` → index.html, port from `PORT` (default 3000). **No API endpoints; no protocol.** The UI depends on nothing server-side; data is static (`publicDir`).

## 7. Data formats

- `ProjectBundle` (projectData.ts L39-48): `{version, id?, name, description?, program:{rungs[]}, tags[], settings:{scanIntervalMs>=25 int}, inputValues:{tag:boolean}}`.
  - Rung: `{id, instructions[]}`; instruction: `{id, type, tag}`; NOTC/NCTO add `delayMs` (int ≥0).
  - Tag: `{name, kind: input|output|internal, label?, description?, initialValue?}`.
  - Parser rejects unknown instruction types (`instructionTypes` set L7) → adding new types requires updating `projectData.ts` L7 and `parseProgram`.
- `ProjectCatalog` (`data/settings/project-catalog.json`): `{version, defaultProjectId, projects[{id,name,description?,programPath,tagDataPath,settingsPath}]}`.
- `CircuitSnapshot` (DiagramBuilder L107): `{version:1, name, savedAt, settings{gridSpacing,width,height,scanIntervalMs}, components[], wires[], tags[], program}`. Parser is strict and has legacy-wire restore logic (`restoreLegacyCircuitSnapshotWireEndpoints` L2206) → any change to component/wire fields must keep old snapshots loadable or bump version with migration.
- Samples: `data/program-data/*.program.json`, `data/tag-data/*.tags.json`, `data/settings/*.settings.json`, `sample-programs/*.project.json` (bundle form, with `tags`/`settings`/`inputValues`). Nothing in code loads the sample-programs; the data/ set is only reachable by URL. They are engine-level (no positions) and will keep loading if `InstructionType` only gains members (parser must be extended).

## 8. Tests and commands

- Root: `pnpm test` → `pnpm -r test`. `pnpm build` → `pnpm -r build`. `pnpm dev` → UI vite. `pnpm start` → server.
- plc-engine: `vitest run` (script `test`), `tsc -p tsconfig.json` (build). Verified: 7/7 pass.
- ui: `test` = echo "no tests"; build = `vite build`. No UI tests exist; no lint anywhere.
- ladder-types: no tests.

## 9. Risks / coupling points per goal

(a) Sheet rendering
- Positions/grid live in DiagramBuilder (6.8k lines). Title block, border, column/row zones must be added at the plane/SVG level (L6511) and CSS (App.css L1789-1830); currently only CSS grid, no frame.
- Grid snapping constants are duplicated (DEFAULT_GRID_SPACING vs terminal lattice offsets L257-258 vs `getComponentPlanePadding` max(grid,16) L1641). Changing grid rules touches requantization (L1619-1690, L1759) and snapshot settings → snapshot compatibility.
- Wire routing uses free orthogonal paths, not a rung lattice; forcing "symmetric rungs" means either constrained placement or an auto-layout that writes x/y (conflicts with user drag and with snapshot format).

(b) ANSI/NEMA symbols
- Adding types touches: `BuilderComponentType` (L18), `circuitSnapshotComponentTypes` (L268), palette (L295), terminals (L1120), symbol SVG (L1272), labels/names (L915-1091), classification helpers (L321-412), electrical helpers (L572-822), and `projectData.ts` L7 for any new `InstructionType`. Keep old types (XIC/XIO/NOTC/NCTO/OTE/OTL/OTU) and existing snapshot IDs working; TON/TOF should map onto NOTC/NCTO semantics or be new types with `delayMs`.
- Breaker never opens (L572): overload/guardamotor need state (tripped) → new fields on `BuilderComponent` and engine input.
- Visual states (energized, pressed, closed) come from the physical solver, not the engine → symbol state logic is in two places.

(c) Interlocks / E-stop / overload
- Engine has no notion of priority, interlock, or latched fault. Implementing E-stop priority means either: (i) engine-level rung/tag override evaluated last, or (ii) an explicit Safety/override section run after logic. Either must be mirrored in the physical solver or the diagram will disagree with the engine.
- Pass-through devices (PB, switches, breakers) must become engine-visible (inputs or instruction nodes) before any interlock logic is trustworthy (see Engine bug #2). Otherwise OTL/seal-in with a start/stop pair is wrong in the live app.
- Fix #1 (parallel branches) before relying on OR/seal-in patterns.
- Timers: power-gate them (TON/TOF semantics) — changes engine behaviour and trace; the NOTC/NCTO cases in `plc-engine/test/engine.spec.ts` must be re-verified.
- Overload trip should latch (OTL-style) with reset, distinct from E-stop; needs a reset input and a fault channel (existing `DiagramFault` L99 only models short-circuit).

(d) UI reshape
- Live UI has one component (DiagramBuilder) owning run/fault/sim; the four orphan panels (ControlPanel, StatusDisplay, LadderDisplay, TracePanel) are the existing building blocks but are not wired into App. Reusing them means rewiring App.tsx (layout) and passing `setInput`, which does not exist in the live path yet.
- A physical panel (PB/selector/pilot light bound to tags) needs an input path into the engine (`engine.setInput`) — currently absent (Engine bug #5). Pilot lights should read engine tags, not the physical solver, to avoid two sources of truth.
- Engine is rebuilt on every edit/run toggle (App.tsx L98-177) → latch and timer state loss; a panel-driven UI will expose this immediately.
- The `resolvePhysicalInstructionTagValues` path conflicts with "UI has no simulation logic"; decide whether to remove it (engine becomes single source) before building the panel.

Cross-cutting
- `docs/README.md` design intent vs reality: physical solver in UI; orphan components; unused data loaders. Plan should decide: one evaluator (engine) with the diagram as a view, or keep both and document the divergence.
- Recommended first steps for the plan (not decided here): fix engine parallel-branch OR and pass-through visibility; then single-source evaluation; then symbols; then sheet frame; then panel.
