---
type: planning
entity: implementation-plan
plan: "ribbon-breakers-hitboxes-selector"
phase: 1
status: completed
created: "2026-11-04"
updated: "2026-11-04"
---

# Phase 1 Implementation Plan: Breakers + isOperable

> Part of [Ribbon, breakers, hitboxes/labels, selector zones](../plan.md)
> Phase scope: [Phase 1](../phases/phase-1.md)

## Goal

Make `BREAKER_1P` and `BREAKER_2P` permanently closed, non-operable circuit components while keeping them in the netlist, and introduce one `isOperable` table consumed by pointer operation, menus, and hit/cursor code.

## Ground Truth

- Breaker types are exactly `BREAKER_1P` and `BREAKER_2P` (`DiagramBuilder.tsx:86`, `451-453`).
- Current breaker state reads: `isBreakerClosed` (`647-649`), `toggleComponentOperateState` (`711-730`), conduction (`855-860`), inspector (`7614`, `7733-7739`), glyph option (`8424`), snapshot parse (`snapshot.ts:385`, `415`).
- Current pointer operation predicate includes breakers (`DiagramBuilder.tsx:7079-7117`).
- Current `manualControl` cursor class includes maintained switches, momentary buttons and selector, not breakers (`8182-8184`).
- Current context menu has no Operate item; the selector Position submenu is gated by `componentType === "SELECTOR_3POS"` (`contextMenu.tsx:246`).
- `createCircuitSnapshot` copies components verbatim (`snapshot.ts:126-137`).
- Repo fixtures: 8 unique breakers, 0 with `isClosed:false`. No user-attached JSON in workspace.

## Design

### 1. New module `ui/src/diagram/operability.ts`

Create a type-only-imported table so `contextMenu.tsx` does not create a runtime cycle with `DiagramBuilder.tsx`.

```ts
import type { BuilderComponentType } from "../DiagramBuilder";

export type ComponentOperability = "toggle" | "momentary" | "position" | "none";

export const isOperable: Record<BuilderComponentType, ComponentOperability> = {
  POWER_SOURCE: "none",
  DC_SOURCE: "none",
  BREAKER_1P: "none",
  BREAKER_2P: "none",
  SWITCH_1P: "toggle",
  PUSH_BUTTON_NO: "momentary",
  PUSH_BUTTON_NC: "momentary",
  ESTOP: "momentary",
  SELECTOR_3POS: "position",
  LIMIT_SWITCH_NO: "toggle",
  LIMIT_SWITCH_NC: "toggle",
  OL_CONTACT: "toggle",
  LAMP: "none",
  MOTOR: "none",
  XIC: "none",
  XIO: "none",
  NOTC: "none",
  NCTO: "none",
  OTE: "none",
  OTL: "none",
  OTU: "none"
};

export function isComponentOperable(type: BuilderComponentType): boolean {
  return isOperable[type] !== "none";
}
```

`isOperable` must be exported and printed verbatim in verification.

### 2. Breaker model

- `isBreakerClosed(component)` returns `true`; ignore `component.isClosed`.
- `getConductiveTerminalPairs` breaker cases return their pairs unconditionally (same conduction path as other contacts):
  - `BREAKER_1P` -> `[["in", "out"]]`
  - `BREAKER_2P` -> `[["in-top", "out-top"], ["in-bottom", "out-bottom"]]`
- `toggleComponentOperateState`:
  - if `isOperable[component.type] !== "toggle"` return the same component object unchanged;
  - then toggle maintained switches as today;
  - no breaker branch.
- `toggleComponentOperate`:
  - if `isOperable[component.type] === "none"` return without selecting/dirtying;
  - selector branch stays (mode `"position"`);
  - maintained branch only when mode `"toggle"`.
- Pointer predicate `shouldOperateComponentFromPointer`:
  - return `isOperable[component.type] === "toggle" || isOperable[component.type] === "position"`.
  - This excludes breakers and momentary buttons (momentary buttons operate through their press target).
- Cursor/hit class `manualControl`: use `isOperable[component.type] !== "none"`.
  - This preserves the pointer cursor for switches, momentary buttons and selector; breakers keep the grab cursor.
- Inspector:
  - State row shows `Closed` for breakers (or `Fixed closed`), never `Open`.
  - Remove breaker from the operate button condition; only maintained switches get the toggle button.
  - Keep breaker rotate, rename, terminal labels, copy, duplicate, delete.
- Glyph call: pass `breakerClosed: true` for breakers (or leave `isBreakerClosed` returning true); do not edit glyph blocks.

### 3. Snapshot canonicalization

In `parseCircuitSnapshotComponent`:
- Parse `isClosed` as today for validation, but for `BREAKER_1P`/`BREAKER_2P` force `isClosed: true` in the returned component regardless of stored value.
- Do not throw on an old `isClosed:false`; ignore it.
- Keep the `isClosed` field present on breaker components so saved shape stays stable.

In `createCircuitSnapshot`:
- For breaker components, emit `isClosed: true`.
- All other component fields and every wire point remain byte-for-byte equivalent.

### 4. Menus

- `contextMenu.tsx` imports `isOperable` from `./operability`.
- Replace the selector type check for the Position submenu with `isOperable[target.componentType] === "position"`.
- Do not add breaker operate items. Breakers have no menu operation entry.
- Lamp Color submenu stays type-gated and unchanged.
- Keep all labels visible; no letter-only items.

## Tests

1. `ui/src/diagram/operability.spec.ts` (new)
   - Assert every breaker type maps to `"none"`.
   - Assert maintained switches map to `"toggle"`, momentary to `"momentary"`, selector to `"position"`.
   - Print the table.

2. `ui/src/diagram/operate.spec.ts`
   - Breaker with `isClosed:false` still reports `isBreakerClosed === true`.
   - `toggleComponentOperateState` returns the same breaker object (no state, no new object).
   - Maintained switch toggling still works.
   - Momentary buttons still operate through press/release.

3. `ui/src/diagram/breaker.spec.ts` (new)
   - Build `POWER_SOURCE -> BREAKER_1P -> LAMP -> source` and `POWER_SOURCE -> BREAKER_2P (top row) -> LAMP -> source`.
   - For `isClosed` false, true, and undefined, assert `computeElectricalState(..., true, {})` lights the lamp and has no fault.
   - Recompute after a simulated stop/restart (call with `running:false` then `true` again) and assert the lamp still lights.
   - Print the breaker count and open-state count from repo fixtures in the test output.

4. `ui/src/diagram/snapshot.spec.ts`
   - Parse a breaker with `isClosed:false` -> `isClosed === true`.
   - Create a snapshot from a breaker `isClosed:false` -> saved component `isClosed === true`.
   - Round-trip keeps every wire point identical.

5. Existing tests
   - Update any test that expected breaker toggling or `Open`.
   - Keep tsc baseline at 25 and all tests green.

## Non-Goals / Guardrails

- No glyph edits, no ring/anchor changes, no router changes, no wire point changes.
- No new breaker type (`BREAKER_2P` already exists).
- No ribbon, hitbox or selector-zone implementation in this phase.
- Do not commit.

## Acceptance

- `isOperable` table exists and is consumed by click, cursor/hit class and menus.
- Breakers always conduct; no pointer operation; no operate button; no menu operate entry.
- Old breaker JSON with `isClosed:false` loads and saves as closed.
- Source -> breaker -> lamp works stopped/running/restarted.
- New and existing tests pass; tsc 25; build OK.
