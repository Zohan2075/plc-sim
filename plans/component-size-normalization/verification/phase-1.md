---
type: planning
entity: verification
plan: "component-size-normalization"
phase: 1
status: completed
created: "2026-11-05"
updated: "2026-11-06"
---

# Phase 1 Verification: Replacement SVG art normalized to NCTO/level norms

> Part of [component-size-normalization](../plan.md) · [Phase 1](../phases/phase-1.md)

## Summary

Phase 1 is implemented using the **replacement reference SVGs**; the geometry is verified at 100% canvas zoom by the targeted tests. No fresh browser screenshot was captured after the replacement art. The four new types now render element-level source art:

- **Off-delay** `NCTC` and `NOTO` use 6 source elements each from the 12-element replacement SVG, mapping to NCTO anchors ≈`(32, 48.5)` / `(128, 48.5)`, pitch **96**, ring radius **10.19**, and source stroke **4.375**.
- **Level** `LEVEL_SWITCH_NO` and `LEVEL_SWITCH_NC` use 3 source elements each from the 6-element replacement SVG, mapping to anchors ≈`(35, 48.5)` / `(125, 48.5)`, pitch **90**, ring radius **10.24**, and source stroke **4.375**.

The renderer now consumes generated `path`, `circle`, and `line` elements with per-element fill/stroke/strokeWidth. Display boxes use generated tight bounds; hitboxes use the dynamic tight-art rectangle plus terminal ring circles with the maximum ring radius; labels use the dynamic tight-art rectangle. Off-delay hit/label bounds union open and closed states; level bounds are state-aware.

`SELECTOR_3POS` is unchanged. The prior `q = 0.75` (72 pitch, 44/116 anchors, 1.0 band, 102.x boxes) and `q = 0.4` values are **superseded**.

## Source Art Mapping

| Family | Source elements | Split | Anchors | Pitch | Ring radius | Source stroke |
|--------|-----------------|-------|---------|-------|-------------|---------------|
| Off-delay | 12 (paths, lines, circles) | `NCTC` = 0–5; `NOTO` = 6–11 | ≈`(32, 48.5)` / `(128, 48.5)` | 96 | 10.19 | 4.375 |
| Level | 6 (paths, circles) | NO = path + 2 circles (0–2); NC = path + circle + path-circle (3–5) | ≈`(35, 48.5)` / `(125, 48.5)` | 90 | 10.24 | 4.375 |

Both families keep the pair midpoint at x=80. Off-delay `NCTC` ring y is exactly 48.5 projected; `NOTO` y centers differ by about ±0.037 around 48.5. Level y centers differ by about ±0.007 around 48.5. The geometry tests use these tolerances and assert the midpoint.

### Scale semantics

Generated `art.scale` is approximately 0.800–0.804. Multiplied by `OUTPUT_PROJECTION_SCALE = 1.25`, the projected source scale is approximately **1.0**, so source ring and stroke dimensions carry through nearly 1:1 into the 128×64 symbol viewBox (before the 160×84 logical stage projection). "Source-local scale ~1.0" in the accepted summary refers to this projected result.

## Tight Bounds

| Type | State | Left | Top | Right | Bottom | Width × Height |
|------|-------|------|-----|-------|--------|----------------|
| `NCTC` | closed | 21.8125 | 37.5625 | 138.1875 | 92.9335 | **116.375 × 55.371** |
| `NOTO` | open | 21.809209 | 38.272697 | 138.190791 | 108.428352 | **≈116.382 × 70.156** |
| `LEVEL_SWITCH_NO` | open | 24.763593 | 38.257062 | 135.236407 | 127.996405 | **110.473 × 89.739** |
| `LEVEL_SWITCH_NC` | closed | 24.764188 | 38.251364 | 135.233719 | 117.265260 | **110.470 × 79.014** |

Display boxes equal these tight bounds and are rotated for rotations 0–3. The "State" column shows the default state for each type; the actual level display follows `isClosed`, and off-delay display follows the active contact state. Saved logical `x/y` remains the component origin; `getComponentLogicalStageOffset` returns the inverse bounds offset for the fixed logical stage.

## Dynamic Hit / Label Bounds

| Type | Hit/label body | Terminal rings | Label behavior |
|------|----------------|----------------|----------------|
| `NOTO` / `NCTC` | Union of open and closed generated tight-art rectangles | Ring circles at terminal centers with radius `max(ringRadii)` = 10.19 | Label placed outside the union bounds with the fixed gap; no stale scaled shape table |
| `LEVEL_SWITCH_NO` / `LEVEL_SWITCH_NC` | Active-state generated tight-art rectangle | Ring circles at terminal centers with radius `max(ringRadii)` = 10.24 | Label follows the active state's bounds |

This bypasses the previous scaled HITBOX shapes for these four types. Off-delay hit bounds are intentionally the union so both contact appearances are covered. Level hit/label bounds change with `isClosed`.

## Terminal Ring Radii

| Type | Generated radii | Hit radius used for both terminals |
|------|-----------------|------------------------------------|
| `NCTC` | 10.1875, 10.1875 | 10.1875 |
| `NOTO` | 10.190791, 10.190791 | 10.190791 |
| `LEVEL_SWITCH_NO` | 10.236407, 10.236407 | 10.236407 |
| `LEVEL_SWITCH_NC` | 10.235813, 10.233719 | 10.235813 |

## Stroke Weight

| Check | Result |
|-------|--------|
| Source `stroke-width` | 4.375 (off-delay lines/circles, level circles/ring path); emitted group `strokeWidth` is 0 with per-element widths |
| Projected stroke | ≈4.38 component-local units |
| Uniform 1.0 band | **Not used** for the replacement art; it belonged to the superseded q=.75 implementation |
| Older glyphs | No added outline; unchanged |
| Body fill paths | `fill="currentColor"`, `stroke="none"` |
| White rings | `fill="#ffffff"`, `stroke="currentColor"` (circles and the NC path-circle) |
| Lines | `fill="none"`, `stroke="currentColor"` |

## Palette Preview Status

The existing component-bar renderer path (`componentPalettePanel` → `renderSymbolGraphic` plus the shared CSS) is unchanged and still applies one shared component-local scale. However, the previously recorded preview dimensions were measured on the superseded `q = 0.75` art:

| Preview | Prior approximate value | Current status |
|---------|--------------------------|----------------|
| Off-delay | 27 × 17.5 | **Superseded**; not re-measured after replacement SVGs |
| Level switch | ≈27 × 18–20 | **Superseded**; not re-measured after replacement SVGs |
| XIC reference | 39.6 × 13.75 | Historical reference; not part of current art change |
| NCTO reference | 30.80 × 13.06 | Unchanged reference symbol |

No fresh palette measurement or screenshot was captured after the replacement SVGs. The shared scale itself is unchanged.

## Selector (Explicitly Unchanged)

`SELECTOR_3POS` was not resized and its measurements are unchanged:

| Measurement | Value |
|-------------|-------|
| Ring | 12.11 × 10.46 |
| Line | 2.08 × 1.79 |
| Pitch | 54 |

## Verification Results

| Check | Result |
|-------|--------|
| UI suite | 36 files / 1352 tests passed |
| plc-engine suite | 2 files / 14 tests passed |
| Targeted geometry suite | 339 tests passed (`alignment` 282, `component-display-bounds` 10, `hitboxes` 40, `offDelayLevelArt` 7) |
| TypeScript | 23 errors; baseline 23; no new errors |
| Workspace build | OK |
| Source element counts | Off-delay 12 → NCTC 6 / NOTO 6; level 6 → NO 3 / NC 3 |
| Anchors / pitch | Off-delay ≈32/128, 96; level ≈35/125, 90 |
| Tight bounds | Off-delay 116.375×55.371 / ≈116.382×70.156; level 110.473×89.739 / 110.470×79.014 |
| Ring radii | 10.19 off-delay; 10.24 level; max used for both terminals |
| Dynamic bounds | Generated tight-art rectangle; off-delay union, level active state |
| Selector measurements | Unchanged |
| Selector pointer evidence | Rotations 0–3 stopped and running checks recorded in `e2e-selector-level-q04.json`; selector is unchanged, so the matrix remains applicable |
| Level-switch pointer evidence | Recorded in `e2e-selector-level-q04.json` at the earlier geometry; behavior path unchanged |
| Resized terminal wire start | Recorded in `e2e-selector-level-q04.json` at `q = 0.4`; not re-captured for the replacement art |

## Evidence Status

Timestamps are from the workspace file system. The replacement SVGs were written at **11:22 PM (level)** and **11:47 PM (off-delay)**; the current generator/generated art were written around **11:50–11:51 PM**. Every existing PNG/JSON evidence file predates the replacement art.

| Evidence | Status | Why |
|----------|--------|-----|
| `verification/ncto-norm-gallery.png` | **Stale** | 10:36 PM; predates the 11:22/11:47 PM replacement SVGs and the 11:50 PM regeneration. Do not cite as current. |
| `verification/palette-preview-gallery.png` | **Stale** | 9:50 PM; predates both the final q=.75 state and the replacement SVGs. Do not cite as current. |
| `verification/selector-options.png` | **Stale / pre-replacement** | 9:39 PM; the selector itself is unchanged, but the image predates the replacement SVGs and was not re-captured. |
| `verification/component-measurements-thin.json` | **Historical (q = 0.75 thin art)** | 10:45 PM; records the prior 72-pitch / 1.0-band geometry, not the replacement art. |
| `verification/component-measurements-q04.json` | **Historical (q = 0.4)** | 10:11 PM; contains 58.x boxes and the older 4.38-band measurements. |
| `verification/e2e-selector-level-q04.json` | **Historical (q = 0.4)** | 10:11 PM; pointer evidence from the earlier geometry. Selector portion remains applicable; terminal/level portions are not current-geometry evidence. |

All images and JSON above are historical only. Re-capture them if a current visual or measurement artifact is required.

## Limitations / Deferred Items

- **Attached JSON still unavailable.** The attached file was not present in the workspace and was not verified. This limitation is not a pass claim.
- **Load migration deferred.** Interrupted `sceneLoad` / `applySceneState` endpoint-migration work exists in the dirty worktree, but it is outside this task's allowed list and the user chose "decide later". It is not part of Phase 1 acceptance.
- **No current visual evidence.** No browser/gallery capture was made after the replacement SVGs.
- **No current palette per-tile measurement.** Prior preview dimensions are superseded rather than re-measured.
- **Pointer evidence is partly historical.** Selector pointer checks remain applicable because the selector is unchanged; the resized terminal and level-toggle captures are from the `q = 0.4` era.
- Browser pointer evidence is a manual CDP smoke, not an automated E2E framework.
- `docs/modules/ui.md` was not touched (pre-existing malformed/modified file).

## Status

- Phase 1: **completed** (accepted replacement element art at 96/90 pitch, 10.19/10.24 ring radii, 4.375 source strokes, dynamic bounds).
- Phase 2: **completed** (verification/evidence only; no palette code changed). All visual/measurement artifacts are stale and are not claimed as current.
