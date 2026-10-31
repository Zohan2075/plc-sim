import { describe, expect, it } from "vitest";
import {
  buildDuplicatedComponent,
  closeComponentMenuOnEvent,
  isWireOriginHit,
  resolveCanvasContextMenuAction
} from "./interaction";
import type { ComponentMenuCloseEvent, ComponentMenuState } from "./interaction";
import { getComponentPlaneSnapOffset } from "./grid";
import { DEFAULT_PLANE_SETTINGS, applyMomentaryPress, applyMomentaryRelease } from "../DiagramBuilder";
import type { BuilderComponent } from "../DiagramBuilder";

function makeComponent(overrides: Partial<BuilderComponent> = {}): BuilderComponent {
  return {
    id: "component-1",
    label: "Lampara",
    rotation: 0,
    tag: null,
    type: "LAMP",
    usesCustomLabel: false,
    x: 180,
    y: 180,
    ...overrides
  };
}

describe("resolveCanvasContextMenuAction", () => {
  it("cancels the wire while a draft is in progress", () => {
    expect(resolveCanvasContextMenuAction({ draftPointCount: 2, hasReconnectTarget: false })).toBe("cancel-wire");
  });

  it("cancels while a reconnect target is armed", () => {
    expect(resolveCanvasContextMenuAction({ draftPointCount: 0, hasReconnectTarget: true })).toBe("cancel-wire");
  });

  it("keeps the native context menu when idle", () => {
    expect(resolveCanvasContextMenuAction({ draftPointCount: 0, hasReconnectTarget: false })).toBe("allow-default");
  });
});

describe("isWireOriginHit", () => {
  const draft = [{ x: 100, y: 100 }, { x: 140, y: 100 }];

  it("cancels when clicking back on the wire origin", () => {
    expect(isWireOriginHit(draft, { x: 100, y: 100 })).toBe(true);
    expect(isWireOriginHit(draft, { x: 103, y: 104 })).toBe(true);
  });

  it("does not cancel on any other point of the draft or the canvas", () => {
    expect(isWireOriginHit(draft, { x: 140, y: 100 })).toBe(false);
    expect(isWireOriginHit(draft, { x: 100, y: 112 })).toBe(false);
    expect(isWireOriginHit(draft, { x: 220, y: 140 })).toBe(false);
  });

  it("does nothing when no wire is being drawn", () => {
    expect(isWireOriginHit([], { x: 100, y: 100 })).toBe(false);
  });
});

describe("buildDuplicatedComponent", () => {
  it("assigns the provided id and offsets by two grid spacings on the grid", () => {
    const planeSettings = DEFAULT_PLANE_SETTINGS;
    const source = makeComponent();
    const duplicated = buildDuplicatedComponent(source, 7, planeSettings);

    expect(duplicated.id).toBe("builder-component-7");
    // The anchor (position + entry-terminal offset) must stay on the grid after snapping.
    const offset = getComponentPlaneSnapOffset(duplicated);
    expect((duplicated.x + offset.x) % planeSettings.gridSpacing).toBe(0);
    expect((duplicated.y + offset.y) % planeSettings.gridSpacing).toBe(0);
    expect(duplicated.x).toBeGreaterThan(source.x);
    expect(duplicated.y).toBeGreaterThan(source.y);
  });

  it("preserves rotation, label, tag and type", () => {
    const source = makeComponent({ label: "Motor 2", rotation: 3, tag: "M2", type: "MOTOR", usesCustomLabel: true });
    const duplicated = buildDuplicatedComponent(source, 1, DEFAULT_PLANE_SETTINGS);

    expect(duplicated.label).toBe("Motor 2");
    expect(duplicated.rotation).toBe(3);
    expect(duplicated.tag).toBe("M2");
    expect(duplicated.type).toBe("MOTOR");
    expect(duplicated.usesCustomLabel).toBe(true);
  });

  it("clamps inside the plane when the offset would overflow", () => {
    const planeSettings = DEFAULT_PLANE_SETTINGS;
    const nearEdge = makeComponent({
      x: planeSettings.width - 160 - 18,
      y: planeSettings.height - 136 - 18
    });
    const duplicated = buildDuplicatedComponent(nearEdge, 2, planeSettings);

    expect(duplicated.x).toBeLessThanOrEqual(planeSettings.width - 160 - 18);
    expect(duplicated.y).toBeLessThanOrEqual(planeSettings.height - 136 - 18);
  });
});

describe("closeComponentMenuOnEvent", () => {
  const openMenu: ComponentMenuState = {
    anchor: { x: 10, y: 20 },
    componentId: "component-1",
    editingLabel: false
  };

  const events: ComponentMenuCloseEvent[] = ["canvas-click", "drag-start", "wire-start", "escape", "action-run"];

  it("closes the menu on every close event", () => {
    for (const event of events) {
      expect(closeComponentMenuOnEvent(openMenu, event)).toBeNull();
    }
  });

  it("is a no-op on an already closed menu", () => {
    for (const event of events) {
      expect(closeComponentMenuOnEvent(null, event)).toBeNull();
    }
  });
});

describe("applyMomentaryPress / applyMomentaryRelease", () => {
  it("presses and releases a momentary push button", () => {
    const button = makeComponent({ type: "PUSH_BUTTON_NO", isPressed: false });

    const pressed = applyMomentaryPress([button], button.id);
    expect(pressed[0]?.isPressed).toBe(true);

    const released = applyMomentaryRelease(pressed, button.id);
    expect(released[0]?.isPressed).toBe(false);
  });

  it("latches the e-stop on press and ignores the pointer release", () => {
    const estop = makeComponent({ type: "ESTOP", isPressed: false });

    const pressed = applyMomentaryPress([estop], estop.id);
    expect(pressed[0]?.isPressed).toBe(true);

    const released = applyMomentaryRelease(pressed, estop.id);
    expect(released[0]?.isPressed).toBe(true);
  });

  it("unlatches the e-stop on a second press", () => {
    const latched = makeComponent({ type: "ESTOP", isPressed: true });
    const unlatched = applyMomentaryPress([latched], latched.id);

    expect(unlatched[0]?.isPressed).toBe(false);
  });

  it("leaves other components untouched", () => {
    const estop = makeComponent({ id: "estop", type: "ESTOP", isPressed: false });
    const lamp = makeComponent({ id: "lamp", type: "LAMP" });

    const next = applyMomentaryPress([estop, lamp], estop.id);

    expect(next[1]).toBe(lamp);
  });
});
