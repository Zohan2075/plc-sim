---
type: planning
entity: plan
plan: "connection-hitbox-label-fixes"
status: completed
created: "2026-11-05"
updated: "2026-11-05"
---

# Plan: Connection lock, selector drawing, switch/source hitboxes and labels

## Objective

Implement four focused UI fixes without changing glyph art, ring positions, terminal anchors, the router, or stored wire points:

1. No wire creation of any kind while the simulator is running, with one `canEditConnections` flag and explicit terminal feedback.
2. SELECTOR_3POS draws no zone/hit rectangles in normal use; debug-only overlays remain; zone click logic is unchanged.
3. Tight art-derived hit shape and label anchor for the single switch (`SWITCH_1P`).
4. Tight art-derived hit shape and label anchor for the AC source (`POWER_SOURCE`), with before/after evidence.

## Guardrails

- Do not modify glyph path data, ring centers/radii, terminal anchors, `wireRoute.ts`, `wireTopology.ts`, `grid.ts`, or saved wire points.
- One screen→model conversion stays in `getCanvasPointFromClient`.
- No new editing feature; moving/deleting while running stays exactly as today.
- No commit or push.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Connection lock flag, terminal feedback toast, run-start cancellation, ribbon/context gating, regression test | completed |
| 2 | Selector invisible interaction layer + debug-only drawing, SWITCH_1P/POWER_SOURCE hit shapes, art-derived label bounds, tests | completed |
| 3 | Browser hit/label matrices, before/after overlay, hashes, full suite/tsc/build | completed |

## Definition of Done

- While running, terminal pointerdown, terminal finish, and endpoint re-attach create 0 wires, 0 undo entries, 0 dirty flags.
- Starting a wire then pressing Run/F5 leaves no draft, no reconnect target, no undo entry; Stop restores wire creation without reload.
- Terminal cursor is `not-allowed`, no ready hover ring, and one non-stacking toast per pointerdown attempt.
- Operating, panning, zooming work while running; move/delete behavior is unchanged and documented.
- SELECTOR_3POS normal render exposes zero visible zone/hit rectangles; debug shows them; zone clicks still map 1/2/3 at rotations 0..3.
- SWITCH_1P and POWER_SOURCE hit shapes follow body/leads/rings with padding; old-box corners fall through; terminal anchors keep priority.
- Labels for SWITCH_1P, POWER_SOURCE and XIC sit `LABEL_GAP` from tight art bounds at rotations 0..3 (error < 0.5).
- Glyph hashes, terminal anchors, router files and stored wire points identical to HEAD.
- Full suite, tsc at baseline (25), build OK.

## Verification

- Targeted: 3 files / 62 tests. Full UI: 32 files / 1127 tests. plc-engine: 7 tests.
- tsc: 25 errors (baseline 25). `pnpm -r build`: OK.
- Running wire attempts: 1 wire before/after, 0 drafts, Undo remained disabled; toast exactly `Stop the simulation to create wires`, count 1 and unchanged after pointer move.
- Run-start with draft: draft 1 -> 0; wires 0; Undo disabled; Stop then wire creation restored (0 -> 1).
- Selector normal: 0 zone elements, 0 art rects, 0 hit-shape rects, 0 debug bounds; 4 invisible hitareas.
- Selector debug: 0 zone divs, 3 zone rects per selector, 1 debug body outline, 1 debug bounds.
- SWITCH_1P/SOURCE hit matrix: body=component, terminal=terminal, old corner=canvas, outside=canvas at rotations 0..3.
- Label gaps: source 8.20, switch 7.99-8.00, XIC 8.00 (max deviation 0.21).
- Areas: source empty 5426 -> 4561, non-hittable art 338 -> 0; switch closed empty 7111 -> 1191, non-hittable 0; switch open empty 1382, non-hittable 0.
- Glyph hash identical; terminal anchors identical; `selector3posArt.generated.ts`, `wireRoute.ts`, `wireTopology.ts`, `grid.ts` unchanged; snapshot has no view fields.

## Changelog

### 2026-11-05

- Plan created from the four requested changes and measured before-state.
- Implementation and verification completed; no commit.
