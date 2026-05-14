import type { InstructionType, Program } from "@plc-sim/ladder-types";

const PROJECT_FORMAT_VERSION = 1;
const DEFAULT_SCAN_INTERVAL_MS = 150;
const STORAGE_KEY = "plc-sim.project-snapshot";

const instructionTypes = new Set<InstructionType>(["XIC", "XIO", "NOTC", "NCTO", "OTE", "OTL", "OTU"]);
const tagKinds = new Set<TagKind>(["input", "output", "internal"]);

export type TagKind = "input" | "output" | "internal";

export interface TagDefinition {
  name: string;
  kind: TagKind;
  label?: string;
  description?: string;
  initialValue?: boolean;
}

export interface ProjectSettings {
  scanIntervalMs: number;
}

export interface ProjectCatalogEntry {
  id: string;
  name: string;
  description?: string;
  programPath: string;
  tagDataPath: string;
  settingsPath: string;
}

export interface ProjectCatalog {
  version: number;
  defaultProjectId: string;
  projects: ProjectCatalogEntry[];
}

export interface ProjectBundle {
  version: number;
  id?: string;
  name: string;
  description?: string;
  program: Program;
  tags: TagDefinition[];
  settings: ProjectSettings;
  inputValues: Record<string, boolean>;
}

export async function loadProjectCatalog(): Promise<ProjectCatalog> {
  const payload = await fetchJson("/settings/project-catalog.json");
  return parseProjectCatalog(payload);
}

export async function loadBuiltInProject(entry: ProjectCatalogEntry): Promise<ProjectBundle> {
  const [programPayload, tagPayload, settingsPayload] = await Promise.all([
    fetchJson(entry.programPath),
    fetchJson(entry.tagDataPath),
    fetchJson(entry.settingsPath)
  ]);

  const tags = parseTagDefinitions(tagPayload);

  return {
    version: PROJECT_FORMAT_VERSION,
    id: entry.id,
    name: entry.name,
    description: entry.description,
    program: parseProgram(programPayload),
    tags,
    settings: parseProjectSettings(settingsPayload),
    inputValues: createInputValues(tags)
  };
}

export function captureInputValues(
  tags: TagDefinition[],
  getTagValue: (tagName: string) => boolean
): Record<string, boolean> {
  const inputValues: Record<string, boolean> = {};

  for (const tag of tags) {
    if (tag.kind === "input") {
      inputValues[tag.name] = getTagValue(tag.name);
    }
  }

  return inputValues;
}

export function hasSavedProjectSnapshot(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) !== null;
}

export function tryLoadSavedProject(): ProjectBundle | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return parseProjectBundle(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveProjectSnapshot(project: ProjectBundle): void {
  window.localStorage.setItem(STORAGE_KEY, serializeProjectBundle(project));
}

export async function readProjectBundleFile(file: File): Promise<ProjectBundle> {
  return parseProjectBundle(JSON.parse(await file.text()));
}

export function downloadProjectBundle(project: ProjectBundle): void {
  const blob = new Blob([serializeProjectBundle(project)], { type: "application/json" });
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = downloadUrl;
  anchor.download = `${slugify(project.name)}.project.json`;
  anchor.click();

  window.URL.revokeObjectURL(downloadUrl);
}

function serializeProjectBundle(project: ProjectBundle): string {
  return JSON.stringify(project, null, 2);
}

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status}).`);
  }

  return response.json();
}

function parseProjectCatalog(value: unknown): ProjectCatalog {
  const catalog = expectObject(value, "Project catalog");
  const projects = expectArray(catalog.projects, "Project catalog projects").map((entry, index) =>
    parseProjectCatalogEntry(entry, index)
  );
  const defaultProjectId = expectString(catalog.defaultProjectId, "Project catalog defaultProjectId");

  if (!projects.some((project) => project.id === defaultProjectId)) {
    throw new Error(`Project catalog defaultProjectId \"${defaultProjectId}\" does not exist.`);
  }

  return {
    version: expectNumber(catalog.version, "Project catalog version"),
    defaultProjectId,
    projects
  };
}

function parseProjectCatalogEntry(value: unknown, index: number): ProjectCatalogEntry {
  const entry = expectObject(value, `Project catalog entry ${index}`);

  return {
    id: expectString(entry.id, `Project catalog entry ${index} id`),
    name: expectString(entry.name, `Project catalog entry ${index} name`),
    description: expectOptionalString(entry.description, `Project catalog entry ${index} description`),
    programPath: expectString(entry.programPath, `Project catalog entry ${index} programPath`),
    tagDataPath: expectString(entry.tagDataPath, `Project catalog entry ${index} tagDataPath`),
    settingsPath: expectString(entry.settingsPath, `Project catalog entry ${index} settingsPath`)
  };
}

function parseProjectBundle(value: unknown): ProjectBundle {
  const bundle = expectObject(value, "Project bundle");
  const tags = parseTagDefinitions(bundle.tags);
  const parsedInputValues = parseBooleanRecord(bundle.inputValues, "Project bundle inputValues");

  return {
    version: expectNumber(bundle.version, "Project bundle version"),
    id: expectOptionalString(bundle.id, "Project bundle id"),
    name: expectString(bundle.name, "Project bundle name"),
    description: expectOptionalString(bundle.description, "Project bundle description"),
    program: parseProgram(bundle.program),
    tags,
    settings: parseProjectSettings(bundle.settings),
    inputValues: createInputValues(tags, parsedInputValues)
  };
}

function parseProjectSettings(value: unknown): ProjectSettings {
  const settings = expectObject(value, "Project settings");
  const scanIntervalMs = expectNumber(settings.scanIntervalMs, "Project settings scanIntervalMs");

  if (!Number.isInteger(scanIntervalMs) || scanIntervalMs < 25) {
    throw new Error("Project settings scanIntervalMs must be an integer >= 25.");
  }

  return { scanIntervalMs };
}

function parseProgram(value: unknown): Program {
  const program = expectObject(value, "Program");
  const rungs = expectArray(program.rungs, "Program rungs").map((rung, rungIndex) => {
    const rungObject = expectObject(rung, `Program rung ${rungIndex}`);
    const instructions = expectArray(rungObject.instructions, `Program rung ${rungIndex} instructions`).map(
      (instruction, instructionIndex) => {
        const instructionObject = expectObject(
          instruction,
          `Program rung ${rungIndex} instruction ${instructionIndex}`
        );
        const type = expectString(
          instructionObject.type,
          `Program rung ${rungIndex} instruction ${instructionIndex} type`
        );

        if (!instructionTypes.has(type as InstructionType)) {
          throw new Error(`Unsupported instruction type \"${type}\".`);
        }

        if (type === "NOTC" || type === "NCTO") {
          const delayMs = expectNumber(
            instructionObject.delayMs,
            `Program rung ${rungIndex} instruction ${instructionIndex} delayMs`
          );

          if (!Number.isInteger(delayMs) || delayMs < 0) {
            throw new Error(
              `Program rung ${rungIndex} instruction ${instructionIndex} delayMs must be an integer >= 0.`
            );
          }

          return {
            delayMs,
            id: expectString(
              instructionObject.id,
              `Program rung ${rungIndex} instruction ${instructionIndex} id`
            ),
            tag: expectString(
              instructionObject.tag,
              `Program rung ${rungIndex} instruction ${instructionIndex} tag`
            ),
            type: type as InstructionType
          };
        }

        return {
          id: expectString(
            instructionObject.id,
            `Program rung ${rungIndex} instruction ${instructionIndex} id`
          ),
          tag: expectString(
            instructionObject.tag,
            `Program rung ${rungIndex} instruction ${instructionIndex} tag`
          ),
          type: type as InstructionType
        };
      }
    );

    return {
      id: expectString(rungObject.id, `Program rung ${rungIndex} id`),
      instructions
    };
  });

  return { rungs };
}

function parseTagDefinitions(value: unknown): TagDefinition[] {
  return expectArray(value, "Tag definitions").map((tag, index) => {
    const tagObject = expectObject(tag, `Tag definition ${index}`);
    const kind = expectString(tagObject.kind, `Tag definition ${index} kind`);

    if (!tagKinds.has(kind as TagKind)) {
      throw new Error(`Unsupported tag kind \"${kind}\".`);
    }

    return {
      name: expectString(tagObject.name, `Tag definition ${index} name`),
      kind: kind as TagKind,
      label: expectOptionalString(tagObject.label, `Tag definition ${index} label`),
      description: expectOptionalString(tagObject.description, `Tag definition ${index} description`),
      initialValue: expectOptionalBoolean(tagObject.initialValue, `Tag definition ${index} initialValue`)
    };
  });
}

function parseBooleanRecord(value: unknown, label: string): Record<string, boolean> {
  if (value === undefined) {
    return {};
  }

  const record = expectObject(value, label);
  const parsed: Record<string, boolean> = {};

  for (const [key, entryValue] of Object.entries(record)) {
    if (typeof entryValue !== "boolean") {
      throw new Error(`${label} entry \"${key}\" must be a boolean.`);
    }

    parsed[key] = entryValue;
  }

  return parsed;
}

function createInputValues(
  tags: TagDefinition[],
  overrides: Record<string, boolean> = {}
): Record<string, boolean> {
  const inputValues: Record<string, boolean> = {};

  for (const tag of tags) {
    if (tag.kind === "input") {
      inputValues[tag.name] = overrides[tag.name] ?? tag.initialValue ?? false;
    }
  }

  return inputValues;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "plc-sim-project";
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function expectOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectString(value, label);
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function expectOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}