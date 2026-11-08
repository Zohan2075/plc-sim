import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { RibbonButton } from "./Ribbon";
import type { CanvasZoomStore } from "./canvasZoomStore";

export function useCanvasZoom(store: CanvasZoomStore): number {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function CanvasZoomRibbonButtons(props: {
  onActual: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <>
      <RibbonButton icon="−" label="Zoom out" shortcut="Ctrl+-" onClick={props.onZoomOut} />
      <RibbonButton icon="1:1" label="100%" shortcut="Ctrl+1" onClick={props.onActual} />
      <RibbonButton icon="+" label="Zoom in" shortcut="Ctrl++" onClick={props.onZoomIn} />
      <RibbonButton icon="⤢" label="Fit" shortcut="Ctrl+0" onClick={props.onFit} />
    </>
  );
}

export interface CanvasZoomAction {
  disabled?: boolean;
  id: "actual" | "fit" | "preset-125" | "preset-200" | "selection";
  label: string;
  shortcut?: string;
}

export type CanvasZoomMenuKeyAction =
  | { action: CanvasZoomAction; type: "select" }
  | { index: number; type: "move" }
  | { type: "close" };

export function getZoomMenuActions(hasSelection: boolean): CanvasZoomAction[] {
  return [
    { id: "fit", label: "Fit", shortcut: "Ctrl+0" },
    { id: "actual", label: "100%", shortcut: "Ctrl+1" },
    { id: "preset-125", label: "125%" },
    { id: "preset-200", label: "200%" },
    { disabled: !hasSelection, id: "selection", label: "Zoom to selection" }
  ];
}

export function getNextZoomMenuIndex(
  currentIndex: number,
  actionCount: number,
  direction: 1 | -1
): number {
  if (actionCount <= 0) {
    return -1;
  }

  const base = currentIndex < 0 ? (direction === 1 ? -1 : 0) : currentIndex;

  return (base + direction + actionCount) % actionCount;
}

export function getZoomMenuEdgeIndex(actionCount: number, edge: "first" | "last"): number {
  if (actionCount <= 0) {
    return -1;
  }

  return edge === "first" ? 0 : actionCount - 1;
}

export function resolveZoomMenuKey(
  event: { key: string },
  actions: readonly CanvasZoomAction[],
  activeIndex: number
): CanvasZoomMenuKeyAction | null {
  if (event.key === "Escape") {
    return { type: "close" };
  }

  if (event.key === "ArrowDown") {
    return { index: getNextZoomMenuIndex(activeIndex, actions.length, 1), type: "move" };
  }

  if (event.key === "ArrowUp") {
    return { index: getNextZoomMenuIndex(activeIndex, actions.length, -1), type: "move" };
  }

  if (event.key === "Home") {
    return { index: getZoomMenuEdgeIndex(actions.length, "first"), type: "move" };
  }

  if (event.key === "End") {
    return { index: getZoomMenuEdgeIndex(actions.length, "last"), type: "move" };
  }

  if (event.key === "Enter" || event.key === " ") {
    const action = actions[activeIndex];

    return action && !action.disabled ? { action, type: "select" } : null;
  }

  return null;
}

export function CanvasZoomMenu(props: {
  actions: readonly CanvasZoomAction[];
  activeIndex: number;
  onActivate: (action: CanvasZoomAction) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div className="canvas-zoom__menu" role="menu" aria-label="Zoom">
      {props.actions.map((action, index) => {
        const className = [
          "canvas-zoom__menu-item",
          index === props.activeIndex ? "canvas-zoom__menu-item--active" : ""
        ].filter(Boolean).join(" ");

        return (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            className={className}
            data-zoom-action={action.id}
            disabled={action.disabled}
            aria-disabled={action.disabled ? true : undefined}
            onPointerMove={() => props.onHover(index)}
            onClick={() => {
              if (!action.disabled) {
                props.onActivate(action);
              }
            }}
          >
            <span className="canvas-zoom__menu-label">{action.label}</span>
            <span className="canvas-zoom__menu-shortcut">{action.shortcut ?? ""}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CanvasZoomIndicator(props: {
  hasSelection: boolean;
  onActual: () => void;
  onFit: () => void;
  onPreset: (percent: number) => void;
  onZoomSelection: () => void;
  store: CanvasZoomStore;
}) {
  const zoom = useCanvasZoom(props.store);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const actions = getZoomMenuActions(props.hasSelection);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => menuRef.current?.focus());

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && wrapperRef.current?.contains(event.target)) {
        return;
      }

      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  function closeMenu(restoreFocus: boolean) {
    setOpen(false);

    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }

  function runAction(action: CanvasZoomAction) {
    if (action.id === "fit") {
      props.onFit();
    } else if (action.id === "actual") {
      props.onActual();
    } else if (action.id === "preset-125") {
      props.onPreset(125);
    } else if (action.id === "preset-200") {
      props.onPreset(200);
    } else {
      props.onZoomSelection();
    }

    closeMenu(true);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!open) {
      return;
    }

    const result = resolveZoomMenuKey(event, actions, activeIndex);

    if (!result) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (result.type === "close") {
      closeMenu(true);
      return;
    }

    if (result.type === "move") {
      if (result.index >= 0) {
        setActiveIndex(result.index);
      }

      return;
    }

    runAction(result.action);
  }

  return (
    <div ref={wrapperRef} className="canvas-zoom" onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="status-pill status-pill--neutral canvas-zoom__trigger"
        title="Zoom menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(0);
          }
        }}
      >
        {Math.round(zoom * 100)}%
      </button>
      {open ? (
        <div ref={menuRef} tabIndex={-1} className="canvas-zoom__menu-focus">
          <CanvasZoomMenu
            actions={actions}
            activeIndex={activeIndex}
            onActivate={runAction}
            onHover={setActiveIndex}
          />
        </div>
      ) : null}
    </div>
  );
}
