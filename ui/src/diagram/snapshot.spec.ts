import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CIRCUIT_SNAPSHOT_VERSION } from "../DiagramBuilder";
import { migrateCircuitSnapshot, parseCircuitSnapshot } from "./snapshot";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "snapshot-v1.circuit.json");
const rawV1 = JSON.parse(readFileSync(fixturePath, "utf8")) as unknown;

describe("circuit snapshot v1 fixture (an actual v1 snapshot: version 1, no sheet block)", () => {
  it("migrates to v2 with default sheet metadata and identical circuit data", () => {
    const snapshot = parseCircuitSnapshot(rawV1);

    expect(snapshot.version).toBe(CIRCUIT_SNAPSHOT_VERSION);
    expect(snapshot.version).toBe(2);
    expect(snapshot.name).toBe("Bombeo v1");
    expect(snapshot.components).toHaveLength(7);
    expect(snapshot.wires).toHaveLength(3);
    expect(snapshot.tags.map((tag) => tag.name)).toEqual(["MOTOR", "T_ARRANQUE", "START_PB"]);
    expect(snapshot.program.rungs).toHaveLength(1);
    expect(snapshot.settings).toEqual({ gridSpacing: 18, height: 940, scanIntervalMs: 50, width: 1720 });

    // Sheet defaults: projectName from the circuit name, date from savedAt (YYYY-MM-DD), scale/page defaults.
    expect(snapshot.sheet).toEqual({
      date: "2026-05-04",
      page: "1",
      projectName: "Bombeo v1",
      scale: "1:1"
    });
  });

  it("keeps every v1 component field (raw fields survive migration)", () => {
    const snapshot = parseCircuitSnapshot(rawV1);
    const byId = new Map(snapshot.components.map((component) => [component.id, component]));
    const source = (rawV1 as { components: { id: string }[] }).components;

    expect(byId.get("component-1")?.sourceVoltage).toBe(220);
    expect(byId.get("component-2")?.isClosed).toBe(true);
    expect(byId.get("component-3")?.isPressed).toBe(false);
    expect(byId.get("component-3")?.terminalLabels).toEqual({ in: "A1", out: "A2" });
    expect(byId.get("component-6")?.lampGlowColor).toBe("green");
    expect(byId.get("component-7")?.delayMs).toBe(2500);
    expect(byId.size).toBe(source.length);
  });

  it("defaults a missing selectorPosition to 2 and preserves an explicit 3", () => {
    const raw = JSON.parse(JSON.stringify(rawV1)) as {
      components: Array<Record<string, unknown>>;
    };
    raw.components.push({
      id: "builder-component-selector",
      label: "SEL",
      rotation: 0,
      tag: null,
      type: "SELECTOR_3POS",
      usesCustomLabel: false,
      x: 500,
      y: 300
    });

    const oldSnapshot = parseCircuitSnapshot(raw);
    const oldSelector = oldSnapshot.components.find((component) => component.id === "builder-component-selector");
    expect(oldSelector?.selectorPosition).toBe(2);

    raw.components[raw.components.length - 1]!.selectorPosition = 3;
    const explicitSnapshot = parseCircuitSnapshot(raw);
    const explicitSelector = explicitSnapshot.components.find((component) => component.id === "builder-component-selector");
    expect(explicitSelector?.selectorPosition).toBe(3);
  });

  it("accepts and preserves amber/orange lamp glow colors", () => {
    for (const color of ["amber", "orange"] as const) {
      const raw = JSON.parse(JSON.stringify(rawV1)) as {
        components: Array<{ lampGlowColor?: string; type: string }>;
      };
      const lamp = raw.components.find((component) => component.type === "LAMP");

      expect(lamp).toBeDefined();
      lamp!.lampGlowColor = color;

      const snapshot = parseCircuitSnapshot(raw);
      expect(snapshot.components.find((component) => component.type === "LAMP")?.lampGlowColor).toBe(color);
    }
  });

  it("migrates components, wires, tags and program without loss (v1 -> v2 round trip)", () => {
    const migrated = migrateCircuitSnapshot(rawV1) as Record<string, unknown>;
    const firstParse = parseCircuitSnapshot(rawV1);
    const reparsed = parseCircuitSnapshot(JSON.parse(JSON.stringify(migrated)));

    expect(reparsed).toEqual(firstParse);
    expect(reparsed.version).toBe(2);
  });

  it("round-trips v2 -> v2 idempotently", () => {
    const first = parseCircuitSnapshot(rawV1);
    const second = parseCircuitSnapshot(JSON.parse(JSON.stringify(first)));

    expect(second).toEqual(first);
    expect(second.sheet).toEqual(first.sheet);
  });
});

describe("unknown snapshot versions are rejected", () => {
  it.each([0, 3, 99, "2", null, undefined])("rejects version %j with a clear message", (version) => {
    const raw = { ...(rawV1 as Record<string, unknown>), version };

    expect(() => parseCircuitSnapshot(raw)).toThrow(/no soportada \(soportadas: 1, 2\)/);
  });

  it("rejects a snapshot without a version field", () => {
    const raw = { ...(rawV1 as Record<string, unknown>) };
    delete raw.version;

    expect(() => parseCircuitSnapshot(raw)).toThrow(/no soportada/);
  });

  it("migrateCircuitSnapshot passes v2 through untouched", () => {
    const v2 = migrateCircuitSnapshot(rawV1);
    expect(migrateCircuitSnapshot(v2)).toBe(v2);
  });
});
