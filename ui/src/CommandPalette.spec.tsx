import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CommandPaletteRow,
  filterCommands,
  getCommandEdgeIndex,
  getNextCommandIndex,
  resolveCommandPaletteKey
} from "./CommandPalette";
import type { CommandPaletteCommand } from "./CommandPalette";

function makeCommand(overrides: Partial<CommandPaletteCommand> = {}): CommandPaletteCommand {
  return {
    icon: "⧉",
    id: "edit.undo",
    label: "Undo",
    run: vi.fn(),
    ...overrides
  };
}

const commands: CommandPaletteCommand[] = [
  makeCommand({ keywords: "history back", label: "Undo", shortcut: "Ctrl+Z" }),
  makeCommand({ icon: "↷", id: "edit.redo", keywords: "history forward", label: "Redo", shortcut: "Ctrl+Shift+Z" }),
  makeCommand({ icon: "▶", id: "simulate.run", keywords: "simulation start", label: "Run", shortcut: "F5" })
];

describe("filterCommands", () => {
  it("returns every command for an empty query", () => {
    expect(filterCommands(commands, "   ")).toHaveLength(commands.length);
  });

  it("matches labels, keywords and shortcuts case-insensitively", () => {
    expect(filterCommands(commands, "redo").map((command) => command.id)).toEqual(["edit.redo"]);
    expect(filterCommands(commands, "history").map((command) => command.id))
      .toEqual(["edit.undo", "edit.redo"]);
    expect(filterCommands(commands, "ctrl+z").map((command) => command.id)).toEqual(["edit.undo"]);
    expect(filterCommands(commands, "history forward").map((command) => command.id))
      .toEqual(["edit.redo"]);
  });

  it("returns no matches for an unknown query", () => {
    expect(filterCommands(commands, "no such command")).toEqual([]);
  });
});

describe("command palette keyboard helpers", () => {
  it("wraps arrow navigation in both directions", () => {
    expect(getNextCommandIndex(2, 3, 1)).toBe(0);
    expect(getNextCommandIndex(0, 3, -1)).toBe(2);
    expect(getNextCommandIndex(-1, 3, 1)).toBe(0);
    expect(getNextCommandIndex(-1, 3, -1)).toBe(2);
    expect(getNextCommandIndex(0, 0, 1)).toBe(-1);
  });

  it("resolves Home, End, Escape and Enter", () => {
    expect(getCommandEdgeIndex(3, "first")).toBe(0);
    expect(getCommandEdgeIndex(3, "last")).toBe(2);
    expect(resolveCommandPaletteKey({ key: "Home" }, commands, 2))
      .toEqual({ index: 0, type: "move" });
    expect(resolveCommandPaletteKey({ key: "End" }, commands, 0))
      .toEqual({ index: 2, type: "move" });
    expect(resolveCommandPaletteKey({ key: "Escape" }, commands, 0))
      .toEqual({ type: "close" });
    expect(resolveCommandPaletteKey({ key: "Enter" }, commands, 1))
      .toEqual({ command: commands[1], type: "run" });
  });

  it("does not run a disabled command", () => {
    const disabled = [
      makeCommand({ disabled: true, id: "edit.undo" })
    ];

    expect(resolveCommandPaletteKey({ key: "Enter" }, disabled, 0)).toBeNull();
  });

  it("ignores keys it does not handle", () => {
    expect(resolveCommandPaletteKey({ key: "a" }, commands, 0)).toBeNull();
    expect(resolveCommandPaletteKey({ key: "Enter" }, [], 0)).toBeNull();
  });
});

describe("CommandPaletteRow", () => {
  it("renders icon, label, shortcut and active state", () => {
    const markup = renderToStaticMarkup(createElement(CommandPaletteRow, {
      active: true,
      command: commands[0]!,
      onRun: () => undefined
    }));

    expect(markup).toContain("command-palette__item--active");
    expect(markup).toContain("⧉");
    expect(markup).toContain("Undo");
    expect(markup).toContain("Ctrl+Z");
    expect(markup).toContain('aria-selected="true"');
  });

  it("marks disabled rows as inert", () => {
    const markup = renderToStaticMarkup(createElement(CommandPaletteRow, {
      active: false,
      command: makeCommand({ disabled: true }),
      onRun: () => undefined
    }));

    expect(markup).toContain("command-palette__item--disabled");
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("disabled");
  });
});
