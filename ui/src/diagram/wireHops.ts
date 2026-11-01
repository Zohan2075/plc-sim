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

function isStrictlyWithin(value: number, first: number, second: number): boolean {
  const minimum = Math.min(first, second);
  const maximum = Math.max(first, second);

  return value > minimum + EPSILON && value < maximum - EPSILON;
}

function getWireCreationNumber(wire: BuilderWire): number {
  const match = wire.id.match(/(\d+)$/);

  return match ? Number(match[1]) : -1;
}

/** El cable mas nuevo dibuja el puente; empate por id para ser estable. */
function isNewerWire(wire: BuilderWire, other: BuilderWire): boolean {
  const wireNumber = getWireCreationNumber(wire);
  const otherNumber = getWireCreationNumber(other);

  if (wireNumber !== otherNumber) {
    return wireNumber > otherNumber;
  }

  return wire.id > other.id;
}

/**
 * Cruces reales entre este cable y otro (segmento horizontal contra vertical).
 * Un cruce solo cuenta si es estrictamente interior a ambos segmentos: los
 * extremos, esquinas y uniones en T no llevan puente. El cable mas nuevo es
 * el que puentea, sin depender del orden del array.
 */
export function findWireCrossings(wire: BuilderWire, wires: BuilderWire[]): WireHop[] {
  const hops: WireHop[] = [];
  const seenHopKeys = new Set<string>();

  for (let index = 0; index < wire.points.length - 1; index += 1) {
    const start = wire.points[index];
    const end = wire.points[index + 1];

    if (!start || !end || samePoint(start, end)) {
      continue;
    }

    const horizontal = isHorizontal(start, end);
    const vertical = isVertical(start, end);

    if (!horizontal && !vertical) {
      continue;
    }

    for (const other of wires) {
      if (other.id === wire.id) {
        continue;
      }

      if (!isNewerWire(wire, other)) {
        continue;
      }

      for (let otherIndex = 0; otherIndex < other.points.length - 1; otherIndex += 1) {
        const otherStart = other.points[otherIndex];
        const otherEnd = other.points[otherIndex + 1];

        if (!otherStart || !otherEnd || samePoint(otherStart, otherEnd)) {
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

        if (
          !isStrictlyWithin(
            horizontal ? crossing.x : crossing.y,
            horizontal ? start.x : start.y,
            horizontal ? end.x : end.y
          )
        ) {
          continue;
        }

        if (
          !isStrictlyWithin(
            otherHorizontal ? crossing.x : crossing.y,
            otherHorizontal ? otherStart.x : otherStart.y,
            otherHorizontal ? otherEnd.x : otherEnd.y
          )
        ) {
          continue;
        }

        // Cualquier vertice de cualquiera de los dos cables en el cruce es una
        // esquina o union, no un cruce: no se dibuja arco.
        if (
          wire.points.some((point) => samePoint(point, crossing))
          || other.points.some((point) => samePoint(point, crossing))
        ) {
          continue;
        }

        const hopKey = `${index}:${crossing.x}:${crossing.y}`;

        if (seenHopKeys.has(hopKey)) {
          continue;
        }

        seenHopKeys.add(hopKey);
        hops.push({ point: crossing, segmentIndex: index });
      }
    }
  }

  return hops;
}

/**
 * Path SVG del cable con un puente (arco) en cada cruce. Los cruces se elevan
 * hacia arriba en segmentos horizontales y hacia la derecha en verticales.
 * Se omiten los arcos que no caben entre el cruce y el extremo del segmento.
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
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
    const seenHops = new Set<string>();
    const segmentHops = hops
      .filter((hop) => hop.segmentIndex === index)
      .filter((hop) => {
        const key = `${hop.point.x}:${hop.point.y}`;

        if (seenHops.has(key)) {
          return false;
        }

        seenHops.add(key);

        const distanceToStart = Math.hypot(hop.point.x - start.x, hop.point.y - start.y);
        const distanceToEnd = Math.hypot(hop.point.x - end.x, hop.point.y - end.y);

        return distanceToStart >= radius + 2 && distanceToEnd >= radius + 2 && segmentLength >= radius * 2 + 4;
      })
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
