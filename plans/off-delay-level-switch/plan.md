---
type: planning
entity: plan
plan: "off-delay-level-switch"
status: completed
created: "2026-11-05"
updated: "2026-11-05"
---

# Plan: Off-delay contacts and liquid level switches

## Objective

Add four additive component types from the two supplied SVG files:

- `NOTO` — off-delay, normally open, timed open.
- `NCTC` — off-delay, normally closed, timed closed.
- `LEVEL_SWITCH_NO` — liquid level switch, normally open.
- `LEVEL_SWITCH_NC` — liquid level switch, normally closed.

No existing glyph, terminal anchor, router, placement code, or on-delay behavior may change.

## Step 0 decisions

| File | Symbol | Rest state | Type |
|---|---|---|---|
| Off delays | A = path 0 | closed | `NCTC` |
| Off delays | B = paths 1+2 | open | `NOTO` |
| Liquid level | A = group 1, paths 0+1 | open | `LEVEL_SWITCH_NO` |
| Liquid level | B = group 2, paths 2-6 | closed | `LEVEL_SWITCH_NC` |

Limit switch is a maintained toggle NO/NC pair (`LIMIT_SWITCH_NO`/`LIMIT_SWITCH_NC`). Level switch uses the same behavior path, not its glyph.

## Scale decisions

- Off-delays: uniform scale matching `NOTC`/`NCTO` terminal pitch and box (Option B). No distortion, no extra outline.
- Level switches: L1, uniform scale, top terminals on the `NOTC`/`NCTO` columns `(32,48.5)/(128,48.5)`, art fits the 160×136 component box.
- Existing anchors printed before building:
  - `NOTC`/`NCTO`: `(32,48.5)` and `(128,48.5)`.
  - `LIMIT_SWITCH_NO` / `XIC`: `(8,51)` and `(152,51)`.
- The 96-unit timer pitch is not a whole multiple of 18. As instructed, the new types use exactly the `NOTC`/`NCTO` local anchors; the primary terminal lands on the grid after snap, the secondary keeps the same +96 offset as the on-delays.

## Guardrails

- Do not modify existing glyph path strings, ring positions, terminal anchors, router geometry, or placement code.
- Do not change on-delay (`NOTC`/`NCTO`) behavior; add new off-delay branches only.
- No visible hit rectangles in normal use; debug overlay only.
- No commit or push.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Art generation, type registration, terminals, palette, render, hitboxes, labels, level-switch behavior | completed |
| 2 | Off-delay timing in ladder-types/engine/UI preview, tests | completed |
| 3 | Browser matrices, art hashes, pixel comparisons, full suite/tsc/build | completed |

## Definition of Done

- Every original path element copied byte-for-byte, in order; per-element hashes match.
- Off-delays and level switches use their own art, never the limit switch glyph.
- Off-delays: immediate actuation, delayed return, delay cancel on re-energize, delay 0/500/3000, reset on stop/start, saved load starts at rest.
- Level switches: same conduction/operate behavior as limit switches, stopped and running.
- New types persist in snapshots; attached JSON loads unchanged.
- Hitbox/label matrix passes at rotations 0..3.
- Existing glyph blocks, anchors, router and wire points unchanged.
- Full suite, tsc baseline (25), build OK.

## Verification

- Art counts: off-delay source 3 paths / generated 3; level source 7 / generated 7; per-element SHA-256 match.
- Gates: UI 33 files / 1332 tests; plc-engine 2 files / 14 tests; tsc 23 (recorded baseline 25, no new errors); `pnpm -r build` OK.
- Off-delay 500 ms timeline: NOTO closes at 0 ms and opens at 1250 ms; NCTC opens at 0 ms and closes at 1250 ms; NOTC/NCTO on-delays unchanged.
- Level conduction: `LEVEL_SWITCH_NO` open=false/closed=true; `LEVEL_SWITCH_NC` open=false/closed=true (rest conducts); identical to limit switches.
- Hit matrix: body=component, terminal=terminal, old corner=outside=null at rotations 0..3 for all four new types.
- Labels: 8 model-unit gap at rotations 0..3; state-aware level labels.
- Context menu: off-delay `Delay (s)` field 1.0 -> 2.5 persisted; level `Close switch` -> badge `Closed`, click -> `Open`.
- Art overlays: `plans/off-delay-level-switch/evidence/overlay-*.png` align reference art exactly on the app render (red tint only).
- Existing glyph case bodies unchanged (only four additive cases); `wireRoute.ts`, `wireTopology.ts`, `grid.ts` unchanged.

## Changelog

### 2026-11-05

- Plan created after Step 0 identification and scale decisions.
- Implementation, corrections, and verification completed; no commit.
