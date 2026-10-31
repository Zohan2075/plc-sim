import { clampComponentToPlane, snapComponentToPlaneGrid } from "./grid";
import type { BuilderComponent, BuilderPlaneSettings, Point } from "../DiagramBuilder";

export const WIRE_ORIGIN_CANCEL_DISTANCE = 6;

export type CanvasContextMenuState = {
  draftPointCount: number;
  hasReconnectTarget: boolean;
};

export function resolveCanvasContextMenuAction(state: CanvasContextMenuState): "cancel-wire" | "allow-default" {
  return state.draftPointCount > 0 || state.hasReconnectTarget ? "cancel-wire" : "allow-default";
}

/**
 * A left click aborts an in-progress wire only when it lands back on the point
 * where the wire started (same terminal / same canvas spot).
 */
export function isWireOriginHit(
  draftPoints: Point[],
  point: Point,
  tolerance = WIRE_ORIGIN_CANCEL_DISTANCE
): boolean {
  if (draftPoints.length === 0) {
    return false;
  }

  const origin = draftPoints[0];

  if (!origin) {
    return false;
  }

  return Math.hypot(point.x - origin.x, point.y - origin.y) <= tolerance;
}

export function buildDuplicatedComponent(
  component: BuilderComponent,
  nextIdValue: number,
  planeSettings: BuilderPlaneSettings
): BuilderComponent {
  const duplicated: BuilderComponent = {
    ...component,
    id: `builder-component-${nextIdValue}`,
    x: component.x + planeSettings.gridSpacing * 2,
    y: component.y + planeSettings.gridSpacing * 2
  };

  return snapComponentToPlaneGrid(clampComponentToPlane(duplicated, planeSettings), planeSettings);
}

export type ComponentMenuState = {
  componentId: string;
  anchor: Point;
  editingLabel: boolean;
} | null;

export type ComponentMenuCloseEvent =
  | "canvas-click"
  | "drag-start"
  | "wire-start"
  | "escape"
  | "action-run";

export function closeComponentMenuOnEvent(menu: ComponentMenuState, _event: ComponentMenuCloseEvent): ComponentMenuState {
  return menu === null ? null : null;
}
