import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  computeElectricalState,
  getComponentTerminals,
  getDefaultEntryTerminalId,
  getTerminalDefinition
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType, BuilderPlaneSettings, BuilderWire } from "../DiagramBuilder";
import { snapComponentToPlaneGrid } from "./grid";
import { renderSelector3Pos, SELECTOR_3POS_RING_CENTERS } from "./selector3pos";
import { SELECTOR_3POS_RING_RADII } from "./selector3posArt.generated";
import { createCircuitSnapshot, parseCircuitSnapshot } from "./snapshot";
import { createDefaultSheetMetadata } from "./sheet";
import { resolveWireDisplayPoints } from "./wireRoute";

const settings: BuilderPlaneSettings = { gridSpacing: 18, height: 20000, width: 4200 };
let sequence = 0;

function component(
  type: BuilderComponentType,
  x: number,
  y: number,
  extra: Partial<BuilderComponent> = {}
): BuilderComponent {
  sequence += 1;

  return {
    id: `selector-${sequence}`,
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

function terminal(owner: BuilderComponent, terminalId: string) {
  const match = getComponentTerminals(owner).find((entry) => entry.terminalId === terminalId);

  if (!match) {
    throw new Error(`terminal ${terminalId} not found on ${owner.type}`);
  }

  return { point: { x: match.x, y: match.y }, portId: match.portId };
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
    id: `selector-wire-${sequence}`,
    points: [start.point, end.point],
    startPortId: start.portId,
    thickness: 2
  };
}

function onGrid(value: number): boolean {
  return Math.abs(value / settings.gridSpacing - Math.round(value / settings.gridSpacing)) < 0.0001;
}

function buildCircuit(position: 1 | 2 | 3) {
  const source = component("POWER_SOURCE", 40, 40);
  const selector = component("SELECTOR_3POS", 320, 240, { selectorPosition: position });
  const lampA = component("LAMP", 640, 240);
  const lampB = component("LAMP", 640, 440);

  const wires = [
    wire(source, "right", selector, "in1"),
    wire(selector, "out1", lampA, "in"),
    wire(lampA, "out", source, "left"),
    wire(source, "right", selector, "in2"),
    wire(selector, "out2", lampB, "in"),
    wire(lampB, "out", source, "left")
  ];

  return { components: [source, selector, lampA, lampB], lampA, lampB, wires };
}

describe("SELECTOR_3POS", () => {
  it("derives all four terminal anchors from the shared ring centers", () => {
    for (const ringId of ["in1", "out1", "in2", "out2"] as const) {
      const ringCenter = SELECTOR_3POS_RING_CENTERS[ringId];
      const terminalDefinition = getTerminalDefinition("SELECTOR_3POS", ringId);

      expect(terminalDefinition?.x).toBe(ringCenter.x);
      expect(terminalDefinition?.y).toBe(ringCenter.y);
    }
  });

  it("keeps the primary terminal on the grid and all four terminals aligned", () => {
    const start = snapComponentToPlaneGrid(component("SELECTOR_3POS", 324, 399), settings);
    const startById = new Map(getComponentTerminals(start).map((entry) => [entry.terminalId, entry]));

    let current = start;

    for (const rotation of [0, 1, 2, 3, 0]) {
      current = snapComponentToPlaneGrid({ ...current, rotation }, settings);
      const terminals = getComponentTerminals(current);
      const entry = terminals.find((terminalEntry) => terminalEntry.terminalId === getDefaultEntryTerminalId("SELECTOR_3POS"))!;

      console.log(`SELECTOR_3POS rot${rotation}: ${terminals.map((entry) => `${entry.terminalId}=(${entry.x.toFixed(1)},${entry.y.toFixed(1)})`).join(" ")}`);

      expect(onGrid(entry.x)).toBe(true);
      expect(onGrid(entry.y)).toBe(true);

      if (rotation === 0) {
        expect(terminals).toHaveLength(4);
        expect(terminals.find((entry) => entry.terminalId === "in1")!.y)
          .toBe(terminals.find((entry) => entry.terminalId === "out1")!.y);
        expect(terminals.find((entry) => entry.terminalId === "in1")!.x)
          .toBe(terminals.find((entry) => entry.terminalId === "in2")!.x);
        expect(terminals.find((entry) => entry.terminalId === "out1")!.x)
          .toBe(terminals.find((entry) => entry.terminalId === "out2")!.x);

        for (const terminalEntry of terminals) {
          expect(Math.abs(terminalEntry.x - startById.get(terminalEntry.terminalId)!.x)).toBeLessThan(0.01);
          expect(Math.abs(terminalEntry.y - startById.get(terminalEntry.terminalId)!.y)).toBeLessThan(0.01);
        }
      }
    }
  });

  it("ends a wire on the outer ring edge and keeps aligned rows at 2 points", () => {
    const selector = snapComponentToPlaneGrid(component("SELECTOR_3POS", 324, 399), settings);
    const topTarget = snapComponentToPlaneGrid(component("XIC", 648, selector.y + 24 - 51), settings);
    const bottomTarget = snapComponentToPlaneGrid(component("XIC", 648, selector.y + 78 - 51), settings);
    const components = [selector, topTarget, bottomTarget];

    for (const [terminalId, target, targetTerminal] of [
      ["in1", topTarget, "in"],
      ["out1", topTarget, "out"],
      ["in2", bottomTarget, "in"],
      ["out2", bottomTarget, "out"]
    ] as const) {
      const wireEntry = wire(selector, terminalId, target, targetTerminal);
      const display = resolveWireDisplayPoints(wireEntry, components, settings);
      const anchor = terminal(selector, terminalId).point;
      const targetAnchor = terminal(target, targetTerminal).point;
      const radii = SELECTOR_3POS_RING_RADII[2][terminalId];
      const directionX = display[1]!.x - anchor.x;
      const directionY = display[1]!.y - anchor.y;
      const directionLength = Math.hypot(directionX, directionY);
      const expectedRadius = 1 / Math.sqrt(
        (directionX / directionLength / radii.outerX) ** 2
        + (directionY / directionLength / radii.outerY) ** 2
      );
      const drawnDistance = Math.hypot(display[0]!.x - anchor.x, display[0]!.y - anchor.y);
      const cross = (display[0]!.x - anchor.x) * directionY
        - (display[0]!.y - anchor.y) * directionX;

      expect(display).toHaveLength(2);
      expect(Math.abs(drawnDistance - expectedRadius)).toBeLessThan(0.01);
      expect(Math.abs(cross)).toBeLessThan(0.01);
      expect(Math.abs(display[1]!.x - targetAnchor.x)).toBeLessThan(0.01);
      expect(Math.abs(display[1]!.y - targetAnchor.y)).toBeLessThan(0.01);
      expect(wireEntry.points).toHaveLength(2);
      expect(wireEntry.points[0]).toEqual(anchor);
      expect(wireEntry.points[1]).toEqual(targetAnchor);
    }
  });

  it("saves and reloads the position and attached wires", () => {
    const selector = component("SELECTOR_3POS", 320, 240, { selectorPosition: 3 });
    const lamp = component("LAMP", 640, 240);
    const attachedWire = wire(selector, "out1", lamp, "in");
    const snapshot = createCircuitSnapshot(
      [selector, lamp],
      [attachedWire],
      { rungs: [] },
      [],
      250,
      settings,
      createDefaultSheetMetadata("selector", "2026-11-03T00:00:00.000Z")
    );
    const reloaded = parseCircuitSnapshot(JSON.parse(JSON.stringify(snapshot)));
    const reloadedSelector = reloaded.components.find((entry) => entry.id === selector.id);

    expect(reloadedSelector?.selectorPosition).toBe(3);
    expect(reloaded.wires).toHaveLength(1);
    expect(reloaded.wires[0]!.startPortId).toBe(`${selector.id}:out1`);
    expect(reloaded.wires[0]!.endPortId).toBe(`${lamp.id}:in`);
  });

  for (const position of [1, 2, 3] as const) {
    it(`conducts only the expected row in position ${position}`, () => {
      const { components, lampA, lampB, wires } = buildCircuit(position);
      const electrical = computeElectricalState(components, wires, true, {});

      console.log(
        `SELECTOR_3POS pos${position}: lampA=${electrical.energizedComponentIds.has(lampA.id)} ` +
        `lampB=${electrical.energizedComponentIds.has(lampB.id)}`
      );

      expect(electrical.energizedComponentIds.has(lampA.id)).toBe(position === 1);
      expect(electrical.energizedComponentIds.has(lampB.id)).toBe(position === 3);
    });
  }

  it("draws selector zone debug only when the debug prop is enabled", () => {
    const withDebug = renderToStaticMarkup(createElement(
      "div",
      null,
      renderSelector3Pos(2, "diagram-symbol", true)
    ));
    const withoutDebug = renderToStaticMarkup(createElement(
      "div",
      null,
      renderSelector3Pos(2, "diagram-symbol", false)
    ));

    expect(withDebug).toContain("stroke-dasharray");
    expect(withoutDebug).not.toContain("stroke-dasharray");
  });
});
