import { describe, expect, it } from "vitest";
import {
  buildDuplicatedComponent,
  canEditConnections,
  closeComponentMenuOnEvent,
  computeFitZoom,
  isWireOriginHit,
  resolveCanvasContextMenuAction,
  resolveDiagramShortcut,
  updateComponentSelection,
  WIRE_CREATION_BLOCKED_MESSAGE
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

describe("canEditConnections", () => {
  it("blocks connection editing only while the simulator is running", () => {
    expect(canEditConnections(false)).toBe(true);
    expect(canEditConnections(true)).toBe(false);
  });

  it("exposes the single terminal feedback message", () => {
    expect(WIRE_CREATION_BLOCKED_MESSAGE).toBe("Stop the simulation to create wires");
  });
});

describe("updateComponentSelection", () => {
  it("replaces the selection on a plain click", () => {
    expect([...updateComponentSelection(new Set(["a"]), "b", false)]).toEqual(["b"]);
  });

  it("adds and removes with additive clicks", () => {
    expect([...updateComponentSelection(new Set(["a"]), "b", true)]).toEqual(["a", "b"]);
    expect([...updateComponentSelection(new Set(["a", "b"]), "a", true)]).toEqual(["b"]);
  });
});

describe("resolveDiagramShortcut", () => {
  it("maps R and Shift+R to clockwise/counter-clockwise rotation", () => {
    expect(resolveDiagramShortcut({ ctrlKey: false, key: "r", metaKey: false, shiftKey: false }))
      .toEqual({ direction: "cw", type: "rotate" });
    expect(resolveDiagramShortcut({ ctrlKey: false, key: "R", metaKey: false, shiftKey: true }))
      .toEqual({ direction: "ccw", type: "rotate" });
  });

  it("maps F5/Shift+F5 to run/stop", () => {
    expect(resolveDiagramShortcut({ ctrlKey: false, key: "F5", metaKey: false, shiftKey: false }))
      .toEqual({ type: "run" });
    expect(resolveDiagramShortcut({ ctrlKey: false, key: "F5", metaKey: false, shiftKey: true }))
      .toEqual({ type: "stop" });
    expect(resolveDiagramShortcut({ ctrlKey: true, key: "F5", metaKey: false, shiftKey: false }))
      .toBeNull();
  });

  it("maps the command palette and view shortcuts", () => {
    expect(resolveDiagramShortcut({ ctrlKey: true, key: "k", metaKey: false, shiftKey: false }))
      .toEqual({ type: "command-palette" });
    expect(resolveDiagramShortcut({ ctrlKey: false, key: "k", metaKey: true, shiftKey: false }))
      .toEqual({ type: "command-palette" });
    expect(resolveDiagramShortcut({ ctrlKey: true, key: "0", metaKey: false, shiftKey: false }))
      .toEqual({ action: "fit", type: "zoom" });
    expect(resolveDiagramShortcut({ ctrlKey: true, key: "1", metaKey: false, shiftKey: false }))
      .toEqual({ action: "actual", type: "zoom" });
    expect(resolveDiagramShortcut({ ctrlKey: true, key: "+", metaKey: false, shiftKey: true }))
      .toEqual({ action: "in", type: "zoom" });
    expect(resolveDiagramShortcut({ ctrlKey: true, key: "=", metaKey: false, shiftKey: false }))
      .toEqual({ action: "in", type: "zoom" });
    expect(resolveDiagramShortcut({ ctrlKey: true, key: "-", metaKey: false, shiftKey: false }))
      .toEqual({ action: "out", type: "zoom" });
  });

  it("keeps undo/redo/copy on their modifiers and ignores plain letters", () => {
    expect(resolveDiagramShortcut({ ctrlKey: true, key: "z", metaKey: false, shiftKey: false }))
      .toEqual({ type: "undo" });
    expect(resolveDiagramShortcut({ ctrlKey: false, key: "z", metaKey: true, shiftKey: true }))
      .toEqual({ type: "redo" });
    expect(resolveDiagramShortcut({ ctrlKey: true, key: "y", metaKey: false, shiftKey: false }))
      .toEqual({ type: "redo" });
    expect(resolveDiagramShortcut({ ctrlKey: true, key: "c", metaKey: false, shiftKey: false }))
      .toEqual({ type: "copy" });
    expect(resolveDiagramShortcut({ ctrlKey: false, key: "x", metaKey: false, shiftKey: false }))
      .toBeNull();
  });
});

describe("computeFitZoom", () => {
  it("fits the limiting axis", () => {
    expect(computeFitZoom(
      { height: 940, width: 1720 },
      { height: 470, width: 860 }
    )).toBe(0.5);
    expect(computeFitZoom(
      { height: 940, width: 1720 },
      { height: 1000, width: 860 }
    )).toBe(0.5);
  });

  it("falls back to 1 for empty content", () => {
    expect(computeFitZoom(
      { height: 0, width: 1720 },
      { height: 470, width: 860 }
    )).toBe(1);
  });
});

describe("resolveCanvasContextMenuAction", () => {
  it("cancels the wire while a draft is in progress", () => {
    expect(resolveCanvasContextMenuAction({ draftPointCount: 2, hasReconnectTarget: false })).toBe("cancel-wire");
  });

  it("cancels while a reconnect target is armed", () => {
    expect(resolveCanvasContextMenuAction({ draftPointCount: 0, hasReconnectTarget: true })).toBe("cancel-wire");
  });

  it("opens the custom canvas menu when idle", () => {
    expect(resolveCanvasContextMenuAction({ draftPointCount: 0, hasReconnectTarget: false })).toBe("open-menu");
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
