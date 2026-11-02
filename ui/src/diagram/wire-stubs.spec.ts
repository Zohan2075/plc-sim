import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getComponentTerminals,
  getDefaultEntryTerminalId,
  instructionPalette
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType, BuilderPlaneSettings, BuilderWire, Point } from "../DiagramBuilder";
import { clampSceneToPlane, getTerminalOutwardDirection, snapComponentToPlaneGrid } from "./grid";
import { collapseWireRoute, resolveWireDisplayPoints } from "./wireRoute";
import { reconcileWireTopology } from "./wireTopology";

const planeSettings: BuilderPlaneSettings = { gridSpacing: 18, height: 20000, width: 4200 };
const Y_POSITIONS = [0, 500, 5000, 20000];
const ROTATIONS = [0, 1, 2, 3];

let sequence = 0;

function component(
  type: BuilderComponentType,
  x: number,
  y: number,
  rotation = 0
): BuilderComponent {
  sequence += 1;

  return {
    id: `wire-stub-component-${sequence}`,
    label: type,
    rotation,
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
    id: `wire-stub-${sequence}`,
    points: [{ x: -999, y: -999 }, { x: 999, y: 999 }],
    startPortId: startTerminal.portId,
    thickness: 3.5
  };
}

function expectPointClose(actual: { x: number; y: number }, expected: { x: number; y: number }): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(0.01);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(0.01);
}

describe("original terminal anchors", () => {
  it("timer contacts expose the original ring centers, not the common 8..152 span", () => {
    const timer = component("NCTO", 324, 399);
    const terminals = getComponentTerminals(timer);

    expectPointClose(terminals.find((terminal) => terminal.terminalId === "in")!, { x: 356, y: 447.5 });
    expectPointClose(terminals.find((terminal) => terminal.terminalId === "out")!, { x: 452, y: 447.5 });
  });

  it("push buttons use the common 8/152 anchors", () => {
    const pushButton = component("PUSH_BUTTON_NO", 324, 399);
    const terminals = getComponentTerminals(pushButton);

    expectPointClose(terminals.find((terminal) => terminal.terminalId === "in")!, {
      x: 324 + 8,
      y: 450
    });
    expectPointClose(terminals.find((terminal) => terminal.terminalId === "out")!, {
      x: 324 + 152,
      y: 450
    });
  });
});

describe("wire-side stubs", () => {
  it("starts at the exact terminal anchor and exits outward before routing", () => {
    const pushButton = component("PUSH_BUTTON_NO", 324, 399);
    const outTerminal = getComponentTerminals(pushButton).find((terminal) => terminal.terminalId === "out")!;
    const wire: BuilderWire = {
      color: "#111827",
      endPortId: null,
      id: "wire-stub-open",
      points: [{ x: outTerminal.x, y: outTerminal.y }, { x: 600, y: 300 }],
      startPortId: outTerminal.portId,
      thickness: 3.5
    };
    const route = resolveWireDisplayPoints(wire, [pushButton], planeSettings);
    const direction = getTerminalOutwardDirection(pushButton, "out");
    const stubVector = {
      x: route[1]!.x - route[0]!.x,
      y: route[1]!.y - route[0]!.y
    };

    expectPointClose(route[0]!, outTerminal);
    expect(direction).toEqual({ x: 1, y: 0 });
    expect(stubVector.x).toBeGreaterThan(0);
    expect(Math.abs(stubVector.y)).toBeLessThan(0.01);
  });

  it("uses the original timer ring center as the wire endpoint", () => {
    const timer = component("NCTO", 496, 723);
    const outTerminal = getComponentTerminals(timer).find((terminal) => terminal.terminalId === "out")!;
    const wire: BuilderWire = {
      color: "#111827",
      endPortId: null,
      id: "wire-stub-timer",
      points: [{ x: outTerminal.x, y: outTerminal.y }, { x: 900, y: 500 }],
      startPortId: outTerminal.portId,
      thickness: 3.5
    };
    const route = resolveWireDisplayPoints(wire, [timer], planeSettings);

    expectPointClose(route[0]!, { x: 624, y: 771.5 });
    expect(route[1]!.x).toBeGreaterThan(route[0]!.x);
    expect(Math.abs(route[1]!.y - route[0]!.y)).toBeLessThan(0.01);
  });
});

describe("router tolerance", () => {
  function routeBetweenTerminalOffsets(offsetX: number, offsetY: number): Point[] {
    const start = component("PUSH_BUTTON_NO", 324, 399);
    const end = component("PUSH_BUTTON_NO", 324 + offsetX, 399 + offsetY);

    return resolveWireDisplayPoints(
      wireBetween(start, "out", end, "out"),
      [start, end],
      planeSettings
    );
  }

  const offsets: Array<[number, number]> = [[0, 0], [1, 2], [2, 1], [0.5, 0], [0, 3]];

  for (const [offsetX, offsetY] of offsets) {
    it(`(${offsetX}, ${offsetY}) -> exactly 2 points, never a diagonal`, () => {
      const route = routeBetweenTerminalOffsets(offsetX, offsetY);

      expect(route).toHaveLength(2);
      expect(
        Math.abs(route[0]!.x - route[1]!.x) < 0.01
        || Math.abs(route[0]!.y - route[1]!.y) < 0.01
      ).toBe(true);
    });
  }

  it("(0, 3*GRID) keeps a proper orthogonal straight", () => {
    const route = routeBetweenTerminalOffsets(0, planeSettings.gridSpacing * 3);

    expect(route).toHaveLength(2);
    expect(Math.abs(route[0]!.x - route[1]!.x)).toBeLessThan(0.01);
    expect(Math.abs(route[0]!.y - route[1]!.y)).toBeGreaterThan(0.01);
  });

  it("(2*GRID, 2*GRID) keeps a proper orthogonal route", () => {
    const route = routeBetweenTerminalOffsets(
      planeSettings.gridSpacing * 2,
      planeSettings.gridSpacing * 2
    );

    expect(route.length).toBeGreaterThanOrEqual(3);

    for (let index = 0; index < route.length - 1; index += 1) {
      const start = route[index]!;
      const end = route[index + 1]!;
      expect(
        Math.abs(start.x - end.x) < 0.01 || Math.abs(start.y - end.y) < 0.01
      ).toBe(true);
    }
  });
});

describe("sub-grid jogs", () => {
  it("absorbs a 2 px step instead of leaving it in the route", () => {
    const collapsed = collapseWireRoute(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 2 },
        { x: 200, y: 2 }
      ],
      18
    );

    expect(collapsed.some((point) => point.x === 100 && point.y === 2)).toBe(false);

    for (let index = 0; index < collapsed.length - 1; index += 1) {
      const start = collapsed[index]!;
      const end = collapsed[index + 1]!;
      expect(Math.abs(start.x - end.x) < 0.01 || Math.abs(start.y - end.y) < 0.01).toBe(true);
    }
  });
});

describe("manual wire bends", () => {
  it("preserves a user-routed bend when the terminals are not aligned", () => {
    const pushButton = component("PUSH_BUTTON_NO", 324, 399);
    const timer = component("NCTO", 324, 651);
    const wire = wireBetween(pushButton, "out", timer, "out");

    wire.points = [
      { x: 471.6667, y: 450 },
      { x: 600, y: 450 },
      { x: 600, y: 700 },
      { x: 452, y: 700 }
    ];

    const route = resolveWireDisplayPoints(wire, [pushButton, timer], planeSettings);

    expect(route.some((point) => Math.abs(point.x - 600) < 0.01)).toBe(true);
  });
});

describe("stacked components across large Y and all rotations", () => {
  for (const type of instructionPalette.map((entry) => entry.type)) {
    for (const rotation of ROTATIONS) {
      for (const y of Y_POSITIONS) {
        it(`${type} rotation ${rotation} at y=${y}: display route is a 2-point vertical at the terminal X`, () => {
          const terminalId = getDefaultEntryTerminalId(type);
          const start = component(type, 324, y, rotation);
          const end = component(type, 324, y + 500, rotation);
          const wire = wireBetween(start, terminalId, end, terminalId);
          const route = resolveWireDisplayPoints(wire, [start, end], planeSettings);
          const startTerminal = getComponentTerminals(start).find((terminal) => terminal.terminalId === terminalId)!;
          const endTerminal = getComponentTerminals(end).find((terminal) => terminal.terminalId === terminalId)!;

          expect(route).toHaveLength(2);
          expect(Math.abs(route[0]!.x - route[1]!.x)).toBeLessThan(0.01);
          expectPointClose(route[0]!, startTerminal);
          expectPointClose(route[1]!, endTerminal);
        });
      }
    }
  }
});

describe("terminal-based component snapping", () => {
  it("snaps the chosen terminal, not the component box or the entry terminal", () => {
    const timer = component("NCTO", 324, 399);
    const snapped = snapComponentToPlaneGrid(timer, planeSettings, "out");
    const outTerminal = getComponentTerminals(snapped).find((terminal) => terminal.terminalId === "out")!;
    const inTerminal = getComponentTerminals(snapped).find((terminal) => terminal.terminalId === "in")!;

    expect(Math.abs((outTerminal.x / planeSettings.gridSpacing) - Math.round(outTerminal.x / planeSettings.gridSpacing))).toBeLessThan(0.01);
    expect(Math.abs((inTerminal.x / planeSettings.gridSpacing) - Math.round(inTerminal.x / planeSettings.gridSpacing))).toBeGreaterThan(0.01);
  });
});

const ydSnapshot = JSON.parse(
  readFileSync(new URL("./__fixtures__/yd-control.circuit.json", import.meta.url), "utf8")
) as { components: BuilderComponent[]; settings: BuilderPlaneSettings; wires: BuilderWire[] };

describe("Y-Δ return wire with original glyph geometry", () => {
  it("keeps the NCTO return straight when both endpoints share Y", () => {
    const report = reconcileWireTopology(
      clampSceneToPlane(
        { components: ydSnapshot.components, wires: ydSnapshot.wires },
        ydSnapshot.settings
      ),
      ydSnapshot.settings
    );
    const wire = report.scene.wires.find((candidate) => candidate.id === "builder-wire-37")!;
    const route = resolveWireDisplayPoints(wire, report.scene.components, ydSnapshot.settings);
    const ncto = report.scene.components.find((candidate) => candidate.id === "builder-component-34")!;
    const nctoOut = getComponentTerminals(ncto).find((terminal) => terminal.terminalId === "out")!;

    expect(route).toHaveLength(2);
    expect(Math.abs(route[0]!.y - route[1]!.y)).toBeLessThan(0.01);
    expect(Math.abs(route[1]!.x - nctoOut.x)).toBeLessThan(0.01);
    expect(Math.abs(route[1]!.y - nctoOut.y))
      .toBeLessThanOrEqual(ydSnapshot.settings.gridSpacing * 0.25 + 0.01);
  });
});
