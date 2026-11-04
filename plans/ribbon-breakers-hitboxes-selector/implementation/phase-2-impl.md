---
type: planning
entity: implementation-plan
plan: "ribbon-breakers-hitboxes-selector"
phase: 2
status: completed
created: "2026-11-04"
updated: "2026-11-04"
---

# Phase 2 Implementation Plan: SELECTOR_3POS zones

> Part of [Ribbon, breakers, hitboxes/labels, selector zones](../plan.md)
> Phase scope: [Phase 2](../phases/phase-2.md)

## Goal

Replace the SELECTOR_3POS click cycle with direct top/middle/bottom zone selection in the component's local art space, while keeping terminal ring priority, drag behavior, and the Position submenu.

## Ground Truth

- Ring centers: `in1/out1` at `(53,24)/(107,24)`, `in2/out2` at `(53,78)/(107,78)` (`selector3posArt.generated.ts`).
- Art box: `160 x 102`, rotation center `(80,51)` (`COMPONENT_WIDTH`, `COMPONENT_GLYPH_HEIGHT`).
- Current click cycle: `getNextSelectorPosition` (`DiagramBuilder.tsx:690`), `selectorDirectionRef` (`4359`), `toggleComponentOperate` selector branch (`7138-7152`).
- Current pointer operation: `shouldOperateComponentFromPointer` now uses `isOperable`, selector mode `"position"`.
- Current hover: `.freeplay-component__glyph-handle--manual` pointer cursor plus `:hover ~ .symbol-rotator` opacity.
- Ports are 18x18 buttons at ring centers, `z-index: 2`; glyph handle is `z-index: 1`.
- Component drag threshold is 6 px (`COMPONENT_DRAG_THRESHOLD`); `componentDragMovedRef` gates click operation.
- `applySelectorPosition` currently always writes and never pushes undo (`7161`).

## Zone Geometry

Derived from the row anchors, never hand-typed:

```text
row1Y = SELECTOR_3POS_RING_CENTERS.in1.y = 24
row2Y = SELECTOR_3POS_RING_CENTERS.in2.y = 78
topBoundary = row1Y + (row2Y - row1Y) / 3 = 42
bottomBoundary = row1Y + 2 * (row2Y - row1Y) / 3 = 60

top zone:    local y < 42
middle zone: 42 <= local y < 60
bottom zone: local y >= 60 through art bottom (102)
```

All three zones span the full art width `0..160`. The point is inverse-rotated around `(80,51)` before testing, so the zones rotate with the glyph.

## Design

### 1. New module `ui/src/diagram/selector3posZones.ts`

Type-only import `BuilderComponent`/`Point` from `../DiagramBuilder`; import ring centers/radii from `./selector3posArt.generated`.

Export:

```ts
export const SELECTOR_3POS_ART_WIDTH = 160;
export const SELECTOR_3POS_ART_HEIGHT = 102;
export const SELECTOR_3POS_TOP_ZONE_BOUNDARY = 42;   // derived
export const SELECTOR_3POS_BOTTOM_ZONE_BOUNDARY = 60; // derived
export const SELECTOR_3POS_ZONES = [
  { position: 1, top: 0, height: 42 },
  { position: 2, top: 42, height: 18 },
  { position: 3, top: 60, height: 42 }
] as const;

export function inverseRotateSelector3PosPoint(point: Point, rotation: number): Point;
export function getSelector3PosArtPointFromClientPoint(
  clientPoint: Point,
  componentRect: { left: number; top: number },
  zoom: number,
  rotation: number
): Point | null;
export function isSelector3PosRingPoint(point: Point, padding?: number): boolean;
export function getSelector3PosZoneAtArtPoint(point: Point): 1 | 2 | 3 | null;
export function getSelector3PosZoneAtClientPoint(
  clientPoint: Point,
  componentRect: { left: number; top: number },
  zoom: number,
  rotation: number
): 1 | 2 | 3 | null;
export function applySelector3PosPositionToComponents(
  components: readonly BuilderComponent[],
  componentIds: ReadonlySet<string>,
  position: 1 | 2 | 3
): { changed: boolean; components: BuilderComponent[] };
```

- `inverseRotateSelector3PosPoint` is the exact inverse of `rotatePoint` around `(80,51)`.
- `getSelector3PosZoneAtArtPoint` rejects points outside `0..160 x 0..102`.
- `isSelector3PosRingPoint` uses the maximum generated outer ellipse per terminal across states plus optional padding. It prevents zone clicks/hover on rings.
- `getSelector3PosZoneAtClientPoint` converts screen -> component-local using the live rect and `canvasZoom`, inverse-rotates, rejects ring points, then returns the zone.
- `applySelector3PosPositionToComponents` returns `changed:false` and the original array when no selected selector differs; otherwise maps only selector components.

### 2. DiagramBuilder integration

- Import the zone helpers/constants.
- Add state:
  ```ts
  const [selectorHover, setSelectorHover] = useState<{
    componentId: string;
    overRing: boolean;
    zone: 1 | 2 | 3 | null;
  } | null>(null);
  ```
- Add `updateSelectorHover(component, event)`:
  - only for `SELECTOR_3POS` and non-touch pointers;
  - use `event.currentTarget.getBoundingClientRect()`, `canvasZoomRef.current`, `component.rotation`;
  - set `overRing` from `isSelector3PosRingPoint` and `zone` from `getSelector3PosZoneAtArtPoint` when not over a ring;
  - ignore when `dragState.current` or `componentDragMovedRef.current` is active.
- Add `onPointerMove` to the component div: run the existing drag move, then update selector hover only when not dragging.
- Add `onPointerLeave`: clear hover if it belongs to this component.
- Add class `freeplay-component--selector-ring-hover` when the hover state for this component has `overRing`.
- Render a visual-only zone layer inside `.freeplay-component__glyph`, before `.freeplay-component__symbol-rotator`:
  ```tsx
  {isSelector3PosType(component.type) ? (
    <div
      className="freeplay-selector-zones"
      style={rotation === 0 ? undefined : { transform: `rotate(${rotation * 90}deg)` }}
      aria-hidden="true"
    >
      {SELECTOR_3POS_ZONES.map((zone) => (
        <div
          className={`freeplay-selector-zone ${selectorHover?.componentId === component.id && selectorHover.zone === zone.position ? "freeplay-selector-zone--hover" : ""}`}
          data-selector-position={zone.position}
          key={zone.position}
          style={{ height: zone.height, top: zone.top }}
        />
      ))}
    </div>
  ) : null}
  ```
  The layer is `pointer-events: none`; the existing glyph handle receives pointer events, and port buttons remain above it.
- Click handling in the component `onPointerUp`:
  - after `handleComponentHandlePointerRelease`, if not dragged:
    - for `SELECTOR_3POS`: skip if the event target is inside `.freeplay-port`; compute the zone from `event.currentTarget.getBoundingClientRect()`, `canvasZoomRef.current`, and rotation; if non-null call `applySelectorPosition([component.id], zone)`; never schedule the old toggle cycle;
    - for other operable types: keep `shouldOperateComponentFromPointer` + `scheduleComponentToggle`.
- Remove `getNextSelectorPosition` and `selectorDirectionRef`; remove the selector cycle branch from `toggleComponentOperate` (selector clicks no longer use it).
- `applySelectorPosition`:
  - use `applySelector3PosPositionToComponents(componentsRef.current, ids, position)`;
  - return immediately when `changed` is false (active position -> no state, no undo, no dirty flag);
  - `pushUndoSnapshot()` only when changed;
  - update `componentsRef.current`, `setComponents`, `setHasCustomLayout(true)`.
- Keep the Position submenu and the later Component-tab control wired to `applySelectorPosition`.

### 3. CSS

Add to `ui/src/App.css`:

```css
.freeplay-selector-zones {
  position: absolute;
  left: 0;
  top: 0;
  width: 160px;
  height: 102px;
  transform-origin: 50% 50%;
  pointer-events: none;
  z-index: 1;
}

.freeplay-selector-zone {
  position: absolute;
  left: 0;
  width: 100%;
}

.freeplay-selector-zone--hover {
  background: rgba(37, 99, 235, 0.12);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.35);
}

.freeplay-component--selector-ring-hover .freeplay-component__glyph-handle--manual {
  cursor: default;
}
```

The existing manual hover opacity/pointer cursor stays for the zone area.

### 4. Debug overlay

In `selector3pos.tsx`, when `SELECTOR_DEBUG_ENABLED` (`?debugTerminals=1`), render the three zone rectangles in the SVG:

- top zone `(0,0,160,42)` position 1;
- middle `(0,42,160,18)` position 2;
- bottom `(0,60,160,42)` position 3;
- translucent fills, dashed boundaries, and `1/2/3` labels.

Because the SVG is inside the rotated symbol rotator, the debug zones rotate with the art.

## Tests

1. New `ui/src/diagram/selector3posZones.spec.ts`
   - Assert boundaries are exactly `42` and `60` and derive from the ring centers.
   - Zone map: `(80,20)->1`, `(80,42)->2`, `(80,59.999)->2`, `(80,60)->3`, `(80,101)->3`.
   - Outside art: `(-1,50)`, `(161,50)`, `(80,-1)`, `(80,103)` -> `null`.
   - All 4 rotations: rotate local points with `rotatePoint`, pass through `getSelector3PosZoneAtClientPoint` with a synthetic rect and zoom 1; expect the original zone.
   - All 4 ring centers at all rotations -> `null` (ring priority).
   - `applySelector3PosPositionToComponents`: changes only selector components, returns `changed:false` and same array for the active position.
2. Update `ui/src/diagram/operate.spec.ts`
   - Remove the `getNextSelectorPosition` cycle test/import; momentary and maintained coverage stays.
3. Existing selector tests stay green; update any test that imported the removed cycle helper.

## Guardrails

- No art, ring centers/radii, anchors, router, wireRoute, or stored wire points.
- No new selector position values; only 1/2/3.
- No context-menu redesign in this phase; the existing Position submenu remains.
- Do not commit.

## Acceptance

- Zone boundaries print as `42` / `60`, derived from row anchors.
- A click in each zone sets 1/2/3 directly at rotations 0..3, stopped and running.
- Active position click is a no-op (no undo, no dirty flag).
- Ring click keeps wire priority and does not change position.
- 10 px drag moves the component and does not change position.
- Hover highlights only the zone under the pointer, never a ring.
- `?debugTerminals=1` draws the three zones.
- Full suite, tsc 25 baseline, build OK.
