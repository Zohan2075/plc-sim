import { describe, expect, it } from "vitest";
import {
  createOrthogonalPath,
  getComponentPlanePadding,
  getComponentPlaneSnapOffset,
  getSegmentAxis,
  moveAttachedWireEndpoints,
  normalizeWirePoints,
  requantizeSceneToPlaneGrid,
  simplifyWirePoints,
  snapComponentToPlaneGrid,
  snapPointToGrid
} from "./grid";
import { DEFAULT_GRID_SPACING, DEFAULT_PLANE_SETTINGS, getTerminalPoint } from "../DiagramBuilder";
import type { BuilderComponent, BuilderPlaneSettings, BuilderScene, BuilderWire } from "../DiagramBuilder";

function makeComponent(overrides: Partial<BuilderComponent> = {}): BuilderComponent {
  return {
    id: "component-1",
    label: "Lampara",
    rotation: 0,
    tag: null,
    type: "LAMP",
    usesCustomLabel: false,
    x: 100,
    y: 100,
    ...overrides
  };
}

describe("snapPointToGrid", () => {
  it("lands on multiples of gridSpacing and is idempotent", () => {
    for (const gridSpacing of [8, 10, 12, 18, 24, 36, 96]) {
      const planeSettings: BuilderPlaneSettings = { ...DEFAULT_PLANE_SETTINGS, gridSpacing };
      const point = { x: 123.4, y: 567.8 };
      const snapped = snapPointToGrid(point, planeSettings);

      expect(snapped.x % gridSpacing).toBe(0);
      expect(snapped.y % gridSpacing).toBe(0);
      expect(snapPointToGrid(snapped, planeSettings)).toEqual(snapped);
    }
  });
});

describe("getComponentPlanePadding (clamp fix)", () => {
  it("is always a multiple of gridSpacing so grid multiples never break", () => {
    for (let gridSpacing = 8; gridSpacing <= 96; gridSpacing += 1) {
      const padding = getComponentPlanePadding({ ...DEFAULT_PLANE_SETTINGS, gridSpacing });

      expect(padding % gridSpacing).toBe(0);
      expect(padding).toBeGreaterThanOrEqual(gridSpacing);
    }
  });

  it("keeps the historical padding of 18 for the default spacing", () => {
    expect(getComponentPlanePadding(DEFAULT_PLANE_SETTINGS)).toBe(DEFAULT_GRID_SPACING);
  });
});

describe("snapComponentToPlaneGrid", () => {
  it("snaps the entry-terminal anchor to a grid multiple for interior positions", () => {
    const planeSettings = DEFAULT_PLANE_SETTINGS;
    const probe = makeComponent();
    const offset = getComponentPlaneSnapOffset(probe);

    for (let x = 36; x <= planeSettings.width - 200; x += 137) {
      for (let y = 36; y <= planeSettings.height - 172; y += 111) {
        const snapped = snapComponentToPlaneGrid(makeComponent({ x, y }), planeSettings);
        expect((snapped.x + offset.x) % planeSettings.gridSpacing).toBe(0);
        expect((snapped.y + offset.y) % planeSettings.gridSpacing).toBe(0);
      }
    }
  });

  it("clamps inside the plane at the bounds (documented border case: position clamps to grid-aligned padding)", () => {
    const planeSettings = DEFAULT_PLANE_SETTINGS;
    const padding = getComponentPlanePadding(planeSettings);
    const snapped = snapComponentToPlaneGrid(makeComponent({ x: -500, y: -500 }), planeSettings);

    expect(snapped.x).toBeGreaterThanOrEqual(padding);
    expect(snapped.y).toBeGreaterThanOrEqual(padding);
    expect(snapped.x).toBeLessThanOrEqual(planeSettings.width - 160 - padding);
  });
});

describe("createOrthogonalPath", () => {
  it("always produces orthogonal segments with all points on the grid", () => {
    const planeSettings = DEFAULT_PLANE_SETTINGS;

    for (const start of [{ x: 180, y: 180 }, { x: 360, y: 90 }, { x: 90, y: 450 }]) {
      for (const target of [{ x: 720, y: 450 }, { x: 540, y: 180 }, { x: 180, y: 720 }]) {
        const path = createOrthogonalPath([start], target, planeSettings);

        for (const point of path) {
          expect(point.x % planeSettings.gridSpacing).toBe(0);
          expect(point.y % planeSettings.gridSpacing).toBe(0);
        }

        for (let index = 1; index < path.length; index += 1) {
          const previous = path[index - 1]!;
          const current = path[index]!;
          expect(previous.x === current.x || previous.y === current.y).toBe(true);
        }
      }
    }
  });
});

describe("normalizeWirePoints / simplifyWirePoints", () => {
  it("deduplicates canonical duplicates and keeps endpoints", () => {
    const planeSettings = DEFAULT_PLANE_SETTINGS;
    const points = [
      { x: 180, y: 180 },
      { x: 181, y: 180 },
      { x: 360, y: 180 },
      { x: 360, y: 180 },
      { x: 360, y: 360 }
    ];
    const normalized = normalizeWirePoints(points, planeSettings);

    expect(normalized).toEqual([
      { x: 180, y: 180 },
      { x: 360, y: 180 },
      { x: 360, y: 360 }
    ]);
    // An L-shaped path has no collinear middles: every bend is meaningful and kept.
    expect(simplifyWirePoints([...normalized, { x: 540, y: 360 }])).toEqual([
      { x: 180, y: 180 },
      { x: 360, y: 180 },
      { x: 360, y: 360 },
      { x: 540, y: 360 }
    ]);
    // A collinear middle point is dropped.
    expect(simplifyWirePoints([
      { x: 180, y: 180 },
      { x: 360, y: 180 },
      { x: 540, y: 180 }
    ])).toEqual([
      { x: 180, y: 180 },
      { x: 540, y: 180 }
    ]);
  });
});

describe("moveAttachedWireEndpoints (simplify on move)", () => {
  function makeScene(component: BuilderComponent, points: { x: number; y: number }[]): {
    movedComponent: BuilderComponent;
    wires: BuilderWire[];
  } {
    const movedComponent = { ...component, x: component.x + DEFAULT_GRID_SPACING * 3, y: component.y };
    const wires = moveAttachedWireEndpoints(
      [
        {
          color: "#111827",
          endPortId: null,
          id: "wire-1",
          points,
          startPortId: `${component.id}:in`,
          thickness: 3.5
        }
      ],
      component,
      movedComponent
    );

    return { movedComponent, wires };
  }

  function expectOrthogonalWithEndpoints(wire: BuilderWire, movedComponent: BuilderComponent) {
    const startPoint = getTerminalPoint(movedComponent, "in");

    expect(wire.points[0]).toEqual(startPoint);

    for (let index = 1; index < wire.points.length; index += 1) {
      const previous = wire.points[index - 1]!;
      const current = wire.points[index]!;

      expect(getSegmentAxis(previous, current)).not.toBeNull();
      expect(previous.x !== current.x || previous.y !== current.y).toBe(true);
    }
  }

  it("removes zero-length and duplicate segments created by a move", () => {
    const component = makeComponent({ x: 180, y: 180 });
    const inTerminal = getTerminalPoint(component, "in");
    const { movedComponent, wires } = makeScene(component, [
      inTerminal,
      { x: inTerminal.x, y: inTerminal.y },
      { x: inTerminal.x + 180, y: inTerminal.y },
      { x: inTerminal.x + 180, y: inTerminal.y }
    ]);

    expectOrthogonalWithEndpoints(wires[0]!, movedComponent);
    expect(wires[0]!.points.length).toBeLessThanOrEqual(3);
  });

  it("removes a collinear redundant bend while keeping endpoints and orthogonality", () => {
    const component = makeComponent({ x: 180, y: 180 });
    const inTerminal = getTerminalPoint(component, "in");
    const end = { x: inTerminal.x + 180, y: inTerminal.y };
    const { movedComponent, wires } = makeScene(component, [
      inTerminal,
      { x: inTerminal.x + 90, y: inTerminal.y },
      end
    ]);

    expectOrthogonalWithEndpoints(wires[0]!, movedComponent);
    // The bend in the middle of a straight run is gone: only endpoints remain.
    expect(wires[0]!.points.length).toBe(2);
  });

  it("preserves the exact endpoint attached to the moved terminal", () => {
    const component = makeComponent({ x: 360, y: 360 });
    const inTerminal = getTerminalPoint(component, "in");
    const { movedComponent, wires } = makeScene(component, [
      inTerminal,
      { x: inTerminal.x, y: inTerminal.y + 180 },
      { x: inTerminal.x + 180, y: inTerminal.y + 180 }
    ]);

    expect(wires[0]!.points[0]).toEqual(getTerminalPoint(movedComponent, "in"));
    expect(wires[0]!.points[0]).not.toEqual(inTerminal);
  });
});

describe("requantizeSceneToPlaneGrid", () => {
  it("is stable across spacing 18 -> 24 -> 18 with wires following components", () => {
    const from: BuilderPlaneSettings = { ...DEFAULT_PLANE_SETTINGS, gridSpacing: 18 };
    const to: BuilderPlaneSettings = { ...DEFAULT_PLANE_SETTINGS, gridSpacing: 24 };
    const component = makeComponent({ id: "component-1", x: 180, y: 180 });
    const offset = getComponentPlaneSnapOffset(component);
    const scene: BuilderScene = {
      components: [component],
      wires: [
        {
          color: "#111827",
          endPortId: null,
          id: "wire-1",
          points: [
            { x: 252, y: 216 },
            { x: 540, y: 216 }
          ],
          startPortId: "component-1:out",
          thickness: 3.5
        }
      ]
    };

    const requantized = requantizeSceneToPlaneGrid(scene, from, to);

    // The entry-terminal anchor (component position + snap offset) is what lands on the grid.
    expect((requantized.components[0]!.x + offset.x) % to.gridSpacing).toBe(0);
    expect((requantized.components[0]!.y + offset.y) % to.gridSpacing).toBe(0);

    for (const point of requantized.wires[0]?.points ?? []) {
      expect(point.x % to.gridSpacing).toBe(0);
      expect(point.y % to.gridSpacing).toBe(0);
    }

    const back = requantizeSceneToPlaneGrid(requantized, to, from);
    expect((back.components[0]!.x + offset.x) % from.gridSpacing).toBe(0);
    expect((back.components[0]!.y + offset.y) % from.gridSpacing).toBe(0);

    for (const point of back.wires[0]?.points ?? []) {
      expect(point.x % from.gridSpacing).toBe(0);
      expect(point.y % from.gridSpacing).toBe(0);
    }
  });
});
