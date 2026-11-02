import {
  type ChangeEvent as ReactChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import type { InstructionType, Program } from "@plc-sim/ladder-types";
import { SheetLayer, createDefaultSheetMetadata } from "./diagram/sheet";
import { buildWirePathD, findWireCrossings } from "./diagram/wireHops";
import type { SheetMetadata } from "./diagram/sheet";
import {
  buildDuplicatedComponent,
  closeComponentMenuOnEvent,
  isWireOriginHit,
  resolveCanvasContextMenuAction
} from "./diagram/interaction";
import type { ComponentMenuState } from "./diagram/interaction";
import type { TagDefinition } from "./projectData";
import {
  clampComponentToPlane,
  clampGridSpacing,
  clampPlaneHeight,
  clampPlaneWidth,
  clampPointToPlane,
  clampSceneBounds,
  clampSceneToPlane,
  clampWireToPlane,
  cleanWirePath,
  createOrthogonalPath,
  distanceBetween,
  getCanonicalWirePoint,
  getComponentPlanePadding,
  getComponentPlaneSnapOffset,
  getSegmentAxis,
  getTerminalApproachAxis,
  getWireSegmentMidpoint,
  isWireEndpointIndex,
  moveAttachedWireEndpoints,
  normalizeWirePoints,
  pointsAreClose,
  pointsShareCanonicalCoordinates,
  requantizeComponentToPlaneGrid,
  requantizeCoordinateToGrid,
  requantizePointToPlaneGrid,
  requantizeSceneToPlaneGrid,
  sanitizePlaneSettings,
  simplifyWirePoints,
  snapComponentToPlaneGrid,
  snapPointToGrid,
  repositionWireEndpointOrthogonally
} from "./diagram/grid";
import { reconcileWireTopology } from "./diagram/wireTopology";
import { getWireTerminalRoutes, resolveWireDisplayPoints } from "./diagram/wireRoute";
import {
  createCircuitSnapshot,
  createGeneratedInstructionTag,
  downloadCircuitSnapshot,
  isGeneratedInstructionTag,
  normalizeInstructionLabel,
  readCircuitSnapshotFile,
  readGeneratedInstructionLabel,
  syncInstructionComponentTag
} from "./diagram/snapshot";

type SourceComponentType = "POWER_SOURCE" | "DC_SOURCE";
type SourceCurrentType = "ac" | "dc";
export type LampGlowColorOption = "red" | "green" | "yellow" | "blue" | "white";
export type BuilderComponentType = InstructionType | "BREAKER_1P" | "BREAKER_2P" | "SWITCH_1P" | "PUSH_BUTTON_NO" | "PUSH_BUTTON_NC" | "ESTOP" | "LIMIT_SWITCH_NO" | "LIMIT_SWITCH_NC" | "OL_CONTACT" | SourceComponentType | "LAMP" | "MOTOR";
type TerminalRole = "source" | "input" | "output" | "end";
type WireConnectionStatus = "connected" | "loose-start" | "loose-end" | "loose-both" | "invalid-loop";
type WireEndpointKey = "start" | "end";
type BuilderSelection =
  | { kind: "component"; id: string }
  | { kind: "wire"; id: string }
  | null;

export interface Point {
  x: number;
  y: number;
}

export interface BuilderComponent {
  delayMs?: number;
  id: string;
  isClosed?: boolean;
  isPressed?: boolean;
  label: string;
  lampGlowColor?: LampGlowColorOption;
  rotation: number;
  sourceVoltage?: number;
  tag: string | null;
  terminalLabels?: Partial<Record<string, string>>;
  type: BuilderComponentType;
  usesCustomLabel: boolean;
  x: number;
  y: number;
  label: string;
  rotation: number;
  sourceVoltage?: number;
  tag: string | null;
  terminalLabels?: Partial<Record<string, string>>;
  type: BuilderComponentType;
  usesCustomLabel: boolean;
  x: number;
  y: number;
}

export interface BuilderWire {
  color: string;
  endPortId: string | null;
  id: string;
  points: Point[];
  startPortId: string | null;
  thickness: number;
}

interface TerminalDefinition {
  id: string;
  label: string;
  pairId?: string | undefined;
  role: TerminalRole;
  x: number;
  y: number;
}

export interface BuilderTerminal {
  componentId: string;
  defaultLabel: string;
  label: string;
  pairId?: string | undefined;
  portId: string;
  role: TerminalRole;
  terminalId: string;
  x: number;
  y: number;
}

export interface BuilderScene {
  components: BuilderComponent[];
  wires: BuilderWire[];
}

export interface BuilderPlaneSettings {
  gridSpacing: number;
  height: number;
  width: number;
}

export interface DiagramFault {
  kind: "short-circuit";
  message: string;
  sourceId: string;
  sourceLabel: string;
  voltage: number;
}

export interface CircuitSnapshot {
  components: BuilderComponent[];
  name: string;
  program: Program;
  savedAt: string;
  sheet: SheetMetadata;
  settings: {
    gridSpacing: number;
    height: number;
    scanIntervalMs: number;
    width: number;
  };
  tags: TagDefinition[];
  version: number;
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

interface TimedContactRuntimeState {
  actuationElapsedMs: number;
  elapsedMs: number;
}

type TimedContactStateByComponentId = Readonly<Record<string, TimedContactRuntimeState>>;

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
  fault: DiagramFault | null;
  idleWireCurrentById: Map<string, SourceCurrentType>;
  energizedWireCurrentById: Map<string, SourceCurrentType>;
  energizedWireIds: Set<string>;
  resolvedTagValues: Readonly<Record<string, boolean>>;
  timedContactStateByComponentId: TimedContactStateByComponentId;
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
  portId: string | null;
  wireAnchor: WireSegmentAnchor | null;
}

interface ElectricalNodeGraph {
  connections: Map<string, Set<string>>;
  portsById: Map<string, BuilderTerminal>;
  wireNodeIdsByWire: Map<string, string[]>;
}

interface DiagramBuilderProps {
  fault?: DiagramFault | null;
  onCircuitLoad?: (snapshot: CircuitSnapshot) => void;
  onFaultDetected?: (fault: DiagramFault) => void;
  onFaultReset?: () => void;
  onProgramChange?: (program: Program, tags: TagDefinition[]) => void;
  onRunToggle?: () => void;
  program?: Program | undefined;
  runDisabled?: boolean;
  running?: boolean;
  scanIntervalMs?: number;
  simulatorLabel?: string;
  simulatorMessage?: string;
  simulatorTone?: "error" | "info";
  tags: TagDefinition[];
  tagValues?: Record<string, boolean>;
  tick?: number;
}

export const COMPONENT_WIDTH = 160;
export const COMPONENT_HEIGHT = 136;
const COMPONENT_GLYPH_HEIGHT = 102;
const SYMBOL_VIEWPORT_WIDTH = COMPONENT_WIDTH;
const SYMBOL_VIEWPORT_HEIGHT = 84;

// El glifo se centra en el contenedor de 102 px. Con top=9 las patas de todos
// los viewBox (64/60/72) caen en y=51, que con componentes sobre la rejilla
// (y % 18 = 3) da terminales en multiplos de 18. No desplazar por CSS.
const SYMBOL_VIEWPORT_TOP = (COMPONENT_GLYPH_HEIGHT - SYMBOL_VIEWPORT_HEIGHT) / 2;
const SYMBOL_VIEWBOX_WIDTH = 128;
const DEFAULT_PLANE_WIDTH = 1720;
const DEFAULT_PLANE_HEIGHT = 940;
export const DEFAULT_GRID_SPACING = 18;
export const MIN_PLANE_WIDTH = 960;
export const MAX_PLANE_WIDTH = 4200;
export const MIN_PLANE_HEIGHT = 600;
export const MAX_PLANE_HEIGHT = 2400;
export const MIN_GRID_SPACING = 8;
export const MAX_GRID_SPACING = 96;
const SNAP_DISTANCE = 18;
// Unión deliberada a un cable existente: hay que soltar el punto practicamente
// encima del cable (SNAP_DISTANCE se usa para terminales, que es mas permisivo).
const WIRE_ANCHOR_DISTANCE = 4;
const DEFAULT_WIRE_COLOR = "#111827";
const DEFAULT_WIRE_THICKNESS = 3.5;
const DEFAULT_SOURCE_VOLTAGE = 120;
const DEFAULT_DC_SOURCE_VOLTAGE = 24;
const DEFAULT_CANVAS_ZOOM = 1;
const MIN_CANVAS_ZOOM = 0.5;
const MAX_CANVAS_ZOOM = 2;
const CANVAS_ZOOM_STEP = 0.1;
const MAINTAINED_SWITCH_CLICK_DELAY_MS = 220;
const TIMED_CONTACT_ACTUATION_DELAY_MS = 250;
export const DEFAULT_TIMED_CONTACT_DELAY_MS = 1000;
const DEFAULT_LAMP_GLOW_COLOR: LampGlowColorOption = "yellow";
const MAX_TIMED_CONTACT_DELAY_MS = 3_600_000;
export const GENERATED_INSTRUCTION_TAG_PREFIX = "__builder_label__:";
export const CIRCUIT_SNAPSHOT_VERSION = 2;
export const ROTATION_CENTER_X = COMPONENT_WIDTH / 2;
export const ROTATION_CENTER_Y = COMPONENT_GLYPH_HEIGHT / 2;
const BREAKER_2P_LEFT_TERMINAL_X = 8;
const BREAKER_2P_RIGHT_TERMINAL_X = 152;
const BREAKER_2P_TOP_TERMINAL_Y = 15;
const BREAKER_2P_BOTTOM_TERMINAL_Y = 69;
export const TERMINAL_LATTICE_X_OFFSET = ((ROTATION_CENTER_X % DEFAULT_GRID_SPACING) + DEFAULT_GRID_SPACING) % DEFAULT_GRID_SPACING;
export const TERMINAL_LATTICE_Y_OFFSET = ((ROTATION_CENTER_Y % DEFAULT_GRID_SPACING) + DEFAULT_GRID_SPACING) % DEFAULT_GRID_SPACING;
export const MAJOR_GRID_MULTIPLIER = 5;
export const SHEET_FRAME_INSET = 10;
export const TITLE_BLOCK_WIDTH = 420;
export const TITLE_BLOCK_HEIGHT = 110;
export const TITLE_BLOCK_PADDING = 12;
export const TITLE_BLOCK_ROW_HEIGHT = 22;
const PALETTE_DRAG_THRESHOLD = 6;
const EMPTY_TAG_VALUES: Readonly<Record<string, boolean>> = {};
const EMPTY_TIMED_CONTACT_STATES: TimedContactStateByComponentId = {};
export const DEFAULT_PLANE_SETTINGS: BuilderPlaneSettings = {
  gridSpacing: DEFAULT_GRID_SPACING,
  height: DEFAULT_PLANE_HEIGHT,
  width: DEFAULT_PLANE_WIDTH
};
export const LAMP_GLOW_COLOR_OPTIONS: ReadonlyArray<{ label: string; value: LampGlowColorOption }> = [
  { label: "Red", value: "red" },
  { label: "Green", value: "green" },
  { label: "Yellow", value: "yellow" },
  { label: "Blue", value: "blue" },
  { label: "White", value: "white" }
];

export const instructionPalette: Array<{
  description: string;
  label: string;
  type: BuilderComponentType;
}> = [
  { type: "POWER_SOURCE", label: "AC source", description: "Alternating source L1/L2" },
  { type: "DC_SOURCE", label: "DC source", description: "Direct source + / -" },
  { type: "BREAKER_1P", label: "1P breaker", description: "Single-pole breaker" },
  { type: "BREAKER_2P", label: "2P breaker", description: "Two-pole breaker" },
  { type: "SWITCH_1P", label: "Single switch", description: "Maintained open/closed switch" },
  { type: "PUSH_BUTTON_NO", label: "NO push button", description: "Momentary normally open switch" },
  { type: "PUSH_BUTTON_NC", label: "NC push button", description: "Momentary normally closed switch" },
  { type: "ESTOP", label: "E-stop", description: "Emergency stop, mushroom NC button" },
  { type: "LIMIT_SWITCH_NO", label: "Limit switch NO", description: "Plunger roller, normally open" },
  { type: "LIMIT_SWITCH_NC", label: "Limit switch NC", description: "Plunger roller, normally closed" },
  { type: "OL_CONTACT", label: "OL contact", description: "Overload contact, toggle from inspector" },
  { type: "LAMP", label: "Lamp", description: "Indicator lamp load" },
  { type: "MOTOR", label: "Motor", description: "Motor load" },
  { type: "XIC", label: "XIC", description: "Normally open contact" },
  { type: "XIO", label: "XIO", description: "Normally closed contact" },
  { type: "NOTC", label: "NOTC", description: "Normally open on-delay contact" },
  { type: "NCTO", label: "NCTO", description: "Normally closed on-delay contact" },
  { type: "OTE", label: "OTE", description: "Output energize coil" }
];

const fallbackTags: TagDefinition[] = [
  { name: "I:0/0", kind: "input", label: "Input" },
  { name: "O:0/0", kind: "output", label: "Output" },
  { name: "B3:0/0", kind: "internal", label: "Internal bit" }
];

export function componentNeedsTag(type: BuilderComponentType): type is InstructionType {
  return type === "XIC"
    || type === "XIO"
    || type === "NOTC"
    || type === "NCTO"
    || type === "OTE"
    || type === "OTL"
    || type === "OTU";
}

function isCoilType(type: BuilderComponentType): type is "OTE" | "OTL" | "OTU" {
  return type === "OTE" || type === "OTL" || type === "OTU";
}

function isContactType(type: BuilderComponentType): type is "XIC" | "XIO" | "NOTC" | "NCTO" {
  return type === "XIC" || type === "XIO" || type === "NOTC" || type === "NCTO";
}

export function isTimedContactType(type: BuilderComponentType): type is "NOTC" | "NCTO" {
  return type === "NOTC" || type === "NCTO";
}

function isSourceType(type: BuilderComponentType): type is SourceComponentType {
  return type === "POWER_SOURCE" || type === "DC_SOURCE";
}

function getSourceCurrentType(type: BuilderComponentType): SourceCurrentType | null {
  if (type === "DC_SOURCE") {
    return "dc";
  }

  if (type === "POWER_SOURCE") {
    return "ac";
  }

  return null;
}

function isPassThroughType(type: BuilderComponentType): boolean {
  return type === "BREAKER_1P"
    || type === "BREAKER_2P"
    || type === "SWITCH_1P"
    || type === "PUSH_BUTTON_NO"
    || type === "PUSH_BUTTON_NC"
    || type === "ESTOP"
    || type === "LIMIT_SWITCH_NO"
    || type === "LIMIT_SWITCH_NC"
    || type === "OL_CONTACT"
    || type === "XIC"
    || type === "XIO"
    || type === "NOTC"
    || type === "NCTO";
}

function isBreakerType(type: BuilderComponentType): type is "BREAKER_1P" | "BREAKER_2P" {
  return type === "BREAKER_1P" || type === "BREAKER_2P";
}

function isMaintainedSwitchType(type: BuilderComponentType): type is "SWITCH_1P" | "LIMIT_SWITCH_NO" | "LIMIT_SWITCH_NC" | "OL_CONTACT" {
  return type === "SWITCH_1P" || type === "LIMIT_SWITCH_NO" || type === "LIMIT_SWITCH_NC" || type === "OL_CONTACT";
}

function isMomentaryPushButtonType(type: BuilderComponentType): type is "PUSH_BUTTON_NO" | "PUSH_BUTTON_NC" | "ESTOP" {
  return type === "PUSH_BUTTON_NO" || type === "PUSH_BUTTON_NC" || type === "ESTOP";
}

function isVisualLoadType(type: BuilderComponentType): boolean {
  return type === "LAMP" || type === "MOTOR" || isCoilType(type);
}

function getSymbolCategory(type: BuilderComponentType): "power" | "breaker" | "contact" | "coil" | "load" {
  switch (type) {
    case "POWER_SOURCE":
    case "DC_SOURCE":
      return "power";
    case "BREAKER_1P":
    case "BREAKER_2P":
      return "breaker";
    case "SWITCH_1P":
    case "PUSH_BUTTON_NO":
    case "PUSH_BUTTON_NC":
    case "ESTOP":
    case "LIMIT_SWITCH_NO":
    case "LIMIT_SWITCH_NC":
    case "OL_CONTACT":
      return "contact";
    case "LAMP":
    case "MOTOR":
      return "load";
    case "XIC":
    case "XIO":
    case "NOTC":
    case "NCTO":
      return "contact";
    case "OTE":
    case "OTL":
    case "OTU":
      return "coil";
  }
}

function getDefaultSourceVoltage(type: BuilderComponentType): number {
  return type === "DC_SOURCE" ? DEFAULT_DC_SOURCE_VOLTAGE : DEFAULT_SOURCE_VOLTAGE;
}

function getLampGlowColorValue(color: LampGlowColorOption | undefined): { fill: string; stroke: string; symbol: string } {
  switch (color ?? DEFAULT_LAMP_GLOW_COLOR) {
    case "red":
      return { fill: "rgba(248, 113, 113, 0.42)", stroke: "#dc2626", symbol: "#dc2626" };
    case "green":
      return { fill: "rgba(74, 222, 128, 0.42)", stroke: "#16a34a", symbol: "#15803d" };
    case "blue":
      return { fill: "rgba(96, 165, 250, 0.38)", stroke: "#2563eb", symbol: "#1d4ed8" };
    case "white":
      return { fill: "rgba(255, 255, 255, 0.72)", stroke: "#94a3b8", symbol: "#e2e8f0" };
    case "yellow":
    default:
      return { fill: "rgba(250, 204, 21, 0.4)", stroke: "#ca8a04", symbol: "#d97706" };
  }
}

function getDefaultComponentColor(type: BuilderComponentType): string {
  switch (getSymbolCategory(type)) {
    case "power":
      return "#b45309";
    case "breaker":
      return "#0f766e";
    case "contact":
      return "#1d4ed8";
    case "coil":
      return "#b91c1c";
    case "load":
      return "#92400e";
  }
}

function clampWireThickness(value: number): number {
  return clamp(Math.round(value), 2, 12);
}

function normalizeWheelDeltaValue(delta: number, deltaMode: number): number {
  switch (deltaMode) {
    case 1:
      return delta * 16;
    case 2:
      return delta * 120;
    default:
      return delta;
  }
}

function clampCanvasZoom(value: number): number {
  // Pasos de 0.05: menos escalas fraccionarias y menos riesgo de que el SVG y
  // la capa HTML de componentes redondeen distinto al hacer scroll.
  return clamp(Math.round(value * 20) / 20, MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM);
}

export function clampTimedContactDelayMs(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TIMED_CONTACT_DELAY_MS;
  }

  return clamp(Math.round(value), 0, MAX_TIMED_CONTACT_DELAY_MS);
}

function getTimedContactDelayMs(component: BuilderComponent): number {
  return clampTimedContactDelayMs(component.delayMs ?? DEFAULT_TIMED_CONTACT_DELAY_MS);
}

function formatTimedContactDelaySeconds(delayMs: number): string {
  return (delayMs / 1000).toFixed(1);
}

function formatTimedContactCountdown(remainingMs: number): string {
  if (remainingMs >= 60_000) {
    const minutes = Math.floor(remainingMs / 60_000);
    const seconds = Math.floor((remainingMs % 60_000) / 1000);
    const tenths = Math.floor((remainingMs % 1000) / 100);

    return `T-${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  const seconds = remainingMs / 1000;

  return `T-${seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
}

function formatTimedContactPresetLabel(delayMs: number): string {
  return `${formatTimedContactDelaySeconds(delayMs)}s`;
}

function getTimedContactTimerDisplay(
  component: BuilderComponent,
  tagValues: Readonly<Record<string, boolean>>,
  timedContactStateByComponentId: TimedContactStateByComponentId = EMPTY_TIMED_CONTACT_STATES
): { label: string; progress: number } | null {
  if (!isTimedContactType(component.type)) {
    return null;
  }

  const delayMs = getTimedContactDelayMs(component);
  const presetLabel = formatTimedContactPresetLabel(delayMs);
  const inputActive = getInstructionTagValue(component, tagValues);

  if (!inputActive) {
    return {
      label: presetLabel,
      progress: 0
    };
  }

  const actuationElapsedMs = timedContactStateByComponentId[component.id]?.actuationElapsedMs ?? 0;
  const elapsedMs = timedContactStateByComponentId[component.id]?.elapsedMs ?? 0;
  const remainingMs = Math.max(0, TIMED_CONTACT_ACTUATION_DELAY_MS - actuationElapsedMs) + Math.max(0, delayMs - elapsedMs);
  const totalDurationMs = delayMs + TIMED_CONTACT_ACTUATION_DELAY_MS;

  return remainingMs > 0
    ? {
      label: formatTimedContactCountdown(remainingMs),
      progress: totalDurationMs > 0 ? clamp((totalDurationMs - remainingMs) / totalDurationMs, 0, 1) : 1
    }
    : {
      label: presetLabel,
      progress: 1
    };
}

function getSourceVoltage(component: BuilderComponent): number {
  return clamp(Math.round(component.sourceVoltage ?? getDefaultSourceVoltage(component.type)), 1, 600);
}

function formatSourceVoltage(component: BuilderComponent): string {
  const sourceCurrentType = getSourceCurrentType(component.type);

  if (!sourceCurrentType) {
    return `${getSourceVoltage(component)}V`;
  }

  return `${getSourceVoltage(component)}V${sourceCurrentType.toUpperCase()}`;
}

function isBreakerClosed(component: BuilderComponent): boolean {
  return isBreakerType(component.type);
}

function isMaintainedSwitchClosed(component: BuilderComponent): boolean {
  return isMaintainedSwitchType(component.type) ? component.isClosed ?? false : false;
}

function isMomentaryPushButtonPressed(component: BuilderComponent): boolean {
  return isMomentaryPushButtonType(component.type) ? component.isPressed ?? false : false;
}

/**
 * Acciona un pulsador momentaneo. El paro de emergencia enclava: cada click
 * alterna entre accionado y liberado, en vez de soltarse al levantar el pointer.
 */
export function applyMomentaryPress(components: BuilderComponent[], componentId: string): BuilderComponent[] {
  return components.map((component) => {
    if (component.id !== componentId) {
      return component;
    }

    if (component.type === "ESTOP") {
      return { ...component, isPressed: component.isPressed !== true };
    }

    return isMomentaryPushButtonType(component.type) ? { ...component, isPressed: true } : component;
  });
}

/** Suelta un pulsador momentaneo; el paro de emergencia queda enclavado. */
export function applyMomentaryRelease(components: BuilderComponent[], componentId: string): BuilderComponent[] {
  return components.map((component) =>
    component.id === componentId
      && component.type !== "ESTOP"
      && isMomentaryPushButtonType(component.type)
      && component.isPressed
      ? { ...component, isPressed: false }
      : component
  );
}

function getInstructionTagValue(
  component: BuilderComponent,
  tagValues: Readonly<Record<string, boolean>>
): boolean {
  return component.tag ? (tagValues[component.tag] ?? false) : false;
}

function isContactClosed(
  component: BuilderComponent,
  tagValues: Readonly<Record<string, boolean>>,
  previousTimedContactStateByComponentId: TimedContactStateByComponentId = EMPTY_TIMED_CONTACT_STATES,
  elapsedMsThisStep = 0
): boolean {
  if (component.type === "XIC") {
    return getInstructionTagValue(component, tagValues);
  }

  if (component.type === "XIO") {
    return !getInstructionTagValue(component, tagValues);
  }

   if (component.type === "NOTC" || component.type === "NCTO") {
    return previewTimedContactState(
      component,
      tagValues,
      previousTimedContactStateByComponentId,
      elapsedMsThisStep
    ).contactClosed;
  }

  return false;
}

function isContactActuated(component: BuilderComponent, contactClosed: boolean): boolean {
  switch (component.type) {
    case "XIC":
    case "NOTC":
      return contactClosed;
    case "XIO":
    case "NCTO":
      return !contactClosed;
    default:
      return false;
  }
}

function previewTimedContactState(
  component: BuilderComponent & { type: "NOTC" | "NCTO" },
  tagValues: Readonly<Record<string, boolean>>,
  previousTimedContactStateByComponentId: TimedContactStateByComponentId = EMPTY_TIMED_CONTACT_STATES,
  elapsedMsThisStep = 0
): TimedContactRuntimeState & { contactClosed: boolean } {
  const inputValue = getInstructionTagValue(component, tagValues);

  if (!inputValue) {
    return {
      actuationElapsedMs: 0,
      contactClosed: component.type === "NCTO",
      elapsedMs: 0
    };
  }

  const previousState = previousTimedContactStateByComponentId[component.id];
  const stepMs = Math.max(0, elapsedMsThisStep);
  const previousActuationElapsedMs = previousState?.actuationElapsedMs ?? 0;
  const previousElapsedMs = previousState?.elapsedMs ?? 0;
  const actuationRemainingMs = Math.max(0, TIMED_CONTACT_ACTUATION_DELAY_MS - previousActuationElapsedMs);
  const actuationStepMs = Math.min(stepMs, actuationRemainingMs);
  const nextActuationElapsedMs = Math.min(
    TIMED_CONTACT_ACTUATION_DELAY_MS,
    previousActuationElapsedMs + stepMs
  );
  const delayMs = getTimedContactDelayMs(component);
  const nextElapsedMs = Math.min(
    delayMs,
    previousElapsedMs + Math.max(0, stepMs - actuationStepMs)
  );
  const done = nextActuationElapsedMs >= TIMED_CONTACT_ACTUATION_DELAY_MS && nextElapsedMs >= delayMs;

  return {
    actuationElapsedMs: nextActuationElapsedMs,
    contactClosed: component.type === "NOTC" ? done : !done,
    elapsedMs: nextElapsedMs
  };
}

function collectTimedContactRuntimeStates(
  components: BuilderComponent[],
  tagValues: Readonly<Record<string, boolean>>,
  previousTimedContactStateByComponentId: TimedContactStateByComponentId = EMPTY_TIMED_CONTACT_STATES,
  elapsedMsThisStep = 0
): TimedContactStateByComponentId {
  const nextTimedContactStateByComponentId: Record<string, TimedContactRuntimeState> = {};

  for (const component of components) {
    if (!isTimedContactType(component.type) || !getInstructionTagValue(component, tagValues)) {
      continue;
    }

    const preview = previewTimedContactState(
      component,
      tagValues,
      previousTimedContactStateByComponentId,
      elapsedMsThisStep
    );

    nextTimedContactStateByComponentId[component.id] = {
      actuationElapsedMs: preview.actuationElapsedMs,
      elapsedMs: preview.elapsedMs
    };
  }

  return nextTimedContactStateByComponentId;
}

function getConductiveTerminalPairs(
  component: BuilderComponent,
  tagValues: Readonly<Record<string, boolean>> = EMPTY_TAG_VALUES,
  useLiveTagState = false,
  previousTimedContactStateByComponentId: TimedContactStateByComponentId = EMPTY_TIMED_CONTACT_STATES,
  elapsedMsThisStep = 0
): Array<[string, string]> {
  switch (component.type) {
    case "BREAKER_1P":
      return !useLiveTagState || isBreakerClosed(component) ? [["in", "out"]] : [];
    case "BREAKER_2P":
      return !useLiveTagState || isBreakerClosed(component)
        ? [["in-top", "out-top"], ["in-bottom", "out-bottom"]]
        : [];
    case "SWITCH_1P":
      return !useLiveTagState || isMaintainedSwitchClosed(component) ? [["in", "out"]] : [];
    case "PUSH_BUTTON_NO":
      return !useLiveTagState || isMomentaryPushButtonPressed(component) ? [["in", "out"]] : [];
    case "PUSH_BUTTON_NC":
    case "ESTOP":
      return !useLiveTagState || !isMomentaryPushButtonPressed(component) ? [["in", "out"]] : [];
    case "LIMIT_SWITCH_NO":
    case "LIMIT_SWITCH_NC":
    case "OL_CONTACT":
      return !useLiveTagState || isMaintainedSwitchClosed(component) ? [["in", "out"]] : [];
    case "XIC":
    case "XIO":
    case "NOTC":
    case "NCTO":
      return !useLiveTagState || isContactClosed(
        component,
        tagValues,
        previousTimedContactStateByComponentId,
        elapsedMsThisStep
      )
        ? [["in", "out"]]
        : [];
    case "LAMP":
    case "MOTOR":
    case "OTE":
    case "OTL":
    case "OTU":
      return useLiveTagState ? [] : [["in", "out"]];
    default:
      return [];
  }
}

function getComponentSuppliedTerminalNodeIds(
  component: BuilderComponent,
  feedReachableNodes: ReadonlySet<string>,
  returnReachableNodes: ReadonlySet<string>
): { feedNodeIds: string[]; returnNodeIds: string[] } | null {
  const terminalNodeIds = getComponentTerminals(component).map((terminal) => getElectricalPortNodeId(terminal.portId));
  const feedOnlyNodeIds = terminalNodeIds.filter(
    (nodeId) => feedReachableNodes.has(nodeId) && !returnReachableNodes.has(nodeId)
  );
  const returnOnlyNodeIds = terminalNodeIds.filter(
    (nodeId) => returnReachableNodes.has(nodeId) && !feedReachableNodes.has(nodeId)
  );

  if (feedOnlyNodeIds.length === 0 || returnOnlyNodeIds.length === 0) {
    return null;
  }

  return {
    feedNodeIds: feedOnlyNodeIds,
    returnNodeIds: returnOnlyNodeIds
  };
}

function getSourceTraversalTerminalIds(component: BuilderComponent): {
  feedTerminalId: "left" | "right";
  returnTerminalId: "left" | "right";
} {
  const leftPoint = getTerminalPoint(component, "left");
  const rightPoint = getTerminalPoint(component, "right");
  const horizontalSpan = Math.abs(leftPoint.x - rightPoint.x);
  const verticalSpan = Math.abs(leftPoint.y - rightPoint.y);

  if (horizontalSpan >= verticalSpan) {
    return leftPoint.x <= rightPoint.x
      ? { feedTerminalId: "left", returnTerminalId: "right" }
      : { feedTerminalId: "right", returnTerminalId: "left" };
  }

  return leftPoint.y <= rightPoint.y
    ? { feedTerminalId: "left", returnTerminalId: "right" }
    : { feedTerminalId: "right", returnTerminalId: "left" };
}

function buildElectricalSimulationGraph(
  components: BuilderComponent[],
  wires: BuilderWire[],
  tagValues: Readonly<Record<string, boolean>>,
  previousTimedContactStateByComponentId: TimedContactStateByComponentId = EMPTY_TIMED_CONTACT_STATES,
  elapsedMsThisStep = 0
): {
  componentsById: Map<string, BuilderComponent>;
  electricalConnections: Map<string, Set<string>>;
  portsById: Map<string, BuilderTerminal>;
  wireNodeIdsByWire: Map<string, string[]>;
} {
  const { connections, portsById, wireNodeIdsByWire } = buildElectricalNodeGraph(components, wires);
  const componentsById = new Map(components.map((component) => [component.id, component]));
  const electricalConnections = cloneConnections(connections);

  for (const component of components) {
    for (
      const [leftTerminalId, rightTerminalId] of getConductiveTerminalPairs(
        component,
        tagValues,
        true,
        previousTimedContactStateByComponentId,
        elapsedMsThisStep
      )
    ) {
      connectGraphNodes(
        electricalConnections,
        getElectricalPortNodeId(getPortId(component.id, leftTerminalId)),
        getElectricalPortNodeId(getPortId(component.id, rightTerminalId))
      );
    }
  }

  return { componentsById, electricalConnections, portsById, wireNodeIdsByWire };
}

function hasLoadFreeElectricalLoop(
  components: BuilderComponent[],
  wires: BuilderWire[],
  tagValues: Readonly<Record<string, boolean>>,
  previousTimedContactStateByComponentId: TimedContactStateByComponentId,
  elapsedMsThisStep: number
): boolean {
  const { electricalConnections } = buildElectricalSimulationGraph(
    components,
    wires,
    tagValues,
    previousTimedContactStateByComponentId,
    elapsedMsThisStep
  );

  for (const source of components) {
    if (!isSourceType(source.type)) {
      continue;
    }

    const { feedTerminalId, returnTerminalId } = getSourceTraversalTerminalIds(source);
    const feedNodes = collectReachableNodes(
      electricalConnections,
      getElectricalPortNodeId(getPortId(source.id, feedTerminalId))
    );
    const returnNodes = collectReachableNodes(
      electricalConnections,
      getElectricalPortNodeId(getPortId(source.id, returnTerminalId))
    );

    for (const nodeId of feedNodes) {
      if (returnNodes.has(nodeId)) {
        return true;
      }
    }
  }

  return false;
}

export function resolvePhysicalInstructionTagValues(
  components: BuilderComponent[],
  wires: BuilderWire[],
  tagValues: Readonly<Record<string, boolean>>,
  previousResolvedTagValues: Readonly<Record<string, boolean>> = EMPTY_TAG_VALUES,
  previousTimedContactStateByComponentId: TimedContactStateByComponentId = EMPTY_TIMED_CONTACT_STATES,
  elapsedMsThisStep = 0
): {
  resolvedTagValues: Readonly<Record<string, boolean>>;
  timedContactStateByComponentId: TimedContactStateByComponentId;
} {
  const latchedCoilTags = new Set(
    components
      .filter((component): component is BuilderComponent & { tag: string } => isCoilType(component.type) && component.type !== "OTE" && component.tag !== null)
      .map((component) => component.tag)
  );
  const physicalOutputCoils = components.filter(
    (component): component is BuilderComponent & { tag: string; type: "OTE" } => component.type === "OTE"
      && component.tag !== null
      && !latchedCoilTags.has(component.tag)
  );

  if (physicalOutputCoils.length === 0) {
    return {
      resolvedTagValues: tagValues,
      timedContactStateByComponentId: collectTimedContactRuntimeStates(
        components,
        tagValues,
        previousTimedContactStateByComponentId,
        elapsedMsThisStep
      )
    };
  }

  const physicalOutputTags = [...new Set(physicalOutputCoils.map((component) => component.tag))];
  let resolvedTagValues: Record<string, boolean> = { ...tagValues };

  for (const tag of physicalOutputTags) {
    resolvedTagValues[tag] = previousResolvedTagValues[tag] ?? false;
  }

  // La resolucion es un punto fijo: la bobina cambia el contacto que realimenta
  // su propia alimentacion. Si el circuito oscila (p. ej. un contacto en
  // paralelo con la bobina, que la cortocircuita), el resultado no puede
  // depender del numero de iteraciones ni del numero de componentes: se detecta
  // el ciclo y se dejan las bobinas fisicas en reposo (estado seguro).
  const stateKey = () => physicalOutputTags.map((tag) => (resolvedTagValues[tag] ? "1" : "0")).join("");
  const stateHistory: Array<{ key: string; values: Record<string, boolean> }> = [
    { key: stateKey(), values: { ...resolvedTagValues } }
  ];

  for (let iteration = 0; iteration < Math.max(components.length, 1); iteration += 1) {
    const { electricalConnections } = buildElectricalSimulationGraph(
      components,
      wires,
      resolvedTagValues,
      previousTimedContactStateByComponentId,
      elapsedMsThisStep
    );
    const nextResolvedTagValues: Record<string, boolean> = { ...resolvedTagValues };

    for (const tag of physicalOutputTags) {
      nextResolvedTagValues[tag] = false;
    }

    for (const component of components) {
      if (!isSourceType(component.type)) {
        continue;
      }

      const { feedTerminalId, returnTerminalId } = getSourceTraversalTerminalIds(component);
      const feedPortId = getElectricalPortNodeId(getPortId(component.id, feedTerminalId));
      const returnPortId = getElectricalPortNodeId(getPortId(component.id, returnTerminalId));
      const feedReachable = collectReachableNodes(electricalConnections, feedPortId);
      const returnReachable = collectReachableNodes(electricalConnections, returnPortId);

      for (const coilComponent of physicalOutputCoils) {
        if (getComponentSuppliedTerminalNodeIds(coilComponent, feedReachable, returnReachable)) {
          nextResolvedTagValues[coilComponent.tag] = true;
        }
      }
    }

    const tagStateChanged = physicalOutputTags.some((tag) => nextResolvedTagValues[tag] !== resolvedTagValues[tag]);

    resolvedTagValues = nextResolvedTagValues;

    if (!tagStateChanged) {
      break;
    }

    const key = stateKey();
    const cycleStartIndex = stateHistory.findIndex((entry) => entry.key === key);

    if (cycleStartIndex >= 0) {
      // El circuito no tiene punto fijo. Se identifican SOLO las bobinas que
      // cambian dentro del ciclo; las estables (p. ej. un reloj de enclavamiento
      // CR1) conservan su estado.
      const cycleStates = [
        ...stateHistory.slice(cycleStartIndex).map((entry) => entry.values),
        { ...resolvedTagValues }
      ];
      const oscillatingTags = physicalOutputTags.filter((tag) => {
        const values = new Set(cycleStates.map((state) => state[tag] === true));

        return values.size > 1;
      });
      const allCoilsOn: Record<string, boolean> = { ...resolvedTagValues };

      for (const tag of physicalOutputTags) {
        allCoilsOn[tag] = true;
      }

      const hasShort = hasLoadFreeElectricalLoop(
        components,
        wires,
        allCoilsOn,
        previousTimedContactStateByComponentId,
        elapsedMsThisStep
      );

      for (const tag of oscillatingTags) {
        resolvedTagValues[tag] = hasShort;
      }

      break;
    }

    stateHistory.push({ key, values: { ...resolvedTagValues } });
  }

  return {
    resolvedTagValues,
    timedContactStateByComponentId: collectTimedContactRuntimeStates(
      components,
      resolvedTagValues,
      previousTimedContactStateByComponentId,
      elapsedMsThisStep
    )
  };
}

function getInstructionSymbol(type: BuilderComponentType): string {
  switch (type) {
    case "POWER_SOURCE":
      return "L1 ~ L2";
    case "DC_SOURCE":
      return "- DC +";
    case "BREAKER_1P":
      return "--/ CB1 --";
    case "BREAKER_2P":
      return "--// CB2 --";
    case "SWITCH_1P":
      return "--o/ o--";
    case "PUSH_BUTTON_NO":
      return "--[PB NO]--";
    case "PUSH_BUTTON_NC":
      return "--[/PB NC]--";
    case "ESTOP":
      return "--[/ES]--";
    case "LIMIT_SWITCH_NO":
      return "--o/ NO o--";
    case "LIMIT_SWITCH_NC":
      return "--o/ NC o--";
    case "OL_CONTACT":
      return "--[/OL]--";
    case "LAMP":
      return "--(Lamp)--";
    case "MOTOR":
      return "--(Motor)--";
    case "XIC":
      return "--] [--";
    case "XIO":
      return "--]/[--";
    case "NOTC":
      return "--]T[--";
    case "NCTO":
      return "--]/T[--";
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
    return "AC source";
    case "DC_SOURCE":
    return "DC source";
    case "BREAKER_1P":
      return "Breaker 1P";
    case "BREAKER_2P":
      return "Breaker 2P";
    case "SWITCH_1P":
      return "Single switch";
    case "PUSH_BUTTON_NO":
      return "Push button NO";
    case "PUSH_BUTTON_NC":
      return "Push button NC";
    case "ESTOP":
      return "E-stop button";
    case "LIMIT_SWITCH_NO":
      return "Limit switch NO";
    case "LIMIT_SWITCH_NC":
      return "Limit switch NC";
    case "OL_CONTACT":
      return "OL contact";
    case "LAMP":
      return "Lamp";
    case "MOTOR":
      return "Motor";
    default:
      return type;
  }
}

function mergeInstructionBindingTags(tags: TagDefinition[], components: BuilderComponent[]): TagDefinition[] {
  const preservedTags = tags.filter((tag) => !isGeneratedInstructionTag(tag.name));
  const generatedTags = new Map<string, TagDefinition>();

  for (const component of components) {
    if (!componentNeedsTag(component.type) || !component.tag || !isGeneratedInstructionTag(component.tag)) {
      continue;
    }

    const label = normalizeInstructionLabel(component.label)
      || readGeneratedInstructionLabel(component.tag)
      || getComponentName(component.type);

    if (!generatedTags.has(component.tag)) {
      generatedTags.set(component.tag, {
        kind: "internal",
        label,
        name: component.tag
      });
    }
  }

  return [...preservedTags, ...generatedTags.values()];
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

    const generatedLabel = readGeneratedInstructionLabel(tagName);

    if (generatedLabel) {
      return generatedLabel;
    }

    if (componentNeedsTag(type)) {
      return tagName;
    }
  }

  switch (type) {
    case "POWER_SOURCE":
      return "L1-L2";
		case "DC_SOURCE":
		return "24VDC";
    case "BREAKER_1P":
      return "CB-1";
    case "BREAKER_2P":
      return "CB-2";
    case "SWITCH_1P":
      return "SW-1";
    case "PUSH_BUTTON_NO":
      return "PB-NO";
    case "PUSH_BUTTON_NC":
      return "PB-NC";
    case "ESTOP":
      return "ES-1";
    case "LIMIT_SWITCH_NO":
      return "LS-NO";
    case "LIMIT_SWITCH_NC":
      return "LS-NC";
    case "OL_CONTACT":
      return "OL-1";
    case "LAMP":
      return "LAMP";
    case "MOTOR":
      return "MOTOR";
    default:
      return getComponentName(type);
  }
}

function projectSymbolPoint(
  x: number,
  y: number,
  viewBoxHeight: number
): Point {
  const scale = Math.min(
    SYMBOL_VIEWPORT_WIDTH / SYMBOL_VIEWBOX_WIDTH,
    SYMBOL_VIEWPORT_HEIGHT / viewBoxHeight
  );
  const offsetX = (SYMBOL_VIEWPORT_WIDTH - SYMBOL_VIEWBOX_WIDTH * scale) / 2;
  const offsetY = SYMBOL_VIEWPORT_TOP + (SYMBOL_VIEWPORT_HEIGHT - viewBoxHeight * scale) / 2;
  const projectedPoint = {
    x: offsetX + x * scale,
    y: offsetY + y * scale
  };

  // El terminal local es la proyeccion EXACTA del arte; no se snapea a la
  // retícula (eso movia los bornes de viewBox 72 ~4.3 px respecto al glifo).
  return projectedPoint;
}

export function getTerminalDefinitions(type: BuilderComponentType): TerminalDefinition[] {
  switch (type) {
    case "POWER_SOURCE":
		case "DC_SOURCE": {
      const leftTerminal = projectSymbolPoint(6.4, 32, 64);
      const rightTerminal = projectSymbolPoint(121.6, 32, 64);

      return [
        { id: "left", label: type === "POWER_SOURCE" ? "L1" : "-", role: "source", x: leftTerminal.x, y: leftTerminal.y },
        { id: "right", label: type === "POWER_SOURCE" ? "L2" : "+", role: "source", x: rightTerminal.x, y: rightTerminal.y }
      ];
    }
    case "BREAKER_1P":
      {
        const inputTerminal = projectSymbolPoint(6, 32, 64);
        const outputTerminal = projectSymbolPoint(122, 32, 64);

      return [
          { id: "in", label: "1", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
          { id: "out", label: "2", pairId: "main", role: "output", x: outputTerminal.x, y: outputTerminal.y }
      ];
      }
    case "SWITCH_1P":
    case "LIMIT_SWITCH_NO":
    case "LIMIT_SWITCH_NC": {
      const inputTerminal = projectSymbolPoint(6.4, 32, 64);
      const outputTerminal = projectSymbolPoint(121.6, 32, 64);

      return [
        { id: "in", label: "In", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
        { id: "out", label: "Out", pairId: "main", role: "output", x: outputTerminal.x, y: outputTerminal.y }
      ];
    }
    case "BREAKER_2P":
      {
        const topInputTerminal = { x: BREAKER_2P_LEFT_TERMINAL_X, y: BREAKER_2P_TOP_TERMINAL_Y };
        const topOutputTerminal = { x: BREAKER_2P_RIGHT_TERMINAL_X, y: BREAKER_2P_TOP_TERMINAL_Y };
        const bottomInputTerminal = { x: BREAKER_2P_LEFT_TERMINAL_X, y: BREAKER_2P_BOTTOM_TERMINAL_Y };
        const bottomOutputTerminal = { x: BREAKER_2P_RIGHT_TERMINAL_X, y: BREAKER_2P_BOTTOM_TERMINAL_Y };

      return [
        { id: "in-top", label: "1", pairId: "top", role: "input", x: topInputTerminal.x, y: topInputTerminal.y },
        { id: "out-top", label: "2", pairId: "top", role: "output", x: topOutputTerminal.x, y: topOutputTerminal.y },
        { id: "in-bottom", label: "3", pairId: "bottom", role: "input", x: bottomInputTerminal.x, y: bottomInputTerminal.y },
        { id: "out-bottom", label: "4", pairId: "bottom", role: "output", x: bottomOutputTerminal.x, y: bottomOutputTerminal.y }
      ];
      }
    case "LAMP":
    case "MOTOR": {
      const inputTerminal = projectSymbolPoint(6.4, 32, 64);
      const outputTerminal = projectSymbolPoint(121.6, 32, 64);

      return [
        { id: "in", label: "In", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
        { id: "out", label: "Out", pairId: "main", role: "end", x: outputTerminal.x, y: outputTerminal.y }
      ];
    }
    case "PUSH_BUTTON_NO":
    case "PUSH_BUTTON_NC":
    case "ESTOP":
    case "OL_CONTACT": {
      return [
        { id: "in", label: "In", pairId: "main", role: "input", x: 8, y: 51 },
        { id: "out", label: "Out", pairId: "main", role: "output", x: 152, y: 51 }
      ];
    }
    case "XIC":
    case "XIO": {
      const inputTerminal = projectSymbolPoint(6.4, 32, 64);
      const outputTerminal = projectSymbolPoint(121.6, 32, 64);

      return [
        { id: "in", label: "In", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
        { id: "out", label: "Out", pairId: "main", role: "output", x: outputTerminal.x, y: outputTerminal.y }
      ];
    }
    case "NOTC":
    case "NCTO": {
      const inputTerminal = projectSymbolPoint(25.6, 30, 64);
      const outputTerminal = projectSymbolPoint(102.4, 30, 64);

      return [
        { id: "in", label: "In", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
        { id: "out", label: "Out", pairId: "main", role: "output", x: outputTerminal.x, y: outputTerminal.y }
      ];
    }
    case "OTE":
    case "OTL":
    case "OTU": {
      const inputTerminal = projectSymbolPoint(6.4, 30, 60);
      const outputTerminal = projectSymbolPoint(121.6, 30, 60);

      return [
        { id: "in", label: "In", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
        { id: "out", label: "Out", pairId: "main", role: "end", x: outputTerminal.x, y: outputTerminal.y }
      ];
    }
  }
}

function getTerminalCount(type: BuilderComponentType): number {
  return getTerminalDefinitions(type).length;
}

export function getDefaultEntryTerminalId(type: BuilderComponentType): string {
  switch (type) {
    case "BREAKER_2P":
      return "in-top";
    case "BREAKER_1P":
    case "SWITCH_1P":
    case "PUSH_BUTTON_NO":
    case "PUSH_BUTTON_NC":
    case "ESTOP":
    case "LIMIT_SWITCH_NO":
    case "LIMIT_SWITCH_NC":
    case "OL_CONTACT":
    case "LAMP":
    case "MOTOR":
    case "XIC":
    case "XIO":
    case "NOTC":
    case "NCTO":
    case "OTE":
    case "OTL":
    case "OTU":
      return "in";
    case "DC_SOURCE":
    case "POWER_SOURCE":
      return "left";
  }
}

function getDefaultExitTerminalId(type: BuilderComponentType): string {
  switch (type) {
    case "DC_SOURCE":
    case "POWER_SOURCE":
      return "right";
    case "BREAKER_2P":
      return "out-top";
    case "BREAKER_1P":
    case "SWITCH_1P":
    case "PUSH_BUTTON_NO":
    case "PUSH_BUTTON_NC":
    case "ESTOP":
    case "LIMIT_SWITCH_NO":
    case "LIMIT_SWITCH_NC":
    case "OL_CONTACT":
    case "XIC":
    case "XIO":
    case "NOTC":
    case "NCTO":
      return "out";
    case "LAMP":
    case "MOTOR":
    case "OTE":
    case "OTL":
    case "OTU":
      return "in";
  }
}

// Vector de referencia del usuario (limit switch NO, viewBox 1024x768) mapeado al
// viewBox 128x64 del símbolo: los círculos caen en (40,32)/(88,32) y las salidas
// en 3.2/124.8, la misma retícula que el resto de los símbolos.
const LIMIT_SWITCH_VECTOR_SCALE = 0.1403;
const LIMIT_SWITCH_VECTOR_TRANSFORM = `translate(-7.85 -21.85) scale(${LIMIT_SWITCH_VECTOR_SCALE})`;

// Bornes "13" y "14" del vector de referencia.
const LIMIT_SWITCH_VECTOR_LABEL_PATHS = [
  "M202.085 306.334 C202.729 309.714 203.329 313.183 205.618 315.902 C207.733 318.414 210.564 320.126 213.783 320.745 C219.84 321.909 226.716 321.523 231.149 316.621 C232.756 314.844 233.585 312.745 234.181 310.456 C236.464 301.687 232.957 292.454 223.504 290.313 C218.762 289.238 213.88 289.581 209.052 289.615 L209.07 280.585 C213.421 280.585 218.261 281.19 222.515 280.049 C228.128 278.544 232.65 274.545 233.384 268.536 C233.534 267.309 233.462 266.024 233.448 264.79 C233.414 261.868 232.682 258.432 230.811 256.102 C224.997 248.863 211.033 249.609 205.831 257.223 C203.998 259.907 203.418 262.851 203.001 266.008 L192.201 265.968 C192.711 261.227 193.748 256.953 196.399 252.917 C204.206 241.034 223.704 239.245 235.055 246.583 C244.744 252.845 247.292 268.128 240.573 277.356 C238.119 280.726 234.856 282.795 231.306 284.863 C235 286.365 238.535 288.204 241.156 291.317 C247.722 299.114 246.832 313.37 240.51 321.031 C230.112 333.63 206.243 333.309 196.222 320.395 C192.936 316.16 192.064 311.743 191.545 306.542 Z",
  "M128.918 254.75 C133.241 253.659 137.341 251.893 141.469 250.23 C145.008 248.805 148.648 247.65 152.228 246.334 C154.643 245.447 156.969 244.329 159.408 243.5 L161.191 242.97 L161.251 328.994 L150.578 328.924 L150.648 256.785 L128.881 264.699 Z",
  "M781.023 254.85 C785.694 253.586 790.099 251.602 794.613 249.893 C800.909 247.509 807.233 245.194 813.539 242.828 L813.607 328.95 L802.875 329.021 L802.776 256.784 L780.962 264.732 Z",
  "M891.107 243.371 C891.261 248.601 891.141 253.84 891.132 259.071 C891.119 267.072 891.175 275.074 891.175 283.075 C891.175 288.695 890.881 294.395 891.321 299.991 L903.218 299.999 L903.043 308.873 L891.124 308.979 L891.171 329.103 L880.232 329.032 L880.391 308.978 L841.4 308.811 C841.4 306.917 841.089 304.639 841.571 302.781 C842.108 300.709 843.753 299.029 844.891 297.275 C846.561 294.703 848.183 292.092 849.845 289.513 C856.281 279.524 862.625 269.467 869.213 259.578 C871.885 255.567 874.388 251.454 877.086 247.462 C877.837 246.351 878.371 244.82 879.47 244.003 C880.989 242.873 888.915 243.406 891.107 243.371 Z M880.316 259.915 C879.814 260.019 879.404 260 879.002 260.38 C878.255 261.086 877.841 262.207 877.321 263.077 C876.019 265.256 874.623 267.484 873.143 269.547 C870.877 272.706 868.993 276.179 866.89 279.447 C862.48 286.3 858.067 293.131 853.71 300.019 L880.239 300.034 Z"
];

// Terminales + salidas + cuchilla abierta del vector del usuario (izquierda) y
// terminal + salida (derecha). Los subpaths interiores son huecos: hay que
// rellenarlos con fill-rule="evenodd" para reproducir el dibujo original.
const LIMIT_SWITCH_VECTOR_LEFT_TERMINAL_PATH = "M294.061 379.191 C294.617 376.406 294.829 373.399 295.674 370.684 C298.788 360.677 304.883 351.875 313.321 345.659 C314.187 345.021 315.003 344.291 315.921 343.726 C336.554 331.025 363.818 335.596 378.542 355.083 C380.966 358.291 382.786 361.806 384.361 365.48 C386.455 370.364 387.575 374.83 387.949 380.135 C389.895 380.7 391.794 381.397 393.734 381.972 C398.274 383.318 402.895 384.361 407.442 385.686 C409.68 386.338 411.875 387.126 414.114 387.782 C417.784 388.856 421.532 389.688 425.201 390.76 C427.351 391.389 429.467 392.15 431.62 392.78 C435.606 393.946 439.644 394.98 443.65 396.062 C447.261 397.037 450.8 398.316 454.408 399.314 C462.658 401.597 470.905 403.878 479.141 406.226 C481.694 406.954 484.183 407.872 486.742 408.587 C502.914 413.103 519.046 417.721 535.207 422.278 C537.766 423 540.265 423.916 542.828 424.63 C545.712 425.433 548.631 426.112 551.512 426.922 C553.913 427.597 556.261 428.484 558.657 429.165 C563.217 430.46 567.832 431.566 572.381 432.892 C574.778 433.59 577.119 434.475 579.528 435.136 C583.541 436.236 587.579 437.247 591.576 438.412 C600.432 440.993 609.269 443.684 618.163 446.125 C621.361 447.003 624.598 447.78 627.771 448.75 C629.281 449.211 630.755 449.809 632.277 450.236 C645.475 453.942 658.655 457.755 671.858 461.457 C674.741 462.265 677.623 463.059 680.503 463.876 C681.852 464.259 683.266 464.56 684.528 465.196 C685.598 465.735 686.705 466.53 687.101 467.715 C687.629 469.295 686.919 470.968 686.5 472.48 C685.596 472.762 684.613 473.204 683.655 473.262 C681.089 473.418 677.912 471.961 675.432 471.328 C672.768 470.648 670.185 469.689 667.533 468.969 C663.521 467.881 659.478 466.895 655.509 465.65 C653.661 465.071 645.62 462.222 644.294 462.946 C642.772 463.777 640.814 466.716 639.673 468.126 C637.318 471.035 634.795 473.805 632.517 476.775 C631.451 478.164 630.187 479.373 629.076 480.719 C626.436 483.917 623.832 487.155 621.185 490.35 C618.484 493.612 615.794 496.875 613.068 500.116 C612.047 501.329 611.173 502.64 610.109 503.822 C608.221 505.918 606.45 508.139 604.658 510.317 C603.211 512.076 601.877 514.154 599.924 515.404 C599.221 515.854 598.391 516.017 597.564 516.019 C595.485 516.024 593.449 514.414 591.741 513.378 C587.834 511.01 583.833 508.767 580.004 506.273 C577.71 504.779 575.26 503.5 572.896 502.118 C568.816 499.733 564.788 497.209 560.721 494.79 C554.221 490.922 547.851 486.822 541.297 483.047 C531.362 477.325 521.627 471.227 511.82 465.288 C506.702 462.189 501.527 459.163 496.354 456.163 C495.13 455.453 493.994 454.601 492.785 453.871 C483.842 448.47 474.87 443.135 465.954 437.688 C464.254 436.649 462.471 435.751 460.765 434.722 C442.125 423.48 423.468 412.272 404.856 400.998 C399.148 397.541 393.334 394.257 387.672 390.713 C387.287 392.623 386.963 394.576 386.401 396.447 C384.599 402.443 381.545 408.5 377.559 413.331 C366.264 427.018 348.149 433.459 330.776 429.572 C328.866 429.145 327.169 428.413 325.337 427.785 C320.006 425.96 314.947 423.216 310.642 419.541 C305.16 414.861 301.451 409.614 298.358 403.166 C297.788 401.979 297.132 400.782 296.691 399.54 C295.363 395.799 294.821 391.895 294.1 388.01 C287.046 387.731 279.965 387.889 272.905 387.889 L237.401 387.889 L130.389 387.889 C117.554 387.889 104.719 387.893 91.884 387.893 C88.238 387.893 80.467 389.211 80.377 383.75 C80.305 379.34 83.957 379.271 87.325 379.284 C88.825 379.289 90.325 379.278 91.826 379.277 C104.577 379.263 117.328 379.276 130.08 379.276 L237.592 379.276 L273.097 379.276 C280.082 379.276 287.079 379.394 294.061 379.191 Z M302.589 384.5 C303.093 405.745 320.725 422.56 341.97 422.055 C363.216 421.551 380.03 403.919 379.526 382.674 C379.022 361.428 361.39 344.614 340.145 345.118 C318.899 345.622 302.085 363.254 302.589 384.5 Z M416.851 398.021 L416.88 398.991 C419.594 399.566 422.153 401.629 424.483 403.082 C427.095 404.711 429.793 406.17 432.367 407.855 C432.991 408.264 433.704 408.519 434.347 408.898 C435.997 409.869 437.619 410.889 439.268 411.863 C445.421 415.501 451.533 419.23 457.661 422.919 C464.348 426.944 470.988 431.056 477.687 435.053 C482.033 437.646 486.487 440.078 490.815 442.705 C492.02 443.437 493.137 444.312 494.346 445.038 C501.189 449.146 508.106 453.118 514.932 457.247 C526.956 464.52 538.942 471.848 551.065 478.951 C560.098 484.242 568.986 489.774 577.996 495.108 C580.49 496.583 582.872 498.297 585.443 499.635 C587.426 500.667 595.068 506.077 596.68 505.753 C598.034 505.481 599.181 503.574 599.988 502.571 C602.334 499.655 604.739 496.785 607.125 493.901 C611.79 488.264 616.475 482.643 621.206 477.064 C625.967 471.449 630.517 465.671 635.362 460.134 C629.791 458.084 623.97 456.772 618.271 455.119 C606.454 451.691 594.626 448.347 582.775 445.035 C581.653 444.721 580.593 444.214 579.47 443.903 C566.099 440.195 552.756 436.417 539.466 432.44 C535.253 431.18 530.945 430.187 526.716 428.97 C525.596 428.648 524.526 428.164 523.402 427.859 C516.735 426.05 510.122 424.115 503.493 422.175 C499.107 420.892 494.67 419.798 490.283 418.516 C479.026 415.227 467.741 412.043 456.448 408.882 C454.121 408.231 451.86 407.368 449.538 406.71 C445.86 405.667 442.123 404.819 438.45 403.77 C433.739 402.423 429.078 400.917 424.351 399.615 C421.83 398.921 419.491 398.03 416.851 398.021 Z";

const LIMIT_SWITCH_VECTOR_RIGHT_TERMINAL_PATH = "M730.084 379.302 C748.851 378.909 767.659 379.249 786.431 379.249 L894.215 379.249 L932.477 379.249 C935.853 379.249 943.898 378.053 944.059 383.186 C944.247 389.155 936.566 387.916 932.709 387.916 L894.447 387.916 L786.914 387.916 L751.402 387.916 C744.352 387.916 737.285 388.051 730.238 387.81 C728.202 399.895 724.148 410.02 714.865 418.404 C692.925 438.218 658.586 433.322 643.047 408.166 C637.986 399.973 635.998 390.54 636.313 380.999 C636.458 376.586 637.432 372.25 638.847 368.089 C645.843 347.521 666.217 334.79 687.71 336.817 C690.358 337.067 692.998 337.384 695.574 338.085 C708.57 341.621 720.397 351.3 725.901 363.69 C728.11 368.663 729.439 373.914 730.084 379.302 Z M644.727 384.499 C645.233 405.752 662.872 422.57 684.124 422.064 C705.377 421.558 722.196 403.919 721.689 382.667 C721.183 361.414 703.544 344.595 682.292 345.102 C661.039 345.608 644.221 363.247 644.727 384.499 Z";

// SVG del usuario para el limit switch NC (NC limit switch.svg, viewBox 220x53):
// simbolo cerrado + bornes "11"/"12". Los anillos y la cuna son subpaths huecos,
// asi que tambien necesita fill-rule="evenodd". El mapeo lleva los centros de los
// anillos (66.99,37) y (151.49,37) a la reticula (40,32)/(88,32).
const LIMIT_SWITCH_NC_VECTOR_SCALE = 0.568;
const LIMIT_SWITCH_NC_VECTOR_TRANSFORM = `translate(1.95 10.99) scale(${LIMIT_SWITCH_NC_VECTOR_SCALE})`;
const LIMIT_SWITCH_NC_VECTOR_SYMBOL_PATH = "M2.78 36 L55.246 35.941 C55.887 33.816 56.462 31.693 57.844 29.908 C61.911 24.654 69.975 23.931 74.846 28.498 C76.99 30.507 77.841 33.002 78.759 35.718 C86.369 34.851 93.934 33.597 101.519 32.53 C113.811 30.799 126.091 29.007 138.381 27.273 C141.268 26.866 144.147 26.406 147.036 26.009 C148.268 25.84 149.402 25.328 150.659 25.242 C154.64 24.971 158.925 27.318 161.117 30.563 C162.209 32.178 162.708 34.109 163.319 35.936 C175.598 35.996 187.879 35.941 200.158 35.941 C203.242 35.941 206.326 35.948 209.411 35.941 C211.038 35.937 212.788 35.76 214.402 35.977 C214.905 36.045 215.305 36.294 215.753 36.507 L215.768 38.007 L163.307 38.023 C161.964 42.394 160.396 45.767 155.946 47.678 C148.528 50.865 139.897 45.06 139.93 37.019 C139.942 33.866 141.364 31.487 142.921 28.847 L137.438 29.594 L131.025 48.885 L78.73 38.344 C78.07 40.312 77.498 42.288 76.218 43.958 C72.088 49.348 64.012 50.122 59.053 45.394 C56.908 43.35 56.122 40.804 55.194 38.072 L2.765 38.002 Z M135.221 29.822 C124.387 31.528 113.507 33.059 102.639 34.539 C96.547 35.371 90.428 36.084 84.407 37.331 L129.874 46.421 C131.28 40.799 133.31 35.295 135.221 29.822 Z M57.551 36.502 C57.277 41.712 61.28 46.159 66.491 46.434 C71.702 46.708 76.149 42.705 76.423 37.495 C76.697 32.283 72.695 27.837 67.484 27.562 C62.273 27.287 57.826 31.29 57.551 36.502 Z M142.059 37.498 C142.913 50.087 161.811 48.972 160.923 35.906 C160.834 34.601 160.261 33.276 159.612 32.157 C154.825 23.901 141.405 27.87 142.059 37.498 Z";
const LIMIT_SWITCH_NC_VECTOR_LABEL_PATHS = ["M15.081 3.052 L21.895 2.419 C21.868 7.284 21.92 12.151 21.92 17.017 C21.92 19.167 22.358 21.634 21.189 23.506 L19.192 23.559 L19.085 5.26 L14.753 5.251 Z", "M31.787 3.128 L38.641 2.555 L38.559 23.401 L36.423 23.507 C36.166 23.092 35.868 22.731 35.77 22.24 C35.445 20.601 35.712 18.674 35.712 17.005 L35.712 5.326 L31.432 5.252 Z", "M176.209 3.093 L182.963 2.398 C182.915 7.14 182.981 11.883 182.981 16.625 C182.981 18.841 183.429 21.472 182.357 23.458 L180.142 23.543 L180.073 5.32 L175.831 5.252 Z", "M194.973 21.26 L204.605 21.272 C204.995 22.179 205.035 22.508 204.681 23.424 L190.486 23.408 C192.211 20.808 194.178 18.565 196.272 16.262 C197.919 14.45 199.82 12.629 200.918 10.407 C202.123 7.967 201.096 4.642 198.064 4.511 C196.497 4.444 194.969 5.199 194.374 6.712 C194.15 7.281 194.043 8.027 193.492 8.391 C192.891 8.787 192.018 8.651 191.338 8.644 C190.821 2.886 199.099 0.022 202.818 4.132 C207.863 9.708 198.451 17.467 194.973 21.26 Z"];

// Trazo de los vectores del usuario. El arte trae lineas de ~1.2 unidades y el
// resto de los simbolos usa 3.2, asi que el contorno se engrosa con un stroke de
// 2 unidades del viewBox 128x64. Como el stroke se escala con el transform del
// grupo, el valor local es 2 / escala. Solo se trazan el contorno y los huecos de
// los bornes: los huecos decorativos (cuchilla/cuna) se dejan intactos.
function pickVectorSubpaths(pathData: string, indexes: number[]): string[] {
  const subpaths = pathData.match(/M[^M]*/g) ?? [pathData];

  return indexes
    .map((index) => subpaths[index])
    .filter((subpath): subpath is string => Boolean(subpath));
}

const LIMIT_SWITCH_VECTOR_OUTLINE_PATHS = [
  ...pickVectorSubpaths(LIMIT_SWITCH_VECTOR_LEFT_TERMINAL_PATH, [0, 1]),
  ...pickVectorSubpaths(LIMIT_SWITCH_VECTOR_RIGHT_TERMINAL_PATH, [0, 1])
];

const LIMIT_SWITCH_NC_VECTOR_OUTLINE_PATHS = pickVectorSubpaths(LIMIT_SWITCH_NC_VECTOR_SYMBOL_PATH, [0, 2, 3]);

const LIMIT_SWITCH_VECTOR_STROKE_WIDTH = 2.3 / LIMIT_SWITCH_VECTOR_SCALE;
const LIMIT_SWITCH_NC_VECTOR_STROKE_WIDTH = 2.3 / LIMIT_SWITCH_NC_VECTOR_SCALE;

// Fuente AC del usuario (AC source.svg, viewBox 980x980). Escala uniforme que
// encaja el dibujo en el viewBox 128x64: los anillos caen en (8.54,31.90) y
// (119.21,32.44), con los terminales de cable en (6.4,32)/(121.6,32).
// El arte ya trae un trazo de ~4.0 unidades, asi que no necesita el stroke de normalizacion.
const AC_SOURCE_VECTOR_SCALE = 0.146087;
const AC_SOURCE_VECTOR_TRANSFORM = `translate(-7.91 -39.68) scale(${AC_SOURCE_VECTOR_SCALE})`;
const AC_SOURCE_VECTOR_SYMBOL_PATH = "M162.956 476.864 L285.538 476.822 C286.662 456.975 290.993 437.084 297.96 418.477 C299.362 414.733 300.978 411.077 302.528 407.394 C304.824 401.943 307.561 396.703 310.431 391.539 C318.459 377.095 327.903 363.375 339.258 351.32 C343.647 346.66 348.067 342.013 352.828 337.724 C373.012 319.539 396.501 305.375 422.057 296.147 C441.732 289.043 462.017 285.445 482.86 284.47 C542.071 281.7 599.718 305.306 640.547 348.154 C647.255 355.194 653.619 362.583 659.239 370.535 C676.65 395.168 688.916 423.283 694.377 452.995 C695.828 460.892 696.555 468.833 697.344 476.809 L821.116 476.772 C822.842 470.773 825.855 465.421 829.677 460.511 C848.306 436.578 884.118 434.104 905.878 455.226 C910.665 459.872 914.673 465.28 917.31 471.434 C919.673 476.947 921.252 482.773 921.624 488.785 C923.478 518.699 900.283 543.906 870.197 543.88 C863.368 543.875 856.554 542.661 850.231 540.018 C838.177 534.98 828.472 525.242 823.013 513.443 C821.67 510.54 820.824 507.393 819.846 504.358 L697.408 504.427 C696.63 510.985 696.15 517.57 695.085 524.101 C692.891 537.546 689.278 550.85 684.456 563.585 C664.665 615.852 622.873 659.536 571.146 680.925 C553.045 688.41 533.813 693.677 514.301 695.707 C508.154 696.346 502.018 696.622 495.848 696.782 C494.264 696.823 492.699 697.044 491.109 697.04 C489.774 697.037 488.452 696.83 487.119 696.8 C485.538 696.764 483.95 696.853 482.371 696.794 C471.699 696.398 460.885 694.998 450.419 692.876 C379.446 678.486 320.798 627.231 296.747 558.984 C290.638 541.65 286.354 522.822 285.56 504.413 L161.768 504.428 C156.022 520.55 144.49 533.058 127.791 538.038 C98.682 546.719 68.002 528.96 62.119 498.916 C61.489 495.699 60.977 492.286 60.994 489 C61.142 459.429 85.612 435.435 115.399 437.313 C120.302 437.622 125.175 438.334 129.824 440.017 C142.538 444.618 153.541 454.266 159.275 466.579 C160.821 469.898 161.892 473.372 162.956 476.864 Z M88.798 488.501 C88.685 501.66 99.26 512.419 112.418 512.533 C125.577 512.646 136.336 502.071 136.449 488.913 C136.563 475.754 125.988 464.995 112.829 464.881 C99.671 464.768 88.912 475.343 88.798 488.501 Z M846.341 492.499 C846.41 505.658 857.134 516.27 870.293 516.2 C883.452 516.131 894.063 505.407 893.994 492.248 C893.925 479.089 883.201 468.478 870.042 468.547 C856.883 468.617 846.271 479.34 846.341 492.499 Z M312.606 490.5 C312.582 492 312.842 493.49 312.871 494.99 C313.275 516.092 317.531 537.226 325.494 556.801 C332.004 572.802 340.637 587.749 351.361 601.296 C354.756 605.584 358.229 609.919 362.192 613.703 C362.979 614.454 363.612 615.332 364.373 616.104 C367.026 618.797 370.066 621.672 372.907 624.167 C391.017 640.07 412.079 652.369 434.925 660.088 C497.541 681.243 567.333 665.052 614.991 619.496 C626.238 608.745 636.205 596.328 644.23 583.004 C647.542 577.504 650.388 571.81 653.239 566.075 C662.692 547.055 668.12 524.217 669.589 503.093 C669.774 500.443 670.051 497.779 670.088 495.121 C670.474 467.635 665.206 439.768 653.249 414.89 C635.749 378.483 606.866 348.279 570.471 330.477 C560.446 325.573 550.113 321.369 539.314 318.476 C531.685 316.432 523.953 314.582 516.107 313.554 C491.538 310.336 467.023 311.827 443.106 318.5 C438.445 319.801 433.94 321.507 429.36 323.06 C425.181 324.477 421.161 326.314 417.165 328.168 C401.325 335.517 386.469 344.935 373.375 356.543 C354.991 372.841 340.237 392.707 329.603 414.837 C321.711 431.261 316.384 449.754 314.144 467.832 C313.552 472.616 313.105 477.452 312.863 482.264 C312.779 483.926 312.897 485.599 312.841 487.263 C312.805 488.344 312.624 489.415 312.606 490.5 Z";
const AC_SOURCE_VECTOR_WAVE_PATH = "M368.482 492.501 C368.581 488.171 370.995 484.923 373.247 481.459 C377.983 474.175 383.817 467.426 390.099 461.435 C397.079 454.778 404.794 448.841 413.615 444.819 C418.441 442.619 423.53 440.798 428.801 440.038 C431.563 439.639 434.464 439.262 437.258 439.28 C462.088 439.44 481.229 457.355 494.344 476.769 C503.348 490.097 513.549 511.334 531.396 513.885 C538.215 514.86 544.801 512.198 550.553 508.791 C561.784 502.138 573.211 489.263 580.508 478.482 C582.182 476.009 583.884 473.529 585.424 470.972 C587.053 468.269 588.494 464.768 590.955 462.71 C597.233 457.459 606.367 457.91 611.407 464.633 C612.92 466.651 613.983 469.218 614.163 471.757 C614.56 477.338 611.277 482.071 608.346 486.523 C607.296 488.118 606.364 489.789 605.297 491.373 C601.436 497.103 597.254 502.58 592.826 507.877 C586.087 515.941 577.984 524.17 569.129 529.895 C562.048 534.472 554.776 538.138 546.579 540.259 C542.531 541.306 538.377 541.666 534.216 541.691 C509.824 541.834 491.98 524.151 479.45 505.024 C476.808 500.992 474.437 496.787 471.778 492.762 C464.851 482.276 454.9 470.729 442.21 467.642 C430.139 464.705 417.499 473.33 409.279 481.396 C405.708 484.899 402.547 488.734 399.349 492.569 C396.004 496.58 394.077 501.768 389.528 504.617 C380.273 510.411 368.236 503.344 368.482 492.501 Z";

// Interruptor SPST del usuario (SPST-Switch.svg, viewBox 347x100). Los extremos
// de las salidas caen en (6.4,32)/(121.6,32) y los anillos en (48.1,32)/(80.3,32)
// con r=6.95. El arte ya es de trazo, asi que el grosor se fija directo:
// 3.2 unidades del viewBox = 3.2 / escala en unidades locales.
const SPST_SWITCH_VECTOR_SCALE = 0.365714;
const SPST_SWITCH_VECTOR_TRANSFORM = `translate(3.84 7.86) scale(${SPST_SWITCH_VECTOR_SCALE})`;
const SPST_SWITCH_VECTOR_STROKE_WIDTH = 3.5 / SPST_SWITCH_VECTOR_SCALE;
const SPST_SWITCH_VECTOR_RING_LEFT_PATH = "M140 66a19 19 0 1 1-38 0 19 19 0 1 1 38 0z";
const SPST_SWITCH_VECTOR_RING_RIGHT_PATH = "M228 66a19 19 0 1 1-38 0 19 19 0 1 1 38 0z";
const SPST_SWITCH_VECTOR_OPEN_LEVER_PATH = "M238 221h93m-315 0h93m21-58 94 61";
const SPST_SWITCH_VECTOR_CLOSED_LEVER_PATH = "M229 66 L322 66 M7 66 L100 66 M138.163 69 L215 69";

// Pulsador de emergencia del usuario. Reposo: Emergency push button.svg;
// accionado: Emergency push button (opened).svg. Cada traza (incluidos los
// rotulos 11/12) tiene sus propias coordenadas, asi que cada estado lleva su
// escala/traslacion para que el extremo de las salidas caiga en
// (2.286,36)/(125.714,36) del viewBox 128x72 (terminales 8/68 y 152/68).
const ESTOP_VECTOR_SCALE = 0.288588;
const ESTOP_VECTOR_TRANSFORM = `translate(-0.193 6.482) scale(${ESTOP_VECTOR_SCALE})`;
const ESTOP_VECTOR_STROKE_WIDTH = 2.3 / ESTOP_VECTOR_SCALE;
const ESTOP_RING_STROKE_WIDTH = 3.5 / ESTOP_VECTOR_SCALE;
const ESTOP_VECTOR_SYMBOL_PATH = "M112.047 104.403 L8.589 104.44 L8.589 100.241 C8.589 100.241 18.088 100.129 22.826 100.129 L45.579 100.129 C67.723 100.129 89.889 99.843 112.03 100.162 M325.591 100.055 C325.685 100.452 378.407 100.024 404.805 100.024 L436.285 100.365 L436.285 104.672 L404.641 104.335 L325.514 104.335 M302.544 126.445 L135.017 126.426 L135.017 122.677 L216.844 122.76 L216.642 60.626 C206.556 61.515 197.329 65.714 189.209 71.668 C186.607 73.575 184.121 75.694 181.753 77.884 C180.672 78.883 179.615 80.401 178.285 81.063 C177.316 81.546 175.997 81.624 174.958 81.843 C175.124 80.738 175.099 79.234 175.635 78.211 C177.138 75.344 185.984 68.657 188.939 66.697 C207.025 54.705 223.85 52.833 243.212 63.295 C247.448 65.585 259.902 74.243 261.982 78.277 C262.451 79.187 262.271 80.383 262.173 81.357 C261.233 81.356 260.11 81.099 259.252 80.636 C257.928 79.921 256.89 78.848 255.788 77.839 C253.415 75.665 250.934 73.517 248.327 71.625 C240.217 65.737 231.018 61.453 220.952 60.646 L220.952 100.295 C220.952 107.753 220.739 122.76 220.739 122.76 L302.544 122.68";
const ESTOP_VECTOR_LABEL_PATHS = ["M24.428 13.28 L24.428 54.953 L19.338 54.916 L19.338 20.221 C15.707 21.332 12.019 22.597 8.589 24.242 L8.589 19.408 Z", "M40.976 19.248 L56.625 13.414 L56.554 54.894 L51.66 54.966 L51.675 20.287 C48.063 21.412 44.562 22.857 40.865 23.672 Z", "M378.293 19.337 C383.633 17.923 389.07 15.759 394.082 13.451 L394.082 55.123 L389.065 55.152 L388.925 20.481 L378.178 24.315 Z", "M415.64 50.821 L436.285 50.857 L436.232 55.124 L409.274 55.129 C409.225 53.945 408.975 52.496 409.44 51.356 C409.941 50.13 411.364 49.215 412.19 48.196 C416.557 42.809 428.948 32.002 429.031 25.19 C429.128 17.231 418.675 15.033 414.747 21.571 C413.908 22.968 413.746 24.736 413.462 26.301 L408.463 26.301 C408.652 23.257 409.203 20.488 411.185 18.045 C416.755 11.179 430.916 11.786 433.893 20.954 C437.216 31.193 421.765 43.972 415.64 50.821 Z"];
const ESTOP_VECTOR_RINGS = [[302.544, 102.225], [135.017, 102.301]] as const;

const ESTOP_VECTOR_OPEN_SCALE = 0.290296;
const ESTOP_VECTOR_OPEN_TRANSFORM = `translate(-0.353 6.103) scale(${ESTOP_VECTOR_OPEN_SCALE})`;
const ESTOP_VECTOR_OPEN_STROKE_WIDTH = 2.3 / ESTOP_VECTOR_OPEN_SCALE;
const ESTOP_VECTOR_OPEN_RING_STROKE_WIDTH = 3.5 / ESTOP_VECTOR_OPEN_SCALE;
const ESTOP_VECTOR_OPEN_SYMBOL_PATH = "M112.548 105.05 L9.09 105.087 L9.09 100.888 C9.09 100.888 18.589 100.776 23.327 100.776 L46.08 100.776 C68.224 100.776 90.39 100.49 112.531 100.809 M323.576 100.58 C323.669 100.977 376.392 100.549 402.789 100.549 L434.27 100.89 L434.27 105.197 L402.626 104.86 L323.499 104.86 M301.876 145.867 L134.349 145.848 L134.349 142.099 L216.176 142.182 L215.974 80.048 C205.888 80.937 196.661 85.136 188.541 91.09 C185.939 92.997 183.453 95.116 181.085 97.306 C180.004 98.305 178.947 99.823 177.617 100.485 C176.648 100.968 175.329 101.046 174.29 101.265 C174.456 100.16 174.431 98.656 174.967 97.633 C176.47 94.766 185.316 88.079 188.271 86.119 C206.357 74.127 223.182 72.255 242.544 82.717 C246.78 85.007 259.234 93.665 261.314 97.699 C261.783 98.609 261.603 99.805 261.505 100.779 C260.565 100.778 259.442 100.521 258.584 100.058 C257.26 99.343 256.222 98.27 255.12 97.261 C252.747 95.087 250.266 92.939 247.659 91.047 C239.549 85.159 230.35 80.875 220.284 80.068 L220.284 119.717 C220.284 127.175 220.071 142.182 220.071 142.182 L301.876 142.102";
const ESTOP_VECTOR_OPEN_LABEL_PATHS = ["M24.929 13.461 L24.929 55.134 L19.839 55.097 L19.839 20.402 C16.208 21.513 12.52 22.778 9.09 24.423 L9.09 19.589 Z", "M41.477 19.429 L57.126 13.595 L57.055 55.075 L52.161 55.147 L52.176 20.468 C48.564 21.593 45.063 23.038 41.366 23.853 Z", "M378.999 19.384 C384.339 17.97 389.776 15.806 394.788 13.498 L394.788 55.17 L389.771 55.199 L389.631 20.528 L378.884 24.362 Z", "M416.346 50.868 L436.991 50.904 L436.938 55.171 L409.98 55.176 C409.931 53.992 409.681 52.543 410.146 51.403 C410.647 50.177 412.07 49.262 412.896 48.243 C417.263 42.856 429.654 32.049 429.737 25.237 C429.834 17.278 419.381 15.08 415.453 21.618 C414.614 23.015 414.452 24.783 414.168 26.348 L409.169 26.348 C409.358 23.304 409.909 20.535 411.891 18.092 C417.461 11.226 431.622 11.833 434.599 21.001 C437.922 31.24 422.471 44.019 416.346 50.868 Z"];
const ESTOP_VECTOR_OPEN_RINGS = [[302.603, 102.873], [134.947, 102.873]] as const;

function renderSymbolGraphic(
  type: BuilderComponentType,
  options: {
    breakerClosed?: boolean;
    coilActive?: boolean;
    contactActuated?: boolean;
    contactClosed?: boolean;
    energized?: boolean;
    estopPressed?: boolean;
    label?: string;
    pushButtonPressed?: boolean;
    switchClosed?: boolean;
    terminalLabels?: Partial<Record<string, string>>;
  } = {}
): ReactNode {
  const getTerminalLabelText = (terminalId: string, fallbackLabel: string): string => {
    const label = options.terminalLabels?.[terminalId]?.trim();
    return label && label.length > 0 ? label : fallbackLabel;
  };
  const renderTimedContactGlyph = (appearance: "NOTC" | "NCTO") => {
    if (appearance === "NCTO") {
      return (
        <>
          <line x1="32" y1="30" x2="96" y2="23" className="diagram-symbol__line diagram-symbol__contact-arm" />
          <line x1="64" y1="27" x2="64" y2="49" className="diagram-symbol__line" />
          <line x1="64" y1="49" x2="54" y2="61" className="diagram-symbol__line" />
          <line x1="64" y1="49" x2="74" y2="61" className="diagram-symbol__line" />
        </>
      );
    }

    return (
      <>
        <line x1="32" y1="25.5" x2="90" y2="40.5" className="diagram-symbol__line diagram-symbol__contact-arm" />
        <line x1="64" y1="35" x2="64" y2="50" className="diagram-symbol__line" />
        <line x1="64" y1="50" x2="54" y2="61" className="diagram-symbol__line" />
        <line x1="64" y1="50" x2="74" y2="61" className="diagram-symbol__line" />
      </>
    );
  };
  const symbolClassName = [
    "diagram-symbol",
    type === "PUSH_BUTTON_NO" ? "diagram-symbol--pushbutton-no" : "",
    type === "PUSH_BUTTON_NC" ? "diagram-symbol--pushbutton-nc" : "",
    type === "ESTOP" ? "diagram-symbol--estop" : "",
    type === "OL_CONTACT" ? "diagram-symbol--ol" : "",
    options.energized ? "diagram-symbol--energized" : "",
    options.coilActive ? "diagram-symbol--coil-active" : "",
    options.contactClosed ? "diagram-symbol--contact-closed" : "",
    options.contactActuated ? "diagram-symbol--contact-actuated" : ""
  ].filter(Boolean).join(" ");

  switch (type) {
    case "POWER_SOURCE":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <text x="8" y="14" className="diagram-symbol__text">{getTerminalLabelText("left", "L1")}</text>
          <text x="100" y="14" className="diagram-symbol__text">{getTerminalLabelText("right", "L2")}</text>
          <g transform={AC_SOURCE_VECTOR_TRANSFORM}>
            {/* El arte dibuja los anillos como huecos transparentes y el cable
                pasa por detras: se tapa con un disco blanco bajo el anillo para
                que el cable termine limpio en el borde del borne. */}
            <circle cx="112.624" cy="488.707" r="45" fill="rgba(255, 255, 255, 0.98)" />
            <circle cx="870.167" cy="492.374" r="45" fill="rgba(255, 255, 255, 0.98)" />
          </g>
          <g transform={AC_SOURCE_VECTOR_TRANSFORM} className="diagram-symbol__vector" fillRule="evenodd">
            <path d={AC_SOURCE_VECTOR_SYMBOL_PATH} />
            <path d={AC_SOURCE_VECTOR_WAVE_PATH} />
          </g>
        </svg>
      );
    case "DC_SOURCE":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="30" x2="42" y2="30" className="diagram-symbol__line" />
          <line x1="86" y1="30" x2="122" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
          <text x="55" y="35" textAnchor="middle" className="diagram-symbol__text">{getTerminalLabelText("left", "-")}</text>
          <text x="73" y="35" textAnchor="middle" className="diagram-symbol__text">{getTerminalLabelText("right", "+")}</text>
        </svg>
      );
    case "BREAKER_1P":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <text x="34" y="14" textAnchor="middle" className="diagram-symbol__terminal-label">{getTerminalLabelText("in", "1")}</text>
          <text x="94" y="14" textAnchor="middle" className="diagram-symbol__terminal-label">{getTerminalLabelText("out", "2")}</text>
          <line x1="6" y1="32" x2="28" y2="32" className="diagram-symbol__line" />
          <line x1="100" y1="32" x2="122" y2="32" className="diagram-symbol__line" />
          <circle cx="34" cy="32" r="5.5" className="diagram-symbol__terminal" />
          <circle cx="94" cy="32" r="5.5" className="diagram-symbol__terminal" />
          <path d="M41 26 C50 8 78 8 87 26" className="diagram-symbol__line" fill="none" />
        </svg>
      );
    case "BREAKER_2P":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <line x1="6.4" y1="3.2" x2="28.4" y2="3.2" className="diagram-symbol__line diagram-symbol__breaker-lead" />
          <line x1="99.6" y1="3.2" x2="121.6" y2="3.2" className="diagram-symbol__line diagram-symbol__breaker-lead" />
          <circle cx="34.4" cy="3.2" r="5.5" className="diagram-symbol__terminal" />
          <circle cx="93.6" cy="3.2" r="5.5" className="diagram-symbol__terminal" />
          <line x1="6.4" y1="46.4" x2="28.4" y2="46.4" className="diagram-symbol__line diagram-symbol__breaker-lead" />
          <line x1="99.6" y1="46.4" x2="121.6" y2="46.4" className="diagram-symbol__line diagram-symbol__breaker-lead" />
          <circle cx="34.4" cy="46.4" r="5.5" className="diagram-symbol__terminal" />
          <circle cx="93.6" cy="46.4" r="5.5" className="diagram-symbol__terminal" />
          <path d="M41.4 -2.8 C50 -16.1 78 -16.1 86.6 -2.8" className="diagram-symbol__line" fill="none" />
          <path d="M41.4 40.4 C50 27.1 78 27.1 86.6 40.4" className="diagram-symbol__line" fill="none" />
          <line x1="64" y1="-6.4" x2="64" y2="30.8" className="diagram-symbol__linkage" />
          <text x="18" y="-0.1" textAnchor="middle" className="diagram-symbol__terminal-label">{getTerminalLabelText("in-top", "1")}</text>
          <text x="110" y="-0.1" textAnchor="middle" className="diagram-symbol__terminal-label">{getTerminalLabelText("out-top", "2")}</text>
          <text x="18" y="56.7" textAnchor="middle" className="diagram-symbol__terminal-label">{getTerminalLabelText("in-bottom", "3")}</text>
          <text x="110" y="56.7" textAnchor="middle" className="diagram-symbol__terminal-label">{getTerminalLabelText("out-bottom", "4")}</text>
        </svg>
      );
    case "SWITCH_1P":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <g transform={SPST_SWITCH_VECTOR_TRANSFORM}>
            <path
              d={SPST_SWITCH_VECTOR_RING_LEFT_PATH}
              className="diagram-symbol__vector-ring"
              strokeWidth={SPST_SWITCH_VECTOR_STROKE_WIDTH}
            />
            <path
              d={options.switchClosed ? SPST_SWITCH_VECTOR_CLOSED_LEVER_PATH : SPST_SWITCH_VECTOR_OPEN_LEVER_PATH}
              transform={options.switchClosed ? undefined : "translate(-9 -155)"}
              className="diagram-symbol__vector--outline"
              fillRule="evenodd"
              strokeWidth={SPST_SWITCH_VECTOR_STROKE_WIDTH}
            />
            <path
              d={SPST_SWITCH_VECTOR_RING_RIGHT_PATH}
              className="diagram-symbol__vector-ring"
              strokeWidth={SPST_SWITCH_VECTOR_STROKE_WIDTH}
            />
          </g>
        </svg>
      );
    case "LIMIT_SWITCH_NO":
    case "LIMIT_SWITCH_NC": {
      // Ambos estados usan los SVG del usuario tal cual, con fill-rule="evenodd"
      // (los anillos y el interior de la cuchilla son subpaths huecos).
      // Abierto: NO limit switch.svg (cuchilla + bornes 13/14).
      // Cerrado: NC limit switch.svg (barra + cuna + anillos).
      // El NC accionado usa el dibujo abierto del NO, asi que se ve igual que el NO.
      const isNormallyClosed = type === "LIMIT_SWITCH_NC";
      const switchClosed = options.switchClosed ?? isNormallyClosed;

      const labelPaths = isNormallyClosed
        ? LIMIT_SWITCH_NC_VECTOR_LABEL_PATHS
        : LIMIT_SWITCH_VECTOR_LABEL_PATHS;
      const labelTransform = isNormallyClosed
        ? LIMIT_SWITCH_NC_VECTOR_TRANSFORM
        : LIMIT_SWITCH_VECTOR_TRANSFORM;

      const symbolPaths = switchClosed
        ? [LIMIT_SWITCH_NC_VECTOR_SYMBOL_PATH]
        : [LIMIT_SWITCH_VECTOR_LEFT_TERMINAL_PATH, LIMIT_SWITCH_VECTOR_RIGHT_TERMINAL_PATH];
      const outlinePaths = switchClosed
        ? LIMIT_SWITCH_NC_VECTOR_OUTLINE_PATHS
        : LIMIT_SWITCH_VECTOR_OUTLINE_PATHS;
      const symbolTransform = switchClosed
        ? LIMIT_SWITCH_NC_VECTOR_TRANSFORM
        : LIMIT_SWITCH_VECTOR_TRANSFORM;
      const outlineStrokeWidth = switchClosed
        ? LIMIT_SWITCH_NC_VECTOR_STROKE_WIDTH
        : LIMIT_SWITCH_VECTOR_STROKE_WIDTH;

      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <g transform={symbolTransform} className="diagram-symbol__vector" fillRule="evenodd">
            {symbolPaths.map((pathData) => <path key={pathData} d={pathData} />)}
          </g>
          <g
            transform={symbolTransform}
            className="diagram-symbol__vector--outline"
            fillRule="evenodd"
            strokeWidth={outlineStrokeWidth}
          >
            {outlinePaths.map((pathData) => <path key={pathData} d={pathData} />)}
          </g>
          <g transform={labelTransform} className="diagram-symbol__vector" fillRule="evenodd">
            {labelPaths.map((pathData) => <path key={pathData} d={pathData} />)}
          </g>
        </svg>
      );
    }
    case "LAMP":
      // Proporciones del Lamp_symbol.svg del usuario (280x120) mapeadas al
      // viewBox 128x64: patas 6.4/121.6, circulo r=17.28 y X inscrita.
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <line x1="6.4" y1="32" x2="46.72" y2="32" className="diagram-symbol__line" />
          <line x1="81.28" y1="32" x2="121.6" y2="32" className="diagram-symbol__line" />
          <circle cx="64" cy="32" r="17.28" className="diagram-symbol__shape" />
          <line x1="52" y1="20" x2="76" y2="44" className="diagram-symbol__line" />
          <line x1="76" y1="20" x2="52" y2="44" className="diagram-symbol__line" />
        </svg>
      );
    case "MOTOR":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <line x1="6.4" y1="32" x2="38" y2="32" className="diagram-symbol__line" />
          <line x1="90" y1="32" x2="121.6" y2="32" className="diagram-symbol__line" />
          <circle cx="64" cy="32" r="22" className="diagram-symbol__shape" />
          <circle cx="64" cy="32" r="13" className="diagram-symbol__shape" />
          <g className="diagram-symbol__motor-rotor">
            <circle cx="64" cy="32" r="3.5" className="diagram-symbol__fill" />
            <path d="M64 18 C71 20 76 25 77 31" className="diagram-symbol__line" />
            <path d="M77 34 C73 42 66 46 58 45" className="diagram-symbol__line" />
            <path d="M55 42 C50 36 50 28 55 22" className="diagram-symbol__line" />
          </g>
          <text x="64" y="58" textAnchor="middle" className="diagram-symbol__text">M</text>
        </svg>
      );
    case "PUSH_BUTTON_NO": {
      const contactBarY = options.pushButtonPressed ? 36 : 20;

      return (
        <svg viewBox="0 0 128 72" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="36" x2="28" y2="36" className="diagram-symbol__line" />
          <line x1="100" y1="36" x2="122" y2="36" className="diagram-symbol__line" />
          <circle cx="34" cy="36" r="5.5" className="diagram-symbol__terminal" />
          <circle cx="94" cy="36" r="5.5" className="diagram-symbol__terminal" />
          <line x1="64" y1="8" x2="64" y2={String(contactBarY)} className="diagram-symbol__line" />
          <line
            x1="38"
            y1={String(contactBarY)}
            x2="90"
            y2={String(contactBarY)}
            className="diagram-symbol__line diagram-symbol__contact-arm"
          />
        </svg>
      );
    }
    case "PUSH_BUTTON_NC": {
      const contactBarY = options.pushButtonPressed ? 44 : 36;

      return (
        <svg viewBox="0 0 128 72" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="36" x2="28" y2="36" className="diagram-symbol__line" />
          <line x1="100" y1="36" x2="122" y2="36" className="diagram-symbol__line" />
          <circle cx="34" cy="30" r="5.5" className="diagram-symbol__terminal" />
          <circle cx="94" cy="30" r="5.5" className="diagram-symbol__terminal" />
          <line x1="64" y1="8" x2="64" y2={String(contactBarY)} className="diagram-symbol__line" />
          <line
            x1="28"
            y1={String(contactBarY)}
            x2="100"
            y2={String(contactBarY)}
            className="diagram-symbol__line diagram-symbol__contact-arm"
          />
        </svg>
      );
    }
    case "ESTOP": {
      // Reposo: seta arriba y barra cerrada. Accionado (isPressed): seta hundida
      // y barra suelta. Cada traza tiene su propio mapeo (ver constantes).
      const isPressed = options.estopPressed === true;
      const transform = isPressed ? ESTOP_VECTOR_OPEN_TRANSFORM : ESTOP_VECTOR_TRANSFORM;
      const symbolPath = isPressed ? ESTOP_VECTOR_OPEN_SYMBOL_PATH : ESTOP_VECTOR_SYMBOL_PATH;
      const strokeWidth = isPressed ? ESTOP_VECTOR_OPEN_STROKE_WIDTH : ESTOP_VECTOR_STROKE_WIDTH;
      const ringStrokeWidth = isPressed ? ESTOP_VECTOR_OPEN_RING_STROKE_WIDTH : ESTOP_RING_STROKE_WIDTH;
      const rings = isPressed ? ESTOP_VECTOR_OPEN_RINGS : ESTOP_VECTOR_RINGS;
      const labelPaths = isPressed ? ESTOP_VECTOR_OPEN_LABEL_PATHS : ESTOP_VECTOR_LABEL_PATHS;

      return (
        <svg viewBox="0 0 128 72" className={symbolClassName} aria-hidden="true">
          <g transform={transform} className="diagram-symbol__vector" fillRule="evenodd">
            <path d={symbolPath} />
          </g>
          <g
            transform={transform}
            className="diagram-symbol__vector--outline"
            fillRule="evenodd"
            strokeWidth={strokeWidth}
          >
            <path d={symbolPath} />
          </g>
          <g transform={transform}>
            {rings.map(([cx, cy]) => (
              <circle
                key={cx}
                cx={cx}
                cy={cy}
                r="22.97"
                className="diagram-symbol__vector-ring"
                strokeWidth={ringStrokeWidth}
              />
            ))}
          </g>
          <g transform={transform} className="diagram-symbol__vector" fillRule="evenodd">
            {labelPaths.map((pathData) => <path key={pathData} d={pathData} />)}
          </g>
        </svg>
      );
    }
    case "OL_CONTACT": {
      // Exactamente el contacto NC (XIO: platinas + cuchilla diagonal) con el
      // rotulo "OL" + numero encima. El numero sale de la etiqueta del
      // componente (si no tiene digitos, 1): renombrar a "OL2" muestra OL2.
      const contactClosed = options.switchClosed ?? true;
      const overloadNumber = options.label?.match(/\d+/)?.[0] ?? "1";

      return (
        <svg viewBox="0 0 128 72" className={symbolClassName} aria-hidden="true">
          <text x="64" y="12" textAnchor="middle" className="diagram-symbol__text">{`OL${overloadNumber}`}</text>
          <line x1="2.3" y1="36" x2="54" y2="36" className="diagram-symbol__line" />
          <line x1="74" y1="36" x2="125.7" y2="36" className="diagram-symbol__line" />
          <line x1="56" y1="16" x2="56" y2="56" className="diagram-symbol__line" />
          <line x1="72" y1="16" x2="72" y2="56" className="diagram-symbol__line" />
          {contactClosed ? (
            <line x1="46" y1="20" x2="82" y2="52" className="diagram-symbol__line diagram-symbol__contact-slash" />
          ) : null}
        </svg>
      );
    }
    case "XIC":
      {
        const contactClosed = options.contactClosed ?? false;
        const contactSymbolClassName = [
          "diagram-symbol",
          options.contactActuated ? "diagram-symbol--energized" : "",
          options.contactActuated ? "diagram-symbol--contact-actuated" : ""
        ].filter(Boolean).join(" ");

      return (
        <svg viewBox="0 0 128 64" className={contactSymbolClassName} aria-hidden="true">
          <line x1="6.4" y1="32" x2="54" y2="32" className="diagram-symbol__line" />
          <line x1="74" y1="32" x2="121.6" y2="32" className="diagram-symbol__line" />
          <line x1="56" y1="12" x2="56" y2="52" className="diagram-symbol__line" />
          <line x1="72" y1="12" x2="72" y2="52" className="diagram-symbol__line" />
          {contactClosed ? (
            <line x1="46" y1="48" x2="82" y2="16" className="diagram-symbol__line diagram-symbol__contact-arm" />
          ) : null}
        </svg>
      );
      }
    case "XIO":
      {
        const contactClosed = options.contactClosed ?? true;
        const contactSymbolClassName = [
          "diagram-symbol",
          options.contactActuated ? "diagram-symbol--energized" : "",
          options.contactActuated ? "diagram-symbol--contact-actuated" : ""
        ].filter(Boolean).join(" ");

      return (
        <svg viewBox="0 0 128 64" className={contactSymbolClassName} aria-hidden="true">
          <line x1="6.4" y1="32" x2="54" y2="32" className="diagram-symbol__line" />
          <line x1="74" y1="32" x2="121.6" y2="32" className="diagram-symbol__line" />
          <line x1="56" y1="12" x2="56" y2="52" className="diagram-symbol__line" />
          <line x1="72" y1="12" x2="72" y2="52" className="diagram-symbol__line" />
          {contactClosed ? (
            <line x1="46" y1="16" x2="82" y2="48" className="diagram-symbol__line diagram-symbol__contact-slash" />
          ) : null}
        </svg>
      );
      }
    case "NOTC":
      {
        const contactClosed = options.contactClosed ?? false;
        const timedAppearance = contactClosed ? "NCTO" : "NOTC";
        const contactSymbolClassName = [
          "diagram-symbol",
          options.contactActuated ? "diagram-symbol--energized" : "",
          options.contactActuated ? "diagram-symbol--contact-actuated" : ""
        ].filter(Boolean).join(" ");

      return (
        <svg viewBox="0 0 128 64" className={contactSymbolClassName} aria-hidden="true">
          <circle cx="25.6" cy="30" r="6.4" className="diagram-symbol__terminal" />
          <circle cx="102.4" cy="30" r="6.4" className="diagram-symbol__terminal" />
          {renderTimedContactGlyph(timedAppearance)}
        </svg>
      );
      }
    case "NCTO":
      {
        const contactClosed = options.contactClosed ?? true;
        const timedAppearance = contactClosed ? "NCTO" : "NOTC";
        const contactSymbolClassName = [
          "diagram-symbol",
          options.contactActuated ? "diagram-symbol--energized" : "",
          options.contactActuated ? "diagram-symbol--contact-actuated" : ""
        ].filter(Boolean).join(" ");

      return (
        <svg viewBox="0 0 128 64" className={contactSymbolClassName} aria-hidden="true">
          <circle cx="25.6" cy="30" r="6.4" className="diagram-symbol__terminal" />
          <circle cx="102.4" cy="30" r="6.4" className="diagram-symbol__terminal" />
          {renderTimedContactGlyph(timedAppearance)}
        </svg>
      );
      }
    case "OTE":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6.4" y1="30" x2="44" y2="30" className="diagram-symbol__line" />
          <line x1="84" y1="30" x2="121.6" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
          <circle cx="64" cy="30" r="12" className="diagram-symbol__coil-core" />
        </svg>
      );
    case "OTL":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6.4" y1="30" x2="44" y2="30" className="diagram-symbol__line" />
          <line x1="84" y1="30" x2="121.6" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
          <circle cx="64" cy="30" r="12" className="diagram-symbol__coil-core" />
          <text x="64" y="36" textAnchor="middle" className="diagram-symbol__text">L</text>
        </svg>
      );
    case "OTU":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6.4" y1="30" x2="44" y2="30" className="diagram-symbol__line" />
          <line x1="84" y1="30" x2="121.6" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
          <circle cx="64" cy="30" r="12" className="diagram-symbol__coil-core" />
          <text x="64" y="36" textAnchor="middle" className="diagram-symbol__text">U</text>
        </svg>
      );
  }
}

function getDefaultTag(type: InstructionType, tags: TagDefinition[]): string {
  const kindPriority =
    type === "XIC" || type === "XIO" || type === "NOTC" || type === "NCTO"
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

export function getPortId(componentId: string, terminalId: string): string {
  return `${componentId}:${terminalId}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeQuarterTurns(value: number): number {
  return ((value % 4) + 4) % 4;
}

export function roundPoint(point: Point): Point {
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

function cloneScene(scene: BuilderScene): BuilderScene {
  return {
    components: scene.components.map((component) => ({
      ...component,
      ...(component.terminalLabels ? { terminalLabels: { ...component.terminalLabels } } : {})
    })),
    wires: scene.wires.map((wire) => ({
      ...wire,
      points: wire.points.map((point) => ({ ...point }))
    }))
  };
}

function getNextIdValueFromScene(scene: BuilderScene): number {
  let maxId = -1;

  for (const id of [...scene.components.map((component) => component.id), ...scene.wires.map((wire) => wire.id)]) {
    const match = id.match(/(\d+)$/);

    if (!match) {
      continue;
    }

    maxId = Math.max(maxId, Number(match[1]));
  }

  return maxId + 1;
}

function formatTerminalLabel(terminalId: string): string {
  return terminalId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getTerminalDefinition(type: BuilderComponentType, terminalId: string): TerminalDefinition | undefined {
  return getTerminalDefinitions(type).find((terminal) => terminal.id === terminalId);
}

function getResolvedTerminalLabel(component: BuilderComponent, terminal: TerminalDefinition): string {
  const overrideLabel = component.terminalLabels?.[terminal.id]?.trim();
  return overrideLabel && overrideLabel.length > 0 ? overrideLabel : terminal.label;
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
        description: "Both ends are attached to terminals or wire junctions, so the solver can read this wire.",
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

export function rotatePoint(point: Point, quarterTurns: number): Point {
  const turns = normalizeQuarterTurns(quarterTurns);
  const dx = point.x - ROTATION_CENTER_X;
  const dy = point.y - ROTATION_CENTER_Y;

  switch (turns) {
    case 0:
      return point;
    case 1:
      return {
        x: ROTATION_CENTER_X - dy,
        y: ROTATION_CENTER_Y + dx
      };
    case 2:
      return {
        x: ROTATION_CENTER_X - dx,
        y: ROTATION_CENTER_Y - dy
      };
    default:
      return {
        x: ROTATION_CENTER_X + dy,
        y: ROTATION_CENTER_Y - dx
      };
  }
}

export function getTerminalPoint(component: BuilderComponent, terminalId: string): Point {
  const terminal = getTerminalDefinition(component.type, terminalId);

  if (!terminal) {
    return { x: component.x, y: component.y };
  }

  const rotatedPoint = rotatePoint({ x: terminal.x, y: terminal.y }, component.rotation);

  return {
    x: component.x + rotatedPoint.x,
    y: component.y + rotatedPoint.y
  };
}

function getWireEndpointPreferredAxis(
  wire: BuilderWire,
  endpointIndex: number,
  components: BuilderComponent[],
  targetPoint?: Point,
  tolerance = 1
): "horizontal" | "vertical" {
  const resolvedTargetPort = targetPoint ? findNearestPort(targetPoint, components) : null;

  if (resolvedTargetPort && targetPoint && pointsAreClose(targetPoint, resolvedTargetPort)) {
    const resolvedTargetComponent = components.find((component) => component.id === resolvedTargetPort.componentId);

    if (resolvedTargetComponent) {
      return getTerminalApproachAxis(resolvedTargetComponent, resolvedTargetPort.terminalId);
    }
  }

  const adjacentIndex = endpointIndex === 0 ? 1 : wire.points.length - 2;
  const adjacentPoint = wire.points[adjacentIndex];
  const endpointPoint = wire.points[endpointIndex];

  if (adjacentPoint && endpointPoint) {
    const currentAxis = getSegmentAxis(adjacentPoint, endpointPoint, tolerance);

    if (currentAxis) {
      return currentAxis;
    }
  }

  return "horizontal";
}

export function getComponentTerminals(component: BuilderComponent): BuilderTerminal[] {
  return getTerminalDefinitions(component.type).map((terminal) => {
    const point = getTerminalPoint(component, terminal.id);

    return {
      componentId: component.id,
      defaultLabel: terminal.label,
      label: getResolvedTerminalLabel(component, terminal),
      pairId: terminal.pairId,
      portId: getPortId(component.id, terminal.id),
      role: terminal.role,
      terminalId: terminal.id,
      x: point.x,
      y: point.y
    };
  });
}

export function buildTerminalPortMap(components: readonly BuilderComponent[]): Map<string, BuilderTerminal> {
  const terminalsByPort = new Map<string, BuilderTerminal>();

  for (const component of components) {
    for (const terminal of getComponentTerminals(component)) {
      terminalsByPort.set(terminal.portId, terminal);
    }
  }

  return terminalsByPort;
}

/**
 * Los extremos de un cable son REFERENCIAS (portId), no coordenadas. Cada
 * render se recalculan desde el terminal del componente; `points` guarda solo
 * el recorrido (quiebres) y los extremos sueltos.
 */
export function resolveWirePointsWithMap(
  wire: BuilderWire,
  terminalsByPort: ReadonlyMap<string, BuilderTerminal>
): Point[] {
  const points = wire.points.map((point) => ({ x: point.x, y: point.y }));

  if (points.length === 0) {
    return points;
  }

  if (wire.startPortId) {
    const terminal = terminalsByPort.get(wire.startPortId);

    if (terminal) {
      points[0] = { x: terminal.x, y: terminal.y };
    }
  }

  if (wire.endPortId) {
    const terminal = terminalsByPort.get(wire.endPortId);

    if (terminal) {
      points[points.length - 1] = { x: terminal.x, y: terminal.y };
    }
  }

  return points;
}

export function resolveWirePoints(
  wire: BuilderWire,
  components: readonly BuilderComponent[]
): Point[] {
  return resolveWirePointsWithMap(wire, buildTerminalPortMap(components));
}

function getAttachedWireIds(component: BuilderComponent, wires: BuilderWire[]): Set<string> {
  const terminalPointKeys = new Set(getComponentTerminals(component).map((terminal) => getPointKey(terminal)));

  return new Set(
    wires
      .filter((wire) => wire.points.some((point) => terminalPointKeys.has(getPointKey(point))))
      .map((wire) => wire.id)
  );
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

function resolveWireEndpoint(
  point: Point,
  portId: string | null,
  componentsById: Map<string, BuilderComponent>,
  portsById: Map<string, BuilderTerminal>
): WireEndpointResolution {
  const port = portId ? portsById.get(portId) ?? null : null;

  return {
    component: port ? componentsById.get(port.componentId) ?? null : null,
    point,
    port
  };
}

function isPointAttachedToWire(
  point: Point,
  wireId: string,
  wires: readonly BuilderWire[],
  components: readonly BuilderComponent[]
): boolean {
  for (const other of wires) {
    if (other.id === wireId) {
      continue;
    }

    const otherPoints = resolveWirePoints(other, components);

    for (const otherPoint of otherPoints) {
      if (distanceBetween(point, otherPoint) < 1.5) {
        return true;
      }
    }

    for (let index = 0; index < otherPoints.length - 1; index += 1) {
      const start = otherPoints[index];
      const end = otherPoints[index + 1];

      if (!start || !end) {
        continue;
      }

      const projection = projectPointOntoSegment(point, start, end);

      if (projection && projection.distance < 1.5) {
        return true;
      }
    }
  }

  return false;
}

function inspectWire(wire: BuilderWire, components: BuilderComponent[], wires: readonly BuilderWire[]): WireInspection {
  const resolvedPoints = resolveWirePoints(wire, components);
  const startPoint = resolvedPoints[0] ?? { x: 0, y: 0 };
  const endPoint = resolvedPoints[resolvedPoints.length - 1] ?? startPoint;
  const ports = components.flatMap((component) => getComponentTerminals(component));
  const portsById = new Map(ports.map((port) => [port.portId, port]));
  const componentsById = new Map(components.map((component) => [component.id, component]));
  const start = resolveWireEndpoint(startPoint, wire.startPortId, componentsById, portsById);
  const end = resolveWireEndpoint(endPoint, wire.endPortId, componentsById, portsById);
  const segments = Math.max(resolvedPoints.length - 1, 0);
  const bends = Math.max(resolvedPoints.length - 2, 0);
  let length = 0;

  for (let index = 0; index < resolvedPoints.length - 1; index += 1) {
    const currentPoint = resolvedPoints[index];
    const nextPoint = resolvedPoints[index + 1];

    if (!currentPoint || !nextPoint) {
      continue;
    }

    length += distanceBetween(currentPoint, nextPoint);
  }

  const startAttached = start.port !== null || isPointAttachedToWire(startPoint, wire.id, wires, components);
  const endAttached = end.port !== null || isPointAttachedToWire(endPoint, wire.id, wires, components);
  let status: WireConnectionStatus;

  if (start.port && end.port && start.port.portId === end.port.portId) {
    status = "invalid-loop";
  } else if (startAttached && endAttached) {
    status = "connected";
  } else if (startAttached) {
    status = "loose-end";
  } else if (endAttached) {
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

function getDetachedWirePoint(points: Point[], endpoint: WireEndpointKey, planeSettings: BuilderPlaneSettings): Point | null {
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

  return clampPointToPlane(
    {
      x: endpointPoint.x + (dx / distance) * offset,
      y: endpointPoint.y + (dy / distance) * offset
    },
    planeSettings,
    12
  );
}

function snapPointToPort(point: Point, components: BuilderComponent[]): Point {
  const nearestPort = findNearestPort(point, components);

  if (!nearestPort) {
    return point;
  }

  return { x: nearestPort.x, y: nearestPort.y };
}

function projectPointOntoSegment(
  point: Point,
  start: Point,
  end: Point,
  planeSettings?: BuilderPlaneSettings
): { distance: number; point: Point } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared < 1) {
    return null;
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSquared, 0, 1);
  const rawProjectedPoint = { x: start.x + dx * t, y: start.y + dy * t };
  const projectedPoint = planeSettings
    ? (() => {
      if (start.x === end.x) {
        return {
          x: start.x,
          y: clamp(
            snapPointToGrid(rawProjectedPoint, planeSettings).y,
            Math.min(start.y, end.y),
            Math.max(start.y, end.y)
          )
        };
      }

      if (start.y === end.y) {
        return {
          x: clamp(
            snapPointToGrid(rawProjectedPoint, planeSettings).x,
            Math.min(start.x, end.x),
            Math.max(start.x, end.x)
          ),
          y: start.y
        };
      }

      return getCanonicalWirePoint(rawProjectedPoint, planeSettings);
    })()
    : roundPoint(rawProjectedPoint);

  return {
    distance: distanceBetween(point, projectedPoint),
    point: projectedPoint
  };
}

function findNearestWireSegmentAnchor(
  point: Point,
  wires: BuilderWire[],
  planeSettings: BuilderPlaneSettings,
  excludeWireId?: ReadonlySet<string> | string
): WireSegmentAnchor | null {
  let nearestAnchor: WireSegmentAnchor | null = null;
  let nearestDistance = WIRE_ANCHOR_DISTANCE + 0.001;

  for (const wire of wires) {
    const isExcluded = typeof excludeWireId === "string"
      ? wire.id === excludeWireId
      : excludeWireId?.has(wire.id) ?? false;

    if (isExcluded) {
      continue;
    }

    for (let index = 0; index < wire.points.length - 1; index += 1) {
      const startPoint = wire.points[index];
      const endPoint = wire.points[index + 1];

      if (!startPoint || !endPoint) {
        continue;
      }

      const projection = projectPointOntoSegment(point, startPoint, endPoint, planeSettings);

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

function getNearestTerminalId(component: BuilderComponent, point: Point): string {
  let nearestTerminalId = getDefaultEntryTerminalId(component.type);
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const terminal of getComponentTerminals(component)) {
    const distance = distanceBetween(point, terminal);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestTerminalId = terminal.terminalId;
    }
  }

  return nearestTerminalId;
}

function snapComponentByTerminal(
  component: BuilderComponent,
  point: Point,
  planeSettings: BuilderPlaneSettings
): BuilderComponent {
  return snapComponentToPlaneGrid(
    component,
    planeSettings,
    getNearestTerminalId(component, point)
  );
}

function snapComponentToNearbyWire(
  component: BuilderComponent,
  wires: BuilderWire[],
  excludeWireIds: ReadonlySet<string>,
  planeSettings: BuilderPlaneSettings
): BuilderComponent {
  let snapOffset: Point | null = null;
  let nearestDistance = SNAP_DISTANCE + 1;

  for (const terminal of getComponentTerminals(component)) {
    const terminalPoint = { x: terminal.x, y: terminal.y };
    const anchor = findNearestWireSegmentAnchor(terminalPoint, wires, planeSettings, excludeWireIds);

    if (!anchor) {
      continue;
    }

    const distance = distanceBetween(terminalPoint, anchor.point);

    if (distance >= nearestDistance) {
      continue;
    }

    nearestDistance = distance;
    snapOffset = {
      x: anchor.point.x - terminalPoint.x,
      y: anchor.point.y - terminalPoint.y
    };
  }

  if (!snapOffset || (snapOffset.x === 0 && snapOffset.y === 0)) {
    return component;
  }

  return {
    ...component,
    x: clamp(component.x + snapOffset.x, 16, planeSettings.width - COMPONENT_WIDTH - 16),
    y: clamp(component.y + snapOffset.y, 16, planeSettings.height - COMPONENT_HEIGHT - 16)
  };
}

function collectComponentTerminalWireAnchors(
  component: BuilderComponent,
  wires: BuilderWire[],
  excludeWireIds: ReadonlySet<string>,
  planeSettings: BuilderPlaneSettings
): WireSegmentAnchor[] {
  const anchors: WireSegmentAnchor[] = [];
  const seenAnchorKeys = new Set<string>();

  for (const terminal of getComponentTerminals(component)) {
    const terminalPoint = { x: terminal.x, y: terminal.y };
    const anchor = findNearestWireSegmentAnchor(terminalPoint, wires, planeSettings, excludeWireIds);

    if (!anchor || !pointsAreClose(terminalPoint, anchor.point)) {
      continue;
    }

    const anchorKey = `${anchor.wireId}:${anchor.insertIndex}:${getPointKey(terminalPoint)}`;

    if (seenAnchorKeys.has(anchorKey)) {
      continue;
    }

    seenAnchorKeys.add(anchorKey);
    anchors.push({ ...anchor, point: terminalPoint });
  }

  return anchors;
}

function resolveSnapTarget(
  point: Point,
  components: BuilderComponent[],
  wires: BuilderWire[],
  planeSettings: BuilderPlaneSettings,
  options: { allowWireAnchor?: boolean; excludeWireId?: string } = {}
): SnapTarget {
  const nearestPort = findNearestPort(point, components);

  if (nearestPort) {
    return {
      point: { x: nearestPort.x, y: nearestPort.y },
      portId: nearestPort.portId,
      wireAnchor: null
    };
  }

  if (options.allowWireAnchor !== false) {
    const wireAnchor = findNearestWireSegmentAnchor(point, wires, planeSettings, options.excludeWireId);

    if (wireAnchor) {
      return {
        point: wireAnchor.point,
        portId: null,
        wireAnchor
      };
    }
  }

  return {
    point: snapPointToGrid(point, planeSettings),
    portId: null,
    wireAnchor: null
  };
}

function insertPointIntoWire(
  points: Point[],
  insertIndex: number,
  point: Point,
  _planeSettings?: BuilderPlaneSettings
): Point[] {
  // El punto de union debe insertarse EXACTO: si se cuantiza a la rejilla
  // deja de estar sobre el cable y el nodo se rompe por 1 px.
  const exactPoint = { x: point.x, y: point.y };
  const previousPoint = points[insertIndex - 1];
  const nextPoint = points[insertIndex];
  const isSamePoint = (left: Point, right: Point) =>
    Math.abs(left.x - right.x) < 0.001 && Math.abs(left.y - right.y) < 0.001;

  if (
    (previousPoint && isSamePoint(previousPoint, exactPoint))
    || (nextPoint && isSamePoint(nextPoint, exactPoint))
  ) {
    return points;
  }

  return cleanWirePath([
    ...points.slice(0, insertIndex),
    exactPoint,
    ...points.slice(insertIndex)
  ]);
}

function applyWireAnchor(
  currentWires: BuilderWire[],
  anchor: WireSegmentAnchor,
  planeSettings?: BuilderPlaneSettings
): BuilderWire[] {
  return currentWires.map((wire) =>
    wire.id === anchor.wireId
      ? { ...wire, points: insertPointIntoWire(wire.points, anchor.insertIndex, anchor.point, planeSettings) }
      : wire
  );
}

function applyWireAnchors(
  currentWires: BuilderWire[],
  anchors: WireSegmentAnchor[],
  planeSettings?: BuilderPlaneSettings
): BuilderWire[] {
  if (anchors.length === 0) {
    return currentWires;
  }

  const anchorsByWireId = new Map<string, WireSegmentAnchor[]>();

  for (const anchor of anchors) {
    const wireAnchors = anchorsByWireId.get(anchor.wireId);

    if (wireAnchors) {
      wireAnchors.push(anchor);
    } else {
      anchorsByWireId.set(anchor.wireId, [anchor]);
    }
  }

  let didChange = false;

  const nextWires = currentWires.map((wire) => {
    const wireAnchors = anchorsByWireId.get(wire.id);

    if (!wireAnchors || wireAnchors.length === 0) {
      return wire;
    }

    let nextPoints = wire.points;

    for (const wireAnchor of [...wireAnchors].sort((left, right) => right.insertIndex - left.insertIndex)) {
      nextPoints = insertPointIntoWire(nextPoints, wireAnchor.insertIndex, wireAnchor.point, planeSettings);
    }

    if (nextPoints === wire.points) {
      return wire;
    }

    didChange = true;
    return { ...wire, points: nextPoints };
  });

  return didChange ? nextWires : currentWires;
}

function removeWiresAttachedToComponent(component: BuilderComponent, wires: BuilderWire[]): BuilderWire[] {
  const portIds = new Set(getComponentTerminals(component).map((terminal) => terminal.portId));

  return wires.filter(
    (wire) =>
      !(wire.startPortId !== null && portIds.has(wire.startPortId))
      && !(wire.endPortId !== null && portIds.has(wire.endPortId))
  );
}

function anchorWireEndpoints(
  points: Point[],
  components: BuilderComponent[],
  wires: BuilderWire[],
  planeSettings: BuilderPlaneSettings,
  excludeWireId?: string,
  allowWireAnchors = true
): { anchors: WireSegmentAnchor[]; endpointPortIds: Partial<Record<WireEndpointKey, string | null>>; points: Point[] } {
  const endpointIndices = [0, points.length - 1];
  const nextPoints = [...points];
  const anchors: WireSegmentAnchor[] = [];
  const endpointPortIds: Partial<Record<WireEndpointKey, string | null>> = {};

  for (const endpointIndex of endpointIndices) {
    const endpoint = nextPoints[endpointIndex];

    if (!endpoint) {
      continue;
    }

    const snapTarget = resolveSnapTarget(endpoint, components, wires, planeSettings, {
      allowWireAnchor: allowWireAnchors,
      ...(excludeWireId ? { excludeWireId } : {})
    });
    nextPoints[endpointIndex] = snapTarget.point;
    endpointPortIds[endpointIndex === 0 ? "start" : "end"] = snapTarget.portId;

    if (snapTarget.wireAnchor) {
      anchors.push(snapTarget.wireAnchor);
    }
  }

  return {
    anchors,
    endpointPortIds,
    points: cleanWirePath(nextPoints)
  };
}

function getComponentTerminalPointKeys(components: BuilderComponent[]): Set<string> {
  return new Set(
    components.flatMap((component) => getComponentTerminals(component).map((terminal) => getPointKey(terminal)))
  );
}

function getWireIdsByPointKey(wires: BuilderWire[]): Map<string, Set<string>> {
  const wireIdsByPointKey = new Map<string, Set<string>>();

  for (const wire of wires) {
    const uniquePointKeys = new Set(wire.points.map((point) => getPointKey(point)));

    for (const pointKey of uniquePointKeys) {
      const wireIds = wireIdsByPointKey.get(pointKey);

      if (wireIds) {
        wireIds.add(wire.id);
      } else {
        wireIdsByPointKey.set(pointKey, new Set([wire.id]));
      }
    }
  }

  return wireIdsByPointKey;
}

function isWireCutBoundaryIndex(
  wire: BuilderWire,
  pointIndex: number,
  terminalPointKeys: ReadonlySet<string>,
  wireIdsByPointKey: ReadonlyMap<string, ReadonlySet<string>>
): boolean {
  if (pointIndex <= 0 || pointIndex >= wire.points.length - 1) {
    return true;
  }

  const point = wire.points[pointIndex];

  if (!point) {
    return false;
  }

  const pointKey = getPointKey(point);

  return terminalPointKeys.has(pointKey) || (wireIdsByPointKey.get(pointKey)?.size ?? 0) > 1;
}

function findNearestWireSegmentIndex(point: Point, wire: BuilderWire): number | null {
  let nearestIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

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
    nearestIndex = index;
  }

  return nearestIndex;
}

function resolveWireCutRange(
  wire: BuilderWire,
  wires: BuilderWire[],
  components: BuilderComponent[],
  segmentIndex: number
): { endIndex: number; startIndex: number } | null {
  if (segmentIndex < 0 || segmentIndex >= wire.points.length - 1) {
    return null;
  }

  const terminalPointKeys = getComponentTerminalPointKeys(components);
  const wireIdsByPointKey = getWireIdsByPointKey(wires);
  let startIndex = segmentIndex;
  let endIndex = segmentIndex + 1;

  while (startIndex > 0 && !isWireCutBoundaryIndex(wire, startIndex, terminalPointKeys, wireIdsByPointKey)) {
    startIndex -= 1;
  }

  while (endIndex < wire.points.length - 1 && !isWireCutBoundaryIndex(wire, endIndex, terminalPointKeys, wireIdsByPointKey)) {
    endIndex += 1;
  }

  return endIndex > startIndex ? { endIndex, startIndex } : null;
}

function buildCutWireFragments(
  nextId: { current: number },
  wire: BuilderWire,
  range: { endIndex: number; startIndex: number }
): BuilderWire[] {
  const fragmentPointSets = [wire.points.slice(0, range.startIndex + 1), wire.points.slice(range.endIndex)];
  const normalizedFragments = fragmentPointSets
    .map((points) => normalizeWirePoints(points.map(roundPoint)))
    .filter((points) => points.length >= 2);

  return normalizedFragments.map((points, index) => ({
    ...wire,
    endPortId: index === 0 ? null : wire.endPortId,
    id: index === 0 ? wire.id : createId(nextId, "builder-wire"),
    points,
    startPortId: index === 0 ? wire.startPortId : null
  }));
}

function createCanvasComponent(
  nextId: { current: number },
  availableTags: TagDefinition[],
  type: BuilderComponentType,
  x: number,
  y: number,
  tagOverride?: string | null,
  delayMsOverride?: number
): BuilderComponent {
  const resolvedLabel = getDefaultComponentLabel(type, availableTags, tagOverride ?? null);
  const resolvedTag = componentNeedsTag(type)
    ? tagOverride ?? createGeneratedInstructionTag(resolvedLabel)
    : null;

  return {
    id: createId(nextId, "builder-component"),
    label: getDefaultComponentLabel(type, availableTags, resolvedTag),
    rotation: 0,
    tag: resolvedTag,
    type,
    usesCustomLabel: false,
    x,
    y,
    ...(isTimedContactType(type) ? { delayMs: clampTimedContactDelayMs(delayMsOverride ?? DEFAULT_TIMED_CONTACT_DELAY_MS) } : {}),
    ...(type === "LAMP" ? { lampGlowColor: DEFAULT_LAMP_GLOW_COLOR } : {}),
    ...(isMaintainedSwitchType(type) ? { isClosed: type === "LIMIT_SWITCH_NC" || type === "OL_CONTACT" } : {}),
    ...(isMomentaryPushButtonType(type) ? { isPressed: false } : {}),
    ...(isSourceType(type) ? { sourceVoltage: getDefaultSourceVoltage(type) } : {})
  };
}

function createWireWithPoints(
  nextId: { current: number },
  color: string,
  points: Point[],
  endpointPortIds: Partial<Record<WireEndpointKey, string | null>> = {}
): BuilderWire {
  return {
    color,
    endPortId: endpointPortIds.end ?? null,
    id: createId(nextId, "builder-wire"),
    points: normalizeWirePoints(points),
    startPortId: endpointPortIds.start ?? null,
    thickness: DEFAULT_WIRE_THICKNESS
  };
}

function createWire(
  nextId: { current: number },
  color: string,
  start: Point,
  end: Point,
  endpointPortIds: Partial<Record<WireEndpointKey, string | null>> = {}
): BuilderWire {
  const tolerance = DEFAULT_GRID_SPACING * 0.25;
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const withinX = Math.abs(deltaX) <= tolerance;
  const withinY = Math.abs(deltaY) <= tolerance;

  if (withinX || withinY) {
    const alignToX = withinX && (!withinY || Math.abs(deltaX) <= Math.abs(deltaY));

    return createWireWithPoints(
      nextId,
      color,
      alignToX
        ? [start, { x: start.x, y: end.y }]
        : [start, { x: end.x, y: start.y }],
      endpointPortIds
    );
  }

  return createWireWithPoints(nextId, color, [start, { x: end.x, y: start.y }, end], endpointPortIds);
}

function buildStarterScene(nextId: { current: number }, availableTags: TagDefinition[]): BuilderScene {
  // Arranque con una fuente AC visible y alineada a la retícula: su borne de
  // entrada (izquierdo) queda en una intersección de 18 px.
  const source = snapComponentToPlaneGrid(
    createCanvasComponent(nextId, availableTags, "POWER_SOURCE", 96, 96),
    DEFAULT_PLANE_SETTINGS
  );

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
  const sharedSource = createCanvasComponent(nextId, availableTags, "POWER_SOURCE", 96, 96);
  const sourceExitPoint = getTerminalPoint(sharedSource, "right");

  components.push(sharedSource);

  program.rungs.forEach((rung, rungIndex) => {
    const y = 120 + rungIndex * 192;
    const rowComponents: BuilderComponent[] = [
      createCanvasComponent(nextId, availableTags, "BREAKER_2P", 336, y - 24)
    ];

    rung.instructions.forEach((instruction, instructionIndex) => {
      rowComponents.push(
        createCanvasComponent(
          nextId,
          availableTags,
          instruction.type,
          576 + instructionIndex * 216,
          y,
          instruction.tag,
          "delayMs" in instruction ? instruction.delayMs : undefined
        )
      );
    });

    components.push(...rowComponents);

    const breaker = rowComponents[0];

    if (breaker) {
      const breakerEntryPoint = getTerminalPoint(breaker, "in-top");
      const sourceBusX = 264;

      wires.push(
        createWireWithPoints(
          nextId,
          DEFAULT_WIRE_COLOR,
          [
            sourceExitPoint,
            { x: sourceBusX, y: sourceExitPoint.y },
            { x: sourceBusX, y: breakerEntryPoint.y },
            breakerEntryPoint
          ],
          {
            end: getPortId(breaker.id, "in-top"),
            start: getPortId(sharedSource.id, "right")
          }
        )
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
          getTerminalPoint(nextComponent, getDefaultEntryTerminalId(nextComponent.type)),
          {
            end: getPortId(nextComponent.id, getDefaultEntryTerminalId(nextComponent.type)),
            start: getPortId(currentComponent.id, getDefaultExitTerminalId(currentComponent.type))
          }
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

function collectReachableNodes(connections: Map<string, Set<string>>, startNodeId: string): Set<string> {
  const visited = new Set<string>();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();

    if (!currentNodeId || visited.has(currentNodeId)) {
      continue;
    }

    visited.add(currentNodeId);

    for (const nextNodeId of connections.get(currentNodeId) ?? []) {
      if (!visited.has(nextNodeId)) {
        queue.push(nextNodeId);
      }
    }
  }

  return visited;
}

function collectReachableNodesWithParents(
  connections: Map<string, Set<string>>,
  startNodeId: string
): { parents: Map<string, string | null>; visited: Set<string> } {
  const visited = new Set<string>();
  const parents = new Map<string, string | null>([[startNodeId, null]]);
  const queue = [startNodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();

    if (!currentNodeId || visited.has(currentNodeId)) {
      continue;
    }

    visited.add(currentNodeId);

    for (const nextNodeId of connections.get(currentNodeId) ?? []) {
      if (parents.has(nextNodeId)) {
        continue;
      }

      parents.set(nextNodeId, currentNodeId);
      queue.push(nextNodeId);
    }
  }

  return { parents, visited };
}

function collectPathNodesFromParents(
  parents: ReadonlyMap<string, string | null>,
  targetNodeIds: ReadonlySet<string>
): Set<string> {
  const pathNodeIds = new Set<string>();

  for (const targetNodeId of targetNodeIds) {
    let currentNodeId: string | null | undefined = targetNodeId;

    while (currentNodeId !== undefined && currentNodeId !== null) {
      if (pathNodeIds.has(currentNodeId)) {
        currentNodeId = parents.get(currentNodeId);
        continue;
      }

      pathNodeIds.add(currentNodeId);
      currentNodeId = parents.get(currentNodeId);
    }
  }

  return pathNodeIds;
}

function collectCurrentFlowPathNodeIds(
  components: BuilderComponent[],
  liveLoadComponentIds: ReadonlySet<string>,
  feedParents: ReadonlyMap<string, string | null>,
  returnParents: ReadonlyMap<string, string | null>,
  feedReachableNodes: ReadonlySet<string>,
  returnReachableNodes: ReadonlySet<string>
): Set<string> {
  const feedTargetNodeIds = new Set<string>();
  const returnTargetNodeIds = new Set<string>();

  for (const component of components) {
    if (!liveLoadComponentIds.has(component.id)) {
      continue;
    }

    const suppliedTerminalNodeIds = getComponentSuppliedTerminalNodeIds(
      component,
      feedReachableNodes,
      returnReachableNodes
    );

    if (!suppliedTerminalNodeIds) {
      continue;
    }

    for (const nodeId of suppliedTerminalNodeIds.feedNodeIds) {
      feedTargetNodeIds.add(nodeId);
    }

    for (const nodeId of suppliedTerminalNodeIds.returnNodeIds) {
      returnTargetNodeIds.add(nodeId);
    }
  }

  return new Set<string>([
    ...collectPathNodesFromParents(feedParents, feedTargetNodeIds),
    ...collectPathNodesFromParents(returnParents, returnTargetNodeIds)
  ]);
}

export function buildResolvedPortGraph(components: BuilderComponent[], wires: BuilderWire[]): ResolvedPortGraph {
  const ports = components.flatMap((component) => getComponentTerminals(component));
  const portsById = new Map(ports.map((port) => [port.portId, port]));
  const componentsById = new Map(components.map((component) => [component.id, component]));
  const electrical = buildElectricalNodeGraph(components, wires);
  const parent = new Map<string, string>();

  const addNode = (nodeId: string) => {
    if (!parent.has(nodeId)) {
      parent.set(nodeId, nodeId);
    }
  };
  const findRoot = (nodeId: string): string => {
    addNode(nodeId);
    let root = nodeId;

    while (parent.get(root) !== root) {
      root = parent.get(root) ?? root;
    }

    let current = nodeId;

    while (parent.get(current) !== root) {
      const next = parent.get(current) ?? root;
      parent.set(current, root);
      current = next;
    }

    return root;
  };
  const unionNodes = (left: string, right: string) => {
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);

    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  };

  for (const port of ports) {
    addNode(getElectricalPortNodeId(port.portId));
  }

  for (const [fromNodeId, toNodeIds] of electrical.connections.entries()) {
    addNode(fromNodeId);

    for (const toNodeId of toNodeIds) {
      addNode(toNodeId);
      unionNodes(fromNodeId, toNodeId);
    }
  }

  const portsByRoot = new Map<string, BuilderTerminal[]>();

  for (const port of ports) {
    const root = findRoot(getElectricalPortNodeId(port.portId));
    const rootPorts = portsByRoot.get(root);

    if (rootPorts) {
      rootPorts.push(port);
    } else {
      portsByRoot.set(root, [port]);
    }
  }

  const connections = new Map<string, Set<string>>();

  for (const rootPorts of portsByRoot.values()) {
    const sortedPorts = [...rootPorts].sort(sortPortsByPosition);

    // Clique, no cadena: en una union puede haber varias ramas (por ejemplo
    // PB.in comparte red con NC.out y XIC.in). Con una cadena, collectRungPaths
    // solo veria un vecino y perderia la rama del contacto de enclavamiento.
    for (let leftIndex = 0; leftIndex < sortedPorts.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < sortedPorts.length; rightIndex += 1) {
        const leftPort = sortedPorts[leftIndex];
        const rightPort = sortedPorts[rightIndex];

        if (leftPort && rightPort) {
          connectGraphNodes(connections, leftPort.portId, rightPort.portId);
        }
      }
    }
  }

  const wireConnections: ResolvedPortGraph["wireConnections"] = [];

  for (const wire of wires) {
    const startPoint = wire.points[0];
    const endPoint = wire.points[wire.points.length - 1];
    const roots = new Set<string>();

    if (startPoint) {
      roots.add(findRoot(getElectricalPointNodeId(startPoint)));
    }

    if (endPoint) {
      roots.add(findRoot(getElectricalPointNodeId(endPoint)));
    }

    const netPorts = [...roots].flatMap((root) => portsByRoot.get(root) ?? []);

    if (netPorts.length === 0) {
      continue;
    }

    const sortedPorts = [...netPorts].sort(sortPortsByPosition);

    wireConnections.push({
      endPortId: wire.endPortId ?? sortedPorts[sortedPorts.length - 1]?.portId ?? "",
      startPortId: wire.startPortId ?? sortedPorts[0]?.portId ?? "",
      wireId: wire.id
    });
  }

  return { componentsById, connections, ports, portsById, wireConnections };
}

function buildElectricalNodeGraph(components: BuilderComponent[], wires: BuilderWire[]): ElectricalNodeGraph {
  const ports = components.flatMap((component) => getComponentTerminals(component));
  const portsById = new Map(ports.map((port) => [port.portId, port]));
  const connections = new Map<string, Set<string>>();
  const wireNodeIdsByWire = new Map<string, string[]>();

  // Coincidencia visual = conexion: si un extremo del cable cae exactamente
  // sobre un terminal, se conecta aunque su portId falte o este obsoleto (p.
  // ej. tras borrar/rotar el componente que lo origino).
  const terminalPortIdsByPointKey = new Map<string, string>();

  for (const component of components) {
    for (const terminal of getComponentTerminals(component)) {
      terminalPortIdsByPointKey.set(getPointKey(terminal), terminal.portId);
    }
  }

  const resolvedPointsByWire = new Map<string, Point[]>();

  for (const wire of wires) {
    // Los extremos se resuelven SIEMPRE desde el portId/terminal, aunque los
    // points guardados esten desactualizados.
    const resolvedPoints = resolveWirePointsWithMap(wire, portsById);
    resolvedPointsByWire.set(wire.id, resolvedPoints);

    const pointNodeIds = resolvedPoints.map((point) => getElectricalPointNodeId(point));

    wireNodeIdsByWire.set(wire.id, pointNodeIds);

    for (let index = 0; index < pointNodeIds.length - 1; index += 1) {
      const currentNodeId = pointNodeIds[index];
      const nextNodeId = pointNodeIds[index + 1];

      if (!currentNodeId || !nextNodeId) {
        continue;
      }

      connectGraphNodes(connections, currentNodeId, nextNodeId);
    }

    const startPointNodeId = pointNodeIds[0];
    const endPointNodeId = pointNodeIds[pointNodeIds.length - 1];

    if (wire.startPortId && startPointNodeId) {
      connectGraphNodes(connections, getElectricalPortNodeId(wire.startPortId), startPointNodeId);
    }

    if (wire.endPortId && endPointNodeId) {
      connectGraphNodes(connections, getElectricalPortNodeId(wire.endPortId), endPointNodeId);
    }

    const startPoint = resolvedPoints[0];
    const endPoint = resolvedPoints[resolvedPoints.length - 1];
    const startTerminalPortId = startPoint ? terminalPortIdsByPointKey.get(getPointKey(startPoint)) : undefined;
    const endTerminalPortId = endPoint ? terminalPortIdsByPointKey.get(getPointKey(endPoint)) : undefined;

    if (startTerminalPortId && startPointNodeId) {
      connectGraphNodes(connections, getElectricalPortNodeId(startTerminalPortId), startPointNodeId);
    }

    if (endTerminalPortId && endPointNodeId) {
      connectGraphNodes(connections, getElectricalPortNodeId(endTerminalPortId), endPointNodeId);
    }
  }

  // Red de seguridad geometrica: un extremo que cae sobre otro cable (vertice
  // o segmento) es una union, aunque el punto no se haya insertado todavia.
  // La tolerancia es pequena (1.5 px) para no unir cables paralelos.
  for (const wire of wires) {
    const wirePoints = resolvedPointsByWire.get(wire.id) ?? [];

    if (wirePoints.length === 0) {
      continue;
    }

    for (const endpointIndex of [0, wirePoints.length - 1]) {
      const endpoint = wirePoints[endpointIndex];
      const endpointPortId = endpointIndex === 0 ? wire.startPortId : wire.endPortId;

      if (!endpoint) {
        continue;
      }

      // Los extremos con puerto ya estan conectados por identidad. La red de
      // seguridad es solo para uniones cable-cable con extremo sin puerto; si
      // se aplicara a los puertos, un cable largo que pasa por debajo de otros
      // bornes los uniria todos (falso corto).
      if (endpointPortId) {
        continue;
      }

      const endpointNodeId = getElectricalPointNodeId(endpoint);

      for (const other of wires) {
        if (other.id === wire.id) {
          continue;
        }

        const otherPoints = resolvedPointsByWire.get(other.id) ?? [];

        for (const otherPoint of otherPoints) {
          if (pointsAreClose(endpoint, otherPoint) && distanceBetween(endpoint, otherPoint) < 1.5) {
            connectGraphNodes(connections, endpointNodeId, getElectricalPointNodeId(otherPoint));
          }
        }

        for (let index = 0; index < otherPoints.length - 1; index += 1) {
          const start = otherPoints[index];
          const end = otherPoints[index + 1];

          if (!start || !end) {
            continue;
          }

          const projection = projectPointOntoSegment(endpoint, start, end);

          if (!projection || projection.distance >= 1.5) {
            continue;
          }

          connectGraphNodes(connections, endpointNodeId, getElectricalPointNodeId(start));
          connectGraphNodes(connections, endpointNodeId, getElectricalPointNodeId(end));
        }
      }
    }
  }

  return {
    connections,
    portsById,
    wireNodeIdsByWire
  };
}

function collectRungPaths(
  fromPortId: string,
  instructionPath: Array<{ delayMs?: number; tag: string; type: InstructionType }>,
  visitedComponents: Set<string>,
  connections: Map<string, Set<string>>,
  portsById: Map<string, BuilderTerminal>,
  componentsById: Map<string, BuilderComponent>
): Array<Array<{ delayMs?: number; tag: string; type: InstructionType }>> {
  const connectedPorts = [...(connections.get(fromPortId) ?? [])]
    .map((portId) => portsById.get(portId))
    .filter((port): port is BuilderTerminal => port !== undefined)
    .sort(sortPortsByPosition);
  const results: Array<Array<{ delayMs?: number; tag: string; type: InstructionType }>> = [];

  for (const connectedPort of connectedPorts) {
    const component = componentsById.get(connectedPort.componentId);

    if (!component || visitedComponents.has(component.id) || isSourceType(component.type)) {
      continue;
    }

    if (isCoilType(component.type)) {
      if (!component.tag) {
        continue;
      }

      results.push([...instructionPath, { tag: component.tag, type: component.type }]);
      continue;
    }

    if (!isPassThroughType(component.type)) {
      continue;
    }

    const conductivePairs = getConductiveTerminalPairs(component);

    if (conductivePairs.length === 0) {
      continue;
    }

    // La logica de escalera es no dirigida: la alimentacion puede entrar por
    // cualquiera de los dos bornes del contacto. Se sale por el otro borne del
    // mismo par (importante en BREAKER_2P, que tiene dos polos).
    const pair = conductivePairs.find(
      ([leftTerminalId, rightTerminalId]) =>
        leftTerminalId === connectedPort.terminalId || rightTerminalId === connectedPort.terminalId
    );

    if (!pair) {
      continue;
    }

    const exitTerminalId = pair[0] === connectedPort.terminalId ? pair[1] : pair[0];
    const exitPort = portsById.get(getPortId(component.id, exitTerminalId));

    if (!exitPort) {
      continue;
    }

    const nextInstructionPath = componentNeedsTag(component.type) && component.tag
      ? [
        ...instructionPath,
        {
          tag: component.tag,
          type: component.type,
          ...(isTimedContactType(component.type) ? { delayMs: getTimedContactDelayMs(component) } : {})
        }
      ]
      : instructionPath;

    results.push(
      ...collectRungPaths(
        exitPort.portId,
        nextInstructionPath,
        new Set([...visitedComponents, component.id]),
        connections,
        portsById,
        componentsById
      )
    );
  }

  return results;
}

function instructionPathKey(instruction: { tag: string; type: InstructionType }): string {
  return `${instruction.type}:${instruction.tag}`;
}

function isInstructionSubsequence(
  candidate: ReadonlyArray<{ tag: string; type: InstructionType }>,
  other: ReadonlyArray<{ tag: string; type: InstructionType }>
): boolean {
  if (candidate.length >= other.length) {
    return false;
  }

  let candidateIndex = 0;

  for (const instruction of other) {
    if (candidateIndex >= candidate.length) {
      break;
    }

    if (instructionPathKey(candidate[candidateIndex]!) === instructionPathKey(instruction)) {
      candidateIndex += 1;
    }
  }

  return candidateIndex === candidate.length;
}

function dedupeMaximalRungPaths(
  paths: Array<Array<{ delayMs?: number; tag: string; type: InstructionType }>>
): Array<Array<{ delayMs?: number; tag: string; type: InstructionType }>> {
  const unique: Array<{
    key: string;
    path: Array<{ delayMs?: number; tag: string; type: InstructionType }>;
  }> = [];

  for (const path of paths) {
    const key = path.map(instructionPathKey).join("|");

    if (unique.some((entry) => entry.key === key)) {
      continue;
    }

    unique.push({ key, path });
  }

  return unique
    .filter((entry, entryIndex) => {
      if (entry.path.length === 0) {
        return false;
      }

      const lastInstruction = entry.path[entry.path.length - 1]!;
      const coilKey = instructionPathKey(lastInstruction);

      return !unique.some((other, otherIndex) => {
        if (otherIndex === entryIndex || other.path.length === 0) {
          return false;
        }

        const otherLastInstruction = other.path[other.path.length - 1]!;

        return instructionPathKey(otherLastInstruction) === coilKey
          && isInstructionSubsequence(entry.path, other.path);
      });
    })
    .map((entry) => entry.path);
}

export function deriveProgram(components: BuilderComponent[], wires: BuilderWire[]): DerivedBuilderState {
  const { componentsById, connections, ports, portsById, wireConnections } = buildResolvedPortGraph(components, wires);
  const resolvedWires = wireConnections.length;

  const sourcePorts = ports
    .filter((port) => {
      const component = componentsById.get(port.componentId);

      if (!component || !isSourceType(component.type) || port.role !== "source") {
        return false;
      }

      // Solo desde el borne de alimentacion. Arrancar tambien desde el retorno
      // produce rungs invertidos que entran a la bobina por su salida.
      return port.terminalId === getSourceTraversalTerminalIds(component).feedTerminalId;
    })
    .sort(sortPortsByPosition);
  const rungInstructionLists: Array<Array<{ delayMs?: number; tag: string; type: InstructionType }>> = [];

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

  const resolvedRungInstructionLists = dedupeMaximalRungPaths(rungInstructionLists);

  return {
    program: {
      rungs: (resolvedRungInstructionLists.map((instructions, rungIndex) => ({
        id: `builder-rung-${rungIndex + 1}`,
        instructions: instructions.map((instruction, instructionIndex) => ({
          id: `builder-rung-${rungIndex + 1}-instruction-${instructionIndex + 1}`,
          tag: instruction.tag,
          type: instruction.type,
          ...((instruction.type === "NOTC" || instruction.type === "NCTO")
            ? { delayMs: clampTimedContactDelayMs(instruction.delayMs ?? DEFAULT_TIMED_CONTACT_DELAY_MS) }
            : {})
        }))
      })) as Program["rungs"])
    },
    resolvedWires,
    runnableRungs: resolvedRungInstructionLists.length,
    unresolvedWires: wires.length - resolvedWires
  };
}

export function computeElectricalState(
  components: BuilderComponent[],
  wires: BuilderWire[],
  running: boolean,
  tagValues: Readonly<Record<string, boolean>>,
  previousResolvedTagValues: Readonly<Record<string, boolean>> = EMPTY_TAG_VALUES,
  previousTimedContactStateByComponentId: TimedContactStateByComponentId = EMPTY_TIMED_CONTACT_STATES,
  elapsedMsThisStep = 0
): ElectricalState {
  const emptyState: ElectricalState = {
    componentVoltageById: new Map(),
    energizedComponentIds: new Set(),
    energizedNodeIds: new Set(),
    fault: null,
    idleWireCurrentById: new Map(),
    energizedWireCurrentById: new Map(),
    energizedWireIds: new Set(),
    resolvedTagValues: EMPTY_TAG_VALUES,
    timedContactStateByComponentId: EMPTY_TIMED_CONTACT_STATES
  };

  if (!running) {
    return emptyState;
  }

  const { resolvedTagValues, timedContactStateByComponentId } = resolvePhysicalInstructionTagValues(
    components,
    wires,
    tagValues,
    previousResolvedTagValues,
    previousTimedContactStateByComponentId,
    elapsedMsThisStep
  );
  const { componentsById, electricalConnections, portsById, wireNodeIdsByWire } = buildElectricalSimulationGraph(
    components,
    wires,
    resolvedTagValues,
    previousTimedContactStateByComponentId,
    elapsedMsThisStep
  );

  const energizedNodeIds = new Set<string>();
  const energizedComponentIds = new Set<string>();
  const componentVoltageById = new Map<string, number>();
  const idleWireCurrentById = new Map<string, SourceCurrentType>();
  const energizedWireCurrentById = new Map<string, SourceCurrentType>();

  for (const component of components) {
    if (!isSourceType(component.type)) {
      continue;
    }

    const sourceVoltage = getSourceVoltage(component);
    const { feedTerminalId, returnTerminalId } = getSourceTraversalTerminalIds(component);
    const feedPortId = getElectricalPortNodeId(getPortId(component.id, feedTerminalId));
    const returnPortId = getElectricalPortNodeId(getPortId(component.id, returnTerminalId));
    const { parents: feedParents, visited: feedReachableNodes } = collectReachableNodesWithParents(electricalConnections, feedPortId);
    const { parents: returnParents, visited: returnReachableNodes } = collectReachableNodesWithParents(electricalConnections, returnPortId);
    const liveLoopNodes = new Set<string>([...feedReachableNodes].filter((nodeId) => returnReachableNodes.has(nodeId)));
    const sourceCurrentType = getSourceCurrentType(component.type) ?? "ac";
    const liveLoadComponentIds = new Set(
      components
        .filter(
          (loopComponent) => isVisualLoadType(loopComponent.type)
            && getComponentSuppliedTerminalNodeIds(loopComponent, feedReachableNodes, returnReachableNodes) !== null
        )
        .map((loopComponent) => loopComponent.id)
    );
    const currentFlowPathNodeIds = collectCurrentFlowPathNodeIds(
      components,
      liveLoadComponentIds,
      feedParents,
      returnParents,
      feedReachableNodes,
      returnReachableNodes
    );

    if (liveLoopNodes.size > 0) {
      const sourceLabel = component.label || getComponentName(component.type);

      return {
        componentVoltageById: new Map([[component.id, sourceVoltage]]),
        energizedComponentIds: new Set([component.id]),
        energizedNodeIds: new Set(liveLoopNodes),
        fault: {
          kind: "short-circuit",
          message: `Short circuit detected at ${sourceLabel}. Add a load or open the loop, then reset the fault.`,
          sourceId: component.id,
          sourceLabel,
          voltage: sourceVoltage
        },
        idleWireCurrentById: new Map(),
        energizedWireCurrentById: new Map(),
        energizedWireIds: new Set(),
        resolvedTagValues,
        timedContactStateByComponentId
      };
    }

    componentVoltageById.set(component.id, sourceVoltage);
    energizedComponentIds.add(component.id);

    for (const nodeId of currentFlowPathNodeIds) {
      const currentPort = nodeId.startsWith("port:")
        ? portsById.get(nodeId.slice(5))
        : undefined;

      if (!currentPort) {
        continue;
      }

      const previousVoltage = componentVoltageById.get(currentPort.componentId) ?? 0;
      componentVoltageById.set(currentPort.componentId, Math.max(previousVoltage, sourceVoltage));
      energizedComponentIds.add(currentPort.componentId);
    }

    for (const nodeId of liveLoopNodes) {
      energizedNodeIds.add(nodeId);

      const currentPort = nodeId.startsWith("port:")
        ? portsById.get(nodeId.slice(5))
        : undefined;
      const loopComponent = currentPort ? componentsById.get(currentPort.componentId) : undefined;

      if (!currentPort || !loopComponent) {
        continue;
      }

      if (isVisualLoadType(loopComponent.type) && !liveLoadComponentIds.has(loopComponent.id)) {
        continue;
      }

      const previousVoltage = componentVoltageById.get(currentPort.componentId) ?? 0;
      componentVoltageById.set(currentPort.componentId, Math.max(previousVoltage, sourceVoltage));
      energizedComponentIds.add(currentPort.componentId);
    }

    for (const [wireId, nodeIds] of wireNodeIdsByWire.entries()) {
      if (nodeIds.some((nodeId) => currentFlowPathNodeIds.has(nodeId))) {
        if (!energizedWireCurrentById.has(wireId)) {
          energizedWireCurrentById.set(wireId, sourceCurrentType);
        }

        continue;
      }

      if (
        !idleWireCurrentById.has(wireId)
        && nodeIds.some((nodeId) => feedReachableNodes.has(nodeId))
      ) {
        idleWireCurrentById.set(wireId, sourceCurrentType);
      }
    }
  }

  for (const wireId of energizedWireCurrentById.keys()) {
    idleWireCurrentById.delete(wireId);
  }

  const energizedWireIds = new Set(energizedWireCurrentById.keys());

  return {
    componentVoltageById,
    energizedComponentIds,
    energizedNodeIds,
    fault: null,
    idleWireCurrentById,
    energizedWireCurrentById,
    energizedWireIds,
    resolvedTagValues,
    timedContactStateByComponentId
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

function getComponentGlyphHitboxStyle(type: BuilderComponentType, rotation: number): CSSProperties {
  const normalizedRotation = normalizeQuarterTurns(rotation);
  const vertical = normalizedRotation === 1 || normalizedRotation === 3;

  if (type === "BREAKER_2P") {
    return vertical
      ? { height: 124, width: 108 }
      : { height: 92, width: 138 };
  }

  switch (getSymbolCategory(type)) {
    case "power":
      return vertical
        ? { height: 116, width: 104 }
        : { height: 84, width: 136 };
    case "breaker":
      return vertical
        ? { height: 118, width: 94 }
        : { height: 80, width: 128 };
    case "contact":
      return vertical
        ? { height: 120, width: 90 }
        : { height: 78, width: 126 };
    case "coil":
    case "load":
      return vertical
        ? { height: 108, width: 100 }
        : { height: 84, width: 112 };
  }
}

function getPushButtonPressTargetStyle(rotation: number): CSSProperties {
  const normalizedRotation = normalizeQuarterTurns(rotation);
  const vertical = normalizedRotation === 1 || normalizedRotation === 3;
  const rotatedCenter = rotatePoint({ x: ROTATION_CENTER_X, y: 28 }, rotation);

  return {
    height: vertical ? 68 : 46,
    left: rotatedCenter.x,
    top: rotatedCenter.y,
    width: vertical ? 46 : 68
  };
}

function getComponentStatusBadge(component: BuilderComponent, running: boolean, energized: boolean): string | null {
  if (isSourceType(component.type)) {
    return formatSourceVoltage(component);
  }

  if (isMaintainedSwitchType(component.type)) {
    return isMaintainedSwitchClosed(component) ? "Closed" : "Open";
  }

  if (isBreakerType(component.type)) {
    return null;
  }

  if (isMomentaryPushButtonType(component.type)) {
    return isMomentaryPushButtonPressed(component) ? "Pressed" : null;
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
    fault = null,
    onCircuitLoad,
    onFaultDetected,
    onFaultReset,
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
    tagValues = EMPTY_TAG_VALUES,
    tick = 0
  } = props;
  const availableTags = tags.length > 0 ? tags : fallbackTags;
  const nextId = useRef(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const circuitFileInputRef = useRef<HTMLInputElement>(null);
  const stageScrollRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<BuilderComponent[]>([]);
  const wiresRef = useRef<BuilderWire[]>([]);
  const pendingLoadedSceneRef = useRef<{
    planeSettings: BuilderPlaneSettings;
    scene: BuilderScene;
    signature: string;
  } | null>(null);
  const activePushButtonPressRef = useRef<{
    componentId: string;
    pointerId: number;
  } | null>(null);
  const activeComponentDragPointerRef = useRef<{
    componentId: string;
    pointerId: number;
  } | null>(null);
  const planeSettingsRef = useRef<BuilderPlaneSettings>(DEFAULT_PLANE_SETTINGS);
  const canvasZoomRef = useRef(DEFAULT_CANVAS_ZOOM);
  const componentDragMovedRef = useRef(false);
  const paletteDragMovedRef = useRef(false);
  const dragState = useRef<{
    componentId: string;
    offsetX: number;
    offsetY: number;
    pointerPoint: Point;
  } | null>(null);
  const paletteDragState = useRef<{
    didDrag: boolean;
    label: string;
    startX: number;
    startY: number;
    type: BuilderComponentType;
  } | null>(null);
  const panState = useRef<{
    scrollLeft: number;
    scrollTop: number;
    startX: number;
    startY: number;
  } | null>(null);
  const didPanDuringMouseDownRef = useRef(false);
  const suppressCanvasClickUntilRef = useRef(0);
  const wirePointDragState = useRef<WirePointDragState | null>(null);
  const pendingSwitchToggleRef = useRef<{
    componentId: string;
    timeoutId: number;
  } | null>(null);
  const reportedFaultSignatureRef = useRef<string | null>(null);
  const resolvedPhysicalTagValuesRef = useRef<Record<string, boolean>>({});
  const timedContactStateByComponentIdRef = useRef<Record<string, TimedContactRuntimeState>>({});
  const lastElectricalTickRef = useRef<number>(tick);
  const lastProgramSignature = useRef(JSON.stringify({ rungs: [] }));
  const lastBuilderTagsSignature = useRef("[]");
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [draggingComponentId, setDraggingComponentId] = useState<string | null>(null);
  const [wires, setWires] = useState<BuilderWire[]>([]);
  const [planeSettings, setPlaneSettings] = useState<BuilderPlaneSettings>(DEFAULT_PLANE_SETTINGS);
  const [planeDraft, setPlaneDraft] = useState({
    gridSpacing: String(DEFAULT_PLANE_SETTINGS.gridSpacing),
    height: String(DEFAULT_PLANE_SETTINGS.height),
    width: String(DEFAULT_PLANE_SETTINGS.width)
  });
  const [sheetMetadata, setSheetMetadata] = useState<SheetMetadata>(() =>
    createDefaultSheetMetadata("PLC Sim circuit", new Date().toISOString())
  );
  const [draftWirePoints, setDraftWirePoints] = useState<Point[]>([]);
  const [wireColor, setWireColor] = useState(DEFAULT_WIRE_COLOR);
  const [wireThickness, setWireThickness] = useState(DEFAULT_WIRE_THICKNESS);
  const [wireReconnectTarget, setWireReconnectTarget] = useState<{
    endpoint: WireEndpointKey;
    wireId: string;
  } | null>(null);
  const [isWireAuthoringEnabled, setIsWireAuthoringEnabled] = useState(true);
  const [isPanModeEnabled, setIsPanModeEnabled] = useState(true);
  const [selection, setSelection] = useState<BuilderSelection>(null);
  const [componentMenu, setComponentMenu] = useState<ComponentMenuState>(null);
  const [wireMenu, setWireMenu] = useState<{ anchor: Point; wireId: string } | null>(null);
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);
  const [hasCustomLayout, setHasCustomLayout] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(DEFAULT_CANVAS_ZOOM);
  const [paletteDragPreview, setPaletteDragPreview] = useState<{
    label: string;
    type: BuilderComponentType;
    x: number;
    y: number;
  } | null>(null);
  const [circuitSnapshotStatus, setCircuitSnapshotStatus] = useState<string | null>(null);
  const componentPaletteScrollRef = useRef<HTMLDivElement | null>(null);
  const builderTags = mergeInstructionBindingTags(availableTags, components);
  const builderTagsSignature = JSON.stringify(builderTags);

  useEffect(() => {
    componentsRef.current = components;
  }, [components]);

  useEffect(() => {
    wiresRef.current = wires;
  }, [wires]);

  useEffect(() => {
    planeSettingsRef.current = planeSettings;
    setPlaneDraft({
      gridSpacing: String(planeSettings.gridSpacing),
      height: String(planeSettings.height),
      width: String(planeSettings.width)
    });
  }, [planeSettings]);

  useEffect(() => {
    canvasZoomRef.current = canvasZoom;
  }, [canvasZoom]);

  useEffect(() => {
    const syncedComponents = components.map(syncInstructionComponentTag);
    const hasTagChanges = syncedComponents.some((component, index) => component !== components[index]);

    if (!hasTagChanges) {
      return;
    }

    componentsRef.current = syncedComponents;
    setComponents(syncedComponents);
    setHasCustomLayout(true);
  }, [components]);

  useEffect(() => () => {
    if (pendingSwitchToggleRef.current) {
      window.clearTimeout(pendingSwitchToggleRef.current.timeoutId);
      pendingSwitchToggleRef.current = null;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (
        event.target instanceof HTMLInputElement
        || event.target instanceof HTMLTextAreaElement
        || event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "escape"));
        setWireMenu(null);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function getCanvasPointFromClient(clientX: number, clientY: number): Point | null {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const bounds = canvas.getBoundingClientRect();
    const zoom = canvasZoomRef.current;
    // El origen del modelo es el content-box, no el border-box. clientLeft/Top
    // es el borde sin escalar; se multiplica por el zoom del canvas.
    const contentLeft = bounds.left + canvas.clientLeft * zoom;
    const contentTop = bounds.top + canvas.clientTop * zoom;

    return {
      x: clamp((clientX - contentLeft) / zoom, 0, planeSettingsRef.current.width),
      y: clamp((clientY - contentTop) / zoom, 0, planeSettingsRef.current.height)
    };
  }

  function isClientPointInsideCanvas(clientX: number, clientY: number): boolean {
    const canvas = canvasRef.current;

    if (!canvas) {
      return false;
    }

    const bounds = canvas.getBoundingClientRect();

    return clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom;
  }

  function clearWireInteraction() {
    setDraftWirePoints([]);
    setCursorPoint(null);
    setWireReconnectTarget(null);
  }

  function queueCurrentSceneForProgramSync(programSignature: string) {
    pendingLoadedSceneRef.current = {
      planeSettings: planeSettingsRef.current,
      scene: cloneScene({ components: componentsRef.current, wires: wiresRef.current }),
      signature: programSignature
    };
  }

  function buildNextDraftPoints(currentPoints: Point[], point: Point): Point[] {
    const snappedPoint = resolveSnapTarget(
      point,
      componentsRef.current,
      wiresRef.current,
      planeSettingsRef.current,
      { allowWireAnchor: true }
    ).point;

    return createOrthogonalPath(currentPoints, snappedPoint, planeSettingsRef.current);
  }

  function updateCanvasZoom(nextZoom: number, focusClientPoint?: Point) {
    const resolvedZoom = clampCanvasZoom(nextZoom);

    if (resolvedZoom === canvasZoomRef.current) {
      return;
    }

    const stageScroll = stageScrollRef.current;
    const currentZoom = canvasZoomRef.current;
    let nextScrollLeft = 0;
    let nextScrollTop = 0;

    if (stageScroll) {
      const stageBounds = stageScroll.getBoundingClientRect();
      const focusViewportX = focusClientPoint
        ? clamp(focusClientPoint.x - stageBounds.left, 0, stageScroll.clientWidth)
        : stageScroll.clientWidth / 2;
      const focusViewportY = focusClientPoint
        ? clamp(focusClientPoint.y - stageBounds.top, 0, stageScroll.clientHeight)
        : stageScroll.clientHeight / 2;
      const focusPlaneX = (stageScroll.scrollLeft + focusViewportX) / currentZoom;
      const focusPlaneY = (stageScroll.scrollTop + focusViewportY) / currentZoom;

      nextScrollLeft = focusPlaneX * resolvedZoom - focusViewportX;
      nextScrollTop = focusPlaneY * resolvedZoom - focusViewportY;
    }

    setCanvasZoom(resolvedZoom);

    window.requestAnimationFrame(() => {
      const updatedStageScroll = stageScrollRef.current;

      if (!updatedStageScroll) {
        return;
      }

      updatedStageScroll.scrollLeft = Math.round(clamp(
        nextScrollLeft,
        0,
        Math.max(planeSettingsRef.current.width * resolvedZoom - updatedStageScroll.clientWidth, 0)
      ));
      updatedStageScroll.scrollTop = Math.round(clamp(
        nextScrollTop,
        0,
        Math.max(planeSettingsRef.current.height * resolvedZoom - updatedStageScroll.clientHeight, 0)
      ));
    });
  }

  useEffect(() => {
    const stageScrollElement = stageScrollRef.current;
    const paletteScrollElement = componentPaletteScrollRef.current;

    const handleNativeStageWheel = (event: WheelEvent) => {
      const rawZoomDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
        ? event.deltaY
        : event.deltaX;
      const zoomDelta = normalizeWheelDeltaValue(rawZoomDelta, event.deltaMode);

      if (zoomDelta === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      updateCanvasZoom(
        canvasZoomRef.current * Math.exp(-zoomDelta * 0.0012),
        { x: event.clientX, y: event.clientY }
      );
    };

    const handleNativePaletteWheel = (event: WheelEvent) => {
      const scrollDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;

      if (scrollDelta === 0 || !paletteScrollElement) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      paletteScrollElement.scrollLeft += scrollDelta;
    };

    stageScrollElement?.addEventListener("wheel", handleNativeStageWheel, { passive: false });
    paletteScrollElement?.addEventListener("wheel", handleNativePaletteWheel, { passive: false });

    return () => {
      stageScrollElement?.removeEventListener("wheel", handleNativeStageWheel);
      paletteScrollElement?.removeEventListener("wheel", handleNativePaletteWheel);
    };
  }, []);

  function commitWireFromPoints(nextPointsInput: Point[]) {
    const nextPoints = cleanWirePath(nextPointsInput);

    if (nextPoints.length < 2) {
      return;
    }

    const wireId = createId(nextId, "builder-wire");
    const currentWires = wiresRef.current;
    const { anchors, endpointPortIds, points } = anchorWireEndpoints(
      nextPoints,
      componentsRef.current,
      currentWires,
      planeSettingsRef.current,
      undefined,
      true
    );
    const anchoredWires = applyWireAnchors(currentWires, anchors, planeSettingsRef.current);
    const candidateWires = [
      ...anchoredWires,
      {
        color: wireColor,
        endPortId: endpointPortIds.end ?? null,
        id: wireId,
        points,
        startPortId: endpointPortIds.start ?? null,
        thickness: wireThickness
      }
    ];
    const reconciled = reconcileWireTopology(
      { components: componentsRef.current, wires: candidateWires },
      planeSettingsRef.current
    );

    wiresRef.current = reconciled.scene.wires;
    setWires(reconciled.scene.wires);

    if (reconciled.removedWireIds.length > 0) {
      setCircuitSnapshotStatus(
        `Removed ${reconciled.removedWireIds.length} loose wire(s): ${reconciled.removedWireIds.join(", ")}.`
      );
    }

    setSelection(
      reconciled.scene.wires.some((wire) => wire.id === wireId)
        ? { kind: "wire", id: wireId }
        : null
    );
    setDraftWirePoints([]);
    setCursorPoint(null);
    setHasCustomLayout(true);
  }

  function applySceneState(
    nextScene: BuilderScene,
    nextProgramSignature: string,
    customLayout: boolean,
    nextPlaneSettings: BuilderPlaneSettings = planeSettingsRef.current
  ) {
    const resolvedPlaneSettings = sanitizePlaneSettings(nextPlaneSettings);
    // Migracion de geometria: alinea cada componente a la reticula de su borne
    // de entrada y mueve los cables con el. Es idempotente y hace que los
    // bornes izquierdo/derecho de dos simbolos alineados coincidan en vertical.
    const clampedScene = clampSceneToPlane(cloneScene(nextScene), resolvedPlaneSettings);
    const reconciled = reconcileWireTopology(clampedScene, resolvedPlaneSettings);
    const resolvedScene = reconciled.scene;

    if (reconciled.removedWireIds.length > 0) {
      setCircuitSnapshotStatus(
        `Removed ${reconciled.removedWireIds.length} loose wire(s): ${reconciled.removedWireIds.join(", ")}.`
      );
    }

    nextId.current = getNextIdValueFromScene(resolvedScene);
    planeSettingsRef.current = resolvedPlaneSettings;
    componentsRef.current = resolvedScene.components;
    wiresRef.current = resolvedScene.wires;
    setPlaneSettings(resolvedPlaneSettings);
    setComponents(resolvedScene.components);
    setWires(resolvedScene.wires);
    clearWireInteraction();
    setSelection(null);
    setIsWireAuthoringEnabled(true);
    paletteDragState.current = null;
    paletteDragMovedRef.current = false;
    panState.current = null;
    dragState.current = null;
    wirePointDragState.current = null;
    componentDragMovedRef.current = false;
    setDraggingComponentId(null);
    setPaletteDragPreview(null);
    setIsPanning(false);
    setHasCustomLayout(customLayout);
    resolvedPhysicalTagValuesRef.current = {};
    lastProgramSignature.current = nextProgramSignature;
    lastBuilderTagsSignature.current = JSON.stringify(mergeInstructionBindingTags(availableTags, resolvedScene.components));
  }

  useEffect(() => {
    const pendingLoadedScene = pendingLoadedSceneRef.current;
    const nextProgramSignature = JSON.stringify(program ?? { rungs: [] });
    const shouldUsePendingScene = pendingLoadedScene !== null && pendingLoadedScene.signature === nextProgramSignature;
    // Si el usuario ya tiene un layout propio y el programa no cambio, no se
    // reconstruye la escena: mover/borrar el componente por defecto debe
    // persistir. Solo se reconstruye al cargar o cuando cambia el programa.
    const shouldKeepCurrentScene = !shouldUsePendingScene
      && hasCustomLayout
      && nextProgramSignature === lastProgramSignature.current;
    const nextPlaneSettings = shouldUsePendingScene
      ? pendingLoadedScene.planeSettings
      : planeSettingsRef.current;
    const nextAvailableTags = mergeInstructionBindingTags(availableTags, componentsRef.current);
    const nextScene = shouldUsePendingScene
      ? cloneScene(pendingLoadedScene.scene)
      : shouldKeepCurrentScene
        ? { components: componentsRef.current, wires: wiresRef.current }
        : buildSceneFromProgram(nextId, nextAvailableTags, program);
    const nextDerivedState = deriveProgram(nextScene.components, nextScene.wires);

    if (!shouldKeepCurrentScene) {
      nextId.current = 0;
    }

    if (shouldUsePendingScene) {
      pendingLoadedSceneRef.current = null;
    }

    applySceneState(
      nextScene,
      JSON.stringify(nextDerivedState.program),
      shouldUsePendingScene || shouldKeepCurrentScene,
      nextPlaneSettings
    );
  }, [availableTags, program]);

  function dragComponentToClientPoint(componentId: string, clientX: number, clientY: number): boolean {
    if (running) {
      return false;
    }

    const point = getCanvasPointFromClient(clientX, clientY);

    if (!point) {
      return false;
    }

    const drag = dragState.current;
    const movedComponent = componentsRef.current.find((component) => component.id === componentId);

    if (!drag || !movedComponent) {
      return false;
    }

    drag.pointerPoint = point;

    const padding = getComponentPlanePadding(planeSettingsRef.current);
    const nextX = clamp(
      point.x - drag.offsetX,
      padding,
      MAX_PLANE_WIDTH - COMPONENT_WIDTH - padding
    );
    const nextY = clamp(
      point.y - drag.offsetY,
      padding,
      MAX_PLANE_HEIGHT - COMPONENT_HEIGHT - padding
    );

    if (nextX === movedComponent.x && nextY === movedComponent.y) {
      return false;
    }

    // Si el componente se acerca al borde inferior/derecho, el plano crece en
    // vez de aplastarlo contra el limite. Antes las filas de abajo se apilaban
    // unas sobre otras al no caber.
    const requiredWidth = nextX + COMPONENT_WIDTH + padding;
    const requiredHeight = nextY + COMPONENT_HEIGHT + padding;
    let currentPlaneSettings = planeSettingsRef.current;

    if (
      requiredWidth > currentPlaneSettings.width
      || requiredHeight > currentPlaneSettings.height
    ) {
      currentPlaneSettings = sanitizePlaneSettings({
        ...currentPlaneSettings,
        height: Math.max(currentPlaneSettings.height, requiredHeight),
        width: Math.max(currentPlaneSettings.width, requiredWidth)
      });
      planeSettingsRef.current = currentPlaneSettings;
      setPlaneSettings(currentPlaneSettings);
    }

    const nextComponent = clampComponentToPlane(
      { ...movedComponent, x: nextX, y: nextY },
      currentPlaneSettings
    );
    const nextComponents = componentsRef.current.map((component) =>
      component.id === nextComponent.id ? nextComponent : component
    );
    const nextWires = moveAttachedWireEndpoints(
      wiresRef.current,
      movedComponent,
      nextComponent,
      planeSettingsRef.current.gridSpacing
    );

    componentsRef.current = nextComponents;
    wiresRef.current = nextWires;
    setComponents(nextComponents);
    setWires(nextWires);
    componentDragMovedRef.current = true;
    setHasCustomLayout(true);
    return true;
  }

  function finalizeComponentDrag(componentId?: string): void {
    const releasedDragState = dragState.current;

    if (!releasedDragState) {
      return;
    }

    if (componentId && releasedDragState.componentId !== componentId) {
      return;
    }

    dragState.current = null;
    setDraggingComponentId(null);

    const releasedComponent = componentsRef.current.find((component) => component.id === releasedDragState.componentId);

    if (!releasedComponent) {
      return;
    }

    if (!componentDragMovedRef.current) {
      return;
    }

    const snappedComponent = snapComponentByTerminal(
      clampComponentToPlane(releasedComponent, planeSettingsRef.current),
      releasedDragState.pointerPoint,
      planeSettingsRef.current
    );

    const nextComponents = componentsRef.current.map((component) =>
      component.id === snappedComponent.id ? snappedComponent : component
    );
    const movedWires = moveAttachedWireEndpoints(
      wiresRef.current,
      releasedComponent,
      snappedComponent,
      planeSettingsRef.current.gridSpacing
    );
    const reconciled = reconcileWireTopology(
      { components: nextComponents, wires: movedWires },
      planeSettingsRef.current
    );

    componentsRef.current = reconciled.scene.components;
    wiresRef.current = reconciled.scene.wires;
    setComponents(reconciled.scene.components);
    setWires(reconciled.scene.wires);
    setHasCustomLayout(true);

    if (reconciled.removedWireIds.length > 0) {
      setCircuitSnapshotStatus(
        `Removed ${reconciled.removedWireIds.length} loose wire(s): ${reconciled.removedWireIds.join(", ")}.`
      );
    }
  }

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (paletteDragState.current) {
        const distanceFromStart = Math.hypot(
          event.clientX - paletteDragState.current.startX,
          event.clientY - paletteDragState.current.startY
        );

        if (!paletteDragState.current.didDrag && distanceFromStart >= PALETTE_DRAG_THRESHOLD) {
          paletteDragState.current = {
            ...paletteDragState.current,
            didDrag: true
          };
          paletteDragMovedRef.current = true;
        }

        if (!paletteDragState.current.didDrag) {
          return;
        }

        setPaletteDragPreview({
          label: paletteDragState.current.label,
          type: paletteDragState.current.type,
          x: event.clientX,
          y: event.clientY
        });
        return;
      }

      if (panState.current && stageScrollRef.current) {
        const deltaX = event.clientX - panState.current.startX;
        const deltaY = event.clientY - panState.current.startY;

        // Un click con temblor de 1 px no debe mover el plano. Solo se empieza
        // a panear tras superar el umbral.
        if (!didPanDuringMouseDownRef.current && Math.hypot(deltaX, deltaY) < 4) {
          return;
        }

        const nextScrollLeft = Math.round(panState.current.scrollLeft - deltaX);
        const nextScrollTop = Math.round(panState.current.scrollTop - deltaY);

        didPanDuringMouseDownRef.current = true;
        stageScrollRef.current.scrollLeft = nextScrollLeft;
        stageScrollRef.current.scrollTop = nextScrollTop;
        return;
      }

      if (wirePointDragState.current) {
        const point = getCanvasPointFromClient(event.clientX, event.clientY);

        if (!point) {
          return;
        }

        let didMove = false;

        const nextWires = wiresRef.current.map((wire) => {
          if (wire.id !== wirePointDragState.current?.wireId) {
            return wire;
          }

          const pointIndex = wirePointDragState.current.pointIndex;
          const currentPoint = wire.points[pointIndex];

          if (!currentPoint) {
            return wire;
          }

          const nextPoint = snapPointToGrid(point, planeSettingsRef.current);

          if (pointsAreClose(currentPoint, nextPoint)) {
            return wire;
          }

          const nextPoints = isWireEndpointIndex(pointIndex, wire.points.length)
            ? repositionWireEndpointOrthogonally(
              wire.points,
              pointIndex,
              nextPoint,
              getWireEndpointPreferredAxis(
                wire,
                pointIndex,
                componentsRef.current,
                nextPoint,
                planeSettingsRef.current.gridSpacing * 0.25
              ),
              planeSettingsRef.current.gridSpacing * 0.25
            )
            : (() => {
              const updatedPoints = [...wire.points];
              updatedPoints[pointIndex] = nextPoint;
              return updatedPoints;
            })();
          didMove = true;

          return { ...wire, points: cleanWirePath(nextPoints) };
        });

        if (didMove) {
          wiresRef.current = nextWires;
          setWires(nextWires);
          setSelection({ kind: "wire", id: wirePointDragState.current.wireId });
          setHasCustomLayout(true);
        }

        return;
      }

      if (!dragState.current) {
        return;
      }

      dragComponentToClientPoint(dragState.current.componentId, event.clientX, event.clientY);
    }

    function handleMouseUp(event: MouseEvent) {
      const shouldSuppressCanvasClick = panState.current !== null && didPanDuringMouseDownRef.current;

      if (paletteDragState.current) {
        const shouldDrop = paletteDragState.current.didDrag && isClientPointInsideCanvas(event.clientX, event.clientY);

        if (shouldDrop) {
          const point = getCanvasPointFromClient(event.clientX, event.clientY);
          const nextComponent = createComponent(paletteDragState.current.type, point ?? undefined);

          setComponents((currentComponents) => [...currentComponents, nextComponent]);
          setSelection({ kind: "component", id: nextComponent.id });
          setHasCustomLayout(true);
        }

        paletteDragState.current = null;
        setPaletteDragPreview(null);

        if (shouldDrop) {
          return;
        }
      }

      const releasedDragState = dragState.current;
      const releasedWirePointDragState = wirePointDragState.current;

      if (releasedWirePointDragState) {
        const droppedPoint = getCanvasPointFromClient(event.clientX, event.clientY);
        const currentWires = wiresRef.current;
        const releasedWire = currentWires.find((wire) => wire.id === releasedWirePointDragState.wireId);

        if (
          releasedWire
          && isWireEndpointIndex(releasedWirePointDragState.pointIndex, releasedWire.points.length)
        ) {
          const currentPoint = releasedWire.points[releasedWirePointDragState.pointIndex];

          if (currentPoint) {
            const snapTarget = resolveSnapTarget(
              droppedPoint ?? currentPoint,
              componentsRef.current,
              currentWires,
              planeSettingsRef.current,
              { excludeWireId: releasedWire.id }
            );
            const anchoredWires = snapTarget.wireAnchor
              ? applyWireAnchors(currentWires, [snapTarget.wireAnchor])
              : currentWires;
            const nextWires = anchoredWires.map((wire) => {
              if (wire.id !== releasedWire.id) {
                return wire;
              }

              const nextPoints = repositionWireEndpointOrthogonally(
                wire.points,
                releasedWirePointDragState.pointIndex,
                snapTarget.point,
                getWireEndpointPreferredAxis(
                  wire,
                  releasedWirePointDragState.pointIndex,
                  componentsRef.current,
                  snapTarget.point,
                  planeSettingsRef.current.gridSpacing * 0.25
                ),
                planeSettingsRef.current.gridSpacing * 0.25
              );

              if (releasedWirePointDragState.pointIndex === 0) {
                return {
                  ...wire,
                  points: simplifyWirePoints(nextPoints),
                  startPortId: snapTarget.portId
                };
              }

              return {
                ...wire,
                endPortId: snapTarget.portId,
                points: simplifyWirePoints(nextPoints)
              };
            });
            const reconciled = reconcileWireTopology(
              { components: componentsRef.current, wires: nextWires },
              planeSettingsRef.current
            );

            wiresRef.current = reconciled.scene.wires;
            setWires(reconciled.scene.wires);

            if (!reconciled.scene.wires.some((wire) => wire.id === releasedWire.id)) {
              setSelection(null);
            }

            if (reconciled.removedWireIds.length > 0) {
              setCircuitSnapshotStatus(
                `Removed ${reconciled.removedWireIds.length} loose wire(s): ${reconciled.removedWireIds.join(", ")}.`
              );
            }
          }
        }
      }

      if (releasedDragState) {
        finalizeComponentDrag(releasedDragState.componentId);
      }

      if (shouldSuppressCanvasClick) {
        suppressCanvasClickUntilRef.current = performance.now() + 150;
      }

      panState.current = null;
      setIsPanning(false);
      didPanDuringMouseDownRef.current = false;
      wirePointDragState.current = null;
      if (activePushButtonPressRef.current) {
        releaseMomentaryPushButton(activePushButtonPressRef.current.componentId);
        activePushButtonPressRef.current = null;
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const liveTagValues = running ? tagValues : EMPTY_TAG_VALUES;
  const electricalElapsedMs = running && tick !== lastElectricalTickRef.current ? scanIntervalMs : 0;
  const connectivityComponents = draggingComponentId
    ? components.filter((component) => component.id !== draggingComponentId)
    : components;
  const derivedState = useMemo(
    () => deriveProgram(connectivityComponents, wires),
    [connectivityComponents, wires]
  );
  const electricalState = computeElectricalState(
    connectivityComponents,
    wires,
    running,
    liveTagValues,
    resolvedPhysicalTagValuesRef.current,
    timedContactStateByComponentIdRef.current,
    electricalElapsedMs
  );
  const derivedProgramSignature = JSON.stringify(derivedState.program);
  const resolvedWires = useMemo(
    () => wires.map((wire) => ({
      ...wire,
      points: resolveWireDisplayPoints(wire, components, planeSettings)
    })),
    [components, planeSettings, wires]
  );
  // Los nodos editables deben conservar el mismo numero de puntos que el cable
  // guardado; los stubs son solo visuales y no se pueden arrastrar.
  const wireNodeWires = useMemo(
    () => wires.map((wire) => ({
      ...wire,
      points: resolveWirePoints(wire, components)
    })),
    [components, wires]
  );
  const showTerminalDebug = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("debugTerminals") === "1";
  const terminalDebugNodes = showTerminalDebug
    ? components.flatMap((component) => getComponentTerminals(component))
    : [];
  const stubDebugNodes = showTerminalDebug
    ? wires.flatMap((wire) => getWireTerminalRoutes(wire, components, planeSettings))
    : [];
  const selectedComponent = selection?.kind === "component"
    ? components.find((component) => component.id === selection.id) ?? null
    : null;
  const selectedWire = selection?.kind === "wire"
    ? resolvedWires.find((wire) => wire.id === selection.id) ?? null
    : null;
  const selectedWireInspection = selectedWire ? inspectWire(selectedWire, components, resolvedWires) : null;
  const selectedWireStatus = selectedWireInspection ? getWireStatusMeta(selectedWireInspection.status) : null;
  const hasActiveWireDraft = draftWirePoints.length > 0;
  const wireTerminalsEnabled = isWireAuthoringEnabled || wireReconnectTarget !== null;
  const isWirePointerPreviewVisible = wireTerminalsEnabled && (hasActiveWireDraft || wireReconnectTarget !== null);
  const scaledCanvasWidth = planeSettings.width * canvasZoom;
  const scaledCanvasHeight = planeSettings.height * canvasZoom;
  const canvasViewportStyle: CSSProperties = {
    height: Math.ceil(scaledCanvasHeight),
    width: Math.ceil(scaledCanvasWidth)
  };
  const canvasStyle: CSSProperties = {
    height: planeSettings.height,
    transform: `scale(${canvasZoom})`,
    width: planeSettings.width
  };
  const zoomPercent = Math.round(canvasZoom * 100);
  const previewPoints = draftWirePoints.length > 0 && cursorPoint !== null
    ? [...draftWirePoints, cursorPoint]
    : draftWirePoints;
  const wireDisplayNodes = Array.from(
    wireNodeWires.reduce((nodesByPointKey, wire) => {
      const isSelected = selection?.kind === "wire" && selection.id === wire.id;

      wire.points.forEach((point, index) => {
        const pointKey = getPointKey(point);
        const entry = nodesByPointKey.get(pointKey) ?? {
          occurrences: [] as Array<{
            color: string;
            isEndpoint: boolean;
            isSelected: boolean;
            pointIndex: number;
            wireId: string;
          }> ,
          point: roundPoint(point)
        };

        entry.occurrences.push({
          color: wire.color,
          isEndpoint: isWireEndpointIndex(index, wire.points.length),
          isSelected,
          pointIndex: index,
          wireId: wire.id
        });
        nodesByPointKey.set(pointKey, entry);
      });

      return nodesByPointKey;
    }, new Map<string, {
      occurrences: Array<{
        color: string;
        isEndpoint: boolean;
        isSelected: boolean;
        pointIndex: number;
        wireId: string;
      }>;
      point: Point;
    }>()).entries()
  ).map(([pointKey, entry]) => {
    const primaryOccurrence = entry.occurrences.find((occurrence) => occurrence.isSelected) ?? entry.occurrences[0];

    return {
      hasEndpoint: entry.occurrences.some((occurrence) => occurrence.isEndpoint),
      hasMultipleOccurrences: entry.occurrences.length > 1,
      hasSelectedOccurrence: entry.occurrences.some((occurrence) => occurrence.isSelected),
      key: pointKey,
      point: entry.point,
      primaryOccurrence
    };
  });
  const componentTerminalPointKeys = getComponentTerminalPointKeys(components);
  const syncLabel = hasCustomLayout ? "Playground wiring drives the sim" : "Loaded program seeded into canvas";
  const selectedPaletteType = selectedComponent?.type ?? null;
  const activeWireColor = selectedWire?.color ?? wireColor;
  const activeWireThickness = selectedWire?.thickness ?? wireThickness;
  const layoutEditingLocked = running;
  const selectedComponentVoltage = selectedComponent
    ? electricalState.componentVoltageById.get(selectedComponent.id) ?? 0
    : 0;
  const selectedComponentTerminals = selectedComponent ? getComponentTerminals(selectedComponent) : [];
  const componentPalettePanel = (
    <section className="builder-card builder-card--components builder-card--components-docked builder-card--components-horizontal">
      <div className="builder-card__title">Components</div>

      <div ref={componentPaletteScrollRef} className="builder-palette-list builder-palette-list--horizontal">
        {instructionPalette.map((instruction) => (
          <button
            key={instruction.type}
            type="button"
            className={`button button--ghost builder-palette-tile builder-palette-tile--horizontal ${selectedPaletteType === instruction.type ? "builder-palette-tile--selected" : ""}`.trim()}
            aria-pressed={selectedPaletteType === instruction.type}
            onMouseDown={(event) => handlePaletteMouseDown(event, instruction)}
            onClick={() => {
              if (paletteDragMovedRef.current) {
                paletteDragMovedRef.current = false;
                return;
              }

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
  );
  const builderStageStatePanel = (
    <aside className="builder-stage__state-panel builder-stage__state-panel--sidebar">
      <div className="builder-stage__state-actions">
        <button
          type="button"
          className={`button ${running ? "button--danger" : "button--primary"} builder-stage__run-button builder-stage__run-button--prominent`.trim()}
          onClick={onRunToggle}
          disabled={runDisabled || fault !== null}
        >
          {running ? "Stop simulator" : "Run simulator"}
        </button>
        {fault && onFaultReset ? (
          <button
            type="button"
            className="button button--ghost builder-stage__run-button builder-stage__run-button--secondary"
            onClick={onFaultReset}
          >
            Reset fault
          </button>
        ) : null}
        <div className="builder-stage__zoom-controls builder-stage__zoom-controls--panel" role="group" aria-label="Canvas zoom">
          <button
            type="button"
            className="button button--ghost builder-stage__zoom-button"
            onClick={() => updateCanvasZoom(canvasZoom - CANVAS_ZOOM_STEP)}
            disabled={canvasZoom <= MIN_CANVAS_ZOOM}
          >
            Zoom out
          </button>
          <span className="status-pill status-pill--neutral builder-stage__zoom-readout">{zoomPercent}%</span>
          <button
            type="button"
            className="button button--ghost builder-stage__zoom-button"
            onClick={() => updateCanvasZoom(canvasZoom + CANVAS_ZOOM_STEP)}
            disabled={canvasZoom >= MAX_CANVAS_ZOOM}
          >
            Zoom in
          </button>
          <button
            type="button"
            className="button button--ghost builder-stage__zoom-button"
            onClick={() => updateCanvasZoom(DEFAULT_CANVAS_ZOOM)}
            disabled={canvasZoom === DEFAULT_CANVAS_ZOOM}
          >
            100%
          </button>
        </div>
      </div>

      <div className="builder-stage__state-copy">
        <div className="builder-stage__status">
          {fault ? (
            <span className="status-pill status-pill--danger">Fault latched</span>
          ) : null}
          <span className={`status-pill ${running ? "status-pill--on" : "status-pill--neutral"}`}>
            {running ? "Running" : "Ready"}
          </span>
          <span className={`status-pill ${isWireAuthoringEnabled ? "status-pill--on" : "status-pill--neutral"}`}>
            {isWireAuthoringEnabled ? "Wire on" : "Wire off"}
          </span>
          <span className={`status-pill ${isPanModeEnabled ? "status-pill--on" : "status-pill--neutral"}`}>
            {isPanModeEnabled ? "Pan on" : "Pan off"}
          </span>
          <span className={`status-pill ${layoutEditingLocked ? "status-pill--danger" : "status-pill--neutral"}`}>
            {layoutEditingLocked ? "Move locked" : "Move ready"}
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
          {fault
            ? "Correct the shorted loop, then reset the fault before running the simulator again."
            : wireReconnectTarget
            ? `Click a terminal or a free point to reconnect the ${wireReconnectTarget.endpoint} end.`
            : hasActiveWireDraft
            ? "Touch a terminal to finish this wire, or click a free point to keep routing it."
            : isPanModeEnabled && isWireAuthoringEnabled
            ? "Drag empty space to pan. Touch a terminal to start a wire."
            : isPanModeEnabled
            ? "Drag empty space to move around the plane. Components still move directly."
            : isWireAuthoringEnabled
            ? "Touch a terminal to start a wire. Drag symbols directly to move them."
            : selectedComponent
            ? `${selectedComponent.label || getComponentName(selectedComponent.type)} selected`
            : selectedWire
              ? `Wire ${selectedWire.color} selected. Drag points to reshape it.`
              : "Select a symbol or wire to edit it."}
        </p>
      </div>
    </aside>
  );

  useEffect(() => {
    if (!running) {
      resolvedPhysicalTagValuesRef.current = {};
      timedContactStateByComponentIdRef.current = {};
      lastElectricalTickRef.current = tick;
      return;
    }

    resolvedPhysicalTagValuesRef.current = { ...electricalState.resolvedTagValues };
    timedContactStateByComponentIdRef.current = { ...electricalState.timedContactStateByComponentId };
    lastElectricalTickRef.current = tick;
  }, [electricalState.resolvedTagValues, electricalState.timedContactStateByComponentId, running, tick]);

  useEffect(() => {
    if (
      !hasCustomLayout
      || !onProgramChange
      || (
        derivedProgramSignature === lastProgramSignature.current
        && builderTagsSignature === lastBuilderTagsSignature.current
      )
    ) {
      return;
    }

    queueCurrentSceneForProgramSync(derivedProgramSignature);
    lastProgramSignature.current = derivedProgramSignature;
    lastBuilderTagsSignature.current = builderTagsSignature;
    onProgramChange(derivedState.program, builderTags);
  }, [builderTags, builderTagsSignature, derivedProgramSignature, derivedState.program, hasCustomLayout, onProgramChange]);

  useEffect(() => {
    if (!running || !onFaultDetected || !electricalState.fault) {
      if (!running || electricalState.fault === null) {
        reportedFaultSignatureRef.current = null;
      }

      return;
    }

    const faultSignature = JSON.stringify(electricalState.fault);

    if (reportedFaultSignatureRef.current === faultSignature) {
      return;
    }

    reportedFaultSignatureRef.current = faultSignature;
    onFaultDetected(electricalState.fault);
  }, [electricalState.fault, onFaultDetected, running]);

  function getNextComponentSpawnPoint(): Point {
    const currentPlaneSettings = planeSettingsRef.current;
    const padding = getComponentPlanePadding(currentPlaneSettings);
    const gridSpacing = currentPlaneSettings.gridSpacing;
    const stageScrollElement = stageScrollRef.current;
    const viewportX = stageScrollElement ? stageScrollElement.scrollLeft / canvasZoom : 0;
    const viewportY = stageScrollElement ? stageScrollElement.scrollTop / canvasZoom : 0;
    const startX = clamp(
      viewportX + gridSpacing * 2,
      padding,
      currentPlaneSettings.width - COMPONENT_WIDTH - padding
    );
    const startY = clamp(
      viewportY + gridSpacing * 3,
      padding,
      currentPlaneSettings.height - COMPONENT_HEIGHT - padding
    );
    const stepX = Math.max(gridSpacing * 8, COMPONENT_WIDTH - gridSpacing * 2);
    const stepY = Math.max(gridSpacing * 6, COMPONENT_HEIGHT - gridSpacing * 3);
    const occupiedRects = componentsRef.current.map((component) => ({
      bottom: component.y + COMPONENT_HEIGHT + gridSpacing,
      left: component.x - gridSpacing,
      right: component.x + COMPONENT_WIDTH + gridSpacing,
      top: component.y - gridSpacing
    }));
    const seen = new Set<string>();
    const maxColumns = Math.max(1, Math.ceil((currentPlaneSettings.width - padding * 2) / stepX));
    const maxRows = Math.max(1, Math.ceil((currentPlaneSettings.height - padding * 2) / stepY));

    for (let row = 0; row < maxRows; row += 1) {
      for (let column = 0; column < maxColumns; column += 1) {
        const candidateX = clamp(
          startX + column * stepX,
          padding,
          currentPlaneSettings.width - COMPONENT_WIDTH - padding
        );
        const candidateY = clamp(
          startY + row * stepY,
          padding,
          currentPlaneSettings.height - COMPONENT_HEIGHT - padding
        );
        const candidateKey = `${candidateX}:${candidateY}`;

        if (seen.has(candidateKey)) {
          continue;
        }

        seen.add(candidateKey);

        const overlapsExistingComponent = occupiedRects.some((rect) => (
          candidateX < rect.right
          && candidateX + COMPONENT_WIDTH > rect.left
          && candidateY < rect.bottom
          && candidateY + COMPONENT_HEIGHT > rect.top
        ));

        if (!overlapsExistingComponent) {
          return { x: candidateX, y: candidateY };
        }
      }
    }

    return { x: startX, y: startY };
  }

  function createComponent(type: BuilderComponentType, point?: Point): BuilderComponent {
    const currentPlaneSettings = planeSettingsRef.current;
    const spawnPoint = point
      ? {
        x: clamp(point.x - COMPONENT_WIDTH / 2, 16, currentPlaneSettings.width - COMPONENT_WIDTH - 16),
        y: clamp(point.y - COMPONENT_HEIGHT / 2, 16, currentPlaneSettings.height - COMPONENT_HEIGHT - 16)
      }
      : getNextComponentSpawnPoint();

    const component = createCanvasComponent(
      nextId,
      builderTags,
      type,
      spawnPoint.x,
      spawnPoint.y
    );

    return point
      ? snapComponentByTerminal(component, point, currentPlaneSettings)
      : snapComponentToPlaneGrid(component, currentPlaneSettings);
  }

  function handlePaletteMouseDown(
    event: ReactMouseEvent<HTMLButtonElement>,
    instruction: { label: string; type: BuilderComponentType }
  ) {
    paletteDragMovedRef.current = false;
    paletteDragState.current = {
      didDrag: false,
      label: instruction.label,
      startX: event.clientX,
      startY: event.clientY,
      type: instruction.type
    };
  }

  function appendDraftPoint(point: Point) {
    setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "wire-start"));
    setDraftWirePoints((currentPoints) => buildNextDraftPoints(currentPoints, point));
  }

  function toggleWireAuthoring() {
    if (isWireAuthoringEnabled) {
      clearWireInteraction();
    }

    setIsWireAuthoringEnabled((currentValue) => !currentValue);
  }

  function togglePanMode() {
    if (isPanModeEnabled) {
      panState.current = null;
      setIsPanning(false);
    }

    dragState.current = null;
    wirePointDragState.current = null;
    setDraggingComponentId(null);
    setIsPanModeEnabled((currentValue) => !currentValue);
  }

  function resetPlaneDraftField(field: keyof typeof planeDraft) {
    setPlaneDraft((currentDraft) => ({
      ...currentDraft,
      [field]: String(planeSettingsRef.current[field])
    }));
  }

  function commitPlaneDraft(field: keyof typeof planeDraft, rawInput = planeDraft[field]) {
    const rawValue = rawInput.trim();
    const numericValue = Number(rawValue);

    if (rawValue === "" || !Number.isFinite(numericValue)) {
      resetPlaneDraftField(field);
      return;
    }

    updatePlaneDimensions({ [field]: numericValue });
  }

  function updatePlaneDimensions(nextPartialSettings: Partial<BuilderPlaneSettings>) {
    if (running) {
      return;
    }

    const previousPlaneSettings = planeSettingsRef.current;
    const nextPlaneSettings = sanitizePlaneSettings({
      ...previousPlaneSettings,
      ...nextPartialSettings
    });

    if (
      nextPlaneSettings.width === previousPlaneSettings.width
      && nextPlaneSettings.height === previousPlaneSettings.height
      && nextPlaneSettings.gridSpacing === previousPlaneSettings.gridSpacing
    ) {
      return;
    }

    const nextScene = nextPlaneSettings.gridSpacing === previousPlaneSettings.gridSpacing
      ? clampSceneBounds(
        { components: componentsRef.current, wires: wiresRef.current },
        nextPlaneSettings
      )
      : requantizeSceneToPlaneGrid(
        { components: componentsRef.current, wires: wiresRef.current },
        previousPlaneSettings,
        nextPlaneSettings
      );
    const resolvedScene = nextPlaneSettings.gridSpacing === previousPlaneSettings.gridSpacing
      ? nextScene
      : reconcileWireTopology(nextScene, nextPlaneSettings).scene;

    planeSettingsRef.current = nextPlaneSettings;
    componentsRef.current = resolvedScene.components;
    wiresRef.current = resolvedScene.wires;
    setPlaneSettings(nextPlaneSettings);
    setComponents(resolvedScene.components);
    setWires(resolvedScene.wires);
    clearWireInteraction();
    setHasCustomLayout(true);
  }

  function updateWirePoints(wireId: string, updatePoints: (points: Point[]) => Point[]) {
    setWires((currentWires) =>
      currentWires.map((wire) => {
        if (wire.id !== wireId) {
          return wire;
        }

        const nextPoints = updatePoints(wire.points);
        return {
          ...wire,
          points: nextPoints.length >= 2 ? cleanWirePath(nextPoints) : wire.points
        };
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
    if (running) {
      return;
    }

    if (draftWirePoints.length > 0 || wireReconnectTarget !== null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    wirePointDragState.current = { pointIndex, wireId };
    setWireReconnectTarget(null);
    setSelection({ kind: "wire", id: wireId });
  }

  function removeWireBendPoint(wireId: string, pointIndex: number) {
    if (running) {
      return;
    }

    updateWirePoints(wireId, (points) => {
      if (points.length <= 2 || isWireEndpointIndex(pointIndex, points.length)) {
        return points;
      }

      return points.filter((_, index) => index !== pointIndex);
    });
  }

  function cutWireSegmentAtPoint(wireId: string, point: Point) {
    if (running) {
      return;
    }

    if (draftWirePoints.length > 0 || wireReconnectTarget !== null) {
      return;
    }

    const currentWires = wiresRef.current;
    const targetWire = currentWires.find((wire) => wire.id === wireId);

    if (!targetWire || targetWire.points.length < 2) {
      return;
    }

    const segmentIndex = findNearestWireSegmentIndex(point, targetWire);

    if (segmentIndex === null) {
      return;
    }

    const cutRange = resolveWireCutRange(targetWire, currentWires, componentsRef.current, segmentIndex);

    if (!cutRange) {
      return;
    }

    const replacementWires = buildCutWireFragments(nextId, targetWire, cutRange);
    const nextWires = currentWires.flatMap((wire) => (wire.id === wireId ? replacementWires : [wire]));
    const nextSelectedWire = replacementWires[0] ?? null;

    wiresRef.current = nextWires;
    setWires(nextWires);
    setWireReconnectTarget(null);
    setSelection(nextSelectedWire ? { kind: "wire", id: nextSelectedWire.id } : null);
    setHasCustomLayout(true);
  }

  function addBendToSelectedWire() {
    if (running) {
      return;
    }

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

      const bendPoint = leftPoint.x === rightPoint.x || leftPoint.y === rightPoint.y
        ? snapPointToGrid(getWireSegmentMidpoint(leftPoint, rightPoint), planeSettingsRef.current)
        : getWireSegmentMidpoint(leftPoint, rightPoint);

      return [
        ...points.slice(0, longestSegmentIndex + 1),
        bendPoint,
        ...points.slice(longestSegmentIndex + 1)
      ];
    });
  }

  function startWireReconnect(endpoint: WireEndpointKey) {
    if (running) {
      return;
    }

    if (!selectedWire) {
      return;
    }

    wirePointDragState.current = null;
    setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "wire-start"));
    setWireReconnectTarget((currentTarget) =>
      currentTarget?.wireId === selectedWire.id && currentTarget.endpoint === endpoint
        ? null
        : { endpoint, wireId: selectedWire.id }
    );
    setSelection({ kind: "wire", id: selectedWire.id });
  }

  function finishWireReconnect(point: Point) {
    if (running) {
      return;
    }

    if (!wireReconnectTarget) {
      return;
    }

    const currentWires = wiresRef.current;
    const snapTarget = resolveSnapTarget(
      point,
      componentsRef.current,
      currentWires,
      planeSettingsRef.current,
      { excludeWireId: wireReconnectTarget.wireId }
    );
    const anchoredWires = snapTarget.wireAnchor
      ? applyWireAnchors(currentWires, [snapTarget.wireAnchor], planeSettingsRef.current)
      : currentWires;
    const nextWires = anchoredWires.map((wire) => {
      if (wire.id !== wireReconnectTarget.wireId || wire.points.length === 0) {
        return wire;
      }

      const endpointIndex = wireReconnectTarget.endpoint === "start" ? 0 : wire.points.length - 1;
      const nextPoints = repositionWireEndpointOrthogonally(
        wire.points,
        endpointIndex,
        snapTarget.point,
        getWireEndpointPreferredAxis(
          wire,
          endpointIndex,
          componentsRef.current,
          snapTarget.point,
          planeSettingsRef.current.gridSpacing * 0.25
        ),
        planeSettingsRef.current.gridSpacing * 0.25
      );

      if (wireReconnectTarget.endpoint === "start") {
        return {
          ...wire,
          points: simplifyWirePoints(nextPoints),
          startPortId: snapTarget.portId
        };
      }

      return {
        ...wire,
        endPortId: snapTarget.portId,
        points: simplifyWirePoints(nextPoints)
      };
    });
    const reconciled = reconcileWireTopology(
      { components: componentsRef.current, wires: nextWires },
      planeSettingsRef.current
    );

    wiresRef.current = reconciled.scene.wires;
    setWires(reconciled.scene.wires);
    setSelection(
      reconciled.scene.wires.some((wire) => wire.id === wireReconnectTarget.wireId)
        ? { kind: "wire", id: wireReconnectTarget.wireId }
        : null
    );
    setHasCustomLayout(true);
    setWireReconnectTarget(null);

    if (reconciled.removedWireIds.length > 0) {
      setCircuitSnapshotStatus(
        `Removed ${reconciled.removedWireIds.length} loose wire(s): ${reconciled.removedWireIds.join(", ")}.`
      );
    }
  }

  function disconnectWireEndpoint(wireId: string, endpoint: WireEndpointKey) {
    if (running) {
      return;
    }

    setWires((currentWires) =>
      currentWires.map((wire) => {
        if (wire.id !== wireId) {
          return wire;
        }

        const detachedPoint = getDetachedWirePoint(wire.points, endpoint, planeSettingsRef.current);

        if (!detachedPoint) {
          return wire;
        }

        const nextPoints = [...wire.points];
        const endpointIndex = endpoint === "start" ? 0 : wire.points.length - 1;
        nextPoints[endpointIndex] = detachedPoint;

        return endpoint === "start"
          ? { ...wire, points: cleanWirePath(nextPoints), startPortId: null }
          : { ...wire, endPortId: null, points: cleanWirePath(nextPoints) };
      })
    );
    setSelection({ kind: "wire", id: wireId });
    setHasCustomLayout(true);
    setWireReconnectTarget(null);
  }

  function reverseSelectedWire() {
    if (running) {
      return;
    }

    if (!selectedWire) {
      return;
    }

    setWires((currentWires) =>
      currentWires.map((wire) =>
        wire.id === selectedWire.id
          ? {
            ...wire,
            endPortId: wire.startPortId,
            points: [...wire.points].reverse(),
            startPortId: wire.endPortId
          }
          : wire
      )
    );
    setSelection({ kind: "wire", id: selectedWire.id });
    setHasCustomLayout(true);
    setWireReconnectTarget(null);
  }

  function simplifySelectedWire() {
    if (running) {
      return;
    }

    if (!selectedWire) {
      return;
    }

    updateWirePoints(selectedWire.id, (points) => simplifyWirePoints(points));
  }

  function simplifyWireById(wireId: string) {
    if (running) {
      return;
    }

    updateWirePoints(wireId, (points) => simplifyWirePoints(points));
  }

  function deleteWireById(wireId: string) {
    if (running) {
      return;
    }

    setWires((currentWires) => currentWires.filter((wire) => wire.id !== wireId));
    setSelection((current) => (current?.kind === "wire" && current.id === wireId ? null : current));
    setWireReconnectTarget(null);
    setHasCustomLayout(true);
  }

  function updateWireColorById(wireId: string, nextColor: string) {
    setWires((currentWires) =>
      currentWires.map((wire) => (wire.id === wireId ? { ...wire, color: nextColor } : wire))
    );
    setHasCustomLayout(true);
  }

  function updateWireThicknessById(wireId: string, nextThickness: number) {
    const resolvedThickness = clampWireThickness(nextThickness);

    setWires((currentWires) =>
      currentWires.map((wire) => (wire.id === wireId ? { ...wire, thickness: resolvedThickness } : wire))
    );
    setHasCustomLayout(true);
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
    setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "canvas-click"));
    setWireMenu(null);

    if (performance.now() < suppressCanvasClickUntilRef.current) {
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

    if (!isWireAuthoringEnabled || draftWirePoints.length === 0) {
      setSelection(null);
      return;
    }

    const point = getCanvasPointFromClient(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    if (isWireOriginHit(draftWirePoints, point)) {
      clearWireInteraction();
      return;
    }

    const snapTarget = resolveSnapTarget(point, components, wires, planeSettings, {
      allowWireAnchor: true
    });

    if (snapTarget.wireAnchor) {
      commitWireFromPoints(buildNextDraftPoints(draftWirePoints, point));
      return;
    }

    appendDraftPoint(point);
  }

  function handleCanvasContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "canvas-click"));
    setWireMenu(null);

    const action = resolveCanvasContextMenuAction({
      draftPointCount: draftWirePoints.length,
      hasReconnectTarget: wireReconnectTarget !== null
    });

    if (action !== "cancel-wire") {
      return;
    }

    event.preventDefault();
    clearWireInteraction();
    setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "wire-start"));
  }

  function handleCanvasMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    if (!isWirePointerPreviewVisible) {
      if (cursorPoint !== null) {
        setCursorPoint(null);
      }
      return;
    }

    const point = getCanvasPointFromClient(event.clientX, event.clientY);

    if (point) {
      setCursorPoint(resolveSnapTarget(point, components, wires, planeSettings, {
        allowWireAnchor: true,
        ...(wireReconnectTarget ? { excludeWireId: wireReconnectTarget.wireId } : {})
      }).point);
    }
  }

  function handleFinishWire() {
    commitWireFromPoints(draftWirePoints);
  }

  function deleteComponentById(componentId: string) {
    const nextComponents = componentsRef.current.filter((component) => component.id !== componentId);
    const reconciled = reconcileWireTopology(
      { components: nextComponents, wires: wiresRef.current },
      planeSettingsRef.current
    );

    componentsRef.current = reconciled.scene.components;
    wiresRef.current = reconciled.scene.wires;
    setComponents(reconciled.scene.components);
    setWires(reconciled.scene.wires);
    setHasCustomLayout(true);

    if (reconciled.removedWireIds.length > 0) {
      setCircuitSnapshotStatus(
        `Removed ${reconciled.removedWireIds.length} loose wire(s): ${reconciled.removedWireIds.join(", ")}.`
      );
    }
  }

  function handleDeleteSelection() {
    if (running || !selection) {
      return;
    }

    if (selection.kind === "component") {
      deleteComponentById(selection.id);
    } else {
      setWires((currentWires) => currentWires.filter((wire) => wire.id !== selection.id));
    }

    setWireReconnectTarget(null);
    setSelection(null);
    setHasCustomLayout(true);
  }

  function duplicateComponent(componentId: string) {
    const sourceComponent = componentsRef.current.find((component) => component.id === componentId);

    if (!sourceComponent) {
      return;
    }

    const duplicated = buildDuplicatedComponent(sourceComponent, nextId.current, planeSettingsRef.current);
    nextId.current += 1;

    componentsRef.current = [...componentsRef.current, duplicated];
    setComponents(componentsRef.current);
    setSelection({ kind: "component", id: duplicated.id });
    setHasCustomLayout(true);
  }

  function startComponentLabelEdit(componentId: string) {
    setComponentMenu((menu) => (menu && menu.componentId === componentId ? { ...menu, editingLabel: true } : null));
  }

  function applyComponentLabelEdit(componentId: string, nextLabel: string) {
    handlePlaneLabelChange(componentId, nextLabel);
    handlePlaneLabelBlur(componentId);
    setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "action-run"));
  }

  function handleResetCanvas() {
    if (running) {
      return;
    }

    pendingLoadedSceneRef.current = null;
    nextId.current = 0;
    const nextScene = buildSceneFromProgram(nextId, builderTags, program);

    setComponents(nextScene.components);
    setWires(nextScene.wires);
    clearWireInteraction();
    setSelection(null);
    setIsWireAuthoringEnabled(true);
    setIsPanModeEnabled(true);
    setIsPanning(false);
    panState.current = null;
    dragState.current = null;
    wirePointDragState.current = null;
    setHasCustomLayout(true);
  }

  function handleSaveCircuit() {
    const reconciled = reconcileWireTopology(
      { components: componentsRef.current, wires: wiresRef.current },
      planeSettingsRef.current
    );
    const nextDerivedState = deriveProgram(reconciled.scene.components, reconciled.scene.wires);
    const snapshot = createCircuitSnapshot(
      reconciled.scene.components,
      reconciled.scene.wires,
      nextDerivedState.program,
      builderTags,
      scanIntervalMs,
      planeSettingsRef.current,
      sheetMetadata
    );

    componentsRef.current = reconciled.scene.components;
    wiresRef.current = reconciled.scene.wires;
    setComponents(reconciled.scene.components);
    setWires(reconciled.scene.wires);
    downloadCircuitSnapshot(snapshot);
    setCircuitSnapshotStatus(
      reconciled.removedWireIds.length > 0
        ? `Saved ${snapshot.name}. Removed ${reconciled.removedWireIds.length} loose wire(s).`
        : `Saved ${snapshot.name}.`
    );
  }

  function handleLoadCircuitClick() {
    circuitFileInputRef.current?.click();
  }

  async function handleLoadCircuitChange(event: ReactChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const snapshot = await readCircuitSnapshotFile(file);
      const nextPlaneSettings = sanitizePlaneSettings({
        gridSpacing: snapshot.settings.gridSpacing,
        height: snapshot.settings.height,
        width: snapshot.settings.width
      });
      const clampedScene = clampSceneToPlane(
        cloneScene({ components: snapshot.components, wires: snapshot.wires }),
        nextPlaneSettings
      );
      const reconciled = reconcileWireTopology(clampedScene, nextPlaneSettings);
      const nextScene = reconciled.scene;
      const nextDerivedState = deriveProgram(nextScene.components, nextScene.wires);
      const nextProgramSignature = JSON.stringify(nextDerivedState.program);
      const nextTags = mergeInstructionBindingTags(snapshot.tags, nextScene.components);
      const nextSnapshot = { ...snapshot, program: nextDerivedState.program, tags: nextTags };

      pendingLoadedSceneRef.current = {
        planeSettings: nextPlaneSettings,
        scene: cloneScene(nextScene),
        signature: nextProgramSignature
      };

      applySceneState(nextScene, nextProgramSignature, true, nextPlaneSettings);
      setSheetMetadata(snapshot.sheet);
      setCircuitSnapshotStatus(`Loaded ${snapshot.name}.`);

      if (onCircuitLoad) {
        onCircuitLoad(nextSnapshot);
      } else if (onProgramChange) {
        onProgramChange(nextDerivedState.program, nextTags);
      }
    } catch (error) {
      setCircuitSnapshotStatus(
        error instanceof Error ? error.message : "Failed to load the selected circuit file."
      );
    }
  }

  function handleStageScrollMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (!isPanModeEnabled || !stageScrollRef.current || event.button !== 0) {
      return;
    }

    const eventTarget = event.target;

    if (
      eventTarget instanceof Element
      && eventTarget.closest(
        ".freeplay-component, .freeplay-wire, .freeplay-component-menu, .freeplay-wire-menu, .freeplay-port, .freeplay-wire__node, .freeplay-wire__hit, input, textarea, select, option, button"
      )
    ) {
      return;
    }

    event.preventDefault();
    didPanDuringMouseDownRef.current = false;
    panState.current = {
      scrollLeft: stageScrollRef.current.scrollLeft,
      scrollTop: stageScrollRef.current.scrollTop,
      startX: event.clientX,
      startY: event.clientY
    };
    setIsPanning(true);
  }

  function handleComponentHandleMouseDown(event: ReactMouseEvent<HTMLDivElement>, componentId: string) {
    if (running || event.button !== 0) {
      componentDragMovedRef.current = false;
      return;
    }

    if (activeComponentDragPointerRef.current) {
      return;
    }

    if (draftWirePoints.length > 0 || wireReconnectTarget !== null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    componentDragMovedRef.current = false;
    setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "drag-start"));

    const component = components.find((entry) => entry.id === componentId);
    const point = getCanvasPointFromClient(event.clientX, event.clientY);

    if (!component || !point) {
      return;
    }

    dragState.current = {
      componentId,
      offsetX: point.x - component.x,
      offsetY: point.y - component.y,
      pointerPoint: point
    };
    setDraggingComponentId(componentId);
    setSelection({ kind: "component", id: componentId });
  }

  function handleComponentHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>, componentId: string) {
    handleComponentHandleMouseDown(event, componentId);

    if (dragState.current?.componentId !== componentId) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    activeComponentDragPointerRef.current = { componentId, pointerId: event.pointerId };
  }

  function handleComponentHandlePointerMove(event: ReactPointerEvent<HTMLDivElement>, componentId: string) {
    if (
      activeComponentDragPointerRef.current?.componentId !== componentId
      || activeComponentDragPointerRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    dragComponentToClientPoint(componentId, event.clientX, event.clientY);
  }

  function handleComponentHandlePointerRelease(event: ReactPointerEvent<HTMLDivElement>, componentId: string) {
    if (
      activeComponentDragPointerRef.current?.componentId !== componentId
      || activeComponentDragPointerRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    activeComponentDragPointerRef.current = null;
    finalizeComponentDrag(componentId);
  }

  function handleComponentHandleLostCapture(componentId: string) {
    if (activeComponentDragPointerRef.current?.componentId !== componentId) {
      return;
    }

    activeComponentDragPointerRef.current = null;
    finalizeComponentDrag(componentId);
  }

  function handlePlaneLabelChange(componentId: string, nextLabel: string) {
    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === componentId
          ? (() => {
            if (!componentNeedsTag(component.type)) {
              return { ...component, label: nextLabel, usesCustomLabel: true };
            }

            const normalizedLabel = normalizeInstructionLabel(nextLabel);
            const nextTag = normalizedLabel !== ""
              ? createGeneratedInstructionTag(normalizedLabel)
              : component.tag;

            return {
              ...component,
              label: nextLabel,
              tag: nextTag,
              usesCustomLabel: true
            };
          })()
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

        const trimmedLabel = normalizeInstructionLabel(component.label);

        if (trimmedLabel !== "") {
          if (!componentNeedsTag(component.type)) {
            return trimmedLabel === component.label ? component : { ...component, label: trimmedLabel };
          }

          const nextTag = createGeneratedInstructionTag(trimmedLabel);

          if (trimmedLabel === component.label && nextTag === component.tag) {
            return component;
          }

          return {
            ...component,
            label: trimmedLabel,
            tag: nextTag
          };
        }

        const defaultLabel = getDefaultComponentLabel(component.type, builderTags, component.tag);

        if (!componentNeedsTag(component.type)) {
          return {
            ...component,
            label: defaultLabel,
            usesCustomLabel: false
          };
        }

        return {
          ...component,
          label: defaultLabel,
          tag: component.tag ?? createGeneratedInstructionTag(defaultLabel),
          usesCustomLabel: false
        };
      })
    );
  }

  function handleTerminalLabelChange(componentId: string, terminalId: string, nextLabel: string) {
    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === componentId
          ? {
            ...component,
            terminalLabels: {
              ...(component.terminalLabels ?? {}),
              [terminalId]: nextLabel
            }
          }
          : component
      )
    );
    setHasCustomLayout(true);
  }

  function handleTerminalLabelBlur(componentId: string, terminalId: string) {
    setComponents((currentComponents) =>
      currentComponents.map((component) => {
        if (component.id !== componentId) {
          return component;
        }

        const terminalDefinition = getTerminalDefinition(component.type, terminalId);

        if (!terminalDefinition) {
          return component;
        }

        const currentLabel = component.terminalLabels?.[terminalId] ?? "";
        const trimmedLabel = currentLabel.trim();

        if (trimmedLabel === "" || trimmedLabel === terminalDefinition.label) {
          if (!component.terminalLabels || !(terminalId in component.terminalLabels)) {
            return component;
          }

          const nextTerminalLabels = { ...component.terminalLabels };
          delete nextTerminalLabels[terminalId];

          return {
            ...component,
            terminalLabels: Object.keys(nextTerminalLabels).length > 0 ? nextTerminalLabels : undefined
          };
        }

        if (trimmedLabel === currentLabel) {
          return component;
        }

        return {
          ...component,
          terminalLabels: {
            ...(component.terminalLabels ?? {}),
            [terminalId]: trimmedLabel
          }
        };
      })
    );
  }

  function rotateComponent(componentId: string, direction: -1 | 1) {
    if (running) {
      return;
    }

    const currentComponent = componentsRef.current.find((component) => component.id === componentId);

    if (!currentComponent) {
      return;
    }

    const nextComponent = snapComponentToPlaneGrid(
      {
        ...currentComponent,
        rotation: normalizeQuarterTurns(currentComponent.rotation + direction)
      },
      planeSettingsRef.current
    );

    const nextComponents = componentsRef.current.map((component) =>
      component.id === componentId ? nextComponent : component
    );
    // Al rotar, los cables NO siguen: los que quedarian sueltos se eliminan
    // para no dejar conexiones falsas ni cables desalineados.
    const remainingWires = removeWiresAttachedToComponent(currentComponent, wiresRef.current);
    const reconciled = reconcileWireTopology(
      { components: nextComponents, wires: remainingWires },
      planeSettingsRef.current
    );

    componentsRef.current = reconciled.scene.components;
    wiresRef.current = reconciled.scene.wires;
    setComponents(reconciled.scene.components);
    setWires(reconciled.scene.wires);
    setHasCustomLayout(true);
  }

  function cancelPendingSwitchToggle(componentId?: string) {
    if (!pendingSwitchToggleRef.current) {
      return;
    }

    if (componentId && pendingSwitchToggleRef.current.componentId !== componentId) {
      return;
    }

    window.clearTimeout(pendingSwitchToggleRef.current.timeoutId);
    pendingSwitchToggleRef.current = null;
  }

  function scheduleMaintainedSwitchToggle(componentId: string) {
    cancelPendingSwitchToggle();

    pendingSwitchToggleRef.current = {
      componentId,
      timeoutId: window.setTimeout(() => {
        pendingSwitchToggleRef.current = null;
        toggleMaintainedSwitch(componentId);
      }, MAINTAINED_SWITCH_CLICK_DELAY_MS)
    };
  }

  function toggleMaintainedSwitch(componentId: string) {
    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === componentId && isMaintainedSwitchType(component.type)
          ? { ...component, isClosed: !isMaintainedSwitchClosed(component) }
          : component
      )
    );
    setSelection({ kind: "component", id: componentId });
    setHasCustomLayout(true);
  }

  function pressMomentaryPushButton(componentId: string) {
    setComponents((currentComponents) => applyMomentaryPress(currentComponents, componentId));
    setSelection({ kind: "component", id: componentId });
  }

  function releaseMomentaryPushButton(componentId: string) {
    setComponents((currentComponents) => applyMomentaryRelease(currentComponents, componentId));
  }

  function handlePushButtonPointerDown(event: ReactPointerEvent<HTMLButtonElement>, componentId: string) {
    event.preventDefault();
    event.stopPropagation();
    setWireReconnectTarget(null);
    setSelection({ kind: "component", id: componentId });
    componentDragMovedRef.current = false;

    const component = componentsRef.current.find((entry) => entry.id === componentId);
    const point = getCanvasPointFromClient(event.clientX, event.clientY);

    if (!running && component && point) {
      dragState.current = {
        componentId,
        offsetX: point.x - component.x,
        offsetY: point.y - component.y,
        pointerPoint: point
      };
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    activePushButtonPressRef.current = { componentId, pointerId: event.pointerId };

    // El E-stop no se acciona al presionar el pointer: enclava en el click
    // limpio (pointer up sin arrastre), para que seleccionar o mover el
    // componente no dispare el paro de emergencia.
    if (component?.type !== "ESTOP") {
      pressMomentaryPushButton(componentId);
    }
  }

  function handlePushButtonPointerMove(event: ReactPointerEvent<HTMLButtonElement>, componentId: string) {
    if (
      activePushButtonPressRef.current?.componentId !== componentId
      || activePushButtonPressRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    dragComponentToClientPoint(componentId, event.clientX, event.clientY);
  }

  function handlePushButtonPointerRelease(event: ReactPointerEvent<HTMLButtonElement>, componentId: string) {
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (
      activePushButtonPressRef.current?.componentId === componentId
      && activePushButtonPressRef.current.pointerId === event.pointerId
    ) {
      activePushButtonPressRef.current = null;
    }

    const wasDragged = componentDragMovedRef.current;
    finalizeComponentDrag(componentId);
    componentDragMovedRef.current = false;

    const component = componentsRef.current.find((entry) => entry.id === componentId);

    if (component?.type === "ESTOP") {
      // Click limpio = accionar/liberar el enclavamiento; arrastre = solo mover.
      if (!wasDragged) {
        pressMomentaryPushButton(componentId);
      }

      return;
    }

    releaseMomentaryPushButton(componentId);
  }

  function handlePushButtonLostCapture(componentId: string) {
    if (activePushButtonPressRef.current?.componentId === componentId) {
      activePushButtonPressRef.current = null;
    }

    finalizeComponentDrag(componentId);
    componentDragMovedRef.current = false;
    releaseMomentaryPushButton(componentId);
  }

  function handleSelectedSourceVoltageChange(nextVoltage: number) {
    if (!selectedComponent || !isSourceType(selectedComponent.type)) {
      return;
    }

    const resolvedVoltage = Number.isFinite(nextVoltage)
      ? clamp(Math.round(nextVoltage), 1, 600)
      : getDefaultSourceVoltage(selectedComponent.type);

    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === selectedComponent.id
          ? { ...component, sourceVoltage: resolvedVoltage }
          : component
      )
    );
    setHasCustomLayout(true);
  }

  function handleSelectedTimedContactDelayChange(nextDelaySeconds: number) {
    if (!selectedComponent || !isTimedContactType(selectedComponent.type)) {
      return;
    }

    const resolvedDelayMs = Number.isFinite(nextDelaySeconds)
      ? clampTimedContactDelayMs(nextDelaySeconds * 1000)
      : DEFAULT_TIMED_CONTACT_DELAY_MS;

    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === selectedComponent.id
          ? { ...component, delayMs: resolvedDelayMs }
          : component
      )
    );
    setHasCustomLayout(true);
  }

  function handleSelectedLampGlowColorChange(nextLampGlowColor: string) {
    if (!selectedComponent || selectedComponent.type !== "LAMP") {
      return;
    }

    const resolvedLampGlowColor = LAMP_GLOW_COLOR_OPTIONS.some((option) => option.value === nextLampGlowColor)
      ? nextLampGlowColor as LampGlowColorOption
      : DEFAULT_LAMP_GLOW_COLOR;

    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === selectedComponent.id
          ? { ...component, lampGlowColor: resolvedLampGlowColor }
          : component
      )
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
          <section className="builder-card builder-card--tools">
            <div className="builder-card__title">Tools</div>

            <div className="builder-mode-switch" role="group" aria-label="Playground interaction">
              <span className="status-pill status-pill--neutral">Move ready</span>
              <button
                type="button"
                className={`button ${isPanModeEnabled ? "button--primary" : "button--ghost"} builder-mode-button`.trim()}
                onClick={togglePanMode}
              >
                {isPanModeEnabled ? "Pan on" : "Pan off"}
              </button>
              <button
                type="button"
                className={`button ${isWireAuthoringEnabled ? "button--primary" : "button--ghost"} builder-mode-button`.trim()}
                onClick={toggleWireAuthoring}
              >
                {isWireAuthoringEnabled ? "Wire on" : "Wire off"}
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
                    step="0.5"
                    className="builder-slider-input"
                    value={activeWireThickness}
                    onChange={(event) => updateWireThickness(Number(event.target.value))}
                  />
                  <strong className="builder-slider-value">{activeWireThickness}px</strong>
                </div>
              </label>
            </div>

            <div className="builder-wire-settings">
              <p className="builder-wire-settings__label">Plane settings</p>

              <label className="builder-slider-field">
                <span className="field__label">Width</span>
                <input
                  type="number"
                  min={MIN_PLANE_WIDTH}
                  max={MAX_PLANE_WIDTH}
                  step="40"
                  className="builder-number-input"
                  value={planeDraft.width}
                  disabled={layoutEditingLocked}
                  onChange={(event) => setPlaneDraft((current) => ({ ...current, width: event.target.value }))}
                  onBlur={(event) => commitPlaneDraft("width", event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      event.currentTarget.value = String(planeSettingsRef.current.width);
                      resetPlaneDraftField("width");
                      event.currentTarget.blur();
                    }
                  }}
                />
              </label>

              <label className="builder-slider-field">
                <span className="field__label">Height</span>
                <input
                  type="number"
                  min={MIN_PLANE_HEIGHT}
                  max={MAX_PLANE_HEIGHT}
                  step="40"
                  className="builder-number-input"
                  value={planeDraft.height}
                  disabled={layoutEditingLocked}
                  onChange={(event) => setPlaneDraft((current) => ({ ...current, height: event.target.value }))}
                  onBlur={(event) => commitPlaneDraft("height", event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      event.currentTarget.value = String(planeSettingsRef.current.height);
                      resetPlaneDraftField("height");
                      event.currentTarget.blur();
                    }
                  }}
                />
              </label>

              <label className="builder-slider-field">
                <span className="field__label">Grid spacing</span>
                <input
                  type="number"
                  min={MIN_GRID_SPACING}
                  max={MAX_GRID_SPACING}
                  step="2"
                  className="builder-number-input"
                  value={planeDraft.gridSpacing}
                  disabled={layoutEditingLocked}
                  onChange={(event) => setPlaneDraft((current) => ({ ...current, gridSpacing: event.target.value }))}
                  onBlur={(event) => commitPlaneDraft("gridSpacing", event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      event.currentTarget.value = String(planeSettingsRef.current.gridSpacing);
                      resetPlaneDraftField("gridSpacing");
                      event.currentTarget.blur();
                    }
                  }}
                />
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
                onClick={clearWireInteraction}
                disabled={draftWirePoints.length === 0 && wireReconnectTarget === null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={handleDeleteSelection}
                disabled={layoutEditingLocked || selection === null}
              >
                Delete
              </button>
              <button type="button" className="button button--ghost" onClick={handleResetCanvas} disabled={layoutEditingLocked}>
                Reset
              </button>
              <button type="button" className="button button--secondary" onClick={handleLoadCircuitClick}>
                Load circuit
              </button>
              <button type="button" className="button button--secondary" onClick={handleSaveCircuit}>
                Save circuit
              </button>
            </div>

            <input
              ref={circuitFileInputRef}
              type="file"
              accept=".circuit.json,.json,application/json"
              hidden
              onChange={handleLoadCircuitChange}
            />

            <p className="builder-card__copy">{syncLabel}</p>
            {circuitSnapshotStatus ? <p className="builder-card__copy">{circuitSnapshotStatus}</p> : null}
          </section>

          <section className="builder-card builder-card--sheet">
            <div className="builder-card__title">Sheet</div>

            <label className="builder-slider-field">
              <span className="field__label">Project</span>
              <input
                type="text"
                className="builder-number-input"
                maxLength={44}
                value={sheetMetadata.projectName}
                onChange={(event) => setSheetMetadata((current) => ({ ...current, projectName: event.target.value }))}
              />
            </label>

            <label className="builder-slider-field">
              <span className="field__label">Date</span>
              <input
                type="text"
                className="builder-number-input"
                maxLength={10}
                placeholder="YYYY-MM-DD"
                value={sheetMetadata.date}
                onChange={(event) => setSheetMetadata((current) => ({ ...current, date: event.target.value }))}
              />
            </label>

            <label className="builder-slider-field">
              <span className="field__label">Scale</span>
              <input
                type="text"
                className="builder-number-input"
                maxLength={12}
                value={sheetMetadata.scale}
                onChange={(event) => setSheetMetadata((current) => ({ ...current, scale: event.target.value }))}
              />
            </label>

            <label className="builder-slider-field">
              <span className="field__label">Page</span>
              <input
                type="text"
                className="builder-number-input"
                maxLength={6}
                value={sheetMetadata.page}
                onChange={(event) => setSheetMetadata((current) => ({ ...current, page: event.target.value }))}
              />
            </label>
          </section>

          <div className="builder-right-rail">
            {builderStageStatePanel}

            <section className={`builder-card builder-card--properties ${selection ? "builder-card--active" : ""}`.trim()}>
              <div className="builder-card__title">Properties</div>

              {selectedComponent ? (
                <>
                  <div className="builder-props-grid">
                    <span className="builder-props-label">Symbol</span>
                    <strong className="builder-props-value">{getComponentName(selectedComponent.type)}</strong>
                    <span className="builder-props-label">{componentNeedsTag(selectedComponent.type) ? "Logic label" : "Plane name"}</span>
                    <strong className="builder-props-value">{selectedComponent.label || "(unnamed)"}</strong>
                    <span className="builder-props-label">Terminals</span>
                    <strong className="builder-props-value">{getTerminalCount(selectedComponent.type)}</strong>
                    <span className="builder-props-label">Rotation</span>
                    <strong className="builder-props-value">{normalizeQuarterTurns(selectedComponent.rotation) * 90}deg</strong>
                    {isTimedContactType(selectedComponent.type) ? (
                      <>
                        <span className="builder-props-label">Delay</span>
                        <strong className="builder-props-value">{formatTimedContactDelaySeconds(getTimedContactDelayMs(selectedComponent))}s</strong>
                      </>
                    ) : null}
                    {isSourceType(selectedComponent.type) ? (
                      <>
                        <span className="builder-props-label">Current</span>
                        <strong className="builder-props-value">{getSourceCurrentType(selectedComponent.type)?.toUpperCase()}</strong>
                        <span className="builder-props-label">Voltage</span>
                        <strong className="builder-props-value">{formatSourceVoltage(selectedComponent)}</strong>
                      </>
                    ) : null}
                    {isBreakerType(selectedComponent.type) || isMaintainedSwitchType(selectedComponent.type) ? (
                      <>
                        <span className="builder-props-label">State</span>
                        <strong className="builder-props-value">
                          {isMaintainedSwitchType(selectedComponent.type)
                            ? (isMaintainedSwitchClosed(selectedComponent) ? "Closed" : "Open")
                            : "Closed"}
                        </strong>
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
                    disabled={layoutEditingLocked}
                  >
                    Rotate -90
                  </button>
                  <button
                    type="button"
                    className="button button--ghost builder-selection__action-button"
                    onClick={() => rotateComponent(selectedComponent.id, 1)}
                    disabled={layoutEditingLocked}
                  >
                    Rotate +90
                  </button>
                </div>

                <div className="builder-properties-fields">
                  <label className="builder-slider-field">
                    <span className="field__label">{componentNeedsTag(selectedComponent.type) ? "Logic label" : "Component label"}</span>
                    <input
                      type="text"
                      className="builder-text-input"
                      spellCheck={false}
                      value={selectedComponent.label}
                      onBlur={() => handlePlaneLabelBlur(selectedComponent.id)}
                      onChange={(event) => handlePlaneLabelChange(selectedComponent.id, event.target.value)}
                    />
                  </label>

                  {isTimedContactType(selectedComponent.type) ? (
                    <label className="builder-slider-field">
                      <span className="field__label">On-delay time (s)</span>
                      <input
                        type="number"
                        min="0"
                        max={String(MAX_TIMED_CONTACT_DELAY_MS / 1000)}
                        step="0.1"
                        className="builder-number-input"
                        value={formatTimedContactDelaySeconds(getTimedContactDelayMs(selectedComponent))}
                        onChange={(event) => handleSelectedTimedContactDelayChange(Number(event.target.value))}
                      />
                    </label>
                  ) : null}


                  <div className="builder-terminal-fields">
                    <span className="field__label">Terminal labels</span>
                    <div className="builder-terminal-fields__grid">
                      {selectedComponentTerminals.map((terminal) => (
                        <label key={`${terminal.portId}-pane`} className="builder-terminal-field">
                          <span className="builder-terminal-field__label">
                            {formatTerminalLabel(terminal.terminalId)}
                          </span>
                          <input
                            type="text"
                            className="builder-text-input"
                            spellCheck={false}
                            placeholder={terminal.defaultLabel}
                            value={selectedComponent.terminalLabels?.[terminal.terminalId] ?? terminal.label}
                            onBlur={() => handleTerminalLabelBlur(selectedComponent.id, terminal.terminalId)}
                            onChange={(event) => handleTerminalLabelChange(selectedComponent.id, terminal.terminalId, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {isSourceType(selectedComponent.type) ? (
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

                {selectedComponent.type === "LAMP" ? (
                  <label className="builder-slider-field">
                    <span className="field__label">Lamp glow</span>
                    <select
                      className="builder-select-input"
                      value={selectedComponent.lampGlowColor ?? DEFAULT_LAMP_GLOW_COLOR}
                      onChange={(event) => handleSelectedLampGlowColorChange(event.target.value)}
                    >
                      {LAMP_GLOW_COLOR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {isMaintainedSwitchType(selectedComponent.type) ? (
                  <button
                    type="button"
                    className={`button ${isMaintainedSwitchClosed(selectedComponent) ? "button--secondary" : "button--primary"} builder-selection__action-button`.trim()}
                    onClick={() => toggleMaintainedSwitch(selectedComponent.id)}
                  >
                    {isMaintainedSwitchClosed(selectedComponent) ? "Open switch" : "Close switch"}
                  </button>
                ) : null}

                {isTimedContactType(selectedComponent.type) ? (
                  <p className="builder-card__copy">
                    Set the on-delay here. Matching OTE and timed-contact labels share the same boolean tag,
                    but each timed contact keeps its own local preset and elapsed state.
                  </p>
                ) : componentNeedsTag(selectedComponent.type) ? (
                  <p className="builder-card__copy">
                    Rename and recolor the symbol here. Matching OTE, XIC, XIO, NOTC, and NCTO labels now share the
                    same internal logic state automatically.
                  </p>
                ) : isSourceType(selectedComponent.type) ? (
                  <p className="builder-card__copy">
                    {getSourceCurrentType(selectedComponent.type) === "ac"
                      ? "Set the AC source voltage here. Closed loops energize from both source sides."
                      : "Set the DC source voltage here. Closed loops energize with the DC feed."}
                  </p>
                ) : isBreakerType(selectedComponent.type) ? (
                  <p className="builder-card__copy">
                    This breaker stays closed and only rotates on the sheet.
                  </p>
                ) : isMaintainedSwitchType(selectedComponent.type) ? (
                  <p className="builder-card__copy">
                    Single-click the switch on the sheet to toggle continuity. Double-click it to rotate.
                  </p>
                ) : isMomentaryPushButtonType(selectedComponent.type) ? (
                  <p className="builder-card__copy">
                    {selectedComponent.type === "PUSH_BUTTON_NC" || selectedComponent.type === "ESTOP"
                      ? "Hold the push button cap on the sheet to open it momentarily. Releasing it closes the path again."
                      : "Hold the push button cap on the sheet to close it momentarily. Releasing it opens the path again."}
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

                <p className="builder-card__copy">
                  Double-click a symbol to rotate it. Breakers toggle on single-click and rotate on double-click.
                </p>
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
                            disabled={layoutEditingLocked}
                          >
                            {reconnecting ? "Pick point" : "Reconnect"}
                          </button>
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => disconnectWireEndpoint(selectedWire.id, endpointKey)}
                            disabled={layoutEditingLocked || !endpoint?.port}
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="builder-wire-actions">
                  <button type="button" className="button button--ghost" onClick={addBendToSelectedWire} disabled={layoutEditingLocked}>
                    Add bend
                  </button>
                  <button type="button" className="button button--ghost" onClick={reverseSelectedWire} disabled={layoutEditingLocked}>
                    Reverse route
                  </button>
                  <button type="button" className="button button--ghost" onClick={simplifySelectedWire} disabled={layoutEditingLocked}>
                    Simplify path
                  </button>
                </div>

                <p className="builder-card__copy">
                  {selectedWireStatus?.description ?? "Adjust color and thickness in Tools."} Drag any wire point to reshape it, double-click a bend point to remove it, or double-click a wire segment to cut that span.
                </p>
              </>
              ) : (
                <p className="builder-card__copy">Select a symbol or wire to inspect and adjust it.</p>
              )}
            </section>
          </div>
        </aside>

        <div className="builder-stage">
          <div className="builder-stage__top-row">
            {componentPalettePanel}
          </div>

          <div
            ref={stageScrollRef}
            className={`builder-stage__scroll ${isPanModeEnabled ? "builder-stage__scroll--pan" : ""} ${isPanning ? "builder-stage__scroll--panning" : ""}`.trim()}
            onMouseDownCapture={handleStageScrollMouseDown}
          >
            <div
              className="freeplay-canvas-viewport"
              style={canvasViewportStyle}
            >
              <div
                ref={canvasRef}
                className={`freeplay-canvas ${isWirePointerPreviewVisible ? "freeplay-canvas--wire" : ""} ${isPanModeEnabled ? "freeplay-canvas--pan" : ""} ${isPanning ? "freeplay-canvas--panning" : ""}`.trim()}
                style={canvasStyle}
                onClick={handleCanvasClick}
                onContextMenu={handleCanvasContextMenu}
                onMouseLeave={() => setCursorPoint(null)}
                onMouseMove={handleCanvasMouseMove}
              >
                <div className="freeplay-plane-overlay" aria-hidden="true">
                  <div className="freeplay-axis freeplay-axis--x">
                    <span className="freeplay-axis__label freeplay-axis__label--x">X</span>
                  </div>
                  <div className="freeplay-axis freeplay-axis--y">
                    <span className="freeplay-axis__label freeplay-axis__label--y">Y</span>
                  </div>
                  <div className="freeplay-plane-origin">0,0</div>
                </div>

                <svg
                  className="freeplay-svg"
                  viewBox={`0 0 ${planeSettings.width} ${planeSettings.height}`}
                  preserveAspectRatio="none"
                  shapeRendering="geometricPrecision"
                  style={{ height: planeSettings.height, width: planeSettings.width }}
                  aria-hidden="true"
                >
                  <SheetLayer planeSettings={planeSettings} sheet={sheetMetadata} />
                  {resolvedWires.map((wire) => {
                  const pointString = wire.points.map((point) => `${point.x},${point.y}`).join(" ");
                  const wireHops = findWireCrossings(wire, resolvedWires);
                  const wirePathD = buildWirePathD(wire.points, wireHops);
                  const isSelected = selection?.kind === "wire" && selection.id === wire.id;
                  const isEnergized = running && electricalState.energizedWireIds.has(wire.id);
                  const idleCurrentType = electricalState.idleWireCurrentById.get(wire.id) ?? null;
                  const isIdle = running && !isEnergized && idleCurrentType !== null;
                  const energizedCurrentType = electricalState.energizedWireCurrentById.get(wire.id) ?? "ac";
                  const strokeWidth = isSelected ? wire.thickness + 0.75 : wire.thickness;
                  const hitStrokeWidth = Math.max(18, wire.thickness + 10);

                  return (
                    <g key={wire.id}>
                      <path
                        className={`freeplay-wire ${isSelected ? "freeplay-wire--selected" : ""}`.trim()}
                        d={wirePathD}
                        stroke={wire.color}
                        style={{ strokeWidth }}
                      />
                      {isEnergized ? (
                        <path
                          className={`freeplay-wire freeplay-wire--energized freeplay-wire--energized-${energizedCurrentType}`.trim()}
                          d={wirePathD}
                          style={{ strokeWidth: wire.thickness + 1 }}
                        />
                      ) : isIdle ? (
                        <path
                          className={`freeplay-wire freeplay-wire--idle freeplay-wire--idle-${idleCurrentType}`.trim()}
                          d={wirePathD}
                          style={{ strokeWidth: wire.thickness + 0.8 }}
                        />
                      ) : null}
                      <polyline
                        className="freeplay-wire__hit"
                        points={pointString}
                        style={{ strokeWidth: hitStrokeWidth }}
                        onClick={(event) => {
                          event.stopPropagation();

                          const point = getCanvasPointFromClient(event.clientX, event.clientY);

                          if (point && wireReconnectTarget) {
                            finishWireReconnect(point);
                            return;
                          }

                          if (point && draftWirePoints.length > 0) {
                            commitWireFromPoints(buildNextDraftPoints(draftWirePoints, point));
                            return;
                          }

                          setWireReconnectTarget(null);
                          setSelection({ kind: "wire", id: wire.id });
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();

                          const point = getCanvasPointFromClient(event.clientX, event.clientY);

                          if (!point) {
                            return;
                          }

                          cutWireSegmentAtPoint(wire.id, point);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          if (running || layoutEditingLocked || draftWirePoints.length > 0 || wireReconnectTarget) {
                            return;
                          }

                          const point = getCanvasPointFromClient(event.clientX, event.clientY);

                          if (!point) {
                            return;
                          }

                          setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "canvas-click"));
                          setSelection({ kind: "wire", id: wire.id });
                          setWireMenu({ anchor: point, wireId: wire.id });
                        }}
                      />
                    </g>
                  );
                })}

                {wireDisplayNodes.map((node) => {
                  const primaryOccurrence = node.primaryOccurrence;

                  if (!primaryOccurrence) {
                    return null;
                  }

                  if (node.hasEndpoint && componentTerminalPointKeys.has(node.key)) {
                    return null;
                  }

                  // Solo se marca el nodo cuando hay union real (varios cables);
                  // un simple quiebre de un cable no dibuja circulo.
                  if (!node.hasMultipleOccurrences) {
                    return null;
                  }

                  const selectedNode = node.hasSelectedOccurrence;

                  return (
                    <circle
                      key={node.key}
                      className={`freeplay-wire__node ${selectedNode ? "freeplay-wire__node--selected" : ""} ${node.hasEndpoint ? "freeplay-wire__node--endpoint" : "freeplay-wire__node--bend"}`.trim()}
                      cx={node.point.x}
                      cy={node.point.y}
                      r={selectedNode ? (node.hasEndpoint ? 6 : 5) : 4}
                      style={{
                        fill: selectedNode ? primaryOccurrence.color : undefined,
                        stroke: primaryOccurrence.color,
                        pointerEvents: isWireAuthoringEnabled ? "none" : "auto"
                      }}
                      onClick={(event) => {
                        event.stopPropagation();

                        if (wireReconnectTarget) {
                          finishWireReconnect(node.point);
                          return;
                        }

                        if (draftWirePoints.length > 0) {
                          commitWireFromPoints(buildNextDraftPoints(draftWirePoints, node.point));
                          return;
                        }

                        setWireReconnectTarget(null);
                        setSelection({ kind: "wire", id: primaryOccurrence.wireId });
                      }}
                      onDoubleClick={(event) => {
                        if (node.hasEndpoint || node.hasMultipleOccurrences) {
                          return;
                        }

                        event.stopPropagation();
                        removeWireBendPoint(primaryOccurrence.wireId, primaryOccurrence.pointIndex);
                      }}
                      onMouseDown={(event) => {
                        if (node.hasMultipleOccurrences) {
                          return;
                        }

                        handleWirePointMouseDown(event, primaryOccurrence.wireId, primaryOccurrence.pointIndex);
                      }}
                    />
                  );
                })}

                {isWireAuthoringEnabled && cursorPoint ? (
                  <circle
                    className="freeplay-wire__snap-marker"
                    cx={cursorPoint.x}
                    cy={cursorPoint.y}
                    r={5}
                  />
                ) : null}
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
                  const lampGlowColor = component.type === "LAMP"
                    ? getLampGlowColorValue(component.lampGlowColor)
                    : null;
                  const coilActive = isCoilType(component.type) && energized;
                  const contactClosed = isContactType(component.type) && isContactClosed(
                    component,
                    electricalState.resolvedTagValues,
                    electricalState.timedContactStateByComponentId
                  );
                  const contactActuated = isContactType(component.type) && isContactActuated(component, contactClosed);
                  const visualEnergized = energized
                    && !isMomentaryPushButtonType(component.type)
                    && !isContactType(component.type);
                  const pushButtonPressed = isMomentaryPushButtonType(component.type) && isMomentaryPushButtonPressed(component);
                  const manualControl = isMaintainedSwitchType(component.type) || isMomentaryPushButtonType(component.type);
                  const manualControlActive = pushButtonPressed || (isMaintainedSwitchType(component.type) && isMaintainedSwitchClosed(component));
                  const glyphHitboxStyle = getComponentGlyphHitboxStyle(component.type, component.rotation);
                  const pushButtonPressTargetStyle = isMomentaryPushButtonType(component.type)
                    ? getPushButtonPressTargetStyle(component.rotation)
                    : undefined;
                  const componentBadge = getComponentStatusBadge(component, running, energized);
                  const timedTimerDisplay = getTimedContactTimerDisplay(
                    component,
                    electricalState.resolvedTagValues,
                    electricalState.timedContactStateByComponentId
                  );

                  return (
                    <div
                      key={component.id}
                      className={[
                        "freeplay-component",
                        selected ? "freeplay-component--selected" : "",
                        visualEnergized ? "freeplay-component--energized" : "",
                        component.type === "LAMP" && energized ? "freeplay-component--lamp-on" : "",
                        component.type === "MOTOR" && energized ? "freeplay-component--motor-on" : "",
                        manualControl ? "freeplay-component--manual" : "",
                        manualControlActive ? "freeplay-component--manual-active" : "",
                        pushButtonPressed ? "freeplay-component--pushbutton-down" : "",
                        coilActive ? "freeplay-component--coil-on" : ""
                      ].filter(Boolean).join(" ")}
                      style={{
                        left: component.x,
                        top: component.y,
                        ...(lampGlowColor ? {
                          ["--lamp-glow-fill" as "--lamp-glow-fill"]: lampGlowColor.fill,
                          ["--lamp-glow-stroke" as "--lamp-glow-stroke"]: lampGlowColor.stroke,
                          ["--lamp-symbol-color" as "--lamp-symbol-color"]: lampGlowColor.symbol
                        } : {})
                      }}
                      onLostPointerCapture={() => handleComponentHandleLostCapture(component.id)}
                      onPointerCancel={(event) => handleComponentHandlePointerRelease(event, component.id)}
                      onPointerDown={(event) => {
                        const target = event.target;

                        if (
                          target instanceof Element
                          && target.closest(
                            ".freeplay-port, .freeplay-component__press-target, .freeplay-component-menu, .freeplay-wire-menu, input, textarea, select, option, button"
                          )
                        ) {
                          return;
                        }

                        handleComponentHandlePointerDown(event, component.id);
                      }}
                      onPointerMove={(event) => handleComponentHandlePointerMove(event, component.id)}
                      onPointerUp={(event) => handleComponentHandlePointerRelease(event, component.id)}
                      onClick={(event) => {
                        // Un click en la etiqueta/badge tambien selecciona; sin
                        // esto el click sube al canvas y limpia la seleccion
                        // inmediatamente (el panel se encendia y apagaba).
                        event.stopPropagation();
                        setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "canvas-click"));
                        setSelection({ kind: "component", id: component.id });
                      }}
                      onContextMenu={(event) => {
                        if (draftWirePoints.length > 0 || wireReconnectTarget !== null) {
                          return;
                        }

                        event.preventDefault();
                        event.stopPropagation();

                        if (running || layoutEditingLocked) {
                          return;
                        }

                        setSelection({ kind: "component", id: component.id });
                        setComponentMenu({
                          anchor: { x: component.x + COMPONENT_WIDTH, y: component.y },
                          componentId: component.id,
                          editingLabel: false
                        });
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
                        className={`freeplay-port ${wireTerminalsEnabled ? "freeplay-port--active" : ""}`.trim()}
                        aria-label={`Connect to ${component.label} terminal ${terminal.label || formatTerminalLabel(terminal.terminalId)}`}
                        style={{ left: terminal.x - component.x, top: terminal.y - component.y }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "canvas-click"));

                          if (wireReconnectTarget) {
                            finishWireReconnect({ x: terminal.x, y: terminal.y });
                            return;
                          }

                          setSelection({ kind: "component", id: component.id });

                          if (!isWireAuthoringEnabled) {
                            return;
                          }

                          if (draftWirePoints.length === 0) {
                            appendDraftPoint({ x: terminal.x, y: terminal.y });
                            return;
                          }

                          if (isWireOriginHit(draftWirePoints, { x: terminal.x, y: terminal.y })) {
                            clearWireInteraction();
                            return;
                          }

                          commitWireFromPoints(buildNextDraftPoints(draftWirePoints, { x: terminal.x, y: terminal.y }));
                        }}
                      />
                    ))}

                    <div
                      className={`freeplay-component__glyph ${manualControl ? "freeplay-component__glyph--manual" : ""}`.trim()}
                    >
                      <div
                        className={`freeplay-component__glyph-handle ${manualControl ? "freeplay-component__glyph-handle--manual" : ""}`.trim()}
                        style={glyphHitboxStyle}
                        onClick={(event) => {
                          event.stopPropagation();
                          setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "canvas-click"));

                          if (componentDragMovedRef.current) {
                            componentDragMovedRef.current = false;
                            return;
                          }

                          setWireReconnectTarget(null);
                          setSelection({ kind: "component", id: component.id });

                          if (draftWirePoints.length === 0 && wireReconnectTarget === null && isMaintainedSwitchType(component.type)) {
                            scheduleMaintainedSwitchToggle(component.id);
                          }
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();

                          if (isMaintainedSwitchType(component.type)) {
                            cancelPendingSwitchToggle(component.id);
                          }

                          rotateComponent(component.id, 1);
                        }}
                      />
                      {isMomentaryPushButtonType(component.type) ? (
                        <button
                          type="button"
                          className="freeplay-component__press-target"
                          aria-label={`Press ${component.label || getComponentName(component.type)}`}
                          aria-pressed={pushButtonPressed}
                          style={pushButtonPressTargetStyle}
                          onLostPointerCapture={() => handlePushButtonLostCapture(component.id)}
                          onPointerCancel={(event) => handlePushButtonPointerRelease(event, component.id)}
                          onPointerDown={(event) => handlePushButtonPointerDown(event, component.id)}
                          onPointerMove={(event) => handlePushButtonPointerMove(event, component.id)}
                          onPointerUp={(event) => handlePushButtonPointerRelease(event, component.id)}
                        />
                      ) : null}
                      {timedTimerDisplay ? (
                        <div className="freeplay-component__timer-indicator" aria-hidden="true">
                          <span className="freeplay-component__timer-label">{timedTimerDisplay.label}</span>
                          <span className="freeplay-component__timer-track">
                            <span
                              className="freeplay-component__timer-fill"
                                style={{ width: `${timedTimerDisplay.progress > 0 ? Math.max(10, timedTimerDisplay.progress * 100) : 0}%` }}
                            />
                          </span>
                        </div>
                      ) : null}
                      <div
                        className={`freeplay-component__symbol-rotator freeplay-component__symbol-rotator--${getSymbolCategory(component.type)}`.trim()}
                        style={{
                          color: getDefaultComponentColor(component.type),
                          // Sin rotacion no se aplica transform: evita la capa de
                          // composicion y el medio pixel de desfase glifo/cable.
                          ...(normalizeQuarterTurns(component.rotation) === 0
                            ? {}
                            : { transform: `rotate(${normalizeQuarterTurns(component.rotation) * 90}deg)` })
                        }}
                      >
                        {renderSymbolGraphic(component.type, {
                          coilActive,
                          contactActuated,
                          contactClosed,
                          energized: visualEnergized,
                          estopPressed: component.type === "ESTOP" && component.isPressed === true,
                          label: component.label,
                          pushButtonPressed,
                          terminalLabels: component.terminalLabels,
                          ...(isBreakerType(component.type) ? { breakerClosed: isBreakerClosed(component) } : {}),
                          ...(isMaintainedSwitchType(component.type) ? { switchClosed: isMaintainedSwitchClosed(component) } : {})
                        })}
                      </div>
                    </div>

                      <div
                        className="freeplay-component__label-row"
                        style={getComponentLabelRowStyle(component.rotation)}
                        onClick={(event) => {
                          event.stopPropagation();
                          setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "canvas-click"));

                          if (selected) {
                            return;
                          }

                          setWireReconnectTarget(null);
                          setSelection({ kind: "component", id: component.id });
                        }}
                      >
                        <span className="freeplay-component__label">{component.label}</span>
                      </div>
                    </div>
                  );
                })}

                {componentMenu && !layoutEditingLocked ? (() => {
                  const menuComponent = components.find((entry) => entry.id === componentMenu.componentId);

                  if (!menuComponent) {
                    return null;
                  }

                  return (
                    <div
                      className="freeplay-component-menu"
                      style={{ left: componentMenu.anchor.x, top: componentMenu.anchor.y }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                      onContextMenu={(event) => event.stopPropagation()}
                    >
                      {componentMenu.editingLabel ? (
                        <input
                          type="text"
                          className="freeplay-component__label-input freeplay-component-menu__input"
                          spellCheck={false}
                          autoFocus
                          defaultValue={menuComponent.label}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              applyComponentLabelEdit(menuComponent.id, event.currentTarget.value);
                            }
                          }}
                          onBlur={(event) => applyComponentLabelEdit(menuComponent.id, event.currentTarget.value)}
                          onClick={(event) => event.stopPropagation()}
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            className="freeplay-component-menu__action"
                            onClick={() => {
                              setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "action-run"));
                              duplicateComponent(menuComponent.id);
                            }}
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            className="freeplay-component-menu__action"
                            onClick={() => {
                              setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "action-run"));
                              rotateComponent(menuComponent.id, 1);
                            }}
                          >
                            Rotar
                          </button>
                          <button
                            type="button"
                            className="freeplay-component-menu__action"
                            onClick={() => {
                              setComponentMenu((menu) => closeComponentMenuOnEvent(menu, "action-run"));
                              deleteComponentById(menuComponent.id);
                              setWireReconnectTarget(null);
                              setSelection(null);
                            }}
                          >
                            Eliminar
                          </button>
                          <button
                            type="button"
                            className="freeplay-component-menu__action"
                            onClick={() => startComponentLabelEdit(menuComponent.id)}
                          >
                            Editar etiqueta
                          </button>
                        </>
                      )}
                    </div>
                  );
                })() : null}
                {wireMenu && !layoutEditingLocked ? (() => {
                  const menuWire = wires.find((entry) => entry.id === wireMenu.wireId);

                  if (!menuWire) {
                    return null;
                  }

                  return (
                    <div
                      className="freeplay-component-menu freeplay-wire-menu"
                      style={{ left: wireMenu.anchor.x, top: wireMenu.anchor.y }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                      onContextMenu={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="freeplay-component-menu__action"
                        onClick={() => {
                          setWireMenu(null);
                          deleteWireById(menuWire.id);
                        }}
                      >
                        Eliminar
                      </button>
                      <div className="freeplay-wire-menu__row">
                        <span className="freeplay-wire-menu__label">Color</span>
                        <input
                          type="color"
                          className="freeplay-wire-menu__color"
                          value={menuWire.color}
                          onChange={(event) => updateWireColorById(menuWire.id, event.target.value)}
                        />
                      </div>
                      <div className="freeplay-wire-menu__row">
                        <span className="freeplay-wire-menu__label">Grosor</span>
                        <span className="freeplay-wire-menu__thickness">
                          {[2, 3.5, 5, 7].map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={`freeplay-wire-menu__thickness-button ${menuWire.thickness === value ? "freeplay-wire-menu__thickness-button--active" : ""}`.trim()}
                              onClick={() => updateWireThicknessById(menuWire.id, value)}
                            >
                              {value}
                            </button>
                          ))}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="freeplay-component-menu__action"
                        onClick={() => {
                          setWireMenu(null);
                          simplifyWireById(menuWire.id);
                        }}
                      >
                        Simplificar
                      </button>
                    </div>
                  );
                })() : null}
                {showTerminalDebug ? (
                  <svg
                    className="freeplay-debug-overlay"
                    viewBox={`0 0 ${planeSettings.width} ${planeSettings.height}`}
                    preserveAspectRatio="none"
                    shapeRendering="geometricPrecision"
                    style={{ height: planeSettings.height, width: planeSettings.width }}
                    aria-hidden="true"
                  >
                    {terminalDebugNodes.map((terminal) => (
                      <circle
                        key={`terminal-debug-${terminal.portId}`}
                        className="freeplay-terminal-debug"
                        cx={terminal.x}
                        cy={terminal.y}
                        r={3}
                      />
                    ))}
                    {stubDebugNodes.map((route, index) => (
                      <circle
                        key={`stub-debug-${index}-${route.portId}`}
                        className="freeplay-terminal-debug freeplay-terminal-debug--stub"
                        cx={route.stub.x}
                        cy={route.stub.y}
                        r={2.5}
                      />
                    ))}
                  </svg>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {paletteDragPreview && typeof document !== "undefined"
          ? createPortal(
            <div
              className="builder-palette-drag-preview"
              style={{ left: paletteDragPreview.x, top: paletteDragPreview.y }}
            >
              <span
                className={[
                  "builder-palette-drag-preview__symbol",
                  "builder-palette-tile__symbol",
                  `builder-palette-tile__symbol--${getSymbolCategory(paletteDragPreview.type)}`
                ].join(" ")}
              >
                {renderSymbolGraphic(paletteDragPreview.type)}
              </span>
              <span className="builder-palette-drag-preview__label">{paletteDragPreview.label}</span>
            </div>,
            document.body
          )
          : null}
      </div>
    </section>
  );
}