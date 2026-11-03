import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getComponentTerminals } from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType, BuilderPlaneSettings, BuilderWire, Point } from "../DiagramBuilder";
import { clampSceneToPlane } from "./grid";
import { resolveWireDisplayPoints } from "./wireRoute";
import { reconcileWireTopology } from "./wireTopology";

const planeSettings: BuilderPlaneSettings = { gridSpacing: 18, height: 20000, width: 4200 };
const GRID = planeSettings.gridSpacing;
let sequence = 0;

function component(
  type: BuilderComponentType,
  x: number,
  y: number
): BuilderComponent {
  sequence += 1;

  return {
    id: `routing-component-${sequence}`,
    label: type,
    rotation: 0,
    tag: null,
    type,
    usesCustomLabel: false,
    x,
    y
  };
}

function wireBetween(
  start: BuilderComponent,
  startTerminalId: string,
  end: BuilderComponent,
  endTerminalId: string
): BuilderWire {
  const startTerminal = getComponentTerminals(start).find((terminal) => terminal.terminalId === startTerminalId)!;
  const endTerminal = getComponentTerminals(end).find((terminal) => terminal.terminalId === endTerminalId)!;

  return {
    color: "#111827",
    endPortId: endTerminal.portId,
    id: `routing-wire-${sequence}`,
    points: [{ x: -999, y: -999 }, { x: 999, y: 999 }],
    startPortId: startTerminal.portId,
    thickness: 3.5
  };
}

function routeForOffset(offsetX: number, offsetY: number): {
  route: Point[];
  startAnchor: Point;
  endAnchor: Point;
} {
  const start = component("PUSH_BUTTON_NO", 324, 399);
  const end = component("PUSH_BUTTON_NO", 324 + offsetX, 399 + offsetY);
  const startTerminal = getComponentTerminals(start).find((terminal) => terminal.terminalId === "out")!;
  const endTerminal = getComponentTerminals(end).find((terminal) => terminal.terminalId === "out")!;

  return {
    route: resolveWireDisplayPoints(
      wireBetween(start, "out", end, "out"),
      [start, end],
      planeSettings
    ),
    startAnchor: { x: startTerminal.x, y: startTerminal.y },
    endAnchor: { x: endTerminal.x, y: endTerminal.y }
  };
}

function expectPointClose(actual: Point, expected: Point): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(0.01);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(0.01);
}

function expectOrthogonal(route: Point[]): void {
  for (let index = 0; index < route.length - 1; index += 1) {
    const start = route[index]!;
    const end = route[index + 1]!;
    expect(Math.abs(start.x - end.x) < 0.01 || Math.abs(start.y - end.y) < 0.01).toBe(true);
  }
}

function polylineLength(points: Point[]): number {
  let length = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    length += Math.hypot(end.x - start.x, end.y - start.y);
  }

  return length;
}

function format(route: Point[]): string {
  return route.map((point) => `(${point.x},${point.y})`).join(" -> ");
}

describe("L-first routing", () => {
  for (const [offsetX, offsetY] of [
    [5 * GRID, 3 * GRID],
    [-5 * GRID, 3 * GRID],
    [3 * GRID, -5 * GRID],
    [-3 * GRID, 5 * GRID]
  ] as Array<[number, number]>) {
    it(`(${offsetX}, ${offsetY}) -> 3 points, 1 bend, exact anchors`, () => {
      const { route, startAnchor, endAnchor } = routeForOffset(offsetX, offsetY);

      console.log(`L case (${offsetX}, ${offsetY}): ${format(route)}`);

      expect(route).toHaveLength(3);
      expect(route.length - 2).toBe(1);
      expectPointClose(route[0]!, startAnchor);
      expectPointClose(route[route.length - 1]!, endAnchor);
      expectOrthogonal(route);
    });
  }

  it("keeps aligned routes at 2 points", () => {
    const horizontal = routeForOffset(4 * GRID, 0);
    const vertical = routeForOffset(0, 4 * GRID);

    expect(horizontal.route).toHaveLength(2);
    expect(vertical.route).toHaveLength(2);
  });

  it("approaches a terminal from directly above/below with a vertical last segment", () => {
    const { route, endAnchor } = routeForOffset(1, -5 * GRID);

    expect(route).toHaveLength(2);
    expect(Math.abs(route[0]!.x - route[1]!.x)).toBeLessThan(0.01);
    expect(Math.abs(route[1]!.y - endAnchor.y)).toBeLessThan(0.01);
  });
});

describe("body-blocked L fallback", () => {
  it("uses a valid Z/U and prints it", () => {
    const start = component("PUSH_BUTTON_NO", 800, 399);
    const end = component("PUSH_BUTTON_NO", 200, 599);
    const route = resolveWireDisplayPoints(
      wireBetween(start, "out", end, "in"),
      [start, end],
      planeSettings
    );

    console.log(`body-blocked route: ${format(route)}`);

    expectPointClose(route[0]!, { x: 952, y: 450 });
    expectPointClose(route[route.length - 1]!, { x: 208, y: 650 });
    expect(route.length).toBeGreaterThan(3);
    expectOrthogonal(route);
  });
});

const attachedCircuit = JSON.parse(
  readFileSync(new URL("./__fixtures__/yd-control.circuit.json", import.meta.url), "utf8")
) as { components: BuilderComponent[]; settings: BuilderPlaneSettings; wires: BuilderWire[] };

describe("attached JSON wires", () => {
  it("are unchanged or shorter after re-routing", () => {
    const report = reconcileWireTopology(
      clampSceneToPlane(
        { components: attachedCircuit.components, wires: attachedCircuit.wires },
        attachedCircuit.settings
      ),
      attachedCircuit.settings
    );

    for (const wireId of ["builder-wire-6", "builder-wire-8", "builder-wire-10", "builder-wire-11", "builder-wire-48", "builder-wire-64", "builder-wire-68"]) {
      const wire = report.scene.wires.find((candidate) => candidate.id === wireId);

      if (!wire) {
        console.log(`${wireId}: not present`);
        continue;
      }

      const before = wire.points;
      const after = resolveWireDisplayPoints(wire, report.scene.components, attachedCircuit.settings);
      const beforeLength = polylineLength(before);
      const afterLength = polylineLength(after);

      console.log(`${wireId}`);
      console.log(`  before: ${format(before)} (${beforeLength.toFixed(2)} px, ${before.length - 2} bends)`);
      console.log(`  after : ${format(after)} (${afterLength.toFixed(2)} px, ${after.length - 2} bends)`);

      expect(afterLength).toBeLessThanOrEqual(beforeLength + 0.01);
      expectOrthogonal(after);

      const startShift = Math.hypot(after[0]!.x - before[0]!.x, after[0]!.y - before[0]!.y);
      const endShift = Math.hypot(
        after[after.length - 1]!.x - before[before.length - 1]!.x,
        after[after.length - 1]!.y - before[before.length - 1]!.y
      );

      expect(startShift).toBeLessThanOrEqual(planeSettings.gridSpacing * 0.25 + 0.01);
      expect(endShift).toBeLessThanOrEqual(planeSettings.gridSpacing * 0.25 + 0.01);
    }
  });
});
