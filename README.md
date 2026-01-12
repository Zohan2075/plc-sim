# plc_sim

A web-based ANSI-style ladder logic simulator.

This repository is intentionally foundation-first: the simulation engine is the primary deliverable. The UI exists only to visualize and interact with the engine.

## Philosophy (ANSI Ladder, not IEC)

This project models *rung-based power flow* and *PLC scan-cycle semantics*.

Key ideas:

- A ladder program is evaluated rung-by-rung.
- Within a rung, logic is evaluated left-to-right as a "power" (boolean) flows through instructions.
- Outputs are **not** updated immediately while the rungs are being evaluated.
- Output writes are deferred and committed at the **end of the scan**.

Non-goals:

- IEC 61131-3 execution model (function blocks, block evaluation order)
- Vendor-specific instructions and quirks
- Real PLC hardware communication
- Cloud backend / multiplayer / persistence services

## Scan Cycle Model

Each scan follows:

1. **Read**: capture the current input image (snapshot)
2. **Think**: evaluate all rungs against the snapshot and existing internal/output state
3. **Update**: commit all pending writes to tags at end-of-scan

Important rule: *writes during Think must not affect later logic in the same scan*.

This is enforced by:

- No mutation during rung evaluation
- All writes go to a pending write buffer
- Buffer is applied only during Update

## Packages (Monorepo)

This is a pnpm workspace:

- `ladder-types/` – shared domain types only (Program, Rung, Instruction)
- `plc-engine/` – deterministic ladder execution engine (no UI/DOM dependencies)
- `ui/` – Vite + React UI that consumes the engine

The engine is designed to be unit-testable without any UI.

## Domain Model (Initial)

Instructions currently planned/implemented:

- `XIC` (Examine If Closed): true when tag is true
- `XIO` (Examine If Open): true when tag is false
- `OTE` (Output Energize): write tag at end-of-scan
- `OTL` (Output Latch): latch tag true (persists across scans)
- `OTU` (Output Unlatch): unlatch tag false

Programs are represented as rungs with linear instruction lists (first milestone). This will later grow toward branches/parallel logic, timers, counters, and other instructions.

## Development

### Requirements

- Node.js 20+
- pnpm

### Install

```bash
pnpm install
```

### Run UI

```bash
pnpm dev
```

### Run tests

```bash
pnpm test
```

## Extensibility Intent

The engine is structured around explicit state transitions and predictable evaluation so it can evolve toward:

- timers/counters
- latches and one-shots
- subroutines / program organization
- richer ladder structures (branches)

See `docs/` for notes and future design decisions.
