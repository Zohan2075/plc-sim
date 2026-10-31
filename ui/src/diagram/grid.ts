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

export function getComponentPlaneSnapOffset(component: BuilderComponent): Point {
  const anchorTerminal = getTerminalDefinition(component.type, getDefaultEntryTerminalId(component.type));

  if (!anchorTerminal) {
    return {
      x: ROTATION_CENTER_X,
      y: ROTATION_CENTER_Y
    };
  }

  return rotatePoint({ x: anchorTerminal.x, y: anchorTerminal.y }, component.rotation);
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

export function snapComponentToPlaneGrid(component: BuilderComponent, planeSettings: BuilderPlaneSettings): BuilderComponent {
  const padding = getComponentPlanePadding(planeSettings);
  const snapOffset = getComponentPlaneSnapOffset(component);
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
  return {
    ...wire,
    points: normalizeWirePoints(wire.points.map((point) => clampPointToPlane(point, planeSettings)), planeSettings)
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
    nextWires = moveAttachedWireEndpoints(nextWires, currentComponent, nextComponent);
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

  if (previousPoint.x === targetPoint.x || previousPoint.y === targetPoint.y) {
    return [...currentPoints, targetPoint];
  }

  const beforePreviousPoint = currentPoints[currentPoints.length - 2] ?? null;
  const prefersVerticalFirst = beforePreviousPoint !== null && beforePreviousPoint.x === previousPoint.x;
  const elbow = prefersVerticalFirst
    ? { x: previousPoint.x, y: targetPoint.y }
    : { x: targetPoint.x, y: previousPoint.y };
  const snappedElbow = clampPointToPlane(elbow, planeSettings);

  return normalizeWirePoints([...currentPoints, snappedElbow, targetPoint], planeSettings);
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

function arePointsCollinear(left: Point, middle: Point, right: Point): boolean {
  const crossProduct = (middle.x - left.x) * (right.y - left.y) - (middle.y - left.y) * (right.x - left.x);
  return Math.abs(crossProduct) < 0.5;
}

export function simplifyWirePoints(points: Point[]): Point[] {
  const normalized = normalizeWirePoints(points);

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

  if (lastPoint && !pointsAreClose(simplified[simplified.length - 1] ?? lastPoint, lastPoint)) {
    simplified.push(lastPoint);
  }

  return simplified.length >= 2 ? simplified : normalized;
}

export function getSegmentAxis(start: Point, end: Point): "horizontal" | "vertical" | null {
  if (Math.abs(start.x - end.x) < 1) {
    return "vertical";
  }

  if (Math.abs(start.y - end.y) < 1) {
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
  preferredAxis: "horizontal" | "vertical"
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

  if (getSegmentAxis(adjacentPoint, endpointPoint) !== null) {
    return normalizeWirePoints(nextPoints);
  }

  const outerIndex = endpointIndex === 0 ? 2 : nextPoints.length - 3;
  const outerPoint = nextPoints[outerIndex];

  if (!outerPoint) {
    const elbowPoint = buildEndpointElbow(adjacentPoint, endpointPoint, preferredAxis);

    return endpointIndex === 0
      ? normalizeWirePoints([endpointPoint, elbowPoint, ...nextPoints.slice(1)])
      : normalizeWirePoints([...nextPoints.slice(0, -1), elbowPoint, endpointPoint]);
  }

  const outerAxis = getSegmentAxis(adjacentPoint, outerPoint);
  const canAdjustAdjacent = (preferredAxis === "horizontal" && outerAxis === "vertical")
    || (preferredAxis === "vertical" && outerAxis === "horizontal");

  if (canAdjustAdjacent) {
    nextPoints[adjacentIndex] = buildEndpointElbow(adjacentPoint, endpointPoint, preferredAxis);
    return normalizeWirePoints(nextPoints);
  }

  const elbowPoint = buildEndpointElbow(adjacentPoint, endpointPoint, preferredAxis);

  return endpointIndex === 0
    ? normalizeWirePoints([endpointPoint, elbowPoint, ...nextPoints.slice(1)])
    : normalizeWirePoints([...nextPoints.slice(0, -1), elbowPoint, endpointPoint]);
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
  const terminal = getTerminalDefinition(component.type, terminalId);

  if (!terminal) {
    return "horizontal";
  }

  const rotatedPoint = rotatePoint({ x: terminal.x, y: terminal.y }, component.rotation);
  const horizontalDistance = Math.abs(rotatedPoint.x - ROTATION_CENTER_X);
  const verticalDistance = Math.abs(rotatedPoint.y - ROTATION_CENTER_Y);

  return horizontalDistance >= verticalDistance ? "horizontal" : "vertical";
}

export function moveAttachedWireEndpoints(
  wires: BuilderWire[],
  previousComponent: BuilderComponent,
  nextComponent: BuilderComponent
): BuilderWire[] {
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

    if (startTerminal && !pointsAreClose(wire.points[0] ?? startTerminal.point, startTerminal.point)) {
      nextPoints = repositionWireEndpointOrthogonally(nextPoints, 0, startTerminal.point, startTerminal.axis);
      didMove = true;
    }

    if (endTerminal && !pointsAreClose(wire.points[wire.points.length - 1] ?? endTerminal.point, endTerminal.point)) {
      nextPoints = repositionWireEndpointOrthogonally(
        nextPoints,
        nextPoints.length - 1,
        endTerminal.point,
        endTerminal.axis
      );
      didMove = true;
    }

    return didMove ? { ...wire, points: simplifyWirePoints(nextPoints) } : wire;
  });
}
