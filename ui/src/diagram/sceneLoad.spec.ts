import { describe, expect, it, vi } from "vitest";
import { cleanWirePath } from "./grid";
import { prepareSnapshotScene } from "./sceneLoad";
import type { BuilderComponent, BuilderPlaneSettings, BuilderScene, BuilderWire, Point } from "../DiagramBuilder";

const planeSettings: BuilderPlaneSettings = { gridSpacing: 18, height: 940, width: 1720 };

function component(id: string, type: BuilderComponent["type"], x: number, y: number, rotation = 0): BuilderComponent {
  return { id, label: id, rotation, tag: null, type, usesCustomLabel: false, x, y };
}

function wire(id: string, startPortId: string | null, endPortId: string | null, points: Point[]): BuilderWire {
  return { color: "#111827", endPortId, id, points, startPortId, thickness: 3.5 };
}

function removableJog(startX: number, startY: number): Point[] {
  return [
    { x: startX, y: startY },
    { x: 100, y: 50 },
    { x: 110, y: 52 },
    { x: 120, y: 50 },
    { x: 180, y: 50 }
  ];
}

describe("snapshot load preparation for resized terminals", () => {
  it("preserves component positions, updates resized port endpoints, and cleans only affected wires", () => {
    const components = [
      component("off-no", "NOTO", 300, 198),
      component("off-nc", "NCTC", 450, 270, 1),
      component("level-no", "LEVEL_SWITCH_NO", 600, 342, 2),
      component("level-nc", "LEVEL_SWITCH_NC", 750, 414, 3),
      component("old-xic", "XIC", 900, 198),
      component("old-lamp", "LAMP", 1080, 198)
    ];
    const oldOnlyPoints = removableJog(900, 249);
    const scene: BuilderScene = {
      components,
      wires: [
        wire("wire-off-no", "off-no:out", "old-xic:in", removableJog(396, 246)),
        wire("wire-off-nc", "off-nc:out", "old-xic:in", removableJog(546, 318)),
        wire("wire-level-no", "level-no:out", "old-xic:in", removableJog(696, 390)),
        wire("wire-level-nc", "level-nc:out", "old-xic:in", removableJog(846, 462)),
        wire("wire-old-only", "old-xic:out", "old-lamp:in", oldOnlyPoints)
      ]
    };
    const resizedPortLocations = new Map<string, Point>([
      ["off-no:out", { x: 327, y: 246 }],
      ["off-nc:out", { x: 477, y: 300 }],
      ["level-no:out", { x: 627, y: 354 }],
      ["level-nc:out", { x: 777, y: 408 }]
    ]);
    const cleanerCalls: Point[][] = [];
    const normalizeLegacy = vi.fn((nextScene: BuilderScene) => ({ removedWireIds: [], scene: nextScene }));
    const result = prepareSnapshotScene(scene, planeSettings, {
      clean(points) {
        cleanerCalls.push(points.map((point) => ({ ...point })));
        return cleanWirePath(points);
      },
      normalizeLegacy,
      resizedPortLocations
    });

    expect(result.affectedWireIds).toEqual([
      "wire-off-no",
      "wire-off-nc",
      "wire-level-no",
      "wire-level-nc"
    ]);
    expect(cleanerCalls).toHaveLength(4);
    expect(normalizeLegacy).not.toHaveBeenCalled();
    expect(result.scene.components.map(({ id, x, y }) => ({ id, x, y }))).toEqual(
      components.map(({ id, x, y }) => ({ id, x, y }))
    );

    for (const [index, expected] of [...resizedPortLocations.values()].entries()) {
      expect(result.scene.wires[index]!.points[0]).toEqual(expected);
      expect(result.scene.wires[index]!.points).toHaveLength(3);
    }

    expect(JSON.stringify(result.scene.wires[4]!.points)).toBe(JSON.stringify(oldOnlyPoints));
    expect(result.scene.wires[4]!.points).toEqual(oldOnlyPoints);
  });

  it("runs legacy clamp/reconcile preparation only for snapshots without resized types", () => {
    const scene: BuilderScene = {
      components: [component("old", "XIC", 100, 100)],
      wires: []
    };
    const normalizedScene: BuilderScene = {
      components: [component("old", "XIC", 118, 118)],
      wires: []
    };
    const normalizeLegacy = vi.fn((_scene: BuilderScene, settings: BuilderPlaneSettings) => ({
      removedWireIds: ["loose-wire"],
      scene: { ...normalizedScene, components: normalizedScene.components.map((entry) => ({ ...entry, x: settings.gridSpacing })) }
    }));
    const clean = vi.fn(cleanWirePath);
    const result = prepareSnapshotScene(scene, planeSettings, {
      clean,
      normalizeLegacy,
      resizedPortLocations: new Map()
    });

    expect(normalizeLegacy).toHaveBeenCalledOnce();
    expect(result.scene.components[0]?.x).toBe(18);
    expect(result.removedWireIds).toEqual(["loose-wire"]);
    expect(result.affectedWireIds).toEqual([]);
    expect(clean).not.toHaveBeenCalled();
  });
});
