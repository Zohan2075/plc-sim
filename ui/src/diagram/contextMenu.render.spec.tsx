import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  getComponentTerminals,
  LAMP_GLOW_COLOR_OPTIONS,
  rotateComponentInScene
} from "../DiagramBuilder";
import type {
  BuilderComponent,
  BuilderPlaneSettings,
  BuilderScene,
  Point
} from "../DiagramBuilder";
import { snapComponentToPlaneGrid } from "./grid";
import {
  buildCanvasMenu,
  buildComponentMenu,
  ContextMenuActionRow,
  ContextMenuSubmenuRow
} from "./contextMenu";
import type {
  ContextMenuActions,
  ContextMenuLampColorOption,
  ContextMenuTarget,
  MenuItem
} from "./contextMenu";

function createActions(): ContextMenuActions {
  return {
    copyComponents: vi.fn(),
    deleteComponent: vi.fn(),
    deleteWire: vi.fn(),
    duplicateComponent: vi.fn(),
    paste: vi.fn(),
    redo: vi.fn(),
    renameComponent: vi.fn(),
    rotateComponents: vi.fn(),
    setLampGlowColor: vi.fn(),
    setWireColor: vi.fn(),
    setWireThickness: vi.fn(),
    simplifyWire: vi.fn(),
    undo: vi.fn()
  };
}

const lampOptions: ContextMenuLampColorOption[] = LAMP_GLOW_COLOR_OPTIONS.map((option) => ({
  ...option,
  swatch: "#000000"
}));

const componentTarget: ContextMenuTarget = {
  anchor: { x: 100, y: 100 },
  componentId: "builder-component-1",
  componentLabel: "L1",
  componentRotation: 1,
  componentType: "XIC",
  kind: "component",
  selectedComponentIds: ["builder-component-1"]
};

const lampTarget: ContextMenuTarget = {
  ...componentTarget,
  componentId: "builder-component-lamp",
  componentLabel: "LAMP",
  componentType: "LAMP",
  lampGlowColor: "green"
};

const canvasTarget: ContextMenuTarget = {
  anchor: { x: 100, y: 100 },
  kind: "canvas"
};

function actionItems(items: MenuItem[]): Array<Extract<MenuItem, { kind: "action" }>> {
  return items.flatMap((item) => {
    if (item.kind === "action") {
      return [item];
    }

    return item.kind === "submenu" ? actionItems(item.items) : [];
  });
}

function submenuItems(items: MenuItem[]): Array<Extract<MenuItem, { kind: "submenu" }>> {
  return items.flatMap((item) => {
    if (item.kind === "submenu") {
      return [item, ...submenuItems(item.items)];
    }

    return [];
  });
}

function labelText(html: string): string | null {
  return /<span class="context-menu__label">([^<]*)<\/span>/.exec(html)?.[1] ?? null;
}

function shortcutText(html: string): string | null {
  const match = /<span class="context-menu__shortcut">([^<]*)<\/span>/.exec(html);
  return match ? match[1]! : null;
}

function slotCount(html: string): number {
  // Count the four direct row slots; the swatch is nested inside the icon slot.
  return (html.match(/class="context-menu__(?:check|icon|label|shortcut)"/g) ?? []).length;
}

describe("context menu row rendering", () => {
  for (const [name, target] of [
    ["component", componentTarget],
    ["lamp", lampTarget]
  ] as const) {
    it(`${name} menu renders every label in its own slot with a separate shortcut`, () => {
      const actions = createActions();
      const items = buildComponentMenu(target, actions, lampOptions);
      const actionsList = actionItems(items);

      expect(actionsList.length).toBeGreaterThan(0);

      for (const item of actionsList) {
        const html = renderToStaticMarkup(createElement(ContextMenuActionRow, {
          item,
          onSelect: () => undefined
        }));

        expect(item.label.length).toBeGreaterThan(0);
        expect(labelText(html)).toBe(item.label);
        expect(shortcutText(html)).toBe(item.shortcut ?? "");
        // check + icon + label + shortcut: the 4-column grid contract.
        expect(slotCount(html)).toBe(4);
        expect(html.includes("context-menu__icon")).toBe(true);
        expect(html.includes("context-menu__swatch")).toBe(Boolean(item.swatch));
      }

      for (const submenu of submenuItems(items)) {
        const html = renderToStaticMarkup(createElement(ContextMenuSubmenuRow, {
          expanded: false,
          item: submenu,
          onOpen: () => undefined
        }));

        expect(labelText(html)).toBe(submenu.label);
        expect(shortcutText(html)).toBe("›");
        expect(slotCount(html)).toBe(4);
      }
    });
  }

  it("canvas menu renders Paste/Undo/Redo labels", () => {
    const actions = createActions();
    const items = buildCanvasMenu(canvasTarget, actions, {
      canPaste: true,
      canRedo: true,
      canUndo: true
    });

    expect(items.map((item) => (item.kind === "action" ? item.label : item.kind))).toEqual([
      "Paste",
      "Undo",
      "Redo"
    ]);

    for (const item of actionItems(items)) {
      const html = renderToStaticMarkup(createElement(ContextMenuActionRow, {
        item,
        onSelect: () => undefined
      }));

      expect(labelText(html)).toBe(item.label);
      expect(slotCount(html)).toBe(4);
    }
  });

  it("hides canvas actions that are not available", () => {
    const items = buildCanvasMenu(canvasTarget, createActions(), {
      canPaste: false,
      canRedo: false,
      canUndo: false
    });

    expect(items).toEqual([]);
  });

  it("runs the menu rotate item with the clicked component id", () => {
    const actions = createActions();
    const items = buildComponentMenu(componentTarget, actions, lampOptions);
    const rotateMenu = submenuItems(items).find((item) => item.id === "rotate");
    const clockwise = actionItems(rotateMenu?.items ?? []).find((item) => item.id === "rotate-cw");

    expect(clockwise).toBeDefined();
    clockwise!.onSelect();
    expect(actions.rotateComponents).toHaveBeenCalledWith(["builder-component-1"], "cw");
  });

  it("four clicks on the Rotate menu item go 0 -> 1 -> 2 -> 3 -> 0", () => {
    const settings: BuilderPlaneSettings = { gridSpacing: 18, height: 20000, width: 4200 };
    const source: BuilderComponent = {
      id: "builder-component-menu",
      label: "XIC",
      rotation: 0,
      tag: null,
      type: "XIC",
      usesCustomLabel: false,
      x: 324,
      y: 399
    };
    const start = snapComponentToPlaneGrid(source, settings);
    const startTerminals = getComponentTerminals(start);
    let scene: BuilderScene = { components: [start], wires: [] };
    const actions = createActions();

    actions.rotateComponents = (componentIds, action) => {
      for (const componentId of componentIds) {
        const current = scene.components.find((component) => component.id === componentId);

        if (!current) {
          continue;
        }

        const delta = action === "cw" ? 1 : action === "ccw" ? 3 : 2;
        scene = rotateComponentInScene(scene, componentId, current.rotation + delta, settings);
      }
    };

    const items = buildComponentMenu({
      anchor: { x: 0, y: 0 },
      componentId: start.id,
      componentRotation: start.rotation,
      componentType: start.type,
      kind: "component",
      selectedComponentIds: [start.id]
    }, actions, lampOptions);
    const rotateMenu = submenuItems(items).find((item) => item.id === "rotate");
    const clockwise = actionItems(rotateMenu?.items ?? []).find((item) => item.id === "rotate-cw");

    expect(clockwise).toBeDefined();

    for (let click = 0; click < 4; click += 1) {
      clockwise!.onSelect();
    }

    const finalComponent = scene.components[0]!;
    const finalTerminals = getComponentTerminals(finalComponent);
    const startById = new Map(startTerminals.map((terminal) => [terminal.terminalId, terminal]));

    expect(finalComponent.rotation).toBe(0);

    for (const terminal of finalTerminals) {
      const original: Point = startById.get(terminal.terminalId)!;

      expect(Math.abs(terminal.x - original.x)).toBeLessThan(0.01);
      expect(Math.abs(terminal.y - original.y)).toBeLessThan(0.01);
    }
  });

  it("lists all seven lamp colors and marks the current one", () => {
    const items = buildComponentMenu(lampTarget, createActions(), lampOptions);
    const colorMenu = submenuItems(items).find((item) => item.id === "lamp-color");
    const colorItems = actionItems(colorMenu?.items ?? []);

    expect(colorItems).toHaveLength(7);
    expect(colorItems.find((item) => item.checked)?.label).toBe("Green");
    expect(colorItems.every((item) => Boolean(item.swatch))).toBe(true);
  });
});
