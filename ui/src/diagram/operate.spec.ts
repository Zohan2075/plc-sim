import { describe, expect, it } from "vitest";
import {
  applyMomentaryPress,
  applyMomentaryRelease,
  computeElectricalState,
  getComponentTerminals,
  isBreakerClosed,
  toggleComponentOperateState
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType, BuilderWire } from "../DiagramBuilder";

function component(type: BuilderComponentType, overrides: Partial<BuilderComponent> = {}): BuilderComponent {
  return {
    id: `operate-${type}`,
    label: type,
    rotation: 0,
    tag: null,
    type,
    usesCustomLabel: false,
    x: 100,
    y: 100,
    ...overrides
  };
}

function wire(
  from: BuilderComponent,
  fromTerminal: string,
  to: BuilderComponent,
  toTerminal: string
): BuilderWire {
  const start = getComponentTerminals(from).find((terminal) => terminal.terminalId === fromTerminal)!;
  const end = getComponentTerminals(to).find((terminal) => terminal.terminalId === toTerminal)!;

  return {
    color: "#111827",
    endPortId: end.portId,
    id: `wire-${from.id}-${to.id}-${fromTerminal}-${toTerminal}`,
    points: [{ x: start.x, y: start.y }, { x: end.x, y: end.y }],
    startPortId: start.portId,
    thickness: 3.5
  };
}

describe("operate actions (no simulator-running dependency)", () => {
  it("presses and releases momentary NO/NC buttons", () => {
    for (const type of ["PUSH_BUTTON_NO", "PUSH_BUTTON_NC"] as const) {
      const pressed = applyMomentaryPress([component(type)], `operate-${type}`);
      expect(pressed[0]!.isPressed).toBe(true);

      const released = applyMomentaryRelease(pressed, `operate-${type}`);
      expect(released[0]!.isPressed).toBe(false);
    }
  });

  it("latches ESTOP on press and leaves it latched on release", () => {
    const pressed = applyMomentaryPress([component("ESTOP")], "operate-ESTOP");
    expect(pressed[0]!.isPressed).toBe(true);

    const released = applyMomentaryRelease(pressed, "operate-ESTOP");
    expect(released[0]!.isPressed).toBe(true);

    const releasedAgain = applyMomentaryPress(released, "operate-ESTOP");
    expect(releasedAgain[0]!.isPressed).toBe(false);
  });

  it("toggles maintained switches, leaves breakers fixed closed, and leaves push buttons alone", () => {
    for (const type of [
      "SWITCH_1P",
      "LIMIT_SWITCH_NO",
      "LIMIT_SWITCH_NC",
      "LEVEL_SWITCH_NO",
      "LEVEL_SWITCH_NC",
      "TEMPERATURE_SWITCH",
      "FLOW_SWITCH",
      "PRESSURE_SWITCH",
      "OL_CONTACT"
    ] as const) {
      const initial = component(type, { isClosed: false });
      const toggled = toggleComponentOperateState([initial], initial.id);
      expect(toggled[0]!.isClosed).toBe(true);

      const toggledBack = toggleComponentOperateState(toggled, initial.id);
      expect(toggledBack[0]!.isClosed).toBe(false);
    }

    for (const type of ["BREAKER_1P", "BREAKER_2P", "FUSE"] as const) {
      for (const isClosed of [false, true, undefined] as const) {
        const initial = component(type, isClosed === undefined ? {} : { isClosed });
        expect(isBreakerClosed(initial)).toBe(true);

        const operated = toggleComponentOperateState([initial], initial.id);
        expect(operated[0]).toBe(initial);
        expect(isBreakerClosed(operated[0]!)).toBe(true);
      }
    }

    const pushButton = component("PUSH_BUTTON_NO", { isPressed: false });
    expect(toggleComponentOperateState([pushButton], pushButton.id)[0]).toBe(pushButton);
  });

  it("conducts through a fuse exactly like a closed breaker and lights a lamp", () => {
    const source = component("POWER_SOURCE", { id: "fuse-source", x: 40, y: 40 });
    const fuse = component("FUSE", { id: "fuse", x: 240, y: 40 });
    const lamp = component("LAMP", { id: "fuse-lamp", tag: "L", x: 440, y: 40 });
    const wires = [
      wire(source, "right", fuse, "in"),
      wire(fuse, "out", lamp, "in"),
      wire(lamp, "out", source, "left")
    ];

    expect(isBreakerClosed(fuse)).toBe(true);
    const live = computeElectricalState([source, fuse, lamp], wires, true, {});
    expect(live.energizedComponentIds.has(lamp.id)).toBe(true);
    expect(toggleComponentOperateState([fuse], fuse.id)[0]).toBe(fuse);
  });

  it("conducts level switches through the same maintained-switch path as limit switches", () => {
    for (const type of ["LEVEL_SWITCH_NO", "LEVEL_SWITCH_NC"] as const) {
      const source = component("POWER_SOURCE", { id: "level-source", x: 40, y: 40 });
      const coil = component("OTE", { id: "level-coil", tag: "M", x: 440, y: 40 });
      const level = component(type, {
        id: `level-${type}`,
        isClosed: type === "LEVEL_SWITCH_NC",
        x: 240,
        y: 40
      });
      const wires = [
        wire(source, "right", level, "in"),
        wire(level, "out", coil, "in"),
        wire(coil, "out", source, "left")
      ];

      const rest = computeElectricalState([source, level, coil], wires, true, {});
      expect(rest.resolvedTagValues.M).toBe(type === "LEVEL_SWITCH_NC");

      const toggled = toggleComponentOperateState([level], level.id)[0]!;
      const operated = computeElectricalState([source, toggled, coil], wires, true, {});
      expect(operated.resolvedTagValues.M).toBe(type === "LEVEL_SWITCH_NO");
    }
  });

  it("toggles process sensor switches open -> closed -> open and changes lamp conduction", () => {
    for (const type of ["TEMPERATURE_SWITCH", "FLOW_SWITCH", "PRESSURE_SWITCH"] as const) {
      const source = component("POWER_SOURCE", { id: `sensor-source-${type}`, x: 40, y: 40 });
      const sensor = component(type, { id: `sensor-${type}`, x: 240, y: 40 });
      const lamp = component("LAMP", { id: `sensor-lamp-${type}`, tag: "L", x: 440, y: 40 });
      const wires = [
        wire(source, "right", sensor, "in"),
        wire(sensor, "out", lamp, "in"),
        wire(lamp, "out", source, "left")
      ];

      const openState = computeElectricalState([source, sensor, lamp], wires, true, {});
      expect(openState.energizedComponentIds.has(lamp.id)).toBe(false);

      const closed = toggleComponentOperateState([sensor], sensor.id)[0]!;
      expect(closed.isClosed).toBe(true);
      const closedState = computeElectricalState([source, closed, lamp], wires, true, {});
      expect(closedState.energizedComponentIds.has(lamp.id)).toBe(true);

      const reopened = toggleComponentOperateState([closed], closed.id)[0]!;
      expect(reopened.isClosed).toBe(false);
      const reopenedState = computeElectricalState([source, reopened, lamp], wires, true, {});
      expect(reopenedState.energizedComponentIds.has(lamp.id)).toBe(false);
    }
  });
});
