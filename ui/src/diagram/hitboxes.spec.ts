import { describe, expect, it } from "vitest";
import {
  COMPONENT_HEIGHT,
  COMPONENT_WIDTH,
  getComponentHitBounds,
  getComponentHitShapes,
  getComponentLabelBounds,
  getComponentLabelLayout,
  getTerminalDefinitions,
  getTerminalHitRadius,
  getTerminalRingRadius,
  HITBOX_COARSE_PADDING,
  HITBOX_PADDING,
  HITBOX_SPACING,
  hitTestComponentPoint,
  LABEL_GAP,
  rotatePoint
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType, Point } from "../DiagramBuilder";

const ALL_TYPES: BuilderComponentType[] = [
  "POWER_SOURCE",
  "DC_SOURCE",
  "BREAKER_1P",
  "BREAKER_2P",
  "FUSE",
  "SWITCH_1P",
  "PUSH_BUTTON_NO",
  "PUSH_BUTTON_NC",
  "ESTOP",
  "SELECTOR_3POS",
  "LIMIT_SWITCH_NO",
  "LIMIT_SWITCH_NC",
  "LEVEL_SWITCH_NO",
  "LEVEL_SWITCH_NC",
  "TEMPERATURE_SWITCH",
  "FLOW_SWITCH",
  "PRESSURE_SWITCH",
  "OL_CONTACT",
  "LAMP",
  "MOTOR",
  "XIC",
  "XIO",
  "NOTC",
  "NCTO",
  "NOTO",
  "NCTC",
  "OTE",
  "OTL",
  "OTU"
];

type TargetType =
  | "XIC"
  | "PUSH_BUTTON_NO"
  | "ESTOP"
  | "BREAKER_1P"
  | "BREAKER_2P"
  | "FUSE"
  | "LAMP"
  | "NOTC"
  | "NOTO"
  | "NCTC"
  | "LEVEL_SWITCH_NO"
  | "LEVEL_SWITCH_NC"
  | "TEMPERATURE_SWITCH"
  | "FLOW_SWITCH"
  | "PRESSURE_SWITCH"
  | "SELECTOR_3POS"
  | "SWITCH_1P"
  | "POWER_SOURCE";

const TARGET_TYPES: TargetType[] = [
  "XIC",
  "PUSH_BUTTON_NO",
  "ESTOP",
  "BREAKER_1P",
  "BREAKER_2P",
  "FUSE",
  "LAMP",
  "NOTC",
  "NOTO",
  "NCTC",
  "LEVEL_SWITCH_NO",
  "LEVEL_SWITCH_NC",
  "TEMPERATURE_SWITCH",
  "FLOW_SWITCH",
  "PRESSURE_SWITCH",
  "SELECTOR_3POS",
  "SWITCH_1P",
  "POWER_SOURCE"
];

const BODY_POINTS: Record<TargetType, Point> = {
  XIC: { x: 80, y: 51 },
  PUSH_BUTTON_NO: { x: 80, y: 40 },
  ESTOP: { x: 80, y: 51 },
  BREAKER_1P: { x: 80, y: 40 },
  BREAKER_2P: { x: 80, y: 75 },
  FUSE: { x: 80, y: 48.5 },
  LAMP: { x: 80, y: 51 },
  NOTC: { x: 80, y: 50 },
  NOTO: { x: 80, y: 50 },
  NCTC: { x: 80, y: 50 },
  LEVEL_SWITCH_NO: { x: 80, y: 94.79 },
  LEVEL_SWITCH_NC: { x: 86.88, y: 85.9 },
  TEMPERATURE_SWITCH: { x: 80, y: 80 },
  FLOW_SWITCH: { x: 80, y: 80 },
  PRESSURE_SWITCH: { x: 80, y: 80 },
  SELECTOR_3POS: { x: 80, y: 51 },
  SWITCH_1P: { x: 80, y: 37.4 },
  POWER_SOURCE: { x: 80, y: 51 }
};

const OLD_BOX_CORNERS: Partial<Record<TargetType, Point[]>> = {
  SWITCH_1P: [
    { x: 30, y: 31 },
    { x: 130, y: 31 },
    { x: 30, y: 91 },
    { x: 130, y: 91 }
  ],
  POWER_SOURCE: [
    { x: 37.5, y: 33.5 },
    { x: 122.5, y: 33.5 },
    { x: 37.5, y: 91 },
    { x: 122.5, y: 91 }
  ]
};

const EMPTY_CORNER: Point = { x: 4, y: 130 };
const LABEL_PROBE_WIDTH = 80;
const LABEL_PROBE_HEIGHT = 22;

let sequence = 0;

function component(type: BuilderComponentType, rotation = 0): BuilderComponent {
  sequence += 1;

  return {
    id: `hitbox-fixture-${sequence}`,
    label: type,
    rotation,
    tag: null,
    type,
    usesCustomLabel: false,
    x: 100,
    y: 100
  };
}

function rotatedPoint(point: Point, rotation: number): Point {
  return rotatePoint(point, rotation);
}

function pointJustOutsideBounds(
  bounds: { bottom: number; left: number; right: number; top: number },
  rotation: number
): Point {
  // The label sits below for 0/2 and to the right for 1/3, so probe the
  // opposite side just outside the padded hit area.
  const clearance = HITBOX_PADDING + 1;
  return rotation === 1 || rotation === 3
    ? { x: bounds.left - clearance, y: (bounds.top + bounds.bottom) / 2 }
    : { x: (bounds.left + bounds.right) / 2, y: bounds.top - clearance };
}

describe("HITBOXES table and tight bounds", () => {
  it("covers every component type with shapes and one ring per terminal", () => {
    for (const type of ALL_TYPES) {
      const shapes = getComponentHitShapes(component(type));

      expect(shapes.body.length + shapes.leads.length).toBeGreaterThan(0);
      expect(shapes.rings).toHaveLength(getTerminalDefinitions(type).length);
      expect(shapes.padding).toBe(HITBOX_PADDING);
    }
  });

  it("keeps rotation-0 tight bounds within the old box plus terminal padding overhang", () => {
    for (const type of ALL_TYPES) {
      const bounds = getComponentHitBounds(component(type));

      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
      expect(bounds.left).toBeGreaterThanOrEqual(-HITBOX_PADDING);
      expect(bounds.right).toBeLessThanOrEqual(COMPONENT_WIDTH + HITBOX_PADDING);
      expect(bounds.top).toBeGreaterThanOrEqual(-HITBOX_PADDING);
      expect(bounds.bottom).toBeLessThanOrEqual(COMPONENT_HEIGHT + HITBOX_PADDING);
    }
  });

  it("is materially smaller than the old 160 x 136 box for XIC, LAMP and NOTC", () => {
    for (const type of ["XIC", "LAMP", "NOTC"] as const) {
      const bounds = getComponentHitBounds(component(type));

      expect(bounds.width * bounds.height).toBeLessThan(COMPONENT_WIDTH * COMPONENT_HEIGHT);
    }
  });

  it("keeps the new art-derived hitboxes materially smaller than the old box", () => {
    for (const type of ["NOTO", "NCTC", "LEVEL_SWITCH_NO", "LEVEL_SWITCH_NC"] as const) {
      const bounds = getComponentHitBounds(component(type));

      expect(bounds.width * bounds.height).toBeLessThan(COMPONENT_WIDTH * COMPONENT_HEIGHT * 0.7);
    }
  });

  it("NCTC hit bounds contain the NOTO open-bar endpoint", () => {
    const nctc = component("NCTC");
    const bounds = getComponentHitBounds(nctc);
    const endpoint = { x: 123.33826, y: 73.28408 };

    expect(endpoint.x).toBeGreaterThanOrEqual(bounds.left);
    expect(endpoint.x).toBeLessThanOrEqual(bounds.right);
    expect(endpoint.y).toBeGreaterThanOrEqual(bounds.top);
    expect(endpoint.y).toBeLessThanOrEqual(bounds.bottom);
    expect(hitTestComponentPoint(nctc, endpoint)).toBe("component");
  });

  it("uses art-derived tight bounds for SWITCH_1P and POWER_SOURCE", () => {
    for (const type of ["SWITCH_1P", "POWER_SOURCE"] as const) {
      const bounds = getComponentHitBounds(component(type));

      expect(bounds.width * bounds.height).toBeLessThan(COMPONENT_WIDTH * COMPONENT_HEIGHT * 0.7);
    }
  });

  it("derives switch and source body shapes from the glyph art", () => {
    const sourceShapes = getComponentHitShapes(component("POWER_SOURCE"));
    const openSwitchShapes = getComponentHitShapes(component("SWITCH_1P"));
    const closedSwitchShapes = getComponentHitShapes({
      ...component("SWITCH_1P"),
      isClosed: true
    });

    expect(sourceShapes.body.some((shape) => shape.kind === "circle")).toBe(true);

    expect(openSwitchShapes.body.filter((shape) => shape.kind === "circle")).toHaveLength(2);
    expect(closedSwitchShapes.body.filter((shape) => shape.kind === "circle")).toHaveLength(2);
    expect(openSwitchShapes.body.some((shape) => shape.kind === "polygon")).toBe(true);
    expect(closedSwitchShapes.body.some((shape) => shape.kind === "polygon")).toBe(true);

    const openPolygon = openSwitchShapes.body.find((shape) => shape.kind === "polygon");
    const closedPolygon = closedSwitchShapes.body.find((shape) => shape.kind === "polygon");

    expect(openPolygon).not.toEqual(closedPolygon);
  });
});

describe("hit matrix", () => {
  for (const type of TARGET_TYPES) {
    it(`${type}: body/terminal/empty-corner/outside matrix at rotations 0..3`, () => {
      const base = component(type);

      for (const rotation of [0, 1, 2, 3]) {
        const current = { ...base, rotation };
        const bodyPoint = rotatedPoint(BODY_POINTS[type], rotation);
        const cornerPoint = EMPTY_CORNER;
        const outsidePoint = pointJustOutsideBounds(getComponentHitBounds(current), rotation);
        const bodyResult = hitTestComponentPoint(current, bodyPoint);
        const cornerResult = hitTestComponentPoint(current, cornerPoint);
        const outsideResult = hitTestComponentPoint(current, outsidePoint);
        const terminalResults = getTerminalDefinitions(type).map((terminal) => ({
          id: terminal.id,
          result: hitTestComponentPoint(
            current,
            rotatedPoint({ x: terminal.x, y: terminal.y }, rotation)
          )
        }));

        console.log(
          `${type} rot${rotation}: body=${bodyResult} corner=${cornerResult} outside=${outsideResult} `
          + `terminals=${terminalResults.map((entry) => `${entry.id}:${entry.result}`).join(",")}`
        );

        expect(bodyResult).toBe("component");
        expect(cornerResult).toBeNull();
        expect(outsideResult).toBeNull();

        for (const terminal of terminalResults) {
          expect(terminal.result).toBe("terminal");
        }
      }
    });
  }

  it("adds ring padding to every terminal hit radius", () => {
    for (const type of TARGET_TYPES) {
      for (const terminal of getTerminalDefinitions(type)) {
        const fine = getTerminalHitRadius(type, terminal.id, false);
        const coarse = getTerminalHitRadius(type, terminal.id, true);

        expect(fine).toBeCloseTo(getTerminalRingRadius(type, terminal.id) + HITBOX_PADDING, 6);
        expect(coarse).toBeCloseTo(fine + HITBOX_COARSE_PADDING - HITBOX_PADDING, 6);
        expect(fine).toBeGreaterThan(getTerminalRingRadius(type, terminal.id));
        expect(coarse).toBeGreaterThan(fine);
      }
    }
  });

  it("lets the old switch/source rectangle corners fall through at rotations 0..3", () => {
    for (const [type, corners] of Object.entries(OLD_BOX_CORNERS) as Array<[TargetType, Point[]]>) {
      const base = component(type);

      for (const rotation of [0, 1, 2, 3]) {
        const current = { ...base, rotation };

        for (const corner of corners) {
          expect(hitTestComponentPoint(current, rotatedPoint(corner, rotation))).toBeNull();
        }
      }
    }
  });
});

describe("label layout", () => {
  for (const type of TARGET_TYPES) {
    it(`${type}: fixed gap from rotated tight bounds at rotations 0..3`, () => {
      const base = component(type);

      for (const rotation of [0, 1, 2, 3]) {
        const current = { ...base, rotation };
        const bounds = getComponentLabelBounds(current);
        const layout = getComponentLabelLayout(current);
        const left = Number(layout.left);
        const top = Number(layout.top);
        const normalizedRotation = ((rotation % 4) + 4) % 4;
        const vertical = normalizedRotation === 1 || normalizedRotation === 3;

        expect(layout.padding).toBe(0);
        expect(layout.width).toBe("max-content");
        expect(String(layout.transform)).not.toContain("rotate");

        if (vertical) {
          expect(left - bounds.right).toBeCloseTo(LABEL_GAP, 6);
          expect(top).toBeCloseTo((bounds.top + bounds.bottom) / 2, 6);
        } else {
          expect(top - bounds.bottom).toBeCloseTo(LABEL_GAP, 6);
          expect(left).toBeCloseTo((bounds.left + bounds.right) / 2, 6);
        }

        const labelRect = vertical
          ? {
            bottom: top + LABEL_PROBE_HEIGHT / 2,
            left,
            right: left + LABEL_PROBE_WIDTH,
            top: top - LABEL_PROBE_HEIGHT / 2
          }
          : {
            bottom: top + LABEL_PROBE_HEIGHT,
            left: left - LABEL_PROBE_WIDTH / 2,
            right: left + LABEL_PROBE_WIDTH / 2,
            top
          };
        const overlapsArt = labelRect.left < bounds.right
          && labelRect.right > bounds.left
          && labelRect.top < bounds.bottom
          && labelRect.bottom > bounds.top;

        expect(overlapsArt).toBe(false);

        for (const terminal of getTerminalDefinitions(type)) {
          const terminalPoint = rotatedPoint({ x: terminal.x, y: terminal.y }, rotation);
          const insideLabel = terminalPoint.x > labelRect.left
            && terminalPoint.x < labelRect.right
            && terminalPoint.y > labelRect.top
            && terminalPoint.y < labelRect.bottom;

          expect(insideLabel).toBe(false);
        }

        console.log(
          `${type} rot${rotation}: gap=${LABEL_GAP} layout=(${left.toFixed(1)},${top.toFixed(1)}) `
          + `bounds=(${bounds.left.toFixed(1)},${bounds.top.toFixed(1)},${bounds.right.toFixed(1)},${bounds.bottom.toFixed(1)})`
        );
      }
    });
  }

  it("level switches follow the toggled art for hit and label bounds", () => {
    for (const type of ["LEVEL_SWITCH_NO", "LEVEL_SWITCH_NC"] as const) {
      const open = { ...component(type), isClosed: false };
      const closed = { ...open, isClosed: true };
      const openBounds = getComponentHitBounds(open);
      const closedBounds = getComponentHitBounds(closed);

      expect(openBounds).not.toEqual(closedBounds);
      expect(getComponentLabelLayout(open).top).not.toBe(getComponentLabelLayout(closed).top);
      expect(hitTestComponentPoint(open, { x: 80, y: 94.79 })).toBe("component");
      expect(hitTestComponentPoint(closed, { x: 86.88, y: 85.9 })).toBe("component");

      for (const rotation of [0, 1, 2, 3]) {
        for (const current of [{ ...open, rotation }, { ...closed, rotation }]) {
          const labelBounds = getComponentLabelBounds(current);
          const layout = getComponentLabelLayout(current);
          const left = Number(layout.left);
          const top = Number(layout.top);
          const vertical = rotation === 1 || rotation === 3;

          if (vertical) {
            expect(left - labelBounds.right).toBeCloseTo(LABEL_GAP, 6);
          } else {
            expect(top - labelBounds.bottom).toBeCloseTo(LABEL_GAP, 6);
          }
        }
      }
    }
  });

  it("SWITCH_1P closed label follows the closed art and keeps the fixed gap", () => {
    const open = component("SWITCH_1P");
    const closed = { ...component("SWITCH_1P"), isClosed: true };
    const openBounds = getComponentLabelBounds(open);
    const closedBounds = getComponentLabelBounds(closed);

    expect(openBounds.top).toBeLessThan(closedBounds.top);

    for (const fixture of [open, closed] as const) {
      for (const rotation of [0, 1, 2, 3]) {
        const current = { ...fixture, rotation };
        const bounds = getComponentLabelBounds(current);
        const layout = getComponentLabelLayout(current);
        const left = Number(layout.left);
        const top = Number(layout.top);
        const vertical = rotation === 1 || rotation === 3;

        if (vertical) {
          expect(left - bounds.right).toBeCloseTo(LABEL_GAP, 6);
        } else {
          expect(top - bounds.bottom).toBeCloseTo(LABEL_GAP, 6);
        }
      }
    }
  });
});

describe("spawn spacing", () => {
  it("uses tight bounds instead of the full 160 x 136 box", () => {
    const xic = getComponentHitBounds(component("XIC"));
    const lamp = getComponentHitBounds(component("LAMP"));

    expect(xic.width).toBeLessThan(COMPONENT_WIDTH);
    expect(lamp.width).toBeLessThan(COMPONENT_WIDTH);
    expect(xic.height).toBeLessThan(COMPONENT_HEIGHT);
    expect(HITBOX_SPACING).toBeGreaterThan(0);
  });
});
