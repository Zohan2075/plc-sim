import type { BuilderComponent, Point } from "../DiagramBuilder";
import {
  SELECTOR_3POS_RING_CENTERS,
  SELECTOR_3POS_RING_RADII
} from "./selector3posArt.generated";

export const SELECTOR_3POS_ART_WIDTH = 160;
export const SELECTOR_3POS_ART_HEIGHT = 102;

const ROTATION_CENTER_X = SELECTOR_3POS_ART_WIDTH / 2;
const ROTATION_CENTER_Y = SELECTOR_3POS_ART_HEIGHT / 2;

const ROW_1_Y = SELECTOR_3POS_RING_CENTERS.in1.y;
const ROW_2_Y = SELECTOR_3POS_RING_CENTERS.in2.y;
const ROW_SPAN = ROW_2_Y - ROW_1_Y;

export const SELECTOR_3POS_TOP_ZONE_BOUNDARY = ROW_1_Y + ROW_SPAN / 3;
export const SELECTOR_3POS_BOTTOM_ZONE_BOUNDARY = ROW_1_Y + (2 * ROW_SPAN) / 3;

export type Selector3PosZonePosition = 1 | 2 | 3;

export const SELECTOR_3POS_ZONES = [
  { height: SELECTOR_3POS_TOP_ZONE_BOUNDARY, position: 1, top: 0 },
  {
    height: SELECTOR_3POS_BOTTOM_ZONE_BOUNDARY - SELECTOR_3POS_TOP_ZONE_BOUNDARY,
    position: 2,
    top: SELECTOR_3POS_TOP_ZONE_BOUNDARY
  },
  {
    height: SELECTOR_3POS_ART_HEIGHT - SELECTOR_3POS_BOTTOM_ZONE_BOUNDARY,
    position: 3,
    top: SELECTOR_3POS_BOTTOM_ZONE_BOUNDARY
  }
] as const;

const RING_IDS = ["in1", "out1", "in2", "out2"] as const;
type RingId = (typeof RING_IDS)[number];

const SELECTOR_3POS_MAX_OUTER_RADII = RING_IDS.reduce(
  (radii, ringId) => {
    const stateRadii = Object.values(SELECTOR_3POS_RING_RADII).map((state) => state[ringId]);

    radii[ringId] = {
      outerX: Math.max(...stateRadii.map((radiiForState) => radiiForState.outerX)),
      outerY: Math.max(...stateRadii.map((radiiForState) => radiiForState.outerY))
    };

    return radii;
  },
  {} as Record<RingId, { outerX: number; outerY: number }>
);

function normalizeQuarterTurns(value: number): number {
  return ((value % 4) + 4) % 4;
}

/**
 * Exact inverse of `rotatePoint` around the selector rotation center.
 */
export function inverseRotateSelector3PosPoint(point: Point, rotation: number): Point {
  const turns = normalizeQuarterTurns(rotation);
  const dx = point.x - ROTATION_CENTER_X;
  const dy = point.y - ROTATION_CENTER_Y;

  switch (turns) {
    case 1:
      return {
        x: ROTATION_CENTER_X + dy,
        y: ROTATION_CENTER_Y - dx
      };
    case 2:
      return {
        x: ROTATION_CENTER_X - dx,
        y: ROTATION_CENTER_Y - dy
      };
    case 3:
      return {
        x: ROTATION_CENTER_X - dy,
        y: ROTATION_CENTER_Y + dx
      };
    default:
      return point;
  }
}

export function getSelector3PosArtPointFromClientPoint(
  clientPoint: Point,
  componentRect: { left: number; top: number },
  zoom: number,
  rotation: number
): Point | null {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    return null;
  }

  return inverseRotateSelector3PosPoint(
    {
      x: (clientPoint.x - componentRect.left) / zoom,
      y: (clientPoint.y - componentRect.top) / zoom
    },
    rotation
  );
}

/**
 * Ring terminals keep wire priority: zone clicks and hover never fire inside
 * the largest generated outer ellipse for any selector state.
 */
export function isSelector3PosRingPoint(point: Point, padding = 0): boolean {
  return RING_IDS.some((ringId) => {
    const center = SELECTOR_3POS_RING_CENTERS[ringId];
    const radii = SELECTOR_3POS_MAX_OUTER_RADII[ringId];
    const radiusX = radii.outerX + padding;
    const radiusY = radii.outerY + padding;
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1;
  });
}

export function getSelector3PosZoneAtArtPoint(point: Point): 1 | 2 | 3 | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }

  if (
    point.x < 0
    || point.x > SELECTOR_3POS_ART_WIDTH
    || point.y < 0
    || point.y > SELECTOR_3POS_ART_HEIGHT
  ) {
    return null;
  }

  if (point.y < SELECTOR_3POS_TOP_ZONE_BOUNDARY) {
    return 1;
  }

  if (point.y < SELECTOR_3POS_BOTTOM_ZONE_BOUNDARY) {
    return 2;
  }

  return 3;
}

export function getSelector3PosZoneAtClientPoint(
  clientPoint: Point,
  componentRect: { left: number; top: number },
  zoom: number,
  rotation: number
): 1 | 2 | 3 | null {
  const artPoint = getSelector3PosArtPointFromClientPoint(
    clientPoint,
    componentRect,
    zoom,
    rotation
  );

  if (!artPoint || isSelector3PosRingPoint(artPoint)) {
    return null;
  }

  return getSelector3PosZoneAtArtPoint(artPoint);
}

export function applySelector3PosPositionToComponents(
  components: BuilderComponent[],
  componentIds: ReadonlySet<string>,
  position: 1 | 2 | 3
): { changed: boolean; components: BuilderComponent[] } {
  let changed = false;
  const nextComponents = components.map((component) => {
    if (!componentIds.has(component.id) || component.type !== "SELECTOR_3POS") {
      return component;
    }

    if ((component.selectorPosition ?? 2) === position) {
      return component;
    }

    changed = true;

    return { ...component, selectorPosition: position };
  });

  return {
    changed,
    components: changed ? nextComponents : components
  };
}
