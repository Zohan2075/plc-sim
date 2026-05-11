import {
  type ChangeEvent as ReactChangeEvent,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import type { InstructionType, Program } from "@plc-sim/ladder-types";
import type { TagDefinition } from "./projectData";

type SourceComponentType = "POWER_SOURCE" | "DC_SOURCE";
type SourceCurrentType = "ac" | "dc";
type BuilderComponentType = InstructionType | "BREAKER_1P" | "BREAKER_2P" | "SWITCH_1P" | "PUSH_BUTTON_NO" | "PUSH_BUTTON_NC" | SourceComponentType | "LAMP" | "MOTOR";
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
  isPressed?: boolean;
  label: string;
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

interface BuilderWire {
  color: string;
  id: string;
  points: Point[];
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

interface BuilderTerminal {
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

interface BuilderScene {
  components: BuilderComponent[];
  wires: BuilderWire[];
}

interface BuilderPlaneSettings {
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

const COMPONENT_WIDTH = 160;
const COMPONENT_HEIGHT = 136;
const COMPONENT_GLYPH_HEIGHT = 102;
const SYMBOL_VIEWPORT_WIDTH = COMPONENT_WIDTH;
const SYMBOL_VIEWPORT_HEIGHT = 84;
const SYMBOL_VIEWPORT_TOP = (COMPONENT_GLYPH_HEIGHT - SYMBOL_VIEWPORT_HEIGHT) / 2;
const SYMBOL_VIEWBOX_WIDTH = 128;
const DEFAULT_PLANE_WIDTH = 1720;
const DEFAULT_PLANE_HEIGHT = 940;
const DEFAULT_GRID_SPACING = 24;
const MIN_PLANE_WIDTH = 960;
const MAX_PLANE_WIDTH = 4200;
const MIN_PLANE_HEIGHT = 600;
const MAX_PLANE_HEIGHT = 2400;
const MIN_GRID_SPACING = 8;
const MAX_GRID_SPACING = 96;
const SNAP_DISTANCE = 18;
const DEFAULT_WIRE_COLOR = "#c2410c";
const DEFAULT_WIRE_THICKNESS = 4;
const DEFAULT_SOURCE_VOLTAGE = 120;
const DEFAULT_DC_SOURCE_VOLTAGE = 24;
const DEFAULT_CANVAS_ZOOM = 1;
const MIN_CANVAS_ZOOM = 0.5;
const MAX_CANVAS_ZOOM = 2;
const CANVAS_ZOOM_STEP = 0.1;
const MAINTAINED_SWITCH_CLICK_DELAY_MS = 220;
const GENERATED_INSTRUCTION_TAG_PREFIX = "__builder_label__:";
const CIRCUIT_SNAPSHOT_VERSION = 1;
const ROTATION_CENTER_X = COMPONENT_WIDTH / 2;
const ROTATION_CENTER_Y = COMPONENT_GLYPH_HEIGHT / 2;
const TERMINAL_LATTICE_X_OFFSET = ((ROTATION_CENTER_X % DEFAULT_GRID_SPACING) + DEFAULT_GRID_SPACING) % DEFAULT_GRID_SPACING;
const TERMINAL_LATTICE_Y_OFFSET = ((ROTATION_CENTER_Y % DEFAULT_GRID_SPACING) + DEFAULT_GRID_SPACING) % DEFAULT_GRID_SPACING;
const MAJOR_GRID_MULTIPLIER = 5;
const PALETTE_DRAG_THRESHOLD = 6;
const EMPTY_TAG_VALUES: Readonly<Record<string, boolean>> = {};
const DEFAULT_PLANE_SETTINGS: BuilderPlaneSettings = {
  gridSpacing: DEFAULT_GRID_SPACING,
  height: DEFAULT_PLANE_HEIGHT,
  width: DEFAULT_PLANE_WIDTH
};
const circuitSnapshotComponentTypes = new Set<BuilderComponentType>([
  "POWER_SOURCE",
  "DC_SOURCE",
  "BREAKER_1P",
  "BREAKER_2P",
  "SWITCH_1P",
  "PUSH_BUTTON_NO",
  "PUSH_BUTTON_NC",
  "LAMP",
  "MOTOR",
  "XIC",
  "XIO",
  "OTE",
  "OTL",
  "OTU"
]);
const circuitSnapshotTagKinds = new Set<TagDefinition["kind"]>(["input", "output", "internal"]);

const instructionPalette: Array<{
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
  { type: "LAMP", label: "Lamp", description: "Indicator lamp load" },
  { type: "XIC", label: "XIC", description: "Normally open contact" },
  { type: "XIO", label: "XIO", description: "Normally closed contact" },
  { type: "OTE", label: "OTE", description: "Output energize coil" }
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

function isContactType(type: BuilderComponentType): type is "XIC" | "XIO" {
  return type === "XIC" || type === "XIO";
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
  return type === "BREAKER_1P" || type === "BREAKER_2P" || type === "SWITCH_1P" || type === "PUSH_BUTTON_NO" || type === "PUSH_BUTTON_NC" || type === "XIC" || type === "XIO";
}

function isBreakerType(type: BuilderComponentType): type is "BREAKER_1P" | "BREAKER_2P" {
  return type === "BREAKER_1P" || type === "BREAKER_2P";
}

function isMaintainedSwitchType(type: BuilderComponentType): type is "SWITCH_1P" {
  return type === "SWITCH_1P";
}

function isMomentaryPushButtonType(type: BuilderComponentType): type is "PUSH_BUTTON_NO" | "PUSH_BUTTON_NC" {
  return type === "PUSH_BUTTON_NO" || type === "PUSH_BUTTON_NC";
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
      return "contact";
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

function getDefaultSourceVoltage(type: BuilderComponentType): number {
  return type === "DC_SOURCE" ? DEFAULT_DC_SOURCE_VOLTAGE : DEFAULT_SOURCE_VOLTAGE;
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

function clampPlaneWidth(value: number): number {
  return clamp(Math.round(value), MIN_PLANE_WIDTH, MAX_PLANE_WIDTH);
}

function clampPlaneHeight(value: number): number {
  return clamp(Math.round(value), MIN_PLANE_HEIGHT, MAX_PLANE_HEIGHT);
}

function clampGridSpacing(value: number): number {
  return clamp(Math.round(value), MIN_GRID_SPACING, MAX_GRID_SPACING);
}

function clampCanvasZoom(value: number): number {
  return clamp(Math.round(value * 100) / 100, MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM);
}

function sanitizePlaneSettings(settings: Partial<BuilderPlaneSettings> | undefined): BuilderPlaneSettings {
  return {
    gridSpacing: clampGridSpacing(settings?.gridSpacing ?? DEFAULT_PLANE_SETTINGS.gridSpacing),
    height: clampPlaneHeight(settings?.height ?? DEFAULT_PLANE_SETTINGS.height),
    width: clampPlaneWidth(settings?.width ?? DEFAULT_PLANE_SETTINGS.width)
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

function getInstructionTagValue(
  component: BuilderComponent,
  tagValues: Readonly<Record<string, boolean>>
): boolean {
  return component.tag ? (tagValues[component.tag] ?? false) : false;
}

function isContactClosed(
  component: BuilderComponent,
  tagValues: Readonly<Record<string, boolean>>
): boolean {
  if (component.type === "XIC") {
    return getInstructionTagValue(component, tagValues);
  }

  if (component.type === "XIO") {
    return !getInstructionTagValue(component, tagValues);
  }

  return false;
}

function getConductiveTerminalPairs(
  component: BuilderComponent,
  tagValues: Readonly<Record<string, boolean>> = EMPTY_TAG_VALUES,
  useLiveTagState = false
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
      return !useLiveTagState || !isMomentaryPushButtonPressed(component) ? [["in", "out"]] : [];
    case "XIC":
    case "XIO":
      return !useLiveTagState || isContactClosed(component, tagValues) ? [["in", "out"]] : [];
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
  tagValues: Readonly<Record<string, boolean>>
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
    for (const [leftTerminalId, rightTerminalId] of getConductiveTerminalPairs(component, tagValues, true)) {
      connectGraphNodes(
        electricalConnections,
        getElectricalPortNodeId(getPortId(component.id, leftTerminalId)),
        getElectricalPortNodeId(getPortId(component.id, rightTerminalId))
      );
    }
  }

  return { componentsById, electricalConnections, portsById, wireNodeIdsByWire };
}

function resolvePhysicalInstructionTagValues(
  components: BuilderComponent[],
  wires: BuilderWire[],
  tagValues: Readonly<Record<string, boolean>>,
  previousResolvedTagValues: Readonly<Record<string, boolean>> = EMPTY_TAG_VALUES
): Readonly<Record<string, boolean>> {
  const coilComponents = components.filter(
    (component): component is BuilderComponent & { tag: string } => isCoilType(component.type) && component.tag !== null
  );

  if (coilComponents.length === 0) {
    return tagValues;
  }

  const coilTags = [...new Set(coilComponents.map((component) => component.tag))];
  let resolvedTagValues: Record<string, boolean> = { ...tagValues };

  for (const tag of coilTags) {
    resolvedTagValues[tag] = previousResolvedTagValues[tag] ?? false;
  }

  for (let iteration = 0; iteration < Math.max(components.length, 1); iteration += 1) {
    const { electricalConnections } = buildElectricalSimulationGraph(components, wires, resolvedTagValues);
    const nextResolvedTagValues: Record<string, boolean> = { ...resolvedTagValues };

    for (const tag of coilTags) {
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

      for (const coilComponent of coilComponents) {
        if (getComponentSuppliedTerminalNodeIds(coilComponent, feedReachable, returnReachable)) {
          nextResolvedTagValues[coilComponent.tag] = true;
        }
      }
    }

    const tagStateChanged = coilTags.some((tag) => nextResolvedTagValues[tag] !== resolvedTagValues[tag]);

    resolvedTagValues = nextResolvedTagValues;

    if (!tagStateChanged) {
      return resolvedTagValues;
    }
  }

  return resolvedTagValues;
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
    case "LAMP":
      return "Lamp";
    case "MOTOR":
      return "Motor";
    default:
      return type;
  }
}

function normalizeInstructionLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isGeneratedInstructionTag(tag: string): boolean {
  return tag.startsWith(GENERATED_INSTRUCTION_TAG_PREFIX);
}

function readGeneratedInstructionLabel(tag: string): string | null {
  if (!isGeneratedInstructionTag(tag)) {
    return null;
  }

  try {
    return decodeURIComponent(tag.slice(GENERATED_INSTRUCTION_TAG_PREFIX.length));
  } catch {
    return null;
  }
}

function createGeneratedInstructionTag(label: string): string {
  const normalizedLabel = normalizeInstructionLabel(label);
  const canonicalLabel = normalizedLabel === "" ? "UNNAMED" : normalizedLabel.toUpperCase();

  return `${GENERATED_INSTRUCTION_TAG_PREFIX}${encodeURIComponent(canonicalLabel)}`;
}

function syncInstructionComponentTag(component: BuilderComponent): BuilderComponent {
  if (!componentNeedsTag(component.type)) {
    return component;
  }

  if (component.tag !== null && !isGeneratedInstructionTag(component.tag)) {
    return component;
  }

  const normalizedLabel = normalizeInstructionLabel(component.label);

  if (normalizedLabel === "") {
    return component;
  }

  const nextTag = createGeneratedInstructionTag(normalizedLabel);

  return component.tag === nextTag
    ? component
    : { ...component, tag: nextTag };
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
  viewBoxHeight: number,
  options: { snapToLattice?: boolean } = {}
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

  return options.snapToLattice === false
    ? roundPoint(projectedPoint)
    : snapPointToTerminalLattice(projectedPoint);
}

function getTerminalDefinitions(type: BuilderComponentType): TerminalDefinition[] {
  switch (type) {
    case "POWER_SOURCE":
		case "DC_SOURCE": {
      const leftTerminal = projectSymbolPoint(6, 30, 60);
      const rightTerminal = projectSymbolPoint(122, 30, 60);

      return [
        { id: "left", label: type === "POWER_SOURCE" ? "L1" : "-", role: "source", x: leftTerminal.x, y: leftTerminal.y },
        { id: "right", label: type === "POWER_SOURCE" ? "L2" : "+", role: "source", x: rightTerminal.x, y: rightTerminal.y }
      ];
    }
    case "BREAKER_1P":
      {
        const inputTerminal = projectSymbolPoint(6, 34, 64);
        const outputTerminal = projectSymbolPoint(122, 34, 64);

      return [
          { id: "in", label: "1", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
          { id: "out", label: "2", pairId: "main", role: "output", x: outputTerminal.x, y: outputTerminal.y }
      ];
      }
    case "SWITCH_1P": {
      const inputTerminal = projectSymbolPoint(6, 34, 64);
      const outputTerminal = projectSymbolPoint(122, 34, 64);

      return [
        { id: "in", label: "In", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
        { id: "out", label: "Out", pairId: "main", role: "output", x: outputTerminal.x, y: outputTerminal.y }
      ];
    }
    case "BREAKER_2P":
      {
        const topInputTerminal = projectSymbolPoint(6.4, 12.8, 64);
        const topOutputTerminal = projectSymbolPoint(121.6, 12.8, 64);
        const bottomInputTerminal = projectSymbolPoint(6.4, 51.2, 64);
        const bottomOutputTerminal = projectSymbolPoint(121.6, 51.2, 64);

      return [
        { id: "in-top", label: "1", pairId: "top", role: "input", x: topInputTerminal.x, y: topInputTerminal.y },
        { id: "out-top", label: "2", pairId: "top", role: "output", x: topOutputTerminal.x, y: topOutputTerminal.y },
        { id: "in-bottom", label: "3", pairId: "bottom", role: "input", x: bottomInputTerminal.x, y: bottomInputTerminal.y },
        { id: "out-bottom", label: "4", pairId: "bottom", role: "output", x: bottomOutputTerminal.x, y: bottomOutputTerminal.y }
      ];
      }
    case "LAMP":
    case "MOTOR": {
      const inputTerminal = projectSymbolPoint(6, 32, 64);
      const outputTerminal = projectSymbolPoint(122, 32, 64);

      return [
        { id: "in", label: "In", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
        { id: "out", label: "Out", pairId: "main", role: "end", x: outputTerminal.x, y: outputTerminal.y }
      ];
    }
    case "PUSH_BUTTON_NO":
    case "PUSH_BUTTON_NC": {
      const inputTerminal = projectSymbolPoint(6, 36, 72);
      const outputTerminal = projectSymbolPoint(122, 36, 72);

      return [
        { id: "in", label: "In", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
        { id: "out", label: "Out", pairId: "main", role: "output", x: outputTerminal.x, y: outputTerminal.y }
      ];
    }
    case "XIC":
    case "XIO": {
      const inputTerminal = projectSymbolPoint(6, 32, 64);
      const outputTerminal = projectSymbolPoint(122, 32, 64);

      return [
        { id: "in", label: "In", pairId: "main", role: "input", x: inputTerminal.x, y: inputTerminal.y },
        { id: "out", label: "Out", pairId: "main", role: "output", x: outputTerminal.x, y: outputTerminal.y }
      ];
    }
    case "OTE":
    case "OTL":
    case "OTU": {
      const inputTerminal = projectSymbolPoint(6, 30, 60);
      const outputTerminal = projectSymbolPoint(122, 30, 60);

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

function getDefaultEntryTerminalId(type: BuilderComponentType): string {
  switch (type) {
    case "BREAKER_2P":
      return "in-top";
    case "BREAKER_1P":
    case "SWITCH_1P":
    case "PUSH_BUTTON_NO":
    case "PUSH_BUTTON_NC":
    case "LAMP":
    case "MOTOR":
    case "XIC":
    case "XIO":
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
  options: {
    breakerClosed?: boolean;
    coilActive?: boolean;
    contactActuated?: boolean;
    contactClosed?: boolean;
    energized?: boolean;
    pushButtonPressed?: boolean;
    switchClosed?: boolean;
    terminalLabels?: Partial<Record<string, string>>;
  } = {}
): ReactNode {
  const getTerminalLabelText = (terminalId: string, fallbackLabel: string): string => {
    const label = options.terminalLabels?.[terminalId]?.trim();
    return label && label.length > 0 ? label : fallbackLabel;
  };
  const symbolClassName = [
    "diagram-symbol",
    type === "PUSH_BUTTON_NO" ? "diagram-symbol--pushbutton-no" : "",
    type === "PUSH_BUTTON_NC" ? "diagram-symbol--pushbutton-nc" : "",
    options.energized ? "diagram-symbol--energized" : "",
    options.coilActive ? "diagram-symbol--coil-active" : "",
    options.contactClosed ? "diagram-symbol--contact-closed" : "",
    options.contactActuated ? "diagram-symbol--contact-actuated" : ""
  ].filter(Boolean).join(" ");

  switch (type) {
    case "POWER_SOURCE":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <text x="8" y="14" className="diagram-symbol__text">{getTerminalLabelText("left", "L1")}</text>
          <text x="100" y="14" className="diagram-symbol__text">{getTerminalLabelText("right", "L2")}</text>
          <line x1="6" y1="30" x2="42" y2="30" className="diagram-symbol__line" />
          <line x1="86" y1="30" x2="122" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
          <path d="M50 30 Q55 16 60 30 Q65 44 70 30 Q75 16 78 30" className="diagram-symbol__line" />
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
          <line x1="6" y1="34" x2="28" y2="34" className="diagram-symbol__line" />
          <line x1="100" y1="34" x2="122" y2="34" className="diagram-symbol__line" />
          <circle cx="34" cy="34" r="5.5" className="diagram-symbol__terminal" />
          <circle cx="94" cy="34" r="5.5" className="diagram-symbol__terminal" />
          <path d="M41 28 C50 10 78 10 87 28" className="diagram-symbol__line" fill="none" />
        </svg>
      );
    case "BREAKER_2P":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <line x1="6.4" y1="12.8" x2="28.4" y2="12.8" className="diagram-symbol__line" />
          <line x1="99.6" y1="12.8" x2="121.6" y2="12.8" className="diagram-symbol__line" />
          <circle cx="34.4" cy="12.8" r="5.5" className="diagram-symbol__terminal" />
          <circle cx="93.6" cy="12.8" r="5.5" className="diagram-symbol__terminal" />
          <line x1="6.4" y1="51.2" x2="28.4" y2="51.2" className="diagram-symbol__line" />
          <line x1="99.6" y1="51.2" x2="121.6" y2="51.2" className="diagram-symbol__line" />
          <circle cx="34.4" cy="51.2" r="5.5" className="diagram-symbol__terminal" />
          <circle cx="93.6" cy="51.2" r="5.5" className="diagram-symbol__terminal" />
          <path d="M41.4 6.8 C50 -6.5 78 -6.5 86.6 6.8" className="diagram-symbol__line" fill="none" />
          <path d="M41.4 45.2 C50 31.9 78 31.9 86.6 45.2" className="diagram-symbol__line" fill="none" />
          <line x1="64" y1="0.8" x2="64" y2="35.6" className="diagram-symbol__linkage" />
          <text x="18" y="9.5" textAnchor="middle" className="diagram-symbol__terminal-label">{getTerminalLabelText("in-top", "1")}</text>
          <text x="110" y="9.5" textAnchor="middle" className="diagram-symbol__terminal-label">{getTerminalLabelText("out-top", "2")}</text>
          <text x="18" y="61.5" textAnchor="middle" className="diagram-symbol__terminal-label">{getTerminalLabelText("in-bottom", "3")}</text>
          <text x="110" y="61.5" textAnchor="middle" className="diagram-symbol__terminal-label">{getTerminalLabelText("out-bottom", "4")}</text>
        </svg>
      );
    case "SWITCH_1P":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="34" x2="28" y2="34" className="diagram-symbol__line" />
          <line x1="100" y1="34" x2="122" y2="34" className="diagram-symbol__line" />
          <circle cx="34" cy="34" r="5.5" className="diagram-symbol__terminal" />
          <circle cx="94" cy="34" r="5.5" className="diagram-symbol__terminal" />
          <line
            x1="40"
            y1="34"
            x2={options.switchClosed ? "88" : "82"}
            y2={options.switchClosed ? "30" : "16"}
            className="diagram-symbol__line diagram-symbol__contact-arm"
          />
        </svg>
      );
    case "LAMP":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="32" x2="38" y2="32" className="diagram-symbol__line" />
          <line x1="90" y1="32" x2="122" y2="32" className="diagram-symbol__line" />
          <circle cx="64" cy="32" r="22" className="diagram-symbol__shape" />
          <path d="M48 16 L80 48 M80 16 L48 48" className="diagram-symbol__line" />
        </svg>
      );
    case "MOTOR":
      return (
        <svg viewBox="0 0 128 64" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="32" x2="38" y2="32" className="diagram-symbol__line" />
          <line x1="90" y1="32" x2="122" y2="32" className="diagram-symbol__line" />
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
          <line x1="6" y1="32" x2="54" y2="32" className="diagram-symbol__line" />
          <line x1="74" y1="32" x2="122" y2="32" className="diagram-symbol__line" />
          <line x1="56" y1="12" x2="56" y2="52" className="diagram-symbol__line" />
          <line x1="72" y1="12" x2="72" y2="52" className="diagram-symbol__line" />
          {contactClosed ? (
            <line x1="46" y1="48" x2="82" y2="16" className="diagram-symbol__line" />
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
          <line x1="6" y1="32" x2="54" y2="32" className="diagram-symbol__line" />
          <line x1="74" y1="32" x2="122" y2="32" className="diagram-symbol__line" />
          <line x1="56" y1="12" x2="56" y2="52" className="diagram-symbol__line" />
          <line x1="72" y1="12" x2="72" y2="52" className="diagram-symbol__line" />
          {contactClosed ? (
            <line x1="46" y1="48" x2="82" y2="16" className="diagram-symbol__line" />
          ) : null}
        </svg>
      );
      }
    case "OTE":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="30" x2="44" y2="30" className="diagram-symbol__line" />
          <line x1="84" y1="30" x2="122" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
          <circle cx="64" cy="30" r="12" className="diagram-symbol__coil-core" />
        </svg>
      );
    case "OTL":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="30" x2="44" y2="30" className="diagram-symbol__line" />
          <line x1="84" y1="30" x2="122" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
          <circle cx="64" cy="30" r="12" className="diagram-symbol__coil-core" />
          <text x="64" y="36" textAnchor="middle" className="diagram-symbol__text">L</text>
        </svg>
      );
    case "OTU":
      return (
        <svg viewBox="0 0 128 60" className={symbolClassName} aria-hidden="true">
          <line x1="6" y1="30" x2="44" y2="30" className="diagram-symbol__line" />
          <line x1="84" y1="30" x2="122" y2="30" className="diagram-symbol__line" />
          <circle cx="64" cy="30" r="20" className="diagram-symbol__shape" />
          <circle cx="64" cy="30" r="12" className="diagram-symbol__coil-core" />
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

function clampPointToPlane(point: Point, planeSettings: BuilderPlaneSettings, padding = 0): Point {
  return {
    x: clamp(point.x, padding, planeSettings.width - padding),
    y: clamp(point.y, padding, planeSettings.height - padding)
  };
}

function snapPointToGrid(point: Point, planeSettings: BuilderPlaneSettings): Point {
  const gridSpacing = planeSettings.gridSpacing;

  return clampPointToPlane(
    {
      x: Math.round(point.x / gridSpacing) * gridSpacing,
      y: Math.round(point.y / gridSpacing) * gridSpacing
    },
    planeSettings
  );
}

function requantizeCoordinateToGrid(value: number, previousSpacing: number, nextSpacing: number): number {
  if (previousSpacing === nextSpacing) {
    return value;
  }

  return Math.round(value / previousSpacing) * nextSpacing;
}

function requantizePointToPlaneGrid(
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

function getComponentPlanePadding(planeSettings: BuilderPlaneSettings): number {
  return Math.max(planeSettings.gridSpacing, 16);
}

function requantizeComponentToPlaneGrid(
  component: BuilderComponent,
  previousPlaneSettings: BuilderPlaneSettings,
  nextPlaneSettings: BuilderPlaneSettings
): BuilderComponent {
  const padding = getComponentPlanePadding(nextPlaneSettings);
  const nextAnchorX = requantizeCoordinateToGrid(
    component.x + ROTATION_CENTER_X,
    previousPlaneSettings.gridSpacing,
    nextPlaneSettings.gridSpacing
  );
  const nextAnchorY = requantizeCoordinateToGrid(
    component.y + ROTATION_CENTER_Y,
    previousPlaneSettings.gridSpacing,
    nextPlaneSettings.gridSpacing
  );

  return {
    ...component,
    x: clamp(
      nextAnchorX - ROTATION_CENTER_X,
      padding,
      nextPlaneSettings.width - COMPONENT_WIDTH - padding
    ),
    y: clamp(
      nextAnchorY - ROTATION_CENTER_Y,
      padding,
      nextPlaneSettings.height - COMPONENT_HEIGHT - padding
    )
  };
}

function snapComponentToPlaneGrid(component: BuilderComponent, planeSettings: BuilderPlaneSettings): BuilderComponent {
  const padding = getComponentPlanePadding(planeSettings);
  const anchorX = Math.round((component.x + ROTATION_CENTER_X) / planeSettings.gridSpacing) * planeSettings.gridSpacing;
  const anchorY = Math.round((component.y + ROTATION_CENTER_Y) / planeSettings.gridSpacing) * planeSettings.gridSpacing;

  return {
    ...component,
    x: clamp(
      anchorX - ROTATION_CENTER_X,
      padding,
      planeSettings.width - COMPONENT_WIDTH - padding
    ),
    y: clamp(
      anchorY - ROTATION_CENTER_Y,
      padding,
      planeSettings.height - COMPONENT_HEIGHT - padding
    )
  };
}

function clampComponentToPlane(component: BuilderComponent, planeSettings: BuilderPlaneSettings): BuilderComponent {
  const padding = getComponentPlanePadding(planeSettings);

  return {
    ...component,
    x: clamp(component.x, padding, planeSettings.width - COMPONENT_WIDTH - padding),
    y: clamp(component.y, padding, planeSettings.height - COMPONENT_HEIGHT - padding)
  };
}

function clampWireToPlane(wire: BuilderWire, planeSettings: BuilderPlaneSettings): BuilderWire {
  return {
    ...wire,
    points: normalizeWirePoints(wire.points.map((point) => clampPointToPlane(point, planeSettings)))
  };
}

function clampSceneToPlane(scene: BuilderScene, planeSettings: BuilderPlaneSettings): BuilderScene {
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

function requantizeSceneToPlaneGrid(
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
        wire.points.map((point) => requantizePointToPlaneGrid(point, previousPlaneSettings, nextPlaneSettings))
      )
    }))
  };

  return clampSceneToPlane(nextScene, nextPlaneSettings);
}

function createOrthogonalPath(currentPoints: Point[], targetPoint: Point, planeSettings: BuilderPlaneSettings): Point[] {
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

  return normalizeWirePoints([...currentPoints, snappedElbow, targetPoint]);
}

function normalizeQuarterTurns(value: number): number {
  return ((value % 4) + 4) % 4;
}

function distanceBetween(left: Point, right: Point): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return Math.hypot(dx, dy);
}

function snapCoordinateToLattice(value: number, spacing: number, offset: number): number {
  return offset + Math.round((value - offset) / spacing) * spacing;
}

function snapPointToTerminalLattice(point: Point): Point {
  return roundPoint({
    x: snapCoordinateToLattice(point.x, DEFAULT_GRID_SPACING, TERMINAL_LATTICE_X_OFFSET),
    y: snapCoordinateToLattice(point.y, DEFAULT_GRID_SPACING, TERMINAL_LATTICE_Y_OFFSET)
  });
}

function pointsShareCanonicalCoordinates(left: Point, right: Point): boolean {
  const normalizedLeft = roundPoint(left);
  const normalizedRight = roundPoint(right);

  return normalizedLeft.x === normalizedRight.x && normalizedLeft.y === normalizedRight.y;
}

function pointsAreClose(left: Point, right: Point): boolean {
  return distanceBetween(left, right) < 3;
}

function normalizeWirePoints(points: Point[]): Point[] {
  const normalized: Point[] = [];

  for (const point of points) {
    const canonicalPoint = roundPoint(point);
    const previousPoint = normalized[normalized.length - 1];

    if (!previousPoint || !pointsShareCanonicalCoordinates(previousPoint, canonicalPoint)) {
      normalized.push(canonicalPoint);
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

function getSegmentAxis(start: Point, end: Point): "horizontal" | "vertical" | null {
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

function repositionWireEndpointOrthogonally(
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

function slugifyFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "plc-sim-circuit";
}

function formatSnapshotTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function createCircuitSnapshot(
  components: BuilderComponent[],
  wires: BuilderWire[],
  program: Program,
  tags: TagDefinition[],
  scanIntervalMs: number,
	planeSettings: BuilderPlaneSettings
): CircuitSnapshot {
  const savedAt = new Date().toISOString();
  const nextPlaneSettings = sanitizePlaneSettings(planeSettings);

  return {
    components: components.map((component) => ({
      ...component,
      ...(component.terminalLabels ? { terminalLabels: { ...component.terminalLabels } } : {})
    })),
    name: "PLC Sim circuit",
    program,
    savedAt,
    settings: {
      gridSpacing: nextPlaneSettings.gridSpacing,
      height: nextPlaneSettings.height,
      scanIntervalMs,
      width: nextPlaneSettings.width
    },
    tags: tags.map((tag) => ({ ...tag })),
    version: CIRCUIT_SNAPSHOT_VERSION,
    wires: wires.map((wire) => ({ ...wire, points: wire.points.map((point) => ({ ...point })) }))
  };
}

function downloadCircuitSnapshot(snapshot: CircuitSnapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${slugifyFileName(snapshot.name)}-${formatSnapshotTimestamp(new Date(snapshot.savedAt))}.circuit.json`;
  anchor.click();

  window.URL.revokeObjectURL(url);
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

function expectCircuitSnapshotObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function expectCircuitSnapshotArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

function expectCircuitSnapshotString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function expectCircuitSnapshotNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function expectCircuitSnapshotBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function expectCircuitSnapshotOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectCircuitSnapshotString(value, label);
}

function expectCircuitSnapshotOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectCircuitSnapshotBoolean(value, label);
}

function expectCircuitSnapshotOptionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectCircuitSnapshotNumber(value, label);
}

function parseCircuitSnapshotTerminalLabels(
  value: unknown,
  label: string
): Partial<Record<string, string>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const terminalLabels = expectCircuitSnapshotObject(value, label);
  const nextTerminalLabels = Object.entries(terminalLabels).reduce<Partial<Record<string, string>>>((labels, [key, entry]) => {
    labels[key] = expectCircuitSnapshotString(entry, `${label} ${key}`).trim();
    return labels;
  }, {});

  return Object.keys(nextTerminalLabels).length > 0 ? nextTerminalLabels : undefined;
}

function parseCircuitSnapshotPoint(value: unknown, label: string): Point {
  const point = expectCircuitSnapshotObject(value, label);

  return {
    x: expectCircuitSnapshotNumber(point.x, `${label} x`),
    y: expectCircuitSnapshotNumber(point.y, `${label} y`)
  };
}

function parseCircuitSnapshotWire(value: unknown, index: number): BuilderWire {
  const wire = expectCircuitSnapshotObject(value, `Circuit wire ${index}`);

  return {
    color: expectCircuitSnapshotString(wire.color, `Circuit wire ${index} color`),
    id: expectCircuitSnapshotString(wire.id, `Circuit wire ${index} id`),
    points: expectCircuitSnapshotArray(wire.points, `Circuit wire ${index} points`).map((point, pointIndex) =>
      parseCircuitSnapshotPoint(point, `Circuit wire ${index} point ${pointIndex}`)
    ),
    thickness: expectCircuitSnapshotNumber(wire.thickness, `Circuit wire ${index} thickness`)
  };
}

function parseCircuitSnapshotComponent(value: unknown, index: number): BuilderComponent {
  const component = expectCircuitSnapshotObject(value, `Circuit component ${index}`);
  const type = expectCircuitSnapshotString(component.type, `Circuit component ${index} type`);

  if (!circuitSnapshotComponentTypes.has(type as BuilderComponentType)) {
    throw new Error(`Circuit component ${index} type "${type}" is not supported.`);
  }

  const tagValue = component.tag;
  const isClosed = expectCircuitSnapshotOptionalBoolean(component.isClosed, `Circuit component ${index} isClosed`);
  const isPressed = expectCircuitSnapshotOptionalBoolean(component.isPressed, `Circuit component ${index} isPressed`);
  const sourceVoltage = component.sourceVoltage !== undefined
    ? expectCircuitSnapshotNumber(component.sourceVoltage, `Circuit component ${index} sourceVoltage`)
    : undefined;
  const terminalLabels = parseCircuitSnapshotTerminalLabels(
    component.terminalLabels,
    `Circuit component ${index} terminalLabels`
  );

  return syncInstructionComponentTag({
    id: expectCircuitSnapshotString(component.id, `Circuit component ${index} id`),
    label: expectCircuitSnapshotString(component.label, `Circuit component ${index} label`),
    rotation: expectCircuitSnapshotNumber(component.rotation, `Circuit component ${index} rotation`),
    tag: tagValue === null ? null : expectCircuitSnapshotString(tagValue, `Circuit component ${index} tag`),
    type: type as BuilderComponentType,
    usesCustomLabel: expectCircuitSnapshotBoolean(component.usesCustomLabel, `Circuit component ${index} usesCustomLabel`),
    x: expectCircuitSnapshotNumber(component.x, `Circuit component ${index} x`),
    y: expectCircuitSnapshotNumber(component.y, `Circuit component ${index} y`),
    ...(terminalLabels ? { terminalLabels } : {}),
    ...(isClosed !== undefined ? { isClosed } : {}),
    ...(isPressed !== undefined ? { isPressed } : {}),
    ...(sourceVoltage !== undefined ? { sourceVoltage } : {})
  });
}

function parseCircuitSnapshotTags(value: unknown): TagDefinition[] {
  return expectCircuitSnapshotArray(value, "Circuit tags").map((tag, index) => {
    const parsedTag = expectCircuitSnapshotObject(tag, `Circuit tag ${index}`);
    const kind = expectCircuitSnapshotString(parsedTag.kind, `Circuit tag ${index} kind`);
    const label = expectCircuitSnapshotOptionalString(parsedTag.label, `Circuit tag ${index} label`);
    const description = expectCircuitSnapshotOptionalString(parsedTag.description, `Circuit tag ${index} description`);
    const initialValue = expectCircuitSnapshotOptionalBoolean(parsedTag.initialValue, `Circuit tag ${index} initialValue`);

    if (!circuitSnapshotTagKinds.has(kind as TagDefinition["kind"])) {
      throw new Error(`Circuit tag ${index} kind "${kind}" is not supported.`);
    }

    return {
      name: expectCircuitSnapshotString(parsedTag.name, `Circuit tag ${index} name`),
      kind: kind as TagDefinition["kind"],
      ...(label !== undefined ? { label } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(initialValue !== undefined ? { initialValue } : {})
    };
  });
}

function parseCircuitSnapshotProgram(value: unknown): Program {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { rungs: [] };
  }

  return Array.isArray((value as { rungs?: unknown }).rungs) ? (value as Program) : { rungs: [] };
}

function parseCircuitSnapshot(value: unknown): CircuitSnapshot {
  const snapshot = expectCircuitSnapshotObject(value, "Circuit snapshot");
  const settings = expectCircuitSnapshotObject(snapshot.settings, "Circuit snapshot settings");
  const scanIntervalMs = expectCircuitSnapshotNumber(settings.scanIntervalMs, "Circuit snapshot settings scanIntervalMs");
  const width = expectCircuitSnapshotOptionalNumber(settings.width, "Circuit snapshot settings width");
  const height = expectCircuitSnapshotOptionalNumber(settings.height, "Circuit snapshot settings height");
  const gridSpacing = expectCircuitSnapshotOptionalNumber(settings.gridSpacing, "Circuit snapshot settings gridSpacing");

  if (!Number.isInteger(scanIntervalMs) || scanIntervalMs < 25) {
    throw new Error("Circuit snapshot scanIntervalMs must be an integer >= 25.");
  }

  const planeSettings = sanitizePlaneSettings({
    ...(gridSpacing !== undefined ? { gridSpacing } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(width !== undefined ? { width } : {})
  });

  return {
    components: expectCircuitSnapshotArray(snapshot.components, "Circuit snapshot components").map((component, index) =>
      parseCircuitSnapshotComponent(component, index)
    ),
    name: expectCircuitSnapshotString(snapshot.name, "Circuit snapshot name"),
    program: parseCircuitSnapshotProgram(snapshot.program),
    savedAt: expectCircuitSnapshotString(snapshot.savedAt, "Circuit snapshot savedAt"),
    settings: {
      gridSpacing: planeSettings.gridSpacing,
      height: planeSettings.height,
      scanIntervalMs,
      width: planeSettings.width
    },
    tags: parseCircuitSnapshotTags(snapshot.tags),
    version: expectCircuitSnapshotNumber(snapshot.version, "Circuit snapshot version"),
    wires: expectCircuitSnapshotArray(snapshot.wires, "Circuit snapshot wires").map((wire, index) =>
      parseCircuitSnapshotWire(wire, index)
    )
  };
}

async function readCircuitSnapshotFile(file: File): Promise<CircuitSnapshot> {
  return parseCircuitSnapshot(JSON.parse(await file.text()));
}

function formatTerminalLabel(terminalId: string): string {
  return terminalId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTerminalDefinition(type: BuilderComponentType, terminalId: string): TerminalDefinition | undefined {
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

function getTerminalApproachAxis(component: BuilderComponent, terminalId: string): "horizontal" | "vertical" {
  const terminal = getTerminalDefinition(component.type, terminalId);

  if (!terminal) {
    return "horizontal";
  }

  const rotatedPoint = rotatePoint({ x: terminal.x, y: terminal.y }, component.rotation);
  const horizontalDistance = Math.abs(rotatedPoint.x - ROTATION_CENTER_X);
  const verticalDistance = Math.abs(rotatedPoint.y - ROTATION_CENTER_Y);

  return horizontalDistance >= verticalDistance ? "horizontal" : "vertical";
}

function getWireEndpointPreferredAxis(
  wire: BuilderWire,
  endpointIndex: number,
  components: BuilderComponent[],
  targetPoint?: Point
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
    const currentAxis = getSegmentAxis(adjacentPoint, endpointPoint);

    if (currentAxis) {
      return currentAxis;
    }
  }

  return "horizontal";
}

function getComponentTerminals(component: BuilderComponent): BuilderTerminal[] {
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

function moveAttachedWireEndpoints(
  wires: BuilderWire[],
  previousComponent: BuilderComponent,
  nextComponent: BuilderComponent
): BuilderWire[] {
  const movedTerminalPoints = new Map(
    getTerminalDefinitions(previousComponent.type).map((terminal) => [
      getPointKey(getTerminalPoint(previousComponent, terminal.id)),
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
    const startTerminal = wire.points[0] ? movedTerminalPoints.get(getPointKey(wire.points[0])) : undefined;
    const endTerminal = wire.points[wire.points.length - 1]
      ? movedTerminalPoints.get(getPointKey(wire.points[wire.points.length - 1] ?? { x: 0, y: 0 }))
      : undefined;

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

    return didMove ? { ...wire, points: normalizeWirePoints(nextPoints) } : wire;
  });
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
  excludeWireId?: ReadonlySet<string> | string
): WireSegmentAnchor | null {
  let nearestAnchor: WireSegmentAnchor | null = null;
  let nearestDistance = SNAP_DISTANCE + 1;

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
    const anchor = findNearestWireSegmentAnchor(terminalPoint, wires, excludeWireIds);

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
  excludeWireIds: ReadonlySet<string>
): WireSegmentAnchor[] {
  const anchors: WireSegmentAnchor[] = [];
  const seenAnchorKeys = new Set<string>();

  for (const terminal of getComponentTerminals(component)) {
    const terminalPoint = { x: terminal.x, y: terminal.y };
    const anchor = findNearestWireSegmentAnchor(terminalPoint, wires, excludeWireIds);

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
      wireAnchor: null
    };
  }

  if (options.allowWireAnchor !== false) {
    const wireAnchor = findNearestWireSegmentAnchor(point, wires, options.excludeWireId);

    if (wireAnchor) {
      return {
        point: wireAnchor.point,
        wireAnchor
      };
    }
  }

  return {
    point: snapPointToGrid(point, planeSettings),
    wireAnchor: null
  };
}

function insertPointIntoWire(points: Point[], insertIndex: number, point: Point): Point[] {
  const roundedPoint = roundPoint(point);
  const previousPoint = points[insertIndex - 1];
  const nextPoint = points[insertIndex];

  if (
    (previousPoint && pointsShareCanonicalCoordinates(previousPoint, roundedPoint))
    || (nextPoint && pointsShareCanonicalCoordinates(nextPoint, roundedPoint))
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

function applyWireAnchors(currentWires: BuilderWire[], anchors: WireSegmentAnchor[]): BuilderWire[] {
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
      nextPoints = insertPointIntoWire(nextPoints, wireAnchor.insertIndex, wireAnchor.point);
    }

    if (nextPoints === wire.points) {
      return wire;
    }

    didChange = true;
    return { ...wire, points: nextPoints };
  });

  return didChange ? nextWires : currentWires;
}

function anchorWireEndpoints(
  points: Point[],
  components: BuilderComponent[],
  wires: BuilderWire[],
  planeSettings: BuilderPlaneSettings,
  excludeWireId?: string,
  allowWireAnchors = true
): { anchors: WireSegmentAnchor[]; points: Point[] } {
  const endpointIndices = [0, points.length - 1];
  const nextPoints = [...points];
  const anchors: WireSegmentAnchor[] = [];

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

    if (snapTarget.wireAnchor) {
      anchors.push(snapTarget.wireAnchor);
    }
  }

  return {
    anchors,
    points: normalizeWirePoints(nextPoints.map(roundPoint))
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
    id: index === 0 ? wire.id : createId(nextId, "builder-wire"),
    points
  }));
}

function createCanvasComponent(
  nextId: { current: number },
  availableTags: TagDefinition[],
  type: BuilderComponentType,
  x: number,
  y: number,
  tagOverride?: string | null
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
    ...(isMaintainedSwitchType(type) ? { isClosed: false } : {}),
    ...(isMomentaryPushButtonType(type) ? { isPressed: false } : {}),
    ...(isSourceType(type) ? { sourceVoltage: getDefaultSourceVoltage(type) } : {})
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
  if (start.x === end.x || start.y === end.y) {
    return createWireWithPoints(nextId, color, [start, end]);
  }

  return createWireWithPoints(nextId, color, [start, { x: end.x, y: start.y }, end]);
}

function buildStarterScene(nextId: { current: number }, availableTags: TagDefinition[]): BuilderScene {
  const source = createCanvasComponent(nextId, availableTags, "POWER_SOURCE", 96, 144);

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
          instruction.tag
        )
      );
    });

    components.push(...rowComponents);

    const breaker = rowComponents[0];

    if (breaker) {
      const breakerEntryPoint = getTerminalPoint(breaker, "in-top");
      const sourceBusX = 264;

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

    if (!component || visitedComponents.has(component.id) || isSourceType(component.type)) {
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
      return component !== undefined && isSourceType(component.type) && port.role === "source";
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
  running: boolean,
  tagValues: Readonly<Record<string, boolean>>,
  previousResolvedTagValues: Readonly<Record<string, boolean>> = EMPTY_TAG_VALUES
): ElectricalState {
  const emptyState: ElectricalState = {
    componentVoltageById: new Map(),
    energizedComponentIds: new Set(),
    energizedNodeIds: new Set(),
    fault: null,
    idleWireCurrentById: new Map(),
    energizedWireCurrentById: new Map(),
    energizedWireIds: new Set(),
    resolvedTagValues: EMPTY_TAG_VALUES
  };

  if (!running) {
    return emptyState;
  }

  const resolvedTagValues = resolvePhysicalInstructionTagValues(
    components,
    wires,
    tagValues,
    previousResolvedTagValues
  );
  const { componentsById, electricalConnections, portsById, wireNodeIdsByWire } = buildElectricalSimulationGraph(
    components,
    wires,
    resolvedTagValues
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

    if (liveLoopNodes.size > 0 && liveLoadComponentIds.size === 0) {
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
        energizedWireIds: new Set()
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
    resolvedTagValues
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
  const wirePointDragState = useRef<WirePointDragState | null>(null);
  const pendingSwitchToggleRef = useRef<{
    componentId: string;
    timeoutId: number;
  } | null>(null);
  const reportedFaultSignatureRef = useRef<string | null>(null);
  const resolvedPhysicalTagValuesRef = useRef<Record<string, boolean>>({});
  const lastProgramSignature = useRef(JSON.stringify({ rungs: [] }));
  const lastBuilderTagsSignature = useRef("[]");
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [wires, setWires] = useState<BuilderWire[]>([]);
  const [planeSettings, setPlaneSettings] = useState<BuilderPlaneSettings>(DEFAULT_PLANE_SETTINGS);
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

  function getCanvasPointFromClient(clientX: number, clientY: number): Point | null {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const bounds = canvas.getBoundingClientRect();
    const zoom = canvasZoomRef.current;

    return {
      x: clamp((clientX - bounds.left) / zoom, 0, planeSettingsRef.current.width),
      y: clamp((clientY - bounds.top) / zoom, 0, planeSettingsRef.current.height)
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
      { allowWireAnchor: false }
    ).point;

    return createOrthogonalPath(currentPoints, snappedPoint, planeSettingsRef.current);
  }

  function updateCanvasZoom(nextZoom: number) {
    const resolvedZoom = clampCanvasZoom(nextZoom);

    if (resolvedZoom === canvasZoomRef.current) {
      return;
    }

    const stageScroll = stageScrollRef.current;
    const currentZoom = canvasZoomRef.current;
    let nextScrollLeft = 0;
    let nextScrollTop = 0;

    if (stageScroll) {
      const viewportCenterX = (stageScroll.scrollLeft + stageScroll.clientWidth / 2) / currentZoom;
      const viewportCenterY = (stageScroll.scrollTop + stageScroll.clientHeight / 2) / currentZoom;
      nextScrollLeft = viewportCenterX * resolvedZoom - stageScroll.clientWidth / 2;
      nextScrollTop = viewportCenterY * resolvedZoom - stageScroll.clientHeight / 2;
    }

    setCanvasZoom(resolvedZoom);

    window.requestAnimationFrame(() => {
      const updatedStageScroll = stageScrollRef.current;

      if (!updatedStageScroll) {
        return;
      }

      updatedStageScroll.scrollLeft = clamp(
        nextScrollLeft,
        0,
        Math.max(planeSettingsRef.current.width * resolvedZoom - updatedStageScroll.clientWidth, 0)
      );
      updatedStageScroll.scrollTop = clamp(
        nextScrollTop,
        0,
        Math.max(planeSettingsRef.current.height * resolvedZoom - updatedStageScroll.clientHeight, 0)
      );
    });
  }

  function commitWireFromPoints(nextPointsInput: Point[]) {
    const nextPoints = normalizeWirePoints(nextPointsInput.map(roundPoint));

    if (nextPoints.length < 2) {
      return;
    }

    const wireId = createId(nextId, "builder-wire");

    setWires((currentWires) => {
      const { anchors, points } = anchorWireEndpoints(
        nextPoints,
        componentsRef.current,
        currentWires,
        planeSettingsRef.current,
        undefined,
        false
      );
      const nextWires = applyWireAnchors(currentWires, anchors);

      return [
        ...nextWires,
        { color: wireColor, id: wireId, points, thickness: wireThickness }
      ];
    });
    setSelection({ kind: "wire", id: wireId });
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
    const resolvedScene = clampSceneToPlane(cloneScene(nextScene), resolvedPlaneSettings);

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
    setIsPanModeEnabled(true);
    paletteDragState.current = null;
    paletteDragMovedRef.current = false;
    panState.current = null;
    dragState.current = null;
    wirePointDragState.current = null;
    componentDragMovedRef.current = false;
    setPaletteDragPreview(null);
    setIsPanning(false);
    setHasCustomLayout(customLayout);
    resolvedPhysicalTagValuesRef.current = {};
    lastProgramSignature.current = nextProgramSignature;
    lastBuilderTagsSignature.current = JSON.stringify(mergeInstructionBindingTags(availableTags, resolvedScene.components));
  }

  useEffect(() => {
    nextId.current = 0;
    const pendingLoadedScene = pendingLoadedSceneRef.current;
    const nextProgramSignature = JSON.stringify(program ?? { rungs: [] });
    const shouldUsePendingScene = pendingLoadedScene !== null && pendingLoadedScene.signature === nextProgramSignature;
    const nextPlaneSettings = shouldUsePendingScene
      ? pendingLoadedScene.planeSettings
      : planeSettingsRef.current;
    const nextAvailableTags = mergeInstructionBindingTags(availableTags, componentsRef.current);
    const nextScene = shouldUsePendingScene
      ? cloneScene(pendingLoadedScene.scene)
      : buildSceneFromProgram(nextId, nextAvailableTags, program);
    const nextDerivedState = deriveProgram(nextScene.components, nextScene.wires);

    if (shouldUsePendingScene) {
      pendingLoadedSceneRef.current = null;
    }

    applySceneState(nextScene, JSON.stringify(nextDerivedState.program), shouldUsePendingScene, nextPlaneSettings);
  }, [availableTags, program]);

  function dragComponentToClientPoint(componentId: string, clientX: number, clientY: number): boolean {
    const point = getCanvasPointFromClient(clientX, clientY);

    if (!point) {
      return false;
    }

    const drag = dragState.current;
    const movedComponent = componentsRef.current.find((component) => component.id === componentId);

    if (!drag || !movedComponent) {
      return false;
    }

    const nextX = clamp(
      point.x - drag.offsetX,
      16,
      planeSettingsRef.current.width - COMPONENT_WIDTH - 16
    );
    const nextY = clamp(
      point.y - drag.offsetY,
      16,
      planeSettingsRef.current.height - COMPONENT_HEIGHT - 16
    );

    if (nextX === movedComponent.x && nextY === movedComponent.y) {
      return false;
    }

    const nextComponent = snapComponentToPlaneGrid(
      { ...movedComponent, x: nextX, y: nextY },
      planeSettingsRef.current
    );
    const nextComponents = componentsRef.current.map((component) =>
      component.id === nextComponent.id ? nextComponent : component
    );
    const nextWires = moveAttachedWireEndpoints(wiresRef.current, movedComponent, nextComponent);

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

    const releasedComponent = componentsRef.current.find((component) => component.id === releasedDragState.componentId);

    if (releasedComponent) {
      const attachedWireIds = getAttachedWireIds(releasedComponent, wiresRef.current);
      const nextWires = applyWireAnchors(
        wiresRef.current,
        collectComponentTerminalWireAnchors(releasedComponent, wiresRef.current, attachedWireIds)
      );

      if (nextWires !== wiresRef.current) {
        wiresRef.current = nextWires;
        setWires(nextWires);
        setHasCustomLayout(true);
      }
    }

    dragState.current = null;
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

            const nextPoint = snapPointToGrid(point, planeSettingsRef.current);

            if (pointsAreClose(currentPoint, nextPoint)) {
              return wire;
            }

            const nextPoints = isWireEndpointIndex(pointIndex, wire.points.length)
              ? repositionWireEndpointOrthogonally(
                wire.points,
                pointIndex,
                nextPoint,
                getWireEndpointPreferredAxis(wire, pointIndex, componentsRef.current, nextPoint)
              )
              : (() => {
                const updatedPoints = [...wire.points];
                updatedPoints[pointIndex] = nextPoint;
                return updatedPoints;
              })();
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

      dragComponentToClientPoint(dragState.current.componentId, event.clientX, event.clientY);
    }

    function handleMouseUp(event: MouseEvent) {
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

        setWires((currentWires) => {
          const releasedWire = currentWires.find((wire) => wire.id === releasedWirePointDragState.wireId);

          if (!releasedWire || !isWireEndpointIndex(releasedWirePointDragState.pointIndex, releasedWire.points.length)) {
            return currentWires;
          }

          const currentPoint = releasedWire.points[releasedWirePointDragState.pointIndex];

          if (!currentPoint) {
            return currentWires;
          }

          const snapTarget = resolveSnapTarget(
            droppedPoint ?? currentPoint,
            componentsRef.current,
            currentWires,
            planeSettingsRef.current,
            { excludeWireId: releasedWire.id }
          );
          const nextWires = snapTarget.wireAnchor ? applyWireAnchors(currentWires, [snapTarget.wireAnchor]) : currentWires;

          return nextWires.map((wire) => {
            if (wire.id !== releasedWire.id) {
              return wire;
            }

            const nextPoints = repositionWireEndpointOrthogonally(
              wire.points,
              releasedWirePointDragState.pointIndex,
              snapTarget.point,
              getWireEndpointPreferredAxis(wire, releasedWirePointDragState.pointIndex, componentsRef.current, snapTarget.point)
            );

            return { ...wire, points: normalizeWirePoints(nextPoints) };
          });
        });
      }

      if (releasedDragState) {
        finalizeComponentDrag(releasedDragState.componentId);
      }

      panState.current = null;
      setIsPanning(false);
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
  const derivedState = deriveProgram(components, wires);
  const electricalState = computeElectricalState(
    components,
    wires,
    running,
    liveTagValues,
    resolvedPhysicalTagValuesRef.current
  );
  const derivedProgramSignature = JSON.stringify(derivedState.program);
  const selectedComponent = selection?.kind === "component"
    ? components.find((component) => component.id === selection.id) ?? null
    : null;
  const selectedWire = selection?.kind === "wire"
    ? wires.find((wire) => wire.id === selection.id) ?? null
    : null;
  const selectedWireInspection = selectedWire ? inspectWire(selectedWire, components) : null;
  const selectedWireStatus = selectedWireInspection ? getWireStatusMeta(selectedWireInspection.status) : null;
  const hasActiveWireDraft = draftWirePoints.length > 0;
  const wireTerminalsEnabled = isWireAuthoringEnabled || wireReconnectTarget !== null;
  const isWirePointerPreviewVisible = wireTerminalsEnabled && (hasActiveWireDraft || wireReconnectTarget !== null);
  const scaledCanvasWidth = planeSettings.width * canvasZoom;
  const scaledCanvasHeight = planeSettings.height * canvasZoom;
  const canvasViewportStyle: CSSProperties = {
    height: scaledCanvasHeight,
    width: scaledCanvasWidth
  };
  const canvasStyle: CSSProperties = {
    ["--grid-spacing" as "--grid-spacing"]: `${planeSettings.gridSpacing}px`,
    ["--major-grid-spacing" as "--major-grid-spacing"]: `${planeSettings.gridSpacing * MAJOR_GRID_MULTIPLIER}px`,
    height: planeSettings.height,
    transform: `scale(${canvasZoom})`,
    width: planeSettings.width
  };
  const zoomPercent = Math.round(canvasZoom * 100);
  const previewPoints = draftWirePoints.length > 0 && cursorPoint !== null
    ? [...draftWirePoints, cursorPoint]
    : draftWirePoints;
  const wireDisplayNodes = Array.from(
    wires.reduce((nodesByPointKey, wire) => {
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
  const syncLabel = hasCustomLayout ? "Playground wiring drives the sim" : "Loaded program seeded into canvas";
  const selectedPaletteType = selectedComponent?.type ?? null;
  const activeWireColor = selectedWire?.color ?? wireColor;
  const activeWireThickness = selectedWire?.thickness ?? wireThickness;
  const selectedComponentVoltage = selectedComponent
    ? electricalState.componentVoltageById.get(selectedComponent.id) ?? 0
    : 0;
  const selectedComponentTerminals = selectedComponent ? getComponentTerminals(selectedComponent) : [];

  useEffect(() => {
    if (!running) {
      resolvedPhysicalTagValuesRef.current = {};
      return;
    }

    resolvedPhysicalTagValuesRef.current = { ...electricalState.resolvedTagValues };
  }, [electricalState.resolvedTagValues, running]);

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

  function createComponent(type: BuilderComponentType, point?: Point): BuilderComponent {
    const componentIndex = components.length;
    const gridSpacing = planeSettingsRef.current.gridSpacing;
    const baseX = gridSpacing * 4;
    const baseY = gridSpacing * 6;
    const stepX = gridSpacing * 8;
    const stepY = gridSpacing * 7;
    const resolvedX = point
      ? clamp(point.x - COMPONENT_WIDTH / 2, 16, planeSettingsRef.current.width - COMPONENT_WIDTH - 16)
      : baseX + (componentIndex % 5) * stepX;
    const resolvedY = point
      ? clamp(point.y - COMPONENT_HEIGHT / 2, 16, planeSettingsRef.current.height - COMPONENT_HEIGHT - 16)
      : baseY + Math.floor(componentIndex / 5) * stepY;

    return snapComponentToPlaneGrid(
      createCanvasComponent(
        nextId,
        builderTags,
        type,
        resolvedX,
        resolvedY
      ),
      planeSettingsRef.current
    );
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
    setIsPanModeEnabled((currentValue) => !currentValue);
  }

  function updatePlaneDimensions(nextPartialSettings: Partial<BuilderPlaneSettings>) {
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
      ? clampSceneToPlane(
        { components: componentsRef.current, wires: wiresRef.current },
        nextPlaneSettings
      )
      : requantizeSceneToPlaneGrid(
        { components: componentsRef.current, wires: wiresRef.current },
        previousPlaneSettings,
        nextPlaneSettings
      );

    planeSettingsRef.current = nextPlaneSettings;
    componentsRef.current = nextScene.components;
    wiresRef.current = nextScene.wires;
    setPlaneSettings(nextPlaneSettings);
    setComponents(nextScene.components);
    setWires(nextScene.wires);
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

  function cutWireSegmentAtPoint(wireId: string, point: Point) {
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
      const snapTarget = resolveSnapTarget(
        point,
        componentsRef.current,
        currentWires,
        planeSettingsRef.current,
        { excludeWireId: wireReconnectTarget.wireId }
      );
      const nextWires = snapTarget.wireAnchor ? applyWireAnchors(currentWires, [snapTarget.wireAnchor]) : currentWires;

      return nextWires.map((wire) => {
        if (wire.id !== wireReconnectTarget.wireId || wire.points.length === 0) {
          return wire;
        }

        const endpointIndex = wireReconnectTarget.endpoint === "start" ? 0 : wire.points.length - 1;
        const nextPoints = repositionWireEndpointOrthogonally(
          wire.points,
          endpointIndex,
          snapTarget.point,
          getWireEndpointPreferredAxis(wire, endpointIndex, componentsRef.current, snapTarget.point)
        );
        return { ...wire, points: normalizeWirePoints(nextPoints) };
      });
    });
    setSelection({ kind: "wire", id: wireReconnectTarget.wireId });
    setHasCustomLayout(true);
    setWireReconnectTarget(null);
  }

  function disconnectWireEndpoint(wireId: string, endpoint: WireEndpointKey) {
    updateWirePoints(wireId, (points) => {
      const detachedPoint = getDetachedWirePoint(points, endpoint, planeSettingsRef.current);

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

    appendDraftPoint(point);
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
        allowWireAnchor: wireReconnectTarget !== null,
        ...(wireReconnectTarget ? { excludeWireId: wireReconnectTarget.wireId } : {})
      }).point);
    }
  }

  function handleFinishWire() {
    commitWireFromPoints(draftWirePoints);
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
    const snapshot = createCircuitSnapshot(
      components,
      wires,
      derivedState.program,
      builderTags,
      scanIntervalMs,
		planeSettingsRef.current
    );

    downloadCircuitSnapshot(snapshot);
    setCircuitSnapshotStatus(`Saved ${snapshot.name}.`);
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
      const nextScene = clampSceneToPlane(cloneScene({ components: snapshot.components, wires: snapshot.wires }), nextPlaneSettings);
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
    if (!isPanModeEnabled || !stageScrollRef.current) {
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
    if (activeComponentDragPointerRef.current) {
      return;
    }

    if (draftWirePoints.length > 0 || wireReconnectTarget !== null) {
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
    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === componentId
          ? { ...component, rotation: normalizeQuarterTurns(component.rotation + direction) }
          : component
      )
    );
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
    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === componentId && isMomentaryPushButtonType(component.type)
          ? { ...component, isPressed: true }
          : component
      )
    );
    setSelection({ kind: "component", id: componentId });
  }

  function releaseMomentaryPushButton(componentId: string) {
    setComponents((currentComponents) =>
      currentComponents.map((component) =>
        component.id === componentId && isMomentaryPushButtonType(component.type) && component.isPressed
          ? { ...component, isPressed: false }
          : component
      )
    );
  }

  function handlePushButtonPointerDown(event: ReactPointerEvent<HTMLButtonElement>, componentId: string) {
    event.preventDefault();
    event.stopPropagation();
    setWireReconnectTarget(null);
    setSelection({ kind: "component", id: componentId });

    const component = componentsRef.current.find((entry) => entry.id === componentId);
    const point = getCanvasPointFromClient(event.clientX, event.clientY);

    if (component && point) {
      componentDragMovedRef.current = false;
      dragState.current = {
        componentId,
        offsetX: point.x - component.x,
        offsetY: point.y - component.y
      };
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    activePushButtonPressRef.current = { componentId, pointerId: event.pointerId };
    pressMomentaryPushButton(componentId);
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

    finalizeComponentDrag(componentId);
    releaseMomentaryPushButton(componentId);
  }

  function handlePushButtonLostCapture(componentId: string) {
    if (activePushButtonPressRef.current?.componentId === componentId) {
      activePushButtonPressRef.current = null;
    }

    finalizeComponentDrag(componentId);
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
                    step="1"
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
                  value={planeSettings.width}
                  onChange={(event) => updatePlaneDimensions({ width: Number(event.target.value) })}
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
                  value={planeSettings.height}
                  onChange={(event) => updatePlaneDimensions({ height: Number(event.target.value) })}
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
                  value={planeSettings.gridSpacing}
                  onChange={(event) => updatePlaneDimensions({ gridSpacing: Number(event.target.value) })}
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
                disabled={selection === null}
              >
                Delete
              </button>
              <button type="button" className="button button--ghost" onClick={handleResetCanvas}>
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

          <section className="builder-card builder-card--components">
            <div className="builder-card__title">Components</div>

            <div className="builder-palette-list">
              {instructionPalette.map((instruction) => (
                <button
                  key={instruction.type}
                  type="button"
                  className={`button button--ghost builder-palette-tile ${selectedPaletteType === instruction.type ? "builder-palette-tile--selected" : ""}`.trim()}
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

                {isMaintainedSwitchType(selectedComponent.type) ? (
                  <button
                    type="button"
                    className={`button ${isMaintainedSwitchClosed(selectedComponent) ? "button--secondary" : "button--primary"} builder-selection__action-button`.trim()}
                    onClick={() => toggleMaintainedSwitch(selectedComponent.id)}
                  >
                    {isMaintainedSwitchClosed(selectedComponent) ? "Open switch" : "Close switch"}
                  </button>
                ) : null}

                {componentNeedsTag(selectedComponent.type) ? (
                  <p className="builder-card__copy">
                    Rename and recolor the symbol here. Matching OTE, XIC, and XIO labels now share the
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
                    {selectedComponent.type === "PUSH_BUTTON_NC"
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
                  {selectedWireStatus?.description ?? "Adjust color and thickness in Tools."} Drag any wire point to reshape it, double-click a bend point to remove it, or double-click a wire segment to cut that span.
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
                <span className="status-pill status-pill--neutral">Move ready</span>
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
              <div className="builder-stage__toolbar-actions">
                <div className="builder-stage__zoom-controls" role="group" aria-label="Canvas zoom">
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
                <button
                  type="button"
                  className={`button ${running ? "button--danger" : "button--primary"} builder-stage__run-button`.trim()}
                  onClick={onRunToggle}
                  disabled={runDisabled || fault !== null}
                >
                  {running ? "Stop" : "Run"}
                </button>
                {fault && onFaultReset ? (
                  <button
                    type="button"
                    className="button button--ghost builder-stage__run-button"
                    onClick={onFaultReset}
                  >
                    Reset fault
                  </button>
                ) : null}
              </div>
          </div>

          <div
            ref={stageScrollRef}
            className={`builder-stage__scroll ${isPanModeEnabled ? "builder-stage__scroll--pan" : ""} ${isPanning ? "builder-stage__scroll--panning" : ""}`.trim()}
            onMouseDown={handleStageScrollMouseDown}
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

                <svg className="freeplay-svg" viewBox={`0 0 ${planeSettings.width} ${planeSettings.height}`} aria-hidden="true">
                  {wires.map((wire) => {
                  const pointString = wire.points.map((point) => `${point.x},${point.y}`).join(" ");
                  const isSelected = selection?.kind === "wire" && selection.id === wire.id;
                  const isEnergized = running && electricalState.energizedWireIds.has(wire.id);
                  const idleCurrentType = electricalState.idleWireCurrentById.get(wire.id) ?? null;
                  const isIdle = running && !isEnergized && idleCurrentType !== null;
                  const energizedCurrentType = electricalState.energizedWireCurrentById.get(wire.id) ?? "ac";
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
                          className={`freeplay-wire freeplay-wire--energized freeplay-wire--energized-${energizedCurrentType}`.trim()}
                          points={pointString}
                          style={{ strokeWidth: wire.thickness + 1.5 }}
                        />
                      ) : isIdle ? (
                        <polyline
                          className={`freeplay-wire freeplay-wire--idle freeplay-wire--idle-${idleCurrentType}`.trim()}
                          points={pointString}
                          style={{ strokeWidth: wire.thickness + 1.1 }}
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
                        onDoubleClick={(event) => {
                          event.stopPropagation();

                          const point = getCanvasPointFromClient(event.clientX, event.clientY);

                          if (!point) {
                            return;
                          }

                          cutWireSegmentAtPoint(wire.id, point);
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

                  const selectedNode = node.hasSelectedOccurrence;

                  return (
                    <circle
                      key={node.key}
                      className={`freeplay-wire__node ${selectedNode ? "freeplay-wire__node--selected" : ""} ${node.hasEndpoint ? "freeplay-wire__node--endpoint" : "freeplay-wire__node--bend"}`.trim()}
                      cx={node.point.x}
                      cy={node.point.y}
                      r={selectedNode ? (node.hasEndpoint ? 6 : 5) : 4}
                      style={{ fill: selectedNode ? primaryOccurrence.color : undefined, stroke: primaryOccurrence.color }}
                      onClick={(event) => {
                        event.stopPropagation();
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
                  const tagActive = componentNeedsTag(component.type)
                    ? getInstructionTagValue(component, electricalState.resolvedTagValues)
                    : false;
                  const coilActive = isCoilType(component.type) && energized;
                  const contactActuated = isContactType(component.type) && tagActive;
                  const contactClosed = isContactType(component.type) && isContactClosed(component, electricalState.resolvedTagValues);
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
                      style={{ left: component.x, top: component.y }}
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
                        onLostPointerCapture={() => handleComponentHandleLostCapture(component.id)}
                        onClick={(event) => {
                          event.stopPropagation();

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
                        onPointerCancel={(event) => handleComponentHandlePointerRelease(event, component.id)}
                        onPointerDown={(event) => handleComponentHandlePointerDown(event, component.id)}
                        onPointerMove={(event) => handleComponentHandlePointerMove(event, component.id)}
                        onPointerUp={(event) => handleComponentHandlePointerRelease(event, component.id)}
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
                      <div
                        className={`freeplay-component__symbol-rotator freeplay-component__symbol-rotator--${getSymbolCategory(component.type)}`.trim()}
                        style={{
                          color: getDefaultComponentColor(component.type),
                          transform: `rotate(${normalizeQuarterTurns(component.rotation) * 90}deg)`
                        }}
                      >
                        {renderSymbolGraphic(component.type, {
                          coilActive,
                          contactActuated,
                          contactClosed,
                          energized: visualEnergized,
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