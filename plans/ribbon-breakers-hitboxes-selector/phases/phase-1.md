---
type: planning
entity: phase
plan: "ribbon-breakers-hitboxes-selector"
phase: 1
status: completed
created: "2026-11-04"
updated: "2026-11-04"
---

# Phase 1: Breakers + isOperable

> Part of [Ribbon, breakers, hitboxes/labels, selector zones](../plan.md)

## Objective

Make BREAKER_1P and BREAKER_2P permanently closed, non-operable circuit components and introduce the single `isOperable` table.

## Scope

### Includes

- Unconditional breaker conduction.
- Remove breaker state toggle/write, inspector operate button, and click operation.
- Canonicalize breaker `isClosed:true` on parse/save.
- `isOperable` table and consumers.
- Tests for conduction, no-op operation, old JSON.

### Excludes

- Other component behavior changes.
- Art changes.

## Prerequisites

- [x] Audit complete.

## Deliverables

- [x] Breaker conduction through the normal contact path.
- [x] `isOperable` table and printed output.
- [x] Updated tests.

## Acceptance Criteria

- [x] Breaker is always closed stopped/running/restarted.
- [x] Click/double-click do not change state/undo/dirty.
- [x] Source → breaker → lamp works after stop/start.
- [x] Old `isClosed:false` loads as closed and is counted/reported.

## Dependencies

| Phase | Relationship | Notes |
|---|---|---|
| 2,3,4 | parallel after table | `isOperable` consumed by click/menu/hit code |
