import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLANE_SETTINGS,
  computeElectricalState,
  getComponentTerminals,
  getTerminalDefinitions,
  toggleComponentOperateState
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderWire } from "../DiagramBuilder";
import {
  COMPONENT_FAMILIES,
  getComponentFamily,
  getComponentFamilyOperatedState,
  getComponentFamilyVariant,
  setComponentFamilyVariant
} from "./componentFamilies";
import { reconcileWireTopology } from "./wireTopology";

function component(
  id: string,
  type: BuilderComponent["type"],
  x: number,
  y: number,
  overrides: Partial<BuilderComponent> = {}
): BuilderComponent {
  return {
    id,
    label: type,
    rotation: 0,
    tag: null,
    type,
    usesCustomLabel: false,
    x,
    y,
    ...overrides
  };
}

const familySwitch: BuilderComponent = {
  id: "family-switch",
  isClosed: true,
  label: "LS-NO",
  rotation: 1,
  tag: "I:0/0",
  terminalLabels: { in: "A", out: "B" },
  type: "LIMIT_SWITCH_NO",
  usesCustomLabel: true,
  x: 324,
  y: 233
};

describe("component family variant swap", () => {
  it("changes the variant while preserving the actuator state and every other field", () => {
    const swapped = setComponentFamilyVariant(familySwitch, "nc");

    expect(swapped).not.toBe(familySwitch);
    expect(swapped.type).toBe("LIMIT_SWITCH_NC");
    // familySwitch is an operated NO (continuity closed), so the NC equivalent
    // is operated too and therefore open.
    expect(swapped.isClosed).toBe(false);
    expect(getComponentFamilyOperatedState(familySwitch)).toBe(true);
    expect(getComponentFamilyOperatedState(swapped)).toBe(true);
    expect(swapped.id).toBe("family-switch");
    expect(swapped.x).toBe(324);
    expect(swapped.y).toBe(233);
    expect(swapped.rotation).toBe(1);
    expect(swapped.label).toBe("LS-NO");
    expect(swapped.tag).toBe("I:0/0");
    expect(swapped.terminalLabels).toEqual({ in: "A", out: "B" });
    expect(swapped.usesCustomLabel).toBe(true);

    const { type: _originalType, isClosed: _originalClosed, ...originalRest } = familySwitch;
    const { type: _swappedType, isClosed: _swappedClosed, ...swappedRest } = swapped;

    expect(swappedRest).toEqual(originalRest);
  });

  it("converts a resting open NO into a resting closed NC and back", () => {
    const restingNo = { ...familySwitch, isClosed: false };
    const restingNc = setComponentFamilyVariant(restingNo, "nc");

    expect(restingNc.type).toBe("LIMIT_SWITCH_NC");
    expect(restingNc.isClosed).toBe(true);
    expect(getComponentFamilyOperatedState(restingNc)).toBe(false);

    const backToNo = setComponentFamilyVariant(restingNc, "no");

    expect(backToNo.type).toBe("LIMIT_SWITCH_NO");
    expect(backToNo.isClosed).toBe(false);
    expect(getComponentFamilyOperatedState(backToNo)).toBe(false);
    expect(backToNo).toEqual(restingNo);
  });

  it("treats a missing isClosed as the resting state for both variants", () => {
    const noWithoutState = { ...familySwitch };
    delete noWithoutState.isClosed;
    const nc = setComponentFamilyVariant(noWithoutState, "nc");

    expect(nc.isClosed).toBe(true);
    expect(getComponentFamilyOperatedState(noWithoutState)).toBe(false);
    expect(getComponentFamilyOperatedState(nc)).toBe(false);
  });

  it("round-trips back to the original component", () => {
    const swapped = setComponentFamilyVariant(familySwitch, "nc");
    const roundTripped = setComponentFamilyVariant(swapped, "no");

    expect(roundTripped.type).toBe("LIMIT_SWITCH_NO");
    expect(roundTripped).toEqual(familySwitch);
    expect(JSON.parse(JSON.stringify(swapped))).toEqual(swapped);
  });

  it("does nothing for non-family components or an already-active variant", () => {
    const fuse = component("fuse-1", "FUSE", 324, 233);

    expect(setComponentFamilyVariant(fuse, "nc")).toBe(fuse);
    expect(setComponentFamilyVariant(familySwitch, "no")).toBe(familySwitch);
  });

  it("exposes both family definitions and variants", () => {
    expect(COMPONENT_FAMILIES.LIMIT_SWITCH).toEqual({
      label: "Limit switch",
      nc: "LIMIT_SWITCH_NC",
      no: "LIMIT_SWITCH_NO"
    });
    expect(COMPONENT_FAMILIES.LEVEL_SWITCH).toEqual({
      label: "Level switch",
      nc: "LEVEL_SWITCH_NC",
      no: "LEVEL_SWITCH_NO"
    });
    expect(getComponentFamily("LIMIT_SWITCH_NC")?.id).toBe("LIMIT_SWITCH");
    expect(getComponentFamily("LEVEL_SWITCH_NO")?.id).toBe("LEVEL_SWITCH");
    expect(getComponentFamily("FUSE")).toBeNull();
    expect(getComponentFamilyVariant("LIMIT_SWITCH_NO")).toBe("no");
    expect(getComponentFamilyVariant("LIMIT_SWITCH_NC")).toBe("nc");
    expect(getComponentFamilyVariant("LEVEL_SWITCH_NO")).toBe("no");
    expect(getComponentFamilyVariant("LEVEL_SWITCH_NC")).toBe("nc");
    expect(getComponentFamilyVariant("FUSE")).toBeNull();
  });

  it("compares NO/NC anchors and prints the measured deltas", () => {
    const limitNo = getTerminalDefinitions("LIMIT_SWITCH_NO");
    const limitNc = getTerminalDefinitions("LIMIT_SWITCH_NC");
    const levelNo = getTerminalDefinitions("LEVEL_SWITCH_NO");
    const levelNc = getTerminalDefinitions("LEVEL_SWITCH_NC");

    expect(limitNc).toEqual(limitNo);

    const limitDeltas = limitNo.map((terminal) => {
      const nc = limitNc.find((candidate) => candidate.id === terminal.id)!;

      return { dx: nc.x - terminal.x, dy: nc.y - terminal.y, id: terminal.id };
    });
    const levelDeltas = levelNo.map((terminal) => {
      const nc = levelNc.find((candidate) => candidate.id === terminal.id)!;

      return { dx: nc.x - terminal.x, dy: nc.y - terminal.y, id: terminal.id };
    });

    for (const terminal of levelNo) {
      const nc = levelNc.find((candidate) => candidate.id === terminal.id)!;

      expect(Math.abs(nc.x - terminal.x)).toBeLessThan(1e-8);
      expect(Math.abs(nc.y - terminal.y)).toBeLessThan(0.01);
    }

    console.log("limit switch NO/NC anchor deltas", limitDeltas);
    console.log("level switch NO/NC anchor deltas", levelDeltas);
  });

  it("reconciles two wires to the swapped variant terminals", () => {
    const level = component("level-nc", "LEVEL_SWITCH_NC", 324, 233, { isClosed: true });
    const lamp = component("lamp-1", "LAMP", 324, 451);
    const levelBefore = getComponentTerminals(level);
    const lampTerminals = getComponentTerminals(lamp);
    const levelInBefore = levelBefore.find((terminal) => terminal.terminalId === "in")!;
    const levelOutBefore = levelBefore.find((terminal) => terminal.terminalId === "out")!;
    const lampIn = lampTerminals.find((terminal) => terminal.terminalId === "in")!;
    const lampOut = lampTerminals.find((terminal) => terminal.terminalId === "out")!;
    const wires: BuilderWire[] = [
      {
        color: "#111827",
        endPortId: lampIn.portId,
        id: "wire-in",
        points: [
          { x: levelInBefore.x, y: levelInBefore.y },
          { x: lampIn.x, y: lampIn.y }
        ],
        startPortId: levelInBefore.portId,
        thickness: 3.5
      },
      {
        color: "#111827",
        endPortId: lampOut.portId,
        id: "wire-out",
        points: [
          { x: levelOutBefore.x, y: levelOutBefore.y },
          { x: lampOut.x, y: lampOut.y }
        ],
        startPortId: levelOutBefore.portId,
        thickness: 3.5
      }
    ];

    const swapped = setComponentFamilyVariant(level, "no");
    const report = reconcileWireTopology(
      { components: [swapped, lamp], wires },
      DEFAULT_PLANE_SETTINGS
    );
    const levelAfter = getComponentTerminals(swapped);
    const levelInAfter = levelAfter.find((terminal) => terminal.terminalId === "in")!;
    const levelOutAfter = levelAfter.find((terminal) => terminal.terminalId === "out")!;
    const wireIn = report.scene.wires.find((wire) => wire.id === "wire-in")!;
    const wireOut = report.scene.wires.find((wire) => wire.id === "wire-out")!;

    expect(report.removedWireIds).toEqual([]);
    expect(wireIn.points[0]).toEqual({ x: levelInAfter.x, y: levelInAfter.y });
    expect(wireOut.points[0]).toEqual({ x: levelOutAfter.x, y: levelOutAfter.y });
    expect(wireIn.points.at(-1)).toEqual({ x: lampIn.x, y: lampIn.y });
    expect(wireOut.points.at(-1)).toEqual({ x: lampOut.x, y: lampOut.y });

    const deltas = [
      {
        endpoint: "start",
        wireId: "wire-in",
        dx: levelInAfter.x - levelInBefore.x,
        dy: levelInAfter.y - levelInBefore.y
      },
      {
        endpoint: "start",
        wireId: "wire-out",
        dx: levelOutAfter.x - levelOutBefore.x,
        dy: levelOutAfter.y - levelOutBefore.y
      },
      {
        endpoint: "end",
        wireId: "wire-in",
        dx: wireIn.points.at(-1)!.x - lampIn.x,
        dy: wireIn.points.at(-1)!.y - lampIn.y
      },
      {
        endpoint: "end",
        wireId: "wire-out",
        dx: wireOut.points.at(-1)!.x - lampOut.x,
        dy: wireOut.points.at(-1)!.y - lampOut.y
      }
    ];

    console.log("family swap wire endpoint deltas", deltas);
  });

  it("keeps the existing NO/NC conduction table after a variant swap", () => {
    const wireBetween = (from: BuilderComponent, fromTerminal: string, to: BuilderComponent, toTerminal: string): BuilderWire => {
      const start = getComponentTerminals(from).find((terminal) => terminal.terminalId === fromTerminal)!;
      const end = getComponentTerminals(to).find((terminal) => terminal.terminalId === toTerminal)!;

      return {
        color: "#111827",
        endPortId: end.portId,
        id: `wire-${from.id}-${to.id}`,
        points: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }],
        startPortId: start.portId,
        thickness: 3.5
      };
    };

    for (const familyId of ["LIMIT_SWITCH", "LEVEL_SWITCH"] as const) {
      const family = COMPONENT_FAMILIES[familyId];

      for (const variant of ["no", "nc"] as const) {
        const type = family[variant];
        const source = component(`src-${familyId}-${variant}`, "POWER_SOURCE", 40, 40);
        const coil = component(`coil-${familyId}-${variant}`, "OTE", 440, 40, { tag: "M" });
        const resting = component(`switch-${familyId}-${variant}`, type, 240, 40, {
          isClosed: variant === "nc"
        });
        const wires = [
          wireBetween(source, "right", resting, "in"),
          wireBetween(resting, "out", coil, "in"),
          wireBetween(coil, "out", source, "left")
        ];
        const restState = computeElectricalState([source, resting, coil], wires, true, {});
        const operatedSwitch = toggleComponentOperateState([resting], resting.id)[0]!;
        const operatedState = computeElectricalState([source, operatedSwitch, coil], wires, true, {});
        const rows = [
          {
            family: familyId,
            variant,
            operated: false,
            conducts: restState.resolvedTagValues.M
          },
          {
            family: familyId,
            variant,
            operated: true,
            conducts: operatedState.resolvedTagValues.M
          }
        ];

        expect(rows).toEqual([
          { family: familyId, variant, operated: false, conducts: variant === "nc" },
          { family: familyId, variant, operated: true, conducts: variant === "no" }
        ]);
        console.log("family contact behavior", rows);

        // The swapped variant has the opposite continuity for the same actuator
        // state, which is exactly the existing NC semantics.
        const swapped = setComponentFamilyVariant(resting, variant === "no" ? "nc" : "no");
        const swappedState = computeElectricalState([source, swapped, coil], wires, true, {});

        expect(swappedState.resolvedTagValues.M).toBe(variant === "no");
        console.log("family swap behavior", {
          from: variant,
          to: variant === "no" ? "nc" : "no",
          operated: getComponentFamilyOperatedState(swapped),
          conducts: swappedState.resolvedTagValues.M
        });
      }
    }
  });
});
