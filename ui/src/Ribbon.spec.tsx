import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getRibbonTabDoubleClickAction,
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
});
