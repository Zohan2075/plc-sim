---
type: planning
entity: todo
plan: "component-size-normalization"
updated: "2026-11-06"
---

# Todo: Component size normalization

> Tracking [component-size-normalization](plan.md)

## Active Phase: None - plan completed

### Phase Context

- **Final accepted implementation**: replacement reference SVGs ingested as element art. Off-delay 96 pitch / anchors ≈32–128 / ring 10.19 / source stroke 4.375; level 90 pitch / anchors ≈35–125 / ring 10.24 / source stroke 4.375. Dynamic generated bounds drive display/hit/label geometry.
- **Superseded**: the prior `q = 0.75` off-delay/level values (72 pitch, 44/116 anchors, 1.0 band, 102.x boxes, 15.26/12.09/15.09 ring hit radii) and the older `q = 0.4` values.
- **Phase 1 record**: [Phase 1](phases/phase-1.md) and [Phase 1 verification](verification/phase-1.md) (completed)
- **Phase 2 record**: [Phase 2](phases/phase-2.md) and [Phase 2 implementation plan](implementation/phase-2-impl.md) (verification/evidence only, completed)
- **Relevant Docs**: `docs/vector-symbol-pipeline.md`, `docs/symbol-catalog.md`, `plans/off-delay-level-switch/plan.md`; `docs/modules/ui.md` is malformed in the existing worktree and must not be overwritten without permission.

### Pending

- None.

### In Progress

- None.

### Completed

- [x] Ingested replacement off-delay SVG as 12 elements: `NCTC` = 0–5, `NOTO` = 6–11, preserving source path/line/circle geometry and order. <!-- completed: 2026-11-06 -->
- [x] Ingested replacement level SVG as 6 elements: NO = path + 2 circles, NC = path + circle + path-circle. <!-- completed: 2026-11-06 -->
- [x] Mapped off-delay rings to NCTO anchors ≈(32,48.5)/(128,48.5), pitch 96, midpoint (80,48.5), ring radius 10.19, source stroke 4.375. <!-- completed: 2026-11-06 -->
- [x] Mapped level rings to anchors ≈(35,48.5)/(125,48.5), pitch 90, midpoint (80,48.5), ring radius 10.24, source stroke 4.375. <!-- completed: 2026-11-06 -->
- [x] Tight bounds: NCTC 116.375×55.371, NOTO ≈116.382×70.156, level NO 110.473×89.739, level NC 110.470×79.014. <!-- completed: 2026-11-06 -->
- [x] Renderer handles generated `path`, `circle`, and `line` elements with per-element fill/stroke/strokeWidth; under-discs use generated centers/radius. <!-- completed: 2026-11-06 -->
- [x] Hitboxes use dynamic generated tight-art rectangle + terminal ring circles with maximum ring radius; labels use dynamic bounds. <!-- completed: 2026-11-06 -->
- [x] Off-delay hit/label bounds union open/closed states; level display/hit/label bounds are state-aware. <!-- completed: 2026-11-06 -->
- [x] Selector unchanged: ring 12.11×10.46, line 2.08×1.79, pitch 54. <!-- completed: 2026-11-06 -->
- [x] Verified the existing palette path still shares one component-local scale; no palette code change. Prior preview dimensions are superseded and no new per-tile measurement was captured. <!-- completed: 2026-11-06 -->
- [x] Full UI suite 36 files/1352 tests, plc-engine 2 files/14 tests, `tsc` 23 vs baseline 23, build OK; targeted geometry suite 339 tests. <!-- completed: 2026-11-06 -->
- [x] Marked prior `q = 0.75` values superseded and all pre-replacement PNG/JSON evidence stale. <!-- completed: 2026-11-06 -->
- [x] Created/updated `verification/phase-1.md` with current numbers and evidence status. <!-- completed: 2026-11-06 -->
- [x] Author, verify, and review Phase 1 implementation plan; final replacement-art decisions recorded. <!-- completed: 2026-11-06 -->
- [x] Measure all 25 component types at 100% zoom; 23 palette tiles were audited before the replacement SVGs, and palette dimensions were not re-measured after them. <!-- completed: 2026-11-06 -->
- [x] Capture pre-replacement component/palette and NCTO-normalized option renders (historical; now stale). <!-- completed: 2026-11-05 -->
- [x] User selected NCTO as the size norm and confirmed selector remains unchanged. <!-- completed: 2026-11-05 -->
- [x] User supplied replacement off-delay/level reference SVGs; final element-art mapping accepted. <!-- completed: 2026-11-06 -->

### Blocked

- [ ] Exact attached JSON verification. <!-- blocked: 2026-11-06, reason: file is not present in the workspace -->

### Deferred

- [ ] Load-time wire-endpoint migration (`sceneLoad` / `applySceneState` policy). Interrupted work exists in the dirty worktree, but it is outside this task's allowed list; user chose "decide later". Not part of acceptance. <!-- deferred: 2026-11-05 -->

## Changelog

### 2026-11-06

- **Latest accepted revision:** replacement reference SVGs. Off-delay NCTC 0–5 / NOTO 6–11 at 96 pitch, anchors ≈32/128, ring 10.19; level NO/NC at 90 pitch, anchors ≈35/125, ring 10.24; both use 4.375 source strokes and projected scale ≈1.0.
- Tight bounds recorded: NCTC 116.375×55.371, NOTO ≈116.382×70.156, level NO 110.473×89.739, level NC 110.470×79.014.
- Renderer supports generated `path`/`circle`/`line`; dynamic bounds drive hit areas and labels, with max-ring-radius terminal circles; level bounds are state-aware.
- Tests: UI 36 files/1352, plc-engine 2/14, `tsc` 23 vs baseline 23, build OK, targeted 339.
- Superseded: prior `q = 0.75` (72 pitch, 44/116 anchors, 1.0 band, 102.x boxes, 15.26/12.09/15.09 ring radii) and all older `q = 0.4` values. All pre-replacement PNG/JSON evidence is stale.

### 2026-11-05

- Plan created with the initial nearest-grid 36-unit pitch; documented the accepted tight-width tradeoff.
- Revised: NCTO is the size norm. Historical implementation used `q = 0.4`, 38.4-unit local pitch (2.133 cells, not whole-grid), 4.38 ring/line. **Superseded.**
- Phase 1 completed and verified at the `q = 0.4` stage; Phase 2 reduced to verification/evidence because the existing palette renderer already shares one component-local scale. Historical targeted result: 342 tests.
- Load migration recorded as deferred, not acceptance. Selector/terminal pointer E2E remains recorded as completed for the earlier geometry.
- Prior accepted revision (superseded 2026-11-06): `q = 0.75`, 72-unit (4-cell) pitch, thin 1.0 band; boxes ~102.6×65.0 / 102.2×76.5 / 102.2×67.8; anchors (44,48.5)/(116,48.5); ring hit radius max-of-both. Targeted 338 tests.
- Evidence note at that time: gallery PNGs predated the final code change and were stale; `-q04` JSON artifacts were historical.
