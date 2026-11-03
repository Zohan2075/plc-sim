import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getComponentTerminals,
  getDefaultEntryTerminalId,
  rotateComponentInScene
} from "../DiagramBuilder";
import type {
  BuilderComponent,
  BuilderComponentType,
  BuilderPlaneSettings,
  BuilderScene,
  Point
} from "../DiagramBuilder";
import { snapComponentToPlaneGrid } from "./grid";
import { resolveDiagramShortcut } from "./interaction";
import { parseCircuitSnapshot } from "./snapshot";
import { resolveWireDisplayPoints } from "./wireRoute";

const planeSettings: BuilderPlaneSettings = { gridSpacing: 18, height: 20000, width: 4200 };
const TYPES: BuilderComponentType[] = [
  "XIC",
  "XIO",
  "OTE",
  "LAMP",
  "PUSH_BUTTON_NC",
  "PUSH_BUTTON_NO",
  "ESTOP",
  "NCTO",
  "NOTC",
  "BREAKER_1P",
  "POWER_SOURCE"
];

function component(type: BuilderComponentType): BuilderComponent {
  return {
    id: `rotation-${type}`,
    label: type,
    rotation: 0,
    tag: null,
    type,
    usesCustomLabel: false,
    x: 324,
    y: 399
  };
}

function format(points: Point[]): string {
  return points.map((point) => `(${point.x.toFixed(1)},${point.y.toFixed(1)})`).join(" ");
}

describe("rotation terminal stability (existing entry-terminal snap)", () => {
  for (const type of TYPES) {
    it(`${type}: 0 -> 1 -> 2 -> 3 -> 0 keeps terminal positions`, () => {
      let current = snapComponentToPlaneGrid(component(type), planeSettings);
      const startById = new Map(
        getComponentTerminals(current).map((terminal) => [terminal.terminalId, terminal])
      );

      for (const rotation of [0, 1, 2, 3, 0]) {
        current = snapComponentToPlaneGrid({ ...current, rotation }, planeSettings);
        const terminals = getComponentTerminals(current);
        const entryId = getDefaultEntryTerminalId(type);
        const entry = terminals.find((terminal) => terminal.terminalId === entryId) ?? terminals[0]!;

        console.log(`${type} rot${rotation}: ${format(terminals)} entry=(${entry.x.toFixed(1)},${entry.y.toFixed(1)})`);

        expect(Math.abs(entry.x / planeSettings.gridSpacing - Math.round(entry.x / planeSettings.gridSpacing)))
          .toBeLessThan(0.01);
        expect(Math.abs(entry.y / planeSettings.gridSpacing - Math.round(entry.y / planeSettings.gridSpacing)))
          .toBeLessThan(0.01);

        if (rotation === 0) {
          for (const terminal of terminals) {
            const start = startById.get(terminal.terminalId)!;
            expect(Math.abs(terminal.x - start.x)).toBeLessThan(0.01);
            expect(Math.abs(terminal.y - start.y)).toBeLessThan(0.01);
          }
        }
      }
    });
  }
});

describe("rotateComponentInScene (menu/R action path)", () => {
  for (const type of TYPES) {
    it(`${type}: four menu rotations go 0 -> 1 -> 2 -> 3 -> 0`, () => {
      const start = snapComponentToPlaneGrid(component(type), planeSettings);
      const startTerminals = getComponentTerminals(start);
      let scene: BuilderScene = { components: [start], wires: [] };

      for (const expectedRotation of [1, 2, 3, 0]) {
        const current = scene.components[0]!;
        scene = rotateComponentInScene(
          scene,
          current.id,
          current.rotation + 1,
          planeSettings
        );

        const rotated = scene.components[0]!;
        const terminals = getComponentTerminals(rotated);
        const entry = terminals.find(
          (terminal) => terminal.terminalId === getDefaultEntryTerminalId(type)
        )!;

        expect(rotated.rotation).toBe(expectedRotation);
        expect(Math.abs(entry.x / planeSettings.gridSpacing - Math.round(entry.x / planeSettings.gridSpacing)))
          .toBeLessThan(0.01);
        expect(Math.abs(entry.y / planeSettings.gridSpacing - Math.round(entry.y / planeSettings.gridSpacing)))
          .toBeLessThan(0.01);

        if (expectedRotation === 0) {
          for (const terminal of terminals) {
            const original = startTerminals.find(
              (candidate) => candidate.terminalId === terminal.terminalId
            )!;

            expect(Math.abs(terminal.x - original.x)).toBeLessThan(0.01);
            expect(Math.abs(terminal.y - original.y)).toBeLessThan(0.01);
          }
        }
      }
    });
  }

  it("four R/Shift+R shortcut activations return to the start", () => {
    for (const shiftKey of [false, true]) {
      const start = snapComponentToPlaneGrid(component("XIC"), planeSettings);
      const startTerminals = getComponentTerminals(start);
      const shortcut = resolveDiagramShortcut({
        ctrlKey: false,
        key: "r",
        metaKey: false,
        shiftKey
      });
      const delta = shortcut?.type === "rotate" && shortcut.direction === "cw" ? 1 : 3;
      let scene: BuilderScene = { components: [start], wires: [] };

      for (let press = 0; press < 4; press += 1) {
        const current = scene.components[0]!;
        scene = rotateComponentInScene(
          scene,
          current.id,
          current.rotation + delta,
          planeSettings
        );
      }

      const finalComponent = scene.components[0]!;
      const finalTerminals = getComponentTerminals(finalComponent);
      const startById = new Map(startTerminals.map((terminal) => [terminal.terminalId, terminal]));

      expect(finalComponent.rotation).toBe(0);

      for (const terminal of finalTerminals) {
        const original = startById.get(terminal.terminalId)!;

        expect(Math.abs(terminal.x - original.x)).toBeLessThan(0.01);
        expect(Math.abs(terminal.y - original.y)).toBeLessThan(0.01);
      }
    }
  });

  it("rejects a non-finite rotation without mutating the scene", () => {
    const start = snapComponentToPlaneGrid(component("XIC"), planeSettings);
    const scene: BuilderScene = { components: [start], wires: [] };

    expect(rotateComponentInScene(scene, start.id, Number.NaN, planeSettings)).toBe(scene);
    expect(rotateComponentInScene(scene, start.id, Number.POSITIVE_INFINITY, planeSettings)).toBe(scene);
    expect(scene.components[0]!.rotation).toBe(0);
  });

  it("keeps wires 10/11 intact across a 90 degree round trip and re-anchors their display", () => {
    const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "yd-control.circuit.json");
    const snapshot = parseCircuitSnapshot(JSON.parse(readFileSync(fixturePath, "utf8")));
    const scene: BuilderScene = {
      components: snapshot.components,
      wires: snapshot.wires
    };
    const target = scene.components.find((entry) => entry.id === "builder-component-9");

    expect(target).toBeDefined();
    expect(target!.type).toBe("XIC");

    const wireIds = new Set(["builder-wire-10", "builder-wire-11"]);
    const before = new Map(
      scene.wires
        .filter((wire) => wireIds.has(wire.id))
        .map((wire) => [wire.id, JSON.stringify(wire.points)])
    );

    expect(before.size).toBe(2);
    console.log("wires 10/11 stored before:", JSON.stringify(Object.fromEntries(before)));

    const rotated = rotateComponentInScene(
      scene,
      target!.id,
      target!.rotation + 1,
      planeSettings
    );
    const rotatedTarget = rotated.components.find((entry) => entry.id === target!.id)!;
    const anchorByPort = new Map(
      rotated.components
        .flatMap((component) => getComponentTerminals(component))
        .map((terminal) => [
          terminal.portId,
          { x: terminal.x, y: terminal.y }
        ])
    );

    for (const wire of rotated.wires.filter((entry) => wireIds.has(entry.id))) {
      const display = resolveWireDisplayPoints(wire, rotated.components, planeSettings);

      console.log(
        `wire ${wire.id} after 90°: ${display.length} pts ${JSON.stringify(display)} ` +
        `start=${JSON.stringify(anchorByPort.get(wire.startPortId!))} ` +
        `end=${JSON.stringify(anchorByPort.get(wire.endPortId!))}`
      );

      expect(display[0]).toEqual(anchorByPort.get(wire.startPortId!));
      expect(display[display.length - 1]).toEqual(anchorByPort.get(wire.endPortId!));
      expect([2, 3]).toContain(display.length);
    }

    const restored = rotateComponentInScene(
      rotated,
      target!.id,
      rotatedTarget.rotation + 3,
      planeSettings
    );
    const restoredTarget = restored.components.find((entry) => entry.id === target!.id)!;

    expect(restoredTarget.rotation).toBe(0);

    for (const wire of restored.wires.filter((entry) => wireIds.has(entry.id))) {
      console.log(`wire ${wire.id} back at 0°: ${JSON.stringify(wire.points)}`);
      expect(JSON.stringify(wire.points)).toBe(before.get(wire.id));
    }
  });
});
