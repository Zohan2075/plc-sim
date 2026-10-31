---
type: documentation
entity: feature
version: 1.0
---

# Rules contract

> The behavioral contract of the simulator: what the wiring means once compiled, and what the
> engine guarantees. Decision IDs refer to the plan
> [hoja-plano-logica-y-ui](../plans/hoja-plano-logica-y-ui/plan.md) Decision Log. Index:
> [docs/README.md](README.md); symbols: [symbol-catalog.md](symbol-catalog.md); modules:
> [modules/ui.md](modules/ui.md), [modules/plc-engine.md](modules/plc-engine.md).

## 1. Wiring → program (D1)

`compileDiagram(components, wires)` (`ui/src/compiler/compileDiagram.ts:74`) is pure: it turns the
drawn circuit into a `Program` — **one rung per simple source→coil path pair**, contacts in path
order, return-side contacts moved before the coil (`compileDiagram.ts:70-72`). Nothing else decides
tag values: the engine executes the program; the UI view only reads engine tags
(`ui/src/solver/electricalView.ts:7`).

- Sources (`POWER_SOURCE`, `DC_SOURCE`) define rung origins; loads (`OTE/OTL/OTU`, `LAMP`,
  `MOTOR*`) define rung targets; lamps and motors compile as `OTE` on their device tag.
- Input devices compile as contacts on their device tag (`deviceMapping.ts:19`), and their contact
  state is fed to the engine input image via `deviceInputs` (`compileDiagram.ts:237`) — so an
  unconnected drawing still behaves sanely and the engine sees exactly what is drawn.
- Guards: at most `MAX_PATH_COMBINATIONS = 256` path combinations per coil; the raw path search caps
  at 4096. Exceeding either **skips the coil and reports a diagnostic**
  (`too-many-paths` / `search-truncated`, `compileDiagram.ts:25-30`) — never silent.

**Evidence**: `ui/src/compiler/compileDiagram.spec.ts` (13 tests incl. both diagnostics),
`compileDiagram.phase3.spec.ts` (6), `deviceMapping.phase3.spec.ts` (6); parity goldens F01, F02,
F09 (return contact), F10 (T-junction).

## 2. Parallel branches = OR (D9)

Several rungs writing the same coil are combined with **OR** — there is no last-writer-wins. Each
evaluation records a `CoilDrive { latch, or, unlatch }` per tag (`programRunner.ts:17-22`) and the
value resolves once at the end of the scan. Rung order does not change the result.

**Evidence**: `plc-engine/test/parallel-or.spec.ts` (2); parity golden **F03** (parallel to coil),
**F04** (seal-in), **F06** (OTL + OTE same tag).

## 3. Output deferral (end-of-scan commit)

Instructions only *record* writes during evaluation; `memory.commitWrites(pendingWrites)` happens
after all rungs (`programRunner.ts:112,143`). A rung that reads a coil written by an earlier rung
therefore sees the **previous scan's** value.

**Evidence**: `plc-engine/test/engine.spec.ts` (OTE deferral case), parity golden **F12** and the
round-trip suite over `data/program-data/output-deferral-demo.program.json`
(`parity.spec.ts:124`).

## 4. OTE / OTL / OTU priority (D9)

Per tag, in this order (`resolveCoilWrites`, `programRunner.ts:151-165`):

1. **OTU** energized → unlatch: value `false` (wins over everything).
2. Else **OTL** energized → latch: value `true`.
3. Else → `latched || or` (the OR of OTE/TON/TOF contributions).

Latch state lives in `latchByTag`, independent of rung order.

**Evidence**: `plc-engine/test/coil-priority.spec.ts` (3); parity goldens **F06**, **F07**.

## 5. E-stop (D10)

- The scan enters **forced mode** if any `ESTOP` contact reads open; an **unset** ESTOP tag counts
  as healthy (D13, `tagMemory.ts:46`). In forced mode every rung is traced unpowered and nothing is
  read or written; at the end **all coils and latches go false** (`programRunner.ts:123-141`).
- Releasing the E-stop does **not** restart anything: there is no auto-restart — the sealing logic
  must be re-established (typically by pressing start again).

**Evidence**: `plc-engine/test/safety.spec.ts` (10), parity motors **M01**, **M02**; E2E
`ui/e2e/02-estop.spec.ts`.

## 6. Overload relay (R7, D12/D13)

- `OLR` reads its device contact with **unset = healthy**; when it reads unhealthy the trip latches
  (`olrTrippedByTag`, `programRunner.ts:268-279`) and the contact passes power only while
  **not tripped** — the trip persists while the contact is healthy again.
- The trip clears only on a **rising edge of `SYS:RESET`** (or `reset()`) **while the device reads
  healthy** (`programRunner.ts:175-179`); touching the rearm contact alone does not restart.
- `TraceStep.tripped` (`types.ts:7`) exposes the latched trip to the UI trace.

**Evidence**: `plc-engine/test/safety.spec.ts`, `olr-trace.spec.ts` (2), UI
`src/runtime/olrTripAndRearm.spec.ts` (2); parity motor **M03**; E2E `ui/e2e/03-overload.spec.ts`.

## 7. Reset (D2, D12)

- Reserved input tag **`SYS:RESET`** (`ladder-types/src/index.ts:15`): a **rising edge** clears
  latches, timers and healthy overload trips; holding it does not repeat the clear.
- Any device wired to `SYS:RESET` (diagram `RESET_BUTTON`, panel fallback pulse) acts as reset; the
  panel fallback gets a one-scan pulse hold (`EngineSession.setInput`, `engineSession.ts:37-46`, D18/OD5-4).
- `PlcEngine.reset()` is the imperative equivalent and additionally drops non-latched coils.

**Evidence**: `plc-engine/test/persistence.spec.ts` (5), `safety.spec.ts`; parity motor **M06**;
E2E `ui/e2e/01-run-stop.spec.ts`.

## 8. Stop (D11)

`PlcEngine.stop()` de-energizes non-latched coils and clears timers; **latches and overload trips
are kept** (`programRunner.ts:98-102`). Scanning again resumes without reset. Editing the diagram
keeps tag memory by tag name (D2, `EngineSession.applyProgram` does not clear memory).

**Evidence**: `plc-engine/test/persistence.spec.ts`, `engine.spec.ts`; E2E
`ui/e2e/01-run-stop.spec.ts` (lamp stays on after Stop), `ui/e2e/04-edit-while-running.spec.ts`.

## 9. Timers (D4, D13)

- Preset in **milliseconds** (`delayMs`, `TimedContactInstruction`), no hidden 250 ms delay
  (`TIMED_CONTACT_ACTUATION_DELAY_MS` removed).
- **TON**: accumulates only while the rung has power, resets to 0 when unpowered, `Q = done`.
- **TOF**: `Q` true while powered; after power drops `Q` holds for `delayMs` then goes false; a
  never-energized TOF stays false.
- `powerAfter = Q` for TON/TOF (D13), and a `Q` that is true also drives the timer's own tag as an
  OR contribution (`programRunner.ts:301-318`).
- **NOTC/NCTO** timed contacts accumulate only while powered *and* their input is true
  (`advanceTimedContact`, `programRunner.ts:362`); their `contactClosed` is reported in the trace.

**Evidence**: `plc-engine/test/timers.spec.ts` (5), parity motors **M04**, **M05**; goldens
**F05** (unpowered branch does not time); UI `diagram/timing.ts` clamps the preset.

## Evidence map

| Layer | Where | Count (2026-10-30) |
|-------|-------|--------------------|
| Parity diagram goldens | `ui/src/parity/fixtures/F01..F12.json` + `goldens/F01..F12.json` | 12 fixtures |
| Parity motor fixtures | `ui/src/parity/motor-fixtures/M01..M06*.json` (reference: engine specs) | 6 fixtures |
| Parity round-trip | `parity.spec.ts:124` over `data/program-data/*.program.json` (incl. `motor-guard-demo`) | exact scan-by-scan equality |
| Engine unit | `plc-engine/test/*.spec.ts` | 34 tests / 7 files |
| Compiler, view, session, panel, sheet | `ui/src/**/**.spec.ts(x)` | 501 tests / 20 files |
| E2E (Playwright, chromium) | `ui/e2e/01..06*.spec.ts` | 7 tests |

E2E coverage of the contract: `01-run-stop` (Stop keeps latches + `SYS:RESET` clears), `02-estop`
(no auto-restart), `03-overload` (trip latch, rearm only via reset), `04-edit-while-running`
(state by tag name), `05-panel-lamp` (momentary + one-scan pulse), `06-snapshot-load` (v1 migrate +
unknown version rejected).

Run: `pnpm test` (unit + parity) and `pnpm test:e2e` (browser) — see
[DEPLOYMENT.md](DEPLOYMENT.md).
