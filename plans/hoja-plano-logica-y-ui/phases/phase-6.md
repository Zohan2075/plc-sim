---
type: planning
entity: phase
plan: "hoja-plano-logica-y-ui"
phase: 6
status: done  # pending | in_progress | completed | skipped | done
created: "2026-10-29"
updated: "2026-10-30"
---

# Phase 6: Migración de datos, pruebas E2E y documentación

> Part of [hoja-plano-logica-y-ui](../plan.md)

> **code reverted by D24 (2026-10-30); kept as historical record**

## Objective

Dejar el proyecto en estado coherente: `data/` y `sample-programs/` migrados al formato nuevo y cargables, cobertura E2E de los flujos principales, y documentación de `docs/` actualizada y sin contradicciones con el código.

## Scope

### Includes

- Migración de `data/program-data/*.program.json`, `data/tag-data/*.tags.json`, `data/settings/*.settings.json`, `data/settings/project-catalog.json` y `sample-programs/*.project.json` al formato nuevo (nuevos tipos de instrucción, nuevas entradas de paro/sobrecarga) manteniendo la carga de los antiguos.
- Decisión: los loaders de `projectData.ts` (hoy sin uso, analysis §5) se usan para cargar los samples o se eliminan; los componentes huérfanos no se borran (D3).
- Suite E2E Playwright completa (ampliación de la de fase 5) con los flujos del Definition of Done.
- Actualización de `docs/`: `docs/README.md`, inventarios de módulo (`ui`, `plc-engine`, `ladder-types`, `server`), análisis marcado como superado en lo resuelto, contrato de reglas (fase 2) y catálogo de símbolos (fase 3). Usar skill `update-docs`.
- Cierre del plan: estado `completed` y handover final.

### Excludes (deferred to later phases)

- Nuevas funcionalidades. Cualquier mejora no listada se registra como trabajo futuro, no se implementa aquí.
- Nueva retirada o rediseño del solver de vista (ya decidido en fase 2, D1).

## Prerequisites

- [x] Fase 5 completada y verde en tests.
- [x] Fixtures v1 de `data/` y `sample-programs/` inventariados.

## Deliverables

- [x] `data/` y `sample-programs/` migrados; los originales conservados como fixtures de compatibilidad (no se borran).
  - Verificado: **no hay delta de formato** (todos los archivos ya usan los tipos actuales: OD6-1). No se reescribió ningún original; se añadió la demo aditiva `motor-guard-demo` (3 archivos + entrada de catálogo + bundle) → 3 demos en `data/` y `sample-programs/`.
- [x] Test que carga cada archivo de `data/` y `sample-programs/` y verifica resultado lógico (`ui/src/projectData.samples.spec.ts`, 17 tests: parseo con los parsers reales exportados + ejecución en `PlcEngine` + catálogo).
- [x] Suite Playwright con los flujos de Definition of Done (`ui/e2e/01..06`, **7/7**).
- [x] `docs/` actualizado; `docs/README.md` refleja el diseño real (motor único de fuente de tags, compilador cableado→programa, solver de vista que solo lee tags; D1).
- [x] Handover de cierre en `handovers/` → `handovers/hoja-plano-final.md`.

## Acceptance Criteria

- [x] Todos los archivos de `data/` y `sample-programs/` cargan sin error (test automatizado).
- [x] Playwright: todos los flujos del DoD pasan en una ejecución limpia (E2E **7/7**).
- [x] `pnpm test` y `pnpm build` en raíz pasan.
- [x] Ningún enlace roto en `docs/` ni en `plans/` (link check final: 92 enlaces relativos en 25 archivos `md`, **0 rotos**).
- [x] `docs/` no contradice el código (revisión del análisis y del README; análisis con banner "Superseded").
- [x] `plan.md` pasa a `completed` con changelog final.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 5 | blocked-by | Layout y E2E base. |

## Notes

- La migración de `data/` debe ser reversible o conservar originales en fixtures.
- Esta fase es la última; no se ejecuta en paralelo con ninguna otra.

## Result

**Status: done (2026-10-30).** Migración/compatibilidad de datos, E2E y documentación cerrados.

- **Datos (R14, OD6-1)**: sin script de migración (delta de formato cero verificado: los archivos ya
  parsean con el parser actual). Originales intactos = fixtures de compatibilidad; demo aditiva
  `motor-guard-demo` (program/tags/settings + entrada en `project-catalog.json` + bundle) → **3 demos**
  (`output-deferral-demo`, `latch-cycle-demo`, `motor-guard-demo`), `defaultProjectId` sigue siendo
  `output-deferral-demo`. Carga verificada por `ui/src/projectData.samples.spec.ts` (17 tests) y por el
  round-trip de paridad sobre `data/program-data/*`.
- **`projectData.ts` (OD6-2)**: parsers **exportados** (`parseProgram`, `parseTagDefinitions`,
  `parseProjectSettings`, `parseProjectCatalog`, `parseProjectBundle`); **7 loaders huérfanos eliminados**
  (`loadProjectCatalog`, `loadBuiltInProject`, `hasSavedProjectSnapshot`, `tryLoadSavedProject`,
  `saveProjectSnapshot`, `readProjectBundleFile`, `downloadProjectBundle`) — sin consumidores desde fase 2.
- **E2E (D5, OD6-3/OD6-5)**: `ui/playwright.config.ts` (chromium, workers 1, `webServer: pnpm dev` en 5173;
  `data/` llega como `publicDir` de vite), `@playwright/test` como devDependency de `ui`, scripts
  `test:e2e` (ui y raíz), `ui/vite.config.ts` con `test.include` acotado a `src/**`. Specs:
  `01-run-stop` (D11/D2), `02-estop` (D10), `03-overload` (viaje enclavado + rearme por `SYS:RESET`),
  `04-edit-while-running` (estado por nombre de tag), `05-panel-lamp` (momentáneo + pulso de un scan),
  `06-snapshot-load` (v1→v2 con cuadro de título + versión desconocida rechazada) = **7 tests, 7/7**.
  - **Desviación**: el tercer caso previsto de spec 06 (ejecutar el circuito v1) se **descartó**: el
    fixture v1 no tiene cable de retorno (fuente→breaker→PB→lámpara sin vuelta), por diseño no es
    ejecutable; compilarlo no produce renglón runnable. No se modificó el fixture para forzarlo.
  - **Fix del harness de paridad**: las entradas de dispositivo del motor se impulsan ahora vía
    `session.setDeviceInputs(compileDiagram(...).deviceInputs)` (`ui/src/parity/harness.ts:81`) — el mismo
    canal que la app; antes los `scan.devices` no llegaban al motor.
- **Docs (D15)**: `docs/README.md` (índice + arquitectura D1 + comandos), `docs/modules/{ui,plc-engine,ladder-types,server}.md`,
  `docs/symbol-catalog.md` (catálogo ANSI/NEMA por tipo: glifo, paleta, binding, panel, instrucción; D7/D14/D17),
  `docs/rules-contract.md` (contrato con evidencia F01-F12/M01-M06 + unidades + E2E), `docs/DEPLOYMENT.md`
  (sección E2E + `data/` = publicDir), `docs/analysis-ladder-rendering-and-logic.md` con banner
  **Superseded** (contenido conservado).
- **Cierre**: `plan.md` → `completed`; handover `handovers/hoja-plano-final.md`.

**Gates (2026-10-30)**: ui tsc **0**; ui vitest **501/501 (20 files)**; plc-engine **34/34**;
`pnpm -r build` OK; Playwright E2E **7/7** (specs 01-run-stop, 02-estop, 03-overload,
04-edit-while-running, 05-panel-lamp, 06 v1-load, 06 unknown-version).

**Pendiente de usuario**: OQ-h (sign-off visual de ESTOP, sin imagen de referencia) y las capturas de
fases 4/5 — ver "Pending user sign-off" en [plan.md](../plan.md).
