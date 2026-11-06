---
type: planning
entity: plan
plan: "menus-run-view"
status: completed
created: "2026-11-05"
updated: "2026-11-05"
---

# Plan: Menus, persistent Run, Adobe-style view controls

## Objective

Fix the audited menu/ribbon issues, add a command search and persistent Run cluster, and replace the current wheel/zoom/pan behavior with a single Adobe-style view transform.

## Guardrails

- Do not change glyph art, ring positions, terminal anchors, router geometry, snapping, or stored wire points.
- Saved circuit files must not store the view transform.
- One screen→model conversion at the input layer; no mixed `clientX`/`offsetX` model math.
- Zoom/pan must update the view without re-rendering the diagram tree.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Menu audit fixes, ribbon/context keyboard/touch, command search, persistent Run cluster, F5/Shift+F5 | completed |
| 2 | Adobe-style view transform: wheel pan/zoom, space/middle pan, scrollbars, fit/zoom menu, settings, grid LOD | completed |
| 3 | Browser verification matrix, regression tests, hashes, suite/tsc/build | completed |

## Definition of Done

- Audit table issues fixed; no ribbon/context action lacks a label or tooltip; context menu has icons and multi-select-safe actions.
- Ctrl+K command search runs actions with Enter.
- Run cluster is visible in every tab and collapsed ribbon; F5/Shift+F5/button/group share one handler; stable rects.
- Wheel pan/zoom, shift/ctrl variants, deltaMode 0/1/2, pinch, space/middle pan, fit/100%/zoom menu, 10–800% range, visible scrollbars, grid LOD, persisted mouse-wheel setting.
- One view transform; zoom/pan does not change the diagram render count.
- Drop/hit/wire/label behavior remains correct after zoom/pan.
- Full suite, tsc baseline, build, hashes/anchor checks.
