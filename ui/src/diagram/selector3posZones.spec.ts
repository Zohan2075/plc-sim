import { describe, expect, it } from "vitest";
import { rotatePoint } from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType } from "../DiagramBuilder";
import { SELECTOR_3POS_RING_CENTERS } from "./selector3posArt.generated";
import {
  SELECTOR_3POS_ART_HEIGHT,
  SELECTOR_3POS_ART_WIDTH,
  SELECTOR_3POS_BOTTOM_ZONE_BOUNDARY,
  SELECTOR_3POS_TOP_ZONE_BOUNDARY,
  SELECTOR_3POS_ZONES,
  applySelector3PosPositionToComponents,
  getSelector3PosZoneAtArtPoint,
  getSelector3PosZoneAtClientPoint
} from "./selector3posZones";

const COMPONENT_RECT = { left: 137.5, top: 91.25 };
const ZOOM = 1.37;
let sequence = 0;

function component(
  type: BuilderComponentType,
  overrides: Partial<BuilderComponent> = {}
): BuilderComponent {
  sequence += 1;

  return {
    id: `selector-zone-${sequence}`,
    label: type,
    rotation: 0,
    tag: null,
    type,
    usesCustomLabel: false,
    x: 100,
    y: 100,
    ...overrides
  };
}

function clientPointForArtPoint(point: { x: number; y: number }, rotation: number) {
  const rotatedPoint = rotatePoint(point, rotation);

  return {
    x: COMPONENT_RECT.left + rotatedPoint.x * ZOOM,
    y: COMPONENT_RECT.top + rotatedPoint.y * ZOOM
  };
}

describe("SELECTOR_3POS zones", () => {
  it("derives the three zone boundaries from the generated row anchors", () => {
    const row1Y = SELECTOR_3POS_RING_CENTERS.in1.y;
    const row2Y = SELECTOR_3POS_RING_CENTERS.in2.y;

    expect(SELECTOR_3POS_TOP_ZONE_BOUNDARY).toBe(row1Y + (row2Y - row1Y) / 3);
    expect(SELECTOR_3POS_BOTTOM_ZONE_BOUNDARY).toBe(row1Y + (2 * (row2Y - row1Y)) / 3);
    expect(SELECTOR_3POS_TOP_ZONE_BOUNDARY).toBe(42);
    expect(SELECTOR_3POS_BOTTOM_ZONE_BOUNDARY).toBe(60);
    expect(SELECTOR_3POS_ZONES).toEqual([
      { height: 42, position: 1, top: 0 },
      { height: 18, position: 2, top: 42 },
      { height: 42, position: 3, top: 60 }
    ]);

    console.log(
      `SELECTOR_3POS zones: top=${SELECTOR_3POS_TOP_ZONE_BOUNDARY} middle=${SELECTOR_3POS_BOTTOM_ZONE_BOUNDARY} artWidth=${SELECTOR_3POS_ART_WIDTH} artHeight=${SELECTOR_3POS_ART_HEIGHT}`
    );
  });

  it("maps art points to top, middle, and bottom zones", () => {
    expect(getSelector3PosZoneAtArtPoint({ x: 80, y: 20 })).toBe(1);
    expect(getSelector3PosZoneAtArtPoint({ x: 80, y: 42 })).toBe(2);
    expect(getSelector3PosZoneAtArtPoint({ x: 80, y: 59.999 })).toBe(2);
    expect(getSelector3PosZoneAtArtPoint({ x: 80, y: 60 })).toBe(3);
    expect(getSelector3PosZoneAtArtPoint({ x: 80, y: 101 })).toBe(3);
  });

  it("rejects points outside the selector art box", () => {
    for (const point of [
      { x: -1, y: 50 },
      { x: 161, y: 50 },
      { x: 80, y: -1 },
      { x: 80, y: 103 }
    ]) {
      expect(getSelector3PosZoneAtArtPoint(point)).toBeNull();
    }
  });

  it("resolves the same zone at all four rotations through screen conversion", () => {
    const samples = [
      { expected: 1 as const, point: { x: 80, y: 10 } },
      { expected: 2 as const, point: { x: 80, y: 51 } },
      { expected: 3 as const, point: { x: 80, y: 90 } }
    ];

    for (const rotation of [0, 1, 2, 3]) {
      for (const sample of samples) {
        const clientPoint = clientPointForArtPoint(sample.point, rotation);

        expect(getSelector3PosZoneAtClientPoint(clientPoint, COMPONENT_RECT, ZOOM, rotation))
          .toBe(sample.expected);
      }
    }
  });

  it("keeps ring priority at every rotation", () => {
    for (const rotation of [0, 1, 2, 3]) {
      for (const ringId of ["in1", "out1", "in2", "out2"] as const) {
        const clientPoint = clientPointForArtPoint(SELECTOR_3POS_RING_CENTERS[ringId], rotation);

        expect(getSelector3PosZoneAtClientPoint(clientPoint, COMPONENT_RECT, ZOOM, rotation))
          .toBeNull();
      }
    }
  });

  it("changes only selectors whose position differs and treats the active position as a no-op", () => {
    const activeSelector = component("SELECTOR_3POS", { selectorPosition: 2 });
    const bottomSelector = component("SELECTOR_3POS", { selectorPosition: 1 });
    const defaultSelector = component("SELECTOR_3POS");
    const lamp = component("LAMP");

    const components = [activeSelector, bottomSelector, defaultSelector, lamp];
    const result = applySelector3PosPositionToComponents(
      components,
      new Set([activeSelector.id, bottomSelector.id, defaultSelector.id, lamp.id]),
      2
    );

    expect(result.changed).toBe(true);
    expect(result.components[0]).toBe(activeSelector);
    expect(result.components[1]).toMatchObject({ id: bottomSelector.id, selectorPosition: 2 });
    expect(result.components[2]).toBe(defaultSelector);
    expect(result.components[3]).toBe(lamp);
    expect(bottomSelector.selectorPosition).toBe(1);

    const noOpComponents = [activeSelector, defaultSelector];
    const noOp = applySelector3PosPositionToComponents(
      noOpComponents,
      new Set([activeSelector.id, defaultSelector.id]),
      2
    );

    expect(noOp.changed).toBe(false);
    expect(noOp.components).toBe(noOpComponents);
    expect(noOp.components[0]).toBe(activeSelector);
    expect(noOp.components[1]).toBe(defaultSelector);
  });
});
