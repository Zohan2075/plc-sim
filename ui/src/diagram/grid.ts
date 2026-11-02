import {
  COMPONENT_HEIGHT,
  COMPONENT_WIDTH,
  DEFAULT_PLANE_SETTINGS,
  MAX_GRID_SPACING,
  MAX_PLANE_HEIGHT,
  MAX_PLANE_WIDTH,
  MIN_GRID_SPACING,
  MIN_PLANE_HEIGHT,
  MIN_PLANE_WIDTH,
  ROTATION_CENTER_X,
  ROTATION_CENTER_Y,
  clamp,
  getDefaultEntryTerminalId,
  getPortId,
  getTerminalDefinition,
  getTerminalDefinitions,
  getTerminalPoint,
  roundPoint,
  rotatePoint
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderPlaneSettings, BuilderScene, BuilderWire, Point } from "../DiagramBuilder";

export function clampPlaneWidth(value: number): number {
  return clamp(Math.round(value), MIN_PLANE_WIDTH, MAX_PLANE_WIDTH);
}

export function clampPlaneHeight(value: number): number {
  return clamp(Math.round(value), MIN_PLANE_HEIGHT, MAX_PLANE_HEIGHT);
}

export function clampGridSpacing(value: number): number {
  return clamp(Math.round(value), MIN_GRID_SPACING, MAX_GRID_SPACING);
}

export function sanitizePlaneSettings(settings: Partial<BuilderPlaneSettings> | undefined): BuilderPlaneSettings {
  return {
    gridSpacing: clampGridSpacing(settings?.gridSpacing ?? DEFAULT_PLANE_SETTINGS.gridSpacing),
    height: clampPlaneHeight(settings?.height ?? DEFAULT_PLANE_SETTINGS.height),
    width: clampPlaneWidth(settings?.width ?? DEFAULT_PLANE_SETTINGS.width)
  };
}

export function clampPointToPlane(point: Point, planeSettings: BuilderPlaneSettings, padding = 0): Point {
  return {
    x: clamp(point.x, padding, planeSettings.width - padding),
    y: clamp(point.y, padding, planeSettings.height - padding)
  };
}

export function snapPointToGrid(point: Point, planeSettings: BuilderPlaneSettings): Point {
  const gridSpacing = planeSettings.gridSpacing;

  return clampPointToPlane(
    {
      x: Math.round(point.x / gridSpacing) * gridSpacing,
      y: Math.round(point.y / gridSpacing) * gridSpacing
    },
    planeSettings
  );
}

export function getCanonicalWirePoint(point: Point, planeSettings?: BuilderPlaneSettings): Point {
  return planeSettings ? snapPointToGrid(point, planeSettings) : roundPoint(point);
}

export function requantizeCoordinateToGrid(value: number, previousSpacing: number, nextSpacing: number): number {
  if (previousSpacing === nextSpacing) {
    return value;
  }

  return Math.round(value / previousSpacing) * nextSpacing;
}

export function requantizePointToPlaneGrid(
  point: Point,
  previousPlaneSettings: BuilderPlaneSettings,
  nextPlaneSettings: BuilderPlaneSettings
): Point {
  return clampPointToPlane(
    {
      x: requantizeCoordinateToGrid(point.x, previousPlaneSettings.gridSpacing, nextPlaneSettings.gridSpacing),
      y: requantizeCoordinateToGrid(point.y, previousPlaneSettings.gridSpacing, nextPlaneSettings.gridSpacing)
    },
    nextPlaneSettings
  );
}

/** Padding is always a multiple of `gridSpacing` so grid multiples never break under clamping. */
export function getComponentPlanePadding(planeSettings: BuilderPlaneSettings): number {
  const minPadding = Math.max(planeSettings.gridSpacing, 16);

  return Math.ceil(minPadding / planeSettings.gridSpacing) * planeSettings.gridSpacing;
}

export function getComponentPlaneSnapOffset(component: BuilderComponent, terminalId?: string): Point {
  const anchorTerminal = getTerminalDefinition(
    component.type,
    terminalId ?? getDefaultEntryTerminalId(component.type)
  );

  if (!anchorTerminal) {
    return {
      x: ROTATION_CENTER_X,
      y: ROTATION_CENTER_Y
    };
  }

  return rotatePoint({ x: anchorTerminal.x, y: anchorTerminal.y }, component.rotation);
}

/**
 * Direccion hacia FUERA del glifo para un borne. Se calcula desde el centro de
 * rotacion del simbolo, no desde la caja del componente: asi un borne izquierdo
 * siempre sale hacia la izquierda aunque el componente este rotado.
 */
export function getTerminalOutwardDirection(component: BuilderComponent, terminalId: string): Point {
  const terminal = getTerminalDefinition(component.type, terminalId);

  if (!terminal) {
    return { x: 0, y: 0 };
  }

  const rotatedPoint = rotatePoint({ x: terminal.x, y: terminal.y }, component.rotation);
  const dx = rotatedPoint.x - ROTATION_CENTER_X;
  const dy = rotatedPoint.y - ROTATION_CENTER_Y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: dx >= 0 ? 1 : -1, y: 0 };
  }

  return { x: 0, y: dy >= 0 ? 1 : -1 };
}

/**
 * Punto de rejilla mas cercano en la direccion de salida del borne. La pata
 * pertenece al CABLE: el glifo no se toca.
 */
export function getTerminalStubEnd(
  anchor: Point,
  direction: Point,
  planeSettings: BuilderPlaneSettings
): Point {
  const gridSpacing = planeSettings.gridSpacing;

  if (direction.x !== 0) {
    const x = direction.x > 0
      ? Math.floor(anchor.x / gridSpacing) * gridSpacing + gridSpacing
      : Math.ceil(anchor.x / gridSpacing) * gridSpacing - gridSpacing;

    return clampPointToPlane({ x, y: anchor.y }, planeSettings);
  }

  if (direction.y !== 0) {
    const y = direction.y > 0
      ? Math.floor(anchor.y / gridSpacing) * gridSpacing + gridSpacing
      : Math.ceil(anchor.y / gridSpacing) * gridSpacing - gridSpacing;

    return clampPointToPlane({ x: anchor.x, y }, planeSettings);
  }

  return anchor;
}

export function requantizeComponentToPlaneGrid(
  component: BuilderComponent,
  previousPlaneSettings: BuilderPlaneSettings,
  nextPlaneSettings: BuilderPlaneSettings
): BuilderComponent {
  const padding = getComponentPlanePadding(nextPlaneSettings);
  const snapOffset = getComponentPlaneSnapOffset(component);
  const nextAnchorX = requantizeCoordinateToGrid(
    component.x + snapOffset.x,
    previousPlaneSettings.gridSpacing,
    nextPlaneSettings.gridSpacing
  );
  const nextAnchorY = requantizeCoordinateToGrid(
    component.y + snapOffset.y,
    previousPlaneSettings.gridSpacing,
    nextPlaneSettings.gridSpacing
  );

  return {
    ...component,
    x: clamp(
      nextAnchorX - snapOffset.x,
      padding,
      nextPlaneSettings.width - COMPONENT_WIDTH - padding
    ),
    y: clamp(
      nextAnchorY - snapOffset.y,
      padding,
      nextPlaneSettings.height - COMPONENT_HEIGHT - padding
    )
  };
}

export function snapComponentToPlaneGrid(
  component: BuilderComponent,
  planeSettings: BuilderPlaneSettings,
  terminalId?: string
): BuilderComponent {
  const padding = getComponentPlanePadding(planeSettings);
  const snapOffset = getComponentPlaneSnapOffset(component, terminalId);
  const anchorX = Math.round((component.x + snapOffset.x) / planeSettings.gridSpacing) * planeSettings.gridSpacing;
  const anchorY = Math.round((component.y + snapOffset.y) / planeSettings.gridSpacing) * planeSettings.gridSpacing;

  return {
    ...component,
    x: clamp(
      anchorX - snapOffset.x,
      padding,
      planeSettings.width - COMPONENT_WIDTH - padding
    ),
    y: clamp(
      anchorY - snapOffset.y,
      padding,
      planeSettings.height - COMPONENT_HEIGHT - padding
    )
  };
}

export function clampComponentToPlane(component: BuilderComponent, planeSettings: BuilderPlaneSettings): BuilderComponent {
  const padding = getComponentPlanePadding(planeSettings);

  return {
    ...component,
    x: clamp(component.x, padding, planeSettings.width - COMPONENT_WIDTH - padding),
    y: clamp(component.y, padding, planeSettings.height - COMPONENT_HEIGHT - padding)
  };
}

export function clampWireToPlane(wire: BuilderWire, planeSettings: BuilderPlaneSettings): BuilderWire {
  const points: Point[] = [];

  for (const point of wire.points) {
    const clampedPoint = clampPointToPlane(point, planeSettings);
    const previousPoint = points[points.length - 1];

    if (
      previousPoint
      && Math.abs(previousPoint.x - clampedPoint.x) < 0.001
      && Math.abs(previousPoint.y - clampedPoint.y) < 0.001
    ) {
      continue;
    }

    points.push(clampedPoint);
  }

  // No se limpian quiebres ni vertices de union aqui: un clamp de tamano no
  // debe borrar el nodo de una T. Solo se deduplican puntos identicos.
  return { ...wire, points };
}

/** Clamp-only: no snapea ni mueve nada que ya quepa en el plano. */
export function clampSceneBounds(scene: BuilderScene, planeSettings: BuilderPlaneSettings): BuilderScene {
  const nextComponents = scene.components.map((component) => ({ ...component }));
  let nextWires = scene.wires.map((wire) => ({
    ...wire,
    points: wire.points.map((point) => ({ ...point }))
  }));

  for (let index = 0; index < nextComponents.length; index += 1) {
    const currentComponent = nextComponents[index];

    if (!currentComponent) {
      continue;
    }

    const clampedComponent = clampComponentToPlane(currentComponent, planeSettings);

    if (clampedComponent.x === currentComponent.x && clampedComponent.y === currentComponent.y) {
      continue;
    }

    nextComponents[index] = clampedComponent;
    nextWires = moveAttachedWireEndpoints(
      nextWires,
      currentComponent,
      clampedComponent,
      planeSettings.gridSpacing
    );
  }

  return {
    components: nextComponents,
    wires: nextWires.map((wire) => clampWireToPlane(wire, planeSettings))
  };
}

export function clampSceneToPlane(scene: BuilderScene, planeSettings: BuilderPlaneSettings): BuilderScene {
  const nextComponents = scene.components.map((component) => ({ ...component }));
  let nextWires = scene.wires.map((wire) => ({
    ...wire,
    points: wire.points.map((point) => ({ ...point }))
  }));

  for (let index = 0; index < nextComponents.length; index += 1) {
    const currentComponent = nextComponents[index];

    if (!currentComponent) {
      continue;
    }

    const nextComponent = snapComponentToPlaneGrid(clampComponentToPlane(currentComponent, planeSettings), planeSettings);

    if (nextComponent.x === currentComponent.x && nextComponent.y === currentComponent.y) {
      continue;
    }

    nextComponents[index] = nextComponent;
    nextWires = moveAttachedWireEndpoints(
      nextWires,
      currentComponent,
      nextComponent,
      planeSettings.gridSpacing
    );
  }

  return {
    components: nextComponents,
    wires: nextWires.map((wire) => clampWireToPlane(wire, planeSettings))
  };
}

export function requantizeSceneToPlaneGrid(
  scene: BuilderScene,
  previousPlaneSettings: BuilderPlaneSettings,
  nextPlaneSettings: BuilderPlaneSettings
): BuilderScene {
  const nextScene: BuilderScene = {
    components: scene.components.map((component) =>
      requantizeComponentToPlaneGrid(component, previousPlaneSettings, nextPlaneSettings)
    ),
    wires: scene.wires.map((wire) => ({
      ...wire,
      points: normalizeWirePoints(
        wire.points.map((point) => requantizePointToPlaneGrid(point, previousPlaneSettings, nextPlaneSettings)),
        nextPlaneSettings
      )
    }))
  };

  return clampSceneToPlane(nextScene, nextPlaneSettings);
}

export function createOrthogonalPath(currentPoints: Point[], targetPoint: Point, planeSettings: BuilderPlaneSettings): Point[] {
  if (currentPoints.length === 0) {
    return [targetPoint];
  }

  const previousPoint = currentPoints[currentPoints.length - 1];

  if (!previousPoint) {
    return [targetPoint];
  }

  if (pointsAreClose(previousPoint, targetPoint)) {
    return currentPoints;
  }

  const tolerance = planeSettings.gridSpacing * 0.25;
  const deltaX = targetPoint.x - previousPoint.x;
  const deltaY = targetPoint.y - previousPoint.y;
  const withinX = Math.abs(deltaX) <= tolerance;
  const withinY = Math.abs(deltaY) <= tolerance;

  // Cerca de la alineacion: un solo tramo recto en el eje dominante. Nunca
  // se emite una diagonal de 1-2 px.
  if (withinX || withinY) {
    const alignToX = withinX && (!withinY || Math.abs(deltaX) <= Math.abs(deltaY));

    return [
      ...currentPoints,
      alignToX
        ? { x: previousPoint.x, y: targetPoint.y }
        : { x: targetPoint.x, y: previousPoint.y }
    ];
  }

  const beforePreviousPoint = currentPoints[currentPoints.length - 2] ?? null;
  const prefersVerticalFirst = beforePreviousPoint !== null
    && Math.abs(beforePreviousPoint.x - previousPoint.x) <= tolerance;
  const elbow = prefersVerticalFirst
    ? { x: previousPoint.x, y: targetPoint.y }
    : { x: targetPoint.x, y: previousPoint.y };
  const snappedElbow = clampPointToPlane(elbow, planeSettings);

  return cleanWirePath([...currentPoints, snappedElbow, targetPoint]);
}

export function distanceBetween(left: Point, right: Point): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return Math.hypot(dx, dy);
}

export function pointsShareCanonicalCoordinates(left: Point, right: Point, planeSettings?: BuilderPlaneSettings): boolean {
  const normalizedLeft = getCanonicalWirePoint(left, planeSettings);
  const normalizedRight = getCanonicalWirePoint(right, planeSettings);

  return normalizedLeft.x === normalizedRight.x && normalizedLeft.y === normalizedRight.y;
}

export function pointsAreClose(left: Point, right: Point): boolean {
  return distanceBetween(left, right) < 3;
}

export function normalizeWirePoints(points: Point[], planeSettings?: BuilderPlaneSettings): Point[] {
  const normalized: Point[] = [];

  for (const point of points) {
    const canonicalPoint = getCanonicalWirePoint(point, planeSettings);
    const previousPoint = normalized[normalized.length - 1];

    if (!previousPoint || !pointsShareCanonicalCoordinates(previousPoint, canonicalPoint, planeSettings)) {
      normalized.push(canonicalPoint);
    }
  }

  return normalized;
}

/**
 * Limpieza de un trazado ya existente: NO cuantiza a la rejilla. Solo elimina
 * puntos duplicados y quiebres menores que `tolerance` px (los escalones de
 * 1-2 px que dejan los cambios de geometria). Los extremos se conservan tal
 * cual, que es lo que permite clavarlos en un borne o en una union.
 */
export function cleanWirePath(points: Point[], tolerance = 3): Point[] {
  const deduped: Point[] = [];

  for (const point of points) {
    const previousPoint = deduped[deduped.length - 1];

    if (
      previousPoint
      && Math.abs(previousPoint.x - point.x) < 0.001
      && Math.abs(previousPoint.y - point.y) < 0.001
    ) {
      continue;
    }

    deduped.push(point);
  }

  if (deduped.length <= 2) {
    return deduped;
  }

  const cleaned: Point[] = [deduped[0]!];

  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previousPoint = cleaned[cleaned.length - 1];
    const currentPoint = deduped[index];
    const nextPoint = deduped[index + 1];

    if (!previousPoint || !currentPoint || !nextPoint) {
      continue;
    }

    const area = Math.abs(
      (currentPoint.x - previousPoint.x) * (nextPoint.y - previousPoint.y)
      - (currentPoint.y - previousPoint.y) * (nextPoint.x - previousPoint.x)
    );
    const base = Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y);
    const distanceToLine = base > 0
      ? area / base
      : Math.hypot(currentPoint.x - previousPoint.x, currentPoint.y - previousPoint.y);
    // Solo se puede eliminar el quiebre si los vecinos quedan alineados en un
    // eje; si no, eliminarlo convertiria el tramo en diagonal.
    const neighborsAligned = Math.abs(previousPoint.x - nextPoint.x) < 0.001
      || Math.abs(previousPoint.y - nextPoint.y) < 0.001;

    if (neighborsAligned && distanceToLine <= tolerance) {
      continue;
    }

    cleaned.push(currentPoint);
  }

  const lastPoint = deduped[deduped.length - 1];

  if (lastPoint) {
    cleaned.push(lastPoint);
  }

  return cleanDuplicateTail(cleaned);
}

function cleanDuplicateTail(points: Point[]): Point[] {
  const result: Point[] = [];

  for (const point of points) {
    const previousPoint = result[result.length - 1];

    if (
      previousPoint
      && Math.abs(previousPoint.x - point.x) < 0.001
      && Math.abs(previousPoint.y - point.y) < 0.001
    ) {
      continue;
    }

    result.push(point);
  }

  return result;
}

function arePointsCollinear(left: Point, middle: Point, right: Point): boolean {
  const crossProduct = (middle.x - left.x) * (right.y - left.y) - (middle.y - left.y) * (right.x - left.x);
  return Math.abs(crossProduct) < 0.5;
}

export function simplifyWirePoints(points: Point[]): Point[] {
  const normalized = cleanWirePath(points);

  if (normalized.length <= 2) {
    return normalized;
  }

  const firstPoint = normalized[0];

  if (!firstPoint) {
    return normalized;
  }

  const simplified: Point[] = [firstPoint];

  for (let index = 1; index < normalized.length - 1; index += 1) {
    const previousPoint = simplified[simplified.length - 1];
    const currentPoint = normalized[index];
    const nextPoint = normalized[index + 1];

    if (!previousPoint || !currentPoint || !nextPoint) {
      continue;
    }

    if (arePointsCollinear(previousPoint, currentPoint, nextPoint)) {
      continue;
    }

    simplified.push(currentPoint);
  }

  const lastPoint = normalized[normalized.length - 1];
  const previousPoint = simplified[simplified.length - 1];

  if (
    lastPoint
    && (!previousPoint
      || Math.abs(previousPoint.x - lastPoint.x) >= 0.001
      || Math.abs(previousPoint.y - lastPoint.y) >= 0.001)
  ) {
    simplified.push(lastPoint);
  }

  return simplified.length >= 2 ? simplified : normalized;
}

export function getSegmentAxis(
  start: Point,
  end: Point,
  tolerance = 1
): "horizontal" | "vertical" | null {
  if (Math.abs(start.x - end.x) <= tolerance) {
    return "vertical";
  }

  if (Math.abs(start.y - end.y) <= tolerance) {
    return "horizontal";
  }

  return null;
}

function buildEndpointElbow(fromPoint: Point, endpointPoint: Point, preferredAxis: "horizontal" | "vertical"): Point {
  return preferredAxis === "horizontal"
    ? { x: fromPoint.x, y: endpointPoint.y }
    : { x: endpointPoint.x, y: fromPoint.y };
}

export function repositionWireEndpointOrthogonally(
  points: Point[],
  endpointIndex: number,
  endpointPoint: Point,
  preferredAxis: "horizontal" | "vertical",
  tolerance = 1
): Point[] {
  if (points.length < 2 || !isWireEndpointIndex(endpointIndex, points.length)) {
    return points;
  }

  const nextPoints = [...points];
  nextPoints[endpointIndex] = endpointPoint;

  const adjacentIndex = endpointIndex === 0 ? 1 : nextPoints.length - 2;
  const adjacentPoint = nextPoints[adjacentIndex];

  if (!adjacentPoint) {
    return nextPoints;
  }

  if (getSegmentAxis(adjacentPoint, endpointPoint, tolerance) !== null) {
    return cleanWirePath(nextPoints);
  }

  const outerIndex = endpointIndex === 0 ? 2 : nextPoints.length - 3;
  const outerPoint = nextPoints[outerIndex];

  if (!outerPoint) {
    const elbowPoint = buildEndpointElbow(adjacentPoint, endpointPoint, preferredAxis);

    return endpointIndex === 0
      ? cleanWirePath([endpointPoint, elbowPoint, ...nextPoints.slice(1)])
      : cleanWirePath([...nextPoints.slice(0, -1), elbowPoint, endpointPoint]);
  }

  const outerAxis = getSegmentAxis(adjacentPoint, outerPoint, tolerance);
  const canAdjustAdjacent = (preferredAxis === "horizontal" && outerAxis === "vertical")
    || (preferredAxis === "vertical" && outerAxis === "horizontal");

  if (canAdjustAdjacent) {
    nextPoints[adjacentIndex] = buildEndpointElbow(adjacentPoint, endpointPoint, preferredAxis);
    return cleanWirePath(nextPoints);
  }

  const elbowPoint = buildEndpointElbow(adjacentPoint, endpointPoint, preferredAxis);

  return endpointIndex === 0
    ? cleanWirePath([endpointPoint, elbowPoint, ...nextPoints.slice(1)])
    : cleanWirePath([...nextPoints.slice(0, -1), elbowPoint, endpointPoint]);
}

export function isWireEndpointIndex(index: number, pointCount: number): boolean {
  return index === 0 || index === pointCount - 1;
}

export function getWireSegmentMidpoint(left: Point, right: Point): Point {
  return {
    x: Math.round((left.x + right.x) / 2),
    y: Math.round((left.y + right.y) / 2)
  };
}

export function getTerminalApproachAxis(component: BuilderComponent, terminalId: string): "horizontal" | "vertical" {
  const direction = getTerminalOutwardDirection(component, terminalId);

  return direction.x !== 0 ? "horizontal" : "vertical";
}

export function moveAttachedWireEndpoints(
  wires: BuilderWire[],
  previousComponent: BuilderComponent,
  nextComponent: BuilderComponent,
  gridSpacing = 18
): BuilderWire[] {
  const tolerance = gridSpacing * 0.25;
  const movedTerminalPoints = new Map(
    getTerminalDefinitions(previousComponent.type).map((terminal) => [
      getPortId(previousComponent.id, terminal.id),
      {
        axis: getTerminalApproachAxis(nextComponent, terminal.id),
        point: getTerminalPoint(nextComponent, terminal.id)
      }
    ])
  );

  return wires.map((wire) => {
    if (wire.points.length === 0) {
      return wire;
    }

    let nextPoints = wire.points;
    let didMove = false;
    const startTerminal = wire.startPortId ? movedTerminalPoints.get(wire.startPortId) : undefined;
    const endTerminal = wire.endPortId ? movedTerminalPoints.get(wire.endPortId) : undefined;

    if (startTerminal) {
      nextPoints = repositionWireEndpointOrthogonally(
        nextPoints,
        0,
        startTerminal.point,
        startTerminal.axis,
        tolerance
      );
      didMove = true;
    }

    if (endTerminal) {
      nextPoints = repositionWireEndpointOrthogonally(
        nextPoints,
        nextPoints.length - 1,
        endTerminal.point,
        endTerminal.axis,
        tolerance
      );
      didMove = true;
    }

    return didMove ? { ...wire, points: simplifyWirePoints(nextPoints) } : wire;
  });
}
