---
type: planning
entity: implementation-plan
plan: "connection-hitbox-label-fixes"
phase: 2
status: ready
created: "2026-11-05"
updated: "2026-11-05"
---

# Phase 2: Selector drawing, tight switch/source hitboxes and labels

## Goal

Remove all visible selector zone/hit rectangles in normal use, keep debug overlays, replace the SWITCH_1P and POWER_SOURCE rectangles with art-derived shapes, and place labels at `LABEL_GAP` from tight art bounds.

## Measured before-state (rotation 0, 100%)

- `POWER_SOURCE`: art bbox local `(1.25,13.31)-(158.43,88.69)`; current body rect `(37.5,33.5,85,57.5)`; empty hit area `5426` model-units²; non-hittable art `338`.
- `SWITCH_1P` closed: art bbox `(8.0,42.31)-(152.0,59.68)`; current body rect `(30,31,100,60)`; empty hit area `7111`; non-hittable art `0`.
- Labels: XIC gap `10.5`, source `10.3`, switch `39.3` (row top to art bottom).
- Selector normal: three `.freeplay-selector-zone` divs plus one transparent body rect; hover adds a box-shadow.

## Files

- `ui/src/DiagramBuilder.tsx`
- `ui/src/App.css`
- `ui/src/diagram/hitboxes.spec.ts`
- `ui/src/diagram/selector3pos.spec.ts`

## Design

### 1. Selector normal/debug drawing

- Remove the three `.freeplay-selector-zone` child divs.
- Keep one invisible `.freeplay-selector-hitarea` div, same 160×102 size and rotation as the old zones container, with `pointer-events: auto`, `cursor: pointer`, transparent background/border/box-shadow. It is the only interaction layer; zone math still runs from component pointer coordinates.
- Remove `.freeplay-selector-zone--hover` CSS and the `selectorHoverZone` render usage.
- Add class `freeplay-component--selector` to the selector component.
- For `SELECTOR_3POS`, do not render interactive `ComponentHitOverlay` shapes in normal mode. `ComponentHitOverlay` gets an `interactive` prop; selector passes `interactive={false}` and still renders debug outlines only when `showHitboxDebug`.
- Debug mode keeps `renderSelector3Pos(..., debugZones)` rects and hit outlines; normal mode has zero visible rects/zone boxes.
- Selection: the invisible hitarea has no visual box; remove the selector-only hover box. The existing `freeplay-component--selected` behavior is unchanged.

### 2. SWITCH_1P hit shapes

Add SPST transform constants next to the existing path constants:

```ts
const SPST_SWITCH_VECTOR_TRANSLATE_X = 3.84;
const SPST_SWITCH_VECTOR_TRANSLATE_Y = 7.86;
```

Add local helpers:

```ts
function spstSymbolPoint(x: number, y: number): Point;
function spstCircle(cx: number, cy: number, r: number): HitShape;
function spstLead(x1: number, x2: number, y: number): HitShape;
function thickSegmentPolygon(a: Point, b: Point, halfWidth: number): HitShape;
```

`HITBOXES.SWITCH_1P`:

- body: `spstCircle(121,66,19)`, `spstCircle(209,66,19)`,
  open lever `thickSegmentPolygon(spstSymbolPoint(121,8), spstSymbolPoint(215,69), 2)`,
  closed bar `thickSegmentPolygon(spstSymbolPoint(138.163,69), spstSymbolPoint(215,69), 2)`.
- leads: `spstLead(7,100,66)`, `spstLead(229,322,66)`.

All values come from `SPST_SWITCH_VECTOR_*` constants and path endpoints; no hand-typed local coordinates.

### 3. POWER_SOURCE hit shape

- body: `symbolCircle(64, 32, AC_SOURCE_BODY_RADIUS, 64)` with
  `const AC_SOURCE_BODY_RADIUS = 30.32;` derived from the central-loop bbox
  `(42.5..117, 13.5..88.5)` local.
- leads: keep `symbolLead(6.4,48,32,64)` and `symbolLead(80,121.6,32,64)`; they overlap the body/terminal areas and add no empty outer margin.
- Terminal ports stay at the anchors with `ring radius + padding`; terminal priority is unchanged.

### 4. Art-derived labels

Add a label-shape table:

```ts
const LABEL_ANCHORS: Partial<Record<BuilderComponentType, (component: BuilderComponent) => HitShapeTableEntry>> = {
  POWER_SOURCE: () => POWER_SOURCE label shapes,
  SWITCH_1P: (component) => switch state body (closed bar or open lever) + leads,
  XIC: () => symbolRect(56,12,16,40,64) + exact leads
};
```

- `getComponentLabelShapes(component)` returns the override or `HITBOXES[component.type]`.
- `getComponentLabelBounds(component)` unions body+leads (**no terminal hit rings**), rotates the corners exactly like `getComponentHitBounds`.
- `getComponentLabelLayout` uses `getComponentLabelBounds` instead of `getComponentHitBounds`.
- Switch label bounds use `isMaintainedSwitchClosed(component)` so the closed switch label follows the closed art and the open switch label follows the open lever.
- Keep labels horizontal, right of rotated bounds for rotations 1/3, below for 0/2, with `LABEL_GAP`.

### 5. Tests

- `hitboxes.spec.ts`:
  - SWITCH_1P and POWER_SOURCE body/terminal/old-corner/just-outside matrix at rotations 0..3.
  - Source body contains a circle entry; switch body contains ring circles plus lever polygons.
  - Both tight hit bounds are materially smaller than the old 160×136 box.
  - Label gap test uses `getComponentLabelBounds` for SWITCH_1P (closed and open), POWER_SOURCE and XIC at rotations 0..3; gap = `LABEL_GAP`; no art/terminal overlap.
- `selector3pos.spec.ts`: normal render has zero `<rect>` zone elements; debug render has three zone `<rect>` elements; existing click-position behavior tests stay green.
- Existing tests updated only where they asserted the old switch/source bounds/labels.

## Acceptance

- Selector normal render: 0 visible zone/hit rectangles; debug shows three zones + outlines.
- Selector click zones still return 1/2/3 at rotations 0..3 and ring clicks keep wire priority.
- SWITCH_1P/POWER_SOURCE hit matrix and label gaps match the spec.
- No glyph path, ring, anchor, router or wire-point change.
