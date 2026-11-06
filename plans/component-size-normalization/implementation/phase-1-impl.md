---
type: planning
entity: implementation-plan
plan: "component-size-normalization"
phase: 1
status: completed
created: "2026-11-05"
updated: "2026-11-06"
---

# Implementation Plan: Phase 1 - Normalize replacement SVG art to NCTO/level norms

> Implements [Phase 1](../phases/phase-1.md) of [component-size-normalization](../plan.md)

## Approach

Change only the four new symbol groups (`NOTO`, `NCTC`, `LEVEL_SWITCH_NO`, `LEVEL_SWITCH_NC`). The replacement reference SVGs are ingested as individual `path`, `circle`, and `line` elements; source geometry and element order within each symbol are preserved. Generated ring metadata drives the terminal mapping:

- **Off-delay**: `NCTC` = source elements 0–5, `NOTO` = 6–11. Terminal circles at source elements 3/4 and 6/7 map to anchors ≈`(32, 48.5)` / `(128, 48.5)`, pitch **96**, midpoint `(80, 48.5)`, ring radius **10.19**. Source strokes are **4.375**.
- **Level**: `LEVEL_SWITCH_NO` = path + two circles, `LEVEL_SWITCH_NC` = path + circle + path-circle. Anchors ≈`(35, 48.5)` / `(125, 48.5)`, pitch **90**, midpoint `(80, 48.5)`, ring radius **10.24**. Source strokes are **4.375**.

The generator fits each symbol by its ring centers (`OFF_OUTPUT_PITCH = 96 / 1.25`, `LEVEL_OUTPUT_PITCH = 90 / 1.25`) and applies `OUTPUT_PROJECTION_SCALE = 1.25`; the projected source scale is therefore approximately **1.0** even though the generated `scale` field is ~0.80. There is no `q = 0.75` wrapper and no uniform 1.0 stroke band for this art.

The renderer consumes generated `path`, `circle`, and `line` elements with per-element `fill`, `stroke`, and `strokeWidth`, preserving white ring fills and current-color body/line paint. Display boxes use generated tight bounds; hitboxes use the dynamic tight-art rectangle plus terminal ring circles with the maximum ring radius; labels use the dynamic tight-art rectangle. Off-delay hit/label bounds union open and closed states, while level bounds follow the active state. Older glyphs, selector, routing, simulation, palette implementation, and saved format remain unchanged.

Load-time endpoint migration was planned originally but is **deferred by the user** and is not part of acceptance. The interrupted `sceneLoad` / apply-policy work in the dirty worktree is outside the allowed task list and must not be modified or used as evidence here.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| UI symbol generation and diagram geometry | modify (completed) | Element-level ingestion, ring-center mapping, generated element rendering, dynamic display/hit/label bounds, max-ring terminal hit areas, state-aware level geometry. |
| UI diagram tests/fixtures | modify/create (completed) | Assert source element preservation, new anchors/pitches/radii/strokes, bounds, rotations, hit/label behavior, and selector isolation. |
| UI saved-circuit loading | **deferred** | `sceneLoad` / `applySceneState` endpoint-only migration is not accepted here; interrupted worktree files remain deferred. |

## Required Context

| File | Why |
|------|-----|
| `plans/component-size-normalization/plan.md` | Global scope, constraints, and DoD. |
| `plans/component-size-normalization/phases/phase-1.md` | Gated Phase 1 intent and acceptance criteria. |
| `docs/vector-symbol-pipeline.md` | Existing vector-art conventions; verify all guidance against current code. |
| `docs/symbol-catalog.md` | Type inventory; verify against current source because this inventory is stale for new level-switch types. |
| `scripts/generate-off-delay-level-art.mjs` | Element ingestion, per-symbol splits, ring centers/radii, transforms, stroke-aware tight bounds. |
| `reference/Off delays contacts (on and off).svg` | Replacement off-delay source: 12 path/line/circle elements. |
| `reference/Liquid level switch (on and off).svg` | Replacement level source: 6 path/circle elements. |
| `ui/src/diagram/offDelayArt.generated.ts` and `ui/src/diagram/levelSwitchArt.generated.ts` | Generated element arrays, ring metadata, transforms, and tight bounds. |
| `ui/src/DiagramBuilder.tsx` | `getResizedSymbolArt`, `getTerminalDefinitions`, `getTerminalRingRadius`, `getResizedArtBounds`, `getComponentHitShapes`, `getComponentLabelShapes`, `getComponentDisplayBounds`, `getComponentLogicalStageOffset`, and the two generated-art render branches. |
| `ui/src/App.css` | `.freeplay-component--tight` / `.freeplay-component__logical-stage` styles and `.diagram-symbol__vector--normalized` paint conventions. |
| `ui/src/diagram/offDelayLevelArt.spec.ts`, `component-display-bounds.spec.ts`, `alignment.spec.ts`, `hitboxes.spec.ts`, `selector3pos.spec.ts`, and `selector3posArt.spec.ts` | Generated element/geometry/display-box tests and unchanged selector guards. |
| `ui/vitest.config.ts` and `ui/package.json` | Current test environment is Vitest/Node; no browser E2E dependency is configured. |
| `ui/src/diagram/sceneLoad.ts`, `sceneLoad.spec.ts`, `scene-apply-policy.spec.ts` | **Deferred** interrupted load-migration work; not part of Phase 1 acceptance. Do not modify here. |

## Implementation Steps

### Step 1: Ingest replacement SVGs element-wise (completed)

- **What**: Read every `<path>`, `<circle>`, and `<line>` element in source order. Build off-delay symbols from elements 0–5 (`NCTC`) and 6–11 (`NOTO`), and level symbols from elements 0–2 (NO) and 3–5 (NC). Preserve the original `d`, circle center/radius, line endpoints, and paint semantics (body `currentColor`, white rings, stroked lines).
- **Where**: `scripts/generate-off-delay-level-art.mjs` (`readSvgElements` `:503-512`, `elementSourceBounds` `:518-548`, `ringFromElement` `:550-559`, `buildElementSymbol` `:561-649`, `main` `:746-788`); outputs `ui/src/diagram/offDelayArt.generated.ts` and `ui/src/diagram/levelSwitchArt.generated.ts`.
- **Why**: The replacement art is element-based, not just paths; preserving element geometry avoids redraw drift and supports the exact source strokes/rings.
- **Considerations**: Do not flatten circles/lines into new paths. Do not reorder elements within a symbol. Source path commands remain uppercase `M/L/C/Z`.

### Step 2: Map ring centers to the accepted terminal norms (completed)

- **What**: Derive left/right rings from the chosen terminal elements, sort them by x, and compute `scale`/`translate` so ring centers land at the accepted local pitch. Compute ring radii from source outer radius (`r + strokeWidth / 2`) × scale × 1.25, and compute under-disc radius from the inner ring radius with a 1.05 factor.
- **Where**: `scripts/generate-off-delay-level-art.mjs:9-16` (`OFF_OUTPUT_PITCH = 96 / 1.25`, `LEVEL_OUTPUT_PITCH = 90 / 1.25`, `OUTPUT_CENTER_X = 64`, `OUTPUT_CENTER_Y = 30`, `OUTPUT_PROJECTION_SCALE = 1.25`, `OUTPUT_PROJECTION_Y = 11`), `buildElementSymbol` `:561-649`.
- **Why**: Anchor and box values must come from generated geometry, not hand-entered constants.
- **Result**: Off-delay `ringCenters` local x=25.6/102.4 → projected 32/128, y≈30 → projected ≈48.5, pitch 96. Level local x=28/100 → projected 35/125, y≈30 → projected ≈48.5, pitch 90. Generated ring radii are ≈10.19 (off-delay) and ≈10.24 (level).
- **Considerations**: `art.scale` is ~0.800–0.804; projected scale (`art.scale × 1.25`) is ≈1.0. Do not confuse the two when recording "source-local scale ~1.0".

### Step 3: Render generated elements with per-element paint (completed)

- **What**: Render the generated array as SVG `circle`, `line`, or `path` elements inside the generated transform group. Each element carries `fill`, `stroke`, and optional `strokeWidth`; white terminal rings keep `fill="#ffffff"` and current-color stroke, body fills use `currentColor`, and lines use `fill="none"`. Draw white under-discs at the generated ring centers using the generated under-disc radius.
- **Where**: `ui/src/DiagramBuilder.tsx` level branch `:2835-2890`, off-delay branch `:3099-3172`; `ui/src/App.css:415-420` (`.diagram-symbol__vector--normalized`).
- **Why**: The replacement art relies on separate filled paths, stroked rings, and stroked lines; rendering only paths would drop terminals/levers.
- **Considerations**: The off-delay branch renders all three generated tags. The level source currently contains paths and circles only. Older glyphs receive no new element rendering.

### Step 4: Derive terminals, display boxes, hitboxes, and labels dynamically (completed)

- **What**: Project generated ring centers through `projectSymbolPoint` for terminal definitions. Rotate generated `tightBounds` for display boxes; return the inverse logical-stage offset so saved `x/y` and the logical frame stay fixed. Build hit bodies from the dynamic tight-art rectangle and terminal ring circles; use `Math.max(...ringRadii)` for both terminal hit radii. Build label shapes from the same dynamic rectangle.
- **Where**: `ui/src/DiagramBuilder.tsx` `getTerminalDefinitions` `:1629-1641`, `getTerminalRingRadius` `:2075-2087`, `getResizedArtBounds` `:2107-2126`, `getComponentHitShapes` `:2132-2141`, `getComponentLabelShapes` `:2291-2300`, `getComponentDisplayBounds` `:2351-2378`, `getComponentLogicalStageOffset` `:2380-2382`; root/layer usage around `:10675-10705`; CSS `:2133-2149`.
- **Why**: The old scaled HITBOX entries no longer matched the replacement art. Dynamic bounds keep hit-testing and labels aligned to the actual glyph and avoid stale shape tables.
- **State behavior**: `getResizedArtBounds` unions `[false, true]` for off-delay, so off-delay hit/label coverage spans both states; for level it uses the active `isMaintainedSwitchClosed` state. `getComponentDisplayBounds` always uses the active state passed from render (off-delay `contactClosed`; level maintained state).
- **Considerations**: Do not change selector geometry (ring 12.11×10.46, line 2.08×1.79, pitch 54) or older hit tables.

### Step 5: Deferred - endpoint-only preservation for resized-scene loads (not accepted)

- **Status**: Deferred by user decision ("decide later"). Not part of Phase 1 or Phase 2 acceptance.
- **What exists**: Interrupted `ui/src/diagram/sceneLoad.ts`, `sceneLoad.spec.ts`, and `scene-apply-policy.spec.ts` in the dirty worktree propose a prepared-snapshot policy that preserves component positions and updates only resized-port endpoints. That work is outside this task's allowed list.
- **What to do now**: Do not modify, delete, or use those files as verification evidence for this plan. Record them as deferred and leave the saved-format/load-migration decision for later.
- **Why**: The user explicitly removed load migration from accepted scope; claiming it would overstate verification.

### Step 6: Regression and evidence (completed)

- **What**: Tests cover source element counts/geometry, projected anchors/pitches, ring radii, tight bounds, display-box rotations/origins, dynamic hit/label bounds, max-ring hit areas, state-aware level behavior, and unchanged selector measurements. The targeted geometry suite is 339 tests. All existing visual/measurement artifacts predate the replacement SVGs and are marked stale.
- **Where**: `ui/src/diagram/offDelayLevelArt.spec.ts:39-166`, `component-display-bounds.spec.ts:53-119`, `alignment.spec.ts:119-149`, `hitboxes.spec.ts:183-201,270-282,299-359`, `selector3pos.spec.ts`, `selector3posArt.spec.ts`; evidence under `plans/component-size-normalization/verification/phase-1.md`.
- **Why**: The accepted contract is geometric and visual, not just a successful build.
- **Considerations**: Full UI suite 36 files/1352 tests, plc-engine 2 files/14 tests, `tsc` 23 vs baseline 23, build OK, targeted 339 tests passed. The attached JSON remains unavailable. No fresh browser gallery was captured after the replacement SVGs.

## Testing Plan

Actual verification executed for this phase:

| Check | Result |
|-------|--------|
| Targeted geometry suite | 339 tests passed (`alignment` 282, `component-display-bounds` 10, `hitboxes` 40, `offDelayLevelArt` 7) |
| UI full suite | 36 files / 1352 tests passed |
| plc-engine suite | 2 files / 14 tests passed |
| TypeScript | 23 errors; baseline 23; no new errors |
| Workspace build | OK |
| Loaded-fixture render | Final root dimensions covered by display-bounds tests; no current browser capture after the replacement SVGs |
| Selector measurements | Unchanged: ring 12.11×10.46, line 2.08×1.79, pitch 54 |
| Final geometry | Off-delay 96 pitch, anchors ≈32/128, ring 10.19, bounds 116.375×55.371 (NCTC) / ≈116.382×70.156 (NOTO); level 90 pitch, anchors ≈35/125, ring 10.24, bounds 110.473×89.739 (NO) / 110.470×79.014 (NC) |
| Final stroke | Source 4.375, projected ≈4.38 local units |
| Dynamic hit/label bounds | Generated tight-art rectangle; off-delay union of states, level active state; terminal circles use max ring radius |

No palette wrapper test is required: the existing component-bar renderer already uses one shared component-local scale. Load-migration tests are deferred and are not acceptance evidence.

### Test Integrity Constraints

- `offDelayLevelArt.spec.ts` must assert the replacement source element counts (12 / 6), the NCTC/NOTO and NO/NC splits, exact source path/line/circle attributes, projected anchors 32/128 and 35/125, ring radii ≈10.19/≈10.24, and finite tight bounds.
- `component-display-bounds.spec.ts` covers each resized type/state at rotations 0–3: tight outer dimensions and root offset derive from transformed bounds, `x/y` remains the logical origin, the world-space ring-pair midpoint is unchanged, and every inner layer uses the inverse root offset.
- `alignment.spec.ts` and `hitboxes.spec.ts` add assertions for the four new types while keeping existing old-type and selector assertions intact.
- `SELECTOR_3POS` art/zone/rotation measurements remain unchanged; do not resize or re-style it.
- No deferred `sceneLoad` / `scene-apply-policy` assertion is part of this phase's acceptance.

## Rollback Strategy

Revert only Phase 1-owned hunks in `scripts/generate-off-delay-level-art.mjs`, its two generated outputs, the generated-element render/geometry/root-offset branches in `DiagramBuilder.tsx`, and their dedicated CSS/tests/evidence. Do not use whole-file checkout/reset on shared or already-modified worktree files. Do not touch the deferred load-migration files as part of this rollback.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Source art | Prior generated q-wrapper art / replacement element SVGs | **Replacement element SVGs** | User supplied reference art with the desired terminal/stroke geometry. |
| Off-delay mapping | 72-unit prior pitch / 96-unit NCTO pitch | **96 local pitch, anchors ≈32/128** | Matches NCTO terminal norm from the replacement art. |
| Level mapping | 72-unit prior pitch / 90-unit level pitch | **90 local pitch, anchors ≈35/125** | Matches the level terminal norm from the replacement art. |
| Stroke handling | Reapply a uniform 1.0 band / preserve source strokes | **Preserve 4.375 source strokes** | The replacement SVG strokes already match the intended weight; no artificial band. |
| Hit/label bounds | Stale scaled shape tables / dynamic tight art | **Dynamic tight-art rectangle; terminal circles for hit areas** | Keeps hit-testing aligned with the current element art and labels aligned to dynamic bounds. |
| Off-delay hit bounds | Single state / union both states | **Union both states** | Hit/label coverage must include both contact appearances. |
| Level bounds | Single fixed box / state-aware | **State-aware** | Open and closed level art have different heights. |
| Ring hit radius | Per-ring contour radius / max of both | **Max of both ring radii** | Both terminal hit areas cover the visible rings. |
| Load migration | Implement / defer | **Defer** | Outside allowed task list; user chose "decide later"; not part of acceptance. |
| Palette | New wrapper / verify existing shared scale | **Verify existing** | Existing renderer already shares one component-local scale; no code change needed. |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `scripts/generate-off-delay-level-art.mjs:9-16,503-649,746-788` | `OFF_OUTPUT_PITCH`, `LEVEL_OUTPUT_PITCH`, `OUTPUT_PROJECTION_SCALE`, `readSvgElements`, `buildElementSymbol`, `main` | Current generator emits element-level replacement art, 96/90 projected pitch, 10.19/10.24 ring radii, and tight bounds. |
| `ui/src/diagram/offDelayArt.generated.ts:44-79`; `ui/src/diagram/levelSwitchArt.generated.ts:44-73` | `OFF_DELAY_ART`, `LEVEL_SWITCH_ART` | Generated element arrays/ring centers/radii/tight bounds; source geometry/order must remain unchanged. |
| `ui/src/DiagramBuilder.tsx:1524-1532` | `getResizedSymbolArt` | Selects state-aware art for the four types. |
| `ui/src/DiagramBuilder.tsx:1629-1641` | `getTerminalDefinitions` resized branch | Derives anchors from generated ring centers through `projectSymbolPoint`. |
| `ui/src/DiagramBuilder.tsx:2075-2087` | `getTerminalRingRadius` | Returns `Math.max(...ringRadii)` for both resized terminals. |
| `ui/src/DiagramBuilder.tsx:2107-2126,2132-2141` | `getResizedArtBounds`, `getComponentHitShapes` | Dynamic tight-art body + ring circles; off-delay union vs level active state. |
| `ui/src/DiagramBuilder.tsx:2291-2300,2351-2382` | `getComponentLabelShapes`, `getComponentDisplayBounds`, `getComponentLogicalStageOffset` | Dynamic label rectangle, tight display bounds, inverse logical-stage offset. |
| `ui/src/DiagramBuilder.tsx:2835-2890,3099-3172` | Level and off-delay render branches | Generated `path`/`circle`/`line` rendering with per-element paint. |
| `ui/src/App.css:415-420,2133-2149` | `.diagram-symbol__vector--normalized`, `.freeplay-component--tight`, `.freeplay-component__logical-stage` | Paint conventions and presentation-only tight root/logical stage. |
| `ui/src/diagram/offDelayLevelArt.spec.ts:39-166`; `component-display-bounds.spec.ts:53-119`; `alignment.spec.ts:119-149`; `hitboxes.spec.ts:183-201,270-282,299-359` | Source/geometry/display/hit/label assertions | Tests encode the replacement-art values. |

### Mismatches / Notes

- **The prior `q = 0.75` off-delay/level values are superseded.** Do not reuse 72-unit pitch, 44/116 anchors, 1.0 band, 102.x boxes, or 15.26/12.09/15.09 ring hit radii for the current art.
- **The earlier `q = 0.4` values remain historical too** (38.4 pitch, 4.38 band, 58.x boxes).
- **Exact current bounds**: NCTC 116.375×55.371, NOTO 116.381582×70.155654 (reported ≈116.382×70.156), level NO 110.472815×89.739343, level NC 110.469530×79.013896.
- **Scale semantics**: generated `scale` ≈0.800–0.804; projected source scale (`scale × 1.25`) ≈1.0. "Source-local scale ~1.0" refers to the projected result.
- **Strokes are source 4.375**, projected ≈4.38; there is no uniform 1.0 outline for this art. The generator still contains the legacy `buildSymbol`/`OUTPUT_STROKE_BAND` helper path, but `main()` uses `buildElementSymbol`; the emitted group `strokeWidth` is 0 and per-element stroke widths are 4.375.
- **Hit/label geometry is dynamic**: off-delay unions both states; level follows the active state. Do not compare against stale scaled HITBOX entries.
- **The selector is unchanged.** Its accepted measurements remain ring 12.11×10.46, line 2.08×1.79, pitch 54.
- **Palette implementation is out of scope.** The shared renderer path is unchanged; prior preview dimensions (≈27×17.5 / ≈27×18–20) are superseded and were not re-measured after the replacement SVGs.
- **All visual/measurement evidence is stale.** The newest PNG is 10:36 PM; the replacement SVGs were written at 11:22/11:47 PM. `component-measurements-thin.json` records the prior q=.75 thin-band art; `-q04` files are older still.
- **Load migration is deferred, not passed.** `sceneLoad.ts` and its tests exist in the dirty worktree but are outside the accepted scope.
- **The attached JSON is unavailable.** Do not claim it was verified.
- `docs/modules/ui.md` is known malformed/stale and modified in the worktree; do not use it as source of truth or edit docs during this phase.
- The worktree already contains unrelated uncommitted source and plan changes. Apply/revert only Phase 1 hunks.
