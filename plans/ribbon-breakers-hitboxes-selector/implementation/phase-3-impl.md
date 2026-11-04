---
type: planning
entity: implementation-plan
plan: "ribbon-breakers-hitboxes-selector"
phase: 3
status: completed
created: "2026-11-04"
updated: "2026-11-04"
---

# Phase 3 Implementation Plan: Tight hit shapes + close labels

> Part of [Ribbon, breakers, hitboxes/labels, selector zones](../plan.md)
> Phase scope: [Phase 3](../phases/phase-3.md)

## Goal

Replace the full 160x136 pointer box with art-derived local hit shapes, enlarge terminal hit zones to the ring radius + padding, make empty old-box corners fall through to wires/canvas, and place labels a fixed gap from the rotated tight art bounds without overlapping art/terminals/wires.

## Ground Truth

- Component box: `160 x 136`; glyph area `160 x 102`; symbol viewport `160 x 84` with `SYMBOL_VIEWPORT_TOP = 9` (`DiagramBuilder.tsx:291-300`).
- Art is authored in `128 x 64`, `128 x 60`, `128 x 72`, or the selector's `160 x 102` space. `projectSymbolPoint` maps symbol coords into component-local coords (`1316-1334`).
- Terminal anchors come from `getTerminalDefinitions` (`1365-1530`); terminal ports are currently 18x18 buttons at `z-index: 2`.
- Current glyph hit area: `.freeplay-component__glyph-handle` with `getComponentGlyphHitboxStyle` (`4180-4215`), a W x H transparent div covering the old box. The component div itself has `pointer-events: none`; only children are hit.
- Current label row: `getComponentLabelRowStyle` (`4152-4164`) uses fixed bottom offsets from the component box, not tight art bounds.
- Current spawn avoidance: `getNextComponentSpawnPoint` (`5577-5640`) uses full `COMPONENT_WIDTH x COMPONENT_HEIGHT` rects. Drag/move has no collision check.
- Debug flags: `?debugTerminals=1` (`5278-5283`); selector zones already draw under it.
- Target verification types: XIC, PUSH_BUTTON_NO, ESTOP, BREAKER_1P/BREAKER_2P, LAMP, NOTC/NCTO (timer), SELECTOR_3POS. Cover all palette types in the table.

## Design

### 1. Hit shape data

Keep the table in `DiagramBuilder.tsx` after `getTerminalDefinitions` and outside `renderSymbolGraphic`, so it can use `projectSymbolPoint` and `getTerminalDefinitions` without a runtime import cycle.

```ts
type HitShape =
  | { kind: "rect"; x: number; y: number; width: number; height: number }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "polygon"; points: Point[] };

interface HitShapeTableEntry {
  body: HitShape[];
  leads: HitShape[];
}

const HITBOX_PADDING = 4;
const HITBOX_COARSE_PADDING = 8;
const HITBOX_SPACING = 6;
const LABEL_GAP = 8;

const HITBOXES: Record<BuilderComponentType, HitShapeTableEntry> = { ... };
```

Build shape coordinates from the art literals already in `renderSymbolGraphic`, projected through `projectSymbolPoint`:

- `symbolRect(x, y, w, h, viewBoxHeight)` projects both corners.
- `symbolCircle(cx, cy, r, viewBoxHeight)` projects the center and scales the radius by the same projection scale.
- Use the exact art values:
  - XIC/XIO: body bars around `(54..74, 10..54)` in 128x64; leads `(6.4..54, y=32)` and `(74..121.6, y=32)`.
  - NOTC/NCTO: terminal circles at `(25.6,30)`/`(102.4,30)` r=6.4 in 128x64; body bars `(52..76, 12..54)`; lead/body bridge `(25.6..102.4, y=30)`.
  - PUSH_BUTTON_NO: body `(36..92, 6..46)` in 128x72; terminal circles `(34,36)/(94,36)` r=5.5; leads `(6..28, y=36)` and `(100..122, y=36)`.
  - PUSH_BUTTON_NC: body `(26..102, 6..50)` in 128x72; terminal circles `(34,30)/(94,30)` r=5.5; leads `(6..28, y=36)` and `(100..122, y=36)`.
  - ESTOP: central mushroom body `(36..92, 4..64)` in 128x72; leads from the anchors `(8..48, y=51)` and `(112..152, y=51)` in local component coords.
  - OL_CONTACT: body bars `(52..76, 12..56)` in 128x72; slash/contact area `(44..84, 14..54)`; leads `(2.3..54, y=36)` and `(74..125.7, y=36)`.
  - BREAKER_1P: body arc `(34..94, 8..32)` in 128x64 plus visible circles `(34,32)/(94,32)` r=5.5; leads `(6..28, y=32)` and `(100..122, y=32)`.
  - BREAKER_2P: body arcs `(34..94, -6..20)` and `(34..94, 38..64)` in 128x64 plus linkage `(62..66, -6..30.8)`; leads at `y=3.2`/`y=46.4` from `6.4..28.4` and `99.6..121.6`.
  - SWITCH_1P / LIMIT_SWITCH_NO / LIMIT_SWITCH_NC: body `(24..104, 16..64)` in 128x64; leads `(6.4..28.4, y=32)` and `(99.6..121.6, y=32)`.
  - LAMP: body circle `(64,32)` r=17.28 in 128x64; leads `(6.4..46.72, y=32)` and `(81.28..121.6, y=32)`.
  - MOTOR: body circle `(64,32)` r=22 in 128x64; leads `(6.4..38, y=32)` and `(90..121.6, y=32)`.
  - POWER_SOURCE: body `(30..98, 18..64)` in 128x64; leads `(6.4..48, y=32)` and `(80..121.6, y=32)`.
  - DC_SOURCE: body circle `(64,30)` r=20 in 128x60; leads `(6..42, y=30)` and `(86..122, y=30)`.
  - OTE/OTL/OTU: body circle `(64,30)` r=20 in 128x60; leads `(6.4..44, y=30)` and `(84..121.6, y=30)`.
  - SELECTOR_3POS: body rect `{x:18,y:4,width:124,height:94}` in local 160x102 coords; no separate leads (rings/body cover the panel).

### 2. Terminal hit radius

```ts
const TERMINAL_RING_RADIUS: Record<BuilderComponentType, number> = {
  POWER_SOURCE: 9.25,
  DC_SOURCE: 8,
  BREAKER_1P: 6.875,
  BREAKER_2P: 6.875,
  SWITCH_1P: 7,
  LIMIT_SWITCH_NO: 7,
  LIMIT_SWITCH_NC: 7,
  OL_CONTACT: 6.875,
  PUSH_BUTTON_NO: 6.875,
  PUSH_BUTTON_NC: 6.875,
  ESTOP: 7,
  SELECTOR_3POS: 12.11,
  LAMP: 6.875,
  MOTOR: 6.875,
  XIC: 6.875,
  XIO: 6.875,
  NOTC: 8,
  NCTO: 8,
  OTE: 6.875,
  OTL: 6.875,
  OTU: 6.875
};
```

- For `SELECTOR_3POS`, use the max `outerX/outerY` for that terminal across states from `SELECTOR_3POS_RING_RADII` instead of the fallback constant.
- `getTerminalHitRadius(type, terminalId, coarse)` returns `ringRadius + (coarse ? HITBOX_COARSE_PADDING : HITBOX_PADDING)`.
- Port buttons get inline `width`/`height` = `2 * getTerminalHitRadius(...)` and keep `transform: translate(-50%, -50%)`; this makes the ring hit zone `radius + padding`. Anchors, positions, and wire behavior stay unchanged.

### 3. Hit testing and tight bounds

Export:

```ts
export function getComponentHitShapes(
  component: BuilderComponent,
  coarse?: boolean
): { body: HitShape[]; leads: HitShape[]; rings: HitShape[]; padding: number };
export function hitTestComponentPoint(
  component: BuilderComponent,
  componentLocalPoint: Point,
  coarse?: boolean
): "terminal" | "component" | null;
export function getComponentHitBounds(component: BuilderComponent): {
  left: number; top: number; right: number; bottom: number; width: number; height: number;
};
```

- `hitTestComponentPoint` inverse-rotates the point around `(80,51)`, tests terminal circles first (`"terminal"`), then body/leads with padding (`"component"`), otherwise `null`.
- `getComponentHitBounds` unions the body/leads/rings tight geometry (no padding), rotates the four corners around `(80,51)`, and returns axis-aligned bounds in component-local coords.
- Keep the old `getComponentGlyphHitboxStyle` only as a fallback for non-component visuals; it must no longer define the interactive hit area.

### 4. Interactive overlay

- Change `.freeplay-component__glyph-handle` to `pointer-events: none` and remove its manual cursor semantics.
- Render an SVG overlay inside `.freeplay-component__symbol-rotator`, after `renderSymbolGraphic`:
  ```tsx
  <svg
    className="freeplay-component__hit-shapes"
    viewBox="0 0 160 102"
    aria-hidden="true"
    style={{ position: "absolute", inset: 0, width: 160, height: 102, pointerEvents: "none" }}
  >
    {body/leads shapes -> <rect|circle|polygon fill="transparent" stroke="transparent" strokeWidth={padding * 2} pointerEvents="all" />}
    {ring shapes -> outline circles with pointerEvents="none" only when debug}
  </svg>
  ```
- The overlay root is non-interactive; only body/lead shapes catch pointer events. Empty corners fall through to wires/canvas.
- CSS:
  ```css
  .freeplay-component__hit-shape { cursor: grab; }
  .freeplay-component--manual .freeplay-component__hit-shape { cursor: pointer; }
  .freeplay-component--selector-ring-hover .freeplay-component__hit-shape { cursor: default; }
  .freeplay-component:hover .freeplay-component__symbol-rotator { opacity: 0.98; }
  ```
  Remove the old `.glyph-handle--manual:hover ~ ...` dependency.
- Terminal ports stay `z-index: 2` above the overlay and now cover the full ring radius + padding, preserving terminal priority.

### 5. Labels

Replace `getComponentLabelRowStyle` with:

```ts
export function getComponentLabelLayout(component: BuilderComponent): CSSProperties
```

- `const bounds = getComponentHitBounds(component)`.
- Normalized rotation 1/3: place the label to the **right** of `bounds.right + LABEL_GAP`, vertically centered on `(bounds.top + bounds.bottom)/2`, horizontal text, `left`, `top`, `right:auto`, `bottom:auto`, `transform: "translateY(-50%)"`, `width: "max-content"`, `justifyContent: "flex-start"`.
- Rotation 0/2: place the label **below** `bounds.bottom + LABEL_GAP`, centered on `(bounds.left + bounds.right)/2`, `left`, `top`, `right:auto`, `bottom:auto`, `transform: "translateX(-50%)"`, `width: "max-content"`, `justifyContent: "center"`.
- This avoids the top/bottom terminals of rotated XIC/timer/breaker and the left/right terminals of unrotated components.
- The label row keeps `pointer-events: auto`; its click/double-click selection/rename path is untouched. The label text remains horizontal and scales with the canvas zoom.
- Update the JSX to call `getComponentLabelLayout(component)`.

### 6. Spawn spacing

- Replace full `COMPONENT_WIDTH/HEIGHT` occupied rects in `getNextComponentSpawnPoint` with `getComponentHitBounds(component)` + `HITBOX_SPACING`:
  ```ts
  const bounds = getComponentHitBounds(component);
  { left: component.x + bounds.left - HITBOX_SPACING, right: component.x + bounds.right + HITBOX_SPACING, top: ..., bottom: ... }
  ```
- Keep the same candidate grid/steps and snap-by-terminal behavior. No collision check on manual drag/drop exists, so none is added.

### 7. Debug overlay

- Add a `showHitboxDebug` flag from `?debugHitboxes=1` (also true when `?debugTerminals=1` for convenience).
- When enabled:
  - draw body/lead shapes with translucent fill and dashed stroke;
  - draw ring circles;
  - draw the tight bounds rect and the label row bounds with dashed outlines.
- Keep the existing selector zone debug and terminal crosshair debug intact.

## Tests

1. New `ui/src/diagram/hitboxes.spec.ts`
   - For XIC, PUSH_BUTTON_NO, ESTOP, BREAKER_1P, BREAKER_2P, LAMP, NOTC, SELECTOR_3POS:
     - body point -> `"component"` at rotations 0..3;
     - terminal anchor point -> `"terminal"` at rotations 0..3;
     - old-box empty corner -> `null`;
     - point 1 unit outside the padded body -> `null`;
     - terminal ring radius + padding > ring radius.
   - Print the hit matrix (type x rotation x point kind).
   - Assert `getComponentHitBounds` is smaller than the old 160x136 box for XIC, LAMP, NOTC and within it for all types.
2. New label assertions in the same or a separate `labels.spec.ts`
   - For XIC, PUSH_BUTTON_NO, ESTOP, BREAKER_1P, LAMP, NOTC, SELECTOR_3POS at rotations 0..3:
     - `getComponentLabelLayout` places the row exactly `LABEL_GAP` from the rotated tight bounds (below for 0/2, right for 1/3);
     - the label rect does not intersect the tight art bounds;
     - the label rect does not contain any terminal anchor for the checked types;
     - print the gap per type/rotation.
3. Spawn test
   - `getComponentHitBounds` for side-by-side XIC/LAMP is narrower than `COMPONENT_WIDTH`, proving spawn spacing is tight.
4. Existing tests
   - Update any test that asserted the old glyph handle dimensions or label bottom offsets.
   - Full suite, tsc 25 baseline, build.

## Guardrails

- No glyph art, ring centers/radii, terminal anchors, router, wireRoute, or stored wire points.
- No change to terminal snap distance, anchor positions, or wire start/end logic.
- Do not remove the label selection/rename path.
- Do not commit.

## Acceptance

- Body hits, terminal hits, empty-corner fall-through, and just-outside misses match the matrix at rotations 0..3.
- Port hit radius = ring outer radius + padding; terminal priority remains.
- Labels sit exactly `LABEL_GAP` from rotated tight bounds, horizontal, no art/terminal overlap.
- Spawn spacing uses tight bounds.
- Debug flag draws hit shapes, rings, tight bounds, and label bounds.
- Full suite, tsc 25 baseline, build OK.
