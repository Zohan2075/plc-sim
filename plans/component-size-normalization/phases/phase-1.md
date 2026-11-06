---
type: planning
entity: phase
plan: "component-size-normalization"
phase: 1
status: completed
created: "2026-11-05"
updated: "2026-11-06"
---

# Phase 1: Normalize replacement SVG art to NCTO/level norms

> Part of [component-size-normalization](../plan.md)

## Objective

Ingest the replacement off-delay and level-switch reference SVGs as individual `path`, `circle`, and `line` elements; split them into `NCTC`/`NOTO` and `LEVEL_SWITCH_NO`/`LEVEL_SWITCH_NC`; map their terminal rings to the accepted norms (**96-unit pitch, anchors ≈32/128** for off-delay; **90-unit pitch, anchors ≈35/125** for level); render the generated element geometry with per-element paint; and derive display, hit, label, and ring geometry dynamically from the generated tight bounds. Preserve saved positions/format and leave the selector and older glyphs unchanged. The prior `q = 0.75` / 72-unit / thin-1.0-band geometry is superseded.

## Scope

### Includes

- Read all `path`, `circle`, and `line` elements from `reference/Off delays contacts (on and off).svg` (12 elements) and `reference/Liquid level switch (on and off).svg` (6 elements).
- Generate element metadata and transforms for `NCTC` (source elements 0–5), `NOTO` (6–11), NO (path + 2 circles), and NC (path + circle + path-circle) without redrawing source geometry.
- Compute ring centers/radii, under-disc radius, and stroke-aware tight bounds from the generated elements.
- Render generated `path`, `circle`, and `line` elements with per-element fill/stroke/strokeWidth; draw white under-discs.
- Derive terminal definitions, display boxes, hit shapes, and labels from the generated bounds; use the maximum ring radius for both terminal hit areas.
- Make level geometry state-aware and make off-delay display state-aware while hit/label coverage spans both states.

### Excludes

- `SELECTOR_3POS` art, zones, anchors, and interaction. Its measurements remain unchanged (ring 12.11×10.46, line 2.08×1.79, pitch 54).
- Load-time wire-endpoint migration (`sceneLoad` / `applySceneState` policy): interrupted work in the dirty worktree is deferred by user decision.
- Palette implementation changes (Phase 2 is verification/evidence only).
- Changes to older glyphs/anchors, routing geometry, placement behavior, behavior logic, or saved format.

## Prerequisites

- [x] Replacement reference SVGs are present and readable.
- [x] Element splits are confirmed: off-delay NCTC 0–5 / NOTO 6–11; level NO 3 elements / NC 3 elements.
- [x] Accepted mapping targets are confirmed: off-delay 96 pitch / 32+128 anchors / 10.19 ring; level 90 pitch / 35+125 anchors / 10.24 ring; source strokes 4.375.
- [x] User confirmed the selector remains unchanged.

## Deliverables

- [x] Updated generator with element-level ingestion, per-symbol element arrays, ring metadata, transforms, and tight bounds.
- [x] Updated generated art modules for off-delay and level.
- [x] Renderer support for generated `path`, `circle`, and `line` elements with per-element paint.
- [x] Dynamic display/hit/label geometry plus maximum-ring-radius terminal hit areas.
- [x] Phase verification: targeted tests, full UI/plc-engine suites, `tsc` vs baseline, build, and stale-evidence record.

## Acceptance Criteria

- [x] Source element counts are exact: off-delay 12 → NCTC 6 / NOTO 6; level 6 → NO 3 / NC 3. Path/line/circle geometry and source order are preserved.
- [x] Off-delay terminal anchors project to approximately `(32, 48.5)` / `(128, 48.5)` with pitch 96 and midpoint `(80, 48.5)`; level anchors project to approximately `(35, 48.5)` / `(125, 48.5)` with pitch 90 and midpoint `(80, 48.5)`.
- [x] Generated tight bounds match the current art: `NCTC` 116.375×55.371, `NOTO` ≈116.382×70.156, level NO 110.473×89.739, level NC 110.470×79.014. Display boxes equal these bounds.
- [x] Ring radii are 10.19 for both off-delay states and 10.24 for level; both terminal hit areas use the maximum. Source strokes are 4.375 and project at approximately 4.38 local units.
- [x] Generated element rendering supports `path`, `circle`, and `line` with per-element fill/stroke/strokeWidth; white under-discs use generated centers/radius.
- [x] Hitboxes use the generated tight-art rectangle plus terminal ring circles; labels use the generated tight-art rectangle. Off-delay hit/label bounds union both states; level bounds follow the active state.
- [x] `SELECTOR_3POS` and older glyph/anchor/router/behavior code remain unchanged.
- [x] Saved component positions are preserved; load migration is deferred and not an acceptance gate.
- [x] UI 36 files / 1352 tests, plc-engine 2 files / 14 tests, `tsc` 23 vs baseline 23, build OK, targeted geometry suite 339 tests.
- [x] Prior `q = 0.75` off-delay/level values and all pre-replacement-SVG evidence are marked superseded/stale.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| 2 | blocks | Palette-path verification and the final regression/evidence record follow the now-stable replacement art. |

## Notes

- Off-delay ring centers are derived by sorting the two terminal circles by x after choosing elements 3/4 (NCTC) and 6/7 (NOTO); source element order in the generated arrays remains the source slice order.
- Level NO uses source elements 0–2; NC uses 3–5. The generator sorts ring centers by x for terminal placement while preserving the element array order.
- `art.scale` values are approximately 0.800–0.804; multiplied by `OUTPUT_PROJECTION_SCALE = 1.25`, the projected source scale is approximately **1.0**, which is why source ring/stroke dimensions carry through nearly 1:1.
- The earlier `q = 0.4` (38.4 pitch, 4.38 band, 58.x boxes), `q = 0.75` (72 pitch, 44/116 anchors, 1.0 band, 102.x boxes), and their `-q04` evidence are historical only.
- The attached JSON remains unavailable; do not claim it was verified. Load migration remains deferred.
- Evidence files under `verification/` all predate the replacement SVGs; do not present them as current renders.
