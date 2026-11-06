import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

export interface CommandPaletteCommand {
  disabled?: boolean;
  icon: ReactNode;
  id: string;
  keywords?: string;
  label: string;
  run: () => void;
  shortcut?: string;
}

export type CommandPaletteKeyAction =
  | { type: "close" }
  | { command: CommandPaletteCommand; type: "run" }
  | { index: number; type: "move" };

export function filterCommands(
  commands: readonly CommandPaletteCommand[],
  query: string
): CommandPaletteCommand[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return [...commands];
  }

  return commands.filter((command) => {
    const haystack = [
      command.label,
      command.keywords ?? "",
      command.shortcut ?? ""
    ].join(" ").toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

export function getNextCommandIndex(
  currentIndex: number,
  commandCount: number,
  direction: 1 | -1
): number {
  if (commandCount <= 0) {
    return -1;
  }

  const base = currentIndex < 0 ? (direction === 1 ? -1 : 0) : currentIndex;

  return (base + direction + commandCount) % commandCount;
}

export function getCommandEdgeIndex(
  commandCount: number,
  edge: "first" | "last"
): number {
  if (commandCount <= 0) {
    return -1;
  }

  return edge === "first" ? 0 : commandCount - 1;
}

export function resolveCommandPaletteKey(
  event: { key: string },
  commands: readonly CommandPaletteCommand[],
  activeIndex: number
): CommandPaletteKeyAction | null {
  if (event.key === "Escape") {
    return { type: "close" };
  }

  if (event.key === "ArrowDown") {
    return { index: getNextCommandIndex(activeIndex, commands.length, 1), type: "move" };
  }

  if (event.key === "ArrowUp") {
    return { index: getNextCommandIndex(activeIndex, commands.length, -1), type: "move" };
  }

  if (event.key === "Home") {
    return { index: getCommandEdgeIndex(commands.length, "first"), type: "move" };
  }

  if (event.key === "End") {
    return { index: getCommandEdgeIndex(commands.length, "last"), type: "move" };
  }

  if (event.key === "Enter") {
    const command = commands[activeIndex];

    return command && !command.disabled ? { command, type: "run" } : null;
  }

  return null;
}

export function CommandPaletteRow(props: {
  active: boolean;
  command: CommandPaletteCommand;
  onPointerMove?: () => void;
  onRun: () => void;
}) {
  const { active, command, onPointerMove, onRun } = props;
  const className = [
    "command-palette__item",
    active ? "command-palette__item--active" : "",
    command.disabled ? "command-palette__item--disabled" : ""
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      role="option"
      id={`command-palette-option-${command.id}`}
      aria-selected={active}
      aria-disabled={command.disabled ? true : undefined}
      className={className}
      data-command-id={command.id}
      data-command-palette-focusable="true"
      disabled={command.disabled}
      onClick={onRun}
      onPointerMove={onPointerMove}
    >
      <span className="command-palette__icon" aria-hidden="true">{command.icon}</span>
      <span className="command-palette__label">{command.label}</span>
      <span className="command-palette__shortcut">{command.shortcut ?? ""}</span>
    </button>
  );
}

export function CommandPalette(props: {
  commands: readonly CommandPaletteCommand[];
  onClose: () => void;
  open: boolean;
}) {
  const { commands, onClose, open } = props;
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const filteredCommands = useMemo(
    () => filterCommands(commands, query),
    [commands, query]
  );
  const activeCommand = filteredCommands[activeIndex] ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery("");
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActiveIndex((currentIndex) => {
      if (filteredCommands.length === 0) {
        return 0;
      }

      return Math.min(Math.max(currentIndex, 0), filteredCommands.length - 1);
    });
  }, [filteredCommands.length]);

  const runCommand = (command: CommandPaletteCommand) => {
    if (command.disabled) {
      return;
    }

    command.run();
    onClose();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "[data-command-palette-focusable='true']:not([disabled])"
        ) ?? []
      );

      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1)
        : (currentIndex + 1) % focusables.length;

      event.preventDefault();
      focusables[nextIndex]?.focus();
      return;
    }

    const action = resolveCommandPaletteKey(event, filteredCommands, activeIndex);

    if (!action) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (action.type === "close") {
      onClose();
      return;
    }

    if (action.type === "move") {
      if (action.index >= 0) {
        setActiveIndex(action.index);
      }

      return;
    }

    runCommand(action.command);
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="command-palette__backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="command-palette-list"
          aria-expanded="true"
          aria-activedescendant={
            activeCommand ? `command-palette-option-${activeCommand.id}` : undefined
          }
          className="command-palette__input"
          data-command-palette-focusable="true"
          placeholder="Search commands…"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
        />
        <div
          id="command-palette-list"
          className="command-palette__list"
          role="listbox"
          aria-label="Commands"
        >
          {filteredCommands.length === 0 ? (
            <p className="command-palette__empty">No commands match “{query}”.</p>
          ) : (
            filteredCommands.map((command, index) => (
              <CommandPaletteRow
                key={command.id}
                active={index === activeIndex}
                command={command}
                onPointerMove={() => setActiveIndex(index)}
                onRun={() => runCommand(command)}
              />
            ))
          )}
        </div>
        <div className="command-palette__footer">Enter runs · Esc closes</div>
      </div>
    </div>,
    document.body
  );
}
