import {
  CIRCUIT_SNAPSHOT_VERSION,
  DEFAULT_TIMED_CONTACT_DELAY_MS,
  GENERATED_INSTRUCTION_TAG_PREFIX,
  LAMP_GLOW_COLOR_OPTIONS,
  clampTimedContactDelayMs,
  componentNeedsTag,
  getComponentTerminals,
  isTimedContactType
} from "../DiagramBuilder";
import type {
  BuilderComponent,
  BuilderComponentType,
  BuilderPlaneSettings,
  BuilderWire,
  CircuitSnapshot,
  LampGlowColorOption,
  Point
} from "../DiagramBuilder";
import type { Program } from "@plc-sim/ladder-types";
import type { TagDefinition } from "../projectData";
import { pointsAreClose, sanitizePlaneSettings } from "./grid";
import { createDefaultSheetMetadata } from "./sheet";
import type { SheetMetadata } from "./sheet";
const circuitSnapshotComponentTypes = new Set<BuilderComponentType>([
  "POWER_SOURCE",
  "DC_SOURCE",
  "BREAKER_1P",
  "BREAKER_2P",
  "SWITCH_1P",
  "PUSH_BUTTON_NO",
  "PUSH_BUTTON_NC",
  "ESTOP",
  "SELECTOR_3POS",
  "LIMIT_SWITCH_NO",
  "LIMIT_SWITCH_NC",
  "OL_CONTACT",
  "LAMP",
  "MOTOR",
  "XIC",
  "XIO",
  "NOTC",
  "NCTO",
  "OTE",
  "OTL",
  "OTU"
]);

const circuitSnapshotTagKinds = new Set<TagDefinition["kind"]>(["input", "output", "internal"]);

export function normalizeInstructionLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isGeneratedInstructionTag(tag: string): boolean {
  return tag.startsWith(GENERATED_INSTRUCTION_TAG_PREFIX);
}

export function readGeneratedInstructionLabel(tag: string): string | null {
  if (!isGeneratedInstructionTag(tag)) {
    return null;
  }

  try {
    return decodeURIComponent(tag.slice(GENERATED_INSTRUCTION_TAG_PREFIX.length));
  } catch {
    return null;
  }
}

export function createGeneratedInstructionTag(label: string): string {
  const normalizedLabel = normalizeInstructionLabel(label);
  const canonicalLabel = normalizedLabel === "" ? "UNNAMED" : normalizedLabel.toUpperCase();

  return `${GENERATED_INSTRUCTION_TAG_PREFIX}${encodeURIComponent(canonicalLabel)}`;
}

export function syncInstructionComponentTag(component: BuilderComponent): BuilderComponent {
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

export function slugifyFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "plc-sim-circuit";
}

export function formatSnapshotTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export function createCircuitSnapshot(
  components: BuilderComponent[],
  wires: BuilderWire[],
  program: Program,
  tags: TagDefinition[],
  scanIntervalMs: number,
	planeSettings: BuilderPlaneSettings,
  sheet: SheetMetadata
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
    sheet: { ...sheet },
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

export function downloadCircuitSnapshot(snapshot: CircuitSnapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${slugifyFileName(snapshot.name)}-${formatSnapshotTimestamp(new Date(snapshot.savedAt))}.circuit.json`;
  anchor.click();

  window.URL.revokeObjectURL(url);
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

function expectCircuitSnapshotOptionalNullableString(value: unknown, label: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
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

function findSnapshotTerminalPortId(point: Point, components: BuilderComponent[]): string | null {
  for (const component of components) {
    for (const terminal of getComponentTerminals(component)) {
      if (pointsAreClose(point, terminal)) {
        return terminal.portId;
      }
    }
  }

  return null;
}

function restoreLegacyCircuitSnapshotWireEndpoints(
  wire: BuilderWire,
  components: BuilderComponent[],
  options: { inferEndPortId: boolean; inferStartPortId: boolean }
): BuilderWire {
  if (!options.inferStartPortId && !options.inferEndPortId) {
    return wire;
  }

  const nextPoints = [...wire.points];
  let startPortId = wire.startPortId;
  let endPortId = wire.endPortId;

  if (options.inferStartPortId) {
    const startPoint = nextPoints[0];
    const inferredStartPortId = startPoint ? findSnapshotTerminalPortId(startPoint, components) : null;

    if (inferredStartPortId) {
      startPortId = inferredStartPortId;
    }
  }

  if (options.inferEndPortId) {
    const endPointIndex = nextPoints.length - 1;
    const endPoint = nextPoints[endPointIndex];
    const inferredEndPortId = endPoint ? findSnapshotTerminalPortId(endPoint, components) : null;

    if (inferredEndPortId) {
      endPortId = inferredEndPortId;
    }
  }

  if (startPortId === wire.startPortId && endPortId === wire.endPortId) {
    return wire;
  }

  return {
    ...wire,
    endPortId,
    startPortId
  };
}

function parseCircuitSnapshotWire(value: unknown, index: number, components: BuilderComponent[]): BuilderWire {
  const wire = expectCircuitSnapshotObject(value, `Circuit wire ${index}`);
  const hasSavedStartPortId = Object.prototype.hasOwnProperty.call(wire, "startPortId");
  const hasSavedEndPortId = Object.prototype.hasOwnProperty.call(wire, "endPortId");
  const startPortId = expectCircuitSnapshotOptionalNullableString(wire.startPortId, `Circuit wire ${index} startPortId`);
  const endPortId = expectCircuitSnapshotOptionalNullableString(wire.endPortId, `Circuit wire ${index} endPortId`);

  const parsedWire: BuilderWire = {
    color: expectCircuitSnapshotString(wire.color, `Circuit wire ${index} color`),
    endPortId: endPortId ?? null,
    id: expectCircuitSnapshotString(wire.id, `Circuit wire ${index} id`),
    points: expectCircuitSnapshotArray(wire.points, `Circuit wire ${index} points`).map((point, pointIndex) =>
      parseCircuitSnapshotPoint(point, `Circuit wire ${index} point ${pointIndex}`)
    ),
    startPortId: startPortId ?? null,
    thickness: expectCircuitSnapshotNumber(wire.thickness, `Circuit wire ${index} thickness`)
  };

  return restoreLegacyCircuitSnapshotWireEndpoints(parsedWire, components, {
    inferEndPortId: !hasSavedEndPortId,
    inferStartPortId: !hasSavedStartPortId
  });
}

function parseCircuitSnapshotSelectorPosition(
  value: unknown,
  index: number
): 1 | 2 | 3 {
  if (value === undefined) {
    return 2;
  }

  const position = expectCircuitSnapshotNumber(value, `Circuit component ${index} selectorPosition`);

  if (position === 1 || position === 2 || position === 3) {
    return position;
  }

  throw new Error(`Circuit component ${index} selectorPosition "${position}" is not supported.`);
}

function parseCircuitSnapshotLampGlowColor(value: unknown, index: number): LampGlowColorOption | undefined {
  const lampGlowColor = expectCircuitSnapshotOptionalString(value, `Circuit component ${index} lampGlowColor`);

  if (lampGlowColor === undefined) {
    return undefined;
  }

  if (LAMP_GLOW_COLOR_OPTIONS.some((option) => option.value === lampGlowColor)) {
    return lampGlowColor as LampGlowColorOption;
  }

  throw new Error(`Circuit component ${index} lampGlowColor "${lampGlowColor}" is not supported.`);
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
  const delayMs = component.delayMs !== undefined
    ? expectCircuitSnapshotNumber(component.delayMs, `Circuit component ${index} delayMs`)
    : undefined;
  const sourceVoltage = component.sourceVoltage !== undefined
    ? expectCircuitSnapshotNumber(component.sourceVoltage, `Circuit component ${index} sourceVoltage`)
    : undefined;
  const lampGlowColor = parseCircuitSnapshotLampGlowColor(component.lampGlowColor, index);
  const selectorPosition = type === "SELECTOR_3POS"
    ? parseCircuitSnapshotSelectorPosition(component.selectorPosition, index)
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
    ...(isTimedContactType(type as BuilderComponentType)
      ? { delayMs: clampTimedContactDelayMs(delayMs ?? DEFAULT_TIMED_CONTACT_DELAY_MS) }
      : {}),
    ...(terminalLabels ? { terminalLabels } : {}),
    ...(isClosed !== undefined ? { isClosed } : {}),
    ...(isPressed !== undefined ? { isPressed } : {}),
    ...(type === "LAMP" && lampGlowColor !== undefined ? { lampGlowColor } : {}),
    ...(selectorPosition !== undefined ? { selectorPosition } : {}),
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

/** Whitelist-parses the `sheet` block; missing/partial v2 `sheet` falls back to defaults (defense, not migration). */
function parseCircuitSnapshotSheet(value: unknown, fallbackProjectName: string, savedAt: string): SheetMetadata {
  const defaults = createDefaultSheetMetadata(fallbackProjectName, savedAt);

  if (value === undefined) {
    return defaults;
  }

  const sheet = expectCircuitSnapshotObject(value, "Circuit snapshot sheet");

  return {
    date: expectCircuitSnapshotOptionalString(sheet.date, "Circuit snapshot sheet date") ?? defaults.date,
    page: expectCircuitSnapshotOptionalString(sheet.page, "Circuit snapshot sheet page") ?? defaults.page,
    projectName: expectCircuitSnapshotOptionalString(sheet.projectName, "Circuit snapshot sheet projectName") ?? defaults.projectName,
    scale: expectCircuitSnapshotOptionalString(sheet.scale, "Circuit snapshot sheet scale") ?? defaults.scale
  };
}

/**
 * Normalizes any supported snapshot to the current version. v1 (no `sheet`) gains default
 * title-block metadata; v2 passes through; anything else is rejected explicitly.
 */
export function migrateCircuitSnapshot(value: unknown): unknown {
  const snapshot = expectCircuitSnapshotObject(value, "Circuit snapshot");

  if (snapshot.version === 1) {
    const name = typeof snapshot.name === "string" && snapshot.name.trim() !== "" ? snapshot.name : "PLC Sim circuit";
    const savedAt = typeof snapshot.savedAt === "string" ? snapshot.savedAt : "";

    return {
      ...snapshot,
      sheet: createDefaultSheetMetadata(name, savedAt),
      version: 2
    };
  }

  if (snapshot.version === CIRCUIT_SNAPSHOT_VERSION) {
    return snapshot;
  }

  throw new Error(`Circuit snapshot version ${String(snapshot.version)} no soportada (soportadas: 1, ${CIRCUIT_SNAPSHOT_VERSION}).`);
}

export function parseCircuitSnapshot(value: unknown): CircuitSnapshot {
  const migrated = migrateCircuitSnapshot(value);
  const snapshot = expectCircuitSnapshotObject(migrated, "Circuit snapshot");
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
  const components = expectCircuitSnapshotArray(snapshot.components, "Circuit snapshot components").map((component, index) =>
    parseCircuitSnapshotComponent(component, index)
  );
  const name = expectCircuitSnapshotString(snapshot.name, "Circuit snapshot name");
  const savedAt = expectCircuitSnapshotString(snapshot.savedAt, "Circuit snapshot savedAt");

  return {
    components,
    name,
    program: parseCircuitSnapshotProgram(snapshot.program),
    savedAt,
    sheet: parseCircuitSnapshotSheet(snapshot.sheet, name, savedAt),
    settings: {
      gridSpacing: planeSettings.gridSpacing,
      height: planeSettings.height,
      scanIntervalMs,
      width: planeSettings.width
    },
    tags: parseCircuitSnapshotTags(snapshot.tags),
    version: CIRCUIT_SNAPSHOT_VERSION,
    wires: expectCircuitSnapshotArray(snapshot.wires, "Circuit snapshot wires").map((wire, index) =>
      parseCircuitSnapshotWire(wire, index, components)
    )
  };
}

export async function readCircuitSnapshotFile(file: File): Promise<CircuitSnapshot> {
  return parseCircuitSnapshot(JSON.parse(await file.text()));
}
