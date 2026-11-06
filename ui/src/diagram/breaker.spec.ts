import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeElectricalState,
  getComponentTerminals,
  isBreakerClosed
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType, BuilderWire } from "../DiagramBuilder";

let sequence = 0;

function component(
  type: BuilderComponentType,
  x: number,
  y: number,
  extra: Partial<BuilderComponent> = {}
): BuilderComponent {
  sequence += 1;

  return {
    id: `breaker-fixture-${sequence}`,
    label: type,
    rotation: 0,
    tag: null,
    type,
    usesCustomLabel: false,
    x,
    y,
    ...extra
  };
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
    id: `breaker-wire-${sequence}`,
    points: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }],
    startPortId: start.portId,
    thickness: 3.5
  };
}

function buildCircuit(
  breakerType: "BREAKER_1P" | "BREAKER_2P" | "FUSE",
  isClosed?: boolean
): { breaker: BuilderComponent; components: BuilderComponent[]; lamp: BuilderComponent; wires: BuilderWire[] } {
  const source = component("POWER_SOURCE", 40, 40, { sourceVoltage: 120 });
  const breaker = component(breakerType, 220, 40, isClosed === undefined ? {} : { isClosed });
  const lamp = component("LAMP", 400, 40);
  const [inputTerminal, outputTerminal] = breakerType === "BREAKER_2P"
    ? ["in-top", "out-top"]
    : ["in", "out"];

  return {
    breaker,
    components: [source, breaker, lamp],
    lamp,
    wires: [
      wire(source, "right", breaker, inputTerminal),
      wire(breaker, outputTerminal, lamp, "in"),
      wire(lamp, "out", source, "left")
    ]
  };
}

describe("non-operable breakers", () => {
  it("conducts with false, true, or missing old isClosed through stop and restart", () => {
    for (const breakerType of ["BREAKER_1P", "BREAKER_2P", "FUSE"] as const) {
      for (const isClosed of [false, true, undefined] as const) {
        const circuit = buildCircuit(breakerType, isClosed);

        expect(isBreakerClosed(circuit.breaker)).toBe(true);

        const stopped = computeElectricalState(circuit.components, circuit.wires, false, {});
        expect(stopped.fault).toBeNull();
        expect(stopped.energizedComponentIds.has(circuit.lamp.id)).toBe(false);

        const running = computeElectricalState(circuit.components, circuit.wires, true, {});
        expect(running.fault).toBeNull();
        expect(running.energizedComponentIds.has(circuit.lamp.id)).toBe(true);
        expect(isBreakerClosed(circuit.breaker)).toBe(true);

        const restarted = computeElectricalState(circuit.components, circuit.wires, true, {});
        expect(restarted.fault).toBeNull();
        expect(restarted.energizedComponentIds.has(circuit.lamp.id)).toBe(true);
        expect(isBreakerClosed(circuit.breaker)).toBe(true);
      }
    }
  });

  it("reports breaker and open-state counts from the repository fixtures", () => {
    const fixturesDirectory = new URL("./__fixtures__/", import.meta.url);
    const breakers = readdirSync(fixturesDirectory)
      .filter((fileName) => fileName.endsWith(".json"))
      .flatMap((fileName) => {
        const snapshot = JSON.parse(
          readFileSync(new URL(fileName, fixturesDirectory), "utf8")
        ) as { components?: Array<Record<string, unknown>> };

        return (snapshot.components ?? []).filter(
          (entry) => entry.type === "BREAKER_1P" || entry.type === "BREAKER_2P"
        );
      });
    const openBreakers = breakers.filter((entry) => entry.isClosed === false);

    console.log(
      `[breakers] repo fixtures: ${breakers.length} breakers, ${openBreakers.length} with stored isClosed:false`
    );

    expect(breakers.length).toBeGreaterThan(0);
    expect(openBreakers).toHaveLength(0);
  });
});
