import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getComponentTerminals } from "../DiagramBuilder";
import type { BuilderComponent, BuilderPlaneSettings, BuilderWire } from "../DiagramBuilder";
import { clampSceneToPlane, snapComponentToPlaneGrid } from "./grid";
import { resolveWireDisplayPoints } from "./wireRoute";
import { reconcileWireTopology } from "./wireTopology";

const snapshot = JSON.parse(
  readFileSync(new URL("./__fixtures__/vertical-pb-circuit.json", import.meta.url), "utf8")
) as { components: BuilderComponent[]; wires: BuilderWire[] };
const planeSettings: BuilderPlaneSettings = { gridSpacing: 18, height: 940, width: 1720 };

function loadScene() {
  const clamped = clampSceneToPlane(
    { components: snapshot.components, wires: snapshot.wires },
    planeSettings
  );

  return reconcileWireTopology(clamped, planeSettings);
}

function component(type: BuilderComponent["type"], x: number, y: number): BuilderComponent {
  return {
    id: `${type}-${x}-${y}`,
    label: type,
    rotation: 0,
    tag: null,
    type,
    usesCustomLabel: false,
    x,
    y
  };
}

function wire(
  start: BuilderComponent,
  startTerminalId: string,
  end: BuilderComponent,
  endTerminalId: string
): BuilderWire {
  const startTerminal = getComponentTerminals(start).find((terminal) => terminal.terminalId === startTerminalId)!;
  const endTerminal = getComponentTerminals(end).find((terminal) => terminal.terminalId === endTerminalId)!;

  return {
    color: "#111827",
    endPortId: endTerminal.portId,
    id: "wire-under-test",
    points: [{ x: -999, y: -999 }, { x: 999, y: 999 }],
    startPortId: startTerminal.portId,
    thickness: 3.5
  };
}

function expectPointClose(actual: { x: number; y: number }, expected: { x: number; y: number }): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(0.01);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(0.01);
}

describe("saved vertical circuit with common PB/XIC anchors", () => {
  it("keeps both vertical wires straight after load migration", () => {
    const report = loadScene();
    const pushButton = report.scene.components.find((candidate) => candidate.id === "builder-component-4")!;
    const contact = report.scene.components.find((candidate) => candidate.id === "builder-component-18")!;
    const pushButtonTerminals = getComponentTerminals(pushButton);
    const contactTerminals = getComponentTerminals(contact);
    const pushButtonIn = pushButtonTerminals.find((terminal) => terminal.terminalId === "in")!;
    const pushButtonOut = pushButtonTerminals.find((terminal) => terminal.terminalId === "out")!;
    const contactIn = contactTerminals.find((terminal) => terminal.terminalId === "in")!;
    const contactOut = contactTerminals.find((terminal) => terminal.terminalId === "out")!;

    // Con el vano comun 8/152, el pulsador y el contacto comparten X en ambos
    // bornes.
    expect(Math.abs(pushButtonIn.x - contactIn.x)).toBeLessThan(0.01);
    expect(Math.abs(pushButtonOut.x - contactOut.x)).toBeLessThan(0.01);

    for (const [wireId, startTerminal, endTerminal] of [
      ["builder-wire-19", contactIn, pushButtonIn],
      ["builder-wire-22", contactOut, pushButtonOut]
    ] as const) {
      const wire = report.scene.wires.find((candidate) => candidate.id === wireId)!;
      const route = resolveWireDisplayPoints(wire, report.scene.components, planeSettings);

      expect(route).toHaveLength(2);
      expect(Math.abs(route[0]!.x - route[1]!.x)).toBeLessThan(0.01);
      expectPointClose(route[0]!, startTerminal);
      expectPointClose(route[1]!, endTerminal);
    }

    expect(report.removedWireIds).toEqual([]);
  });
});

describe("NO to NCTO vertical wiring", () => {
  it("draws a 2-point vertical when the connected out terminals share X", () => {
    const pushButton = component("PUSH_BUTTON_NO", 324, 399);
    const timer = component("NCTO", 324, 651);
    const pushButtonOut = getComponentTerminals(pushButton).find((terminal) => terminal.terminalId === "out")!;
    const timerOut = getComponentTerminals(timer).find((terminal) => terminal.terminalId === "out")!;
    const alignedTimer = {
      ...timer,
      x: timer.x + (pushButtonOut.x - timerOut.x)
    };
    const alignedTimerOut = getComponentTerminals(alignedTimer).find((terminal) => terminal.terminalId === "out")!;
    const route = resolveWireDisplayPoints(
      wire(pushButton, "out", alignedTimer, "out"),
      [pushButton, alignedTimer],
      planeSettings
    );

    expect(Math.abs(pushButtonOut.x - alignedTimerOut.x)).toBeLessThan(0.01);
    expect(route).toHaveLength(2);
    expect(Math.abs(route[0]!.x - route[1]!.x)).toBeLessThan(0.01);
  });

  it("snaps a component by the out terminal so both out terminals can share X", () => {
    const timer = component("NCTO", 324, 651);
    const snapped = snapComponentToPlaneGrid(timer, planeSettings, "out");
    const outTerminal = getComponentTerminals(snapped).find((terminal) => terminal.terminalId === "out")!;

    expect(
      Math.abs(outTerminal.x / planeSettings.gridSpacing - Math.round(outTerminal.x / planeSettings.gridSpacing))
    ).toBeLessThan(0.01);
  });
});

const ydSnapshot = JSON.parse(
  readFileSync(new URL("./__fixtures__/yd-control.circuit.json", import.meta.url), "utf8")
) as { components: BuilderComponent[]; settings: BuilderPlaneSettings; wires: BuilderWire[] };

describe("Y-Δ reference circuit", () => {
  it("keeps the NCTO return wire straight with the original timer ring centers", () => {
    const report = reconcileWireTopology(
      clampSceneToPlane(
        { components: ydSnapshot.components, wires: ydSnapshot.wires },
        ydSnapshot.settings
      ),
      ydSnapshot.settings
    );
    const ncto = report.scene.components.find((componentUnderTest) => componentUnderTest.id === "builder-component-34")!;
    const nctoOut = getComponentTerminals(ncto).find((terminal) => terminal.terminalId === "out")!;
    const returnWire = report.scene.wires.find((candidate) => candidate.id === "builder-wire-37")!;
    const route = resolveWireDisplayPoints(returnWire, report.scene.components, ydSnapshot.settings);

    expect(route).toHaveLength(2);
    expect(Math.abs(route[0]!.y - route[1]!.y)).toBeLessThan(0.01);
    expect(Math.abs(route[1]!.x - nctoOut.x)).toBeLessThan(0.01);
    expect(Math.abs(route[1]!.y - nctoOut.y))
      .toBeLessThanOrEqual(ydSnapshot.settings.gridSpacing * 0.25 + 0.01);
  });
});
