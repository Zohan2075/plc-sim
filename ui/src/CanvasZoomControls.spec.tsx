import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CanvasZoomIndicator,
  CanvasZoomMenu,
  getNextZoomMenuIndex,
  getZoomMenuActions,
  getZoomMenuEdgeIndex,
  resolveZoomMenuKey
} from "./CanvasZoomControls";
import { createCanvasZoomStore } from "./canvasZoomStore";

describe("zoom menu actions", () => {
  it("lists Fit, 100%, 125%, 200% and Zoom to selection", () => {
    expect(getZoomMenuActions(true).map((action) => action.label))
      .toEqual(["Fit", "100%", "125%", "200%", "Zoom to selection"]);
  });

  it("disables zoom-to-selection without a selection", () => {
    const withoutSelection = getZoomMenuActions(false);
    const withSelection = getZoomMenuActions(true);

    expect(withoutSelection.at(-1)?.disabled).toBe(true);
    expect(withSelection.at(-1)?.disabled).toBe(false);
  });
});

describe("zoom menu keyboard helpers", () => {
  it("wraps arrow navigation and finds the edges", () => {
    expect(getNextZoomMenuIndex(4, 5, 1)).toBe(0);
    expect(getNextZoomMenuIndex(0, 5, -1)).toBe(4);
    expect(getNextZoomMenuIndex(-1, 5, 1)).toBe(0);
    expect(getZoomMenuEdgeIndex(5, "first")).toBe(0);
    expect(getZoomMenuEdgeIndex(5, "last")).toBe(4);
  });

  it("selects the active preset with Enter and closes on Escape", () => {
    const actions = getZoomMenuActions(true);

    expect(resolveZoomMenuKey({ key: "Enter" }, actions, 3))
      .toEqual({ action: actions[3], type: "select" });
    expect(resolveZoomMenuKey({ key: "Escape" }, actions, 0)).toEqual({ type: "close" });
    expect(resolveZoomMenuKey({ key: "Home" }, actions, 4)).toEqual({ index: 0, type: "move" });
    expect(resolveZoomMenuKey({ key: "End" }, actions, 0)).toEqual({ index: 4, type: "move" });
  });

  it("does not run a disabled action", () => {
    const actions = getZoomMenuActions(false);

    expect(resolveZoomMenuKey({ key: "Enter" }, actions, 4)).toBeNull();
  });
});

describe("zoom controls markup", () => {
  it("shows the current zoom percentage from the store", () => {
    const markup = renderToStaticMarkup(createElement(CanvasZoomIndicator, {
      hasSelection: false,
      onActual: vi.fn(),
      onFit: vi.fn(),
      onPreset: vi.fn(),
      onZoomSelection: vi.fn(),
      store: createCanvasZoomStore(1.25)
    }));

    expect(markup).toContain("125%");
    expect(markup).toContain('aria-haspopup="menu"');
  });

  it("renders every preset row with the disabled selection item", () => {
    const actions = getZoomMenuActions(false);
    const markup = renderToStaticMarkup(createElement(CanvasZoomMenu, {
      actions,
      activeIndex: 0,
      onActivate: vi.fn(),
      onHover: vi.fn()
    }));

    expect(markup).toContain("Fit");
    expect(markup).toContain("100%");
    expect(markup).toContain("125%");
    expect(markup).toContain("200%");
    expect(markup).toContain("Zoom to selection");
    expect(markup).toContain("disabled");
  });
});
