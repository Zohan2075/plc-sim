---
type: planning
entity: phase
plan: "ribbon-breakers-hitboxes-selector"
phase: 3
status: completed
created: "2026-11-04"
updated: "2026-11-04"
---

# Phase 3: Hitboxes + labels

> Part of [Ribbon, breakers, hitboxes/labels, selector zones](../plan.md)

## Objective

Replace the full-box pointer area with art-derived hit shapes and position labels from tight rotated bounds.

## Scope

### Includes

- `HITBOXES` table: rects/circles/polygons in local coordinates.
- Shape overlay replacing the glyph handle; rotation with art.
- Label anchors from tight bounds + fixed gap.
- Debug hitbox/label overlay.
- Spawn overlap based on tight bounds.

### Excludes

- Art, anchors, routing, wire data.

## Prerequisites

- [x] Phase 1 table; selector geometry from phase 2.

## Deliverables

- [x] Hit overlay and label placement.
- [x] Debug overlay.
- [x] Containment/label tests.

## Acceptance Criteria

- [x] Body/terminal/empty-corner/outside matrix passes for target types.
- [x] Labels have fixed gap at rotations 0..3 and no art overlap.
- [x] Wires/canvas receive empty-corner clicks.
- [x] Selector/tall and timer/wide label cases pass.
