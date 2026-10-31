---
type: planning
entity: implementation-plan
plan: "hoja-plano-logica-y-ui"
phase: 6
status: draft  # draft | active | completed | revised
created: "2026-10-30"
updated: "2026-10-30"
---

# Implementation Plan: Phase 6 - Migración de datos, E2E y documentación

> Implements [Phase 6](../phases/phase-6.md) of [hoja-plano-logica-y-ui](../plan.md). Aplica R14, D5 (Playwright), D15 (catálogo de docs), DoD final. Verificado contra el árbol actual (2026-10-30): fase 5 **in_progress**; formatos reales: circuitos = `CircuitSnapshot` **v2** (con `migrateCircuitSnapshot` v1→v2 en carga), proyectos = `ProjectBundle` **v1** (`PROJECT_FORMAT_VERSION = 1`, `projectData.ts` L3).

## Approach

1. **La migración de datos ya es efectivamente un no-op de formato**: verificado que todos los archivos de `data/` y `sample-programs/` usan solo tipos de instrucción presentes en el set actual (`projectData.ts` L7-9: incluye ESTOP/OLR/TON/TOF) y parsean sin cambios con `parseProgram`/`parseTagDefinitions`/`parseProjectSettings`/`parseProjectCatalog`/`parseProjectBundle`. Decisión (OD6-1): **no se escribe un script de migración** (reescritura con delta de formato cero = churn; los originales Ya son los fixtures de compatibilidad que pide el Deliverable). Se añade cobertura automatizada que carga y **ejecuta en el motor** cada archivo, más una demo nueva `motor-guard-demo` (aditiva, con ESTOP/OLR/`SYS:RESET`) que exhibe los tipos nuevos en catálogo. Carga en runtime = path de compat ya existente en `readCircuitSnapshotFile` (v1 fixture `ui/src/diagram/__fixtures__/snapshot-v1.circuit.json`) verificado por E2E.
2. **Loaders huérfanos de `projectData.ts`** (OD6-2): se eliminan `loadProjectCatalog`/`loadBuiltInProject`/`hasSavedProjectSnapshot`/`tryLoadSavedProject`/`saveProjectSnapshot`/`readProjectBundleFile`/`downloadProjectBundle` (sin uso desde fase 2, analysis §5); cablearlos a la UI sería funcionalidad nueva (excluida por phase-6.md). Se **exportan los parsers** para que el spec de muestras use el parser real del runtime (no una copia).
3. **Playwright en `ui/` como devDependency** (D5): `ui/playwright.config.ts` + specs en `ui/e2e/`. Sin paquete `e2e/` aparte: la config de vite (`publicDir: ../data`, puerto 5173) vive en `ui`, los fixtures pueden referenciar rutas de `ui`, y no hace falta server Express (vite sirve app + `data/` como publicDir). Servidor de tests = **`vite dev`** (`pnpm dev`), no `preview` (preview exigiría `pnpm build` previo y acoplaría E2E al build; el dev sirve `data/` desde disco igual). `pnpm test` (raíz) queda intacto = vitest; E2E corre por script separado `pnpm test:e2e` (offline-safe).
4. **Specs E2E por flujo** con fixtures `.circuit.json` v2 en `ui/e2e/fixtures/` cargados por el input oculto "Load circuit" (`DiagramBuilder.tsx` L3509-3515, único `input[type=file]`); actuación por selectores existentes (textos ES: "Marcha"/"Paro"/"Un scan"/"Reset (SYS:RESET)"/"Hongo rojo…"; `data-device`; `aria-label` de lámparas) — sin añadir `data-testid` salvo necesidad real.
5. **Docs con `update-docs`**: inventarios de módulo (ui con subsecciones diagram/compiler/solver/runtime/panel/parity, plc-engine, ladder-types, server), `docs/rules-contract.md` (contrato de reglas fase 2) y **`docs/symbol-catalog.md` como respuesta a D15** (catálogo standalone: es transversal — symbols/palette/terminals + deviceMapping + panel kinds + InstructionType; en un módulo quedaría incompleto). Análisis con banner "superseded" por sección; sin borrados.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `ui/src/projectData.ts` | modify | Exportar parsers; eliminar loaders huérfanos (OD6-2). |
| `ui/src/projectData.samples.spec.ts` | create | Carga + ejecución en motor de cada archivo de `data/` y `sample-programs/`. |
| `data/**`, `sample-programs/` | create/modify | `motor-guard-demo` (3 archivos + entrada de catálogo + bundle). Originales intactos. |
| `ui/package.json`, `package.json` (raíz) | modify | devDep `@playwright/test`; scripts `test:e2e`. |
| `ui/vite.config.ts` | modify | Bloque `test.include` acotado a `src/**` (vitest no cargue specs de Playwright). |
| `ui/playwright.config.ts`, `ui/e2e/**` | create | Config + 6 specs + 5 fixtures `.circuit.json` + validador vitest. |
| `docs/README.md`, `docs/modules/*.md`, `docs/symbol-catalog.md`, `docs/rules-contract.md`, `docs/DEPLOYMENT.md`, `docs/analysis-…md` | create/modify | Ver Docs Deliverables. |
| `plans/…/phases/phase-6.md`, `plan.md`, `handovers/phase-6-cierre.md` | modify/create | Cierre (checkboxes, status completed, changelog, handover). |

## Required Context

| File | Why |
|------|-----|
| `plans/hoja-plano-logica-y-ui/plan.md` | D1-D17, DoD, Testing Strategy, R14, NF3/NF5. |
| `plans/hoja-plano-logica-y-ui/phases/phase-6.md` | Alcance/AC/Deliverables; Excludes (nada de funcionalidad nueva). |
| `plans/hoja-plano-logica-y-ui/implementation/phase-5-impl.md` | Canal panel→diagrama→motor (OD5-1..5), selectores del panel. |
| `ui/src/projectData.ts` | Parsers y loaders a resolver (L3-9, L53-131, L178-274). |
| `ui/src/diagram/snapshot.ts` | `migrateCircuitSnapshot` L417-436, `parseCircuitSnapshot` L438-480 (path de compat v1). |
| `ui/src/DiagramBuilder.tsx` L2842-2888, L3501-3515 | "Load circuit" + input oculto (selector E2E). |
| `ui/src/panel/SidePanel.tsx`, `ui/control-panel/ControlPanel.tsx` | Selectores E2E (textos ES, `data-device`, aria-label lámpara L55-61 de SidePanel). |
| `ui/src/runtime/olrTripAndRearm.spec.ts`, `ui/src/parity/motor-fixtures/M0*.json` | Semántica OLR/E-stop contra la que se escribe el E2E (trip enclavado, rearme por flanco `SYS:RESET`). |
| `ui/vite.config.ts`, `ui/package.json`, `package.json`, `pnpm-workspace.yaml` | Setup de scripts/devDeps. |
| `docs/README.md`, `docs/analysis-ladder-rendering-and-logic.md` | Estado actual de docs; §7 (data formats) a marcar superseded. |

## Implementation Steps

### Step 0: Gate y checkpoint

- **What**: Fase 5 completada y verde (`pnpm -r test`, `cd ui && npx tsc --noEmit`). Copia de `ui/src/projectData.ts` + `data/` + `sample-programs/` a `C:\Users\Johan\AppData\Local\Temp\opencode\phase6-base\`.
- **Why**: Prerequisite formal de phase-6.md; punto de rollback (R-B).

### Step 1: Muestras: tests de carga y ejecución - `ui/src/projectData.samples.spec.ts`

- **What**: Spec vitest (node) que con `node:fs` + `new URL("../../data/…", import.meta.url)` lee cada `data/program-data/*.program.json`, `data/tag-data/*.tags.json`, `data/settings/*.settings.json`, `data/settings/project-catalog.json` y `sample-programs/*.project.json`; pasa cada uno por el parser real exportado (`parseProgram`, `parseTagDefinitions`, `parseProjectSettings`, `parseProjectCatalog`, `parseProjectBundle`); para cada entrada del catálogo ensambla el `ProjectBundle` (igual que `loadBuiltInProject` hacía) y lo **ejecuta en `PlcEngine`**: latch-cycle (pulso I:0/0 ⇒ `B3:0/1` y `O:0/1` true; I:0/1 ⇒ false), output-deferral (r2 ve el scan previo), motor-guard (E-stop borra latch; OLR dispara y `SYS:RESET` rearma). Rechazo: catálogo con `defaultProjectId` inexistente lanza.
- **Where**: `ui/src/projectData.samples.spec.ts` (nuevo).
- **Why**: AC "todos los archivos cargan sin error (test automatizado)" + Deliverable "resultado lógico"; son los tests de migración del DoD para ProjectBundle (el equivalente de CircuitSnapshot ya existe en `snapshot.spec.ts`).
- **Test**: el propio spec (tabla por archivo).

### Step 2: Exportar parsers y retirar loaders huérfanos - `ui/src/projectData.ts`

- **What**: `export` en `parseProjectCatalog`, `parseProjectBundle`, `parseProgram`, `parseTagDefinitions`, `parseProjectSettings` (hoy privadas). Eliminar `loadProjectCatalog`, `loadBuiltInProject`, `hasSavedProjectSnapshot`, `tryLoadSavedProject`, `saveProjectSnapshot`, `readProjectBundleFile`, `downloadProjectBundle` y las constantes `STORAGE_KEY`/`PROJECT_FORMAT_VERSION` si quedan sin uso (conservar `PROJECT_FORMAT_VERSION` si lo usa el spec). No tocar `captureInputValues`, `TagDefinition`, `ProjectBundle`, tipos de catálogo (los usa App/panel).
- **Where**: `ui/src/projectData.ts`.
- **Why**: OD6-2; análisis §5 ("nada carga los samples"); elimina código muerto sin perder el parser real.
- **Considerations**: grep de usos antes de borrar (solo defs, verificado 2026-10-30); `snapshot.ts` L9 importa `TagDefinition` (intacto).

### Step 3: Demo nueva `motor-guard-demo` (aditiva)

- **What**: `data/program-data/motor-guard-demo.program.json` (renglones: XIC PB ⇒ OTL `B3:0/0`; ESTOP `I:0/9`; XIC `B3:0/0` ⇒ OTE `O:0/0`; OLR `I:0/8` ⇒ …; XIC RESET `I:0/2` ⇒ OTU `B3:0/0` — forma final alineada a la semántica OLR de `programRunner.ts` L268-277), `data/tag-data/motor-guard-demo.tags.json`, `data/settings/motor-guard-demo.settings.json` (150), entrada en `data/settings/project-catalog.json` (queda como `defaultProjectId`? **No**: se conserva `output-deferral-demo`), y `sample-programs/motor-guard-demo.project.json` (bundle con los mismos program/tags/settings/inputValues).
- **Where**: `data/**`, `sample-programs/`.
- **Why**: phase-6 Includes ("nuevos tipos de instrucción, nuevas entradas de paro/sobrecarga"); los 4 archivos originales quedan byte-idénticos como fixtures (Deliverable).
- **Test**: Step 1 los cubre automáticamente (glob por archivo).

### Step 4: Aislamiento vitest + dependencia Playwright

- **What**: `ui/vite.config.ts`: añadir `/// <reference types="vitest/config" />` y `test: { include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"] }` (vitest por defecto emparejaría `e2e/**/*.spec.ts` y fallaría al importar `@playwright/test`). `ui/package.json`: devDep `@playwright/test` (última), script `"test:e2e": "playwright test"`. Raíz `package.json`: script `"test:e2e": "pnpm --filter @plc-sim/ui test:e2e"`. `pnpm test` raíz **no cambia**.
- **Where**: `ui/vite.config.ts`, `ui/package.json`, `package.json`.
- **Why**: D5/NF3 (solo dep aprobada); `pnpm test` sigue siendo el gate unitario offline (R-H).
- **Considerations**: `npx playwright install chromium` requiere red (ver Open Risks).

### Step 5: `ui/playwright.config.ts`

- **What**: `testDir: "./e2e"`, `fullyParallel: true`, `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 2 : 0`, `reporter: [["list"], ["html", { open: "never" }]]`; `use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" }`; project `chromium` (navegador único, suficiente); `webServer: { command: "pnpm dev", url: "http://localhost:5173", reuseExistingServer: !process.env.CI, timeout: 30_000 }`. `testIgnore` no hace falta (specs solo en e2e/).
- **Where**: `ui/playwright.config.ts` (nuevo).
- **Why**: vite dev sirve `ui/` + `data/` (publicDir, `vite.config.ts` L10) sin build; 5173 ya reservado (L15).

### Step 6: Fixtures E2E - `ui/e2e/fixtures/*.circuit.json` + validador

- **What**: 4 fixtures **v2** (`version: 2`, `sheet` con defaults, `settings.gridSpacing: 18`) modelados en `ui/src/diagram/__fixtures__/snapshot-v1.circuit.json`: `momentary-lamp.circuit.json` (fuente→PUSH_BUTTON_NO→LAMP tag `LAMP1`), `latch-lamp.circuit.json` (PB⇒OTL `B3:0/0`; XIC `B3:0/0`⇒OTE `LAMP1`; LAMP tag `LAMP1`), `estop-latch.circuit.json` (PB⇒OTL `B3:0/0`; ESTOP; XIC `B3:0/0`⇒OTE `LAMP1`; LAMP), `overload-guard.circuit.json` (PB⇒OTL; OLR; XIC `B3:0/0`⇒OTE `LAMP1`; RESET_BUTTON tag fijo `SYS:RESET`; LAMP). Más `unsupported-version.circuit.json` (`version: 99`). Posiciones sobre retícula de 18 px con port ids `component-N:in|out`. Validador vitest `ui/src/diagram/e2eFixtures.spec.ts`: para cada fixture `parseCircuitSnapshot` + `compileDiagram` sin error, rungs/instrucciones esperadas (OLR/ESTOP/RESET_BUTTON presentes), deviceInputs contiene `__builder_device__:*`.
- **Why**: E2E determinista sin construir circuitos a mano en el navegador; el validador da feedback de fixture en segundos sin browser.
- **Test**: `e2eFixtures.spec.ts`.

### Step 7: Specs E2E - `ui/e2e/*.spec.ts` (6 flujos del DoD)

- **What** (cada spec: `page.goto("/")`, `page.locator('input[type="file"]').setInputFiles(fixture)`, esperar status `Loaded <name>.`, luego flujo):
  1. `01-run-stop.spec.ts`: Marcha ⇒ pill "Marcha"; presionar PB del panel (pointer down/up sobre botón en `[data-device]`) ⇒ lámpara `aria-label` `…: encendida`; soltar ⇒ sigue encendida (OTL); Paro ⇒ pill "Paro" y lámpara **sigue encendida** (D11: Stop conserva latches); "Reset (SYS:RESET)" ⇒ apagada (D2).
  2. `02-estop.spec.ts`: latch ON; presionar "Hongo rojo (pulsa para parar)" ⇒ lámpara apagada (D10 borra OTL); soltar y esperar ≥5 scans ⇒ apagada (sin rearranque automático); pulsar PB ⇒ vuelve a encender (no hay lockout permanente).
  3. `03-overload.spec.ts`: latch ON; "Normal (simular disparo)" ⇒ apagada (trip enclavado, R7); "Disparado (rearmar)" ⇒ **sigue apagada** (viajar sigue enclavado hasta reset); "Reset (SYS:RESET)" ⇒ rearma; PB ⇒ encendida (semántica de `olrTripAndRearm.spec.ts` L35-50).
  4. `04-edit-while-running.spec.ts`: latch ON con motor corriendo; drag del palette "Luz piloto" al lienzo (mouse down en palette button, move > `PALETTE_DRAG_THRESHOLD`, up dentro de canvas — flujo `paletteDragState` L1742-1861, sin guard de running) ⇒ pill dispositivos incrementa **y** lámpara sigue encendida (estado por nombre de tag, D2/bug 6).
  5. `05-panel-lamp.spec.ts` (`momentary-lamp`): mantener PB ⇒ encendida; soltar ⇒ apagada (momentáneo + pulso de un scan, OD5-4).
  6. `06-snapshot-v1.spec.ts`: `setInputFiles` con `ui/src/diagram/__fixtures__/snapshot-v1.circuit.json` ⇒ status "Loaded Bombeo v1.", componentes renderizados y cuadro de título con metadatos por defecto migrados; con `unsupported-version.circuit.json` ⇒ status con error "no soportada".
- **Where**: `ui/e2e/`.
- **Why**: DoD E2E + AC de fase. Selectores = textos ES/roles existentes (D6); esperas con `expect(...).toBeVisible({ timeout })`/`expect.poll` (scan 150 ms).

### Step 8: Docs (skill `update-docs`) - ver tabla Docs Deliverables

- **What**: Crear/actualizar los 9 archivos listados abajo; regla: nada contradice el código (D1: motor única fuente; compilador cableado→programa; solver solo lee). D15 resuelto con `docs/symbol-catalog.md` standalone. Marca "superseded" por sección en el análisis (sin borrar). Link check final: script shell que extrae `](…)` relativos de `docs/` y `plans/` y verifica existencia; 0 enlaces roto (AC).
- **Where**: `docs/`, ver tabla.
- **Test**: revisión + link check + que todo `file:line` citado exista (muestreo de 10 referencias por doc).

### Step 9: Cierre del plan

- **What**: `phases/phase-6.md` checkboxes según evidencia; `plan.md` status `completed` + changelog final (gate: `pnpm test`, `pnpm build`, `pnpm test:e2e`); handover `handovers/phase-6-cierre.md` (skill `generate-handover`), incl. estado de OQ-g (resuelto por panel, fase 5, pendiente sign-off) y OQ-h (captura del ESTOP para sign-off del usuario).
- **Why**: Deliverable "Cierre del plan". `plan.md` lo escribe la sesión de ejecución (el gating es de la primary).

## Docs Deliverables

| File | Content |
|------|---------|
| `docs/README.md` | Índice de docs (modules/, symbol-catalog, rules-contract, DEPLOYMENT); design intent D1 (ya presente, se amplía); comandos: `pnpm test`, `pnpm build`, `pnpm test:e2e`, `playwright install chromium`. |
| `docs/modules/ui.md` | Inventario: `App.tsx`, `DiagramBuilder.tsx` (6.8k, handle/inventory de fase 5), subsecciones `src/diagram` (grid, sheet, snapshot v2+migración, symbols, symbolGeometry, palette, terminals, timing, inspectionStates, constants, model), `src/compiler` (compileDiagram, deviceMapping, inspectionStates), `src/solver/electricalView` (solo lectura), `src/runtime/engineSession` (único PlcEngine, pulso 1 scan), `src/panel` (model, panelControls, SidePanel), `src/parity` (fixtures/goldens/harness/scene), huérfanos reutilizados (control-panel, status-display, ladder-display, TracePanel), `projectData.ts` (parsers), specs asociados. |
| `docs/modules/plc-engine.md` | `index.ts`, `programRunner.ts` (scan Ler-Evaluar-Actualizar, OR de bobinas D9, prioridad OTU>OTL>OTE, ESTOP borra latches D10, OLR trip enclavado + rearme por flanco `SYS:RESET` D12, TON/TOF gating ms D4/D13, fin de scan), `tagMemory.ts` (UNSET sano D13), `types.ts`; inventario de specs. |
| `docs/modules/ladder-types.md` | `src/index.ts`: uniones `InstructionType` (con ESTOP/OLR = `SafetyInstructionType`), `ImmediateInstruction` vs `TimedContactInstruction`; NF2 (sin lógica). |
| `docs/modules/server.md` | `server/src/index.ts`: estático `ui/dist` + `/healthz` + SPA fallback; sin APIs (alcance). |
| `docs/symbol-catalog.md` | **D15**: catálogo ANSI/NEMA standalone. Tabla por `BuilderComponentType`: ID, etiqueta ES, glifo (`symbols.tsx` símbolo + `symbolGeometry.ts`), grupo de palette, binding (`deviceMapping.ts`: tag/kind/contacto), kind de panel (`panel/model.ts`), instrucción de motor implicada. Nota D7 (refuerzo sobre set previo) y D14 (IDs conservados). |
| `docs/rules-contract.md` | Contrato de reglas fase 2/D1: cableado→programa (compileDiagram), OR paralelo, prioridades OTE/OTL/OTU, deferral de salidas, semántica E-stop/OLR/Reset/Stop (D2, D9-D13), timers; evidencia: parity goldens F01-F12 + M01-M06 + specs de motor. |
| `docs/DEPLOYMENT.md` | Añadir sección E2E (install chromium, `pnpm test:e2e`) y nota `data/` = publicDir de vite. |
| `docs/analysis-ladder-rendering-and-logic.md` | Banner superior "historical (superseded by phases 1-6; ver docs/modules/*, rules-contract, symbol-catalog)" + anotación "Superseded" en §2-§5, §7 (CircuitSnapshot ahora v2) y §8 (tests: vitest + Playwright). Sin borrados (R-D). |

## Testing Plan

**Verify command (único, primario):** `pnpm test && pnpm --filter @plc-sim/ui test:e2e` — unit (muestras, fixtures, suites existentes) + los 6 flujos E2E reales en navegador.

Gates secundarios: `pnpm build` (raíz) · `cd ui && npx tsc --noEmit` · link check de docs (Step 8).

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| vitest `projectData.samples.spec.ts` | Cada archivo de `data/` y `sample-programs/` parsea y produce el resultado lógico esperado en `PlcEngine` (3 escenarios) | Pasa |
| vitest `diagram/e2eFixtures.spec.ts` | 5 fixtures E2E parsean como CircuitSnapshot v2 y compilan (devices ESTOP/OLR/RESET presentes) | Pasa |
| vitest regressión | Suites existentes de `ui` (181+450+parity+…) y `plc-engine` sin cambios | Pasa |
| Playwright `01`…`06` | Flujos del DoD: run/stop+D11/D2, E-stop D10, OLR R7+rearme, edición conservando estado D2, lámpara momentánea, migración v1 en carga | Pasan |
| manual/docs | Link check 0 rotos; docs no contradicen código (revisión D1); captura ESTOP para OQ-h | Sign-off |

### Test Integrity Constraints

- Ninguna suite existente se modifica ni debilita: `plc-engine` (34+), `ui` (parity, compiler, runtime, panel, diagram, symbols, alignment) intactas; los cambios de `projectData.ts` son aditivos (exports) más borrado de exports sin consumidor (verificado: solo defs).
- `ui/vite.config.ts` solo añade `test.include` que reproduce el alcance actual (`src/**`); si algún spec viviera fuera de `src/` se incluiría explícitamente (no hay ninguno, verificado por glob).
- `pnpm test` raíz no ejecuta Playwright: el gate unitario no depende de binarios de navegador (R-H/offline).

## Rollback Strategy

- **Checkpoint**: copia de `ui/src/projectData.ts` + `data/` + `sample-programs/` en `C:\Users\Johan\AppData\Local\Temp\opencode\phase6-base\` (Step 0).
- **Por paso**: Steps 1-7 son aditivos salvo Step 2 (borrado de loaders): revert = restaurar desde checkpoint (los parsers exportados se quedan). Step 8/9 son docs/plan: revert = git checkout de docs y plans.
- **Flag**: ningún cambio de runtime; el motor y la UI quedan con comportamiento idéntico (solo se retiran funciones sin llamadores).

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| **OD6-1** Estrategia de migración de datos | (a) compat por carga + tests + demo nueva aditiva, originales intactos; (b) reescribir demos a "formato nuevo" y mover originales a fixtures/; (c) script de migración | **(a) propuesta** | Verificado: los archivos Ya parsean con el parser actual (delta de formato cero); (b)/(c) solo añaden churn y rompen "originales como fixtures". Confirmar con primary. |
| **OD6-2** Loaders huérfanos de `projectData.ts` | (a) eliminar y exportar parsers; (b) dejarlos sin uso; (c) cablear catálogo a la UI (selector de demos) | **(a) propuesta** | (c) es funcionalidad nueva (excluida en phase-6.md) y chocaría con el estado del escenario (el bundle no trae escena); (b) deja muerte documentada. Confirmar con primary. |
| **OD6-3** Servidor E2E | (a) `vite dev`; (b) `vite preview` (tras build) | **(a) propuesta** | Sin paso de build, `data/` servido desde disco, arranque rápido; preview acopla E2E a `pnpm build` sin aportar cobertura extra (los specs son de comportamiento). |
| **OD6-4** Ubicación del catálogo ANSI/NEMA (D15) | (a) `docs/symbol-catalog.md` standalone; (b) sección de `docs/modules/ui.md`; (c) feature doc | **(a) propuesta** (resuelve D15) | El símbolo es transversal: glyphs (diagram), bindings (compiler), kinds (panel), IDs (ladder-types). Standalone es enlazable desde README, módulos y rules-contract. |
| **OD6-5** E2E en `pnpm test` | (a) script separado `pnpm test:e2e`; (b) incluido en `pnpm test` | **(a) propuesta** | `pnpm test` queda offline y rápido (DoD: "pnpm test pasa" sin descarga de navegador); E2E es gate explícito en el comando de verify de esta fase. |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `ui/src/projectData.ts` | `instructionTypes` L7-9 (incl. ESTOP/OLR/TON/TOF), `PROJECT_FORMAT_VERSION` L3, loaders L53-131, parsers L178-293 | Los archivos de datos ya son válidos; loaders sin consumidor (grep: solo defs). |
| `ui/src/diagram/snapshot.ts` | `migrateCircuitSnapshot` L417-436, `parseCircuitSnapshot` L438-480 | Path de compat v1→v2 verificado; rechazo de versión desconocida L435 (E2E 06). |
| `ui/src/diagram/__fixtures__/snapshot-v1.circuit.json` | fixture v1 completa | Plantilla de formato para fixtures E2E y spec 06. |
| `ui/src/DiagramBuilder.tsx` | `handleLoadCircuitChange` L2846-2888, input oculto L3509-3515, flujo palette L1742-1861 | Selector de carga E2E; edición por palette posible con motor corriendo (sin guard). |
| `ui/src/panel/SidePanel.tsx` L44-177, `ui/control-panel/ControlPanel.tsx` L42-56 | Botones/aria-label/data-device | Selectores E2E sin tocar markup. |
| `ui/src/runtime/olrTripAndRearm.spec.ts` L35-50, `plc-engine/src/programRunner.ts` L115-118, L268-277 | Flanco `SYS:RESET`, trip OLR enclavado | Semántica exacta del spec 03. |
| `ui/src/parity/motor-fixtures/M01-M06*.json` | fixtures de motor | Referencia de escenarios E-stop/OLR/reset ya probados a nivel de motor. |
| `ui/vite.config.ts` L8-16, `ui/package.json` L6-12, raíz `package.json` L8-14 | publicDir, scripts, puertos | Base del setup Playwright; `pnpm test` intacto. |
| `docs/` | solo README, DEPLOYMENT, analysis | No existen inventarios de módulo todavía (entregable real, no actualización). |

### Mismatches / Notes

- **"data/ y sample-programs/ migrados al formato nuevo"** (phase-6.md): no hay formato al que migrar (ya son el actual v1/v2). Se cumple la intención (compatibilidad + exhibir tipos nuevos) vía tests + demo aditiva; elevar a la primary si prefería (b)/(c) — registrado como OD6-1.
- **Fase 5 sigue `in_progress`** al momento de redactar: los selectores E2E (textos del panel, `data-device`, handle) dependen de la forma final de fase 5 (OD5-1..5). Step 0 exige fase 5 cerrada; si cambian textos, ajustar specs (bajo riesgo: los textos vienen de phase-5-impl Step 4/5).
- **OQ-g**: quedó resuelto funcionalmente en fase 5 (OD5-5: controles de disparo OLR/FUSE/GUARDAMOTOR en panel) — el E2E 03 lo verifica; falta sign-off del usuario (registrar en Resultado). **OQ-h**: el E2E 02 valida función, no estética; captura para sign-off en Step 9.
- **Riesgo offline (Playwright)**: `playwright install chromium` requiere red la primera vez. Fallback: si no hay binarios, los specs quedan en repo y esta nota en el Resultado de fase: "E2E NO ejecutado: binarios de navegador no disponibles offline; gate `pnpm test`/`pnpm build` en verde; DoD E2E **sin** marcar". No se marca el AC como cumplido y no se sustituye por tests falsos.
- **Riesgo de flake**: spec 04 (drag del palette) es la más frágil; mitigación = usar `boundingBox` + movimiento por pasos y threshold conocido (`PALETTE_DRAG_THRESHOLD`); si persiste, elevar a primary (fallback candidato: reutilizar el press de dispositivo como "edición" no sirve — debe ser cambio de escena; alternativa = reconectar un wire, mismo canal de recompilación).

### Blocking findings

Ninguno bloqueante. Cinco decisiones abiertas (OD6-1..5, máx. 5) requieren confirmación de la primary antes de ejecutar; OD6-1 y OD6-2 definen el alcance efectivo de los pasos 1-3.
