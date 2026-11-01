import type {
  BuilderComponent,
  BuilderPlaneSettings,
  BuilderScene,
  BuilderTerminal,
  BuilderWire,
  Point
} from "../DiagramBuilder";
import { getComponentTerminals } from "../DiagramBuilder";
import {
  cleanWirePath,
  distanceBetween,
  getSegmentAxis,
  getTerminalApproachAxis,
  repositionWireEndpointOrthogonally
} from "./grid";

type Axis = "horizontal" | "vertical";

interface TerminalRef {
  component: BuilderComponent;
  terminal: BuilderTerminal;
}

interface JunctionTarget {
  axis: Axis | null;
  point: Point;
  wireId: string;
}

export interface WireTopologyReport {
  mergedJunctions: number;
  removedWireIds: string[];
  repairedEndpoints: number;
  scene: BuilderScene;
}

const TERMINAL_SNAP_DISTANCE = 4;
const JUNCTION_TOLERANCE = 2;
const PORT_REANCHOR_DISTANCE = 24;
const EPSILON = 0.001;

function samePoint(left: Point, right: Point): boolean {
  return Math.abs(left.x - right.x) < EPSILON && Math.abs(left.y - right.y) < EPSILON;
}

function projectPointOntoSegment(point: Point, start: Point, end: Point): Point | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared < 1) {
    return null;
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));

  return {
    x: start.x + dx * t,
    y: start.y + dy * t
  };
}

function findNearestTerminal(
  point: Point,
  terminals: readonly TerminalRef[],
  maxDistance: number
): TerminalRef | null {
  let nearest: TerminalRef | null = null;
  let nearestDistance = maxDistance + 0.001;

  for (const terminal of terminals) {
    const distance = distanceBetween(point, terminal.terminal);

    if (distance >= nearestDistance) {
      continue;
    }

    nearest = terminal;
    nearestDistance = distance;
  }

  return nearest;
}

function getEndpointAxis(wire: BuilderWire, endpoint: "start" | "end"): Axis | null {
  const endpointIndex = endpoint === "start" ? 0 : wire.points.length - 1;
  const adjacentIndex = endpoint === "start" ? 1 : wire.points.length - 2;
  const endpointPoint = wire.points[endpointIndex];
  const adjacentPoint = wire.points[adjacentIndex];

  if (!endpointPoint || !adjacentPoint) {
    return null;
  }

  return getSegmentAxis(adjacentPoint, endpointPoint);
}

function getJunctionAxis(wire: BuilderWire, endpoint: "start" | "end", fallback: Axis | null): Axis {
  const sourceAxis = getEndpointAxis(wire, endpoint);

  if (sourceAxis) {
    return sourceAxis;
  }

  return fallback ?? "horizontal";
}

function findJunctionTarget(
  point: Point,
  wire: BuilderWire,
  wires: readonly BuilderWire[]
): JunctionTarget | null {
  let best: JunctionTarget | null = null;
  let bestDistance = JUNCTION_TOLERANCE + 0.001;

  for (const other of wires) {
    if (other.id === wire.id) {
      continue;
    }

    for (const otherPoint of other.points) {
      const distance = distanceBetween(point, otherPoint);

      if (distance >= bestDistance) {
        continue;
      }

      const adjacentAxis = (() => {
        for (let index = 0; index < other.points.length - 1; index += 1) {
          const start = other.points[index];
          const end = other.points[index + 1];

          if (!start || !end) {
            continue;
          }

          if (samePoint(start, otherPoint) || samePoint(end, otherPoint)) {
            return getSegmentAxis(start, end);
          }
        }

        return null;
      })();

      best = {
        axis: adjacentAxis,
        point: { x: otherPoint.x, y: otherPoint.y },
        wireId: other.id
      };
      bestDistance = distance;
    }

    for (let index = 0; index < other.points.length - 1; index += 1) {
      const start = other.points[index];
      const end = other.points[index + 1];

      if (!start || !end) {
        continue;
      }

      const projection = projectPointOntoSegment(point, start, end);

      if (!projection) {
        continue;
      }

      const distance = distanceBetween(point, projection);

      if (distance >= bestDistance) {
        continue;
      }

      if (samePoint(projection, start) || samePoint(projection, end)) {
        continue;
      }

      best = {
        axis: getSegmentAxis(start, end),
        point: projection,
        wireId: other.id
      };
      bestDistance = distance;
    }
  }

  return best;
}

function insertPointIntoWire(wire: BuilderWire, point: Point): boolean {
  if (wire.points.some((candidate) => samePoint(candidate, point))) {
    return false;
  }

  for (let index = 0; index < wire.points.length - 1; index += 1) {
    const start = wire.points[index];
    const end = wire.points[index + 1];

    if (!start || !end) {
      continue;
    }

    const projection = projectPointOntoSegment(point, start, end);

    if (!projection || distanceBetween(projection, point) > JUNCTION_TOLERANCE) {
      continue;
    }

    if (samePoint(point, start) || samePoint(point, end)) {
      return false;
    }

    wire.points.splice(index + 1, 0, { x: point.x, y: point.y });
    return true;
  }

  return false;
}

function rebuildWirePath(points: Point[], startAxis: Axis | null, endAxis: Axis | null): Point[] {
  let nextPoints = points.map((point) => ({ ...point }));

  if (nextPoints.length < 2) {
    return nextPoints;
  }

  if (startAxis) {
    nextPoints = repositionWireEndpointOrthogonally(nextPoints, 0, nextPoints[0]!, startAxis);
  }

  if (endAxis) {
    nextPoints = repositionWireEndpointOrthogonally(
      nextPoints,
      nextPoints.length - 1,
      nextPoints[nextPoints.length - 1]!,
      endAxis
    );
  }

  if (nextPoints.length > 2) {
    const start = nextPoints[0]!;
    const end = nextPoints[nextPoints.length - 1]!;

    // Si los dos extremos quedaron en la misma vertical/horizontal, el tramo
    // recto es la ruta correcta: los quiebres intermedios son restos de una
    // alineacion anterior (p. ej. el borne derecho de un pulsador).
    if (
      Math.abs(start.x - end.x) < 0.001
      || Math.abs(start.y - end.y) < 0.001
    ) {
      return [{ x: start.x, y: start.y }, { x: end.x, y: end.y }];
    }
  }

  return cleanWirePath(nextPoints);
}

function resolveTerminalEndpoint(
  wire: BuilderWire,
  endpoint: "start" | "end",
  terminalByPort: ReadonlyMap<string, TerminalRef>
): Axis | null {
  const portId = endpoint === "start" ? wire.startPortId : wire.endPortId;

  if (!portId) {
    return null;
  }

  const terminal = terminalByPort.get(portId);

  if (!terminal) {
    if (endpoint === "start") {
      wire.startPortId = null;
    } else {
      wire.endPortId = null;
    }

    return null;
  }

  const endpointIndex = endpoint === "start" ? 0 : wire.points.length - 1;
  const endpointPoint = wire.points[endpointIndex];

  if (!endpointPoint) {
    return null;
  }

  const distance = distanceBetween(endpointPoint, terminal.terminal);

  if (distance > PORT_REANCHOR_DISTANCE) {
    if (endpoint === "start") {
      wire.startPortId = null;
    } else {
      wire.endPortId = null;
    }

    return null;
  }

  wire.points[endpointIndex] = { x: terminal.terminal.x, y: terminal.terminal.y };

  return getTerminalApproachAxis(terminal.component, terminal.terminal.terminalId);
}

export function reconcileWireTopology(
  scene: BuilderScene,
  _planeSettings?: BuilderPlaneSettings
): WireTopologyReport {
  const components = scene.components.map((component) => ({ ...component }));
  let wires = scene.wires
    .filter((wire) => wire.points.length >= 2)
    .map((wire) => ({
      ...wire,
      points: wire.points.map((point) => ({ ...point }))
    }));

  const terminals: TerminalRef[] = [];

  for (const component of components) {
    for (const terminal of getComponentTerminals(component)) {
      terminals.push({ component, terminal });
    }
  }

  const terminalByPort = new Map(terminals.map((entry) => [entry.terminal.portId, entry]));
  const startAxes = new Map<string, Axis>();
  const endAxes = new Map<string, Axis>();
  const removedWireIds = new Set<string>();
  let repairedEndpoints = 0;
  let mergedJunctions = 0;

  const resolveTerminalPass = () => {
    for (const wire of wires) {
      const startAxis = resolveTerminalEndpoint(wire, "start", terminalByPort);
      const endAxis = resolveTerminalEndpoint(wire, "end", terminalByPort);

      if (startAxis) {
        startAxes.set(wire.id, startAxis);
      } else {
        startAxes.delete(wire.id);
      }

      if (endAxis) {
        endAxes.set(wire.id, endAxis);
      } else {
        endAxes.delete(wire.id);
      }
    }

    for (const wire of wires) {
      wire.points = rebuildWirePath(wire.points, startAxes.get(wire.id) ?? null, endAxes.get(wire.id) ?? null);
    }
  };

  const resolveJunctionPass = () => {
    let didChange = false;
    const changedWireIds = new Set<string>();

    for (const wire of wires) {
      if (removedWireIds.has(wire.id)) {
        continue;
      }

      for (const endpoint of ["start", "end"] as const) {
        const portId = endpoint === "start" ? wire.startPortId : wire.endPortId;

        if (portId) {
          continue;
        }

        const endpointIndex = endpoint === "start" ? 0 : wire.points.length - 1;
        const endpointPoint = wire.points[endpointIndex];

        if (!endpointPoint) {
          removedWireIds.add(wire.id);
          break;
        }

        const terminal = findNearestTerminal(endpointPoint, terminals, TERMINAL_SNAP_DISTANCE);

        if (terminal) {
          const moved = !samePoint(endpointPoint, terminal.terminal);

          wire.points[endpointIndex] = { x: terminal.terminal.x, y: terminal.terminal.y };
          const axis = getTerminalApproachAxis(terminal.component, terminal.terminal.terminalId);

          if (moved) {
            repairedEndpoints += 1;
            didChange = true;
            changedWireIds.add(wire.id);
          }

          if (endpoint === "start") {
            wire.startPortId = terminal.terminal.portId;
            startAxes.set(wire.id, axis);
          } else {
            wire.endPortId = terminal.terminal.portId;
            endAxes.set(wire.id, axis);
          }

          continue;
        }

        const junction = findJunctionTarget(endpointPoint, wire, wires);

        if (!junction) {
          removedWireIds.add(wire.id);
          break;
        }

        const axis = getJunctionAxis(wire, endpoint, junction.axis);
        const moved = !samePoint(endpointPoint, junction.point);

        wire.points[endpointIndex] = { x: junction.point.x, y: junction.point.y };

        if (endpoint === "start") {
          startAxes.set(wire.id, axis);
        } else {
          endAxes.set(wire.id, axis);
        }

        const targetWire = wires.find((candidate) => candidate.id === junction.wireId);
        const inserted = targetWire ? insertPointIntoWire(targetWire, junction.point) : false;

        if (moved || inserted) {
          mergedJunctions += 1;
          didChange = true;
          changedWireIds.add(wire.id);
        }
      }
    }

    for (const wireId of changedWireIds) {
      const wire = wires.find((candidate) => candidate.id === wireId);

      if (wire && !removedWireIds.has(wire.id)) {
        wire.points = rebuildWirePath(wire.points, startAxes.get(wire.id) ?? null, endAxes.get(wire.id) ?? null);
      }
    }

    return didChange;
  };

  resolveTerminalPass();
  resolveJunctionPass();

  // Repite hasta estabilizar (maximo 3 pasadas): una union puede insertar un
  // punto que, a su vez, permite que otro extremo se conecte a el.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const didChange = resolveJunctionPass();

    if (!didChange) {
      break;
    }
  }

  wires = wires.filter((wire) => !removedWireIds.has(wire.id) && wire.points.length >= 2);

  return {
    mergedJunctions,
    removedWireIds: [...removedWireIds],
    repairedEndpoints,
    scene: {
      components,
      wires
    }
  };
}
