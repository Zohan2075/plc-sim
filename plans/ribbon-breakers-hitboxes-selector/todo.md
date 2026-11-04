---
type: planning
entity: todo
plan: "ribbon-breakers-hitboxes-selector"
updated: "2026-11-04"
---

# Todo: Ribbon, breakers, hitboxes/labels, selector zones

> Tracking [plan](plan.md)

## Status: Completed

### Phase Context

- **Phases**: [1](phases/phase-1.md) · [2](phases/phase-2.md) · [3](phases/phase-3.md) · [4](phases/phase-4.md) · [5](phases/phase-5.md)
- **Implementation plans**: [1](implementation/phase-1-impl.md) · [2](implementation/phase-2-impl.md) · [3](implementation/phase-3-impl.md) · [4](implementation/phase-4-impl.md)
- **Latest Handover**: none
- **Relevant Docs**: `docs/modules/ui.md`, `docs/symbol-catalog.md`

### Completed

- [x] Audit panels, breakers, hitboxes, labels, selector
- [x] Phase 1: always-closed breakers + `isOperable` table + snapshot canonicalization
- [x] Phase 2: SELECTOR_3POS three-zone direct selection, ring priority, hover/debug
- [x] Phase 3: art-derived hit shapes, terminal ring+padding zones, tight labels, spawn bounds
- [x] Phase 4: Word-style ribbon, component list under ribbon, contextual tabs, canvas fill, ResizeObserver
- [x] Phase 5: real browser matrix, canvas/drop/collapse/narrow probes, hashes, suite/tsc/build

### Notes

- The user-attached breaker JSON was not present in the workspace. Repository fixtures contain 8 unique breakers and 0 with `isClosed:false`; the requested count is therefore reported as 0 open / 8 total from fixtures.
- Verification: UI 27 files / 1063 tests, plc-engine 7 tests, tsc 25 baseline, full `pnpm -r build` OK.
- Glyph blocks and terminal anchors are identical to HEAD; selector art data, wireRoute and wireTopology have no diff.

## Changelog

### 2026-11-04

- Plan created; all five phases implemented and verified.
