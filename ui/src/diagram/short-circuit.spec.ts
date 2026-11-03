import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeElectricalState } from "../DiagramBuilder";
import type { BuilderComponent, BuilderWire } from "../DiagramBuilder";

const snapshot = JSON.parse(
  readFileSync(new URL("./__fixtures__/breaker2p-wire-crossing.circuit.json", import.meta.url), "utf8")
) as { components: BuilderComponent[]; wires: BuilderWire[] };

describe("wire crossing a breaker terminal", () => {
  it("does not bridge the two breaker poles", () => {
    const state = computeElectricalState(
      snapshot.components,
      snapshot.wires,
      true,
      {},
      {},
      {},
      0
    );

    expect(state.fault).toBeNull();
  });

  it("still energizes the intended load when the start button is pressed", () => {
    const components = snapshot.components.map((component) =>
      component.id === "builder-component-9"
        ? { ...component, isPressed: true }
        : component
    );
    const state = computeElectricalState(
      components,
      snapshot.wires,
      true,
      {},
      {},
      {},
      0
    );

    console.log("energized components", JSON.stringify([...state.energizedComponentIds]));
    console.log("energized wires", JSON.stringify([...state.energizedWireIds]));
    console.log("resolved tags", state.resolvedTagValues);
    expect(state.fault).toBeNull();
    expect(state.energizedComponentIds.has("builder-component-13")).toBe(true);
    expect(state.energizedWireIds.has("builder-wire-39")).toBe(true);
    expect(state.energizedWireIds.has("builder-wire-15")).toBe(true);
  });
});
