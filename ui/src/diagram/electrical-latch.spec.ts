import { describe, expect, it } from "vitest";
import {
  getComponentTerminals,
  resolvePhysicalInstructionTagValues
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderWire } from "../DiagramBuilder";

let sequence = 0;

function component(type: string, x: number, y: number, extra: Partial<BuilderComponent> = {}): BuilderComponent {
  sequence += 1;

  return {
    id: `c${sequence}`,
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

function terminal(owner: BuilderComponent, terminalId: string) {
  const match = getComponentTerminals(owner).find((entry) => entry.terminalId === terminalId);

  if (!match) {
    throw new Error(`terminal ${terminalId} not found on ${owner.type}`);
  }

  return { portId: match.portId, point: { x: match.x, y: match.y } };
}

function wire(
  from: BuilderComponent,
  fromTerminal: string,
  to: BuilderComponent,
  toTerminal: string
): BuilderWire {
  sequence += 1;
  const start = terminal(from, fromTerminal);
  const end = terminal(to, toTerminal);

  return {
    color: "#111827",
    endPortId: end.portId,
    id: `w${sequence}`,
    points: [start.point, end.point],
    startPortId: start.portId,
    thickness: 3.5
  };
}

function buildScene(estopPressed: boolean, startPressed: boolean, latchClosed: boolean) {
  const source = component("POWER_SOURCE", 40, 40);
  const estop = component("ESTOP", 240, 40, { isPressed: estopPressed });
  const start = component("PUSH_BUTTON_NO", 440, 40, { isPressed: startPressed });
  const contact = component("XIC", 440, 240, { tag: "A" });
  const coil = component("OTE", 640, 40, { tag: "A" });

  const wires = [
    wire(source, "right", estop, "in"),
    wire(estop, "out", start, "in"),
    wire(start, "out", coil, "in"),
    wire(estop, "out", contact, "in"),
    wire(contact, "out", coil, "in"),
    wire(coil, "out", source, "left")
  ];

  return {
    components: [source, estop, start, contact, coil],
    wires,
    latched: latchClosed ? { A: true } : {}
  };
}

function resolve(latchClosed: boolean, estopPressed: boolean, startPressed: boolean, previous: Record<string, boolean>) {
  const scene = buildScene(estopPressed, startPressed, latchClosed);
  const result = resolvePhysicalInstructionTagValues(scene.components, scene.wires, {}, previous);

  return result.resolvedTagValues.A === true;
}

describe("latch con E-stop", () => {  it("energiza A con el pulsador de marcha y el E-stop en reposo", () => {
    expect(resolve(false, false, true, {})).toBe(true);
  });

  it("mantiene A enclavado al soltar la marcha (contacto A en paralelo)", () => {
    expect(resolve(true, false, false, { A: true })).toBe(true);
  });

  it("corta A cuando el E-stop esta accionado", () => {
    expect(resolve(true, true, false, { A: true })).toBe(false);
  });

  it("vuelve a energizar A al liberar el E-stop con la marcha pulsada", () => {
    expect(resolve(false, false, true, {})).toBe(true);
  });
});
