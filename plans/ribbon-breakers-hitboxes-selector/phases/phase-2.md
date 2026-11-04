---
type: planning
entity: phase
plan: "ribbon-breakers-hitboxes-selector"
phase: 2
status: completed
created: "2026-11-04"
updated: "2026-11-04"
---

# Phase 2: SELECTOR_3POS zones

> Part of [Ribbon, breakers, hitboxes/labels, selector zones](../plan.md)

## Objective

Replace the selector click cycle with direct top/middle/bottom zone selection in local art space.

## Scope

### Includes

- Zone resolver: y < 34 → 1; 34 ≤ y < 68 → 2; y ≥ 68 → 3.
- Rotation-aware pointer→art conversion around (80,51).
- Direct position set, active-position no-op, no undo/dirty.
- Zone hover highlight/pointer, ring priority, drag threshold.
- Debug zone overlay.

### Excludes

- Art/ring/anchor changes.
- Context menu Position removal.

## Prerequisites

- [x] Phase 1 table available.

## Deliverables

- [x] Zone helper + tests.
- [x] Click/hover behavior.
- [x] Debug overlay.

## Acceptance Criteria

- [x] Zones set 1/2/3 at rotations 0..3, stopped/running.
- [x] Ring click starts a wire and does not change position.
- [x] 10px drag moves without changing position.
- [x] Position submenu/contextual control still works.
