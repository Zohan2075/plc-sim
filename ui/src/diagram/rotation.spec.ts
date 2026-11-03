import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatRotationRemovalMessage,
  getComponentTerminals,
  getDefaultEntryTerminalId,
  rotateComponentInScene
} from "../DiagramBuilder";
import type {
  BuilderComponent,
  BuilderComponentType,
  BuilderPlaneSettings,
  BuilderScene,
  BuilderWire,
  Point
} from "../DiagramBuilder";
import { snapComponentToPlaneGrid } from "./grid";
import { resolveDiagramShortcut } from "./interaction";
import { parseCircuitSnapshot } from "./snapshot";

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
        ).scene;

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
        ).scene;
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

    const nan = rotateComponentInScene(scene, start.id, Number.NaN, planeSettings);
    const infinite = rotateComponentInScene(scene, start.id, Number.POSITIVE_INFINITY, planeSettings);

    expect(nan.changed).toBe(false);
    expect(nan.scene).toBe(scene);
    expect(infinite.changed).toBe(false);
    expect(infinite.scene).toBe(scene);
    expect(scene.components[0]!.rotation).toBe(0);
  });

  it("does nothing when the angle does not change", () => {
    const start = snapComponentToPlaneGrid(component("XIC"), planeSettings);
    const wire: BuilderWire = {
      color: "#1d4ed8",
      endPortId: "builder-wire-noop:out",
      id: "builder-wire-noop",
      points: [{ x: 324, y: 450 }, { x: 468, y: 450 }],
      startPortId: "builder-wire-noop:in",
      thickness: 2
    };
    const scene: BuilderScene = { components: [start], wires: [wire] };
    const result = rotateComponentInScene(scene, start.id, start.rotation, planeSettings);

    expect(result.changed).toBe(false);
    expect(result.removedWireIds).toEqual([]);
    expect(result.scene).toBe(scene);
    expect(result.scene.wires).toHaveLength(1);
  });

  it("deletes wires 10/11 on component-9, keeps the other 28 byte-identical", () => {
    const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "yd-control.circuit.json");
    const snapshot = parseCircuitSnapshot(JSON.parse(readFileSync(fixturePath, "utf8")));
    const scene: BuilderScene = {
      components: snapshot.components,
      wires: snapshot.wires
    };
    const target = scene.components.find((entry) => entry.id === "builder-component-9");

    expect(target).toBeDefined();
    expect(target!.type).toBe("XIC");
    expect(scene.wires).toHaveLength(30);

    const before = new Map(scene.wires.map((wire) => [wire.id, JSON.stringify(wire.points)]));
    const result = rotateComponentInScene(scene, target!.id, target!.rotation + 1, planeSettings);
    const rotatedTarget = result.scene.components.find((entry) => entry.id === target!.id)!;
    const entryTerminal = getComponentTerminals(rotatedTarget).find(
      (terminal) => terminal.terminalId === getDefaultEntryTerminalId(rotatedTarget.type)
    )!;

    console.log("removed wire ids:", result.removedWireIds);
    console.log("remaining wires:", result.scene.wires.length);

    expect(result.changed).toBe(true);
    expect(result.removedWireIds).toEqual(expect.arrayContaining(["builder-wire-10", "builder-wire-11"]));
    expect(result.removedWireIds).toHaveLength(2);
    expect(result.scene.wires).toHaveLength(28);
    expect(result.scene.wires.some((wire) => wire.id === "builder-wire-10")).toBe(false);
    expect(result.scene.wires.some((wire) => wire.id === "builder-wire-11")).toBe(false);

    for (const wire of result.scene.wires) {
      expect(JSON.stringify(wire.points)).toBe(before.get(wire.id));
    }

    expect(Math.abs(entryTerminal.x / planeSettings.gridSpacing - Math.round(entryTerminal.x / planeSettings.gridSpacing)))
      .toBeLessThan(0.01);
    expect(Math.abs(entryTerminal.y / planeSettings.gridSpacing - Math.round(entryTerminal.y / planeSettings.gridSpacing)))
      .toBeLessThan(0.01);
  });

  it("removes a branch that loses its deleted parent, and only that branch", () => {
    const start = snapComponentToPlaneGrid(component("XIC"), planeSettings);
    const parentWire: BuilderWire = {
      color: "#1d4ed8",
      endPortId: null,
      id: "builder-wire-parent",
      points: [{ x: 324, y: 450 }, { x: 324, y: 540 }, { x: 500, y: 540 }],
      startPortId: "rotation-XIC:in",
      thickness: 2
    };
    const branchWire: BuilderWire = {
      color: "#1d4ed8",
      endPortId: null,
      id: "builder-wire-branch",
      points: [{ x: 400, y: 540 }, { x: 400, y: 620 }],
      startPortId: null,
      thickness: 2
    };
    const unrelatedLooseWire: BuilderWire = {
      color: "#1d4ed8",
      endPortId: null,
      id: "builder-wire-unrelated",
      points: [{ x: 100, y: 100 }, { x: 100, y: 200 }],
      startPortId: null,
      thickness: 2
    };
    const scene: BuilderScene = {
      components: [start],
      wires: [parentWire, branchWire, unrelatedLooseWire]
    };
    const result = rotateComponentInScene(scene, start.id, start.rotation + 1, planeSettings);

    expect(result.removedWireIds).toEqual(expect.arrayContaining([
      "builder-wire-parent",
      "builder-wire-branch"
    ]));
    expect(result.removedWireIds).not.toContain("builder-wire-unrelated");
    expect(result.scene.wires.map((wire) => wire.id)).toEqual(["builder-wire-unrelated"]);
  });

  it("deletes the wires of two connected rotated components in one pass", () => {
    const first = snapComponentToPlaneGrid(component("XIC"), planeSettings);
    const second = snapComponentToPlaneGrid({
      ...component("OTE"),
      id: "rotation-OTE",
      x: first.x + 288,
      y: first.y
    }, planeSettings);
    const link: BuilderWire = {
      color: "#1d4ed8",
      endPortId: `${second.id}:in`,
      id: "builder-wire-link",
      points: [{ x: 468, y: 450 }, { x: 612, y: 450 }],
      startPortId: `${first.id}:out`,
      thickness: 2
    };
    const scene: BuilderScene = { components: [first, second], wires: [link] };

    const afterFirst = rotateComponentInScene(scene, first.id, first.rotation + 1, planeSettings);
    const afterSecond = rotateComponentInScene(
      afterFirst.scene,
      second.id,
      second.rotation + 1,
      planeSettings
    );

    expect(afterFirst.removedWireIds).toEqual(["builder-wire-link"]);
    expect(afterSecond.scene.wires).toHaveLength(0);
    expect(afterSecond.scene.components.map((entry) => entry.rotation)).toEqual([1, 1]);
  });

  it("formats the removal toast with singular/plural", () => {
    expect(formatRotationRemovalMessage(1)).toBe("Rotated. 1 wire removed. Undo to restore.");
    expect(formatRotationRemovalMessage(3)).toBe("Rotated. 3 wires removed. Undo to restore.");
  });
});
