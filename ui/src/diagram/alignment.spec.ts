import { describe, expect, it } from "vitest";
import { createOrthogonalPath, getComponentPlaneSnapOffset, normalizeWirePoints, requantizeSceneToPlaneGrid, snapComponentToPlaneGrid } from "./grid";
import {
  DEFAULT_GRID_SPACING,
  DEFAULT_PLANE_SETTINGS,
  TERMINAL_LATTICE_X_OFFSET,
  TERMINAL_LATTICE_Y_OFFSET,
  getComponentTerminals,
  getDefaultEntryTerminalId,
  getTerminalDefinitions,
  getTerminalPoint,
  rotatePoint,
  instructionPalette
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType, BuilderScene, Point } from "../DiagramBuilder";

const planeSettings = DEFAULT_PLANE_SETTINGS;
const spacing = planeSettings.gridSpacing;
const PALETTE_TYPES = instructionPalette.map((entry) => entry.type);
const ROTATIONS = [0, 1, 2, 3];

function makeComponent(type: BuilderComponentType, x: number, y: number, rotation = 0): BuilderComponent {
  return {
    id: `component-${type}-r${rotation}`,
    label: type,
    rotation,
    tag: null,
    type,
    usesCustomLabel: false,
    x,
    y
  };
}

function isOnGrid(point: Point, gridSpacing: number): boolean {
  return point.x % gridSpacing === 0 && point.y % gridSpacing === 0;
}

function snapInterior(type: BuilderComponentType, rotation: number): BuilderComponent {
  // Interior position (clamp never triggers), per the documented border case in grid.spec.ts.
  return snapComponentToPlaneGrid(makeComponent(type, 324, 233, rotation), planeSettings);
}

describe("alignment proof: component anchors land on grid intersections (all palette types, all rotations)", () => {
  for (const type of PALETTE_TYPES) {
    for (const rotation of ROTATIONS) {
      it(`${type} rotation ${rotation}: anchor is a multiple of gridSpacing`, () => {
        const snapped = snapInterior(type, rotation);
        const anchor = { x: snapped.x + getComponentPlaneSnapOffset(snapped).x, y: snapped.y + getComponentPlaneSnapOffset(snapped).y };

        expect(isOnGrid(anchor, spacing), JSON.stringify(anchor)).toBe(true);
      });
    }
  }
});

describe("alignment proof: the entry terminal sits on the grid; all terminal offsets are exact art projections", () => {
  for (const type of PALETTE_TYPES) {
    for (const rotation of ROTATIONS) {
      it(`${type} rotation ${rotation}: entry terminal is a grid multiple`, () => {
        const snapped = snapInterior(type, rotation);
        const entryTerminalId = getDefaultEntryTerminalId(type);
        const entryTerminal = getComponentTerminals(snapped)
          .find((terminal) => terminal.terminalId === entryTerminalId);

        expect(entryTerminal).toBeDefined();
        expect(isOnGrid(entryTerminal!, spacing), `${type}.${entryTerminalId} @ ${entryTerminal?.x},${entryTerminal?.y}`).toBe(true);
      });

      it(`${type} rotation ${rotation}: local terminal offsets are invariant with world Y`, () => {
        const localTerminals = getTerminalDefinitions(type);
        const atOrigin = getComponentTerminals(makeComponent(type, 0, 0, rotation));
        const farAway = getComponentTerminals(makeComponent(type, 0, 20000, rotation));

        for (const localTerminal of localTerminals) {
          const originTerminal = atOrigin.find((terminal) => terminal.terminalId === localTerminal.id)!;
          const farTerminal = farAway.find((terminal) => terminal.terminalId === localTerminal.id)!;

          expect(farTerminal.x - originTerminal.x).toBeCloseTo(0, 10);
          expect(farTerminal.y - originTerminal.y).toBeCloseTo(20000, 10);
        }
      });
    }
  }
});

describe("alignment proof: raw terminal geometry follows the lattice rule", () => {
  it("BREAKER_2P terminals are pairwise congruent mod spacing and sit on the (8, 15) lattice", () => {
    const terminals = getTerminalDefinitions("BREAKER_2P");

    expect(terminals.length).toBe(4);

    for (const terminal of terminals) {
      expect(terminal.x % spacing, `BREAKER_2P.${terminal.id}.x`).toBe(TERMINAL_LATTICE_X_OFFSET);
      expect(terminal.y % spacing, `BREAKER_2P.${terminal.id}.y`).toBe(TERMINAL_LATTICE_Y_OFFSET);
    }

    for (const left of terminals) {
      for (const right of terminals) {
        expect(((right.x - left.x) % spacing) + 0, `BREAKER_2P dx ${left.id}->${right.id}`).toBe(0);
        expect(((right.y - left.y) % spacing) + 0, `BREAKER_2P dy ${left.id}->${right.id}`).toBe(0);
      }
    }
  });

  it("every palette type defines finite local terminal offsets", () => {
    for (const type of PALETTE_TYPES) {
      const terminals = getTerminalDefinitions(type);

      expect(terminals.length, `${type} has terminals`).toBeGreaterThan(0);

      for (const terminal of terminals) {
        expect(Number.isFinite(terminal.x), `${type}.${terminal.id}.x`).toBe(true);
        expect(Number.isFinite(terminal.y), `${type}.${terminal.id}.y`).toBe(true);
      }
    }
  });

  it("resized off-delay and level-switch rings keep their old midpoint and expected pitch", () => {
    for (const type of ["NOTO", "NCTC", "LEVEL_SWITCH_NO", "LEVEL_SWITCH_NC"] as const) {
      const terminals = getTerminalDefinitions(type);
      const input = terminals.find((terminal) => terminal.id === "in")!;
      const output = terminals.find((terminal) => terminal.id === "out")!;
      const isLevelSwitch = type === "LEVEL_SWITCH_NO" || type === "LEVEL_SWITCH_NC";
      const left = isLevelSwitch ? 35 : 32;
      const right = isLevelSwitch ? 125 : 128;
      const pitch = isLevelSwitch ? 90 : 96;

      expect(input.x).toBeCloseTo(left, 8);
      expect(output.x).toBeCloseTo(right, 8);
      expect(Math.abs(input.y - 48.5)).toBeLessThan(0.05);
      expect(Math.abs(output.y - 48.5)).toBeLessThan(0.05);
      expect(Math.hypot(output.x - input.x, output.y - input.y)).toBeCloseTo(pitch, 2);
      expect((input.x + output.x) / 2).toBeCloseTo(80, 8);
      expect((input.y + output.y) / 2).toBeCloseTo(48.5, 8);

      for (const rotation of ROTATIONS) {
        for (const [x, y] of [[324, 233], [918, 451]] as const) {
          const component = makeComponent(type, x, y, rotation);
          const snapped = snapComponentToPlaneGrid(component, planeSettings);
          const terminalsAtOrigin = getComponentTerminals(snapped);

          for (const definition of terminals) {
            const actual = terminalsAtOrigin.find((terminal) => terminal.terminalId === definition.id)!;
            const expectedLocal = rotatePoint({ x: definition.x, y: definition.y }, rotation);
            expect(actual.x).toBeCloseTo(snapped.x + expectedLocal.x, 8);
            expect(actual.y).toBeCloseTo(snapped.y + expectedLocal.y, 8);
          }
        }
      }
    }
  });
});

describe("alignment proof: wires", () => {
  function buildScene(): { entry: Point; exit: Point; points: Point[] } {
    const source = snapInterior("POWER_SOURCE", 0);
    const load = snapComponentToPlaneGrid(makeComponent("LAMP", 918, 451), planeSettings);
    const exit = getTerminalPoint(source, "right");
    const entry = getTerminalPoint(load, "in");
    const points = normalizeWirePoints(createOrthogonalPath([exit], entry, planeSettings), planeSettings);

    return { entry, exit, points };
  }

  it("every wire point is a grid multiple or an exact terminal point", () => {
    const { entry, exit, points } = buildScene();
    const allowed = [exit, entry];

    expect(points.length).toBeGreaterThanOrEqual(2);

    for (const point of points) {
      const onGrid = isOnGrid(point, spacing);
      const onTerminal = allowed.some((candidate) => candidate.x === point.x && candidate.y === point.y);
      expect(onGrid || onTerminal, JSON.stringify(point)).toBe(true);
    }
  });

  it("wire polylines are orthogonal (consecutive points share x or y)", () => {
    const { points } = buildScene();

    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]!;
      const current = points[index]!;

      expect(previous.x === current.x || previous.y === current.y, `${JSON.stringify(previous)} -> ${JSON.stringify(current)}`).toBe(true);
    }
  });
});

describe("alignment proof: requantize 18 -> 24 preserves anchor and wire invariants", () => {
  it("anchors stay on the new grid and wires stay orthogonal with every point on-grid or on a terminal", () => {
    const from = planeSettings;
    const to = { ...planeSettings, gridSpacing: 24 };
    const source = snapInterior("POWER_SOURCE", 0);
    const load = snapComponentToPlaneGrid(makeComponent("LAMP", 918, 451), planeSettings);
    const exit = getTerminalPoint(source, "right");
    const entry = getTerminalPoint(load, "in");
    const wirePoints = normalizeWirePoints(createOrthogonalPath([exit], entry, from), from);
    const scene: BuilderScene = {
      components: [source, load],
      wires: [{ color: "#111827", endPortId: "component-LAMP-r0:in", id: "wire-1", points: wirePoints, startPortId: "component-POWER_SOURCE-r0:right", thickness: 3.5 }]
    };

    const requantized = requantizeSceneToPlaneGrid(scene, from, to);

    for (const component of requantized.components) {
      const anchor = { x: component.x + getComponentPlaneSnapOffset(component).x, y: component.y + getComponentPlaneSnapOffset(component).y };
      expect(isOnGrid(anchor, to.gridSpacing), JSON.stringify(anchor)).toBe(true);
    }

    const points = requantized.wires[0]?.points ?? [];

    expect(points.length).toBeGreaterThanOrEqual(2);

    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]!;
      const current = points[index]!;

      expect(previous.x === current.x || previous.y === current.y).toBe(true);
    }

    // Wire endpoints track the moved terminals exactly (or sit on the new grid).
    const terminalPoints = requantized.components.flatMap((component) => getComponentTerminals(component).map((terminal) => ({ x: terminal.x, y: terminal.y })));

    for (const point of points) {
      const onGrid = isOnGrid(point, to.gridSpacing);
      const onTerminal = terminalPoints.some((candidate) => candidate.x === point.x && candidate.y === point.y);

      expect(onGrid || onTerminal, JSON.stringify(point)).toBe(true);
    }
  });
});
