---
type: planning
entity: phase
plan: "hoja-plano-logica-y-ui"
phase: 2
status: done  # pending | in_progress | completed | skipped | done
created: "2026-10-29"
updated: "2026-10-29"
---

# Phase 2: Compilar el cableado a programa del motor y retirar el solver como fuente de tags

> Part of [hoja-plano-logica-y-ui](../plan.md)

> **code reverted by D24 (2026-10-30); kept as historical record**

## Objective

Aplicar **D1**: el motor PLC (`plc-engine`) es la **única fuente de valores de tags**, a largo plazo. El cableado del diagrama se **compila a programa del motor** (renglones e instrucciones), y el motor decide. El solver físico de la UI (`computeElectricalState`, `resolvePhysicalInstructionTagValues` en `DiagramBuilder.tsx`) **deja de ser fuente de tags**; puede sobrevivir solo como ayuda visual de flujo de energía que **lee** tags del motor, sin lógica propia.

Antes de retirar el solver como fuente de tags se demuestra paridad: para cada fixture, los valores de tag del solver viejo deben coincidir con los del programa compilado en el motor. Se define un punto de rollback.

## Scope

### Includes

- **Compilador cableado → programa**: módulo que traduce los componentes y cables del diagrama a renglones/instrucciones del motor (usando los tipos de fase 1). Ubicación propuesta: módulo nuevo en `ui/src/` (p. ej. `ui/src/compiler/`) o en `ladder-types` si es puro; decidir y registrar en `implementation/phase-2-impl.md`.
- **Fixtures de circuito compartidos** (JSON): circuito de entrada, entradas por scan y valores esperados de tags por scan. Mínimo: contacto simple, serie, paralelo a bobina, seal-in con paro, E-stop, sobrecarga, TON/TOF, OTE/OTL/OTU sobre mismo tag, reset.
- **Paridad previa a la retirada**: ejecutar cada fixture por (a) el solver viejo de `DiagramBuilder.tsx` y (b) el programa compilado en el motor, comparar tags por scan. Las diferencias se documentan como bugs del solver viejo (el motor de fase 1 es la referencia) o se corrigen en el compilador.
- **Punto de rollback**: tag git/commit de referencia antes del corte, y el solver viejo conservado detrás de una bandera o en un commit aparte hasta cerrar la fase.
- **Retirada como fuente de tags**: eliminar de `DiagramBuilder.tsx` la escritura/decisión de tags (`resolvePhysicalInstructionTagValues`, L822-913) y reemplazarla por la lectura de tags del motor.
- **Solver visual residual**: `computeElectricalState` (L3668-3840) se reduce a vista: calcula energía/cortocircuito a partir de **tags leídos del motor** (y del cableado), sin decidir tags. Cortocircuito (`fault`) sigue visible.
- **Estados visuales** de pulsador/lámpara/contacto derivados de tags del motor (una sola fuente de verdad).
- Partir la lógica extraída de `DiagramBuilder.tsx` a módulos (p. ej. `ui/src/solver/`, `ui/src/compiler/`) si el tamaño lo exige (R-E).
- **Actualizar `docs/README.md`** (deliverable de esta fase): la nota de intención pasa de "ui sin lógica de simulación" a: motor único de lógica de tags; UI con compilador cableado→programa y solver de vista que lee tags del motor.

### Excludes (deferred to later phases)

- Símbolos nuevos (fase 3).
- Cambios de formato de snapshot (fase 4).
- Panel físico y cableado de `setInput` en la UI (fase 5).
- Borrado de componentes huérfanos (no aplica: D3 los reutiliza).

## Prerequisites

- [ ] Fase 1 completada (OR, E-stop, sobrecarga, TON/TOF en ms, OTE/OTL/OTU, Stop/Reset fijados en el motor).
- [ ] Decisión de ubicación del compilador y del solver de vista registrada en `implementation/phase-2-impl.md`.
- [x] vitest en `ui` aprobado (D5), para tests de paridad y compilador en la UI.

## Deliverables

- [ ] Compilador cableado → programa del motor con tests unitarios.
- [ ] Set de fixtures de circuitos con valores esperados por scan.
- [ ] Informe de paridad previa a la retirada: tabla fixture × scan con resultado (solver viejo vs. motor).
- [ ] Punto de rollback documentado (commit/tag de referencia).
- [ ] Solver de UI convertido en solver de vista: solo lee tags del motor; sin lógica de tags propia.
- [ ] `docs/README.md` actualizado con la nueva intención de diseño (Decision D1).
- [ ] Documentación del compilador y del contrato en `docs/` (sección nueva o análisis actualizado).

## Acceptance Criteria

- [ ] Antes de retirar el solver: para cada fixture, valores de tag por scan del solver viejo == valores del programa compilado en el motor (igualdad exacta, boolean). Cualquier diferencia está resuelta o documentada como bug del solver viejo.
- [ ] Después de retirar: para cada fixture, los valores de tag por scan los produce únicamente el motor (grep: no hay escritura de tags fuera de `plc-engine` / compilador).
- [ ] `grep resolvePhysicalInstructionTagValues` no apunta a lógica de resolución de tags; el solver residual no contiene lógica de decisión de tags.
- [ ] Un fixture que hoy diverge (paralelo a bobina) pasa a coincidir, con test que lo demuestre.
- [ ] Tests de plc-engine de fase 1 siguen verdes.
- [ ] Cortocircuito (`fault`) sigue detectándose y mostrándose en la UI (test de fixture).
- [ ] `pnpm build` pasa.
- [ ] `docs/README.md` refleja la intención de diseño de D1.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 1 | blocked-by | Requiere la semántica del motor fijada. |
| Phase 3 | blocks (parcial) | Símbolos de fase 3 leen estados visuales (energizado, pulsado, cerrado) de tags del motor. |
| Phase 5 | blocks | El panel lee y escribe tags del motor ya como única fuente. |

## Notes

- **Riesgo R-A (migración, D1)**: el corte puede cambiar el comportamiento visible. Mitigación: paridad previa, rollback, fixtures. Los tests de paridad son bloqueantes para retirar el solver y para fases 3-6.
- El feedback de 1 scan del solver actual (analysis §5) desaparece con la retirada: el diagrama muestra el estado del motor tras el scan. Registrar la decisión en `implementation/phase-2-impl.md`.
- Los estados visuales de pulsador/lámpara en el diagrama se derivan de tags del motor (no hay tercera fuente de verdad).
- Referencias: analysis §5 (solver, `computeElectricalState` L3668-3840; `resolvePhysicalInstructionTagValues` L822-913).

## Result

**Status: done (2026-10-29).** Implementado según [implementation/phase-2-impl.md](../implementation/phase-2-impl.md).

- **Compilador cableado → rungs**: `ui/src/compiler/compileDiagram.ts` y `ui/src/compiler/deviceMapping.ts` (tags de dispositivo por id, `DEVICE_TAG_PREFIX`).
- **Runtime**: `EngineSession` (`ui/src/runtime/engineSession.ts`) reemplaza la recreación de `PlcEngine` (bug 6 corregido).
- **Solver de vista de solo lectura**: `ui/src/solver/electricalView.ts` (energía, flujo, cortocircuito `fault`); no escribe tags.
- **Solver legacy retirado** (WP2-9): `legacyTagSolver.ts`, `TAG_SOURCE` y rama `legacy-solver` eliminados. Goldens conservados como regresión.
- **Paridad**: 12 fixtures de diagrama (F01-F12) + 6 fixtures de motor + round-trip `data/` y `sample-programs/`; goldens en `ui/src/parity/goldens`. Informe: [implementation/phase-2-parity.md](../implementation/phase-2-parity.md) (secciones legacy históricas).
- **Diagnóstico nuevo**: `search-truncated` (límite de combinaciones de caminos).
- **Tipos de UI**: `ui` typecheck 34 → 0 errores.

**Gates**: `plc-engine` 32/32; `ui` tsc 0 errores; `ui` vitest 56/56; `pnpm -r build` OK.

**Pendiente / no verificado**: navegador no verificado (E2E diferido a Phase 6).

**Cambios de comportamiento** (esperados, documentados):
- `runnableRungs` F10: 0 → 1; F11: 0 → 2 (renglones ahora compilados desde el cableado).
- Breakers usan `isClosed ?? true` (sin UI de apertura hasta fase 3/5).
- Sin feedback de 1 scan en el diagrama: la bobina muestra el tag del motor post-scan (OD2-5).
