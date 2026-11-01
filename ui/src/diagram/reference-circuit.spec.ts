import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  computeElectricalState,
  deriveProgram,
  getTerminalPoint,
  resolvePhysicalInstructionTagValues
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderPlaneSettings, BuilderWire } from "../DiagramBuilder";
import { reconcileWireTopology } from "./wireTopology";

const snapshot = JSON.parse(
  readFileSync(new URL("./__fixtures__/reference-latch.circuit.json", import.meta.url), "utf8")
) as { components: BuilderComponent[]; wires: BuilderWire[] };
const planeSettings: BuilderPlaneSettings = { gridSpacing: 18, height: 940, width: 1720 };

function reconcile() {
  return reconcileWireTopology(
    { components: snapshot.components, wires: snapshot.wires },
    planeSettings
  );
}

function withStartPressed(components: BuilderComponent[], pressed: boolean): BuilderComponent[] {
  return components.map((component) =>
    component.id === "builder-component-5" ? { ...component, isPressed: pressed } : component
  );
}

describe("reference latch circuit", () => {
  it("reconciles all endpoints without deleting wires", () => {
    const report = reconcile();

    expect(report.removedWireIds).toEqual([]);
    expect(report.scene.wires).toHaveLength(28);

    const wire64 = report.scene.wires.find((wire) => wire.id === "builder-wire-64");
    const wire19 = report.scene.wires.find((wire) => wire.id === "builder-wire-19");
    const wire64End = wire64 ? wire64.points[wire64.points.length - 1] : undefined;

    expect(wire64End).toBeDefined();
    expect(
      wire19?.points.some(
        (point) => Math.abs(point.x - wire64End!.x) < 0.01 && Math.abs(point.y - wire64End!.y) < 0.01
      )
    ).toBe(true);

    const ote = report.scene.components.find((component) => component.id === "builder-component-10")!;
    const pushButton = report.scene.components.find((component) => component.id === "builder-component-5")!;
    const wire11 = report.scene.wires.find((wire) => wire.id === "builder-wire-11");

    expect(wire11?.points).toHaveLength(2);
    expect(wire11?.points[0]).toEqual(getTerminalPoint(ote, "in"));
    expect(wire11?.points[1]).toEqual(getTerminalPoint(pushButton, "out"));
  });

  it("is idempotent", () => {
    const first = reconcile();
    const second = reconcileWireTopology(first.scene, planeSettings);

    expect(second.removedWireIds).toEqual([]);
    expect(second.scene).toEqual(first.scene);
  });

  it("derives the M, TR1, Y and D rungs", () => {
    const scene = reconcile().scene;
    const derived = deriveProgram(scene.components, scene.wires);
    const rungs = derived.program.rungs.map((rung) =>
      rung.instructions.map((instruction) => `${instruction.type}:${instruction.tag}`)
    );

    expect(rungs).toEqual([
      ["XIC:__builder_label__:M", "OTE:__builder_label__:M"],
      ["XIC:__builder_label__:M", "XIO:__builder_label__:D", "OTE:__builder_label__:TR1"],
      ["XIC:__builder_label__:M", "NCTO:__builder_label__:TR1", "OTE:__builder_label__:Y"],
      ["XIC:__builder_label__:D", "NOTC:__builder_label__:TR1", "OTE:__builder_label__:D"]
    ]);
  });

  it("energizes M, the parallel lamp and TR1; M stays latched after release", () => {
    const scene = reconcile().scene;
    const pressed = withStartPressed(scene.components, true);
    const pressedTags = resolvePhysicalInstructionTagValues(pressed, scene.wires, {}, {});

    expect(pressedTags.resolvedTagValues["__builder_label__:M"]).toBe(true);
    expect(pressedTags.resolvedTagValues["__builder_label__:TR1"]).toBe(true);
    expect(pressedTags.resolvedTagValues["__builder_label__:Y"]).toBe(true);
    expect(pressedTags.resolvedTagValues["__builder_label__:D"]).toBe(false);

    const electrical = computeElectricalState(pressed, scene.wires, true, {});
    expect(electrical.fault).toBeNull();
    expect(electrical.energizedComponentIds.has("builder-component-10")).toBe(true);
    expect(electrical.energizedComponentIds.has("builder-component-12")).toBe(true);

    const released = withStartPressed(scene.components, false);
    const releasedTags = resolvePhysicalInstructionTagValues(
      released,
      scene.wires,
      {},
      pressedTags.resolvedTagValues
    );

    expect(releasedTags.resolvedTagValues["__builder_label__:M"]).toBe(true);
  });
});
