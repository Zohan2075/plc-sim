---
type: planning
entity: phase
plan: "component-size-normalization"
phase: 2
status: completed
created: "2026-11-05"
updated: "2026-11-06"
---

# Phase 2: Verify palette scale and complete verification

> Part of [component-size-normalization](../plan.md)

## Objective

Verify that every component-bar palette preview still derives from the real glyph through the existing shared component-local scale after the replacement SVG art was adopted, record the current replacement-art canvas geometry and regression gates, and mark all pre-replacement evidence as stale. This phase remains verification/evidence only: no palette wrapper, palette CSS, selector change, or older-glyph change.

The prior palette preview measurements (≈27×17.5 off-delay, ≈27×18–20 level) were taken against the superseded `q = 0.75` art and are **not current measurements**. No new per-tile measurement was captured after the replacement SVGs.

## Scope

### Includes

- Verify the existing `componentPalettePanel` / `renderSymbolGraphic` path and component-bar CSS still produce one shared component-local preview scale for the replacement art; record the implementation invariant without changing it.
- Record the current canvas geometry: 96/90 pitches, 32/128 and 35/125 anchors, 10.19/10.24 ring radii, 4.375 source strokes, and per-type tight bounds.
- Verify dynamic hit/label bounds, maximum-ring-radius terminal hit areas, state-aware level behavior, and selector isolation.
- Run all tests, TypeScript check, build, and the targeted geometry suite.
- Record pointer/evidence status honestly, including the fact that all existing PNG/JSON artifacts predate the replacement SVGs.
- Update plan/todo progress and retain the verification record.

### Excludes

- Any palette wrapper, palette CSS change, or new palette renderer. The existing shared scale is sufficient.
- Any change to canvas glyphs or anchors beyond the Phase 1 replacement-art implementation.
- Selector canvas resizing, selector zone changes, or router/behavior changes.
- Load-migration acceptance. `sceneLoad` / apply-policy work is deferred by user decision.
- Saving a new project format or claiming verification of the unavailable attached JSON.
- Claiming pre-replacement PNGs/JSON as current visual or measurement evidence.

## Prerequisites

- [x] Phase 1 complete and its tests/build pass.
- [x] Replacement art is stable at 96/90 pitches with 4.375 source strokes and dynamic bounds.

## Deliverables

- [x] Palette-path verification: the existing shared renderer is still the single preview path; no palette code changed. Current per-tile dimensions are not re-measured after the replacement SVGs.
- [x] Recorded current canvas geometry: off-delay 96 pitch / anchors ≈32/128 / ring 10.19 / bounds 116.375×55.371 (NCTC) and ≈116.382×70.156 (NOTO); level 90 pitch / anchors ≈35/125 / ring 10.24 / bounds 110.473×89.739 (NO) and 110.470×79.014 (NC).
- [x] Full regression results with real values: UI 36 files / 1352 tests, plc-engine 2 files / 14 tests, `tsc` 23 vs baseline 23, build OK, targeted 339.
- [x] Updated plan/todo and Phase 1 verification evidence.
- [x] Evidence status section identifying every PNG/JSON as pre-replacement and stale.

## Acceptance Criteria

- [x] The existing palette path still renders each tile from the real glyph through one shared component-local scale; no new palette wrapper/CSS exists. Prior per-tile dimensions are superseded rather than presented as current.
- [x] Selector/old-symbol canvas rendering, anchors, router, and behavior remain unchanged; selector remains ring 12.11×10.46, line 2.08×1.79, pitch 54.
- [x] Existing behavior and selector tests pass unchanged; full gates pass (UI 36/1352, plc-engine 2/14, `tsc` 23 vs baseline 23, build OK, targeted 339).
- [x] Hit areas use generated tight art plus terminal ring circles; labels use the dynamic tight-art rectangle; off-delay unions both states and level is state-aware.
- [x] Loaded-fixture/display-bounds tests cover the replacement-art root dimensions; no current browser fixture capture exists.
- [x] Selector/terminal pointer status is recorded: the selector matrix remains valid because the selector is unchanged; the terminal artifact is `q = 0.4`-era and is not current evidence.
- [x] Attached JSON limitation is explicit and not claimed as verified.
- [x] All visual/measurement artifacts are explicitly identified as stale rather than used as a pass claim.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| 1 | blocked-by | Palette verification uses the completed replacement-art canvas geometry. |

## Notes

- The existing palette renderer/CSS already uses one shared component-local scale. Do **not** add a palette wrapper or new sizing code; this phase is verification/evidence only.
- All verification images (`ncto-norm-gallery.png` 10:36 PM, `palette-preview-gallery.png` 9:50 PM, `selector-options.png` 9:39 PM) predate the replacement SVGs (11:22 PM level, 11:47 PM off-delay). They are stale for the current art.
- `component-measurements-thin.json` (10:45 PM) records the prior `q = 0.75` / thin-band art, not the replacement art. `component-measurements-q04.json` and `e2e-selector-level-q04.json` are older `q = 0.4` artifacts.
- `docs/modules/ui.md` is already malformed/modified. Do not replace or reconstruct it without user permission.
- Deferred: `sceneLoad` / `applySceneState` load migration and its tests are outside this task's allowed list. The user chose "decide later"; do not include them in Phase 2 acceptance.
