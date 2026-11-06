---
type: planning
entity: plan
plan: "component-size-normalization"
status: completed
created: "2026-11-05"
updated: "2026-11-06"
---

# Plan: Component size normalization

## Objective

Normalize the four new off-delay/level-switch glyphs (`NOTO`, `NCTC`, `LEVEL_SWITCH_NO`, `LEVEL_SWITCH_NC`) to the **NCTO/level terminal norms** using the replacement reference SVGs now in `reference/`. Off-delay art maps to NCTO-style anchors at approximately `(32, 48.5)` / `(128, 48.5)` with a **96-unit pitch**, **10.19 ring radius**, and **4.375 source stroke**; level art maps to approximately `(35, 48.5)` / `(125, 48.5)` with a **90-unit pitch**, **10.24 ring radius**, and **4.375 source stroke**. Per-type display boxes follow the generated tight art bounds; hitboxes derive from those bounds plus terminal ring circles (maximum ring radius), and labels use the same dynamic bounds. Keep `SELECTOR_3POS` and all older glyphs unchanged, preserve saved component positions and format, verify the already-shared component-bar preview path, and retain honest measurement/evidence status. Load-time wire-endpoint migration remains deferred and is not part of acceptance.

The prior `q = 0.75` / 72-unit-pitch / thin-1.0-band off-delay and level geometry is **superseded**. The earlier `q = 0.4` / 38.4-pitch / 4.38-band pass is historical as well.

## Motivation

At 100% zoom the first version of the four new glyphs was substantially larger than the established symbols, with a 96-unit pitch (5⅓ grid cells). That art was reduced through several iterations: a 36-unit pitch (`q = 0.375`), then a `q = 0.4` / 38.4-unit pitch / 4.38 band, then a `q = 0.75` / 72-unit pitch / thin 1.0 band. The user then supplied **replacement reference SVGs** whose geometry already matches the desired terminal norms:

- **Off-delay** `reference/Off delays contacts (on and off).svg` has **12 elements** (paths, lines, terminal circles). `NCTC` uses elements 0–5 and `NOTO` uses elements 6–11. Both map to NCTO anchors ≈`(32, 48.5)` / `(128, 48.5)`, pitch 96, ring radius 10.19, source strokes 4.375, and projected source scale ≈1.0.
- **Level** `reference/Liquid level switch (on and off).svg` has **6 elements**. `LEVEL_SWITCH_NO` is a path plus two terminal circles; `LEVEL_SWITCH_NC` is a path, a circle, and a path-circle. Both map to anchors ≈`(35, 48.5)` / `(125, 48.5)`, pitch 90, ring radius 10.24, source strokes 4.375.

Generated `scale` is ≈0.800–0.804; multiplied by the 1.25 symbol projection, the effective source-local scale is ≈1.0. The final replacement art uses a 96-unit off-delay pitch (the same numerical pitch as the first oversized version), but now with NCTO-scale rings/strokes and tight bounds, so its visual weight matches the norm rather than the earlier oversized art.

The generated element renderer now accepts `path`, `circle`, and `line` elements with per-element `fill`, `stroke`, and `strokeWidth`. Hitboxes for the four resized types now use the dynamic generated tight-art rectangle plus terminal ring circles (maximum ring radius); labels use the same dynamic tight-art rectangle, bypassing the stale scaled HITBOX entries. Level display/hit bounds are state-aware; off-delay hit/label bounds union the open and closed states, while its display box follows the active contact state.

`SELECTOR_3POS` remains explicitly unchanged: ring 12.11×10.46, line 2.08×1.79, pitch 54. The existing palette renderer still applies one shared component-local scale. The previously recorded palette preview dimensions were measured against the superseded `q = 0.75` art and are not current measurements; no new per-tile measurement was captured after the replacement SVGs.

## Requirements

### Functional

- [x] Read both replacement SVGs as individual `path`, `circle`, and `line` elements and split the off-delay source into `NCTC` elements 0–5 and `NOTO` elements 6–11, preserving source order and geometry.
- [x] Split the level source into NO (path + 2 circles) and NC (path + circle + path-circle), preserving source order and geometry.
- [x] Map generated ring centers to NCTO/level terminal anchors: off-delay ≈`(32, 48.5)` / `(128, 48.5)`, pitch 96; level ≈`(35, 48.5)` / `(125, 48.5)`, pitch 90; both keep the pair midpoint at x=80.
- [x] Render generated `path`, `circle`, and `line` elements with per-element fill/stroke/strokeWidth; draw white under-discs at the generated ring centers using the generated under-disc radius.
- [x] Derive new-type terminal definitions, display boxes, hitboxes, and labels from generated tight bounds instead of the stale scaled shape tables.
- [x] Use terminal ring hit circles with the maximum generated ring radius for both terminals of each resized type.
- [x] Make level display/hit/label geometry state-aware (open vs closed) and make off-delay display geometry follow the active contact state while hit/label coverage spans both states.
- [x] Leave `SELECTOR_3POS`, older glyphs, routing geometry, placement behavior, simulation behavior, and the saved format unchanged.
- [x] Preserve saved component positions; load-time endpoint migration remains deferred.
- [x] Verify the existing component-bar preview path still uses one shared component-local scale; no palette implementation change was required.

### Non-Functional

- [x] No original SVG element redraws, path splitting, or reordering; generator output preserves the source element attributes it consumes.
- [x] No edits to older components' glyph blocks, anchors, router geometry, or behavior.
- [x] No changes to the saved project format; work remains uncommitted.
- [x] Record exact current measurements, including the 96/90 pitches, 10.19/10.24 ring radii, 4.375 source strokes, and per-type tight bounds.
- [x] Record that the earlier `q = 0.4` and `q = 0.75` values are superseded rather than current.
- [x] Mark all pre-replacement-SVG screenshots/JSON as historical evidence; do not claim them as current renders.

## Scope

### In Scope

- Element-level ingestion of the replacement off-delay and level SVGs and generated `path`/`circle`/`line` metadata for the four types only.
- Derived terminal anchors, ring radii, under-discs, tight display boxes, dynamic hitboxes/labels, and state-aware level geometry.
- Renderer support for generated element types and per-element paint attributes.
- Test/render/measurement evidence, regression gates, and plan progress.

### Out of Scope

- Resizing `SELECTOR_3POS` or any older component.
- Implementing load-time wire-endpoint migration (`sceneLoad` / `applySceneState` policy). Interrupted work in the dirty worktree is recorded as deferred by user decision and is not part of acceptance.
- Adding a palette wrapper or changing palette rendering/CSS; the existing shared component-local scale is sufficient.
- Changing wire routing, placement behavior, grid spacing, simulation behavior, off-delay timing, or level-switch conduction.
- Changing the saved project format.
- Reconstructing the pre-existing malformed `docs/modules/ui.md` without user authorization.
- Verifying the attached JSON while it remains unavailable.
- Claiming the existing PNG/JSON evidence as a current render; all of it predates the replacement SVGs.

## Definition of Done

- [x] Source element counts and splits are exact: off-delay 12 elements → `NCTC` 6 / `NOTO` 6; level 6 elements → NO 3 / NC 3. Source path/line/circle geometry is preserved.
- [x] Off-delay anchors map to ≈`(32, 48.5)` / `(128, 48.5)` with pitch 96 and pair midpoint `(80, 48.5)`; level anchors map to ≈`(35, 48.5)` / `(125, 48.5)` with pitch 90 and pair midpoint `(80, 48.5)`.
- [x] Resized display boxes equal generated tight bounds within the stated precision: `NCTC` 116.375×55.371; `NOTO` ≈116.382×70.156; level NO 110.473×89.739; level NC 110.470×79.014.
- [x] Generated ring radii are 10.19 for both off-delay states and 10.24 for level; both terminal hit areas use the maximum ring radius. Source strokes are 4.375 and project at approximately 4.38 in component-local units.
- [x] Dynamic hitboxes use the generated tight-art rectangle plus terminal ring circles; labels use the same dynamic bounds. Off-delay hit/label bounds union both states; level bounds follow the active state.
- [x] `SELECTOR_3POS` remains ring 12.11×10.46, line 2.08×1.79, pitch 54.
- [x] Full UI suite 36 files / 1352 tests, plc-engine 2 files / 14 tests, `tsc` 23 errors (baseline 23), build OK, and targeted geometry suite 339 tests pass.
- [x] Prior `q = 0.75` off-delay/level values (72-unit pitch, 44/116 anchors, 1.0 band, 102.x boxes, 15.26/12.09/15.09 ring hit radii) are explicitly marked superseded.
- [x] The attached JSON is reported as unavailable rather than claimed verified; load migration remains deferred; stale evidence is marked, not cited as current.

## Testing Strategy

- Unit tests read the replacement SVGs directly and assert element counts, per-element `d`/`cx`/`cy`/`r`/`x1`/`y1`/`x2`/`y2` preservation, and absence of older limit-switch paths.
- Geometry tests assert projected anchors, 96/90 pitch, midpoint preservation, generated tight-width ranges, display-box rotation/origin behavior, dynamic hit/label bounds, and state-aware level bounds.
- `SELECTOR_3POS` art/zone/rotation tests remain unchanged and green.
- Targeted geometry suite: 339 tests across `alignment.spec.ts` (282), `component-display-bounds.spec.ts` (10), `hitboxes.spec.ts` (40), and `offDelayLevelArt.spec.ts` (7).
- Full UI suite, plc-engine suite, TypeScript baseline comparison, and workspace build.
- Evidence status: every PNG and JSON under `verification/` predates the replacement SVGs (the newest PNG is 10:36 PM; the new SVGs were written at 11:22/11:47 PM). They are historical only.

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Normalize replacement SVG art to NCTO/level norms | Element ingestion, 96/90 pitch, 4.375 source strokes, dynamic hit/label/display bounds | completed |
| 2 | Verify palette path and complete verification | Verify existing shared preview path, record current geometry, regression gates, evidence status | completed |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| Superseded `q = 0.4` and `q = 0.75` values remain in changelogs and old evidence. | A reader could mistake historical values for current scope. | Active text uses the replacement-SVG values; old values are explicitly marked superseded. |
| All verification PNG/JSON artifacts predate the replacement SVGs. | No current visual artifact exists. | Recorded as stale; do not cite them as current evidence. Re-capture if a current visual artifact is required. |
| Prior palette preview dimensions (≈27×17.5 / ≈27×18–20) were measured on superseded art. | They no longer describe the replacement glyphs. | Keep only as historical notes; no new per-tile measurement was captured. The shared palette renderer path itself is unchanged. |
| Per-type display and hit bounds differ by state and type. | A single "off-delay box" or "level box" number is misleading. | Record per-type/state exact bounds and document the off-delay union vs level active-state rule. |
| The attached JSON is not in the workspace. | Exact attached-file verification cannot run. | Report the limitation; do not claim the attached file was verified. |
| Interrupted `sceneLoad` / `applySceneState` work exists in the dirty worktree. | It is outside the accepted scope. | Record as deferred; the user chose "decide later". Do not include it in acceptance or delete/modify it. |
| `docs/modules/ui.md` is already malformed/modified in the worktree. | Updating module inventory could overwrite unrelated work. | Do not rewrite it without permission. |
| The existing pointer evidence is from the `q = 0.4` era. | No current terminal-click capture exists. | Selector evidence remains applicable because the selector is unchanged; targeted hit/geometry tests pass. Do not present the old terminal capture as current. |

## Changelog

### 2026-11-06

- **Latest accepted revision:** replacement reference SVGs installed. Off-delay now renders 12 source elements split `NCTC` 0–5 / `NOTO` 6–11 at NCTO anchors ≈(32,48.5)/(128,48.5), pitch 96, ring 10.19, source stroke 4.375, tight bounds 116.375×55.371 (NCTC) and ≈116.382×70.156 (NOTO). Level now renders 6 source elements split NO path+2 circles / NC path+circle+path-circle at anchors ≈(35,48.5)/(125,48.5), pitch 90, ring 10.24, source stroke 4.375, tight bounds 110.473×89.739 (NO) and 110.470×79.014 (NC).
- Renderer now consumes generated `path`, `circle`, and `line` elements with per-element fill/stroke/strokeWidth. Hit areas use dynamic generated tight bounds plus terminal ring circles with the maximum ring radius; labels use the dynamic bounds. Off-delay hit/label bounds union both states; level bounds are state-aware.
- Regression gates: UI 36 files / 1352 tests, plc-engine 2 files / 14 tests, `tsc` 23 vs baseline 23, build OK, targeted geometry suite 339 tests.
- **Superseded:** the prior `q = 0.75` / 72-unit / 44-116 anchors / 1.0 band / 102.x boxes / 15.26-12.09-15.09 ring radii are historical. The older `q = 0.4` / 38.4 / 4.38 / 58.x values remain historical too.
- Evidence note: every PNG and JSON under `verification/` predates the replacement SVGs; they are stale and are not claimed as current. The attached JSON remains unavailable; load migration remains deferred.

### 2026-11-05

- Plan created after the 100% geometry/palette audit and the initial nearest-grid 36-unit (`q = 0.375`) selection for the four new types; selector remained unchanged.
- Revised decision: **NCTO is the size norm**. Implementation moved to `q = 0.4`, 38.4-unit local pitch (2.133 cells, not whole-grid), and 4.38 ring/line. **Superseded.**
- Phase 1 was verified at the `q = 0.4` stage: UI 36 files/1351 tests, plc-engine 2 files/14 tests, `tsc` 23 vs baseline 23, build OK, targeted 342 tests. Those geometry values are historical.
- Palette scope reduced to verification/evidence: the existing renderer already uses one shared component-local scale, so no palette wrapper/code is required.
- Interrupted load-migration work (`sceneLoad` / apply policy) recorded as deferred per user's "decide later"; excluded from acceptance.
- **Prior accepted revision (superseded on 2026-11-06):** uniform `q = 0.75`, 72-unit local pitch (4 grid cells), thin `OUTPUT_STROKE_BAND = 1.0`. Tight boxes were ~102.6×65.0 (off-delay NOTO), 102.2×76.5 (level NO), 102.2×67.8 (level NC); anchors (44,48.5)/(116,48.5), midpoint (80,48.5). Ring hit radius used the maximum of both ring radii. Targeted suite 338 passed.
- Evidence note at that time: `ncto-norm-gallery.png`, `palette-preview-gallery.png`, and `selector-options.png` predated the final 10:33 PM code change; `-q04` JSON files were historical.
