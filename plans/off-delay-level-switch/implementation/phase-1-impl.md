---
type: planning
entity: implementation-plan
plan: "off-delay-level-switch"
phase: 1
status: ready
created: "2026-11-05"
updated: "2026-11-05"
---

# Phase 1: Art, registration and level switch

## Art generation

Add `scripts/generate-off-delay-level-art.mjs`. It reads the two reference SVGs, extracts every `<path>` in original order, and writes:

- `ui/src/diagram/offDelayArt.generated.ts`
- `ui/src/diagram/levelSwitchArt.generated.ts`

Generated shape:

```ts
export interface GeneratedSymbolElement { d: string; fillRule?: "evenodd" | "nonzero" }
export const OFF_DELAY_ART = {
  NCTC: { transform: "translate(...) scale(...)", elements: [...] },
  NOTO: { transform: "translate(...) scale(...)", elements: [...] }
} as const;
```

- `NCTC` = off-delay path 0.
- `NOTO` = off-delay paths 1+2.
- `LEVEL_SWITCH_NO` = level paths 0+1.
- `LEVEL_SWITCH_NC` = level paths 2-6.
- No path reorder, split, merge or redraw.
- Print per-symbol source count vs generated count and SHA-256 per `d` string.

## Transforms

Compute wrapper transforms from measured ring centers to the shared anchors:

- Off-delay target symbol anchors: `(25.6,30)` and `(102.4,30)` (component local `(32,48.5)/(128,48.5)`).
- Off-delay scale = `76.8 / ringSpan`, translation from left ring center.
- Level target symbol anchors: same `(25.6,30)` and `(102.4,30)`.
- Level scale = `76.8 / topRingSpan`, translation from top-left ring center.

Generated numbers must be printed and checked; no per-rotation values.

## Registration

- `ladder-types/src/index.ts`: add `NOTO` and `NCTC` to `TimedContactInstructionType`.
- `ui/src/DiagramBuilder.tsx`:
  - `BuilderComponentType` automatically includes the new ladder types.
  - Add `LEVEL_SWITCH_NO`/`LEVEL_SWITCH_NC` to the union.
  - Palette: off-delays next to `NOTC`/`NCTO`; level switches next to limit switches.
  - `componentNeedsTag`, `isTimedContactType`, `isContactType`, `isPassThroughType`, `getSymbolCategory`, `getDefaultComponentLabel`, `getComponentName`, `getDefaultEntryTerminalId`, `getDefaultExitTerminalId`.
  - `createCanvasComponent`: delayMs for off-delays; `isClosed` default for level NC.
  - `getTerminalDefinitions`: new types at `(32,48.5)/(128,48.5)`.
  - `renderSymbolGraphic`: new cases using generated art; white under-discs at ring centers so wires end at the ring rim without router changes.
  - `getConductiveTerminalPairs`: off-delays via timed preview; level switches via maintained switch state.
  - `getTimedContactTimerDisplay`, `isContactActuated`, context menu/commands and delay editor reuse existing timed-contact paths.
  - `HITBOXES` and `LABEL_ANCHORS`: art-derived shapes for each new type; no whole-box rectangles.
- `ui/src/diagram/operability.ts`: off-delays `none`; level switches `toggle`.
- `ui/src/diagram/snapshot.ts`: whitelist all four types; persist `delayMs` for off-delays.
- `ui/src/diagram/contextMenu.tsx`: existing rotate/rename/duplicate/delete, delay editor for off-delays, operate items for level switches via the existing per-type rules.

## Level switch behavior

- Use the same `isMaintainedSwitchType` / `isMaintainedSwitchClosed` / `toggleComponentOperateState` / conduction path as `LIMIT_SWITCH_NO`/`NC`.
- `LEVEL_SWITCH_NO`: default `isClosed=false`, conducts when closed.
- `LEVEL_SWITCH_NC`: default `isClosed=true`, conducts when closed.
- Operable by click stopped or running; same maintained toggle as limit switch.
- Visual state: use `LEVEL_SWITCH_NO` art when open, `LEVEL_SWITCH_NC` art when closed; never limit-switch art.

## Tests

- `ui/src/diagram/offDelayLevelArt.spec.ts`: per-element hashes/counts; no shared hashes with limit switch.
- `ui/src/diagram/hitboxes.spec.ts`: new types body/terminal/old-corner/outside at rotations 0..3; label gap.
- `ui/src/diagram/rotation.spec.ts`: new types round-trip rotations and anchors.
- `ui/src/diagram/operate.spec.ts`: level NO/NC conduction and toggle.
- `ui/src/diagram/snapshot.spec.ts`: new types + delayMs persist.

## Acceptance

- Art copied exactly; no limit-switch glyph reuse.
- Level behavior identical to limit switch in stopped/running tables.
- New types in palette, snapshot, hitboxes/labels, context menu.
- Existing glyphs/anchors/router unchanged.
