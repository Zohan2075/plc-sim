---
type: planning
entity: implementation-plan
plan: "component-size-normalization"
phase: 2
status: completed
created: "2026-11-05"
updated: "2026-11-06"
---

# Implementation Plan: Phase 2 - Verify palette scale and complete verification

> Implements [Phase 2](../phases/phase-2.md) of [component-size-normalization](../plan.md)

## Approach

Verification/evidence only. The existing partial palette renderer (`componentPalettePanel` → `renderSymbolGraphic` plus the component-bar CSS) still applies one shared component-local scale; no palette wrapper, palette CSS, or new palette renderer is required. Phase 2 verifies that invariant after the replacement SVG art, records the current **96/90 pitch / 10.19–10.24 ring / 4.375 source stroke** canvas geometry, completes the regression record, and marks all pre-replacement visual/measurement artifacts as stale instead of claiming them as current evidence. It does not change canvas glyphs, selector art/zones, routing, simulation behavior, or the saved format.

The final accepted implementation is completed. Pointer evidence is recorded honestly: the selector matrix remains valid because the selector is unchanged, while the existing resized-terminal artifact is `q = 0.4`-era and is not presented as current evidence.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| UI component palette | none (verified only) | Existing shared component-local preview scale; no wrapper or CSS change. |
| UI sizing/regression verification | verify | 23 palette previews use the shared path; current per-tile dimensions were not re-measured; replacement-art canvas states and selector/old-glyph isolation verified. |
| Plan verification artifacts | create/update | Measurements, evidence status, regression results, and Phase 2 progress. |

## Required Context

| File | Why |
|------|-----|
| `plans/component-size-normalization/plan.md` | Global constraints, visual acceptance, and verification gates. |
| `plans/component-size-normalization/phases/phase-2.md` | Verification-only Phase 2 scope and acceptance criteria. |
| `plans/component-size-normalization/verification/phase-1.md` | Exact current geometry, palette-path status, and evidence status. |
| `plans/component-size-normalization/todo.md` | Current phase tracking and evidence caveats. |
| `ui/src/DiagramBuilder.tsx` | `instructionPalette`, `renderSymbolGraphic`, `componentPalettePanel`, and the component-bar call site. |
| `ui/src/App.css` | `.builder-palette-tile__symbol` / `.diagram-symbol` preview sizing; verify one shared scale without editing it. |
| `scripts/generate-off-delay-level-art.mjs` and its two generated art modules | Current element-level transforms, 96/90 pitch, ring centers/radii, source strokes, and tight bounds used for canvas values. |
| `ui/src/diagram/selector3pos.tsx` / `selector3posArt.generated.ts` | Selector art and measurements that must remain unchanged. |
| `ui/vitest.config.ts`, `ui/package.json`, root `package.json` | Node-only Vitest and full workspace test/build commands. |

## Implementation Steps

### Step 1: Verify the existing shared palette scale (completed)

- **What**: Confirm every `instructionPalette` tile renders the real glyph through `renderSymbolGraphic` and the same component-bar preview sizing. Confirm the shared-scale invariant; do not add a wrapper. Per-tile dimensions were not re-measured after the replacement SVGs.
- **Where**: `ui/src/DiagramBuilder.tsx:7070-7102` (`componentPalettePanel`), `ui/src/DiagramBuilder.tsx:2645+` (`renderSymbolGraphic`), `ui/src/App.css:1352-1365,3499-3506` (component-bar preview CSS).
- **Why**: A new wrapper would duplicate an existing shared scale and add risk; verification is sufficient.
- **Result**: The existing renderer path remains the single shared component-local preview path. The previously recorded off-delay/level preview sizes (≈27×17.5 / ≈27×18–20) were measured against the superseded `q = 0.75` art and are now historical; the XIC/NCTO reference measurements (39.6×13.75 / 30.80×13.06) are unchanged references. No fresh per-tile measurement was captured. The `palette-preview-gallery.png` image is stale.

### Step 2: Verify current canvas and selector geometry (completed)

- **What**: Confirm the four replacement-art states against XIC/PB/selector references: 96/90 pitch, anchors ≈32/128 and ≈35/125, tight bounds equal generated art, 10.19/10.24 ring radii, 4.375 source strokes, dynamic hit/label bounds, max-of-both ring hit radii, and state-aware level behavior. Confirm selector measurements remain unchanged.
- **Where**: `ui/src/DiagramBuilder.tsx` render/geometry paths; generated art; `verification/phase-1.md`; browser-visible `DiagramBuilder` output when available. Existing gallery PNGs predate the replacement SVGs.
- **Why**: The accepted contract is visual and geometric, not just a passing build.
- **Result**: Current values recorded: off-delay 96 pitch / ring 10.19 / bounds 116.375×55.371 (NCTC) and ≈116.382×70.156 (NOTO); level 90 pitch / ring 10.24 / bounds 110.473×89.739 (NO) and 110.470×79.014 (NC); source strokes 4.375. Selector remains ring 12.11×10.46, line 2.08×1.79, pitch 54. No fresh gallery was captured after the replacement SVGs.

### Step 3: Complete regression gates (completed)

- **What**: Run the full UI and plc-engine suites, TypeScript check vs baseline, workspace build, and targeted geometry suite. Record exact counts.
- **Where**: UI/plc-engine test output; `tsc` output; build output; verification artifact.
- **Why**: Phase 1/2 must not regress older symbols, selector behavior, timing, or conduction.
- **Result**: UI 36 files / 1352 tests passed; plc-engine 2 files / 14 tests passed; `tsc` 23 errors vs baseline 23; build OK; targeted 339 tests passed.

### Step 4: Record selector/terminal pointer evidence status (completed, with caveat)

- **What**: Record the prior pointer checks: selector zones at rotations 0–3 in stopped mode, running-mode selector operation, level-switch toggle, and a resized-terminal wire start.
- **Where**: Browser-visible `DiagramBuilder` output; existing `.freeplay-component__label`, `.freeplay-selector-hitarea`, terminal-button `aria-label`s, and `.freeplay-wire--draft`; `verification/e2e-selector-level-q04.json`.
- **Why**: Keep the verification record honest about what the artifact covers.
- **Status**: Selector pointer evidence remains applicable because the selector is unchanged. The resized-terminal wire-start check was captured at `q = 0.4`; it is not re-captured for the replacement art. Targeted hit/geometry tests pass (339). Do not describe the `-q04` JSON as current-geometry evidence.

### Step 5: Finalize the verification record (completed)

- **What**: Update the verification record with current geometry, source strokes, ring-hit behavior, dynamic hit/label bounds, stale-evidence status, and all gate results.
- **Where**: `plans/component-size-normalization/verification/phase-1.md`, `plans/component-size-normalization/todo.md`, and phase/plan statuses.
- **Why**: Honest status tracking; the accepted implementation is complete, but stale artifacts must not be presented as current visual proof.

## Testing Plan

| Check | Result |
|-------|--------|
| Full UI suite | 36 files / 1352 tests passed |
| plc-engine suite | 2 files / 14 tests passed |
| Targeted geometry suite | 339 tests passed |
| TypeScript | 23 errors; baseline 23; no new errors |
| Workspace build | OK |
| Loaded fixture render | Final root dimensions covered by display-bounds tests; no current browser capture after the replacement SVGs |
| Palette preview path | Shared existing renderer; per-tile dimensions not re-measured; prior values superseded |
| Selector geometry | Unchanged: ring 12.11×10.46, line 2.08×1.79, pitch 54 |
| Current canvas geometry | Off-delay 96 pitch / 10.19 ring / 4.375 stroke; level 90 pitch / 10.24 ring / 4.375 stroke |
| Dynamic hit/label bounds | Generated tight-art rectangle; off-delay union of states, level state-aware; max ring radius for terminals |
| Visual gallery | **Stale**; all PNGs predate the replacement SVGs and are not claimed |

### Test Integrity Constraints

- No palette code, palette CSS, canvas glyph, selector art/zone, router, or simulation behavior changes in this phase.
- `selector3posArt.spec.ts`, `selector3pos.spec.ts`, selector zone/rotation/trim tests, and selector conduction behavior remain unchanged and green.
- Phase 1 `offDelayLevelArt.spec.ts` source-element assertions, `component-display-bounds.spec.ts`, `alignment.spec.ts`, and `hitboxes.spec.ts` remain unchanged.
- Deferred `sceneLoad` / `scene-apply-policy` tests are not Phase 2 acceptance evidence and must not be modified here.
- The palette path exposes every current `instructionPalette` entry in existing order; no palette items may be skipped. Per-tile dimensions are not claimed as current.
- The attached JSON is unavailable; report the limitation rather than claiming verification.
- Stale PNGs, `component-measurements-thin.json`, and `-q04` JSON files must be labelled as historical, not current measurements.

## Rollback Strategy

Revert only Phase 2 evidence/status updates. No palette wrapper, palette CSS, canvas glyph, selector, router, saved-format, or simulation code was changed in this phase. Do not restore whole `DiagramBuilder.tsx` or `App.css` files, which contain unrelated worktree edits. Do not touch deferred `sceneLoad` files as part of this rollback.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Preview composition | New palette wrapper / reuse existing shared scale | **Reuse existing shared scale; verify only** | The existing renderer already uses one component-local scale; no code change needed. |
| Phase 2 status | Complete now / keep in progress | **Completed** | Final replacement-art implementation accepted; tests/build pass. Stale visual artifacts are an evidence caveat, not a scope blocker. |
| Load migration | Include / defer | **Defer** | Outside allowed task list; user chose "decide later"; not acceptance. |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `ui/src/DiagramBuilder.tsx:408+` | `instructionPalette` | 23-entry palette inventory used for the gallery/verification. |
| `ui/src/DiagramBuilder.tsx:2645+` | `renderSymbolGraphic` and SVG cases | One real renderer serves palette and canvas; palette path unchanged in this phase. |
| `ui/src/DiagramBuilder.tsx:7070-7102` | `componentPalettePanel`, tile map | The actual 23-entry component bar; existing shared-scale preview path. |
| `ui/src/App.css:1352-1365,3499-3506` | `.builder-palette-tile__symbol`, `.diagram-symbol`, component-bar sizing | Existing preview sizing; verified, not modified. |
| `ui/src/App.css:2133-2149` | `.freeplay-component--tight`, `.freeplay-component__logical-stage` | Phase 1 tight canvas root; palette must not reuse this physical root offset. |
| `ui/src/diagram/selector3pos.tsx:21-68`; `selector3posArt.generated.ts` | `renderSelector3Pos`, selector art | Selector canvas/preview art and measurements must remain unchanged. |
| `plans/component-size-normalization/verification/phase-1.md` | Verification record | Exact current numbers and evidence status. |

### Mismatches / Notes

- **No palette wrapper is needed.** The current component-bar preview path already uses one shared component-local scale; implementing a wrapper would be redundant scope creep.
- **Prior preview ratios/dimensions are historical.** The old ≈27×17.5 / ≈27×18–20 numbers were measured on superseded art; they are not current measurements. The shared path itself is unchanged.
- **Current values are replacement-art values.** Off-delay 96 pitch / 10.19 ring / 4.375 source stroke; level 90 pitch / 10.24 ring / 4.375 source stroke. Do not reuse the superseded q=.75 72/44-116/1.0/102.x values or q=.4 38.4/4.38/58.x values.
- **Evidence PNG/JSON is stale.** `ncto-norm-gallery.png`, `palette-preview-gallery.png`, `selector-options.png`, `component-measurements-thin.json`, `component-measurements-q04.json`, and `e2e-selector-level-q04.json` all predate the replacement SVGs.
- **Load migration is deferred.** `sceneLoad` / `applySceneState` work exists in the dirty worktree from an interrupted attempt; it is outside the accepted scope and not acceptance evidence.
- **Attached JSON is unavailable.** Do not claim it was verified.
- **Selector is unchanged.** Ring 12.11×10.46, line 2.08×1.79, pitch 54.
- The working tree is dirty in `DiagramBuilder.tsx`, `App.css`, and several tests. Use only Phase 2 verification/evidence hunks; do not reset whole files.
