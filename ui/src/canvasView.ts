export const MIN_VIEW_ZOOM = 0.1;
export const MAX_VIEW_ZOOM = 8;
export const VIEW_ZOOM_STEP = 1.25;
export const VIEW_MARGIN = 48;
const MAX_WHEEL_AXIS_DELTA = 240;
const ZOOM_FACTOR_PER_PIXEL = 0.0015;

export interface WheelLikeEvent {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  deltaX: number;
  deltaY: number;
  deltaMode: number;
}

export type WheelIntent =
  | { factor: number; type: "zoom" }
  | { dx: number; dy: number; type: "pan" };

export interface AnchoredScrollInput {
  focusX: number;
  focusY: number;
  margin: number;
  newZoom: number;
  oldZoom: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface FitViewInput {
  contentHeight: number;
  contentWidth: number;
  margin: number;
  viewportHeight: number;
  viewportWidth: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampViewZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return clamp(value, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM);
}

export function normalizeWheelAxis(delta: number, deltaMode: number): number {
  if (!Number.isFinite(delta)) {
    return 0;
  }

  let pixels = delta;

  if (deltaMode === 1) {
    pixels = delta * 16;
  } else if (deltaMode === 2) {
    pixels = delta * 120;
  }

  return clamp(pixels, -MAX_WHEEL_AXIS_DELTA, MAX_WHEEL_AXIS_DELTA);
}

function getZoomDelta(deltaX: number, deltaY: number): number {
  return Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
}

function createZoomIntent(zoomDelta: number): WheelIntent | null {
  if (zoomDelta === 0) {
    return null;
  }

  return { factor: Math.exp(-zoomDelta * ZOOM_FACTOR_PER_PIXEL), type: "zoom" };
}

/**
 * Resolves one wheel event to a single view action.
 * Order: Ctrl/Cmd (pinch) zooms; Shift pans horizontally even when wheel-zoom is on;
 * the wheel-zoom setting then zooms; otherwise the wheel pans both axes.
 */
export function resolveWheelIntent(
  event: WheelLikeEvent,
  mouseWheelZooms: boolean
): WheelIntent | null {
  const deltaX = normalizeWheelAxis(event.deltaX, event.deltaMode);
  const deltaY = normalizeWheelAxis(event.deltaY, event.deltaMode);
  const zoomDelta = getZoomDelta(deltaX, deltaY);

  if (event.ctrlKey || event.metaKey) {
    return createZoomIntent(zoomDelta);
  }

  if (event.shiftKey) {
    const horizontalDelta = deltaX !== 0 ? deltaX : deltaY;

    return horizontalDelta === 0 ? null : { dx: horizontalDelta, dy: 0, type: "pan" };
  }

  if (mouseWheelZooms) {
    return createZoomIntent(zoomDelta);
  }

  if (deltaX === 0 && deltaY === 0) {
    return null;
  }

  return { dx: deltaX, dy: deltaY, type: "pan" };
}

/** Keeps the model point under the viewport focus fixed while the zoom changes. */
export function computeAnchoredScroll(input: AnchoredScrollInput): {
  scrollLeft: number;
  scrollTop: number;
} {
  const oldZoom = input.oldZoom > 0 ? input.oldZoom : 1;
  const focusModelX = (input.scrollLeft + input.focusX - input.margin) / oldZoom;
  const focusModelY = (input.scrollTop + input.focusY - input.margin) / oldZoom;

  return {
    scrollLeft: focusModelX * input.newZoom - input.focusX + input.margin,
    scrollTop: focusModelY * input.newZoom - input.focusY + input.margin
  };
}

export function computeGridMinorOpacity(spacingPx: number): number {
  if (!Number.isFinite(spacingPx) || spacingPx < 3) {
    return 0;
  }

  if (spacingPx < 7) {
    return 0.35;
  }

  return 1;
}

export function computeFitView(input: FitViewInput): {
  scrollLeft: number;
  scrollTop: number;
  zoom: number;
} {
  const contentWidth = Math.max(input.contentWidth, 1);
  const contentHeight = Math.max(input.contentHeight, 1);
  const availableWidth = Math.max(input.viewportWidth - input.margin * 2, 1);
  const availableHeight = Math.max(input.viewportHeight - input.margin * 2, 1);

  return {
    scrollLeft: 0,
    scrollTop: 0,
    zoom: clampViewZoom(
      Math.min(availableWidth / contentWidth, availableHeight / contentHeight)
    )
  };
}
