import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { BuilderComponentType, BuilderWire, LampGlowColorOption, Point } from "../DiagramBuilder";
import { isOperable } from "./operability";

export type RotationAction = "cw" | "ccw" | "half" | "angle0" | "angle90" | "angle180" | "angle270";

export interface ContextMenuLampColorOption {
  label: string;
  swatch: string;
  value: LampGlowColorOption;
}

export interface ContextMenuTarget {
  kind: "component" | "canvas" | "wire";
  anchor: Point;
  componentId?: string;
  componentLabel?: string;
  componentRotation?: number;
  componentType?: BuilderComponentType;
  lampGlowColor?: LampGlowColorOption;
  selectedComponentIds?: string[];
  selectorPosition?: 1 | 2 | 3;
  wire?: BuilderWire;
}

export interface ContextMenuActions {
  copyComponents: (ids: string[]) => void;
  deleteComponent: (id: string) => void;
  deleteWire: (id: string) => void;
  duplicateComponent: (id: string) => void;
  paste: (anchor: Point) => void;
  redo: () => void;
  renameComponent: (id: string, label: string) => void;
  rotateComponents: (ids: string[], action: RotationAction) => void;
  setLampGlowColor: (ids: string[], color: LampGlowColorOption) => void;
  setSelectorPosition: (ids: string[], position: 1 | 2 | 3) => void;
  setWireColor: (id: string, color: string) => void;
  setWireThickness: (id: string, thickness: number) => void;
  simplifyWire: (id: string) => void;
  undo: () => void;
}

export interface ContextMenuHandle {
  close: () => void;
  open: (target: ContextMenuTarget) => void;
}

interface ContextMenuLayerProps {
  actions: ContextMenuActions;
  getAvailability: () => { canPaste: boolean; canRedo: boolean; canUndo: boolean };
  lampColorOptions: readonly ContextMenuLampColorOption[];
  locked: boolean;
  onClose: () => void;
}

export interface MenuSize {
  height: number;
  width: number;
}

export interface ViewportSize {
  height: number;
  width: number;
}

export interface MenuPosition {
  left: number;
  maxHeight: number;
  maxWidth: number;
  top: number;
}

export function clampMenuPosition(
  anchor: Point,
  size: MenuSize,
  viewport: ViewportSize,
  margin = 8
): MenuPosition {
  const maxWidth = Math.max(0, viewport.width - margin * 2);
  const maxHeight = Math.max(0, viewport.height - margin * 2);
  const width = Math.min(size.width, maxWidth);
  const height = Math.min(size.height, maxHeight);
  let left = anchor.x;
  let top = anchor.y;

  if (left + width > viewport.width - margin) {
    left = anchor.x - width;
  }

  if (top + height > viewport.height - margin) {
    top = anchor.y - height;
  }

  return {
    left: Math.min(Math.max(left, margin), Math.max(margin, viewport.width - width - margin)),
    maxHeight,
    maxWidth,
    top: Math.min(Math.max(top, margin), Math.max(margin, viewport.height - height - margin))
  };
}

export function getSubmenuSide(
  parentRect: Pick<DOMRect, "left" | "right">,
  submenuWidth: number,
  viewportWidth: number,
  margin = 8
): "left" | "right" {
  const spaceRight = viewportWidth - parentRect.right;
  const spaceLeft = parentRect.left;

  if (spaceRight >= submenuWidth + margin) {
    return "right";
  }

  if (spaceLeft >= submenuWidth + margin) {
    return "left";
  }

  return spaceRight >= spaceLeft ? "right" : "left";
}

export function getNextMenuIndex(
  currentIndex: number,
  itemCount: number,
  direction: 1 | -1
): number {
  if (itemCount <= 0) {
    return -1;
  }

  return (currentIndex + direction + itemCount) % itemCount;
}

export function isLongPressCancelled(
  start: Point,
  current: Point,
  threshold = 8
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > threshold;
}

/**
 * Closing a menu that was never open must not move focus. Otherwise every
 * canvas click focuses (and scrolls) the canvas, which shifts the component
 * between the two clicks of a double-click.
 */
export function shouldRestoreMenuFocus(wasOpen: boolean): boolean {
  return wasOpen;
}

export type MenuItem =
  | {
    checked?: boolean;
    danger?: boolean;
    id: string;
    kind: "action";
    label: string;
    onSelect: () => void;
    shortcut?: string;
    swatch?: string;
  }
  | {
    id: string;
    items: MenuItem[];
    kind: "submenu";
    label: string;
  }
  | {
    id: string;
    kind: "separator";
  }
  | {
    id: string;
    kind: "custom";
    render: () => ReactNode;
  };

export function buildComponentMenu(
  target: ContextMenuTarget,
  actions: ContextMenuActions,
  lampColorOptions: readonly ContextMenuLampColorOption[]
): MenuItem[] {
  const componentId = target.componentId;

  if (!componentId) {
    return [];
  }

  const selectedIds = target.selectedComponentIds ?? [componentId];
  const rotation = ((target.componentRotation ?? 0) % 4 + 4) % 4;
  const items: MenuItem[] = [
    {
      id: "rotate",
      items: [
        {
          id: "rotate-cw",
          kind: "action",
          label: "Rotate 90° clockwise",
          shortcut: "R",
          onSelect: () => actions.rotateComponents(selectedIds, "cw")
        },
        {
          id: "rotate-ccw",
          kind: "action",
          label: "Rotate 90° counter-clockwise",
          shortcut: "Shift+R",
          onSelect: () => actions.rotateComponents(selectedIds, "ccw")
        },
        {
          id: "rotate-half",
          kind: "action",
          label: "Rotate 180°",
          onSelect: () => actions.rotateComponents(selectedIds, "half")
        },
        { id: "rotate-separator", kind: "separator" },
        ...[0, 1, 2, 3].map((turns) => ({
          checked: rotation === turns,
          id: `rotate-angle-${turns}`,
          kind: "action" as const,
          label: `Set angle ${turns * 90}°`,
          onSelect: () => actions.rotateComponents(selectedIds, `angle${turns * 90}` as RotationAction)
        })),
        ...(rotation === 0
          ? []
          : [{
            id: "rotate-reset",
            kind: "action" as const,
            label: "Reset rotation",
            onSelect: () => actions.rotateComponents(selectedIds, "angle0")
          }])
      ],
      kind: "submenu",
      label: "Rotate"
    }
  ];

  if (target.componentType && isOperable[target.componentType] === "position") {
    items.push({
      id: "selector-position",
      items: [
        {
          checked: (target.selectorPosition ?? 2) === 1,
          id: "selector-position-1",
          kind: "action",
          label: "1st contact",
          onSelect: () => actions.setSelectorPosition(selectedIds, 1)
        },
        {
          checked: (target.selectorPosition ?? 2) === 2,
          id: "selector-position-2",
          kind: "action",
          label: "2nd OFF",
          onSelect: () => actions.setSelectorPosition(selectedIds, 2)
        },
        {
          checked: (target.selectorPosition ?? 2) === 3,
          id: "selector-position-3",
          kind: "action",
          label: "3rd contact",
          onSelect: () => actions.setSelectorPosition(selectedIds, 3)
        }
      ],
      kind: "submenu",
      label: "Position"
    });
  }

  if (target.componentType === "LAMP") {
    items.push({
      id: "lamp-color",
      items: lampColorOptions.map((option) => ({
        checked: (target.lampGlowColor ?? "yellow") === option.value,
        id: `lamp-color-${option.value}`,
        kind: "action" as const,
        label: option.label,
        onSelect: () => actions.setLampGlowColor(selectedIds, option.value),
        swatch: option.swatch
      })),
      kind: "submenu",
      label: "Color"
    });
  }

  items.push(
    { id: "component-separator", kind: "separator" },
    {
      id: "copy",
      kind: "action",
      label: "Copy",
      shortcut: "Ctrl+C",
      onSelect: () => actions.copyComponents(selectedIds)
    },
    {
      id: "duplicate",
      kind: "action",
      label: "Duplicate",
      onSelect: () => actions.duplicateComponent(componentId)
    },
    {
      id: "rename",
      kind: "action",
      label: "Rename",
      onSelect: () => undefined
    },
    {
      danger: true,
      id: "delete",
      kind: "action",
      label: "Delete",
      onSelect: () => actions.deleteComponent(componentId)
    }
  );

  return items;
}

export function buildWireMenu(
  target: ContextMenuTarget,
  actions: ContextMenuActions,
  close: () => void
): MenuItem[] {
  const wire = target.wire;

  if (!wire) {
    return [];
  }

  return [
    {
      id: "wire-delete",
      kind: "action",
      label: "Delete",
      onSelect: () => actions.deleteWire(wire.id)
    },
    {
      id: "wire-simplify",
      kind: "action",
      label: "Simplify",
      onSelect: () => actions.simplifyWire(wire.id)
    },
    { id: "wire-separator", kind: "separator" },
    {
      id: "wire-color",
      kind: "custom",
      render: () => (
        <label className="context-menu__field">
          <span>Color</span>
          <input
            type="color"
            value={wire.color}
            onChange={(event) => {
              actions.setWireColor(wire.id, event.target.value);
              close();
            }}
          />
        </label>
      )
    },
    {
      id: "wire-thickness",
      kind: "custom",
      render: () => (
        <div className="context-menu__field">
          <span>Thickness</span>
          <span className="context-menu__thickness">
            {[2, 3.5, 5, 7].map((value) => (
              <button
                key={value}
                type="button"
                className={wire.thickness === value ? "context-menu__thickness--active" : ""}
                onClick={() => {
                  actions.setWireThickness(wire.id, value);
                  close();
                }}
              >
                {value}
              </button>
            ))}
          </span>
        </div>
      )
    }
  ];
}

export function buildCanvasMenu(
  target: ContextMenuTarget,
  actions: ContextMenuActions,
  availability: { canPaste: boolean; canRedo: boolean; canUndo: boolean }
): MenuItem[] {
  const items: MenuItem[] = [];

  if (availability.canPaste) {
    items.push({
      id: "paste",
      kind: "action",
      label: "Paste",
      onSelect: () => actions.paste(target.anchor)
    });
  }

  if (availability.canUndo) {
    items.push({
      id: "undo",
      kind: "action",
      label: "Undo",
      shortcut: "Ctrl+Z",
      onSelect: () => actions.undo()
    });
  }

  if (availability.canRedo) {
    items.push({
      id: "redo",
      kind: "action",
      label: "Redo",
      shortcut: "Ctrl+Shift+Z",
      onSelect: () => actions.redo()
    });
  }

  return items;
}

function getFocusableItems(items: MenuItem[]): MenuItem[] {
  return items.filter((item) => item.kind === "action" || item.kind === "submenu");
}

function getItemId(item: MenuItem): string {
  return item.id;
}

export interface ContextMenuActionRowProps {
  item: Extract<MenuItem, { kind: "action" }>;
  onPointerEnter?: () => void;
  onSelect: () => void;
}

/**
 * Menu rows always render four grid slots (check, icon, label, shortcut), even
 * when the item has no swatch/shortcut. The grid template depends on it: with
 * only three children the label falls into the 14 px icon column.
 */
export function ContextMenuActionRow({
  item,
  onPointerEnter,
  onSelect
}: ContextMenuActionRowProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`context-menu__item ${item.danger ? "context-menu__item--danger" : ""}`.trim()}
      data-menu-item={item.id}
      onClick={onSelect}
      onPointerEnter={onPointerEnter}
    >
      <span className="context-menu__check">{item.checked ? "✓" : ""}</span>
      <span className="context-menu__icon">
        {item.swatch ? (
          <span className="context-menu__swatch" style={{ background: item.swatch }} />
        ) : null}
      </span>
      <span className="context-menu__label">{item.label}</span>
      <span className="context-menu__shortcut">{item.shortcut ?? ""}</span>
    </button>
  );
}

export interface ContextMenuSubmenuRowProps {
  expanded: boolean;
  item: Extract<MenuItem, { kind: "submenu" }>;
  onFocus?: (element: HTMLButtonElement) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onOpen: (element: HTMLButtonElement) => void;
  onPointerEnter?: (element: HTMLButtonElement) => void;
  onPointerLeave?: () => void;
}

export function ContextMenuSubmenuRow({
  expanded,
  item,
  onFocus,
  onKeyDown,
  onOpen,
  onPointerEnter,
  onPointerLeave
}: ContextMenuSubmenuRowProps) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={expanded}
      className="context-menu__item"
      data-menu-item={item.id}
      onClick={(event) => onOpen(event.currentTarget)}
      onFocus={(event) => onFocus?.(event.currentTarget)}
      onKeyDown={onKeyDown}
      onPointerEnter={(event) => onPointerEnter?.(event.currentTarget)}
      onPointerLeave={onPointerLeave}
    >
      <span className="context-menu__check" />
      <span className="context-menu__icon" />
      <span className="context-menu__label">{item.label}</span>
      <span className="context-menu__shortcut">›</span>
    </button>
  );
}

interface SubmenuPanelProps {
  anchorRect: DOMRect;
  autoFocusToken: number;
  items: MenuItem[];
  onAction: (item: Extract<MenuItem, { kind: "action" }>) => void;
  onCloseRequest: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function SubmenuPanel({
  anchorRect,
  autoFocusToken,
  items,
  onAction,
  onCloseRequest,
  onMouseEnter,
  onMouseLeave
}: SubmenuPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

  useEffect(() => {
    if (autoFocusToken > 0) {
      panelRef.current?.querySelector<HTMLElement>("[data-menu-item]")?.focus();
    }
  }, [autoFocusToken]);

  useLayoutEffect(() => {
    const panel = panelRef.current;

    if (!panel || typeof window === "undefined") {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const side = getSubmenuSide(anchorRect, rect.width, window.innerWidth);
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const left = side === "right"
      ? Math.min(anchorRect.right - 2, maxLeft)
      : Math.max(anchorRect.left - rect.width + 2, 8);
    const maxHeight = Math.max(0, window.innerHeight - 16);
    const top = Math.min(
      Math.max(anchorRect.top, 8),
      Math.max(8, window.innerHeight - Math.min(rect.height, maxHeight) - 8)
    );

    setPosition({ left, maxHeight, top });
  }, [anchorRect]);

  return (
    <div
      ref={panelRef}
      className="context-menu context-menu--submenu"
      role="menu"
      style={{
        left: position?.left ?? -9999,
        maxHeight: position?.maxHeight,
        top: position?.top ?? -9999,
        visibility: position ? "visible" : "hidden"
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const buttons = Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? []
        );
        const currentIndex = buttons.indexOf(document.activeElement as HTMLElement);

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();

          if (buttons.length > 0) {
            const direction = event.key === "ArrowDown" ? 1 : -1;
            const nextIndex = currentIndex < 0
              ? (direction === 1 ? 0 : buttons.length - 1)
              : getNextMenuIndex(currentIndex, buttons.length, direction);

            buttons[nextIndex]?.focus();
          }
        } else if (event.key === "Home") {
          event.preventDefault();
          buttons[0]?.focus();
        } else if (event.key === "End") {
          event.preventDefault();
          buttons[buttons.length - 1]?.focus();
        } else if (event.key === "ArrowLeft" || event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCloseRequest();
        }
      }}
    >
      {items.map((item) => {
        if (item.kind === "separator") {
          return <div key={item.id} className="context-menu__separator" role="separator" />;
        }

        if (item.kind === "custom") {
          return <div key={item.id}>{item.render()}</div>;
        }

        if (item.kind === "submenu") {
          return null;
        }

        return (
          <ContextMenuActionRow
            key={item.id}
            item={item}
            onSelect={() => onAction(item)}
          />
        );
      })}
    </div>
  );
}

export const ContextMenuLayer = forwardRef<ContextMenuHandle, ContextMenuLayerProps>(
  function ContextMenuLayer(
    { actions, getAvailability, lampColorOptions, locked, onClose },
    ref
  ) {
    const [target, setTarget] = useState<ContextMenuTarget | null>(null);
    const [items, setItems] = useState<MenuItem[]>([]);
    const [position, setPosition] = useState<MenuPosition | null>(null);
    const [editingLabel, setEditingLabel] = useState(false);
    const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);
    const [submenuAnchorRect, setSubmenuAnchorRect] = useState<DOMRect | null>(null);
    const [submenuFocusToken, setSubmenuFocusToken] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const targetRef = useRef<ContextMenuTarget | null>(null);
    const actionsRef = useRef(actions);
    const availabilityRef = useRef(getAvailability);
    const lampColorsRef = useRef(lampColorOptions);
    const onCloseRef = useRef(onClose);
    const submenuTimerRef = useRef<number | null>(null);
    const submenuCloseTimerRef = useRef<number | null>(null);

    actionsRef.current = actions;
    availabilityRef.current = getAvailability;
    lampColorsRef.current = lampColorOptions;
    onCloseRef.current = onClose;

    const clearSubmenuTimers = useCallback(() => {
      if (submenuTimerRef.current !== null) {
        window.clearTimeout(submenuTimerRef.current);
        submenuTimerRef.current = null;
      }

      if (submenuCloseTimerRef.current !== null) {
        window.clearTimeout(submenuCloseTimerRef.current);
        submenuCloseTimerRef.current = null;
      }
    }, []);

    const close = useCallback(() => {
      const wasOpen = targetRef.current !== null;
      targetRef.current = null;
      clearSubmenuTimers();

      if (!shouldRestoreMenuFocus(wasOpen)) {
        return;
      }

      setTarget(null);
      setItems([]);
      setPosition(null);
      setEditingLabel(false);
      setActiveSubmenuId(null);
      setSubmenuAnchorRect(null);
      setSubmenuFocusToken(0);
      onCloseRef.current();
    }, [clearSubmenuTimers]);

    const runAction = useCallback((item: Extract<MenuItem, { kind: "action" }>) => {
      if (item.id === "rename") {
        setEditingLabel(true);
        return;
      }

      item.onSelect();
      close();
    }, [close]);

    const open = useCallback((nextTarget: ContextMenuTarget) => {
      if (locked) {
        return;
      }

      const availability = availabilityRef.current();
      const nextItems = nextTarget.kind === "component"
        ? buildComponentMenu(nextTarget, actionsRef.current, lampColorsRef.current)
        : nextTarget.kind === "wire"
          ? buildWireMenu(nextTarget, actionsRef.current, close)
          : buildCanvasMenu(nextTarget, actionsRef.current, availability);

      if (nextItems.length === 0) {
        return;
      }

      clearSubmenuTimers();
      targetRef.current = nextTarget;
      setTarget(nextTarget);
      setItems(nextItems);
      setPosition(null);
      setEditingLabel(false);
      setActiveSubmenuId(null);
      setSubmenuAnchorRect(null);
      setSubmenuFocusToken(0);
    }, [clearSubmenuTimers, locked]);

    useImperativeHandle(ref, () => ({ close, open }), [close, open]);

    useLayoutEffect(() => {
      const menu = menuRef.current;

      if (!target || !menu || typeof window === "undefined") {
        return;
      }

      const rect = menu.getBoundingClientRect();
      setPosition(clampMenuPosition(
        target.anchor,
        { height: rect.height, width: rect.width },
        { height: window.innerHeight, width: window.innerWidth }
      ));
    }, [target, items, editingLabel]);

    useEffect(() => {
      if (!target) {
        return;
      }

      const handlePointerDown = (event: PointerEvent) => {
        const targetElement = event.target;

        if (
          targetElement instanceof Element
          && (targetElement.closest(".context-menu") || targetElement.closest(".context-menu--submenu"))
        ) {
          return;
        }

        close();
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      };
      const handleClose = () => close();
      const handleWheelOrScroll = (event: Event) => {
        const targetElement = event.target;

        if (targetElement instanceof Element && targetElement.closest(".context-menu")) {
          return;
        }

        close();
      };

      window.addEventListener("pointerdown", handlePointerDown, true);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("wheel", handleWheelOrScroll, { passive: true });
      window.addEventListener("scroll", handleWheelOrScroll, true);
      window.addEventListener("resize", handleClose);
      window.addEventListener("blur", handleClose);

      return () => {
        window.removeEventListener("pointerdown", handlePointerDown, true);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("wheel", handleWheelOrScroll);
        window.removeEventListener("scroll", handleWheelOrScroll, true);
        window.removeEventListener("resize", handleClose);
        window.removeEventListener("blur", handleClose);
      };
    }, [close, target]);

    useEffect(() => {
      if (!target || !position || editingLabel) {
        return;
      }

      const first = menuRef.current?.querySelector<HTMLElement>("[data-menu-item]:not([disabled])");
      first?.focus();
    }, [editingLabel, position, target]);

    useEffect(() => {
      if (locked && target) {
        close();
      }
    }, [close, locked, target]);

    useEffect(() => () => clearSubmenuTimers(), [clearSubmenuTimers]);

    if (!target || typeof document === "undefined") {
      return null;
    }

    const focusableItems = getFocusableItems(items);
    const activeSubmenu = items.find(
      (item): item is Extract<MenuItem, { kind: "submenu" }> =>
        item.kind === "submenu" && item.id === activeSubmenuId
    );

    const openSubmenu = (
      itemId: string,
      element: HTMLElement,
      mode: "hover" | "keyboard" = "hover"
    ) => {
      clearSubmenuTimers();

      const activate = () => {
        setActiveSubmenuId(itemId);
        setSubmenuAnchorRect(element.getBoundingClientRect());

        if (mode === "keyboard") {
          setSubmenuFocusToken((token) => token + 1);
        }
      };

      if (mode === "keyboard") {
        activate();
        return;
      }

      submenuTimerRef.current = window.setTimeout(() => {
        submenuTimerRef.current = null;
        activate();
      }, 120);
    };

    const scheduleCloseSubmenu = () => {
      if (submenuCloseTimerRef.current !== null) {
        window.clearTimeout(submenuCloseTimerRef.current);
      }

      submenuCloseTimerRef.current = window.setTimeout(() => {
        submenuCloseTimerRef.current = null;
        setActiveSubmenuId(null);
        setSubmenuAnchorRect(null);
        setSubmenuFocusToken(0);
      }, 200);
    };

    const closeSubmenuAndFocusParent = () => {
      const parentId = activeSubmenuId;

      setActiveSubmenuId(null);
      setSubmenuAnchorRect(null);
      setSubmenuFocusToken(0);

      if (parentId) {
        menuRef.current
          ?.querySelector<HTMLElement>(`[data-menu-item="${parentId}"]`)
          ?.focus();
      }
    };

    const cancelCloseSubmenu = () => {
      if (submenuCloseTimerRef.current !== null) {
        window.clearTimeout(submenuCloseTimerRef.current);
        submenuCloseTimerRef.current = null;
      }
    };

    const moveFocus = (direction: 1 | -1) => {
      const current = document.activeElement instanceof HTMLElement
        ? document.activeElement.closest<HTMLElement>("[data-menu-item]")
        : null;
      const currentIndex = current
        ? focusableItems.findIndex((item) => getItemId(item) === current.dataset.menuItem)
        : -1;
      const nextIndex = currentIndex < 0
        ? (direction === 1 ? 0 : focusableItems.length - 1)
        : getNextMenuIndex(currentIndex, focusableItems.length, direction);
      const nextItem = focusableItems[nextIndex];

      if (nextItem) {
        menuRef.current
          ?.querySelector<HTMLElement>(`[data-menu-item="${nextItem.id}"]`)
          ?.focus();
      }
    };

    return createPortal(
      <>
        <div
          ref={menuRef}
          className="context-menu"
          role="menu"
          style={{
            left: position?.left ?? -9999,
            maxHeight: position?.maxHeight,
            maxWidth: position?.maxWidth,
            top: position?.top ?? -9999,
            visibility: position ? "visible" : "hidden"
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (editingLabel) {
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveFocus(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              const first = focusableItems[0];

              if (first) {
                menuRef.current
                  ?.querySelector<HTMLElement>(`[data-menu-item="${first.id}"]`)
                  ?.focus();
              }
            } else if (event.key === "End") {
              event.preventDefault();
              const last = focusableItems[focusableItems.length - 1];
              last && menuRef.current
                ?.querySelector<HTMLElement>(`[data-menu-item="${last.id}"]`)
                ?.focus();
            } else if (event.key === "ArrowRight") {
              const focused = document.activeElement instanceof HTMLElement
                ? document.activeElement.closest<HTMLElement>("[data-menu-item]")
                : null;
              const item = items.find((candidate) => candidate.id === focused?.dataset.menuItem);

              if (item?.kind === "submenu" && focused) {
                event.preventDefault();
                openSubmenu(item.id, focused, "keyboard");
              }
            } else if (event.key === "ArrowLeft") {
              if (activeSubmenuId) {
                event.preventDefault();
                setActiveSubmenuId(null);
                setSubmenuAnchorRect(null);
              }
            }
          }}
        >
          {editingLabel ? (
            <input
              className="context-menu__input"
              defaultValue={target.componentLabel ?? ""}
              autoFocus
              onBlur={(event) => {
                const value = event.currentTarget.value;
                if (target.componentId) {
                  actionsRef.current.renameComponent(target.componentId, value);
                }
                close();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const value = event.currentTarget.value;
                  if (target.componentId) {
                    actionsRef.current.renameComponent(target.componentId, value);
                  }
                  close();
                }
              }}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            items.map((item) => {
              if (item.kind === "separator") {
                return <div key={item.id} className="context-menu__separator" role="separator" />;
              }

              if (item.kind === "custom") {
                return <div key={item.id}>{item.render()}</div>;
              }

              if (item.kind === "submenu") {
                return (
                  <ContextMenuSubmenuRow
                    key={item.id}
                    expanded={activeSubmenuId === item.id}
                    item={item}
                    onFocus={() => {
                      if (activeSubmenuId !== item.id) {
                        setActiveSubmenuId(null);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        openSubmenu(item.id, event.currentTarget, "keyboard");
                      }
                    }}
                    onOpen={(element) => openSubmenu(
                      item.id,
                      element,
                      element === document.activeElement ? "keyboard" : "hover"
                    )}
                    onPointerEnter={(element) => openSubmenu(item.id, element)}
                    onPointerLeave={scheduleCloseSubmenu}
                  />
                );
              }

              return (
                <ContextMenuActionRow
                  key={item.id}
                  item={item}
                  onSelect={() => runAction(item)}
                  onPointerEnter={() => {
                    if (activeSubmenuId) {
                      scheduleCloseSubmenu();
                    }
                  }}
                />
              );
            })
          )}
        </div>
        {activeSubmenu && submenuAnchorRect ? (
          <SubmenuPanel
            anchorRect={submenuAnchorRect}
            autoFocusToken={submenuFocusToken}
            items={activeSubmenu.items}
            onAction={runAction}
            onCloseRequest={closeSubmenuAndFocusParent}
            onMouseEnter={cancelCloseSubmenu}
            onMouseLeave={scheduleCloseSubmenu}
          />
        ) : null}
      </>,
      document.body
    );
  }
);
