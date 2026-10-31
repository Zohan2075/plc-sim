# Docs

This folder contains internal project notes and instructions.

Design intent:

- Keep `plc-engine/` deterministic and unit-testable.
- Keep `ladder-types/` as pure domain types (no runtime logic).
- Keep `ui/` as a visualization and control surface with no simulation logic.

## Docs index

- [modules/ui.md](modules/ui.md), [modules/plc-engine.md](modules/plc-engine.md),
  [modules/ladder-types.md](modules/ladder-types.md), [modules/server.md](modules/server.md) —
  module inventories and key symbols.
- [symbol-catalog.md](symbol-catalog.md) — per-type ANSI/NEMA reference (glyphs, palette, compiler
  bindings, panel controls, engine instructions).
- [vector-symbol-pipeline.md](vector-symbol-pipeline.md) — converting a user-supplied SVG into an
  in-app symbol (complete paths, `fill-rule="evenodd"`, lattice mapping, stroke normalization).
- [rules-contract.md](rules-contract.md) — engine rules contract.
- [DEPLOYMENT.md](DEPLOYMENT.md) — build, deploy and E2E notes.
- [analysis-ladder-rendering-and-logic.md](analysis-ladder-rendering-and-logic.md) — superseded
  analysis of ladder rendering/logic (historical record).
