import { clampComponentToPlane, snapComponentToPlaneGrid } from "./grid";
import type { BuilderComponent, BuilderPlaneSettings, Point } from "../DiagramBuilder";

export const WIRE_ORIGIN_CANCEL_DISTANCE = 6;
export const WIRE_CREATION_BLOCKED_MESSAGE = "Stop the simulation to create wires";

export function canEditConnections(running: boolean): boolean {
  return !running;
}

export type DiagramShortcut =
  | { type: "command-palette" }
  | { type: "copy" }
  | { type: "redo" }
  | { type: "rotate"; direction: "ccw" | "cw" }
  | { type: "run" }
  | { type: "stop" }
  | { type: "undo" }
  | { type: "zoom"; action: "actual" | "fit" | "in" | "out" };

export function resolveDiagramShortcut(event: {
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}): DiagramShortcut | null {
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;

  if (event.key === "F5" && !modifier) {
    return event.shiftKey ? { type: "stop" } : { type: "run" };
  }

  if (modifier && key === "k") {
    return { type: "command-palette" };
  }

  if (modifier && key === "0") {
    return { action: "fit", type: "zoom" };
  }

  if (modifier && key === "1") {
    return { action: "actual", type: "zoom" };
  }

  if (modifier && (key === "+" || key === "=")) {
    return { action: "in", type: "zoom" };
  }

  if (modifier && (key === "-" || key === "_")) {
    return { action: "out", type: "zoom" };
  }

  if (modifier && key === "z") {
    return event.shiftKey ? { type: "redo" } : { type: "undo" };
  }

  if (modifier && key === "y") {
    return { type: "redo" };
  }

  if (modifier && key === "c") {
    return { type: "copy" };
  }

  if (!modifier && key === "r") {
    return { direction: event.shiftKey ? "ccw" : "cw", type: "rotate" };
  }

  return null;
}

export function computeFitZoom(
  content: { height: number; width: number },
  viewport: { height: number; width: number }
): number {
  if (content.height <= 0 || content.width <= 0) {
    return 1;
  }

  return Math.min(viewport.width / content.width, viewport.height / content.height);
}

export function updateComponentSelection(
  current: ReadonlySet<string>,
  componentId: string,
  additive: boolean
): Set<string> {
  const next = new Set(additive ? current : []);

  if (additive && next.has(componentId)) {
    next.delete(componentId);
  } else {
    next.add(componentId);
  }

  return next;
}

export type CanvasContextMenuState = {
  draftPointCount: number;
  hasReconnectTarget: boolean;
};

export function resolveCanvasContextMenuAction(state: CanvasContextMenuState): "cancel-wire" | "open-menu" {
  return state.draftPointCount > 0 || state.hasReconnectTarget ? "cancel-wire" : "open-menu";
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
