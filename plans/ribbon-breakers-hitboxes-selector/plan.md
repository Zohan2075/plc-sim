---
type: planning
entity: plan
plan: "ribbon-breakers-hitboxes-selector"
status: completed
created: "2026-11-04"
updated: "2026-11-04"
---

# Plan: Ribbon, breakers, hitboxes/labels, selector zones

## Objective

Implement four UI/behavior changes without touching glyph art, ring positions, terminal anchors, the electrical/router geometry, or stored wire data:

1. Breakers are always-closed, non-operable circuit components.
2. Replace the left/right panels with a Word-style ribbon and component list.
3. Tight, data-driven hit shapes and labels close to the art.
4. SELECTOR_3POS three-zone direct position selection.

## Motivation

The current breaker state is operable and can disconnect the live circuit, the side panels consume canvas width, the full 160×136 box is the pointer area, labels sit at the old box bottom, and the selector click cycle is unintuitive.

## Requirements

### Functional

- [x] BREAKER_1P and BREAKER_2P stay in the netlist, always conduct, and are never operable.
- [x] One `isOperable` component-type table drives click, menus, and hit/cursor code.
- [x] Old breaker `isClosed:false` is ignored; breaker count/open count reported.
- [x] Ribbon contains every existing control or an explicit moved-to path; component list stays under it.
- [x] Canvas uses the remaining space and screen→model conversion follows its rect (ResizeObserver).
- [x] Per-type hit shapes follow art/leads/rings; empty old-box corners fall through to wires/canvas.
- [x] Labels sit a fixed gap from tight rotated art bounds and remain horizontal.
- [x] SELECTOR_3POS top/middle/bottom zones set positions 1/2/3 directly; ports keep wire priority.
- [x] Debug toggle draws hit shapes, label bounds, and selector zones.

### Non-Functional

- [x] No changes to glyph blocks, ring centers/radii, anchors, snapping, wire points, router, or saved wire format.
- [x] Existing tests pass; tsc remains at baseline (25).
- [x] All controls remain reachable at wide and narrow widths.

## Scope

### In Scope

- `ui/src/DiagramBuilder.tsx`, `ui/src/App.css`, `ui/src/diagram/*` (new geometry/hit data, selector helpers, tests).
- Ribbon/layout markup and CSS.
- Breaker state/read paths and snapshot canonicalization.
- Hit/label overlays and debug overlay.
- Selector zone click/hover logic.

### Out of Scope

- New glyph art or vector edits.
- Changing terminal anchor coordinates, ring positions, plane grid, or wire routing/storage.
- New export/share formats or a scan-rate editor that did not exist.

## Definition of Done

- [x] All four changes implemented and verified with the requested matrices/numbers.
- [x] Existing and new regression tests pass.
- [x] Glyph hashes unchanged vs HEAD.
- [x] Ribbon audit mapping has zero lost controls.
- [x] Selector zone boundaries and hit/label matrices printed.

## Testing Strategy

- Unit tests for `isOperable`, breaker canonicalization/conduction, selector zone math, hit shape containment/label anchors.
- DOM/Playwright probes for canvas drop alignment at 3 sizes, pan/zoom, ribbon narrow/collapsed, hit/canvas fall-through.
- Full vitest + tsc + build.

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Breakers + isOperable | Always-closed breaker model, table, menus/click/cursor/tests | completed |
| 2 | Selector zones | Zone math, direct click, hover, debug, port priority | completed |
| 3 | Hitboxes + labels | Shape overlay, rotation, label anchors, debug, spawn bounds | completed |
| 4 | Ribbon + layout | New shell, ribbon tabs/groups, component list, canvas resize/coordinates | completed |
| 5 | Verification | Full matrices, canvas sizes, hashes, suite/tsc/build | completed |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---|---|---|
| Attached breaker JSON not present in workspace | Cannot report its exact open count | Scan workspace; report 0/repo fixtures; ask user if missing |
| Hitbox table must not depend on live SVG measurement | Could drift from art | Derive from existing art constants/terminal definitions; tests assert containment |
| Ribbon narrow-width behavior | Controls could clip | Group dropdown state + CSS wrap; verify 3 window sizes |
| Selector port clicks currently swallow ring-area clicks | Zone clicks near rings | Ports retain priority; zone overlay excludes port circles |
| Label reposition uses tight bounds | Labels may overlap neighboring components | Fixed gap from rotated bounds; debug bounds; tests |

## Changelog

### 2026-11-04

- Plan created from audit; four changes and verification gates recorded.
