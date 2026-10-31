---
type: planning
entity: phase
plan: "hoja-plano-logica-y-ui"
phase: 1
status: done  # pending | in_progress | completed | skipped
created: "2026-10-29"
updated: "2026-10-29"
---

# Phase 1: Motor PLC: lógica de enclavamiento, paro y reset

> Part of [hoja-plano-logica-y-ui](../plan.md)

> **code reverted by D24 (2026-10-30); kept as historical record**

## Objective

Hacer que `plc-engine` (y `ladder-types`) modele correctamente enclavamiento y paro: OR de ramas en paralelo, pulsadores/interruptores/breakers como entradas reales, paro de emergencia con prioridad, sobrecarga con disparo y rearme, TON/TOF con energización del renglón y **preset en milisegundos sin retardo oculto** (D4), regla de prioridad OTE/OTL/OTU y persistencia de estado con **Stop que conserva, Reset que borra y Reset como entrada de tag** (D2). Engine-only: sin tocar la UI.

Por qué primero: el resto del plan (compilación del cableado, paridad, panel, símbolos) depende de que el motor sea la referencia correcta (D1). Ver analysis §4 bugs 1-7.

## Scope

### Includes

- Tipos nuevos en `ladder-types/src/index.ts` para: entrada de paro de emergencia, sobrecarga (con rearme), temporizadores TON/TOF con preset en ms, entrada de reset, y el contrato de prioridad (si aplica).
- `plc-engine/src/programRunner.ts`: agregación OR de renglones que escriben la misma salida (eliminar last-writer-wins, `pendingWrites` L126); power-gating de timers (`evaluateInstruction` L119-124, L175-180); **eliminar `TIMED_CONTACT_ACTUATION_DELAY_MS` = 250 (L15)** y usar el preset real en ms; E-stop evaluado con prioridad sobre el resto del scan; latch de sobrecarga con entrada de rearme; regla de prioridad OTE/OTL/OTU documentada en código.
- `plc-engine/src/tagMemory.ts`: API para preservar estado entre rebuild por nombre de tag, y para limpiar según D2: `stop` conserva tags latcheados; `reset` limpia salidas latcheadas y enclavamientos.
- `plc-engine/src/index.ts`: `setInput` como camino real de entrada; reset disponible como **entrada de tag** (pulsador de reset del diagrama lo activa, igual que el de panel en fase 5); `loadProgram` que conserva estado compatible por nombre de tag.
- Tests en `plc-engine/test/`: regresión de los 7 casos existentes + nuevos casos (ver todo.md).
- Decisión documentada de la semántica de pulsadores en el motor (entrada momentánea vs. mantenida) y de breakers (entrada de estado).

### Excludes (deferred to later phases)

- Cualquier cambio en `ui/` (incluido el parser de tipos nuevos en `projectData.ts` → fase 3; el pulsador de reset del diagrama y del panel → fases 3/5).
- Compilación del cableado a programa del motor, retirada del solver de UI como fuente de tags y tests de paridad (fase 2).
- Símbolos y paleta (fase 3).
- Snapshot v2 y hoja (fase 4).

## Prerequisites

- [x] Confirmación del usuario del plan completo (plan aprobado 2026-10-29).
- [x] Semántica de TON/TOF y base de tiempo decididas: preset en ms, sin retardo oculto de 250 ms (D4).
- [x] Semántica de Stop/Reset/edición decidida: Stop conserva, Reset borra salidas latcheadas y enclavamientos, edición conserva por nombre de tag, Reset es entrada de tag (D2).
- [ ] Normalización de finales de línea o decisión documentada (R-D) para que los diffs de fase 1 sean legibles.
- [ ] Baseline verde: `npx vitest run` en `plc-engine/` (7/7, según analysis §8).

## Deliverables

- [ ] Tipos y nombres de instrucción nuevos en `ladder-types` (sin lógica de ejecución), incluido preset TON/TOF en ms y tag de reset.
- [ ] `programRunner.ts` con OR de ramas, E-stop prioritario, sobrecarga con latch y rearme, TON/TOF con gating y preset en ms (sin 250 ms), prioridad OTE/OTL/OTU.
- [ ] `tagMemory.ts` / `index.ts` con persistencia por nombre de tag, Stop que conserva y Reset que limpia (D2).
- [ ] Pulsadores, interruptores y breakers como entradas del motor, con `setInput` operativo; reset como entrada de tag.
- [ ] `plc-engine/test/` ampliado; ningún caso existente eliminado. Casos que cambien de expectativa (p. ej. timers sin retardo de 250 ms) actualizados con justificación en changelog.
- [ ] Nota de decisiones de semántica (pulsadores, timers en ms, prioridad, Stop/Reset) en `implementation/phase-1-impl.md`.

## Acceptance Criteria

- [ ] `npx vitest run` en `plc-engine/` pasa: los 7 casos originales (o los que cambien de expectativa por D4, con justificación registrada) más los nuevos.
- [ ] Caso OR: dos ramas en paralelo a una bobina → bobina ON si cualquiera está ON, y se mantiene ON cuando una rama cae en el mismo scan en que la otra estaba ON (sin last-writer-wins).
- [ ] Caso E-stop: con paro de emergencia abierto, ninguna salida queda energizada en el scan siguiente, aun si otra lógica la pide.
- [ ] Caso sobrecarga: disparo latcheado; no se rearma por cambio de nivel del contacto; rearme manual por entrada explícita y solo si la condición física se normalizó.
- [ ] Caso TON/TOF (D4): el acumulador no avanza cuando el renglón no tiene energía; el preset se expresa y se cuenta en milisegundos; no existe retardo oculto de 250 ms (`TIMED_CONTACT_ACTUATION_DELAY_MS` eliminado o no referenciado).
- [ ] Caso prioridad: OTE/OTL/OTU sobre el mismo tag produce el resultado de la regla documentada en todos los scans de prueba.
- [ ] Caso Stop (D2): tras Stop, los tags latcheados conservan su valor; al Run de nuevo siguen energizados.
- [ ] Caso Reset (D2): la entrada de reset limpia salidas latcheadas y enclavamientos; un pulsador de reset (entrada momentánea) basta para dispararla.
- [ ] Caso persistencia por edición (D2): rebuild de `PlcEngine` con el mismo programa conserva tags latcheados por nombre; cambio de nombre de tag no hereda estado.
- [ ] `tsc -p tsconfig.json` de `plc-engine` y `ladder-types` compila sin errores.
- [ ] Ningún archivo bajo `ui/`, `server/`, `data/`, `sample-programs/` modificado en esta fase.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 2 | blocks | El cableado se compila a programa del motor usando la semántica fijada aquí (D1). |
| Phase 3 | blocks (tipos) | Los tipos de instrucción nuevos de fase 1 se usan en símbolos y `projectData.ts`. |
| Phase 5 | blocks (semántica) | Run/Stop/Reset del panel usan la semántica D2 de esta fase. |

## Notes

- Bugs de referencia: analysis §4 (1 OR, 2 pass-through invisibles, 3 timers sin gating, 4 prioridad OTE/OTL, 5 setInput muerto, 6 estado descartado, 7 sin E-stop/sobrecarga).
- Pulsadores: en el motor se modelan como entradas de tag (`input` kind); la semántica momentánea/mantenida es decisión a registrar.
- Breakers/interruptores: entradas de estado (abierto/cerrado) que pueden ponerse a 0 desde el panel (fase 5) o el diagrama.
- Reset: entrada de tag (`input`) con semántica de limpieza de latches; no es solo un botón de UI (D2).
- Riesgo principal de esta fase: cambiar la semántica de timers y OR altera tests y trazas existentes (R-C).

## Result

- **Estado**: done (2026-10-29). Gates: `vitest` en `plc-engine` **31/31** pasan; `tsc` de `plc-engine` y `ladder-types` OK; `pnpm -r build` OK.
- **Cambios de expectativa (D4, 250 ms eliminados)**: 6 aserciones en `plc-engine/test/engine.spec.ts` L80, L83, L121, L124, L171, L176. El preset se cumple ahora en el scan en que se alcanza, sin retardo extra. Ningún caso eliminado. Justificación en plan.md changelog.
- **Casos nuevos**: 24 casos en 5 archivos de spec de `plc-engine/test/`.
- **Desviaciones** (ver `implementation/phase-1-impl.md`):
  - Latches OTL persistidos en mapa `latchByTag` (por nombre de tag).
  - OTU no añade entradas a `coilTags`.
  - TOF: `powerAfter = Q` (D13).
  - Naming: helper `hasValue`.
  - `ladder-types/dist` regenerado por el build.
- **Known gap**: `ui/src/App.tsx` sigue recreando `PlcEngine` en cada edición (se corrige en fases 2/5). `ui/src/DiagramBuilder.tsx` L245 mantiene su propia constante de 250 ms hasta fase 2.
- **Pendiente de fase 1 no cerrado**: normalización CRLF (R-D), baseline previo a 7/7 documentado, y revisión final de `implementation/phase-1-impl.md` contra D9-D13.
- **Siguiente**: Fase 2 (compilar cableado a programa del motor, D1).
