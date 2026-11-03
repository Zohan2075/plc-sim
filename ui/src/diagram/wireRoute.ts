import {
  COMPONENT_WIDTH,
  ROTATION_CENTER_Y,
  SYMBOL_VIEWPORT_HEIGHT,
  SYMBOL_VIEWPORT_TOP,
  getComponentTerminals,
  getPortId,
  getTerminalDefinitions,
  getTerminalPoint
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderPlaneSettings, BuilderWire, Point } from "../DiagramBuilder";
import {
  clampPointToPlane,
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

interface ComponentBodyBox {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const BODY_INSET = 1;

/**
 * Caja del CUERPO dibujado, no la caja completa de 160x136: los bornes quedan
 * sobre el borde del cuerpo. Asi un cable puede salir/entrar por su borne sin
 * contar como cruce, pero un tramo que se mete hacia el centro si cruza.
 */
function getComponentBodyBox(component: BuilderComponent): ComponentBodyBox {
  const terminals = getComponentTerminals(component);
  const terminalXs = terminals.map((terminal) => terminal.x);
  const terminalYs = terminals.map((terminal) => terminal.y);
  const minTerminalX = Math.min(...terminalXs);
  const maxTerminalX = Math.max(...terminalXs);
  const minTerminalY = Math.min(...terminalYs);
  const maxTerminalY = Math.max(...terminalYs);
  const rotation = ((component.rotation % 4) + 4) % 4;
  const centerX = component.x + COMPONENT_WIDTH / 2;
  const centerY = component.y + ROTATION_CENTER_Y;
  const halfGlyphWidth = COMPONENT_WIDTH / 2;
  const halfGlyphHeight = SYMBOL_VIEWPORT_HEIGHT / 2;
  const glyphLeft = rotation % 2 === 0 ? component.x : centerX - halfGlyphHeight;
  const glyphRight = rotation % 2 === 0 ? component.x + COMPONENT_WIDTH : centerX + halfGlyphHeight;
  const glyphTop = rotation % 2 === 0 ? component.y + SYMBOL_VIEWPORT_TOP : centerY - halfGlyphWidth;
  const glyphBottom = rotation % 2 === 0
    ? component.y + SYMBOL_VIEWPORT_TOP + SYMBOL_VIEWPORT_HEIGHT
    : centerY + halfGlyphWidth;

  if (maxTerminalX - minTerminalX >= maxTerminalY - minTerminalY) {
    return {
      bottom: glyphBottom,
      left: minTerminalX,
      right: maxTerminalX,
      top: glyphTop
    };
  }

  return {
    bottom: maxTerminalY,
    left: glyphLeft,
    right: glyphRight,
    top: minTerminalY
  };
}

function segmentIntersectsBoxInterior(start: Point, end: Point, box: ComponentBodyBox): boolean {
  const left = box.left + BODY_INSET;
  const right = box.right - BODY_INSET;
  const top = box.top + BODY_INSET;
  const bottom = box.bottom - BODY_INSET;

  if (right <= left || bottom <= top) {
    return false;
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  let entry = 0;
  let exit = 1;

  const clip = (origin: number, delta: number, min: number, max: number): boolean => {
    if (Math.abs(delta) < 0.001) {
      return origin >= min && origin <= max;
    }

    let near = (min - origin) / delta;
    let far = (max - origin) / delta;

    if (near > far) {
      [near, far] = [far, near];
    }

    entry = Math.max(entry, near);
    exit = Math.min(exit, far);

    return entry <= exit;
  };

  if (!clip(start.x, deltaX, left, right)) {
    return false;
  }

  if (!clip(start.y, deltaY, top, bottom)) {
    return false;
  }

  return exit - entry > 0.01;
}

function routeCrossesComponentBody(
  points: Point[],
  startComponent: BuilderComponent,
  endComponent: BuilderComponent
): boolean {
  if (points.length < 2) {
    return false;
  }

  const boxes = [getComponentBodyBox(startComponent), getComponentBodyBox(endComponent)];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    if (!start || !end) {
      continue;
    }

    for (const box of boxes) {
      if (segmentIntersectsBoxInterior(start, end, box)) {
        return true;
      }
    }
  }

  return false;
}

function buildLCandidates(start: Point, end: Point): Point[][] {
  if (samePoint(start, end)) {
    return [];
  }

  return [
    [start, { x: end.x, y: start.y }, end],
    [start, { x: start.x, y: end.y }, end]
  ];
}

function buildZCandidates(start: Point, end: Point): Point[][] {
  if (samePoint(start, end)) {
    return [];
  }

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return [
    [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
    [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
  ];
}

/** Punto de rejilla fuera del cuerpo, en la direccion de salida del borne. */
function getStubOutsideBody(
  component: BuilderComponent,
  anchor: Point,
  direction: Point,
  planeSettings: BuilderPlaneSettings
): Point {
  const box = getComponentBodyBox(component);
  const gridSpacing = planeSettings.gridSpacing;

  if (direction.x > 0) {
    const target = Math.ceil((Math.max(anchor.x, box.right) + 0.001) / gridSpacing) * gridSpacing;
    const x = target > anchor.x ? target : target + gridSpacing;

    return clampPointToPlane({ x, y: anchor.y }, planeSettings);
  }

  if (direction.x < 0) {
    const target = Math.floor((Math.min(anchor.x, box.left) - 0.001) / gridSpacing) * gridSpacing;
    const x = target < anchor.x ? target : target - gridSpacing;

    return clampPointToPlane({ x, y: anchor.y }, planeSettings);
  }

  if (direction.y > 0) {
    const target = Math.ceil((Math.max(anchor.y, box.bottom) + 0.001) / gridSpacing) * gridSpacing;
    const y = target > anchor.y ? target : target + gridSpacing;

    return clampPointToPlane({ x: anchor.x, y }, planeSettings);
  }

  if (direction.y < 0) {
    const target = Math.floor((Math.min(anchor.y, box.top) - 0.001) / gridSpacing) * gridSpacing;
    const y = target < anchor.y ? target : target - gridSpacing;

    return clampPointToPlane({ x: anchor.x, y }, planeSettings);
  }

  return anchor;
}

type RouteCandidateKind = "direct-l" | "stub-l" | "z";

interface RouteCandidate {
  kind: RouteCandidateKind;
  points: Point[];
}

function buildRouteCandidates(
  startAnchor: Point,
  endAnchor: Point,
  startRef: TerminalRef,
  endRef: TerminalRef,
  planeSettings: BuilderPlaneSettings
): RouteCandidate[] {
  const startStub = getStubOutsideBody(
    startRef.component,
    startAnchor,
    startRef.direction,
    planeSettings
  );
  const endStub = getStubOutsideBody(
    endRef.component,
    endAnchor,
    endRef.direction,
    planeSettings
  );
  const candidates: RouteCandidate[] = [];
  const seen = new Set<string>();
  const add = (kind: RouteCandidateKind, points: Point[]): void => {
    const key = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join("|");

    if (seen.has(key) || points.length < 2) {
      return;
    }

    seen.add(key);
    candidates.push({ kind, points });
  };

  for (const points of buildLCandidates(startAnchor, endAnchor)) {
    add("direct-l", points);
  }

  for (const points of buildLCandidates(startStub, endAnchor)) {
    add("stub-l", [startAnchor, startStub, ...points.slice(1)]);
  }

  for (const points of buildLCandidates(startAnchor, endStub)) {
    add("stub-l", [...points, endAnchor]);
  }

  for (const points of buildLCandidates(startStub, endStub)) {
    add("stub-l", [startAnchor, startStub, ...points.slice(1), endAnchor]);
  }

  for (const points of buildZCandidates(startAnchor, endAnchor)) {
    add("z", points);
  }

  for (const points of buildZCandidates(startStub, endAnchor)) {
    add("z", [startAnchor, startStub, ...points.slice(1)]);
  }

  for (const points of buildZCandidates(startAnchor, endStub)) {
    add("z", [...points, endAnchor]);
  }

  for (const points of buildZCandidates(startStub, endStub)) {
    add("z", [startAnchor, startStub, ...points.slice(1), endAnchor]);
  }

  return candidates;
}

function getRouteBends(points: Point[]): number {
  return Math.max(points.length - 2, 0);
}

function getAxisPreference(points: Point[], startDirection: Point, endDirection: Point): number {
  if (points.length < 2) {
    return 0;
  }

  const first = points[0]!;
  const second = points[1]!;
  const penultimate = points[points.length - 2]!;
  const last = points[points.length - 1]!;
  const firstX = Math.sign(second.x - first.x);
  const firstY = Math.sign(second.y - first.y);
  const lastX = Math.sign(last.x - penultimate.x);
  const lastY = Math.sign(last.y - penultimate.y);
  let score = 0;

  if (startDirection.x !== 0 && firstX === startDirection.x) {
    score += 1;
  }

  if (startDirection.y !== 0 && firstY === startDirection.y) {
    score += 1;
  }

  if (endDirection.x !== 0 && lastX === -endDirection.x) {
    score += 1;
  }

  if (endDirection.y !== 0 && lastY === -endDirection.y) {
    score += 1;
  }

  return score;
}

function chooseBestCandidate(
  candidates: RouteCandidate[],
  startDirection: Point,
  endDirection: Point,
  startComponent: BuilderComponent,
  endComponent: BuilderComponent,
  gridSpacing: number
): Point[] {
  const evaluated = candidates.map((candidate) => {
    const points = collapseWireRoute(candidate.points, gridSpacing);

    return {
      ...candidate,
      points,
      crossesBody: routeCrossesComponentBody(points, startComponent, endComponent)
    };
  });
  const valid = evaluated.filter((candidate) => !candidate.crossesBody);
  const pool = valid.length > 0 ? valid : evaluated;

  pool.sort((left, right) => {
    // (1) Menos quiebres. Un L directo (1) gana a cualquier Z/U (2+).
    const bendDelta = getRouteBends(left.points) - getRouteBends(right.points);

    if (bendDelta !== 0) {
      return bendDelta;
    }

    // (2) Preferencia de eje de salida/entrada; nunca es una restriccion.
    const axisDelta = getAxisPreference(right.points, startDirection, endDirection)
      - getAxisPreference(left.points, startDirection, endDirection);

    if (axisDelta !== 0) {
      return axisDelta;
    }

    return getRouteLength(left.points) - getRouteLength(right.points);
  });

  return pool[0]!.points;
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

      // Para borrar un punto colineal se exige alineacion EXACTA en el eje
      // perpendicular. Usar la tolerancia aqui borraba un stub de 2 px y
      // convertia el tramo siguiente en diagonal.
      const sameLine = previousAxis === "horizontal"
        ? Math.abs(previous.y - current.y) < EPSILON && Math.abs(current.y - next.y) < EPSILON
        : Math.abs(previous.x - current.x) < EPSILON && Math.abs(current.x - next.x) < EPSILON;

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

    if (hasManualBends(wire)) {
      const startStub = getTerminalStubEnd(startAnchor, startRef.direction, planeSettings);
      const endStub = getTerminalStubEnd(endAnchor, endRef.direction, planeSettings);
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

    const candidates = buildRouteCandidates(startAnchor, endAnchor, startRef, endRef, planeSettings);

    return collapseWireRoute(
      chooseBestCandidate(
        candidates,
        startRef.direction,
        endRef.direction,
        startRef.component,
        endRef.component,
        planeSettings.gridSpacing
      ),
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
