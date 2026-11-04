import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export type RibbonTabId =
  | "file"
  | "home"
  | "insert"
  | "simulation"
  | "view"
  | "component"
  | "wire";

export interface RibbonTab {
  contextual?: boolean;
  id: RibbonTabId;
  label: string;
}

export type RibbonTabDoubleClickAction = "toggle-collapse" | "none";

export function getRibbonTabDoubleClickAction(
  tabId: RibbonTabId,
  activeTab: RibbonTabId
): RibbonTabDoubleClickAction {
  return tabId === activeTab ? "toggle-collapse" : "none";
}

export function RibbonTabBar(props: {
  activeTab: RibbonTabId;
  collapsed: boolean;
  onSelect: (tab: RibbonTabId) => void;
  onToggleCollapse: () => void;
  tabs: RibbonTab[];
}) {
  const { activeTab, collapsed, onSelect, onToggleCollapse, tabs } = props;

  return (
    <div className="ribbon-tabs-row">
      <div className="ribbon-tabs" role="tablist" aria-label="Ribbon tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const className = [
            "ribbon-tab",
            isActive ? "ribbon-tab--active" : "",
            tab.contextual ? "ribbon-tab--contextual" : ""
          ].filter(Boolean).join(" ");

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={className}
              onClick={() => {
                onSelect(tab.id);
              }}
              onDoubleClick={() => {
                if (
                  !collapsed
                  && getRibbonTabDoubleClickAction(tab.id, activeTab) === "toggle-collapse"
                ) {
                  onToggleCollapse();
                }
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="ribbon-collapse-button"
        aria-label={collapsed ? "Expand ribbon" : "Collapse ribbon"}
        aria-expanded={!collapsed}
        onClick={onToggleCollapse}
      >
        {collapsed ? "⌄" : "⌃"}
      </button>
    </div>
  );
}

export function RibbonBody(props: { collapsed: boolean; children: ReactNode }) {
  return (
    <div className="ribbon-body" hidden={props.collapsed}>
      {props.children}
    </div>
  );
}

export function RibbonGroup(props: {
  label: string;
  compact: boolean;
  children: ReactNode;
}) {
  if (props.compact) {
    return (
      <details className="ribbon-group ribbon-group--compact">
        <summary className="ribbon-group__label">{props.label}</summary>
        <div className="ribbon-group__body">{props.children}</div>
      </details>
    );
  }

  return (
    <div className="ribbon-group">
      <div className="ribbon-group__label">{props.label}</div>
      <div className="ribbon-group__body">{props.children}</div>
    </div>
  );
}

export function RibbonButton(props: {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: (() => void) | undefined;
  ariaPressed?: boolean;
}) {
  const { icon, label, shortcut, active = false, disabled = false, onClick, ariaPressed } = props;
  const className = ["ribbon-button", active ? "ribbon-button--active" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-keyshortcuts={shortcut}
      aria-pressed={ariaPressed}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="ribbon-button__icon" aria-hidden="true">{icon}</span>
      <span className="ribbon-button__label">{label}</span>
    </button>
  );
}

export function RibbonField(props: { label: string; children: ReactNode }) {
  return (
    <label className="ribbon-field">
      <span className="ribbon-field__label">{props.label}</span>
      {props.children}
    </label>
  );
}

export function useCompactRibbon(breakpoint = 1280): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth < breakpoint
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const update = () => setCompact(window.innerWidth < breakpoint);

    update();
    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, [breakpoint]);

  return compact;
}
