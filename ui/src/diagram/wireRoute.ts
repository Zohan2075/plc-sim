import {
  getPortId,
  getTerminalDefinitions,
  getTerminalPoint
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderPlaneSettings, BuilderWire, Point } from "../DiagramBuilder";
import {
  distanceBetween,
  getSegmentAxis,
  getTerminalOutwardDirection,
  getTerminalStubEnd,
  simplifyWirePoints
} from "./grid";

const EPSILON = 0.01;

export interface WireTerminalRoute {
  anchor: Point;
  componentId: string;
  direction: Point;
  portId: string;
  stub: Point;
  terminalId: string;
}

interface TerminalRef {
  anchor: Point;
  component: BuilderComponent;
  direction: Point;
  portId: string;
  terminalId: string;
}

function buildTerminalRefs(components: readonly BuilderComponent[]): Map<string, TerminalRef> {
  const refs = new Map<string, TerminalRef>();

  for (const component of components) {
    for (const terminal of getTerminalDefinitions(component.type)) {
      const portId = getPortId(component.id, terminal.id);

      refs.set(portId, {
        anchor: getTerminalPoint(component, terminal.id),
        component,
        direction: getTerminalOutwardDirection(component, terminal.id),
        portId,
        terminalId: terminal.id
      });
    }
  }

  return refs;
}

function samePoint(left: Point, right: Point): boolean {
  return Math.abs(left.x - right.x) < EPSILON && Math.abs(left.y - right.y) < EPSILON;
}

function getAlignedAxis(
  left: Point,
  right: Point,
  tolerance: number
): "x" | "y" | null {
  const deltaX = Math.abs(right.x - left.x);
  const deltaY = Math.abs(right.y - left.y);
  const withinX = deltaX <= tolerance;
  const withinY = deltaY <= tolerance;

  if (!withinX && !withinY) {
    return null;
  }

  if (withinX && withinY) {
    return deltaX <= deltaY ? "x" : "y";
  }

  return withinX ? "x" : "y";
}

/**
 * Si los dos puntos estan dentro de la tolerancia en un eje, devuelve una
 * recta de 2 puntos. El extremo inicial manda en el eje alineado; el otro
 * extremo absorbe el residuo (queda bajo el anillo del borne).
 */
function getStraightSegment(
  start: Point,
  end: Point,
  tolerance: number
): Point[] | null {
  const axis = getAlignedAxis(start, end, tolerance);

  if (!axis) {
    return null;
  }

  return axis === "x"
    ? [{ x: start.x, y: start.y }, { x: start.x, y: end.y }]
    : [{ x: start.x, y: start.y }, { x: end.x, y: start.y }];
}

function getRoutePenalty(points: Point[], startDirection: Point, endDirection: Point): number {
  let penalty = 0;
  const first = points[0];
  const second = points[1];
  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];

  if (first && second && startDirection.x !== 0) {
    const direction = Math.sign(second.x - first.x);

    if (direction !== 0 && direction !== startDirection.x) {
      penalty += 10_000;
    }
  }

  if (first && second && startDirection.y !== 0) {
    const direction = Math.sign(second.y - first.y);

    if (direction !== 0 && direction !== startDirection.y) {
      penalty += 10_000;
    }
  }

  // El cable debe llegar al stub desde FUERA del borne, no desde el interior
  // del glifo. Si el ultimo tramo avanza en la direccion de salida, esta
  // entrando desde dentro y se penaliza.
  if (penultimate && last && endDirection.x !== 0) {
    const direction = Math.sign(last.x - penultimate.x);

    if (direction !== 0 && direction === endDirection.x) {
      penalty += 10_000;
    }
  }

  if (penultimate && last && endDirection.y !== 0) {
    const direction = Math.sign(last.y - penultimate.y);

    if (direction !== 0 && direction === endDirection.y) {
      penalty += 10_000;
    }
  }

  return penalty;
}

function getRouteLength(points: Point[]): number {
  let length = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    if (start && end) {
      length += distanceBetween(start, end);
    }
  }

  return length;
}

function routeBetweenStubs(
  start: Point,
  end: Point,
  startDirection: Point,
  endDirection: Point,
  tolerance: number
): Point[] {
  if (samePoint(start, end)) {
    return [start, end];
  }

  const straight = getStraightSegment(start, end, tolerance);

  if (straight) {
    return straight;
  }

  const horizontalFirst = [start, { x: end.x, y: start.y }, end];
  const verticalFirst = [start, { x: start.x, y: end.y }, end];
  const horizontalScore = getRoutePenalty(horizontalFirst, startDirection, endDirection);
  const verticalScore = getRoutePenalty(verticalFirst, startDirection, endDirection);

  if (horizontalScore !== verticalScore) {
    return horizontalScore < verticalScore ? horizontalFirst : verticalFirst;
  }

  return getRouteLength(horizontalFirst) <= getRouteLength(verticalFirst)
    ? horizontalFirst
    : verticalFirst;
}

/**
 * Elimina quiebres colineales y retrocesos. Los extremos (bornes) NUNCA se
 * descartan: el cable siempre termina exactamente en el ancla del terminal.
 */
export function collapseWireRoute(points: Point[], gridSpacing = 18): Point[] {
  if (points.length <= 2) {
    return points;
  }

  const tolerance = gridSpacing * 0.25;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (firstPoint && lastPoint) {
    const straight = getStraightSegment(firstPoint, lastPoint, tolerance);

    if (straight) {
      return straight;
    }
  }

  let result = simplifyWirePoints(points);
  let didChange = true;

  while (didChange && result.length > 2) {
    didChange = false;

    for (let index = 1; index < result.length - 1; index += 1) {
      const previous = result[index - 1];
      const current = result[index];
      const next = result[index + 1];

      if (!previous || !current || !next) {
        continue;
      }

      const previousAxis = getSegmentAxis(previous, current, tolerance);
      const nextAxis = getSegmentAxis(current, next, tolerance);

      if (!previousAxis || previousAxis !== nextAxis) {
        continue;
      }

      const sameLine = previousAxis === "horizontal"
        ? Math.abs(previous.y - current.y) <= tolerance && Math.abs(current.y - next.y) <= tolerance
        : Math.abs(previous.x - current.x) <= tolerance && Math.abs(current.x - next.x) <= tolerance;

      if (!sameLine) {
        continue;
      }

      result.splice(index, 1);
      result = simplifyWirePoints(result);
      didChange = true;
      break;
    }
  }

  // Un escalon menor que una celda no es una ruta: se absorbe en el tramo
  // contiguo. Los stubs de los extremos no se tocan porque el par evaluado
  // siempre es un segmento interior (B-C), no el primero ni el ultimo.
  didChange = true;

  while (didChange && result.length > 3) {
    didChange = false;

    for (let index = 1; index < result.length - 2; index += 1) {
      const previous = result[index - 1];
      const current = result[index];
      const next = result[index + 1];
      const after = result[index + 2];

      if (!previous || !current || !next || !after) {
        continue;
      }

      if (distanceBetween(current, next) >= tolerance) {
        continue;
      }

      const outerAxis = getSegmentAxis(previous, after, tolerance);

      if (outerAxis) {
        // Al absorber el escalon, el punto exterior se pega al eje del
        // anterior: asi no queda una diagonal de 1-2 px.
        const snappedAfter = outerAxis === "horizontal"
          ? { ...after, y: previous.y }
          : { ...after, x: previous.x };

        result.splice(index, 2, snappedAfter);
      } else {
        const previousAxis = getSegmentAxis(previous, current, tolerance);
        const elbow = previousAxis === "horizontal"
          ? { x: after.x, y: current.y }
          : { x: current.x, y: after.y };

        result.splice(index, 2, elbow);
      }

      result = simplifyWirePoints(result);
      didChange = true;
      break;
    }
  }

  const cleanedFirst = result[0];
  const cleanedLast = result[result.length - 1];

  if (cleanedFirst && cleanedLast) {
    const straight = getStraightSegment(cleanedFirst, cleanedLast, tolerance);

    if (straight) {
      return straight;
    }
  }

  return result.length >= 2 ? result : points;
}

function resolveAttachedTerminal(
  portId: string | null,
  refs: ReadonlyMap<string, TerminalRef>
): TerminalRef | null {
  return portId ? refs.get(portId) ?? null : null;
}

/**
 * Un cable de 2 puntos no tiene quiebres. Un cable de 3 puntos es automatico
 * (un solo codo en L); si el codo no encaja con ninguno de los dos L posibles,
 * el usuario lo movio a mano y hay que conservarlo.
 */
function hasManualBends(wire: BuilderWire): boolean {
  if (wire.points.length > 3) {
    return true;
  }

  if (wire.points.length < 3) {
    return false;
  }

  const start = wire.points[0];
  const bend = wire.points[1];
  const end = wire.points[wire.points.length - 1];

  if (!start || !bend || !end) {
    return false;
  }

  const matchesAutomaticElbow = (
    Math.abs(bend.x - end.x) < EPSILON && Math.abs(bend.y - start.y) < EPSILON
  ) || (
    Math.abs(bend.x - start.x) < EPSILON && Math.abs(bend.y - end.y) < EPSILON
  );

  return !matchesAutomaticElbow;
}

function appendOrthogonal(
  path: Point[],
  target: Point,
  direction: Point,
  tolerance: number
): Point[] {
  const last = path[path.length - 1];

  if (!last) {
    return [...path, target];
  }

  if (samePoint(last, target)) {
    return [...path, target];
  }

  const straight = getStraightSegment(last, target, tolerance);

  if (straight) {
    return [...path, straight[1]!];
  }

  const connector = routeBetweenStubs(last, target, direction, { x: 0, y: 0 }, tolerance);

  return [...path, ...connector.slice(1)];
}

/**
 * Ruta VISUAL del cable. Los extremos se recalculan desde el terminal en cada
 * render; la pata corta hasta la rejilla pertenece al cable, no al glifo.
 */
export function resolveWireDisplayPoints(
  wire: BuilderWire,
  components: readonly BuilderComponent[],
  planeSettings: BuilderPlaneSettings
): Point[] {
  const refs = buildTerminalRefs(components);
  const startRef = resolveAttachedTerminal(wire.startPortId, refs);
  const endRef = resolveAttachedTerminal(wire.endPortId, refs);
  const storedStart = wire.points[0] ?? { x: 0, y: 0 };
  const storedEnd = wire.points[wire.points.length - 1] ?? storedStart;
  const startAnchor = startRef?.anchor ?? storedStart;
  const endAnchor = endRef?.anchor ?? storedEnd;
  const tolerance = planeSettings.gridSpacing * 0.25;

  if (startRef && endRef) {
    // Tolerancia, nunca igualdad exacta: si los bornes estan a <= 0.25 celdas
    // en un eje, el cable es UNA recta en ese eje. El extremo de salida absorbe
    // el residuo de 1-2 px bajo el anillo; nunca se emite una diagonal.
    const straight = getStraightSegment(startAnchor, endAnchor, tolerance);

    if (straight) {
      return straight;
    }

    const startStub = getTerminalStubEnd(startAnchor, startRef.direction, planeSettings);
    const endStub = getTerminalStubEnd(endAnchor, endRef.direction, planeSettings);

    if (hasManualBends(wire)) {
      const interior = wire.points.slice(1, -1);
      let path = [startAnchor, startStub];
      let direction = startRef.direction;

      for (const point of interior) {
        path = appendOrthogonal(path, point, direction, tolerance);
        direction = { x: 0, y: 0 };
      }

      path = appendOrthogonal(path, endStub, direction, tolerance);
      path.push(endAnchor);

      return collapseWireRoute(path, planeSettings.gridSpacing);
    }

    const middle = routeBetweenStubs(
      startStub,
      endStub,
      startRef.direction,
      endRef.direction,
      tolerance
    );

    return collapseWireRoute(
      [startAnchor, startStub, ...middle, endStub, endAnchor],
      planeSettings.gridSpacing
    );
  }

  if (startRef) {
    const startStub = getTerminalStubEnd(startAnchor, startRef.direction, planeSettings);

    if (hasManualBends(wire)) {
      const interior = wire.points.slice(1, -1);
      const looseEnd = wire.points[wire.points.length - 1] ?? endAnchor;
      let path = [startAnchor, startStub];
      let direction = startRef.direction;

      for (const point of interior) {
        path = appendOrthogonal(path, point, direction, tolerance);
        direction = { x: 0, y: 0 };
      }

      path = appendOrthogonal(path, looseEnd, direction, tolerance);

      return collapseWireRoute(path, planeSettings.gridSpacing);
    }

    const middle = routeBetweenStubs(
      startStub,
      endAnchor,
      startRef.direction,
      { x: 0, y: 0 },
      tolerance
    );

    return collapseWireRoute([startAnchor, startStub, ...middle], planeSettings.gridSpacing);
  }

  if (endRef) {
    const endStub = getTerminalStubEnd(endAnchor, endRef.direction, planeSettings);

    if (hasManualBends(wire)) {
      const interior = wire.points.slice(1, -1);
      const looseStart = wire.points[0] ?? startAnchor;
      let path = [looseStart];

      for (const point of interior) {
        path = appendOrthogonal(path, point, { x: 0, y: 0 }, tolerance);
      }

      path = appendOrthogonal(path, endStub, { x: 0, y: 0 }, tolerance);
      path.push(endAnchor);

      return collapseWireRoute(path, planeSettings.gridSpacing);
    }

    const middle = routeBetweenStubs(
      startAnchor,
      endStub,
      { x: 0, y: 0 },
      endRef.direction,
      tolerance
    );

    return collapseWireRoute(
      [startAnchor, ...middle, endStub, endAnchor],
      planeSettings.gridSpacing
    );
  }

  return wire.points;
}

export function getWireTerminalRoutes(
  wire: BuilderWire,
  components: readonly BuilderComponent[],
  planeSettings: BuilderPlaneSettings
): WireTerminalRoute[] {
  const refs = buildTerminalRefs(components);
  const routes: WireTerminalRoute[] = [];

  for (const portId of [wire.startPortId, wire.endPortId]) {
    const ref = resolveAttachedTerminal(portId, refs);

    if (!ref) {
      continue;
    }

    routes.push({
      anchor: ref.anchor,
      componentId: ref.component.id,
      direction: ref.direction,
      portId: ref.portId,
      stub: getTerminalStubEnd(ref.anchor, ref.direction, planeSettings),
      terminalId: ref.terminalId
    });
  }

  return routes;
}
