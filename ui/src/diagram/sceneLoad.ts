import { cleanWirePath } from "./grid";
import type {
  BuilderComponent,
  BuilderPlaneSettings,
  BuilderScene,
  Point
} from "../DiagramBuilder";

const RESIZED_COMPONENT_TYPES = new Set<BuilderComponent["type"]>([
  "NOTO",
  "NCTC",
  "LEVEL_SWITCH_NO",
  "LEVEL_SWITCH_NC"
]);

export interface LegacySceneNormalization {
  removedWireIds: string[];
  scene: BuilderScene;
}

export interface SnapshotPreparationResult extends LegacySceneNormalization {
  affectedWireIds: string[];
}

export interface PrepareSnapshotSceneOptions {
  clean?: (points: Point[]) => Point[];
  normalizeLegacy: (scene: BuilderScene, planeSettings: BuilderPlaneSettings) => LegacySceneNormalization;
  resizedPortLocations: ReadonlyMap<string, Point>;
}

export type SceneApplyOrigin = "program" | "prepared-snapshot";

function cloneScene(scene: BuilderScene): BuilderScene {
  return {
    components: scene.components.map((component) => ({ ...component })),
    wires: scene.wires.map((wire) => ({
      ...wire,
      points: wire.points.map((point) => ({ ...point }))
    }))
  };
}

export function prepareSnapshotScene(
  scene: BuilderScene,
  planeSettings: BuilderPlaneSettings,
  options: PrepareSnapshotSceneOptions
): SnapshotPreparationResult {
  const hasResizedComponent = scene.components.some((component) => RESIZED_COMPONENT_TYPES.has(component.type));

  if (!hasResizedComponent) {
    return {
      ...options.normalizeLegacy(cloneScene(scene), planeSettings),
      affectedWireIds: []
    };
  }

  const clean = options.clean ?? cleanWirePath;
  const prepared = cloneScene(scene);
  const affectedWireIds: string[] = [];

  prepared.wires = prepared.wires.map((wire) => {
    const start = wire.startPortId ? options.resizedPortLocations.get(wire.startPortId) : undefined;
    const end = wire.endPortId ? options.resizedPortLocations.get(wire.endPortId) : undefined;

    if (!start && !end) {
      return wire;
    }

    const points = wire.points.map((point) => ({ ...point }));

    if (start && points.length > 0) {
      points[0] = { x: start.x, y: start.y };
    }

    if (end && points.length > 0) {
      points[points.length - 1] = { x: end.x, y: end.y };
    }

    affectedWireIds.push(wire.id);
    return { ...wire, points: clean(points) };
  });

  return { affectedWireIds, removedWireIds: [], scene: prepared };
}

export function resolveSceneForApply(
  scene: BuilderScene,
  origin: SceneApplyOrigin,
  planeSettings: BuilderPlaneSettings,
  normalize: (scene: BuilderScene, planeSettings: BuilderPlaneSettings) => LegacySceneNormalization
): LegacySceneNormalization {
  if (origin === "prepared-snapshot") {
    return { removedWireIds: [], scene: cloneScene(scene) };
  }

  return normalize(cloneScene(scene), planeSettings);
}
