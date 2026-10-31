---
type: documentation
entity: module
module: "plc-engine"
version: 1.0
---

# Module: plc-engine

> Part of [jPLC Sim](../README.md)

## Overview

`plc-engine/` (package `@plc-sim/plc-engine`) is the deterministic PLC runtime: it evaluates a
`Program` scan by scan and is the **only writer of tag values** in the system (D1). No React, no
timers of its own — time enters through `scan(elapsedMs)`.

### Responsibility

- **Is**: scan execution (read-evaluate-commit), latch/unlatch bookkeeping, safety (E-stop forced
  mode, overload trip), timers with power gating, reset/stop semantics, scan traces.
- **Is not**: drawing, wiring/compilation (that is `ui/src/compiler`), tag definitions/parsing.

### Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| `@plc-sim/ladder-types` | module | `Program`, `Rung`, `InstructionBase`, `SYSTEM_RESET_TAG` (types only) |

## Structure

| Path | Type | Purpose |
|------|------|---------|
| `plc-engine/src/index.ts` | file | `PlcEngine` facade implementing `PlcEngineApi` |
| `plc-engine/src/programRunner.ts` | file | Scan contract (a)-(f), per-instruction evaluation, coil resolution, timers |
| `plc-engine/src/tagMemory.ts` | file | `TagMemory`: input image + committed values, device read rule (D13) |
| `plc-engine/src/types.ts` | file | `TraceStep`, `TraceRung`, `ScanTrace`, `PlcEngineApi` |
| `plc-engine/test/*.spec.ts` | dir | 7 specs / 34 tests (see Inventory Notes) |

## Key Symbols

| Symbol | Kind | Location | Purpose |
|--------|------|----------|---------|
| `PlcEngine` | class | `plc-engine/src/index.ts:8` | `loadProgram` (keeps tag memory, matched by tag name), `setInput`, `scan`, `scanWithTrace`, `getTag`, `reset`, `stop` |
| `ProgramRunner` | class | `plc-engine/src/programRunner.ts:41` | Owns program, per-instruction timer state, `latchByTag`, `olrTrippedByTag`, `previousResetInput` |
| `ProgramRunner.load` | method | `programRunner.ts:52` | Indexes coil/latched/ESTOP/OLR tag sets |
| `executeScan` | method | `programRunner.ts:104` | The (a)-(f) cycle below; commits at the end |
| `resolveCoilWrites` | method | `programRunner.ts:151` | Per-tag OR/priority resolution (D9) |
| `applyReset` | method | `programRunner.ts:167` | Clears latches, timers, healthy OLR trips; optionally drops non-latched coils |
| `deenergizeNonLatched` | method | `programRunner.ts:186` | Stop semantics (D11) |
| `evaluateInstructionWithTrace` | method | `programRunner.ts:231` | XIC/XIO/ESTOP/OLR/NOTC/NCTO/TON/TOF/OTE/OTL/OTU with trace step |
| `advanceTimedContact` / `advanceTimer` | method | `programRunner.ts:363,400` | NOTC/NCTO and TON/TOF elapsed-time accumulation (D4) |
| `TagMemory` | class | `plc-engine/src/tagMemory.ts:1` | `setInput`, `snapshotInputs`, `readDuringScan`, `commitWrites`, `writeCommitted` |
| `TagMemory.readDeviceDuringScan` | method | `tagMemory.ts:46` | Unset device tag = healthy (D13); generic XIC/XIO keep `false` default |
| `TraceStep` | interface | `plc-engine/src/types.ts:3` | Per-instruction step: `powerBefore/After`, `readValue`, `pendingWrite`, `contactClosed`, `delayMs`, `timerDone`, `timerElapsedMs`, **`tripped`** (OLR, phase 3 / D14) |
| `SYSTEM_RESET_TAG` | const | `ladder-types/src/index.ts:15` | `"SYS:RESET"`, the reserved reset input (D12) |

## Scan cycle (order is part of the semantics)

Documented verbatim in `programRunner.ts:31-40`:

- **(a)** Read `SYS:RESET`; a rising edge (true after a previous false) sets `resetRising`
  (`programRunner.ts:115-117`, tracked with `previousResetInput`).
- **(b)** On `resetRising`: clear latches, timers and **healthy** overload trips
  (`applyReset`, `programRunner.ts:167-184` — an OLR only rearms when its device reads healthy).
- **(c)** Forced mode if **any** `ESTOP` contact is open; an unset ESTOP tag counts as healthy
  (`programRunner.ts:123`, `tagMemory.ts:46`).
- **(d)** Evaluate rungs in order; in forced mode every rung is traced unpowered and nothing is
  read or written (`programRunner.ts:126-128`, `forcedRungTrace` L194).
- **(e)** Resolve coil writes per tag (**OTU** energized → `false`; else **OTL** energized → latched
  `true`; otherwise **OR** of OTE/TON/TOF contributions). Rung order never changes the result
  (`resolveCoilWrites`, `programRunner.ts:151-165`).
- **(f)** Forced mode: all coils and latches → `false`. Then `memory.commitWrites`
  (`programRunner.ts:131-143`).

### Rules referenced by decision IDs

- **Coil OR (D9)**: parallel rungs feeding the same coil are combined with OR in `CoilDrive.or`
  (`programRunner.ts:17-22`, `driveFor` L222). No last-writer-wins.
- **Priority OTU > OTL > OTE**: `resolveCoilWrites` applies `unlatch` first, then `latch`, and the
  committed value is `!unlatch && (latched || or)` (`programRunner.ts:156-163`).
- **E-stop clears latches (D10)**: in forced mode every latched tag is set false and every coil
  written false (`programRunner.ts:131-138`); releasing the E-stop does not restart anything — the
  rung must be re-evaluated true (no auto-restart, and `previousResetInput` prevents a stale edge).
- **OLR trip latch + `SYS:RESET` edge rearm (D12)**: `OLR` sets `olrTrippedByTag` when the device
  reads unhealthy and passes power only while not tripped (`programRunner.ts:268-279`); the trip is
  cleared only by a reset with a **healthy** device (`programRunner.ts:175-179`), i.e. a rising
  `SYS:RESET` edge (`applyReset` from (a)-(b)) or `reset()`.
- **TON/TOF power-gated, preset in ms (D4/D13)**: `TON` accumulates only while `powerBefore`, resets
  to 0 when unpowered, `Q = done`; `TOF` is `Q=true` while powered and holds `Q` for `delayMs` after
  power drops, never-energized → `Q=false` (`advanceTimer`, `programRunner.ts:395-433`). `powerAfter = Q`
  (D13). `delayMs` is normalized/rounded (L435). The 250 ms `TIMED_CONTACT_ACTUATION_DELAY_MS` is gone.
- **`stop()` / `reset()` (D11, D2)**: `stop()` de-energizes non-latched coils and clears timers but
  **keeps latches and overload trips** (`programRunner.ts:98-102`, `index.ts:28`); `reset()` clears
  latches, timers, healthy OLR trips **and** drops non-latched coils (`applyReset(..., dropNonLatched = true)`,
  `programRunner.ts:93-96`).
- **Output deferral**: OTE/OTL/OTU only record a drive during evaluation; nothing is written until
  the end of the scan (`pendingWrites` + `commitWrites`, `programRunner.ts:112,143`).

## Data Flow

`EngineSession` (ui) → `setInput`/`setDeviceInputs` (input image) → `scanWithTrace(elapsedMs)` →
evaluation → `commitWrites` → `getTag` reads committed values; the returned `ScanTrace` feeds the
UI view, the trace panel and the OLR `tripped` display.

## Configuration

None (no env vars). Determinism: all inputs are explicit (`elapsedMs`, `setInput`).

## Inventory Notes

- **Coverage**: full.
- **Notes**: gates verified 2026-10-30 — vitest 34/34 across `test/{engine,timers,parallel-or,olr-trace,persistence,safety,coil-priority}.spec.ts`; `pnpm -r build` OK.
