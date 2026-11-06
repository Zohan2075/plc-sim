import { describe, expect, it, vi } from "vitest";
import { cleanWirePath } from "./grid";
import { prepareSnapshotScene, resolveSceneForApply } from "./sceneLoad";
import type { BuilderComponent, BuilderPlaneSettings, BuilderScene, Point } from "../DiagramBuilder";

const planeSettings: BuilderPlaneSettings = { gridSpacing: 18, height: 940, width: 1720 };

function component(id: string, type: BuilderComponent["type"], x: number, y: number): BuilderComponent {
  return { id, label: id, rotation: 0, tag: null, type, usesCustomLabel: false, x, y };
}

describe("scene application origin policy", () => {
  it("keeps normal clamp/reconcile behavior for program scenes containing resized instructions", () => {
    const programScene: BuilderScene = {
      components: [component("program-off", "NOTO", 300, 198)],
      wires: []
    };
    const normalize = vi.fn((scene: BuilderScene) => ({
      removedWireIds: [],
      scene: {
        ...scene,
        components: scene.components.map((entry) => ({ ...entry, x: entry.x + 18 }))
      }
    }));
    const result = resolveSceneForApply(programScene, "program", planeSettings, normalize);

    expect(normalize).toHaveBeenCalledOnce();
    expect(result.scene.components[0]?.x).toBe(318);
    expect(programScene.components[0]?.x).toBe(300);
  });

  it("reuses direct and pending prepared snapshots without normalizing or moving saved components twice", () => {
    const scene: BuilderScene = {
      components: [
        component("loaded-level", "LEVEL_SWITCH_NC", 642, 486),
        component("loaded-old", "XIC", 900, 486)
      ],
      wires: [{
        color: "#111827",
        endPortId: "loaded-old:in",
        id: "loaded-wire",
        points: [{ x: 700, y: 534 }, { x: 900, y: 537 }, { x: 920, y: 534 }],
        startPortId: "loaded-level:out",
        thickness: 3.5
      }]
    };
    const resizedPortLocations = new Map<string, Point>([
      ["loaded-level:out", { x: 678, y: 534 }]
    ]);
    const normalizeLegacy = vi.fn((next: BuilderScene) => ({ removedWireIds: [], scene: next }));
    const cleaner = vi.fn(cleanWirePath);
    const directPreparation = prepareSnapshotScene(scene, planeSettings, {
      clean: cleaner,
      normalizeLegacy,
      resizedPortLocations
    });
    const preparedApply = resolveSceneForApply(
      directPreparation.scene,
      "prepared-snapshot",
      planeSettings,
      normalizeLegacy
    );
    const pendingEffectApply = resolveSceneForApply(
      directPreparation.scene,
      "prepared-snapshot",
      planeSettings,
      normalizeLegacy
    );

    expect(directPreparation.scene.components.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 642, y: 486 },
      { x: 900, y: 486 }
    ]);
    expect(directPreparation.scene.wires[0]?.points[0]).toEqual({ x: 678, y: 534 });
    expect(directPreparation.affectedWireIds).toEqual(["loaded-wire"]);
    expect(normalizeLegacy).not.toHaveBeenCalled();
    expect(cleaner).toHaveBeenCalledOnce();
    expect(preparedApply.scene.components[0]).toMatchObject({ x: 642, y: 486 });
    expect(pendingEffectApply.scene.components[0]).toMatchObject({ x: 642, y: 486 });
    expect(normalizeLegacy).not.toHaveBeenCalled();
  });
});
