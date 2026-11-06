---
type: review
entity: implementation-plan-review
plan: "component-size-normalization"
phase: 1
status: final
reviewer: "general"
created: "2026-11-05"
---

# Implementation Plan Review: Phase 1 - Resize new art and preserve loaded diagrams

> Reviewing [Phase 1 Implementation Plan](../implementation/phase-1-impl.md)
> Against [Phase 1 Scope](../phases/phase-1.md) and [Plan](../plan.md)

> **Historical review (superseded).** This review covers the earlier Phase 1 plan that included
> load-time endpoint migration. Load migration was later deferred by user decision. The final
> accepted implementation now uses the replacement SVG art (off-delay 96 pitch / 10.19 ring,
> level 90 pitch / 10.24 ring, 4.375 source strokes); the intermediate `q = 0.75` / 72-unit /
> 1.0-band values referred to here are also superseded. Current scope and values are in
> [plan.md](../plan.md); do not treat this review's load-migration steps or geometry as active.

## Overall Assessment

**Verdict**: Ready

The updated plan resolves the prior load-origin ambiguity with an explicit prepared-snapshot policy, limits snapshot preparation to the file-load handler, and keeps the default `applySceneState` behavior for program-generated scenes even when they contain resized instruction types. Its parser/bounds work and real-browser checks are sufficiently concrete to implement and verify the gated geometry and load behavior without changing saved format, router behavior, or protected component behavior.

## Scope Alignment

### Findings

- No scope mismatch found. Work remains limited to the four resized types, their generated geometry/rendering, and snapshot-load endpoint handling; palette scaling remains Phase 2. Selector, older component, routing, placement, saved-format, and simulation constraints remain explicit.

## Technical Feasibility

### Findings

- The snapshot-origin policy is now specific and technically appropriate. `handleLoadCircuitChange` prepares snapshot input; the `shouldUsePendingScene` branch reuses that prepared scene; only those snapshot-origin applications skip normalization. The default/program path still clamps and reconciles, independent of component type. This addresses the shared `applySceneState` risk confirmed in the current source.
- The new `sceneLoad` helper separates resized-scene position preservation from legacy normalization for snapshots without resized types. It updates only endpoints resolved from resized-component port IDs and scopes `cleanWirePath` to affected wires, consistent with the existing cleanup helper's endpoint-preserving, non-quantizing behavior.
- The generator/parser and stroke-bound requirements are detailed enough to implement: full token/arity validation, supported command set, cubic extrema, transformed bounds, stroke joins/caps/miter fallback, and loud failure for unsupported syntax. An independent browser-rendered bounds comparison provides a check against the computed geometry.

## Step Quality Assessment

| Step | Title | Concrete? | Actionable? | Issue |
| ---- | ----- | --------- | ----------- | ----- |
| 1 | Generate reduced wrappers and ring-center metadata | Yes | Yes | Parser, transform, path-integrity, and stroke-aware bound requirements are explicit. |
| 2 | Render outlines and under-discs from the resized art | Yes | Yes | Type-scoped styles, ring geometry, and tight-bound use are clearly specified. |
| 3 | Derive only the new types' terminals and interaction geometry | Yes | Yes | The type-only root/frame offsets and affected child layers are enumerated; browser verification is included. |
| 4 | Add endpoint-only preservation to the resized-scene load path | Yes | Yes | Explicit snapshot provenance, one preparation path, pending-scene reuse, and normal program fallback are distinguished. |
| 5 | Extend geometry/integrity tests and add the load fixture | Yes | Yes | Unit, fixture, browser load/pointer, and regression checks have specific assertions and existing DOM surfaces. |

## Required Context Assessment

### Missing Context

- None identified. The plan lists the generator, source SVGs, generated art, rendering/geometry code, CSS, load entry points, snapshot parser, cleanup/topology code, and relevant regression suites.

### Unnecessary Context

- None identified.

## Testing Plan Assessment

The single primary Vitest command exercises the new parser/geometry/load helpers and protected routing/selector regressions. The test matrix also covers all rotations, origins, hit/label geometry, unchanged component coordinates, affected-wire cleanup scope, and byte-identical older-only wire points. The expected outcomes are measurable rather than limited to successful execution.

### Test Integrity Check

Adequate. The plan identifies tests to extend and protected tests to leave unchanged, prohibits weakening existing assertions, preserves path-byte/order checks, and disallows schema changes or test-only DOM instrumentation. It explicitly tests both the snapshot-preservation exception and the normal program-created scene path containing resized types.

### Test Gaps

- None material identified. The direct-file and pending-snapshot cases are covered separately; the browser check observes the pending effect's second application and verifies it does not normalize or move the prepared scene again.

### Real-World Testing

Real-browser integration is planned as a manual Chromium/CDP smoke rather than automated E2E: the current Vitest config uses Node and the UI package has no browser automation dependency. The plan drives the real hidden file input, checks rendered roots/terminal buttons/wire endpoints, and exercises resized and selector pointer interactions using existing labels, ARIA names, and hit areas. This is an appropriate integration check; record browser/version and outcomes as specified.

## Reality Check Validation

### Findings

- The key reality-check anchors match the current source. `applySceneState` currently clamps and reconciles at `DiagramBuilder.tsx:6132-6144`; the effect selects either a pending snapshot or `buildSceneFromProgram` at `6191-6195`; and the direct file handler currently normalizes before applying at `8270-8303`. This confirms why the explicit origin gate and preserved program default are necessary.
- The cited implementation surfaces are present: generated-art ingestion in `scripts/generate-off-delay-level-art.mjs`, old-size anchors/hit geometry in `DiagramBuilder.tsx`, endpoint cleanup in `diagram/grid.ts`, topology reconciliation in `diagram/wireTopology.ts`, and snapshot port-ID parsing in `diagram/snapshot.ts`. The existing file input, component labels, terminal-button ARIA labels, wire SVG, and selector hit area also exist for the proposed CDP smoke.
- The reality check correctly notes that Vitest is Node-only and no browser automation dependency is configured. The manual CDP strategy is therefore a real integration step rather than an asserted automated test. No material stale code anchor or omitted mismatch found.

## Findings Summary

| # | Severity | Area | Finding | Recommendation |
| - | -------- | ---- | ------- | -------------- |
| — | — | — | No material findings. | Proceed with Phase 1 implementation and retain the specified browser acceptance check. |

## Recommendations

1. Proceed to Phase 1 execution. Preserve the explicit snapshot-origin gate and verify the manual Chromium/CDP load-and-pointer smoke, including that the pending effect does not re-normalize the prepared scene.
