import type { BuilderWire, Point } from "../DiagramBuilder";

export interface WireHop {
  point: Point;
  segmentIndex: number;
}

export const WIRE_HOP_RADIUS = 7;

const EPSILON = 0.001;

function isHorizontal(left: Point, right: Point): boolean {
  return Math.abs(left.y - right.y) < EPSILON;
}

function isVertical(left: Point, right: Point): boolean {
  return Math.abs(left.x - right.x) < EPSILON;
}

function samePoint(left: Point, right: Point): boolean {
  return Math.abs(left.x - right.x) < EPSILON && Math.abs(left.y - right.y) < EPSILON;
}

function withinRange(value: number, first: number, second: number): boolean {
  return value >= Math.min(first, second) - EPSILON && value <= Math.max(first, second) + EPSILON;
}

/**
 * Cruces reales entre este cable y otros (segmento horizontal contra vertical).
 * Se excluye cualquier punto compartido por ambos cables (eso es un nodo
 * electrico, no un cruce) y los extremos del propio segmento.
 */
export function findWireCrossings(wire: BuilderWire, wireIndex: number, wires: BuilderWire[]): WireHop[] {
  const hops: WireHop[] = [];

  for (let index = 0; index < wire.points.length - 1; index += 1) {
    const start = wire.points[index];
    const end = wire.points[index + 1];

    if (!start || !end) {
      continue;
    }

    const horizontal = isHorizontal(start, end);
    const vertical = isVertical(start, end);

    if (!horizontal && !vertical) {
      continue;
    }

    for (let otherIndex = 0; otherIndex < wires.length; otherIndex += 1) {
      const other = wires[otherIndex];

      if (!other || other.id === wire.id) {
        continue;
      }

      // Solo el cable posterior dibuja el puente; el anterior pasa recto.
      if (wireIndex <= otherIndex) {
        continue;
      }

      for (let otherIndex = 0; otherIndex < other.points.length - 1; otherIndex += 1) {
        const otherStart = other.points[otherIndex];
        const otherEnd = other.points[otherIndex + 1];

        if (!otherStart || !otherEnd) {
          continue;
        }

        const otherHorizontal = isHorizontal(otherStart, otherEnd);
        const otherVertical = isVertical(otherStart, otherEnd);

        if (horizontal === otherHorizontal && vertical === otherVertical) {
          continue;
        }

        const crossing = horizontal
          ? { x: otherStart.x, y: start.y }
          : { x: start.x, y: otherStart.y };

        if (!withinRange(horizontal ? crossing.x : crossing.y, horizontal ? start.x : start.y, horizontal ? end.x : end.y)) {
          continue;
        }

        if (
          !withinRange(
            otherHorizontal ? crossing.x : crossing.y,
            otherHorizontal ? otherStart.x : otherStart.y,
            otherHorizontal ? otherEnd.x : otherEnd.y
          )
        ) {
          continue;
        }

        if (samePoint(crossing, start) || samePoint(crossing, end)) {
          continue;
        }

        const isSharedNode = wire.points.some((point) =>
          other.points.some((otherPoint) => samePoint(point, otherPoint) && samePoint(point, crossing))
        );

        if (isSharedNode) {
          continue;
        }

        hops.push({ point: crossing, segmentIndex: index });
      }
    }
  }

  return hops;
}

/**
 * Path SVG del cable con un puente (arco) en cada cruce. Los cruces se elevan
 * hacia arriba en segmentos horizontales y hacia la derecha en verticales.
 */
export function buildWirePathD(points: Point[], hops: WireHop[], radius = WIRE_HOP_RADIUS): string {
  const [first] = points;

  if (!first || points.length < 2) {
    return "";
  }

  const format = (value: number) => Math.round(value * 100) / 100;
  let path = `M ${format(first.x)} ${format(first.y)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    if (!start || !end) {
      continue;
    }

    const horizontal = isHorizontal(start, end);
    const segmentHops = hops
      .filter((hop) => hop.segmentIndex === index)
      .sort((left, right) =>
        horizontal
          ? Math.abs(left.point.x - start.x) - Math.abs(right.point.x - start.x)
          : Math.abs(left.point.y - start.y) - Math.abs(right.point.y - start.y)
      );

    for (const hop of segmentHops) {
      const directionX = horizontal ? Math.sign(end.x - start.x) || 1 : 0;
      const directionY = horizontal ? 0 : Math.sign(end.y - start.y) || 1;
      const before = {
        x: hop.point.x - directionX * radius,
        y: hop.point.y - directionY * radius
      };
      const after = {
        x: hop.point.x + directionX * radius,
        y: hop.point.y + directionY * radius
      };
      const control = horizontal
        ? { x: hop.point.x, y: hop.point.y - radius * 2 }
        : { x: hop.point.x + radius * 2, y: hop.point.y };

      path += ` L ${format(before.x)} ${format(before.y)}`;
      path += ` Q ${format(control.x)} ${format(control.y)} ${format(after.x)} ${format(after.y)}`;
    }

    path += ` L ${format(end.x)} ${format(end.y)}`;
  }

  return path;
}
