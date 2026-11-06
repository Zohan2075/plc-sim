import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getNextRibbonTabIndex,
  getRibbonTabDoubleClickAction,
  getRibbonTabEdgeIndex,
  RibbonBody,
  RibbonButton,
  RibbonGroup,
  RibbonTabBar
} from "./Ribbon";
import type { RibbonTab } from "./Ribbon";

const tabs: RibbonTab[] = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "component", label: "Component", contextual: true }
];

describe("RibbonTabBar", () => {
  it("renders tabs, marks the active tab and exposes the collapse button", () => {
    const markup = renderToStaticMarkup(createElement(RibbonTabBar, {
      activeTab: "home",
      collapsed: false,
      onSelect: () => undefined,
      onToggleCollapse: () => undefined,
      tabs
    }));

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tab"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain("ribbon-tab--contextual");
    expect(markup).toContain('aria-label="Collapse ribbon"');
  });

  it("uses a roving tab index with only the active tab in the tab order", () => {
    const markup = renderToStaticMarkup(createElement(RibbonTabBar, {
      activeTab: "home",
      collapsed: false,
      onSelect: () => undefined,
      onToggleCollapse: () => undefined,
      tabs
    }));

    expect((markup.match(/tabindex="0"/g) ?? []).length).toBe(1);
    expect((markup.match(/tabindex="-1"/g) ?? []).length).toBe(tabs.length - 1);
  });

  it("switches the collapse label when collapsed", () => {
    const markup = renderToStaticMarkup(createElement(RibbonTabBar, {
      activeTab: "home",
      collapsed: true,
      onSelect: () => undefined,
      onToggleCollapse: () => undefined,
      tabs
    }));

    expect(markup).toContain('aria-label="Expand ribbon"');
  });
});

describe("RibbonBody", () => {
  it("renders children when expanded and hides them when collapsed", () => {
    const expanded = renderToStaticMarkup(createElement(RibbonBody, {
      collapsed: false,
      children: createElement("span", null, "body")
    }));
    const collapsed = renderToStaticMarkup(createElement(RibbonBody, {
      collapsed: true,
      children: createElement("span", null, "body")
    }));

    expect(expanded).toContain("body");
    expect(expanded).not.toContain("hidden");
    expect(collapsed).toContain("hidden");
  });
});

describe("RibbonGroup", () => {
  it("uses a details dropdown in compact mode", () => {
    const markup = renderToStaticMarkup(createElement(RibbonGroup, {
      compact: true,
      label: "Clipboard",
      children: createElement("span", null, "control")
    }));

    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
    expect(markup).toContain("Clipboard");
  });

  it("uses a labelled inline group in wide mode", () => {
    const markup = renderToStaticMarkup(createElement(RibbonGroup, {
      compact: false,
      label: "Clipboard",
      children: createElement("span", null, "control")
    }));

    expect(markup).not.toContain("<details");
    expect(markup).toContain("ribbon-group__label");
    expect(markup).toContain("control");
  });
});

describe("RibbonButton", () => {
  it("renders shortcut metadata and active state", () => {
    const markup = renderToStaticMarkup(createElement(RibbonButton, {
      active: true,
      icon: "↶",
      label: "Undo",
      shortcut: "Ctrl+Z"
    }));

    expect(markup).toContain('title="Undo (Ctrl+Z)"');
    expect(markup).toContain('aria-keyshortcuts="Ctrl+Z"');
    expect(markup).toContain("ribbon-button--active");
  });
});

describe("ribbon tab helpers", () => {
  it("toggles collapse only when the active tab is double-clicked", () => {
    expect(getRibbonTabDoubleClickAction("home", "home")).toBe("toggle-collapse");
    expect(getRibbonTabDoubleClickAction("insert", "home")).toBe("none");
  });

  it("wraps the next tab index in both directions", () => {
    expect(getNextRibbonTabIndex(2, 3, 1)).toBe(0);
    expect(getNextRibbonTabIndex(0, 3, -1)).toBe(2);
    expect(getNextRibbonTabIndex(1, 3, 1)).toBe(2);
    expect(getNextRibbonTabIndex(1, 3, -1)).toBe(0);
  });

  it("starts at the first or last tab when nothing is focused", () => {
    expect(getNextRibbonTabIndex(-1, 3, 1)).toBe(0);
    expect(getNextRibbonTabIndex(-1, 3, -1)).toBe(2);
  });

  it("returns no tab for an empty tab list", () => {
    expect(getNextRibbonTabIndex(0, 0, 1)).toBe(-1);
    expect(getRibbonTabEdgeIndex(0, "first")).toBe(-1);
  });

  it("returns the first and last tab edges", () => {
    expect(getRibbonTabEdgeIndex(3, "first")).toBe(0);
    expect(getRibbonTabEdgeIndex(3, "last")).toBe(2);
  });
});
