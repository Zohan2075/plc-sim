---
type: planning
entity: implementation-plan
plan: "off-delay-level-switch"
phase: 2
status: ready
created: "2026-11-05"
updated: "2026-11-05"
---

# Phase 2: Off-delay timing

## Semantics

- `NOTO`: rest open; driver true -> closed immediately; driver false -> stays closed for `delayMs`, then opens.
- `NCTC`: rest closed; driver true -> open immediately; driver false -> stays open for `delayMs`, then closes.
- Re-energizing during the delay cancels the timer and keeps the contact actuated.
- `delayMs=0` behaves like a plain contact.
- At simulation start every off-delay is at rest with no running timer; stop/reset clears timers; loading a saved diagram starts at rest.
- On-delay `NOTC`/`NCTO` behavior must not change.

## Engine

`plc-engine/src/programRunner.ts`:

- Include `NOTO`/`NCTC` in `isTimedContactInstruction`.
- Add them to the evaluate and trace cases.
- Add an off-delay branch in `advanceTimedContact`:
  - input true -> delete timer, return actuated contact.
  - input false with no state -> rest contact.
  - input false with state -> accumulate `elapsedMs`; return actuated until `delayMs`, then delete and return rest.
- Keep the existing on-delay branch byte-identical in behavior.
- Trace fields (`delayMs`, `timerDone`, `timerElapsedMs`, `readValue`) remain populated.

## UI preview

`ui/src/DiagramBuilder.tsx`:

- Extend `isTimedContactType` and `previewTimedContactState` with off-delay semantics mirroring the engine.
- `collectTimedContactRuntimeStates` must retain off-delay state while the driver is false and the timer is running; on-delay path unchanged.
- `getTimedContactTimerDisplay` shows the countdown during the off-delay.
- `isContactClosed` and `getConductiveTerminalPairs` use the new preview.
- `isContactActuated` maps NOTO/NCTC correctly.

## Tests

- Engine fake-clock table for NOTO/NCTC at `0`, `500`, `3000` ms:
  1. driver on -> immediate change;
  2. driver off -> unchanged until delay, then rest;
  3. driver back on at 50% -> stays actuated, timer cancelled;
  4. next off restarts the delay;
  5. stop/start resets;
  6. saved load starts at rest.
- UI timer-reset spec mirrors the engine table.
- Side-by-side on-delay/off-delay timeline test on the same driver.

## Acceptance

- All off-delay timelines match the table.
- Existing on-delay tests remain green and unchanged.
- Stop/start and load never retain a running timer.
