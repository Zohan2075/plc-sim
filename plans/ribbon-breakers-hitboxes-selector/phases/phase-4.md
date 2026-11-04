---
type: planning
entity: phase
plan: "ribbon-breakers-hitboxes-selector"
phase: 4
status: completed
created: "2026-11-04"
updated: "2026-11-04"
---

# Phase 4: Ribbon + layout

> Part of [Ribbon, breakers, hitboxes/labels, selector zones](../plan.md)

## Objective

Remove permanent side panels; add a Word-style top menu/ribbon, component list, status bar, and full-width canvas.

## Scope

### Includes

- File/Home/Insert/Simulation/View/contextual Component tabs.
- All existing controls mapped; read-only statuses in a status bar.
- Collapse ribbon to tabs; narrow-width group dropdowns.
- Component list directly below ribbon.
- Canvas fills remaining space; ResizeObserver-aware screen→model conversion.
- Tests/probes for drop alignment at 3 sizes and pan/zoom.

### Excludes

- New features not present in the audit (export/share, scan-rate editor, grid/snap toggles).

## Prerequisites

- [x] Phases 1–3 complete.

## Deliverables

- [x] Ribbon shell and mapping.
- [x] Contextual tab and inspector controls.
- [x] Canvas resize/coordinate changes.
- [x] Responsive/collapse behavior.

## Acceptance Criteria

- [x] Zero controls lost vs audit.
- [x] Canvas size before/after printed.
- [x] Drop lands under cursor error <1 model unit at 3 sizes and after pan/zoom.
- [x] Collapsed/narrow ribbon works.
- [x] Context menu labels/submenus still work.
