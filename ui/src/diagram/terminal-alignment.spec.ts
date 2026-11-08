import { describe, expect, it } from "vitest";
import {
  getComponentTerminals,
  instructionPalette,
  resolveWirePoints
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType, BuilderWire } from "../DiagramBuilder";

const Y_POSITIONS = [0, 500, 5000, 20000];
const ROTATIONS = [0, 1, 2, 3];
const PALETTE_TYPES = instructionPalette.flatMap((entry) =>
  entry.altType ? [entry.type, entry.altType] : [entry.type]
);

function component(
  id: string,
  type: BuilderComponentType,
  y: number,
  rotation: number
): BuilderComponent {
  return {
    id,
    label: type,
    rotation,
    tag: null,
    type,
    usesCustomLabel: false,
    x: 324,
    y
  };
}

function wireWithReferences(
  startComponent: BuilderComponent,
  endComponent: BuilderComponent
): { wire: BuilderWire; startTerminal: ReturnType<typeof getComponentTerminals>[number]; endTerminal: ReturnType<typeof getComponentTerminals>[number] } {
  const startTerminal = getComponentTerminals(startComponent)[0]!;
  const endTerminal = getComponentTerminals(endComponent)[0]!;
  const wire: BuilderWire = {
    color: "#111827",
    endPortId: endTerminal.portId,
    id: "wire-refs",
    points: [{ x: -999, y: -999 }, { x: 999, y: 999 }],
    startPortId: startTerminal.portId,
    thickness: 3.5
  };

  return { endTerminal, startTerminal, wire };
}

describe("terminal/wire alignment across large Y and all rotations", () => {
  for (const type of PALETTE_TYPES) {
    for (const rotation of ROTATIONS) {
      for (const y of Y_POSITIONS) {
        it(`${type} rotation ${rotation} at y=${y}: wire endpoints equal terminal world positions`, () => {
          const startComponent = component("start", type, y, rotation);
          const endComponent = component("end", type, y + 500, rotation);
          const { wire, startTerminal, endTerminal } = wireWithReferences(startComponent, endComponent);
          const resolved = resolveWirePoints(wire, [startComponent, endComponent]);

          expect(resolved).toHaveLength(2);
          expect(Math.abs(resolved[0]!.x - startTerminal.x)).toBeLessThan(0.01);
          expect(Math.abs(resolved[0]!.y - startTerminal.y)).toBeLessThan(0.01);
          expect(Math.abs(resolved[1]!.x - endTerminal.x)).toBeLessThan(0.01);
          expect(Math.abs(resolved[1]!.y - endTerminal.y)).toBeLessThan(0.01);
        });
      }
    }
  }
});
