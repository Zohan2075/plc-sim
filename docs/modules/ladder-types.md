---
type: documentation
entity: module
module: "ladder-types"
version: 1.0
---

# Module: ladder-types

> Part of [jPLC Sim](../README.md)

## Overview

`ladder-types/` (package `@plc-sim/ladder-types`) is the shared domain vocabulary: pure TypeScript
types and one constant. It has **no runtime logic** (NF2) — no evaluation, no state, no I/O.

### Responsibility

- **Is**: instruction/rung/program type definitions consumed by `plc-engine`, `ui` and the parsers.
- **Is not**: scanning, rendering, validation beyond what types enforce.

### Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| — | — | zero runtime dependencies |

## Structure

| Path | Type | Purpose |
|------|------|---------|
| `ladder-types/src/index.ts` | file | The whole module (44 lines) |

## Key Symbols

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `InstructionType` | type | `index.ts:4` | Union: `XIC`, `XIO`, `NOTC`, `NCTO`, `TON`, `TOF`, `ESTOP`, `OLR`, `OTE`, `OTL`, `OTU` |
| `TimedContactInstructionType` | type | `index.ts:1` | `"NOTC" \| "NCTO"` |
| `TimerInstructionType` | type | `index.ts:2` | `"TON" \| "TOF"` |
| `SafetyInstructionType` | type | `index.ts:3` | `"ESTOP" \| "OLR"` (added in phase 1/3) |
| `SYSTEM_RESET_TAG` | const | `index.ts:15` | `"SYS:RESET"` — reserved rising-edge reset input (D12) |
| `ImmediateInstruction` | interface | `index.ts:23` | Every type except timed contacts/timers; carries only `id` + `tag` |
| `TimedContactInstruction` | interface | `index.ts:28` | NOTC/NCTO **and** TON/TOF; carries `delayMs` (preset in ms, D4) |
| `InstructionBase` | type | `index.ts:33` | `ImmediateInstruction \| TimedContactInstruction` |
| `Rung`, `Program` | interface | `index.ts:35,40` | `{ id, instructions[] }` and `{ rungs[] }` |
| `TagName` | type | `index.ts:44` | `string` alias |

## Data Flow

Produced by `ui/src/compiler/compileDiagram.ts`, consumed by `plc-engine/src/programRunner.ts` and by
the ui parsers (`parseProgram` in `ui/src/projectData.ts:126`).

## Configuration

None.

## Inventory Notes

- **Coverage**: full (single file).
- **Notes**: verified 2026-10-30; the package ships no tests of its own (`pnpm test` → `echo 'no tests'`), which is expected for a types-only module.
