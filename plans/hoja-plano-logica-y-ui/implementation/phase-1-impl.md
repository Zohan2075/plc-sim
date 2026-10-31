---
type: planning
entity: implementation-plan
plan: "hoja-plano-logica-y-ui"
phase: 1
status: draft  # draft | active | completed | revised
created: "2026-10-29"
updated: "2026-10-29"
---

# Implementation Plan: Phase 1 - Motor PLC: lógica de enclavamiento, paro y reset

> Implements [Phase 1](../phases/phase-1.md) of [hoja-plano-logica-y-ui](../plan.md). Engine-only: no changes under `ui/`, `server/`, `data/`, `sample-programs/`.

## Approach

Cambios confinados a `ladder-types/` y `plc-engine/`. Cuatro bloques:

1. **Dispositivos como contactos.** Pulsadores, paro, breakers e interruptores NO son instrucciones nuevas: son `XIC`/`XIO` sobre tags de entrada cuyo valor = **estado eléctrico del contacto** (`true` = contacto cerrado). Solo lo que necesita prioridad o memoria tiene instrucción propia: `ESTOP` (paro de emergencia), `OLR` (sobrecarga con disparo enclavado), `TON`/`TOF` (temporizadores de bloque).
2. **OR de ramas y prioridad de bobinas.** Las escrituras de `OTE`/`TON`/`TOF` al mismo tag dentro de un scan se combinan con OR. Las `OTL`/`OTU` del mismo tag siguen una regla fija que no depende del orden de renglones.
3. **Seguridad y reset.** E-stop fuerza todo a OFF; sobrecarga dispara y se rearma solo con reset explícito y condición normalizada; Reset (`SYS:RESET` o `reset()`) borra latches y enclavamientos; Stop (`stop()`) quita energía a las salidas no latcheadas y conserva latches.
4. **Temporizadores.** Cuentan solo con energía de renglón (ANSI). Preset en ms. Se elimina `TIMED_CONTACT_ACTUATION_DELAY_MS`.

### Semántica decidida (nota de decisiones de fase 1)

| Tema | Regla |
|------|-------|
| Pulsador NO/NC, paro, breaker, interruptor | `XIC` (o `XIO`) sobre tag de entrada. El tag es el contacto: `true` = cerrado. Un pulsador momentáneo = la UI pone `true` mientras está presionado. El motor no distingue momentáneo/mantenido. |
| E-stop | `ESTOP` con `tag` = contacto cerrado (`true` = sano). Ver regla de forzado abajo. |
| Sobrecarga | `OLR` con `tag` = contacto sano del relevador (`true` = sano). Dispara si `false`. |
| Reset | Tag reservado `SYS:RESET` (constante en `ladder-types`). Activo por **flanco de subida**. También `PlcEngine.reset()`. |
| OR de ramas | Todas las escrituras `OTE`/`TON`/`TOF` al mismo tag en un scan se combinan con OR. Dos renglones con la misma bobina = OR (ver Open Decisions OD-1). |
| Prioridad de bobina (por tag y scan) | 1) Forzado OFF (E-stop abierto) → false. 2) Algún `OTU` con energía → false. 3) Algún `OTL` con energía → true. 4) OR de `OTE`/`TON`/`TOF` → resultado. Sin energía en ningún `OTE`: false. Independiente del orden de renglones. |
| TON | Acumula solo si la energía del renglón (`powerBefore`) es true **y** la entrada es true. Sin energía: reset a 0. Q = acumulado ≥ preset. Escribe Q en su `tag` (como bobina) y propaga energía. |
| TOF | Q = true mientras hay energía. Al caer la energía, cuenta `delayMs` y Q = false al completar. Nunca energizado = Q false. |
| NOTC / NCTO | Se mantienen como contactos. Se elimina el retardo de 250 ms. Solo cuentan con energía de renglón. |
| E-stop abierto | Ningún renglón evalúa (trace con power false). Todas las bobinas = false, **incluidas OTL** (se borra el latch: al soltar el paro la máquina no rearranca sola). Timers borrados. OLR no se evalúa. |
| Sobrecarga | `OLR` mantiene `tripped` por tag: si sano=false → tripped=true. Rearme solo si flanco de `SYS:RESET` **y** sano=true. Sin energía en renglón, igual actualiza su estado. Salida = energía previa && !tripped. |
| Reset (`SYS:RESET` flanco o `reset()`) | Borra valores de tags OTL, timers y `tripped` de OLR sanos. `reset()` además pone en false las bobinas no latcheadas (igual que Stop). |
| Stop (`stop()`) | Pone en false las bobinas no latcheadas (OTE/OTU/TON/TOF sin OTL). Borra timers. **Conserva** tags OTL y `tripped` de OLR. |
| Edición / `loadProgram` | Conserva valores de tags (memoria de instancia) y `tripped` por nombre de tag. Borra acumuladores de timers (siguen por `instruction.id`). Un tag renombrado no hereda estado. |

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `ladder-types/src/index.ts` | modify | Nuevos tipos de instrucción y constante `SYSTEM_RESET_TAG`. Sin lógica. |
| `plc-engine/src/tagMemory.ts` | modify | Método para escribir valor committed (reset/stop). |
| `plc-engine/src/programRunner.ts` | modify | Índice del programa, resolución de bobinas, timers con gating, E-stop, OLR, reset/stop. |
| `plc-engine/src/index.ts` | modify | `PlcEngine.reset()`, `PlcEngine.stop()`. |
| `plc-engine/src/types.ts` | modify | `PlcEngineApi` gana `reset()` y `stop()`. |
| `plc-engine/test/engine.spec.ts` | modify | 6 aserciones de 3 casos (ver Test Integrity). |
| `plc-engine/test/*.spec.ts` (5 archivos nuevos) | create | Casos nuevos de OR, seguridad, timers, prioridad, persistencia. |

## Required Context

| File | Why |
|------|-----|
| `plc-engine/src/programRunner.ts` | Núcleo a modificar: `runScan` L30, `runScanWithTrace` L42, `evaluateInstruction` L102, `evaluateInstructionWithTrace` L144, `advanceTimedContact` L236. |
| `plc-engine/src/tagMemory.ts` | `setInput` L5 (también escribe `current`), `readDuringScan` L18 (prioriza input image), `commitWrites` L26. |
| `plc-engine/src/index.ts` | Fachada `PlcEngine`; memoria de instancia (L9) hace que los tags sobrevivan a `loadProgram` (L13). |
| `plc-engine/src/types.ts` | `TraceStep` (L3), `PlcEngineApi` (L26). |
| `ladder-types/src/index.ts` | Unión `InstructionType` (L2), `ImmediateInstruction` (L9), `TimedContactInstruction` (L13). |
| `plc-engine/test/engine.spec.ts` | 7 casos base; cuáles cambian (L56-132, L134-181). |
| `docs/analysis-ladder-rendering-and-logic.md` §4 | Bugs 1-7 que cubre esta fase. |

## Implementation Steps

### Step 1: Tipos en `ladder-types` (sin lógica)

- **What**: En `ladder-types/src/index.ts`:
  - `TimedContactInstructionType` sigue siendo `"NOTC" | "NCTO"`.
  - Nuevo `export type TimerInstructionType = "TON" | "TOF";`
  - Nuevo `export type SafetyInstructionType = "ESTOP" | "OLR";`
  - `InstructionType = "XIC" | "XIO" | TimedContactInstructionType | TimerInstructionType | SafetyInstructionType | "OTE" | "OTL" | "OTU"`.
  - `ImmediateInstruction.type` = `Exclude<InstructionType, TimedContactInstructionType | TimerInstructionType>` (ESTOP, OLR entran aquí: solo `tag`).
  - `TimedContactInstruction.type` = `TimedContactInstructionType | TimerInstructionType` (TON/TOF llevan `delayMs`). Se conserva el nombre de la interfaz; comentario que lo aclare.
  - `export const SYSTEM_RESET_TAG = "SYS:RESET";`
- **Where**: `ladder-types/src/index.ts` L1-L18.
- **Why**: Contrato compartido para engine (fase 1), parser (fase 3) y símbolos (fase 3).
- **Considerations**: Añadir miembros a `InstructionType` rompe los `switch` con `never` de `programRunner.ts` (L138, L227) hasta que se implementen los casos. `ui/src/DiagramBuilder.tsx` usa `InstructionType` en `BuilderComponentType` (L18); verificar con `pnpm -r build` que la UI sigue compilando (ver Testing Plan, gate secundario).

### Step 2: Escritura committed en `TagMemory`

- **What**: Añadir `writeCommitted(tag: string, value: boolean): void` que hace `this.current.set(tag, value)`. Sin cambiar `setInput`, `readDuringScan` ni `commitWrites`.
- **Where**: `plc-engine/src/tagMemory.ts` tras L30.
- **Why**: Reset/Stop necesitan modificar el valor committed sin pasar por el input image.
- **Considerations**: No tocar `inputs`. Un tag que es input (`setInput`) sigue leyéndose desde el input image; documentar que los tags de bobina no deben ser también entradas.

### Step 3: Núcleo del motor en `ProgramRunner`

- **What**:
  1. **Índice en `load()`** (L25-28): calcular una vez: `coilTags` (destino de OTE/OTL/OTU/TON/TOF), `latchedTags` (destino de OTL), `timerIds`, `estopTags`, `olrTags`. Mantener `timedContactStateByInstructionId.clear()` (L27). No borrar `olrTripped` (persiste por tag).
  2. **Estado nuevo**: `olrTrippedByTag: Map<string, boolean>` (persiste entre `load`); `previousResetInput: boolean` (flanco).
  3. **`runScan` (L30) / `runScanWithTrace` (L42)** pasan a este orden: (a) leer `resetRising = input(SYS:RESET) && !previousResetInput`; actualizar `previousResetInput`. (b) si `resetRising`: `applyReset(memory, false)` (borra latches, timers, OLR sanos). (c) si algún `estopTags` está en false en el input image → modo **forzado**. (d) evaluar renglones; en forzado, cada renglón se traza con power false sin leer ni escribir y se borran timers. (e) `resolveCoilWrites`: construir `pendingWrites` a partir de acumuladores por tag (`ote`, `otl`, `otu`, `timerQ`). (f) en forzado, todo `coilTags` = false y `latchedTags` también; commit.
  4. **Bobinas (L125-136 y L193-224)**: `OTE`, `TON`, `TOF` y `OTL`/`OTU` aportan a acumuladores por tag en lugar de `pendingWrites.set` (last-writer-wins, L126). Resolución: `otu` con energía → false; si no, `otl` con energía → true; si no, `ote || timerQ`. Coil sin ningún aporte energizado → false.
  5. **Timers (L119-124, L175-180; `advanceTimedContact` L236-277)**: NOTC/NCTO solo avanzan con `powerBefore && input`; con `powerBefore` false se borra su estado (`timedContactStateByInstructionId.delete`). Quitar `actuationElapsedMs` (interfaz L10-13, constante L15, uso L255-264). `contactClosed` igual que hoy. TON/TOF nuevos (ver semántica): estado `{ accumulatedMs, timing }` por `instruction.id`; `Q` como en la tabla; `delayMs` normalizado con `normalizeDelayMs` L279.
  6. **ESTOP** (`evaluateInstruction`): `powerBefore && readDuringScan(tag)`. Su prioridad viene del índice (no depende de su posición en el renglón).
  7. **OLR** (`evaluateInstruction`): `healthy = read(tag)`; si `!healthy` → `olrTripped.set(tag, true)`; `powerAfter = powerBefore && !tripped`. Se evalúa aunque `powerBefore` sea false, salvo en modo forzado.
  8. **Métodos públicos nuevos**: `reset(memory)` = `applyReset(memory, true)`; `stop(memory)` = de-energizar `coilTags` no latcheados, borrar timers. `applyReset(memory, dropNonLatched)`: `writeCommitted(t,false)` para `latchedTags`; borrar timers; para cada `olrTags` con sano=true → `tripped=false`; si `dropNonLatched`, aplicar `stop`.
  9. **Eliminar** `TIMED_CONTACT_ACTUATION_DELAY_MS` (L15) y `isTimedContactInstruction` (L17, no usada: se quita).
- **Where**: `plc-engine/src/programRunner.ts` (L1-286 completo en la práctica; puntos listados arriba).
- **Why**: Cierra analysis §4 bugs 1 (OR), 3 (timers sin gating), 4 (OTE vs OTL), 7 (E-stop/sobrecarga), y el retardo oculto de D4.
- **Considerations**: Mantener `TraceStep` (`pendingWrite`, `timerDone`, `timerElapsedMs`, `delayMs`) para que el trace siga válido. En modo forzado, `TraceStep` con `powerBefore/powerAfter` false. El orden (a)-(f) es parte del contrato: documentarlo en comentario de `runScan`.

### Step 4: API de `PlcEngine`

- **What**:
  - `reset(): void` → `runner.reset(memory)`; `lastTrace = undefined`.
  - `stop(): void` → `runner.stop(memory)`; no escanea.
  - `loadProgram` (L13-15) **sin cambio de lógica**: los tags ya persisten (memoria de instancia). Añadir comentario que lo documente.
- **Where**: `plc-engine/src/index.ts` L13-39.
- **Why**: D2 (Stop, Reset explícitos). La persistencia por edición ya existe en el motor; lo que la rompe es que la UI recrea el engine (ver Reality Check).
- **Considerations**: `stop()` no detiene el reloj; el caller deja de llamar `scan`. `scan` tras `stop` reanuda sin reset.

### Step 5: Tipos de API en `plc-engine/src/types.ts`

- **What**: `PlcEngineApi` añade `reset(): void; stop(): void;`. Sin cambio en `TraceStep`.
- **Where**: `plc-engine/src/types.ts` L26-32.
- **Why**: Mantener la interfaz pública alineada con `PlcEngine`.
- **Considerations**: Ninguna otra implementación de `PlcEngineApi` en el repo (verificar con grep antes de cerrar).

### Step 6: Tests

- **What**: Ver tabla de Testing Plan. Actualizar 6 aserciones en `engine.spec.ts` con justificación. Crear 5 archivos nuevos.
- **Where**: `plc-engine/test/engine.spec.ts` L56-181; `plc-engine/test/{parallel-or,safety,timers,coil-priority,persistence}.spec.ts`.
- **Why**: DoD de fase 1 y R-C.
- **Considerations**: No tocar los otros 4 casos base (XIC/OTE L6, XIO L31, OTE deferral L183, OTL/OTU L222).

## Testing Plan

**Verify command (único):** `cd plc-engine && npx vitest run`
**Gate secundario (aceptación):** `cd plc-engine && npx tsc -p tsconfig.json --noEmit`; `pnpm -r build` en raíz (verifica que el union ampliado no rompe `ui`).

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| Unit (vitest) `parallel-or.spec.ts` | 2 renglones `XIC A → OTE C` y `XIC B → OTE C`: solo A → C true; solo B → C true; ninguno → false. | Sin last-writer-wins. |
| Unit `parallel-or.spec.ts` | Orden inverso (B primero, A después): A cae y B sigue true en el mismo scan → C true. | Mismo resultado con orden inverso. |
| Unit `safety.spec.ts` | `ESTOP` cerrado + `XIC start → OTE M`; `ESTOP` abierto → M false en el mismo scan, aunque start = true. | E-stop prioritario. |
| Unit `safety.spec.ts` | Latch `OTL M` activo + ESTOP abierto → M false; al cerrar ESTOP sin start → M false. | Latch borrado por paro. |
| Unit `safety.spec.ts` | Timer NOTC activo + ESTOP abierto → al cerrar, el timer empieza de cero. | E-stop resetea timers. |
| Unit `safety.spec.ts` | `ESTOP` colocado al final del renglón (después de la bobina) tiene el mismo efecto. | Posición irrelevante. |
| Unit `safety.spec.ts` | `OLR` sano → pasa energía; tag false → `powerAfter` false y bobina off en el mismo scan. | Disparo. |
| Unit `safety.spec.ts` | Disparo; el tag vuelve a true sin reset → sigue disparado. | Enclavado. |
| Unit `safety.spec.ts` | Flanco de `SYS:RESET` con sobrecarga aún abierta → no rearma; luego sano + flanco → rearma; reset mantenido sin flanco nuevo → no repite. | Rearme explícito y normalizado. |
| Unit `safety.spec.ts` | `stop()` no borra `tripped`; `reset()` sí (si sano). | Stop vs Reset sobre enclavamiento. |
| Unit `timers.spec.ts` | `NOTC 300ms` con contacto I0 true y renglón sin energía (`XIC I1` false) durante 1000 ms → no avanza; con I1 true 300 ms → cierra. | Gating por renglón. |
| Unit `timers.spec.ts` | `NOTC delayMs 100`, I0 true, `scan(100)` → cierra en el primer scan. | Sin retardo oculto de 250 ms. |
| Unit `timers.spec.ts` | `TON 500ms` con energía: Q false en 400 ms, true en 500 ms; Q escrito en su tag. Sin energía: acumulado a 0. | Preset en ms, Q como bobina. |
| Unit `timers.spec.ts` | `TOF 300ms`: energía → Q true; caída: Q true hasta 300 ms acumulados y luego false; re-energía reinicia. Nunca energizado → Q false. | TOF ANSI. |
| Unit `coil-priority.spec.ts` | `OTL M` activo + `OTE M` en otro renglón con false → M true. | OTL > OTE. |
| Unit `coil-priority.spec.ts` | `OTL M` + `OTU M` activos → M false (en ambos órdenes de renglón). | OTU > OTL, independiente del orden. |
| Unit `coil-priority.spec.ts` | `OTE M` true + `OTU M` activo → M false. | OTU > OTE. |
| Unit `persistence.spec.ts` | `stop()` tras latch: OTL conserva true; OTE a false; `scan` posterior → latch sigue true. | Stop conserva latches. |
| Unit `persistence.spec.ts` | `reset()` borra latch y timers; `setInput(SYS:RESET,true)` + `scan` borra latch en ese scan; mantener true en el siguiente scan no repite. | Reset por entrada. |
| Unit `persistence.spec.ts` | Mismo `PlcEngine`, `loadProgram` con mismo tag → conserva latch; con tag renombrado → false. | Edición por nombre de tag. |
| Unit `engine.spec.ts` (regresión) | 4 casos sin cambio (XIC/OTE, XIO, OTE deferral, OTL/OTU) siguen verdes. Los 3 casos con cambio: ver Test Integrity. | Sin regresión. |
| Static | `grep -r TIMED_CONTACT_ACTUATION_DELAY_MS plc-engine/src ladder-types/src` → 0 resultados. | Retardo eliminado en el motor. |

### Test Integrity Constraints

Casos existentes afectados (6 aserciones; nada eliminado ni debilitado):

- `NOTC closes only after its preset...` (`engine.spec.ts` L56-91): **L80** (`expect false` tras 3er scan de 100 ms, acumulado 300) → **true**; **L83** (`expect false` tras scan 200, acumulado 500) → **true**. Motivo: D4, el preset de 300 ms se cumple en el 3er scan, sin 250 ms extra. L86 (true tras scan 50) y L90 (false al soltar) no cambian.
- `NCTO stays closed while timing...` (L93-132): **L121** (`expect true` tras 3er scan, acumulado 300) → **false**; **L124** (`expect true` tras scan 200, acumulado 500) → **false**. Motivo: D4. L127 y L131 no cambian.
- `timed contacts with the same label keep independent presets` (L134-181): **L171** (`O:0/0` false tras 2º scan de 250 ms) → **true** (fast NOTC 100 ms cumplido en scan 2, sin retardo). **L176** (`O:0/1` false tras scan 100, acumulado 350) → **true** (slow NOTC 300 ms cumplido en scan 3). Motivo: D4. Documentar ambos cambios en changelog del plan al cerrar la fase.
- `XIC + OTE`, `XIO`, `OTE writes do not affect logic mid-scan`, `OTL latches and OTU unlatches`: **sin cambio** (un solo aporte por tag; sin OR ni conflicto de prioridad). Verificado por análisis manual del código.

## Rollback Strategy

- Cambios limitados a `ladder-types/src/index.ts`, `plc-engine/src/{tagMemory,programRunner,index,types}.ts` y `plc-engine/test/`. Ningún archivo de `ui/` cambia en esta fase: el rollback es `git checkout -- ladder-types plc-engine` (tras normalizar CRLF, ver R-D; si no, revertir por archivo).
- Antes de implementar: anotar el commit base y ejecutar `npx vitest run` (baseline 7/7) para poder comparar.
- Si un caso nuevo revela regresión no prevista, revertir Step 3 y mantener Steps 1-2 (tipos aditivos).

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| **OD-1** OR de renglones con la misma bobina | (a) OR en el motor de todas las escrituras OTE/TON/TOF al mismo tag; (b) nueva estructura de rama en `Rung` (`branches`); (c) mantener last-writer-wins y que la UI fusione renglones | **(a)** | `Rung` es lineal y `collectRungPaths` (`ui/src/DiagramBuilder.tsx` L3554) ya emite un renglón por rama; (a) cierra bug 1 sin tocar UI. Cambia la semántica de "dos renglones a la misma bobina" (vendors: last-wins). Requiere **D9** registrado en el Decision Log. |
| **OD-2** E-stop y latches | (a) E-stop borra latches OTL; (b) E-stop solo fuerza salidas, latch se conserva | **(a)** | Con (b) la máquina rearranca sola al soltar el paro. D2 deja Reset como único borrado de latches; E-stop es estado seguro. Confirmar. |
| **OD-3** Stop de-energiza bobinas no latcheadas | (a) sí; (b) no (salidas mantienen último valor) | **(a)** | Sin esto, un motor OTE sigue con piloto encendido al detener. Confirmar con D2 ("Stop conserva tags latcheados"). |
| **OD-4** Reset por flanco y tag reservado | (a) `SYS:RESET` por flanco; (b) nivel; (c) tag definido por Program | **(a)** | Pulsador momentáneo; evita repetir clear mientras se mantiene. Tag reservado evita tocar `ProjectBundle` en fase 1. Confirmar nombre `SYS:RESET`. |
| **OD-5** Valores iniciales de dispositivos | Motor default false; NC/breakers/paro/sano de OLR deben iniciar en `true` | Se documenta; UI lo fija en fase 3 (`initialValue`/`inputValues`) | Sin esto, E-stop y OLR arrancan disparados (seguro, pero sin marcha). Confirmar. |

**Nuevo registro requerido**: D9 (OR de bobinas y prioridad OTU > OTL > OTE) en `plan.md` Decision Log, con changelog. Lo escribe el primario; esta fase no edita `plan.md`.

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `plc-engine/src/programRunner.ts` | L15 `TIMED_CONTACT_ACTUATION_DELAY_MS = 250` | Retardo oculto a eliminar (D4). Verificado. |
| same | L17 `isTimedContactInstruction` | Sin uso (verificado con grep). Se elimina. |
| same | L25-28 `load` | Limpia timers; sitio para índice. |
| same | L30 `runScan`, L42 `runScanWithTrace` | Punto de inserción de reset/forzado/resolución. |
| same | L102 `evaluateInstruction`, L144 `...WithTrace` | Bobinas L125-136 / L193-224; timers L119-124 / L175-180. |
| same | L126 `pendingWrites.set` | Origen del last-writer-wins (OR). Verificado. |
| same | L236 `advanceTimedContact` | Reescritura con gating. |
| `plc-engine/src/tagMemory.ts` | L5 `setInput` (escribe `current` también), L18 `readDuringScan`, L26 `commitWrites` | Sin cambios salvo `writeCommitted`. |
| `plc-engine/src/index.ts` | L9 memoria de instancia, L13 `loadProgram`, L17 `setInput`, L36 `getTag` | Tags ya sobreviven a `loadProgram`. |
| `plc-engine/src/types.ts` | L3 `TraceStep`, L26 `PlcEngineApi` | Añadir `reset`/`stop`. |
| `ladder-types/src/index.ts` | L1-2 tipos de instrucción, L9-18 interfaces | Tipos a ampliar. |
| `plc-engine/test/engine.spec.ts` | 7 casos (L6, L31, L56, L93, L134, L183, L222) | Casos base; 3 cambian (6 aserciones). |
| `ui/src/projectData.ts` | L7 `instructionTypes`, L203 `parseProgram` | Rechaza tipos nuevos hasta fase 3 (esperado; no se edita). |
| `ui/src/DiagramBuilder.tsx` | L18 `BuilderComponentType`, L245 const duplicada, L3554 `collectRungPaths` | Consumidor de `InstructionType`; ver mismatches. |
| `ui/src/App.tsx` | L28 `buildEngine`, L29 `new PlcEngine()`, L35 `setInput`, L47 `useState`, L58/L99/L166/L173 recreaciones | Recrea el motor en cada edición (pérdida de estado). Fase 2/5. |

Baseline ejecutado (2026-10-29): `cd plc-engine && npx vitest run` → **7/7 passed** (1.58 s). `npx tsc -p tsconfig.json --noEmit` → **exit 0**.

### Mismatches / Notes

- **Analysis §4 bug 6 (estado descartado) está localizado en UI, no en el motor.** `PlcEngine` ya conserva memoria entre `loadProgram`; lo que se pierde es la instancia (App L29, recreada en L58/L99/L166/L173). Acción de fase 2/5: `loadProgram` en lugar de `new PlcEngine()`. Aquí solo se añade `reset()`/`stop()`.
- **Duplicado no documentado en el análisis:** `ui/src/DiagramBuilder.tsx` L245 mantiene `TIMED_CONTACT_ACTUATION_DELAY_MS = 250` y lo usa en el solver (L536-537, L650-661). Hasta fase 2 el solver visual y el motor diferirán en timers. Fase 1 no lo toca (engine-only); registrar como riesgo transitorio.
- **Analysis §3 `isBreakerClosed` (L572)**: confirmado que siempre devuelve true para breakers; sigue así hasta fase 2/3 (la UI no lee el motor para breakers).
- **Analysis §2 citas de UI**: `collectRungPaths` L3554 y `DiagramBuilder` L3932 verificados.
- **`TimedContactInstruction` (ladder-types L13) se usa como tipo de TON/TOF**: el nombre queda engañoso; se conserva para no romper imports. Aceptar o renombrar (decisión menor, no OD).
- **Riesgo de compilación de UI**: añadir miembros a `InstructionType` puede romper `tsc` en `ui/` si hay mapas `Record<BuilderComponentType,...>` exhaustivos. No encontrado con grep (`: never` solo en plc-engine). Verificar con `pnpm -r build`.
- **R-D (CRLF)**: prerequisito de fase 1 sigue abierto; `git status` muestra 48 archivos modificados por EOL. Normalizar antes de implementar para que el diff sea legible.
- `phases/phase-1.md` cita `todo.md` para la lista de casos; no se leyó en esta pasada (fuera de los inputs). Cualquier caso de `todo.md` no listado arriba debe añadirse.
