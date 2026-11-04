import { describe, expect, it } from "vitest";
import {
  applyMomentaryPress,
  applyMomentaryRelease,
  getNextSelectorPosition,
  isBreakerClosed,
  toggleComponentOperateState
} from "../DiagramBuilder";
import type { BuilderComponent, BuilderComponentType } from "../DiagramBuilder";

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

  it("cycles the 3-position selector 1 -> 2 -> 3 -> 2 -> 1", () => {
    let position: 1 | 2 | 3 = 2;
    let direction: 1 | -1 = 1;
    const sequence: Array<1 | 2 | 3> = [];

    for (let step = 0; step < 5; step += 1) {
      const next = getNextSelectorPosition(position, direction);
      position = next.position;
      direction = next.direction;
      sequence.push(position);
    }

    expect(sequence).toEqual([3, 2, 1, 2, 3]);

    position = 2;
    direction = -1;
    const reverseSequence: Array<1 | 2 | 3> = [];

    for (let step = 0; step < 5; step += 1) {
      const next = getNextSelectorPosition(position, direction);
      position = next.position;
      direction = next.direction;
      reverseSequence.push(position);
    }

    expect(reverseSequence).toEqual([1, 2, 3, 2, 1]);
  });

  it("toggles maintained switches and breakers, and leaves push buttons alone", () => {
    for (const type of ["SWITCH_1P", "LIMIT_SWITCH_NO", "LIMIT_SWITCH_NC", "OL_CONTACT"] as const) {
      const initial = component(type, { isClosed: false });
      const toggled = toggleComponentOperateState([initial], initial.id);
      expect(toggled[0]!.isClosed).toBe(true);

      const toggledBack = toggleComponentOperateState(toggled, initial.id);
      expect(toggledBack[0]!.isClosed).toBe(false);
    }

    for (const type of ["BREAKER_1P", "BREAKER_2P"] as const) {
      const initial = component(type);
      expect(isBreakerClosed(initial)).toBe(true);

      const opened = toggleComponentOperateState([initial], initial.id);
      expect(isBreakerClosed(opened[0]!)).toBe(false);

      const closed = toggleComponentOperateState(opened, initial.id);
      expect(isBreakerClosed(closed[0]!)).toBe(true);
    }

    const pushButton = component("PUSH_BUTTON_NO", { isPressed: false });
    expect(toggleComponentOperateState([pushButton], pushButton.id)[0]).toBe(pushButton);
  });
});
