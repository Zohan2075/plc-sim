import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getComponentTerminals } from "../DiagramBuilder";
import type { BuilderComponent, BuilderPlaneSettings, BuilderWire } from "../DiagramBuilder";
import { clampSceneToPlane } from "./grid";
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

describe("vertical contact/button wiring", () => {
  it("aligns PB_NO and XIC terminals on the same X after load migration", () => {
    const report = loadScene();
    const pushButton = report.scene.components.find((component) => component.id === "builder-component-4")!;
    const contact = report.scene.components.find((component) => component.id === "builder-component-18")!;
    const pushButtonTerminals = getComponentTerminals(pushButton);
    const contactTerminals = getComponentTerminals(contact);

    expect(pushButtonTerminals.find((terminal) => terminal.terminalId === "in")!.x)
      .toBeCloseTo(contactTerminals.find((terminal) => terminal.terminalId === "in")!.x, 10);
    expect(pushButtonTerminals.find((terminal) => terminal.terminalId === "out")!.x)
      .toBeCloseTo(contactTerminals.find((terminal) => terminal.terminalId === "out")!.x, 10);
  });

  it("straightens the two vertical wires between the contact and the NO button", () => {
    const report = loadScene();

    for (const wireId of ["builder-wire-19", "builder-wire-22"]) {
      const wire = report.scene.wires.find((candidate) => candidate.id === wireId)!;

      expect(wire.points).toHaveLength(2);
      expect(wire.points[0]!.x).toBeCloseTo(wire.points[1]!.x, 10);
      expect(wire.points[0]!.y).not.toBeCloseTo(wire.points[1]!.y, 3);
    }

    expect(report.removedWireIds).toEqual([]);
  });
});
