import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeElectricalState,
  getComponentTerminals,
  resolvePhysicalInstructionTagValues
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderWire } from "../DiagramBuilder";

let sequence = 0;

function component(type: string, x: number, y: number, extra: Partial<BuilderComponent> = {}): BuilderComponent {
  sequence += 1;

  return {
    id: `component-${sequence}`,
    label: type,
    rotation: 0,
    tag: null,
    type,
    usesCustomLabel: false,
    x,
    y,
    ...extra
  } as BuilderComponent;
}

function wire(
  from: BuilderComponent,
  fromTerminal: string,
  to: BuilderComponent,
  toTerminal: string
): BuilderWire {
  sequence += 1;
  const start = getComponentTerminals(from).find((terminal) => terminal.terminalId === fromTerminal)!;
  const end = getComponentTerminals(to).find((terminal) => terminal.terminalId === toTerminal)!;

  return {
    color: "#111827",
    endPortId: end.portId,
    id: `wire-${sequence}`,
    points: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }],
    startPortId: start.portId,
    thickness: 3.5
  };
}

function buildTimerScene(switchClosed: boolean) {
  const source = component("POWER_SOURCE", 40, 40);
  const start = component("SWITCH_1P", 240, 40, { isClosed: switchClosed });
  const coil = component("OTE", 440, 40, { tag: "T" });
  const timer = component("NOTC", 440, 240, { tag: "T", delayMs: 1000 });
  const wires = [
    wire(source, "right", start, "in"),
    wire(start, "out", coil, "in"),
    wire(coil, "out", source, "left")
  ];

  return { components: [source, start, coil, timer], timer, wires };
}

describe("timed contact reset", () => {
  it("resets its timer when the coil tag de-energizes", () => {
    const scene = buildTimerScene(true);
    const timerId = scene.timer.id;
    let tags: Record<string, boolean> = {};
    let timed: Record<string, { actuationElapsedMs: number; elapsedMs: number }> = {};

    for (let tick = 0; tick < 50; tick += 1) {
      const result = resolvePhysicalInstructionTagValues(
        scene.components,
        scene.wires,
        {},
        tags,
        timed,
        150
      );
      tags = result.resolvedTagValues;
      timed = result.timedContactStateByComponentId;
    }

    expect(tags.T).toBe(true);
    expect(timed[timerId]?.elapsedMs ?? 0).toBeGreaterThan(0);

    const openedComponents = scene.components.map((entry) =>
      entry.type === "SWITCH_1P" ? { ...entry, isClosed: false } : entry
    );
    const result = resolvePhysicalInstructionTagValues(
      openedComponents,
      scene.wires,
      {},
      tags,
      timed,
      150
    );

    expect(result.resolvedTagValues.T).toBe(false);
    expect(result.timedContactStateByComponentId[timerId]).toBeUndefined();

    const electrical = computeElectricalState(openedComponents, scene.wires, true, {});
    expect(electrical.timedContactStateByComponentId[timerId]).toBeUndefined();
  });
});

function buildOffDelayScene(type: "NOTO" | "NCTC", delayMs: number) {
  const source = component("POWER_SOURCE", 40, 40);
  const start = component("SWITCH_1P", 240, 40, { isClosed: true });
  const driver = component("OTE", 440, 40, { tag: "T" });
  const output = component("OTE", 440, 240, { tag: "U" });
  const timer = component(type, 240, 240, { tag: "T", delayMs });
  const wires = [
    wire(source, "right", start, "in"),
    wire(start, "out", driver, "in"),
    wire(driver, "out", source, "left"),
    wire(source, "right", timer, "in"),
    wire(timer, "out", output, "in"),
    wire(output, "out", source, "left")
  ];

  return { components: [source, start, driver, output, timer], timer, wires };
}

describe("off-delay UI preview", () => {
  for (const type of ["NOTO", "NCTC"] as const) {
    it(`${type}: immediate actuation, delayed return, cancel and restart`, () => {
      const scene = buildOffDelayScene(type, 500);
      const restOutput = type === "NCTC";
      let tags: Record<string, boolean> = {};
      let timed: Record<string, { actuationElapsedMs: number; elapsedMs: number }> = {};
      const step = (startClosed: boolean, elapsedMs: number) => {
        const components = scene.components.map((entry) =>
          entry.id === scene.components[1]!.id ? { ...entry, isClosed: startClosed } : entry
        );
        const result = resolvePhysicalInstructionTagValues(
          components,
          scene.wires,
          {},
          tags,
          timed,
          elapsedMs
        );
        tags = result.resolvedTagValues;
        timed = result.timedContactStateByComponentId;
      };

      step(true, 0);
      expect(tags.T).toBe(true);
      expect(tags.U).toBe(!restOutput);
      expect(timed[scene.timer.id]?.elapsedMs).toBe(0);

      step(false, 100);
      expect(tags.T).toBe(false);
      expect(tags.U).toBe(!restOutput);
      expect(timed[scene.timer.id]?.elapsedMs).toBe(100);

      step(false, 400);
      expect(tags.U).toBe(restOutput);
      expect(timed[scene.timer.id]).toBeUndefined();

      step(true, 0);
      expect(tags.U).toBe(!restOutput);
      expect(timed[scene.timer.id]?.elapsedMs).toBe(0);

      step(false, 100);
      expect(tags.U).toBe(!restOutput);
      expect(timed[scene.timer.id]?.elapsedMs).toBe(100);

      step(true, 0);
      expect(tags.U).toBe(!restOutput);
      expect(timed[scene.timer.id]?.elapsedMs).toBe(0);

      step(false, 100);
      expect(timed[scene.timer.id]?.elapsedMs).toBe(100);
      step(false, 400);
      expect(tags.U).toBe(restOutput);
      expect(timed[scene.timer.id]).toBeUndefined();
    });

    it(`${type}: delay 0 behaves like a plain contact`, () => {
      const scene = buildOffDelayScene(type, 0);
      const restOutput = type === "NCTC";
      let tags: Record<string, boolean> = {};
      let timed: Record<string, { actuationElapsedMs: number; elapsedMs: number }> = {};
      const step = (startClosed: boolean) => {
        const components = scene.components.map((entry) =>
          entry.id === scene.components[1]!.id ? { ...entry, isClosed: startClosed } : entry
        );
        const result = resolvePhysicalInstructionTagValues(components, scene.wires, {}, tags, timed, 0);
        tags = result.resolvedTagValues;
        timed = result.timedContactStateByComponentId;
      };

      step(true);
      expect(tags.U).toBe(!restOutput);

      step(false);
      expect(tags.U).toBe(restOutput);
      expect(timed[scene.timer.id]).toBeUndefined();
    });
  }
});

const timerCascade = JSON.parse(
  readFileSync(new URL("./__fixtures__/timer-cascade.circuit.json", import.meta.url), "utf8")
) as { components: BuilderComponent[]; wires: BuilderWire[] };

describe("timer cascade cycle", () => {
  it("keeps CR1 latched but resets the timer contacts after a cycle", () => {
    let tags: Record<string, boolean> = {};
    let timed: Record<string, { actuationElapsedMs: number; elapsedMs: number }> = {};
    const timerIds = ["builder-component-25", "builder-component-37", "builder-component-53"];
    const doneTimerIds = new Set<string>();
    let sawReset = false;

    for (let tick = 0; tick < 220; tick += 1) {
      const pressed = tick >= 2 && tick < 6;
      const components = timerCascade.components.map((component) =>
        component.id === "builder-component-4" ? { ...component, isPressed: pressed } : component
      );
      const result = resolvePhysicalInstructionTagValues(
        components,
        timerCascade.wires,
        {},
        tags,
        timed,
        150
      );
      tags = result.resolvedTagValues;
      timed = result.timedContactStateByComponentId;

      for (const timerId of timerIds) {
        const state = timed[timerId];

        if (state && state.elapsedMs >= 5000) {
          doneTimerIds.add(timerId);
        }

        if (doneTimerIds.has(timerId) && !state) {
          sawReset = true;
        }
      }
    }

    expect(tags["__builder_label__:CR1"]).toBe(true);
    expect(sawReset).toBe(true);

    const openedComponents = timerCascade.components.map((component) =>
      component.id === "builder-component-7" ? { ...component, isClosed: false } : component
    );
    const openedResult = resolvePhysicalInstructionTagValues(
      openedComponents,
      timerCascade.wires,
      {},
      tags,
      timed,
      150
    );

    expect(openedResult.resolvedTagValues["__builder_label__:CR1"]).toBe(false);

    for (const timerId of timerIds) {
      expect(openedResult.timedContactStateByComponentId[timerId]).toBeUndefined();
    }
  });
});

describe("coil short regression", () => {
  it("still reports a load-free loop while the coil is energized", () => {
    const source = component("POWER_SOURCE", 40, 40);
    const coil = component("OTE", 440, 40, { tag: "T" });
    const shortingContact = component("XIC", 440, 240, { tag: "T" });
    const wires = [
      wire(source, "right", coil, "in"),
      wire(coil, "out", source, "left"),
      wire(coil, "in", shortingContact, "in"),
      wire(coil, "out", shortingContact, "out")
    ];
    const electrical = computeElectricalState(
      [source, coil, shortingContact],
      wires,
      true,
      {}
    );

    expect(electrical.fault?.kind).toBe("short-circuit");
  });
});
