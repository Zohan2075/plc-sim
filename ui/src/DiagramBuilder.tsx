import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import type { InstructionType, Program } from "@plc-sim/ladder-types";
import type { TagDefinition } from "./projectData";

type BuilderComponentType = InstructionType | "BREAKER_1P" | "BREAKER_2P" | "POWER_SOURCE" | "LAMP" | "MOTOR";
type BuilderMode = "move" | "pan" | "wire";
type TerminalRole = "source" | "input" | "output" | "end";
type WireConnectionStatus = "connected" | "loose-start" | "loose-end" | "loose-both" | "invalid-loop";
type WireEndpointKey = "start" | "end";
type BuilderSelection =
  | { kind: "component"; id: string }
  | { kind: "wire"; id: string }
  | null;

interface Point {
  x: number;
  y: number;
}

interface BuilderComponent {
  id: string;
  isClosed?: boolean;
  label: string;
  rotation: number;
  sourceVoltage?: number;
  tag: string | null;
  type: BuilderComponentType;
  usesCustomLabel: boolean;
  x: number;
  y: number;
}

interface BuilderWire {
  color: string;
  id: string;
  points: Point[];
  thickness: number;
}

interface TerminalDefinition {
  id: string;
  pairId?: string | undefined;
  role: TerminalRole;
  x: number;
  y: number;
}

interface BuilderTerminal {
  componentId: string;
  pairId?: string | undefined;
  portId: string;
  role: TerminalRole;
  terminalId: string;
  x: number;
  y: number;
}

interface BuilderScene {
  components: BuilderComponent[];
  wires: BuilderWire[];
}

interface WireEndpointResolution {
  component: BuilderComponent | null;
  point: Point;
  port: BuilderTerminal | null;
}

interface WireInspection {
  bends: number;
  end: WireEndpointResolution;
  length: number;
  segments: number;
  solverEligible: boolean;
  start: WireEndpointResolution;
  status: WireConnectionStatus;
}

interface WirePointDragState {
  pointIndex: number;
  wireId: string;
}

interface DerivedBuilderState {
  program: Program;
  resolvedWires: number;
  runnableRungs: number;
  unresolvedWires: number;
}

interface ElectricalState {
  componentVoltageById: Map<string, number>;
  energizedComponentIds: Set<string>;
  energizedNodeIds: Set<string>;
  energizedWireIds: Set<string>;
}

interface ResolvedPortGraph {
  componentsById: Map<string, BuilderComponent>;
  connections: Map<string, Set<string>>;
  ports: BuilderTerminal[];
  portsById: Map<string, BuilderTerminal>;
  wireConnections: Array<{
    endPortId: string;
    startPortId: string;
    wireId: string;
  }>;
}

interface WireSegmentAnchor {
  insertIndex: number;
  point: Point;
  wireId: string;
}

interface SnapTarget {
  point: Point;
  wireAnchor: WireSegmentAnchor | null;
}

interface ElectricalNodeGraph {
  connections: Map<string, Set<string>>;
  portsById: Map<string, BuilderTerminal>;
  wireNodeIdsByWire: Map<string, string[]>;
}

interface DiagramBuilderProps {
  onProgramChange?: (program: Program) => void;
  onRunToggle?: () => void;
  program?: Program | undefined;
  runDisabled?: boolean;
  running?: boolean;
  scanIntervalMs?: number;
  simulatorLabel?: string;
  simulatorMessage?: string;
  simulatorTone?: "error" | "info";
  tags: TagDefinition[];
  tick?: number;
}

const COMPONENT_WIDTH = 160;
const COMPONENT_HEIGHT = 136;
const CANVAS_WIDTH = 1720;
const CANVAS_HEIGHT = 940;
const SNAP_DISTANCE = 18;
const DEFAULT_WIRE_COLOR = "#c2410c";
const DEFAULT_WIRE_THICKNESS = 4;
const DEFAULT_SOURCE_VOLTAGE = 120;
const ROTATION_CENTER_X = COMPONENT_WIDTH / 2;
const ROTATION_CENTER_Y = 36;

const instructionPalette: Array<{
  description: string;
  label: string;
  type: BuilderComponentType;
}> = [
  { type: "POWER_SOURCE", label: "Source", description: "L1/L2 control feed" },
  { type: "BREAKER_1P", label: "1P breaker", description: "Single-pole breaker" },
  { type: "BREAKER_2P", label: "2P breaker", description: "Two-pole breaker" },
  { type: "LAMP", label: "Lamp", description: "Indicator lamp load" },
  { type: "MOTOR", label: "Motor", description: "Motor load" },
  { type: "XIC", label: "XIC", description: "Normally open contact" },
  { type: "XIO", label: "XIO", description: "Normally closed contact" },
  { type: "OTE", label: "OTE", description: "Output energize coil" },
  { type: "OTL", label: "OTL", description: "Output latch coil" },
  { type: "OTU", label: "OTU", description: "Output unlatch coil" }
];

const fallbackTags: TagDefinition[] = [
  { name: "I:0/0", kind: "input", label: "Input" },
  { name: "O:0/0", kind: "output", label: "Output" },
  { name: "B3:0/0", kind: "internal", label: "Internal bit" }
];

function componentNeedsTag(type: BuilderComponentType): type is InstructionType {
  return type === "XIC" || type === "XIO" || type === "OTE" || type === "OTL" || type === "OTU";
}

function isCoilType(type: BuilderComponentType): type is "OTE" | "OTL" | "OTU" {
  return type === "OTE" || type === "OTL" || type === "OTU";
}

function isPassThroughType(type: BuilderComponentType): boolean {
  return type === "BREAKER_1P" || type === "BREAKER_2P" || type === "XIC" || type === "XIO";
}

function isBreakerType(type: BuilderComponentType): type is "BREAKER_1P" | "BREAKER_2P" {
  return type === "BREAKER_1P" || type === "BREAKER_2P";
}

function isVisualLoadType(type: BuilderComponentType): boolean {
  return type === "LAMP" || type === "MOTOR" || isCoilType(type);
}

function getSymbolCategory(type: BuilderComponentType): "power" | "breaker" | "contact" | "coil" | "load" {
  switch (type) {
    case "POWER_SOURCE":
      return "power";
    case "BREAKER_1P":
    case "BREAKER_2P":
      return "breaker";
    case "LAMP":
    case "MOTOR":
      return "load";
    case "XIC":
    case "XIO":
      return "contact";
    case "OTE":
    case "OTL":
    case "OTU":
      return "coil";
  }
}

function clampWireThickness(value: number): number {
  return clamp(Math.round(value), 2, 12);
}

function getSourceVoltage(component: BuilderComponent): number {
  return clamp(Math.round(component.sourceVoltage ?? DEFAULT_SOURCE_VOLTAGE), 1, 600);
}

function isBreakerClosed(component: BuilderComponent): boolean {
  return isBreakerType(component.type) ? component.isClosed ?? false : false;
}

function getConductiveTerminalPairs(component: BuilderComponent): Array<[string, string]> {
  switch (component.type) {
    case "BREAKER_1P":
      return isBreakerClosed(component) ? [["in", "out"]] : [];
    case "BREAKER_2P":
      return isBreakerClosed(component)
        ? [["in-top", "out-top"], ["in-bottom", "out-bottom"]]
        : [];
    case "XIC":
    case "XIO":
      return [["in", "out"]];
    default:
      return [];
  }
}

function getInstructionSymbol(type: BuilderComponentType): string {
  switch (type) {
    case "POWER_SOURCE":
      return "L1 ~ L2";
    case "BREAKER_1P":
      return "--/ CB1 --";
    case "BREAKER_2P":
      return "--// CB2 --";
    case "LAMP":
      return "--(Lamp)--";
    case "MOTOR":
      return "--(Motor)--";
    case "XIC":
      return "--] [--";
    case "XIO":
      return "--]/[--";
    case "OTE":
      return "--( )--";
    case "OTL":
      return "--(L)--";
    case "OTU":
      return "--(U)--";
  }
}

function getComponentName(type: BuilderComponentType): string {
  switch (type) {
    case "POWER_SOURCE":
      return "Power source";
    case "BREAKER_1P":
      return "Breaker 1P";
    case "BREAKER_2P":
      return "Breaker 2P";
    case "LAMP":
      return "Lamp";
    case "MOTOR":
      return "Motor";
    default:
      return type;
  }
}

function getDefaultComponentLabel(
  type: BuilderComponentType,
  tags: TagDefinition[],
  tagName?: string | null
): string {
  if (tagName) {
    const tag = tags.find((entry) => entry.name === tagName);

    if (tag?.label) {
      return tag.label;
    }

    if (componentNeedsTag(type)) {
      return tagName;
    }
  }

  switch (type) {
    case "POWER_SOURCE":
      return "L1-L2";
    case "BREAKER_1P":
      return "CB-1";
    case "BREAKER_2P":
      return "CB-2";
    case "LAMP":
      return "LAMP";
    case "MOTOR":
      return "MOTOR";
    default:
      return getComponentName(type);
  }
}

function getTerminalDefinitions(type: BuilderComponentType): TerminalDefinition[] {
  switch (type) {
    case "POWER_SOURCE":
      return [
        { id: "left", role: "source", x: 12, y: 40 },
        { id: "right", role: "source", x: 148, y: 40 }
      ];
    case "BREAKER_1P":
      return [
        { id: "in", pairId: "main", role: "input", x: 12, y: 40 },
        { id: "out", pairId: "main", role: "output", x: 148, y: 40 }
      ];
    case "BREAKER_2P":
      return [
        { id: "in-top", pairId: "top", role: "input", x: 12, y: 28 },
        { id: "out-top", pairId: "top", role: "output", x: 148, y: 28 },
        { id: "in-bottom", pairId: "bottom", role: "input", x: 12, y: 56 },
        { id: "out-bottom", pairId: "bottom", role: "output", x: 148, y: 56 }
      ];
    case "LAMP":
    case "MOTOR":
      return [
        { id: "in", pairId: "main", role: "input", x: 12, y: 40 },
        { id: "out", pairId: "main", role: "end", x: 148, y: 40 }
      ];
    case "XIC":
    case "XIO":
      return [
        { id: "in", pairId: "main", role: "input", x: 12, y: 40 },
        { id: "out", pairId: "main", role: "output", x: 148, y: 40 }
      ];
    case "OTE":
    case "OTL":
    case "OTU":
      return [
        { id: "in", pairId: "main", role: "input", x: 12, y: 40 },
        { id: "out", pairId: "main", role: "end", x: 148, y: 40 }
      ];
  }
}

function getTerminalCount(type: BuilderComponentType): number {
  return getTerminalDefinitions(type).length;
}

function getDefaultEntryTerminalId(type: BuilderComponentType): string {
  switch (type) {
    case "BREAKER_2P":
      return "in-top";
    case "BREAKER_1P":
    case "LAMP":
    case "MOTOR":
    case "XIC":
    case "XIO":
    case "OTE":
    case "OTL":
    case "OTU":
      return "in";
    case "POWER_SOURCE":
      return "left";
  }
}

function getDefaultExitTerminalId(type: BuilderComponentType): string {
  switch (type) {
    case "POWER_SOURCE":
      return "right";
    case "BREAKER_2P":
      return "out-top";
    case "BREAKER_1P":
    case "XIC":
    case "XIO":
      return "out";
    case "LAMP":
    case "MOTOR":
    case "OTE":
    case "OTL":
    case "OTU":
      return "in";
  }
}

function renderSymbolGraphic(
  type: BuilderComponentType,
  options: { breakerClosed?: boolean; energized?: boolean } = {}
): ReactNode {
  const symbolClassName = `diagram-symbol${options.energized ? " diagram-symbol--energized" : ""}`.trim();

  switch (type) {
    case "POWER_SOURCE":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <text x="8" y="14" className="diagram-symbol__text">L1</text>
          <text x="100" y="14" className="diagram-symbol__text">L2</text>
          <line x1="6" y1="32" x2="42" y2="32" className="diagram-symbol__line" />
          <line x1="86" y1="32" x2="122" y2="32" className="diagram-symbol__line" />
          <circle cx="64" cy="32" r="20" className="diagram-symbol__shape" />
          <path d="M50 32 Q55 18 60 32 Q65 46 70 32 Q75 18 78 32" className="diagram-symbol__line" />
        </svg>
      );
    case "BREAKER_1P":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="28" x2="36" y2="28" className="diagram-symbol__line" />
          <line x1="92" y1="28" x2="122" y2="28" className="diagram-symbol__line" />
          <circle cx="36" cy="28" r="4" className="diagram-symbol__fill" />
          <circle cx="92" cy="28" r="4" className="diagram-symbol__fill" />
          <line
            x1="40"
            y1={options.breakerClosed ? "28" : "26"}
            x2="88"
            y2={options.breakerClosed ? "28" : "12"}
            className="diagram-symbol__line"
          />
          <rect x="48" y="38" width="32" height="16" rx="4" className="diagram-symbol__shape" />
          <text x="64" y="50" textAnchor="middle" className="diagram-symbol__text">CB</text>
        </svg>
      );
    case "BREAKER_2P":
      return (
        <svg viewBox="0 0 128 74" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="22" x2="36" y2="22" className="diagram-symbol__line" />
          <line x1="92" y1="22" x2="122" y2="22" className="diagram-symbol__line" />
          <circle cx="36" cy="22" r="4" className="diagram-symbol__fill" />
          <circle cx="92" cy="22" r="4" className="diagram-symbol__fill" />
          <line
            x1="40"
            y1={options.breakerClosed ? "22" : "20"}
            x2="88"
            y2={options.breakerClosed ? "22" : "6"}
            className="diagram-symbol__line"
          />
          <line x1="6" y1="52" x2="36" y2="52" className="diagram-symbol__line" />
          <line x1="92" y1="52" x2="122" y2="52" className="diagram-symbol__line" />
          <circle cx="36" cy="52" r="4" className="diagram-symbol__fill" />
          <circle cx="92" cy="52" r="4" className="diagram-symbol__fill" />
          <line
            x1="40"
            y1={options.breakerClosed ? "52" : "50"}
            x2="88"
            y2={options.breakerClosed ? "52" : "36"}
            className="diagram-symbol__line"
          />
          <rect x="46" y="24" width="36" height="28" rx="5" className="diagram-symbol__shape" />
          <text x="64" y="41" textAnchor="middle" className="diagram-symbol__text">2P</text>
        </svg>
      );
    case "LAMP":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="32" x2="38" y2="32" className="diagram-symbol__line" />
          <line x1="90" y1="32" x2="122" y2="32" className="diagram-symbol__line" />
          <circle cx="64" cy="32" r="22" className="diagram-symbol__shape" />
          <path d="M50 18 L78 46 M78 18 L50 46" className="diagram-symbol__line" />
          <path d="M54 50 C58 56 70 56 74 50" className="diagram-symbol__line" />
        </svg>
      );
    case "MOTOR":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="32" x2="38" y2="32" className="diagram-symbol__line" />
          <line x1="90" y1="32" x2="122" y2="32" className="diagram-symbol__line" />
          <circle cx="64" cy="32" r="22" className="diagram-symbol__shape" />
          <text x="64" y="37" textAnchor="middle" className="diagram-symbol__text">M</text>
          <g className="diagram-symbol__motor-rotor">
            <path d="M64 12 A20 20 0 0 1 85 33" className="diagram-symbol__line" />
            <path d="M78 25 L85 33 L75 33" className="diagram-symbol__line" />
          </g>
        </svg>
      );
    case "XIC":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="30" x2="42" y2="30" className="diagram-symbol__line" />
          <line x1="86" y1="30" x2="122" y2="30" className="diagram-symbol__line" />
          <line x1="42" y1="12" x2="42" y2="48" className="diagram-symbol__line" />
          <line x1="86" y1="12" x2="86" y2="48" className="diagram-symbol__line" />
        </svg>
      );
    case "XIO":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="30" x2="42" y2="30" className="diagram-symbol__line" />
          <line x1="86" y1="30" x2="122" y2="30" className="diagram-symbol__line" />
          <line x1="42" y1="12" x2="42" y2="48" className="diagram-symbol__line" />
          <line x1="86" y1="12" x2="86" y2="48" className="diagram-symbol__line" />
          <line x1="42" y1="46" x2="86" y2="14" className="diagram-symbol__line" />
        </svg>
      );
    case "OTE":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="30" x2="44" y2="30" className="diagram-symbol__line" />
          <line x1="84" y1="30" x2="122" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
        </svg>
      );
    case "OTL":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="30" x2="44" y2="30" className="diagram-symbol__line" />
          <line x1="84" y1="30" x2="122" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
          <text x="64" y="36" textAnchor="middle" className="diagram-symbol__text">L</text>
        </svg>
      );
    case "OTU":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="30" x2="44" y2="30" className="diagram-symbol__line" />
          <line x1="84" y1="30" x2="122" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
          <text x="64" y="36" textAnchor="middle" className="diagram-symbol__text">U</text>
        </svg>
      );
  }
}

function getDefaultTag(type: InstructionType, tags: TagDefinition[]): string {
  const kindPriority =
    type === "XIC" || type === "XIO"
      ? (["input", "internal", "output"] as const)
      : type === "OTE"
        ? (["output", "internal", "input"] as const)
        : (["internal", "output", "input"] as const);

  for (const kind of kindPriority) {
    const match = tags.find((tag) => tag.kind === kind);

    if (match) {
      return match.name;
    }
  }

  return tags[0]?.name ?? "I:0/0";
}

function createId(nextId: { current: number }, prefix: string): string {
  return `${prefix}-${nextId.current++}`;
}

function getPortId(componentId: string, terminalId: string): string {
  return `${componentId}:${terminalId}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeQuarterTurns(value: number): number {
  return ((value % 4) + 4) % 4;
}

function distanceBetween(left: Point, right: Point): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return Math.hypot(dx, dy);
}

function pointsAreClose(left: Point, right: Point): boolean {
  return distanceBetween(left, right) < 3;
}

function normalizeWirePoints(points: Point[]): Point[] {
  const normalized: Point[] = [];

  for (const point of points) {
    const previousPoint = normalized[normalized.length - 1];

    if (!previousPoint || !pointsAreClose(previousPoint, point)) {
      normalized.push(point);
    }
  }

  return normalized;
}

function arePointsCollinear(left: Point, middle: Point, right: Point): boolean {
  const crossProduct = (middle.x - left.x) * (right.y - left.y) - (middle.y - left.y) * (right.x - left.x);
  return Math.abs(crossProduct) < 0.5;
}

function simplifyWirePoints(points: Point[]): Point[] {
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

function isWireEndpointIndex(index: number, pointCount: number): boolean {
  return index === 0 || index === pointCount - 1;
}

function getWireSegmentMidpoint(left: Point, right: Point): Point {
  return {
    x: Math.round((left.x + right.x) / 2),
    y: Math.round((left.y + right.y) / 2)
  };
}

function roundPoint(point: Point): Point {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y)
  };
}

function getPointKey(point: Point): string {
  const roundedPoint = roundPoint(point);
  return `${roundedPoint.x}:${roundedPoint.y}`;
}

function getElectricalPointNodeId(point: Point): string {
  return `point:${getPointKey(point)}`;
}

function getElectricalPortNodeId(portId: string): string {
  return `port:${portId}`;
}

function formatTerminalLabel(terminalId: string): string {
  return terminalId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getWireStatusMeta(status: WireConnectionStatus): {
  className: string;
  description: string;
  label: string;
} {
  switch (status) {
    case "connected":
      return {
        className: "status-pill--on",
        description: "Both ends are snapped to different terminals, so the solver can read this wire.",
        label: "Connected"
      };
    case "loose-start":
      return {
        className: "status-pill--off",
        description: "The start endpoint is loose. Reconnect it or drag it back onto a terminal.",
        label: "Loose start"
      };
    case "loose-end":
      return {
        className: "status-pill--off",
        description: "The end endpoint is loose. Reconnect it or drag it back onto a terminal.",
        label: "Loose end"
      };
    case "invalid-loop":
      return {
        className: "status-pill--off",
        description: "Both ends land on the same terminal, so this wire is invalid for the solver.",
        label: "Invalid loop"
      };
    default:
      return {
        className: "status-pill--off",
        description: "Neither end is snapped to a terminal yet.",
        label: "Loose wire"
      };
  }
}

function rotatePoint(point: Point, quarterTurns: number): Point {
  const turns = normalizeQuarterTurns(quarterTurns);
  const dx = point.x - ROTATION_CENTER_X;
  const dy = point.y - ROTATION_CENTER_Y;

  switch (turns) {
    case 0:
      return point;
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
    default:
      return {
        x: ROTATION_CENTER_X - dy,
        y: ROTATION_CENTER_Y + dx
      };
  }
}

function getTerminalPoint(component: BuilderComponent, terminalId: string): Point {
  const terminal = getTerminalDefinitions(component.type).find((entry) => entry.id === terminalId);

  if (!terminal) {
    return { x: component.x, y: component.y };
  }

  const rotatedPoint = rotatePoint({ x: terminal.x, y: terminal.y }, component.rotation);

  return {
    x: component.x + rotatedPoint.x,
    y: component.y + rotatedPoint.y
  };
}

function getComponentTerminals(component: BuilderComponent): BuilderTerminal[] {
  return getTerminalDefinitions(component.type).map((terminal) => {
    const point = getTerminalPoint(component, terminal.id);

    return {
      componentId: component.id,
      pairId: terminal.pairId,
      portId: getPortId(component.id, terminal.id),
      role: terminal.role,
      terminalId: terminal.id,
      x: point.x,
      y: point.y
    };
  });
}

function sortComponentsByPosition(left: BuilderComponent, right: BuilderComponent): number {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  return left.x - right.x;
}

function sortPortsByPosition(left: BuilderTerminal, right: BuilderTerminal): number {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  return left.x - right.x;
}

function findNearestPort(point: Point, components: BuilderComponent[]): BuilderTerminal | null {
  let nearestPort: BuilderTerminal | null = null;
  let nearestDistance = SNAP_DISTANCE + 1;

  for (const component of components) {
    for (const port of getComponentTerminals(component)) {
      const distance = distanceBetween(point, port);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPort = port;
      }
    }
  }

  return nearestPort;
}

function resolveWireEndpoint(point: Point, components: BuilderComponent[]): WireEndpointResolution {
  const port = findNearestPort(point, components);

  return {
    component: port ? components.find((component) => component.id === port.componentId) ?? null : null,
    point,
    port
  };
}

function inspectWire(wire: BuilderWire, components: BuilderComponent[]): WireInspection {
  const startPoint = wire.points[0] ?? { x: 0, y: 0 };
  const endPoint = wire.points[wire.points.length - 1] ?? startPoint;
  const start = resolveWireEndpoint(startPoint, components);
  const end = resolveWireEndpoint(endPoint, components);
  const segments = Math.max(wire.points.length - 1, 0);
  const bends = Math.max(wire.points.length - 2, 0);
  let length = 0;

  for (let index = 0; index < wire.points.length - 1; index += 1) {
    const currentPoint = wire.points[index];
    const nextPoint = wire.points[index + 1];

    if (!currentPoint || !nextPoint) {
      continue;
    }

    length += distanceBetween(currentPoint, nextPoint);
  }

  let status: WireConnectionStatus;

  if (start.port && end.port) {
    status = start.port.portId === end.port.portId ? "invalid-loop" : "connected";
  } else if (start.port) {
    status = "loose-end";
  } else if (end.port) {
    status = "loose-start";
  } else {
    status = "loose-both";
  }

  return {
    bends,
    end,
    length: Math.round(length),
    segments,
    solverEligible: status === "connected",
    start,
    status
  };
}

function getDetachedWirePoint(points: Point[], endpoint: WireEndpointKey): Point | null {
  const endpointIndex = endpoint === "start" ? 0 : points.length - 1;
  const neighborIndex = endpoint === "start" ? 1 : points.length - 2;
  const endpointPoint = points[endpointIndex];
  const neighborPoint = points[neighborIndex];

  if (!endpointPoint) {
    return null;
  }

  let dx = endpoint === "start" ? -1 : 1;
  let dy = 0;

  if (neighborPoint && !pointsAreClose(endpointPoint, neighborPoint)) {
    dx = endpointPoint.x - neighborPoint.x;
    dy = endpointPoint.y - neighborPoint.y;
  }

  const distance = Math.hypot(dx, dy) || 1;
  const offset = SNAP_DISTANCE + 18;

  return {
    x: clamp(endpointPoint.x + (dx / distance) * offset, 12, CANVAS_WIDTH - 12),
    y: clamp(endpointPoint.y + (dy / distance) * offset, 12, CANVAS_HEIGHT - 12)
  };
}

function snapPointToPort(point: Point, components: BuilderComponent[]): Point {
  const nearestPort = findNearestPort(point, components);

  if (!nearestPort) {
    return point;
  }

  return { x: nearestPort.x, y: nearestPort.y };
}

function projectPointOntoSegment(point: Point, start: Point, end: Point): { distance: number; point: Point } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared < 1) {
    return null;
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSquared, 0, 1);
  const projectedPoint = roundPoint({ x: start.x + dx * t, y: start.y + dy * t });

  return {
    distance: distanceBetween(point, projectedPoint),
    point: projectedPoint
  };
}

function findNearestWireSegmentAnchor(
  point: Point,
  wires: BuilderWire[],
  excludeWireId?: string
): WireSegmentAnchor | null {
  let nearestAnchor: WireSegmentAnchor | null = null;
  let nearestDistance = SNAP_DISTANCE + 1;

  for (const wire of wires) {
    if (wire.id === excludeWireId) {
      continue;
    }

    for (let index = 0; index < wire.points.length - 1; index += 1) {
      const startPoint = wire.points[index];
      const endPoint = wire.points[index + 1];

      if (!startPoint || !endPoint) {
        continue;
      }

      const projection = projectPointOntoSegment(point, startPoint, endPoint);

      if (!projection || projection.distance >= nearestDistance) {
        continue;
      }

      nearestDistance = projection.distance;
      nearestAnchor = {
        insertIndex: index + 1,
        point: projection.point,
        wireId: wire.id
      };
    }
  }

  return nearestAnchor;
}

function resolveSnapTarget(
  point: Point,
  components: BuilderComponent[],
  wires: BuilderWire[],
  excludeWireId?: string
): SnapTarget {
  const nearestPort = findNearestPort(point, components);

  if (nearestPort) {
    return {
      point: { x: nearestPort.x, y: nearestPort.y },
      wireAnchor: null
    };
  }

  const wireAnchor = findNearestWireSegmentAnchor(point, wires, excludeWireId);

  if (wireAnchor) {
    return {
      point: wireAnchor.point,
      wireAnchor
    };
  }

  return {
    point: roundPoint(point),
    wireAnchor: null
  };
}

function insertPointIntoWire(points: Point[], insertIndex: number, point: Point): Point[] {
  const roundedPoint = roundPoint(point);
  const previousPoint = points[insertIndex - 1];
  const nextPoint = points[insertIndex];

  if (
    (previousPoint && pointsAreClose(previousPoint, roundedPoint))
    || (nextPoint && pointsAreClose(nextPoint, roundedPoint))
  ) {
    return points;
  }

  return normalizeWirePoints([
    ...points.slice(0, insertIndex),
    roundedPoint,
    ...points.slice(insertIndex)
  ]);
}

function applyWireAnchor(currentWires: BuilderWire[], anchor: WireSegmentAnchor): BuilderWire[] {
  return currentWires.map((wire) =>
    wire.id === anchor.wireId
      ? { ...wire, points: insertPointIntoWire(wire.points, anchor.insertIndex, anchor.point) }
      : wire
  );
}

function anchorWireEndpoints(
  points: Point[],
  components: BuilderComponent[],
  wires: BuilderWire[],
  excludeWireId?: string
): { anchors: WireSegmentAnchor[]; points: Point[] } {
  const endpointIndices = [0, points.length - 1];
  const nextPoints = [...points];
  const anchors: WireSegmentAnchor[] = [];

  for (const endpointIndex of endpointIndices) {
    const endpoint = nextPoints[endpointIndex];

    if (!endpoint) {
      continue;
    }

    const snapTarget = resolveSnapTarget(endpoint, components, wires, excludeWireId);
    nextPoints[endpointIndex] = snapTarget.point;

    if (snapTarget.wireAnchor) {
      anchors.push(snapTarget.wireAnchor);
    }
  }

  return {
    anchors,
    points: normalizeWirePoints(nextPoints.map(roundPoint))
  };
}

function createCanvasComponent(
  nextId: { current: number },
  availableTags: TagDefinition[],
  type: BuilderComponentType,
  x: number,
  y: number,
  tagOverride?: string | null
): BuilderComponent {
  const resolvedTag = componentNeedsTag(type) ? tagOverride ?? getDefaultTag(type, availableTags) : null;

  return {
    id: createId(nextId, "builder-component"),
    isClosed: isBreakerType(type) ? false : undefined,
    label: getDefaultComponentLabel(type, availableTags, resolvedTag),
    rotation: 0,
    sourceVoltage: type === "POWER_SOURCE" ? DEFAULT_SOURCE_VOLTAGE : undefined,
    tag: resolvedTag,
    type,
    usesCustomLabel: false,
    x,
    y
  };
}

function createWireWithPoints(nextId: { current: number }, color: string, points: Point[]): BuilderWire {
  return {
    color,
    id: createId(nextId, "builder-wire"),
    points: normalizeWirePoints(points),
    thickness: DEFAULT_WIRE_THICKNESS
  };
}

function createWire(nextId: { current: number }, color: string, start: Point, end: Point): BuilderWire {
  return createWireWithPoints(nextId, color, [start, end]);
}

function buildStarterScene(nextId: { current: number }, availableTags: TagDefinition[]): BuilderScene {
  const source = createCanvasComponent(nextId, availableTags, "POWER_SOURCE", 88, 148);

  return {
    components: [source],
    wires: []
  };
}

function buildSceneFromProgram(
  nextId: { current: number },
  availableTags: TagDefinition[],
  program?: Program
): BuilderScene {
  if (!program || program.rungs.length === 0) {
    return buildStarterScene(nextId, availableTags);
  }

  const components: BuilderComponent[] = [];
  const wires: BuilderWire[] = [];
  const sharedSource = createCanvasComponent(nextId, availableTags, "POWER_SOURCE", 78, 108);
  const sourceExitPoint = getTerminalPoint(sharedSource, "right");

  components.push(sharedSource);

  program.rungs.forEach((rung, rungIndex) => {
    const y = 108 + rungIndex * 176;
    const rowComponents: BuilderComponent[] = [
      createCanvasComponent(nextId, availableTags, "BREAKER_2P", 318, y - 12)
    ];

    rung.instructions.forEach((instruction, instructionIndex) => {
      rowComponents.push(
        createCanvasComponent(
          nextId,
          availableTags,
          instruction.type,
          566 + instructionIndex * 214,
          y,
          instruction.tag
        )
      );
    });

    components.push(...rowComponents);

    const breaker = rowComponents[0];

    if (breaker) {
      const breakerEntryPoint = getTerminalPoint(breaker, "in-top");
      const sourceBusX = 232;

      wires.push(
        createWireWithPoints(nextId, DEFAULT_WIRE_COLOR, [
          sourceExitPoint,
          { x: sourceBusX, y: sourceExitPoint.y },
          { x: sourceBusX, y: breakerEntryPoint.y },
          breakerEntryPoint
        ])
      );
    }

    for (let index = 0; index < rowComponents.length - 1; index += 1) {
      const currentComponent = rowComponents[index];
      const nextComponent = rowComponents[index + 1];

      if (!currentComponent || !nextComponent) {
        continue;
      }

      wires.push(
        createWire(
          nextId,
          DEFAULT_WIRE_COLOR,
          getTerminalPoint(currentComponent, getDefaultExitTerminalId(currentComponent.type)),
          getTerminalPoint(nextComponent, getDefaultEntryTerminalId(nextComponent.type))
        )
      );
    }
  });

  return { components, wires };
}

function connectGraphNodes(graph: Map<string, Set<string>>, leftNodeId: string, rightNodeId: string) {
  if (leftNodeId === rightNodeId) {
    return;
  }

  if (!graph.has(leftNodeId)) {
    graph.set(leftNodeId, new Set());
  }

  if (!graph.has(rightNodeId)) {
    graph.set(rightNodeId, new Set());
  }

  graph.get(leftNodeId)?.add(rightNodeId);
  graph.get(rightNodeId)?.add(leftNodeId);
}

function cloneConnections(connections: Map<string, Set<string>>): Map<string, Set<string>> {
  return new Map(
    [...connections.entries()].map(([portId, neighbors]) => [portId, new Set(neighbors)])
  );
}

function buildResolvedPortGraph(components: BuilderComponent[], wires: BuilderWire[]): ResolvedPortGraph {
  const ports = components.flatMap((component) => getComponentTerminals(component));
  const portsById = new Map(ports.map((port) => [port.portId, port]));
  const componentsById = new Map(components.map((component) => [component.id, component]));
  const connections = new Map<string, Set<string>>();
  const wireConnections: ResolvedPortGraph["wireConnections"] = [];

  for (const wire of wires) {
    const firstPoint = wire.points[0];
    const lastPoint = wire.points[wire.points.length - 1];

    if (!firstPoint || !lastPoint) {
      continue;
    }

    const startPort = findNearestPort(firstPoint, components);
    const endPort = findNearestPort(lastPoint, components);

    if (!startPort || !endPort || startPort.portId === endPort.portId) {
      continue;
    }

    connectGraphNodes(connections, startPort.portId, endPort.portId);
    wireConnections.push({ endPortId: endPort.portId, startPortId: startPort.portId, wireId: wire.id });
  }

  return { componentsById, connections, ports, portsById, wireConnections };
}

function buildElectricalNodeGraph(components: BuilderComponent[], wires: BuilderWire[]): ElectricalNodeGraph {
  const ports = components.flatMap((component) => getComponentTerminals(component));
  const portsById = new Map(ports.map((port) => [port.portId, port]));
  const connections = new Map<string, Set<string>>();
  const wireNodeIdsByWire = new Map<string, string[]>();
  const occupiedPointNodeIds = new Set<string>();

  for (const wire of wires) {
    const pointNodeIds = wire.points.map((point) => getElectricalPointNodeId(point));

    wireNodeIdsByWire.set(wire.id, pointNodeIds);

    for (const pointNodeId of pointNodeIds) {
      occupiedPointNodeIds.add(pointNodeId);
    }

    for (let index = 0; index < pointNodeIds.length - 1; index += 1) {
      const currentNodeId = pointNodeIds[index];
      const nextNodeId = pointNodeIds[index + 1];

      if (!currentNodeId || !nextNodeId) {
        continue;
      }

      connectGraphNodes(connections, currentNodeId, nextNodeId);
    }
  }

  for (const port of ports) {
    const pointNodeId = getElectricalPointNodeId({ x: port.x, y: port.y });

    if (!occupiedPointNodeIds.has(pointNodeId)) {
      continue;
    }

    connectGraphNodes(connections, getElectricalPortNodeId(port.portId), pointNodeId);
  }

  return {
    connections,
    portsById,
    wireNodeIdsByWire
  };
}

function collectRungPaths(
  fromPortId: string,
  instructionPath: Array<{ tag: string; type: InstructionType }>,
  visitedComponents: Set<string>,
  connections: Map<string, Set<string>>,
  portsById: Map<string, BuilderTerminal>,
  componentsById: Map<string, BuilderComponent>
): Array<Array<{ tag: string; type: InstructionType }>> {
  const connectedPorts = [...(connections.get(fromPortId) ?? [])]
    .map((portId) => portsById.get(portId))
    .filter((port): port is BuilderTerminal => port !== undefined)
    .sort(sortPortsByPosition);
  const results: Array<Array<{ tag: string; type: InstructionType }>> = [];

  for (const connectedPort of connectedPorts) {
    const component = componentsById.get(connectedPort.componentId);

    if (!component || visitedComponents.has(component.id) || component.type === "POWER_SOURCE") {
      continue;
    }

    if (isCoilType(component.type)) {
      if (connectedPort.role !== "input" || !component.tag) {
        continue;
      }

      results.push([...instructionPath, { tag: component.tag, type: component.type }]);
      continue;
    }

    if (
      !isPassThroughType(component.type)
      || connectedPort.role !== "input"
      || getConductiveTerminalPairs(component).length === 0
    ) {
      continue;
    }

    const nextInstructionPath = componentNeedsTag(component.type) && component.tag
      ? [...instructionPath, { tag: component.tag, type: component.type }]
      : instructionPath;
    const outputPorts = getComponentTerminals(component)
      .filter((port) => port.role === "output" && port.pairId === connectedPort.pairId)
      .sort(sortPortsByPosition);

    for (const outputPort of outputPorts) {
      results.push(
        ...collectRungPaths(
          outputPort.portId,
          nextInstructionPath,
          new Set([...visitedComponents, component.id]),
          connections,
          portsById,
          componentsById
        )
      );
    }
  }

  return results;
}

function deriveProgram(components: BuilderComponent[], wires: BuilderWire[]): DerivedBuilderState {
  const { componentsById, connections, ports, portsById, wireConnections } = buildResolvedPortGraph(components, wires);
  const resolvedWires = wireConnections.length;

  const sourcePorts = ports
    .filter((port) => {
      const component = componentsById.get(port.componentId);
      return component?.type === "POWER_SOURCE" && port.role === "source";
    })
    .sort(sortPortsByPosition);
  const rungInstructionLists: Array<Array<{ tag: string; type: InstructionType }>> = [];

  for (const sourcePort of sourcePorts) {
    rungInstructionLists.push(
      ...collectRungPaths(
        sourcePort.portId,
        [],
        new Set([sourcePort.componentId]),
        connections,
        portsById,
        componentsById
      )
    );
  }

  return {
    program: {
      rungs: rungInstructionLists.map((instructions, rungIndex) => ({
        id: `builder-rung-${rungIndex + 1}`,
        instructions: instructions.map((instruction, instructionIndex) => ({
          id: `builder-rung-${rungIndex + 1}-instruction-${instructionIndex + 1}`,
          tag: instruction.tag,
          type: instruction.type
        }))
      }))
    },
    resolvedWires,
    runnableRungs: rungInstructionLists.length,
    unresolvedWires: wires.length - resolvedWires
  };
}

function computeElectricalState(
  components: BuilderComponent[],
  wires: BuilderWire[],
  running: boolean
): ElectricalState {
  const emptyState: ElectricalState = {
    componentVoltageById: new Map(),
    energizedComponentIds: new Set(),
    energizedNodeIds: new Set(),
    energizedWireIds: new Set()
  };

  if (!running) {
    return emptyState;
  }

  const { connections, portsById, wireNodeIdsByWire } = buildElectricalNodeGraph(components, wires);
  const electricalConnections = cloneConnections(connections);

  for (const component of components) {
    for (const [leftTerminalId, rightTerminalId] of getConductiveTerminalPairs(component)) {
      connectGraphNodes(
        electricalConnections,
        getElectricalPortNodeId(getPortId(component.id, leftTerminalId)),
        getElectricalPortNodeId(getPortId(component.id, rightTerminalId))
      );
    }
  }

  const energizedNodeIds = new Set<string>();
  const energizedComponentIds = new Set<string>();
  const componentVoltageById = new Map<string, number>();

  for (const component of components) {
    if (component.type !== "POWER_SOURCE") {
      continue;
    }

    const sourceVoltage = getSourceVoltage(component);
    const hotPortId = getElectricalPortNodeId(getPortId(component.id, "right"));
    const visited = new Set<string>();
    const queue = electricalConnections.has(hotPortId) ? [hotPortId] : [];

    componentVoltageById.set(component.id, sourceVoltage);
    energizedComponentIds.add(component.id);

    while (queue.length > 0) {
      const currentPortId = queue.shift();

      if (!currentPortId || visited.has(currentPortId)) {
        continue;
      }

      visited.add(currentPortId);
      energizedNodeIds.add(currentPortId);

      const currentPort = currentPortId.startsWith("port:")
        ? portsById.get(currentPortId.slice(5))
        : undefined;

      if (currentPort) {
        const previousVoltage = componentVoltageById.get(currentPort.componentId) ?? 0;
        componentVoltageById.set(currentPort.componentId, Math.max(previousVoltage, sourceVoltage));
        energizedComponentIds.add(currentPort.componentId);
      }

      for (const neighborPortId of electricalConnections.get(currentPortId) ?? []) {
        if (!visited.has(neighborPortId)) {
          queue.push(neighborPortId);
        }
      }
    }
  }

  const energizedWireIds = new Set<string>();

  for (const [wireId, nodeIds] of wireNodeIdsByWire.entries()) {
    if (nodeIds.some((nodeId) => energizedNodeIds.has(nodeId))) {
      energizedWireIds.add(wireId);
    }
  }

  return {
    componentVoltageById,
    energizedComponentIds,
    energizedNodeIds,
    energizedWireIds
  };
}

function getComponentLabelRowStyle(rotation: number): CSSProperties {
  const normalizedRotation = normalizeQuarterTurns(rotation);

  if (normalizedRotation === 1 || normalizedRotation === 3) {
    return { bottom: "-0.8rem" };
  }

  if (normalizedRotation === 2) {
    return { bottom: "-0.1rem" };
  }

  return { bottom: "0.25rem" };
}

function getComponentStatusBadge(component: BuilderComponent, running: boolean, energized: boolean): string | null {
  if (component.type === "POWER_SOURCE") {
    return `${getSourceVoltage(component)}V`;
  }

  if (isBreakerType(component.type)) {
    return isBreakerClosed(component) ? "Closed" : "Open";
  }

  if (!running) {
    return null;
  }

  if (component.type === "LAMP") {
    return energized ? "ON" : null;
  }

  if (component.type === "MOTOR") {
    return energized ? "RUN" : null;
  }

  return null;
}

export function DiagramBuilder(props: DiagramBuilderProps) {
  const {
    onProgramChange,
    onRunToggle,
    program,
    runDisabled = false,
    running = false,
    scanIntervalMs = 150,
    simulatorLabel = "Ready",
    simulatorMessage = "Press Run to simulate the current diagram.",
    simulatorTone = "info",
    tags,
    tick = 0
  } = props;
  const availableTags = tags.length > 0 ? tags : fallbackTags;
  const nextId = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const stageScrollRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<BuilderComponent[]>([]);
  const componentDragMovedRef = useRef(false);
  const dragState = useRef<{
    componentId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const panState = useRef<{
    scrollLeft: number;
    scrollTop: number;
    startX: number;
    startY: number;
  } | null>(null);
  const wirePointDragState = useRef<WirePointDragState | null>(null);
  const lastProgramSignature = useRef(JSON.stringify({ rungs: [] }));
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [wires, setWires] = useState<BuilderWire[]>([]);
  const [draftWirePoints, setDraftWirePoints] = useState<Point[]>([]);
  const [wireColor, setWireColor] = useState(DEFAULT_WIRE_COLOR);
  const [wireThickness, setWireThickness] = useState(DEFAULT_WIRE_THICKNESS);
  const [wireReconnectTarget, setWireReconnectTarget] = useState<{
    endpoint: WireEndpointKey;
    wireId: string;
  } | null>(null);
  const [mode, setMode] = useState<BuilderMode>("move");
  const [selection, setSelection] = useState<BuilderSelection>(null);
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);
  const [hasCustomLayout, setHasCustomLayout] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    componentsRef.current = components;
  }, [components]);

  function getCanvasPointFromClient(clientX: number, clientY: number): Point | null {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const bounds = canvas.getBoundingClientRect();

    return {
      x: clamp(clientX - bounds.left, 0, CANVAS_WIDTH),
      y: clamp(clientY - bounds.top, 0, CANVAS_HEIGHT)
    };
  }

  useEffect(() => {
    nextId.current = 0;
    const nextScene = buildSceneFromProgram(nextId, availableTags, program);
    const nextDerivedState = deriveProgram(nextScene.components, nextScene.wires);

    setComponents(nextScene.components);
    setWires(nextScene.wires);
    setDraftWirePoints([]);
    setSelection(null);
    setMode("move");
    setCursorPoint(null);
    setWireReconnectTarget(null);
    setHasCustomLayout(false);
    lastProgramSignature.current = JSON.stringify(nextDerivedState.program);
  }, [availableTags, program]);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (panState.current && stageScrollRef.current) {
        stageScrollRef.current.scrollLeft = panState.current.scrollLeft - (event.clientX - panState.current.startX);
        stageScrollRef.current.scrollTop = panState.current.scrollTop - (event.clientY - panState.current.startY);
        return;
      }

      if (wirePointDragState.current) {
        const point = getCanvasPointFromClient(event.clientX, event.clientY);

        if (!point) {
          return;
        }

        let didMove = false;

        setWires((currentWires) =>
          currentWires.map((wire) => {
            if (wire.id !== wirePointDragState.current?.wireId) {
              return wire;
            }

            const pointIndex = wirePointDragState.current.pointIndex;
            const currentPoint = wire.points[pointIndex];

            if (!currentPoint) {
              return wire;
            }

            const nextPoint = isWireEndpointIndex(pointIndex, wire.points.length)
              ? snapPointToPort(point, componentsRef.current)
              : point;

            if (pointsAreClose(currentPoint, nextPoint)) {
              return wire;
            }

            const nextPoints = [...wire.points];
            nextPoints[pointIndex] = nextPoint;
            didMove = true;

            return { ...wire, points: nextPoints };
          })
        );

        if (didMove) {
          setSelection({ kind: "wire", id: wirePointDragState.current.wireId });
          setHasCustomLayout(true);
        }

        return;
      }

      if (!dragState.current) {
        return;
      }

      const point = getCanvasPointFromClient(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      let didMove = false;

      setComponents((currentComponents) =>
        currentComponents.map((component) => {
          if (component.id !== dragState.current?.componentId) {
            return component;
          }

          const nextX = clamp(point.x - dragState.current.offsetX, 16, CANVAS_WIDTH - COMPONENT_WIDTH - 16);
          const nextY = clamp(point.y - dragState.current.offsetY, 16, CANVAS_HEIGHT - COMPONENT_HEIGHT - 16);

          if (nextX === component.x && nextY === component.y) {
            return component;
          }

          didMove = true;
          componentDragMovedRef.current = true;
          return { ...component, x: nextX, y: nextY };
        })
      );

      if (didMove) {
        setHasCustomLayout(true);
      }
    }

    function handleMouseUp() {
      panState.current = null;
      setIsPanning(false);
      dragState.current = null;
      wirePointDragState.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const derivedState = deriveProgram(components, wires);
  const electricalState = computeElectricalState(components, wires, running);
  const derivedProgramSignature = JSON.stringify(derivedState.program);
  const selectedComponent = selection?.kind === "component"
    ? components.find((component) => component.id === selection.id) ?? null
    : null;
  const selectedWire = selection?.kind === "wire"
    ? wires.find((wire) => wire.id === selection.id) ?? null
    : null;
  const selectedWireInspection = selectedWire ? inspectWire(selectedWire, components) : null;
  const selectedWireStatus = selectedWireInspection ? getWireStatusMeta(selectedWireInspection.status) : null;
  const previewPoints = draftWirePoints.length > 0 && cursorPoint !== null
    ? [...draftWirePoints, cursorPoint]
    : draftWirePoints;
  const syncLabel = hasCustomLayout ? "Playground wiring drives the sim" : "Loaded program seeded into canvas";
  const selectedPaletteType = selectedComponent?.type ?? null;
  const activeWireColor = selectedWire?.color ?? wireColor;
  const activeWireThickness = selectedWire?.thickness ?? wireThickness;
  const selectedComponentVoltage = selectedComponent
    ? electricalState.componentVoltageById.get(selectedComponent.id) ?? 0
    : 0;

  useEffect(() => {
    if (!hasCustomLayout || !onProgramChange || derivedProgramSignature === lastProgramSignature.current) {
      return;
    }

    lastProgramSignature.current = derivedProgramSignature;
    onProgramChange(derivedState.program);
  }, [derivedProgramSignature, derivedState.program, hasCustomLayout, onProgramChange]);

  function createComponent(type: BuilderComponentType): BuilderComponent {
    const componentIndex = components.length;

    return createCanvasComponent(
      nextId,
      availableTags,
      type,
      88 + (componentIndex % 5) * 188,
      112 + Math.floor(componentIndex / 5) * 152
    );
  }

  function appendDraftPoint(point: Point) {
    const snappedPoint = resolveSnapTarget(point, components, wires).point;

    setDraftWirePoints((currentPoints) => {
      const previousPoint = currentPoints[currentPoints.length - 1];

      if (previousPoint && pointsAreClose(previousPoint, snappedPoint)) {
        return currentPoints;
      }

      return [...currentPoints, snappedPoint];
    });
  }

  function activateMoveMode() {
    setMode("move");
    setDraftWirePoints([]);
    setCursorPoint(null);
    panState.current = null;
    setIsPanning(false);
    setWireReconnectTarget(null);
  }

  function activatePanMode() {
    setMode("pan");
    setDraftWirePoints([]);
    setCursorPoint(null);
    dragState.current = null;
    wirePointDragState.current = null;
    setWireReconnectTarget(null);
  }

  function updateWirePoints(wireId: string, updatePoints: (points: Point[]) => Point[]) {
    setWires((currentWires) =>
      currentWires.map((wire) => {
        if (wire.id !== wireId) {
          return wire;
        }

        const nextPoints = updatePoints(wire.points);
        return { ...wire, points: nextPoints.length >= 2 ? nextPoints : wire.points };
      })
    );
    setSelection({ kind: "wire", id: wireId });
    setHasCustomLayout(true);
  }

  function handleWirePointMouseDown(
    event: ReactMouseEvent<SVGCircleElement>,
    wireId: string,
    pointIndex: number
  ) {
    event.preventDefault();
    event.stopPropagation();
    wirePointDragState.current = { pointIndex, wireId };
    setWireReconnectTarget(null);
    setSelection({ kind: "wire", id: wireId });
  }

  function removeWireBendPoint(wireId: string, pointIndex: number) {
    updateWirePoints(wireId, (points) => {
      if (points.length <= 2 || isWireEndpointIndex(pointIndex, points.length)) {
        return points;
      }

      return points.filter((_, index) => index !== pointIndex);
    });
  }

  function addBendToSelectedWire() {
    if (!selectedWire || selectedWire.points.length < 2) {
      return;
    }

    updateWirePoints(selectedWire.id, (points) => {
      let longestSegmentIndex = 0;
      let longestSegmentLength = -1;

      for (let index = 0; index < points.length - 1; index += 1) {
        const currentPoint = points[index];
        const nextPoint = points[index + 1];

        if (!currentPoint || !nextPoint) {
          continue;
        }

        const segmentLength = distanceBetween(currentPoint, nextPoint);

        if (segmentLength > longestSegmentLength) {
          longestSegmentLength = segmentLength;
          longestSegmentIndex = index;
        }
      }

      const leftPoint = points[longestSegmentIndex];
      const rightPoint = points[longestSegmentIndex + 1];

      if (!leftPoint || !rightPoint) {
        return points;
      }

      const bendPoint = getWireSegmentMidpoint(leftPoint, rightPoint);

      return [
        ...points.slice(0, longestSegmentIndex + 1),
        bendPoint,
        ...points.slice(longestSegmentIndex + 1)
      ];
    });
  }

  function startWireReconnect(endpoint: WireEndpointKey) {
    if (!selectedWire) {
      return;
    }

    wirePointDragState.current = null;
    setWireReconnectTarget((currentTarget) =>
      currentTarget?.wireId === selectedWire.id && currentTarget.endpoint === endpoint
        ? null
        : { endpoint, wireId: selectedWire.id }
    );
    setSelection({ kind: "wire", id: selectedWire.id });
  }

  function finishWireReconnect(point: Point) {
    if (!wireReconnectTarget) {
      return;
    }

    setWires((currentWires) => {
      const snapTarget = resolveSnapTarget(point, componentsRef.current, currentWires, wireReconnectTarget.wireId);
      let nextWires = currentWires;

      if (snapTarget.wireAnchor) {
        nextWires = applyWireAnchor(nextWires, snapTarget.wireAnchor);
      }

      return nextWires.map((wire) => {
        if (wire.id !== wireReconnectTarget.wireId || wire.points.length === 0) {
          return wire;
        }

        const nextPoints = [...wire.points];
        const endpointIndex = wireReconnectTarget.endpoint === "start" ? 0 : wire.points.length - 1;
        nextPoints[endpointIndex] = snapTarget.point;
        return { ...wire, points: normalizeWirePoints(nextPoints) };
      });
    });
    setSelection({ kind: "wire", id: wireReconnectTarget.wireId });
    setHasCustomLayout(true);
    setWireReconnectTarget(null);
  }

  function disconnectWireEndpoint(wireId: string, endpoint: WireEndpointKey) {
    updateWirePoints(wireId, (points) => {
      const detachedPoint = getDetachedWirePoint(points, endpoint);

      if (!detachedPoint) {
        return points;
      }

      const nextPoints = [...points];
      const endpointIndex = endpoint === "start" ? 0 : points.length - 1;
      nextPoints[endpointIndex] = detachedPoint;
      return nextPoints;
    });
    setWireReconnectTarget(null);
  }

  function reverseSelectedWire() {
    if (!selectedWire) {
      return;
    }

    updateWirePoints(selectedWire.id, (points) => [...points].reverse());
    setWireReconnectTarget(null);
  }

  function simplifySelectedWire() {
    if (!selectedWire) {
      return;
    }

    updateWirePoints(selectedWire.id, (points) => simplifyWirePoints(points));
  }

  function updateWireColor(nextColor: string) {
    setWireColor(nextColor);

    if (!selectedWire) {
      return;
    }

    setWires((currentWires) =>
      currentWires.map((wire) =>
        wire.id === selectedWire.id
          ? { ...wire, color: nextColor }
          : wire
      )
    );
    setHasCustomLayout(true);
  }

  function updateWireThickness(nextThickness: number) {
    const resolvedThickness = clampWireThickness(nextThickness);

    setWireThickness(resolvedThickness);

    if (!selectedWire) {
      return;
    }

    setWires((currentWires) =>
      currentWires.map((wire) =>
        wire.id === selectedWire.id
          ? { ...wire, thickness: resolvedThickness }
          : wire
      )
    );
    setHasCustomLayout(true);
  }

  function handleCanvasClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (mode === "pan") {
      return;
    }

    if (wireReconnectTarget) {
      const point = getCanvasPointFromClient(event.clientX, event.clientY);

      if (!point) {
        return;
      }

      finishWireReconnect(point);
      return;
    }

    if (mode !== "wire") {
      setSelection(null);
      return;
    }

    const point = getCanvasPointFromClient(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    appendDraftPoint(point);
  }

  function handleCanvasMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    if (mode !== "wire") {
      return;
    }

    const point = getCanvasPointFromClient(event.clientX, event.clientY);

    if (point) {
      setCursorPoint(resolveSnapTarget(point, components, wires).point);
    }
  }

  function handleFinishWire() {
    const nextPoints = normalizeWirePoints(draftWirePoints.map(roundPoint));

    if (nextPoints.length < 2) {
      return;
    }

    const wireId = createId(nextId, "builder-wire");

    setWires((currentWires) => {
      const { anchors, points } = anchorWireEndpoints(nextPoints, componentsRef.current, currentWires);
      let nextWires = currentWires;

      for (const anchor of anchors) {
        nextWires = applyWireAnchor(nextWires, anchor);
      }

      return [
        ...nextWires,
        { color: wireColor, id: wireId, points, thickness: wireThickness }
      ];
    });
    setSelection({ kind: "wire", id: wireId });
    setDraftWirePoints([]);
    setHasCustomLayout(true);
  }

  function handleDeleteSelection() {
    if (!selection) {
      return;
    }

    if (selection.kind === "component") {
      setComponents((currentComponents) => currentComponents.filter((component) => component.id !== selection.id));
    } else {
      setWires((currentWires) => currentWires.filter((wire) => wire.id !== selection.id));
    }

    setWireReconnectTarget(null);
    setSelection(null);
    setHasCustomLayout(true);
  }

  function handleResetCanvas() {
    nextId.current = 0;
    const nextScene = buildSceneFromProgram(nextId, availableTags, program);

    setComponents(nextScene.components);
    setWires(nextScene.wires);
    setDraftWirePoints([]);
    setSelection(null);
    setMode("move");
    setCursorPoint(null);
    setIsPanning(false);
    setWireReconnectTarget(null);
    setHasCustomLayout(true);
  }

  function handleStageScrollMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (mode !== "pan" || !stageScrollRef.current) {
      return;
    }

    event.preventDefault();
    panState.current = {
      scrollLeft: stageScrollRef.current.scrollLeft,
      scrollTop: stageScrollRef.current.scrollTop,
      startX: event.clientX,
      startY: event.clientY
    };
    setIsPanning(true);
  }

  function handleComponentHandleMouseDown(event: ReactMouseEvent<HTMLDivElement>, componentId: string) {
    if (mode !== "move") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    componentDragMovedRef.current = false;

    const component = components.find((entry) => entry.id === componentId);
    const point = getCanvasPointFromClient(event.clientX, event.clientY);

    if (!component || !point) {
      return;
    }

    dragState.current = {
      componentId,
      offsetX: point.x - component.x,
      offsetY: point.y - component.y
    };
    setSelection({ kind: "component", id: componentId });
  }

  function handlePlaneLabelChange(componentId: string, nextLabel: string) {
    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === componentId
          ? { ...component, label: nextLabel, usesCustomLabel: true }
          : component
      )
    );
    setHasCustomLayout(true);
  }

  function handlePlaneLabelBlur(componentId: string) {
    setComponents((currentComponents) =>
      currentComponents.map((component) => {
        if (component.id !== componentId) {
          return component;
        }

        const trimmedLabel = component.label.trim();

        if (trimmedLabel !== "") {
          return trimmedLabel === component.label ? component : { ...component, label: trimmedLabel };
        }

        return {
          ...component,
          label: getDefaultComponentLabel(component.type, availableTags, component.tag),
          usesCustomLabel: false
        };
      })
    );
  }

  function rotateComponent(componentId: string, direction: -1 | 1) {
    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === componentId
          ? { ...component, rotation: normalizeQuarterTurns(component.rotation + direction) }
          : component
      )
    );
    setHasCustomLayout(true);
  }

  function toggleBreaker(componentId: string) {
    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === componentId && isBreakerType(component.type)
          ? { ...component, isClosed: !isBreakerClosed(component) }
          : component
      )
    );
    setSelection({ kind: "component", id: componentId });
    setHasCustomLayout(true);
  }

  function handleSelectedSourceVoltageChange(nextVoltage: number) {
    if (!selectedComponent || selectedComponent.type !== "POWER_SOURCE") {
      return;
    }

    const resolvedVoltage = Number.isFinite(nextVoltage)
      ? clamp(Math.round(nextVoltage), 1, 600)
      : DEFAULT_SOURCE_VOLTAGE;

    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === selectedComponent.id
          ? { ...component, sourceVoltage: resolvedVoltage }
          : component
      )
    );
    setHasCustomLayout(true);
  }

  function handleSelectedComponentTagChange(nextTag: string) {
    if (!selectedComponent || !componentNeedsTag(selectedComponent.type)) {
      return;
    }

    setComponents((currentComponents) =>
      currentComponents.map((component) => {
        if (component.id !== selectedComponent.id) {
          return component;
        }

        return {
          ...component,
          label: component.usesCustomLabel
            ? component.label
            : getDefaultComponentLabel(component.type, availableTags, nextTag),
          tag: nextTag
        };
      })
    );
    setHasCustomLayout(true);
  }

  return (
    <section className="panel panel--builder">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Graphic simulator</p>
          <h2 className="panel__title">Build and run directly on the drawing</h2>
          <p className="panel__subtitle">
            The playground is now the main simulator surface. Place ANSI symbols, wire through explicit
            terminals, and run the diagram from here instead of using the old dashboard controls.
          </p>
        </div>

        <div className="control-panel__stats">
          <span className="status-pill status-pill--neutral">{components.length} symbols</span>
          <span className="status-pill status-pill--neutral">{wires.length} wires</span>
          <span className="status-pill status-pill--neutral">{derivedState.runnableRungs} runnable rungs</span>
        </div>
      </div>

      <div className="builder-freeplay">
        <aside className="builder-sidebar">
          <section className="builder-card">
            <div className="builder-card__title">Tools</div>

            <div className="builder-mode-switch" role="group" aria-label="Playground mode">
              <button
                type="button"
                className={`button ${mode === "move" ? "button--primary" : "button--ghost"} builder-mode-button`.trim()}
                onClick={activateMoveMode}
              >
                Move
              </button>
              <button
                type="button"
                className={`button ${mode === "pan" ? "button--primary" : "button--ghost"} builder-mode-button`.trim()}
                onClick={activatePanMode}
              >
                Pan
              </button>
              <button
                type="button"
                className={`button ${mode === "wire" ? "button--primary" : "button--ghost"} builder-mode-button`.trim()}
                onClick={() => {
                  panState.current = null;
                  setIsPanning(false);
                  setMode("wire");
                }}
              >
                Draw wire
              </button>
            </div>

            <div className="builder-wire-settings">
              <p className="builder-wire-settings__label">
                {selectedWire ? "Selected wire settings" : "Default wire settings"}
              </p>

              <label className="builder-color-field">
                <span className="field__label">Wire color</span>
                <input
                  type="color"
                  className="builder-color-input"
                  value={activeWireColor}
                  onChange={(event) => updateWireColor(event.target.value)}
                />
              </label>

              <label className="builder-slider-field">
                <span className="field__label">Thickness</span>
                <div className="builder-slider-row">
                  <input
                    type="range"
                    min="2"
                    max="12"
                    step="1"
                    className="builder-slider-input"
                    value={activeWireThickness}
                    onChange={(event) => updateWireThickness(Number(event.target.value))}
                  />
                  <strong className="builder-slider-value">{activeWireThickness}px</strong>
                </div>
              </label>
            </div>

            <div className="builder-action-row">
              <button
                type="button"
                className="button button--secondary"
                onClick={handleFinishWire}
                disabled={draftWirePoints.length < 2}
              >
                Finish wire
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  setDraftWirePoints([]);
                  setCursorPoint(null);
                  setWireReconnectTarget(null);
                }}
                disabled={draftWirePoints.length === 0 && wireReconnectTarget === null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={handleDeleteSelection}
                disabled={selection === null}
              >
                Delete
              </button>
              <button type="button" className="button button--ghost" onClick={handleResetCanvas}>
                Reset
              </button>
            </div>

            <p className="builder-card__copy">{syncLabel}</p>
          </section>

          <section className="builder-card">
            <div className="builder-card__title">Components</div>

            <div className="builder-palette-list">
              {instructionPalette.map((instruction) => (
                <button
                  key={instruction.type}
                  type="button"
                  className={`button button--ghost builder-palette-tile ${selectedPaletteType === instruction.type ? "builder-palette-tile--selected" : ""}`.trim()}
                  aria-pressed={selectedPaletteType === instruction.type}
                  onClick={() => {
                    const nextComponent = createComponent(instruction.type);
                    setComponents((currentComponents) => [...currentComponents, nextComponent]);
                    setSelection({ kind: "component", id: nextComponent.id });
                    setHasCustomLayout(true);
                  }}
                >
                  <span className={`builder-palette-tile__symbol builder-palette-tile__symbol--${getSymbolCategory(instruction.type)}`}>
                    {renderSymbolGraphic(instruction.type)}
                  </span>
                  <span className="builder-palette-tile__info">
                    <span className="builder-palette-tile__label">{instruction.label}</span>
                    <span className="builder-palette-tile__copy">{instruction.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className={`builder-card ${selection ? "builder-card--active" : ""}`.trim()}>
            <div className="builder-card__title">Properties</div>

            {selectedComponent ? (
              <>
                <div className="builder-props-grid">
                  <span className="builder-props-label">Symbol</span>
                  <strong className="builder-props-value">{getComponentName(selectedComponent.type)}</strong>
                  <span className="builder-props-label">Plane name</span>
                  <strong className="builder-props-value">{selectedComponent.label || "(unnamed)"}</strong>
                  <span className="builder-props-label">Terminals</span>
                  <strong className="builder-props-value">{getTerminalCount(selectedComponent.type)}</strong>
                  <span className="builder-props-label">Rotation</span>
                  <strong className="builder-props-value">{normalizeQuarterTurns(selectedComponent.rotation) * 90}deg</strong>
                  {selectedComponent.type === "POWER_SOURCE" ? (
                    <>
                      <span className="builder-props-label">Voltage</span>
                      <strong className="builder-props-value">{getSourceVoltage(selectedComponent)}V</strong>
                    </>
                  ) : null}
                  {isBreakerType(selectedComponent.type) ? (
                    <>
                      <span className="builder-props-label">State</span>
                      <strong className="builder-props-value">{isBreakerClosed(selectedComponent) ? "Closed" : "Open"}</strong>
                    </>
                  ) : null}
                  {running ? (
                    <>
                      <span className="builder-props-label">Live</span>
                      <strong className="builder-props-value">{selectedComponentVoltage > 0 ? `${selectedComponentVoltage}V` : "0V"}</strong>
                    </>
                  ) : null}
                </div>
                <div className="builder-selection__actions">
                  <button
                    type="button"
                    className="button button--ghost builder-selection__action-button"
                    onClick={() => rotateComponent(selectedComponent.id, -1)}
                  >
                    Rotate -90
                  </button>
                  <button
                    type="button"
                    className="button button--ghost builder-selection__action-button"
                    onClick={() => rotateComponent(selectedComponent.id, 1)}
                  >
                    Rotate +90
                  </button>
                </div>

                {selectedComponent.type === "POWER_SOURCE" ? (
                  <label className="builder-slider-field">
                    <span className="field__label">Source voltage</span>
                    <input
                      type="number"
                      min="1"
                      max="600"
                      step="1"
                      className="builder-number-input"
                      value={getSourceVoltage(selectedComponent)}
                      onChange={(event) => handleSelectedSourceVoltageChange(Number(event.target.value))}
                    />
                  </label>
                ) : null}

                {isBreakerType(selectedComponent.type) ? (
                  <button
                    type="button"
                    className={`button ${isBreakerClosed(selectedComponent) ? "button--secondary" : "button--primary"} builder-selection__action-button`.trim()}
                    onClick={() => toggleBreaker(selectedComponent.id)}
                  >
                    {isBreakerClosed(selectedComponent) ? "Open breaker" : "Close breaker"}
                  </button>
                ) : null}

                {componentNeedsTag(selectedComponent.type) ? (
                  <label className="builder-color-field">
                    <span className="field__label">Logic tag</span>
                    <select
                      className="freeplay-component__tag"
                      value={selectedComponent.tag ?? getDefaultTag(selectedComponent.type, availableTags)}
                      onChange={(event) => handleSelectedComponentTagChange(event.target.value)}
                    >
                      {availableTags.map((availableTag) => (
                        <option key={availableTag.name} value={availableTag.name}>
                          {availableTag.label ?? availableTag.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : selectedComponent.type === "POWER_SOURCE" ? (
                  <p className="builder-card__copy">
                    Set the source output voltage here. Press Run to see that voltage energize the connected path.
                  </p>
                ) : isBreakerType(selectedComponent.type) ? (
                  <p className="builder-card__copy">
                    Click the breaker on the sheet to toggle continuity. Breakers start open by default.
                  </p>
                ) : isVisualLoadType(selectedComponent.type) ? (
                  <p className="builder-card__copy">
                    {selectedComponent.type === "LAMP"
                      ? "Lamp symbols light when energized."
                      : selectedComponent.type === "MOTOR"
                        ? "Motor symbols spin when energized."
                        : "This load reacts when the path is energized."}
                  </p>
                ) : (
                  <p className="builder-card__copy">Passive symbol. No runtime tag is needed.</p>
                )}

                <p className="builder-card__copy">Double-click the symbol to rotate it. Rename it directly under the symbol on the sheet.</p>
              </>
            ) : selectedWire ? (
              <>
                {selectedWireStatus ? (
                  <div className="builder-wire-status">
                    <span className={`status-pill ${selectedWireStatus.className}`}>{selectedWireStatus.label}</span>
                    <span className="detail-chip">
                      {selectedWireInspection?.solverEligible ? "Used by solver" : "Ignored by solver"}
                    </span>
                    {wireReconnectTarget ? (
                      <span className="detail-chip detail-chip--pending">
                        Pick a terminal or a free point for the {wireReconnectTarget.endpoint} end
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="builder-props-grid">
                  <span className="builder-props-label">Wire</span>
                  <strong className="builder-props-value">{selectedWire.points.length} points</strong>
                  <span className="builder-props-label">Color</span>
                  <span className="builder-selection__swatch" style={{ backgroundColor: selectedWire.color }} />
                  <span className="builder-props-label">Thickness</span>
                  <strong className="builder-props-value">{selectedWire.thickness}px</strong>
                  <span className="builder-props-label">Segments</span>
                  <strong className="builder-props-value">{selectedWireInspection?.segments ?? 0}</strong>
                  <span className="builder-props-label">Bends</span>
                  <strong className="builder-props-value">{selectedWireInspection?.bends ?? 0}</strong>
                  <span className="builder-props-label">Length</span>
                  <strong className="builder-props-value">{selectedWireInspection?.length ?? 0}px</strong>
                </div>

                <div className="builder-wire-endpoints">
                  {([
                    ["start", selectedWireInspection?.start ?? null],
                    ["end", selectedWireInspection?.end ?? null]
                  ] as const).map(([endpointKey, endpoint]) => {
                    const reconnecting = wireReconnectTarget?.wireId === selectedWire.id && wireReconnectTarget.endpoint === endpointKey;
                    const endpointTitle = endpoint?.component
                      ? endpoint.component.label || getComponentName(endpoint.component.type)
                      : "Free point";
                    const endpointDetail = endpoint?.port
                      ? formatTerminalLabel(endpoint.port.terminalId)
                      : endpoint
                        ? `${Math.round(endpoint.point.x)}, ${Math.round(endpoint.point.y)}`
                        : "Not available";

                    return (
                      <div
                        key={endpointKey}
                        className={`builder-wire-endpoint ${endpoint?.port ? "builder-wire-endpoint--connected" : "builder-wire-endpoint--loose"}`.trim()}
                      >
                        <div className="builder-wire-endpoint__header">
                          <span className="builder-wire-endpoint__label">{endpointKey === "start" ? "Start" : "End"}</span>
                          <span className={`status-pill ${endpoint?.port ? "status-pill--on" : "status-pill--off"}`}>
                            {endpoint?.port ? "Snapped" : "Free"}
                          </span>
                        </div>
                        <strong className="builder-wire-endpoint__title">{endpointTitle}</strong>
                        <p className="builder-wire-endpoint__detail">{endpointDetail}</p>
                        <div className="builder-wire-endpoint__actions">
                          <button
                            type="button"
                            className={`button ${reconnecting ? "button--primary" : "button--ghost"}`.trim()}
                            onClick={() => startWireReconnect(endpointKey)}
                          >
                            {reconnecting ? "Pick point" : "Reconnect"}
                          </button>
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => disconnectWireEndpoint(selectedWire.id, endpointKey)}
                            disabled={!endpoint?.port}
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="builder-wire-actions">
                  <button type="button" className="button button--ghost" onClick={addBendToSelectedWire}>
                    Add bend
                  </button>
                  <button type="button" className="button button--ghost" onClick={reverseSelectedWire}>
                    Reverse route
                  </button>
                  <button type="button" className="button button--ghost" onClick={simplifySelectedWire}>
                    Simplify path
                  </button>
                </div>

                <p className="builder-card__copy">
                  {selectedWireStatus?.description ?? "Adjust color and thickness in Tools."} Drag any wire point to reshape it, and double-click a bend point to remove it.
                </p>
              </>
            ) : (
              <p className="builder-card__copy">Select a symbol or wire to inspect and adjust it.</p>
            )}
          </section>
        </aside>

        <div className="builder-stage">
          <div className="builder-stage__toolbar">
            <div className="builder-stage__toolbar-copy">
              <div className="builder-stage__status">
                <span className={`status-pill ${running ? "status-pill--on" : "status-pill--neutral"}`}>
                  {running ? "Running" : "Ready"}
                </span>
                <span className="status-pill status-pill--neutral">
                  {mode === "wire" ? "Wire mode" : mode === "pan" ? "Pan mode" : "Move mode"}
                </span>
                <span className="status-pill status-pill--neutral">Tick {tick}</span>
                <span className="status-pill status-pill--neutral">{scanIntervalMs} ms</span>
                <span className="status-pill status-pill--neutral">{derivedState.resolvedWires} connected wires</span>
                <span className="status-pill status-pill--neutral">{derivedState.unresolvedWires} loose wires</span>
                {running ? (
                  <span className="status-pill status-pill--neutral">{electricalState.energizedWireIds.size} live wires</span>
                ) : null}
              </div>
              <p className={`builder-stage__notice builder-stage__notice--${simulatorTone}`.trim()}>
                <strong>{simulatorLabel}:</strong> {simulatorMessage}
              </p>
              <p className="builder-stage__hint">
                {wireReconnectTarget
                  ? `Click a terminal or a free point to reconnect the ${wireReconnectTarget.endpoint} end.`
                  : mode === "pan"
                  ? "Drag anywhere on the sheet to move around the plane."
                  : selectedComponent
                  ? `${selectedComponent.label || getComponentName(selectedComponent.type)} selected`
                  : selectedWire
                    ? `Wire ${selectedWire.color} selected. Drag points to reshape it.`
                    : "Select a symbol or wire to edit it."}
              </p>
            </div>
            <button
              type="button"
              className={`button ${running ? "button--danger" : "button--primary"} builder-stage__run-button`.trim()}
              onClick={onRunToggle}
              disabled={runDisabled}
            >
              {running ? "Stop" : "Run"}
            </button>
          </div>

          <div
            ref={stageScrollRef}
            className={`builder-stage__scroll ${mode === "pan" ? "builder-stage__scroll--pan" : ""} ${isPanning ? "builder-stage__scroll--panning" : ""}`.trim()}
            onMouseDown={handleStageScrollMouseDown}
          >
            <div
              ref={canvasRef}
              className={`freeplay-canvas ${mode === "wire" ? "freeplay-canvas--wire" : ""} ${mode === "pan" ? "freeplay-canvas--pan" : ""} ${isPanning ? "freeplay-canvas--panning" : ""}`.trim()}
              onClick={handleCanvasClick}
              onMouseLeave={() => setCursorPoint(null)}
              onMouseMove={handleCanvasMouseMove}
            >
              <svg className="freeplay-svg" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} aria-hidden="true">
                {wires.map((wire) => {
                  const pointString = wire.points.map((point) => `${point.x},${point.y}`).join(" ");
                  const isSelected = selection?.kind === "wire" && selection.id === wire.id;
                  const isEnergized = running && electricalState.energizedWireIds.has(wire.id);
                  const strokeWidth = isSelected ? wire.thickness + 2 : wire.thickness;
                  const hitStrokeWidth = Math.max(18, wire.thickness + 10);

                  return (
                    <g key={wire.id}>
                      <polyline
                        className={`freeplay-wire ${isSelected ? "freeplay-wire--selected" : ""}`.trim()}
                        points={pointString}
                        stroke={wire.color}
                        style={{ strokeWidth }}
                      />
                      {isEnergized ? (
                        <polyline
                          className="freeplay-wire freeplay-wire--energized"
                          points={pointString}
                          style={{ strokeWidth: wire.thickness + 1.5 }}
                        />
                      ) : null}
                      <polyline
                        className="freeplay-wire__hit"
                        points={pointString}
                        style={{ strokeWidth: hitStrokeWidth }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setWireReconnectTarget(null);
                          setSelection({ kind: "wire", id: wire.id });
                        }}
                      />

                      {wire.points.map((point, index) => (
                        <circle
                          key={`${wire.id}-${index}`}
                          className={`freeplay-wire__node ${isSelected ? "freeplay-wire__node--selected" : ""} ${isWireEndpointIndex(index, wire.points.length) ? "freeplay-wire__node--endpoint" : "freeplay-wire__node--bend"}`.trim()}
                          cx={point.x}
                          cy={point.y}
                          r={isSelected ? (isWireEndpointIndex(index, wire.points.length) ? 6 : 5) : 4}
                          style={{ fill: isSelected ? wire.color : undefined, stroke: wire.color }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setWireReconnectTarget(null);
                            setSelection({ kind: "wire", id: wire.id });
                          }}
                          onDoubleClick={(event) => {
                            if (isWireEndpointIndex(index, wire.points.length)) {
                              return;
                            }

                            event.stopPropagation();
                            removeWireBendPoint(wire.id, index);
                          }}
                          onMouseDown={(event) => handleWirePointMouseDown(event, wire.id, index)}
                        />
                      ))}
                    </g>
                  );
                })}

                {previewPoints.length >= 1 ? (
                  <polyline
                    className="freeplay-wire freeplay-wire--draft"
                    points={previewPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                    stroke={wireColor}
                    style={{ strokeWidth: wireThickness }}
                  />
                ) : null}
              </svg>

              {components.map((component) => {
                const terminals = getComponentTerminals(component);
                const selected = selection?.kind === "component" && selection.id === component.id;
                const energized = running && electricalState.energizedComponentIds.has(component.id);
                const componentBadge = getComponentStatusBadge(component, running, energized);

                return (
                  <div
                    key={component.id}
                    className={[
                      "freeplay-component",
                      selected ? "freeplay-component--selected" : "",
                      energized ? "freeplay-component--energized" : "",
                      component.type === "LAMP" && energized ? "freeplay-component--lamp-on" : "",
                      component.type === "MOTOR" && energized ? "freeplay-component--motor-on" : ""
                    ].filter(Boolean).join(" ")}
                    style={{ left: component.x, top: component.y }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setWireReconnectTarget(null);
                      setSelection({ kind: "component", id: component.id });
                    }}
                  >
                    {componentBadge ? (
                      <div className={`freeplay-component__badge ${energized ? "freeplay-component__badge--live" : ""}`.trim()}>
                        {componentBadge}
                      </div>
                    ) : null}

                    {terminals.map((terminal) => (
                      <button
                        key={terminal.portId}
                        type="button"
                        className={`freeplay-port ${mode === "wire" ? "freeplay-port--active" : ""}`.trim()}
                        aria-label={`Connect to ${component.label} terminal ${terminal.terminalId}`}
                        style={{ left: terminal.x - component.x, top: terminal.y - component.y }}
                        onClick={(event) => {
                          event.stopPropagation();

                          if (wireReconnectTarget) {
                            finishWireReconnect({ x: terminal.x, y: terminal.y });
                            return;
                          }

                          setSelection({ kind: "component", id: component.id });

                          if (mode === "wire") {
                            appendDraftPoint({ x: terminal.x, y: terminal.y });
                          }
                        }}
                      />
                    ))}

                    <div
                      className="freeplay-component__glyph"
                      onClick={(event) => {
                        event.stopPropagation();

                        if (componentDragMovedRef.current) {
                          componentDragMovedRef.current = false;
                          return;
                        }

                        setSelection({ kind: "component", id: component.id });

                        if (mode === "move" && isBreakerType(component.type)) {
                          toggleBreaker(component.id);
                        }
                      }}
                      onDoubleClick={(event) => {
                        if (isBreakerType(component.type)) {
                          return;
                        }

                        event.stopPropagation();
                        rotateComponent(component.id, 1);
                      }}
                      onMouseDown={(event) => handleComponentHandleMouseDown(event, component.id)}
                    >
                      <div
                        className={`freeplay-component__symbol-rotator freeplay-component__symbol-rotator--${getSymbolCategory(component.type)}`.trim()}
                        style={{ transform: `rotate(${normalizeQuarterTurns(component.rotation) * 90}deg)` }}
                      >
                        {renderSymbolGraphic(component.type, {
                          breakerClosed: isBreakerType(component.type) ? isBreakerClosed(component) : undefined,
                          energized
                        })}
                      </div>
                    </div>

                    <div
                      className="freeplay-component__label-row"
                      style={getComponentLabelRowStyle(component.rotation)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {selected ? (
                        <input
                          className="freeplay-component__label-input"
                          spellCheck={false}
                          value={component.label}
                          onBlur={() => handlePlaneLabelBlur(component.id)}
                          onChange={(event) => handlePlaneLabelChange(component.id, event.target.value)}
                          onMouseDown={(event) => event.stopPropagation()}
                        />
                      ) : (
                        <span className="freeplay-component__label">{component.label}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}