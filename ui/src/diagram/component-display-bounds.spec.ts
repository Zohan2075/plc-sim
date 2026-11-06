import { describe, expect, it } from "vitest";
import {
  getComponentDisplayBounds,
  getComponentLogicalStageOffset,
  getTerminalDefinitions,
  getTerminalPoint,
  rotatePoint,
  ROTATION_CENTER_X,
  ROTATION_CENTER_Y
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType, Point } from "../DiagramBuilder";
import { OFF_DELAY_ART } from "./offDelayArt.generated";
import { LEVEL_SWITCH_ART } from "./levelSwitchArt.generated";

const RESIZED_TYPES: BuilderComponentType[] = [
  "NOTO",
  "NCTC",
  "LEVEL_SWITCH_NO",
  "LEVEL_SWITCH_NC"
];

function makeComponent(type: BuilderComponentType, x: number, y: number, rotation: number): BuilderComponent {
  return {
    id: `${type}-${x}-${y}-${rotation}`,
    label: type,
    rotation,
    tag: null,
    type,
    usesCustomLabel: false,
    x,
    y
  };
}

function expectedRotatedBounds(bounds: { bottom: number; left: number; right: number; top: number }, rotation: number) {
  const corners = [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom }
  ].map((corner) => rotatePoint(corner, rotation));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);

  return {
    bottom: Math.max(...ys),
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys)
  };
}

describe("resized component display bounds and logical-frame offsets", () => {
  it.each(RESIZED_TYPES)("%s keeps its tight root and every logical child at the saved origin", (type) => {
    const art = type === "NOTO" ? OFF_DELAY_ART.NOTO
      : type === "NCTC" ? OFF_DELAY_ART.NCTC
        : type === "LEVEL_SWITCH_NO" ? LEVEL_SWITCH_ART.LEVEL_SWITCH_NO
          : LEVEL_SWITCH_ART.LEVEL_SWITCH_NO;

    for (const rotation of [0, 1, 2, 3]) {
      for (const [x, y] of [[126, 198], [648, 378]] as const) {
        const component = makeComponent(type, x, y, rotation);
        const before = { x: component.x, y: component.y };
        const bounds = getComponentDisplayBounds(component);
        const expected = expectedRotatedBounds(art.tightBounds, rotation);
        const stageOffset = getComponentLogicalStageOffset(bounds);
        const rootLeft = component.x + bounds.left;
        const rootTop = component.y + bounds.top;
        const stageWorldLeft = rootLeft + stageOffset.left;
        const stageWorldTop = rootTop + stageOffset.top;

        expect(bounds.left).toBeCloseTo(expected.left, 8);
        expect(bounds.top).toBeCloseTo(expected.top, 8);
        expect(bounds.right).toBeCloseTo(expected.right, 8);
        expect(bounds.bottom).toBeCloseTo(expected.bottom, 8);
        expect(bounds.width).toBeCloseTo(expected.right - expected.left, 8);
        expect(bounds.height).toBeCloseTo(expected.bottom - expected.top, 8);
        expect(stageWorldLeft).toBeCloseTo(x, 8);
        expect(stageWorldTop).toBeCloseTo(y, 8);
        expect(component).toMatchObject(before);
      }
    }
  });

  it.each(RESIZED_TYPES)("%s retains its terminal pitch and old world-space pair midpoint", (type) => {
    const isLevelSwitch = type === "LEVEL_SWITCH_NO" || type === "LEVEL_SWITCH_NC";
    const pitch = isLevelSwitch ? 90 : 96;

    for (const rotation of [0, 1, 2, 3]) {
      const component = makeComponent(type, 396, 414, rotation);
      const terminals = getTerminalDefinitions(type);
      const first = getTerminalPoint(component, terminals[0]!.id);
      const second = getTerminalPoint(component, terminals[1]!.id);
      const oldMidpoint: Point = rotatePoint({ x: 80, y: 48.5 }, rotation);

      expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeCloseTo(pitch, 2);
      expect((first.x + second.x) / 2).toBeCloseTo(component.x + oldMidpoint.x, 8);
      expect((first.y + second.y) / 2).toBeCloseTo(component.y + oldMidpoint.y, 8);
    }
  });

  it("uses the active level-switch state bounds without changing its logical frame", () => {
    const open = makeComponent("LEVEL_SWITCH_NO", 342, 324, 0);
    const closed = { ...open, isClosed: true };
    const openBounds = getComponentDisplayBounds(open);
    const closedBounds = getComponentDisplayBounds(closed);

    expect(openBounds).not.toEqual(closedBounds);
    expect(getComponentLogicalStageOffset(openBounds)).toEqual({ left: -openBounds.left, top: -openBounds.top });
    expect(getComponentLogicalStageOffset(closedBounds)).toEqual({ left: -closedBounds.left, top: -closedBounds.top });
  });

  it("does not expose the resized-box helper for selector or older types", () => {
    expect(() => getComponentDisplayBounds(makeComponent("SELECTOR_3POS", 0, 0, 0))).toThrow(/only defined for resized symbols/);
    expect(() => getComponentDisplayBounds(makeComponent("NOTC", 0, 0, 0))).toThrow(/only defined for resized symbols/);
    expect(ROTATION_CENTER_X).toBe(80);
    expect(ROTATION_CENTER_Y).toBe(51);
  });
});
