import { describe, expect, it } from "vitest";
import { getTerminalPoint } from "../DiagramBuilder";
import type { BuilderComponent, BuilderPlaneSettings, BuilderWire } from "../DiagramBuilder";
import { SELECTOR_3POS_RING_RADII } from "./selector3posArt.generated";
import { resolveWireDisplayPoints, trimSelectorWireEndpoint } from "./wireRoute";

const settings: BuilderPlaneSettings = { gridSpacing: 18, height: 20000, width: 4200 };
const ports = ["in1", "out1", "in2", "out2"] as const;
const directions = [
  { name: "left", x: -1, y: 0 },
  { name: "right", x: 1, y: 0 },
  { name: "up", x: 0, y: -1 },
  { name: "down", x: 0, y: 1 }
] as const;

function selector(rotation: number): BuilderComponent {
  return {
    id: "selector-trim",
    label: "SEL",
    rotation,
    selectorPosition: 2,
    tag: null,
    type: "SELECTOR_3POS",
    usesCustomLabel: false,
    x: 400,
    y: 300
  };
}

function inverseRotateDirection(x: number, y: number, rotation: number): { x: number; y: number } {
  const turns = ((rotation % 4) + 4) % 4;

  switch (turns) {
    case 1:
      return { x: y, y: -x };
    case 2:
      return { x: -x, y: -y };
    case 3:
      return { x: -y, y: x };
    default:
      return { x, y };
  }
}

function expectedRadius(portId: string, rotation: number, direction: { x: number; y: number }): number {
  const radii = SELECTOR_3POS_RING_RADII[2][portId as keyof typeof SELECTOR_3POS_RING_RADII[2]];
  const local = inverseRotateDirection(direction.x, direction.y, rotation);
  const length = Math.hypot(local.x, local.y);

  return 1 / Math.sqrt(
    (local.x / length / radii.outerX) ** 2 + (local.y / length / radii.outerY) ** 2
  );
}

describe("SELECTOR_3POS wire trim", () => {
  it("hides a selector wire end when the last segment is shorter than the ring radius", () => {
    const component = selector(0);
    const anchor = getTerminalPoint(component, "in1");
    const wire: BuilderWire = {
      color: "#111827",
      endPortId: null,
      id: "wire-too-short",
      points: [anchor, { x: anchor.x + 5, y: anchor.y }],
      startPortId: `${component.id}:in1`,
      thickness: 3.5
    };

    expect(resolveWireDisplayPoints(wire, [component], settings)).toEqual([]);
  });

  it("trims every port in all rotations and four directions to the rendered outer ring", () => {
    for (const rotation of [0, 1, 2, 3]) {
      const component = selector(rotation);

      for (const portId of ports) {
        const anchor = getTerminalPoint(component, portId);

        for (const direction of directions) {
          const far = { x: anchor.x + direction.x * 120, y: anchor.y + direction.y * 120 };
          const expected = expectedRadius(portId, rotation, direction);
          const trimmed = trimSelectorWireEndpoint(anchor, far, component, portId);

          expect(trimmed).not.toBeNull();
          const distance = Math.hypot(trimmed!.x - anchor.x, trimmed!.y - anchor.y);
          expect(Math.abs(distance - expected)).toBeLessThan(0.01);

          const cross = (trimmed!.x - anchor.x) * (far.y - anchor.y)
            - (trimmed!.y - anchor.y) * (far.x - anchor.x);
          expect(Math.abs(cross)).toBeLessThan(0.01);

          const wire: BuilderWire = {
            color: "#111827",
            endPortId: null,
            id: `wire-${portId}-${rotation}-${direction.name}`,
            points: [anchor, far],
            startPortId: `${component.id}:${portId}`,
            thickness: 3.5
          };
          const display = resolveWireDisplayPoints(wire, [component], settings);
          const adjacent = display[1]!;
          const actual = display[0]!;
          const actualDistance = Math.hypot(actual.x - anchor.x, actual.y - anchor.y);
          const actualExpected = expectedRadius(portId, rotation, {
            x: adjacent.x - anchor.x,
            y: adjacent.y - anchor.y
          });

          expect(Math.abs(actualDistance - actualExpected)).toBeLessThan(0.01);
          expect(wire.points).toEqual([anchor, far]);

          console.log(
            `SEL trim ${portId} rot=${rotation} dir=${direction.name}: ` +
            `trim=${distance.toFixed(3)} expected=${expected.toFixed(3)} ` +
            `routed=${actualDistance.toFixed(3)} routedExpected=${actualExpected.toFixed(3)}`
          );
        }
      }
    }
  });
});
