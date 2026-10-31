---
type: planning
entity: implementation-plan
plan: "hoja-plano-logica-y-ui"
phase: 2
status: done  # draft | active | completed | revised | done
created: "2026-10-29"
updated: "2026-10-29"
---

# Implementation Plan: Phase 2 - Compilar el cableado a programa del motor y retirar el solver como fuente de tags

> **Estado: done (2026-10-29).** Ejecutado; resultados en [phases/phase-2.md](../phases/phase-2.md#result). Legacy-solver: ver [phase-2-parity.md](phase-2-parity.md).

> Implements [Phase 2](../phases/phase-2.md) of [hoja-plano-logica-y-ui](../plan.md). Aplica D1 (motor = única fuente de tags), D9-D13 y R-A. Depende de fase 1 (`implementation/phase-1-impl.md`, `plc-engine` ya con OR, ESTOP, OLR, TON/TOF, `reset()`/`stop()`, `SYS:RESET`).

## Approach

Cuatro bloques, en este orden estricto (cada uno con criterio de salida antes del siguiente):

1. **Extracción sin cambio de comportamiento.** Mover la lógica del diagrama a módulos puros (`ui/src/diagram/`, `ui/src/solver/`) y conservar el solver viejo intacto en `ui/src/solver/legacyTagSolver.ts`, con el retardo de 250 ms inyectable (parámetro, default 250 = comportamiento actual). Esto permite testearlo con vitest (hoy no se puede: las funciones no se exportan de un `.tsx` de 6866 líneas).
2. **Compilador puro cableado → programa** (`ui/src/compiler/compileDiagram.ts`) y **harness de paridad** (`ui/src/parity/`). Paridad: solver viejo vs. motor sobre fixtures; las diferencias se clasifican (ver Testing Plan). Sin paridad aprobada no se avanza.
3. **Corte con rollback**: `ui/src/config/tagSource.ts` (`TAG_SOURCE = "engine" | "legacy-solver"`). Con `"legacy-solver"` el diagrama vuelve a escribir tags con el solver. Se pasa a `"engine"` solo con paridad verde. Los goldens de la paridad se guardan como JSON antes de borrar el legacy.
4. **Retirada** del solver como fuente de tags y del estado de timers en UI; `EngineSession` (`ui/src/runtime/engineSession.ts`) reemplaza la recreación de `PlcEngine` (bug 6). Docs (`docs/README.md`).

### Semántica del compilador (decisión de esta fase)

| Tema | Regla |
|------|-------|
| Contacto eléctrico | Todo dispositivo de paso es un `XIC` sobre un **tag de dispositivo** cuyo valor = estado eléctrico (true = cerrado), como fija fase 1. |
| Renglón | Cada camino simple fuente→bobina produce un renglón. Varios renglones a la misma bobina = OR en el motor (D9). El compilador **no** fusiona ramas. |
| Retorno | Los contactos del lado de retorno (entre la bobina y L2) se **trasladan delante de la bobina**: la AND es conmutativa y OTE/OTL/OTU sólo usan `powerBefore`. Hoy se ignoran (ver Reality Check). |
| Orientación | Conducción **bidireccional** en los pares de cada dispositivo (igual que el solver, `getConductiveTerminalPairs` L699). Hoy el compilador exige `role === "input"` (`collectRungPaths` L3584-3590). |
| Conectividad | Grafo de **nodos eléctricos** (puertos + puntos de cable, `buildElectricalNodeGraph` L3513), no de puertos (`buildResolvedPortGraph` L3491). Cubre uniones en T que el solver ve. |
| Determinismo | Fuentes y bobinas ordenadas por `(y, x, id)`; renglones con id `builder-rung-N`; instrucciones con id `<rungId>/<componentId>` (estable para mapear el trace). Deduplicación por (conjunto de ids de contacto, bobina). |

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `ui/src/diagram/model.ts` | create | Tipos `BuilderComponent`, `BuilderWire`, `Point`, `TerminalDefinition`, `BuilderTerminal` movidos desde `DiagramBuilder.tsx` L14-123. Se eliminan los campos duplicados L41-55 (artefacto de merge). |
| `ui/src/diagram/terminals.ts` | create | Topología y geometría de terminales: `getTerminalDefinitions` L1120, `projectSymbolPoint` L1098, `getComponentTerminals` L2545, `getTerminalPoint` L2485, `getPortId` L1588, clasificadores L321-412. Sin React. |
| `ui/src/diagram/electricalGraph.ts` | create | `connectGraphNodes` L3351, `cloneConnections` L3368, `collectReachableNodes(WithParents)` L3374/L3397, `getElectricalPointNodeId`/`getElectricalPortNodeId` L1993-1997, `buildElectricalNodeGraph` L3513. |
| `ui/src/compiler/compileDiagram.ts` | create | Compilador puro (ver Steps 3-4). Devuelve `{ program, tags, deviceInputs, diagnostics }`. |
| `ui/src/compiler/deviceMapping.ts` | create | Tabla dispositivo→instrucción y `getDeviceContactState(component)`; prefijo `DEVICE_TAG_PREFIX`. |
| `ui/src/solver/electricalView.ts` | create | Solver de **vista**: energía, flujo, cortocircuito (`fault`). Lee tags; no escribe. |
| `ui/src/solver/legacyTagSolver.ts` | create (temporal) | Copia verbatim de `resolvePhysicalInstructionTagValues` L822-913, `previewTimedContactState` L630-668, `collectTimedContactRuntimeStates` L670-697, `deriveProgram` L3623-3666, `collectRungPaths` L3554-3621. Solo para paridad y rollback. Se borra en Step 9. |
| `ui/src/config/tagSource.ts` | create | `export const TAG_SOURCE` (flag de rollback). Se elimina con el legacy. |
| `ui/src/runtime/engineSession.ts` | create | `EngineSession`: dueño de `PlcEngine`; `applyProgram`, `setDeviceInputs`, `start`, `stop`, `scan`. Testeable en Node. |
| `ui/src/parity/` | create | `harness.ts`, `scene.ts` (helpers de fixture: componentes, cables a partir de coordenadas de terminal), `fixtures/*.json`, `goldens/*.json`, `parity.spec.ts`. |
| `ui/src/DiagramBuilder.tsx` | modify (grande) | Retirada de símbolos listados en Step 8; `ElectricalState` sin tags; props `compiled`/`engineTrace`/`onDeviceInputsChange`. |
| `ui/src/App.tsx` | modify | `EngineSession` en `useRef`; sin `buildEngine`; sin `scanWithTrace(0)` al cargar; Stop = `engine.stop()`. |
| `ui/package.json` | modify | `devDependencies.vitest` (D5, única dependencia nueva) y script `"test": "vitest run"`. |
| `ui/vitest.config.ts` | create | `environment: "node"`; include `src/**/*.spec.ts`. |
| `plc-engine/src/types.ts` + `programRunner.ts` | modify (aditivo) | `TraceStep.contactClosed?: boolean` para NOTC/NCTO (la UI deriva el flujo del contacto sin reinterpretar `powerAfter`). Ver Step 1. |
| `docs/README.md` | modify | Nota de intención (D1). |
| `ladder-types/` | no change | No se añaden tipos en fase 2. |

## Required Context

| File | Why |
|------|-----|
| `plans/hoja-plano-logica-y-ui/plan.md` | D1, D2, D9-D13, R-A, DoD. |
| `plans/hoja-plano-logica-y-ui/phases/phase-2.md` | Alcance y criterios de aceptación. |
| `plans/hoja-plano-logica-y-ui/implementation/phase-1-impl.md` | Semántica del motor (scan a-f, E-stop, OR, reset). |
| `docs/analysis-ladder-rendering-and-logic.md` §4-§5 | Bugs 1-7 y solver de UI. |
| `ui/src/DiagramBuilder.tsx` L14-123, L144-175, L230-265, L321-412, L483-548, L572-830, L913-1000, L1120-1217, L1588, L1993-2000, L2485-2560, L3263-3352, L3491-3666, L3668-3840, L4002-4004, L4620-4633, L4859-4888, L5473-5540, L6650-6690 | Todo el solver, compilador actual y puntos de consumo. |
| `ui/src/App.tsx` L28-42, L44-80, L82-177 | Recreación de engine, loop, sincronía. |
| `ui/src/projectData.ts` L7, L203-230, L268-272 | Parser de programa (sin cambio en fase 2), errores tsc en L268/272. |
| `plc-engine/src/index.ts`, `programRunner.ts` (`load` L52, `runScan` L85, `stop` L99), `tagMemory.ts` (`readDeviceDuringScan` L46) | API y semántica del motor. |
| `plc-engine/test/engine.spec.ts`, `parallel-or.spec.ts`, `persistence.spec.ts` | Casos de referencia para fixtures. |
| `data/program-data/*.program.json`, `sample-programs/*.project.json` | Circuitos existentes para paridad round-trip. |

## Implementation Steps

### Step 0: Línea base y checkpoint

- **What**: (a) Anotar errores de `cd ui && npx tsc --noEmit` (hoy **≈30**: duplicados L37-55, `exactOptionalPropertyTypes`, y los introducidos por la ampliación de `InstructionType` en fase 1: L387, L607, L684, L915, L1120, L1223, L1247, L3650; `projectData.ts` L268/L272). Corregirlos **antes** de mover código (tipos/exhaustividad solamente). (b) Checkpoint: ver Rollback.
- **Where**: `ui/src/DiagramBuilder.tsx`, `ui/src/projectData.ts`.
- **Why**: Sin tsc limpio no hay señal de regresión de tipos durante la extracción.
- **Considerations**: No cambiar comportamiento. `pnpm -r build` (vite) no typecheckea, así que pasa aunque tsc falle.

### Step 1: Motor — `TraceStep.contactClosed` (aditivo)

- **What**: En `programRunner.ts` `advanceTimedContact` (L362-392) y en el paso NOTC/NCTO de `evaluateInstructionWithTrace` (L280-297), añadir `contactClosed` al `TraceStep`. XIC/XIO no lo necesitan (usan `readValue`).
- **Where**: `plc-engine/src/types.ts` L3-14, `plc-engine/src/programRunner.ts` L280-297.
- **Why**: El flujo visual de un NCTO sin energía es cerrado (`contactClosed = true`), pero `powerAfter` es false. Sin el campo la UI tendría que reinterpretar la semántica del motor.
- **Considerations**: No altera `powerAfter` ni la semántica de fase 1. Añadir test en `plc-engine/test/timers.spec.ts` (NCTO sin energía → `contactClosed` true).

### Step 2: Extraer modelo, terminales y grafo eléctrico (sin cambio)

- **What**: Mover los símbolos de la tabla de Affected Modules a `ui/src/diagram/*.ts` y `DiagramBuilder.tsx` los importa. Quitar campos duplicados de `BuilderComponent` (L41-55). `DiagramBuilder` mantiene el comportamiento idéntico.
- **Where**: ver Affected Modules.
- **Why**: Permite compilador y solver testables sin React ni CSS (R-E).
- **Considerations**: `projectSymbolPoint` depende de constantes `SYMBOL_VIEWPORT_*` (verificar ubicación exacta antes de mover; si están en `DiagramBuilder.tsx`, moverlas con él). Gate: `tsc` igual que Step 0 y `pnpm -r build`.

### Step 3: Compilador `compileDiagram` (puro)

- **What**: Implementar:
  1. Construir nodos: `buildElectricalNodeGraph(components, wires)` (sin estado de tags).
  2. Aristas de conducción: por cada dispositivo de paso, sus pares de `getConductiveTerminalPairs` **sin** `useLiveTagState` (todos los pares), bidireccionales. Cargas (OTE/OTL/OTU/LAMP/MOTOR) y fuentes no conducen.
  3. Por cada bobina/carga con tag válido (OTE/OTL/OTU con `tag`; LAMP/MOTOR con tag de dispositivo): para cada fuente S, enumerar caminos simples (por nodo, sin atravesar otra carga) desde cada terminal de S hasta un terminal de la bobina (A o B). Un renglón = par (camino de terminal S₁ → A, camino de B → terminal S₂) con S₁≠S₂, y el simétrico (A↔B).
  4. Instrucciones del renglón = contactos del camino de alimentación + contactos del camino de retorno (orden: alimentación primero) + bobina.
  5. Deduplicar por clave (`sorted(contactIds)`, `coilId`). Límite de combinaciones por bobina (p. ej. 256): si se excede, `diagnostics` con `too-many-paths` y la bobina no se compila.
  6. Tags: `preservedTags` (instrucciones, como `mergeInstructionBindingTags` L1026) + tags de dispositivo (`kind: "input"` para pulsadores/switch/breaker, `kind: "output"` para lámpara/motor).
- **Where**: `ui/src/compiler/compileDiagram.ts` (nuevo). Reemplaza `deriveProgram` L3623 y `collectRungPaths` L3554 (en `legacyTagSolver.ts` hasta Step 9).
- **Why**: Cierra bugs de fase 2: OR real (bug 1, cubierto por el motor, D9), dispositivos visibles (bug 2), retorno, T-junctions. Una ruta simple por bobina = término del OR.
- **Considerations**: Bidireccional + cualquier orientación; loop corto (fuente→fuente) no produce renglón (lo detecta la vista como `fault`). Complejidad exponencial en el peor caso: el límite es la salvaguarda.

### Step 4: Mapeo dispositivo → instrucción (`deviceMapping.ts`)

| Componente | Instrucción | Tag | Estado de contacto (`getDeviceContactState`) |
|---|---|---|---|
| `XIC`, `XIO`, `NOTC`, `NCTO` | igual que hoy | `component.tag` (label-binding actual, `syncInstructionComponentTag` L1004) | — (sin cambio) |
| `OTE`, `OTL`, `OTU` | igual | `component.tag` | — |
| `PUSH_BUTTON_NO` | `XIC` | `DEVICE_TAG_PREFIX + id` | `isPressed === true` |
| `PUSH_BUTTON_NC` | `XIC` | idem | `isPressed !== true` |
| `SWITCH_1P` | `XIC` | idem | `isClosed === true` |
| `BREAKER_1P`, `BREAKER_2P` | `XIC` | idem | `isClosed ?? true` (fase 2 no añade UI de apertura) |
| `LAMP`, `MOTOR` | `OTE` | idem (`kind: "output"`) | — (el visual lee el tag) |
| `POWER_SOURCE`, `DC_SOURCE` | — (fuente) | — | — |
| `ESTOP`, `OLR`, `TON`, `TOF` | reservado | — | No hay símbolo hasta fase 3; el compilador los admitirá entonces (test de tabla). |

- **Where**: `ui/src/compiler/deviceMapping.ts`. `DEVICE_TAG_PREFIX = "__builder_device__:"`.
- **Why**: Una sola fuente de verdad: el contacto del dispositivo es un tag del motor que la UI escribe con `setInput`.
- **Considerations**: Los tags de dispositivo usan **id**, no label (los labels se repiten: dos "LAMP" compartirían tag y se encenderían juntos, a diferencia del solver). Ver OD2-3.

### Step 5: Runtime `EngineSession` y fin de la recreación (bug 6)

- **What**: `EngineSession` (clase pura) encapsula `PlcEngine`:
  - `applyProgram(program)` → `engine.loadProgram(program)`. **No** escanea ni borra memoria.
  - `setDeviceInputs(map)` → guarda y aplica `engine.setInput` para cada tag.
  - `start()` / `stop()`: `stop()` llama `engine.stop()` (D11). `start()` reanuda sin reset.
  - `tick(elapsedMs)` → `setDeviceInputs` aplicado + `scanWithTrace(elapsedMs)`; devuelve trace.
  - `getTag`, `getLastTrace`.
- **Where**: `ui/src/runtime/engineSession.ts` (nuevo). `ui/src/App.tsx`: `const session = useRef(new EngineSession())` (L47 `useState(() => new PlcEngine())` se elimina); `buildEngine` L28-42 se elimina; `applyProject` L54-62, `handleBuilderProgramChange` L82-106, `handleCircuitLoad` L108-123, `handleRunToggle` L153-177 usan `applyProgram`/`start`/`stop`; el `setInterval` (L69-80) depende de `[running, scanIntervalMs]` (sin `engine`/`project`) y llama `session.tick`.
- **Why**: `PlcEngine` ya conserva tags entre `loadProgram` (`plc-engine/src/index.ts` L13-16, memoria de instancia). La pérdida viene de `new PlcEngine()` en App (analysis §4 bug 6).
- **Considerations**: `loadProgram` ya borra timers (`programRunner.ts` L54) y conserva latches/OLR por tag. Editar un circuito mientras corre no reinicia el scan. Riesgo: latch de un tag borrado del programa queda en memoria (R2-3).

### Step 6: Solver de vista `electricalView.ts`

- **What**: Función pura `computeElectricalView({ components, wires, running, tagValues, engineTrace })` que devuelve `{ componentVoltageById, energizedComponentIds, energizedNodeIds, fault, energizedWireIds, energizedWireCurrentById, idleWireCurrentById }` (el `ElectricalState` sin campos de tag). Lógica de flujo y cortocircuito: copia de `computeElectricalState` L3668-3840 sin las líneas 3693-3700 (resolve) y sin pasar `resolvedTagValues`.
  - Conducción de contactos: `getDeviceContactState` para dispositivos (lee el tag de dispositivo); `tagValues[tag]` para XIC/XIO; `engineTrace` step `contactClosed` para NOTC/NCTO (si no hay trace, cerrado = false).
  - Bobinas y cargas: terminales, no conducen; energizada = `tagValues[tag]` (el visual del coil es el tag del motor).
- **Where**: `ui/src/solver/electricalView.ts`.
- **Why**: Mantiene flujo y cortocircuito (`fault`) visibles; cero escritura de tags (acceptance de fase 2).
- **Considerations**: Con `running=false` el flujo es vacío (como hoy, L3689). Pequeña divergencia visible esperada: el flujo es combinacional sobre el estado del scan anterior; la bobina muestra el tag del scan (OD2-5).

### Step 7: Paridad (harness y goldens) — **bloqueante**

- **What**:
  - `ui/src/parity/scene.ts`: helpers para construir `components`/`wires` (terminales vía `getTerminalPoint`, cable de dos puntos ortogonal).
  - `ui/src/parity/harness.ts`:
    - Legacy: por scan `s`, `legacy = computeLegacy({components, wires, tagValues: committed[s-1], prevResolved, prevTimers, elapsedMs, actuationDelayMs: 0})` → `resolvedTagValues`; `prevResolved = resolved`.
    - Engine: `EngineSession` con `applyProgram(compileDiagram(...).program)`, `setDeviceInputs(deviceInputs(s))`, `tick(elapsedMs)`, leer `getTag`.
    - Compara tags observados tras el scan `s`.
  - `ui/src/parity/fixtures/*.json`: `{ id, description, components, wires, scans: [{ elapsedMs, devices, inputs }], observe: string[], reference: "legacy" | "engine-spec", divergence?: "R-FB"|"R-GATE" }`.
  - Fixtures mínimas (diagramas): F01 XIC→OTE; F02 serie; F03 paralelo a bobina (R-OR: debe **pasar** tras compilar); F04 seal-in con paro (PB NO start ∥ XIC coil → PB NC stop → OTE); F05 NOTC con rama sin energía (R-GATE, motor manda); F06 OTL+OTE mismo tag; F07 OTU; F08 cortocircuito (fault en vista, sin renglón); F09 retorno con contacto (R-RET: debe pasar); F10 T-junction (R-JCT: debe pasar); F11 lámpara como carga (OTE de dispositivo).
  - Fixtures de **motor** (sin diagrama, JSON `Program`): E-stop, sobrecarga, TON/TOF, `SYS:RESET`. Referencia: spec de fase 1 (`reference: "engine-spec"`). Ver OD2-2.
  - Round-trip `data/` + `sample-programs/`: `programToScene(program)` (helper de test: una fila por renglón, contactos en serie, bobina al final, **retorno a L2** — `buildSceneFromProgram` L3263 no tiene retorno, no sirve tal cual) → `compileDiagram` → motor; debe igualar al motor directo `Program` scan a scan (igualdad exacta).
  - Goldens: `ui/src/parity/goldens/<id>.json` con valores por scan y `reference` aprobado. Se generan **antes** de Step 9.
  - `ui/src/parity/parity.spec.ts`: (a) round-trip exacto; (b) para cada fixture de diagrama: engine == golden; legacy == engine salvo `divergence` declarada; (c) legacy con `actuationDelayMs: 250` reproduce la divergencia D4 (test documental).
  - Informe: tabla fixture × scan × tag (`pass` / `diverge:<clase>`) en `implementation/phase-2-parity.md` (generado a mano desde la salida del test).
- **Where**: `ui/src/parity/*`.
- **Why**: Acceptance de fase 2: igualdad exacta antes de retirar el solver; cada diferencia documentada como bug del legacy.
- **Considerations**: Comparar **post-scan** del motor con `resolvedTagValues` del legacy de ese mismo scan. Las clases de divergencia esperadas son: R-FB (el legacy resuelve OTE→contacto en el mismo scan; el motor usa el valor del scan anterior, test de fase 1 L183 "OTE writes do not affect logic mid-scan"; gana el motor; el demo `output-deferral-demo` lo ejercita), R-GATE (legacy temporiza sin energía de renglón; bug 3), D4 (250 ms). R-OR, R-RET, R-JCT son bugs del compilador viejo: deben pasar.

### Step 8: Retirada en `DiagramBuilder.tsx` (tras paridad verde y con `TAG_SOURCE="engine"`)

Símbolos a **eliminar** (L = línea actual, verificada):

- L245 `TIMED_CONTACT_ACTUATION_DELAY_MS` (D4).
- L144-149 `TimedContactRuntimeState`, `TimedContactStateByComponentId`.
- L166 `resolvedTagValues`, L169 `timedContactStateByComponentId` en `ElectricalState` (L158-170).
- L572-582 `isBreakerClosed`, `isMaintainedSwitchClosed`, `isMomentaryPushButtonPressed` → reemplazados por `getDeviceContactState` (uso en L3906, L3914, L6203, L6321, L6664-6666, L6814-6815: cambiar a la función nueva).
- L591-615 `isContactClosed` → sustituido por `conductionStateOf` del visual (XIC/XIO por tag; NOTC/NCTO por trace).
- L630-697 `previewTimedContactState`, `collectTimedContactRuntimeStates`.
- L699-740 `getConductiveTerminalPairs`: pasa a `diagram/terminals.ts` (sin parámetros de tag).
- L822-913 `resolvePhysicalInstructionTagValues`.
- L3491-3511 `buildResolvedPortGraph`; L3554-3621 `collectRungPaths`; L3623-3666 `deriveProgram` (→ `compileDiagram`; call sites L4305, L4624, L5492-5523).
- L3668-3840 `computeElectricalState` (→ `computeElectricalView`).
- L4002-4004 refs `resolvedPhysicalTagValuesRef`, `timedContactStateByComponentIdRef`, `lastElectricalTickRef`; L4288 y L4859-4870 sus efectos; L4620 `electricalElapsedMs`.
- Visual: `getTimedContactTimerDisplay` L514-548 se conserva pero lee `engineTrace` (`timerElapsedMs`, `delayMs`, `powerBefore`) en lugar de `timedContactStateByComponentId`; sin el término de 250 ms (L536-537).

Símbolos que **se conservan**: `getTimedContactDelayMs` L488, `clampTimedContactDelayMs`, `DEFAULT_TIMED_CONTACT_DELAY_MS`, `buildElectricalNodeGraph` (→ `diagram/`), `collectReachableNodesWithParents`, `collectCurrentFlowPathNodeIds`, `getComponentSuppliedTerminalNodeIds`, `getSourceTraversalTerminalIds`, `renderSymbolGraphic`, `MAINTAINED_SWITCH_CLICK_DELAY_MS` (L244; retardo de 220 ms de clic de interruptor: es latencia de UI, no de tag; se conserva y se documenta).

Props nuevas: `compiled: CompileResult` (program/tags/diagnostics), `engineTrace?: ScanTrace`, `onDeviceInputsChange?: (inputs: Record<string, boolean>) => void` (efecto cuando cambia el estado de dispositivo; no dispara `onProgramChange`).

- **Where**: `ui/src/DiagramBuilder.tsx`.
- **Why**: D1: el solver deja de decidir tags; el estado de timers es del motor.
- **Considerations**: `hasCustomLayout` (L4872-4888) sigue gobernando la emisión del programa. Las pills `resolvedWires`/`unresolvedWires` (L4827-4828) se alimentan de `compiled.diagnostics`.

### Step 9: Borrado del legacy y de la bandera

- **What**: Tras paridad verde y aprobación del usuario: borrar `ui/src/solver/legacyTagSolver.ts`, `ui/src/config/tagSource.ts`, rama `legacy-solver`. Los goldens permanecen como regresión.
- **Where**: los archivos indicados.
- **Why**: "Retirada" del solver como fuente de tags (phase DoD).
- **Considerations**: No borrar hasta que los goldens existan y estén commiteados o copiados fuera del repo (ver Rollback).

### Step 10: Docs y verificación final

- **What**: `docs/README.md`: nota de intención a "motor único de tags; UI con compilador cableado→programa y solver de vista que lee tags". `docs/analysis-ladder-rendering-and-logic.md`: marcar §4 bugs 1, 2, 3, 5, 6 y §5 solver como superados (con referencia a `compileDiagram`, `EngineSession`). Inventario `docs/modules/` (update-docs) para `diagram/`, `compiler/`, `solver/`, `runtime/`, `parity/`.
- **Where**: `docs/`.
- **Why**: DoD de fase 2 y de plan.

## Testing Plan

**Verify command (único, primario):** `pnpm -r test` (raíz) → ejecuta `plc-engine` (vitest) y `ui` (vitest, nuevo).

Gates secundarios:
- `cd ui && npx tsc --noEmit` → igual o menor que la línea base de Step 0 (objetivo: 0 errores en los archivos tocados).
- `cd plc-engine && npx tsc -p tsconfig.json --noEmit`.
- `pnpm -r build`.

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| plc-engine unit | `TraceStep.contactClosed` NOTC/NCTO (Step 1) | Pasa; los 31 tests de fase 1 siguen verdes. |
| compiler unit `ui/src/compiler/compileDiagram.spec.ts` | serie, paralelo (2 renglones), retorno con contacto, T-junction, loop corto sin renglón, lámpara como OTE, tag nulo sin renglón, dedupe, `too-many-paths` | Renglones y tags exactos; determinismo (dos ejecuciones = mismo JSON). |
| deviceMapping unit | `getDeviceContactState` NO/NC/switch/breaker; tabla de tipos | Coincide con la tabla de Step 4. |
| engineSession unit `runtime/engineSession.spec.ts` | `applyProgram` conserva latch por nombre; `stop` deja latch y apaga OTE; `setDeviceInputs` antes del scan; sin scan al cargar | Bug 6 cubierto sin React. |
| parity round-trip | `data/` y `sample-programs/` vía `programToScene` | Igualdad exacta scan a scan (motor directo vs compilado). |
| parity diagram | F01-F11 vs goldens y legacy (con divergencias declaradas) | Motor == golden en todos; legacy == motor salvo R-FB/R-GATE/D4 declaradas; R-OR/R-RET/R-JCT pasan. |
| vista unit `solver/electricalView.spec.ts` | flujo con contacto cerrado/abierto; `fault` en F08; no escribe tags (la función no recibe setter) | Pasa. |
| static | `grep -rn "resolvePhysicalInstructionTagValues\|computeElectricalState\|deriveProgram\|TIMED_CONTACT_ACTUATION_DELAY_MS" ui/src plc-engine/src` tras Step 9 | 0 coincidencias. |
| static | `grep -rn "setInput\|commitWrites\|writeCommitted" ui/src` | Solo `runtime/engineSession.ts`. |

Manual (no bloqueante en esta fase, E2E en fase 5/6): arrancar `pnpm dev`, construir F03 y F04 a mano, verificar que el sello se mantiene y que editar un cable no reinicia el latch.

### Test Integrity Constraints

- Los 31 tests de `plc-engine` (7 base + 24 de fase 1) **no se modifican** en esta fase. Solo se añaden casos (Step 1).
- Ningún test de `ui` existente (no hay ninguno, `test: "echo 'no tests'"`). Los nuevos no dependen de snapshots visuales (plan Testing Strategy).
- Las fixtures de paridad se generan del motor de fase 1 y del legacy **antes** de borrar código; un golden que cambie después exige justificación en el changelog del plan.
- Divergencias legacy-vs-motor: se declaran en la fixture (`divergence`) y no se "arreglan" en el test.

## Rollback Strategy

- **Checkpoint**: el árbol tiene cambios sin commit (fase 1 + ~48 archivos por CRLF, R-D). Antes de Step 2, copiar `ui/src`, `plc-engine/src`, `ladder-types/src` a una carpeta fuera del repo (p. ej. `C:\Users\Johan\AppData\Local\Temp\opencode\phase2-base\`) o, si el usuario lo aprueba, commitear la fase 1 como checkpoint. Sin commit explícito del usuario no se commitea.
- **Flag**: `TAG_SOURCE = "legacy-solver"` restaura el solver como escritor de tags de display (sin tocar `EngineSession`, que es independiente). Probar que el flag funciona antes de Step 8.
- **Por paso**: Steps 1, 2, 3, 4 son aditivos (el legacy sigue activo). Step 5 se revierte devolviendo `buildEngine`. Step 8 se revierte con el flag o con la copia de Step 0.
- **Goldens**: se guardan en `ui/src/parity/goldens/`; si Step 9 falla, restaurar desde el checkpoint.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| **OD2-1** Checkpoint de rollback | (a) commit de fase 1 como punto de referencia; (b) copia de carpetas fuera del repo + flag | **(b) por defecto; (a) si el usuario lo aprueba** | Commitear es acción externa; el árbol está sucio por CRLF (R-D). |
| **OD2-2** Fixtures de E-stop, sobrecarga, TON/TOF y reset en fase 2 | (a) sólo motor (Program JSON, spec fase 1); (b) dibujar símbolos ya en fase 2 | **(a)** | La lista mínima de `phase-2.md` las incluye, pero no hay símbolo hasta fase 3 y el solver no las modela. Confirmar. |
| **OD2-3** Nombre de tag de dispositivo | (a) por id (`__builder_device__:<id>`); (b) por label como instrucciones | **(a)** | Evita aliasing entre lámparas/PB con el mismo label. Instrucciones mantienen label-binding (sin cambio). |
| **OD2-4** Conducción y retorno | (a) bidireccional + contactos de retorno trasladados delante de la bobina; (b) direccional como hoy | **(a)** | Igual al solver; corrige contactos de retorno ignorados y T-junctions. Cambia renglones existentes en circuitos con retorno. |
| **OD2-5** Feedback de 1 scan y visual | (a) bobina visual = tag del motor (post-scan), flujo = física sobre contactos del scan anterior; (b) mantener combinacional en la vista | **(a)** | D1 y R-FB: una sola fuente. El feedback de 1 scan desaparece (phase-2 Notes); confirmar que el usuario lo acepta. |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `plc-engine/src/programRunner.ts` | `load` L52, `executeScan` L104-149, `resolveCoilWrites` L151, `applyReset` L167, `stop` L99, `advanceTimedContact` L362 | Semántica que el compilador debe respetar (OR, E-stop, timers). |
| `plc-engine/src/index.ts` | `loadProgram` L13-16, `stop` L28-31, `reset` L22-26 | Memoria de instancia: tags sobreviven a `loadProgram`. |
| `plc-engine/src/types.ts` | `TraceStep` | Sitio del campo aditivo `contactClosed`. |
| `ui/src/App.tsx` | L28-42 `buildEngine` (scan en L39), L47 `useState(() => new PlcEngine())`, L69-80 loop, L82-106 `handleBuilderProgramChange`, L153-177 `handleRunToggle` | Recreación del motor: bug 6. |
| `ui/src/DiagramBuilder.tsx` | L3491 `buildResolvedPortGraph`, L3513 `buildElectricalNodeGraph`, L3554 `collectRungPaths`, L3623 `deriveProgram`, L3668 `computeElectricalState`, L822 `resolvePhysicalInstructionTagValues`, L699 `getConductiveTerminalPairs`, L572-615 contactos | Solver y compilador actuales. |
| `ui/src/DiagramBuilder.tsx` | L4625-4633 llamada del solver, L4867-4870 feedback, L4887 `onProgramChange` | Puntos de conexión. |
| `ui/src/DiagramBuilder.tsx` | L1026 `mergeInstructionBindingTags`, L1004 `syncInstructionComponentTag` | Label-binding de tags de instrucción (se conserva). |
| `ui/src/DiagramBuilder.tsx` | L3263 `buildSceneFromProgram` | Program→escena sin retorno: no usable para paridad tal cual. |
| `ui/src/DiagramBuilder.tsx` | L5847-5878 switch/PB, L5835-5843 `scheduleMaintainedSwitchToggle` | Origen de `isClosed`/`isPressed`; retardo de clic de 220 ms. |
| `ui/src/projectData.ts` | L7 `instructionTypes`, L203 `parseProgram` | Sin cambio en fase 2. |
| `plc-engine/test/engine.spec.ts` | L183 "OTE writes do not affect logic mid-scan" | Define R-FB a favor del motor. |

Verificado: `cd plc-engine && npx vitest run` → **31/31** (6 archivos). `cd ui && npx tsc --noEmit` → **exit 2** (≈30 errores, ver Step 0).

### Mismatches / Notes

- **Fase 2 de `phase-2.md` dice "el solver ya no decide tags", pero hoy el solver sí decide los valores que se muestran**: `resolvePhysicalInstructionTagValues` (L822) sobrescribe OTE puros; App nunca los devuelve al motor (`onProgramChange` solo envía program+tags, L4887). El motor no ve dispositivos (sin instrucción) y sus OTE puros valen true siempre (analysis bug 2). Decisión: el motor pasa a ser la única fuente; el visual lee tags.
- **Ningún snapshot v1 en el repo.** `grep '"components"'` en `data/`, `sample-programs/` no encuentra nada; `data/` y `sample-programs/` son `Program` (sin posiciones). "Snapshots actuales" = a capturar: crear 2-3 desde la UI en Step 7 (se usan también en fase 4).
- **`data/` y `sample-programs/` no son diagramas**: la paridad es round-trip (`programToScene`) más legacy. El demo `output-deferral-demo` (`data/program-data/output-deferral-demo.program.json`: `XIC I:0/0→OTE O:0/0`; `XIC O:0/0→OTE B3:0/0`) activa R-FB: el solver muestra B3 en el mismo scan.
- **Divergencia de conexión actual**: `buildResolvedPortGraph` (puertos) no ve uniones en T que `buildElectricalNodeGraph` (puntos) sí conecta (R-JCT).
- **Retorno ignorado**: `collectRungPaths` solo sigue desde la fuente hacia la bobina (L3568-3590); contactos entre la bobina y L2 no cuentan (R-RET).
- **Retardo de 250 ms duplicado en UI**: L245 y usos en L536-537, L650-661 (no lo documentaba el análisis). Fase 1 no lo tocó.
- **`isBreakerClosed` (L572) siempre true**: se mantiene en fase 2 (`isClosed ?? true`); la apertura de breakers no tiene UI hasta fase 3/5.
- **Errores tsc preexistentes/introducidos**: ver Step 0. `ui` no tiene `test` real; `pnpm -r test` hoy solo corre `plc-engine`.
- **`MAINTAINED_SWITCH_CLICK_DELAY_MS` (220 ms)**: retardo de clic en `scheduleMaintainedSwitchToggle` (L5835-5843). No es retardo de tag; se conserva y se documenta.

### Risks (máx. 5)

- **R2-1 Explosión de caminos** en grafos con muchos cruces: límite de combinaciones + diagnóstico.
- **R2-2 Orden de escritura de dispositivos**: `setDeviceInputs` debe aplicarse antes de cada `tick` y al cambiar estando parado; si no, el visual va un scan detrás.
- **R2-3 Latch fantasma**: un OTL cuyo tag se borra del programa conserva su valor en memoria (no se borra en `load`). Si el usuario lo recrea con el mismo nombre, reaparece (consistente con D2, pero sorprendente). Mitigación: test y nota en docs; opcional: limpiar `latchByTag` en `load` (cambio menor de fase 1).
- **R2-4 Deuda de tipos**: tsc roto en `ui` oculta regresiones de tipos. Mitigación: Step 0 obligatorio.
- **R2-5 Cambio visible**: renglones de circuitos con retorno o T-junctions cambian (OD2-4) y el feedback de 1 scan desaparece (OD2-5). Mitigación: paridad y registro en changelog.
