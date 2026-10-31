---
type: planning
entity: implementation-plan
plan: "hoja-plano-logica-y-ui"
phase: 3
status: draft  # draft | active | completed | revised
created: "2026-10-29"
updated: "2026-10-29"
---

# Implementation Plan: Phase 3 - Símbolos ANSI/NEMA

> Implements [Phase 3](../phases/phase-3.md) of [hoja-plano-logica-y-ui](../plan.md). Aplica D7 (ANSI/NEMA sobre el set actual, IDs existentes intactos), D6 (textos de UI en español), D9-D13 (semántica del motor de fase 1) y el modelo de compilador de fase 2 (`implementation/phase-2-impl.md`). Verificado contra el árbol de trabajo actual (2026-10-29), no contra el plan de fase 2.

## Approach

1. **Gate y línea base.** Antes de tocar símbolos: (a) capturar markup SVG de los 14 tipos existentes (snapshot baseline); (b) `tsc --noEmit` en `ui` limpio (verificado: 0 errores hoy).
2. **Mover, no reescribir.** `renderSymbolGraphic` (hoy en `DiagramBuilder.tsx` L420-715), `getInstructionSymbol` (L253-292) y la paleta (L55-73) pasan a módulos sin React de estado: `ui/src/diagram/symbols.tsx` y `ui/src/diagram/palette.ts`. Refactor puro; el baseline debe seguir idéntico.
3. **Una sola tabla de geometría.** `ui/src/diagram/symbolGeometry.ts`: por tipo, viewBox (alto) y coordenadas crudas de bornes. La consumen `getTerminalDefinitions` (`diagram/terminals.ts` L189) y el SVG. Elimina desalineaciones tipo SVG↔terminal.
4. **Tipos nuevos aditivos.** Se añaden IDs a `BuilderComponentType`, a `circuitSnapshotComponentTypes` y a `projectData` (sin bump de versión de snapshot: son tipos nuevos, no campos nuevos). Los IDs existentes no cambian.
5. **Mapeo a motor.** Dispositivos de contacto → `XIC`/`ESTOP`/`OLR` sobre tag de dispositivo `__builder_device__:<id>` (`compiler/deviceMapping.ts`). Temporizadores → `TON`/`TOF` con tag de Q y `delayMs` en ms. Cargas → `OTE` sobre tag de dispositivo.
6. **Estados visuales.** Solo lectura: tag de dispositivo (`getDeviceContactState`), tag de bobina/Q (`engine.getTag`), `engineTrace` (`timerDone`, `timerElapsedMs`, `contactClosed`, y `tripped` si se aprueba OD3-3). Ningún estado se decide en UI.

### Catálogo de símbolos (resumen)

Tipos nuevos: `ESTOP`, `OLR`, `RESET_BUTTON`, `TON`, `TOF`, `GUARDAMOTOR`, `FUSE`, `DISCONNECT_SWITCH`, `LIMIT_SWITCH_NO`, `LIMIT_SWITCH_NC` (10) + `MOTOR_6T`, `MOTOR_9T`, `MOTOR_12T` si se aprueba OD3-1.
Tipos existentes restilizados (ID intacto): `PUSH_BUTTON_NO`, `PUSH_BUTTON_NC`, `SWITCH_1P` (= selector 2 posiciones), `LAMP` (= luz piloto), `MOTOR`, `BREAKER_1P`, `BREAKER_2P`, `XIC`, `XIO`, `NOTC`, `NCTO`, `OTE`, `OTL`, `OTU`.
Sin cambio: `POWER_SOURCE`, `DC_SOURCE`.

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `ui/src/diagram/symbols.tsx` | create (move) | `renderSymbolGraphic` (de `DiagramBuilder.tsx` L420-715) + estados visuales por tipo. Paso 1 = movimiento puro. |
| `ui/src/diagram/symbolGeometry.ts` | create | Tabla por tipo: alto de viewBox, bornes crudos `{id, x, y, role, pairId}`. Fuente única para terminales y SVG. |
| `ui/src/diagram/palette.ts` | create (move) | `instructionPalette` agrupada (control, protección, temporización, contactos/bobinas, potencia), en español. |
| `ui/src/diagram/model.ts` | modify | `BuilderComponentType` (L11) + tipos nuevos. |
| `ui/src/diagram/constants.ts` | modify | `circuitSnapshotComponentTypes` (L93-110) + tipos nuevos. |
| `ui/src/diagram/terminals.ts` | modify | `getTerminalDefinitions` (L189), `getConductiveTerminalPairs` (L97), `getDefaultEntry/ExitTerminalId` (L296/L324), `getComponentName` (L477), `isTimedContactType` (L14) → añadir `isTimerType`. |
| `ui/src/compiler/deviceMapping.ts` | modify | `DEVICE_BINDINGS` (L15-23) con instrucción `XIC|OTE|ESTOP|OLR`, tag fijo para `RESET_BUTTON`; `getDeviceContactState` (L37); borrar `RESERVED_INSTRUCTION_TYPES` (L54). |
| `ui/src/compiler/compileDiagram.ts` | modify | `DEVICE_TYPES` (L22-28) → usar `getDeviceBinding`; `toElement` (L268-288): rama TON/TOF con `delayMs`; `deviceInputs` con OR para tags compartidos (`SYS:RESET`). |
| `ui/src/solver/electricalView.ts` | modify | `getViewConductivePairs` (L42-67): ESTOP/OLR leen estado de dispositivo, no `component.tag` (L56-57). Estado de disparo OLR si OD3-3. |
| `ui/src/DiagramBuilder.tsx` | modify | Quitar símbolos/paleta movidos; `renderSymbolGraphic` call sites (L5335, L5385); `getInstructionSymbol`; `getDefaultComponentLabel` (L368); render de paleta (L3268-3288) agrupada. |
| `ui/src/projectData.ts` | modify | `instructionTypes` (L7) += ESTOP, OLR, TON, TOF; `parseProgram` (L203-240): `delayMs` obligatorio para TON/TOF (hoy solo NOTC/NCTO, L222). |
| `ui/src/App.css` | modify | `.diagram-symbol*` (L342-470): operador verde/rojo/azul, bloque temporizador, luz piloto, estado disparado. Nombres existentes se conservan. |
| `plc-engine/src/types.ts` + `programRunner.ts` | modify (aditivo, solo si OD3-3 = a) | `TraceStep.tripped?: boolean` en OLR (L268-279). |
| `ui/vitest.config.ts` | modify | `include` += `src/**/*.spec.tsx` (tests de markup con JSX). |
| `ui/src/**/*.spec.ts(x)` | create | Ver Testing Plan. |

## Required Context

| File | Why |
|------|-----|
| `plans/hoja-plano-logica-y-ui/plan.md` | D6, D7, D9-D13, R3, DoD. |
| `plans/hoja-plano-logica-y-ui/phases/phase-3.md` | Alcance y criterios. |
| `plans/hoja-plano-logica-y-ui/implementation/phase-2-impl.md` + `phase-2-parity.md` | Módulos y mapeo de fase 2 (dispositivos = tags `__builder_device__:<id>`). |
| `plans/hoja-plano-logica-y-ui/implementation/phase-1-impl.md` | Semántica ESTOP/OLR/TON/TOF (tabla de prioridad L33-40). |
| `docs/analysis-ladder-rendering-and-logic.md` §3, §9(b) | Símbolos actuales y puntos de cambio (pendiente de actualizar en fase 3). |
| `ui/src/diagram/terminals.ts` L14-30, L97-122, L189-290, L296-330, L477-500 | Geometría, conducción, nombres. |
| `ui/src/DiagramBuilder.tsx` L55-73, L253-292, L368-418, L420-715, L3268-3288, L5335, L5385 | Símbolos y paleta (a mover). |
| `ui/src/compiler/deviceMapping.ts`, `compileDiagram.ts` L15-30, L225-293 | Mapeo y compilación de dispositivos. |
| `ui/src/solver/electricalView.ts` L39-105 | Conducción de vista por tipo. |
| `ui/src/projectData.ts` L7, L203-240; `ui/src/diagram/constants.ts` L93-110; `ui/src/DiagramBuilder.tsx` L1401-1443 | Lista blanca de tipos y parser de snapshot. |
| `plc-engine/src/programRunner.ts` L260-323 | ESTOP, OLR, TON/TOF (fase 1). |
| Referencias: `D:\Relevant files\...\New\` 2, 3, 5, 6, 7, 8, 9, 13, 14, 16-18, 22, 23, 24, 28, 29, 31-36 | Forma ANSI (ver tabla de símbolos). |

## Implementation Steps

### Step 0: Gate y línea base

- **What**: (a) Confirmar fase 2 cerrada (ver Reality Check: estado de fase 2 pendiente). (b) Copia de `ui/src`, `plc-engine/src`, `ladder-types/src` en `C:\Users\Johan\AppData\Local\Temp\opencode\phase3-base\`. (c) Test de baseline `ui/src/diagram/symbols.baseline.spec.tsx`: markup de los 14 tipos existentes en estados default/energizado/pulsado/cerrado (`renderToStaticMarkup`), capturado **antes** de cualquier cambio visual.
- **Where**: `ui/src/diagram/`, copia en Temp.
- **Why**: Paso 1 es refactor puro; el baseline es la prueba de que no cambió nada.
- **Considerations**: No commitear (OD2-1 de fase 2). Sin Playwright en esta fase.

### Step 1: Mover símbolos y paleta (sin cambio visible)

- **What**: Crear `diagram/symbols.tsx` (`renderSymbolGraphic`, `getInstructionSymbol`) y `diagram/palette.ts` (`instructionPalette`). `DiagramBuilder.tsx` los importa.
- **Where**: `DiagramBuilder.tsx` L55-73, L253-292, L420-715 → nuevos archivos.
- **Why**: Testear símbolos en Node (vitest) sin levantar el componente de 5394 líneas (R-E).
- **Considerations**: El baseline de Step 0 debe pasar sin cambios. Mantener `getTimedContactTimerDisplay` (L179) en DiagramBuilder hasta Step 6.

### Step 2: Tabla de geometría compartida

- **What**: `diagram/symbolGeometry.ts` exporta `SYMBOL_GEOMETRY: Record<BuilderComponentType, {viewBoxHeight, terminals: RawTerminal[]}>`. `getTerminalDefinitions` proyecta con `projectSymbolPoint` desde esta tabla; el SVG usa los mismos valores crudos.
- **Where**: `diagram/symbolGeometry.ts` (nuevo); `terminals.ts` L189-290 (se reescribe como proyección); `symbols.tsx`.
- **Why**: Hoy cada tipo repite números en dos sitios (ver Mismatches: NC PB, SWITCH_1P, BREAKER_1P).
- **Considerations**: `projectSymbolPoint` (`terminals.ts` L167-187) y `snapPointToTerminalLattice` no cambian. BREAKER_2P sigue con px crudos (su convención actual), pero dentro de viewBox 128×64.

### Step 3: Tipos y listas blancas

- **What**: `model.ts` L11 añade IDs nuevos. `constants.ts` L93-110 añade los mismos IDs a `circuitSnapshotComponentTypes`. `projectData.ts` L7 añade `ESTOP`, `OLR`, `TON`, `TOF`. `parseProgram` (L222): `TON`/`TOF` exigen `delayMs` entero ≥ 0 como NOTC/NCTO. `terminals.ts`: nuevo `isTimerType(type)` (TON|TOF); `isTimedContactType` se mantiene para NOTC/NCTO.
- **Where**: los 4 archivos indicados.
- **Why**: Sin esto el snapshot no guarda los tipos nuevos (`parseCircuitSnapshotComponent` L1405 rechaza tipos fuera de la lista) y `parseProgram` rechaza `ESTOP/OLR/TON/TOF`.
- **Considerations**: `parseCircuitSnapshotComponent` (L1401-1443) añade `delayMs` solo si `isTimedContactType`: extender a `isTimerType` o TON/TOF pierden preset al cargar. Campos nuevos (p. ej. variante de motor, si se aprueba) no caben sin entrada explícita: el parser es de lista blanca de campos.

### Step 4: Mapeo dispositivo → motor

- **What**:
  - `deviceMapping.ts`: `DEVICE_BINDINGS` pasa a `{ instructionType: "XIC" | "OTE" | "ESTOP" | "OLR"; kind; fixedTag? }`. Entradas nuevas: `ESTOP` (ESTOP, input), `OLR` (OLR, input), `RESET_BUTTON` (XIC, input, `fixedTag: "SYS:RESET"`), `LIMIT_SWITCH_NO/NC`, `FUSE`, `DISCONNECT_SWITCH`, `GUARDAMOTOR` (XIC, input), `MOTOR_6T/9T/12T` (OTE, output). `getDeviceContactState`: ESTOP = `isPressed !== true` (NC), OLR = `isClosed ?? true`, RESET_BUTTON/LIMIT_NO = `isPressed === true`, LIMIT_NC = `isPressed !== true`, FUSE/DISCONNECT/GUARDAMOTOR = `isClosed ?? true`. `getDeviceTag`: `fixedTag ?? DEVICE_TAG_PREFIX + id`.
  - `compileDiagram.ts`: `DEVICE_TYPES` (L22-28) se reemplaza por `getDeviceBinding(type) !== null` (única lista). `toElement` (L268-274): dispositivo → instrucción del binding (no siempre XIC). Rama TON/TOF junto a NOTC/NCTO (L278-283). `deviceInputs` (L232-243): si varios dispositivos comparten tag (dos `RESET_BUTTON`), valor = OR.
  - `electricalView.ts` L54-60: ESTOP/OLR pasan a la rama de dispositivo (`getDeviceContactState`); TON/TOF siguen leyendo `tagValues[tag]` (= Q).
- **Where**: los 3 archivos.
- **Why**: Cierra la deuda de fase 2 (`RESERVED_INSTRUCTION_TYPES` L54 "no hay símbolo hasta fase 3") y evita que ESTOP/OLR lean `component.tag` (null en dispositivos → ESTOP/OLR nunca conducirían en la vista).
- **Considerations**: TON/TOF en el motor: input = `powerBefore`, Q → tag y energía (`programRunner.ts` L299-318; coherente con D13). Con dos `RESET_BUTTON` y flanco de `SYS:RESET`, el OR evita que un botón oculte al otro.

### Step 5: Símbolos SVG por tipo

- **What**: Implementar `renderSymbolGraphic` según la tabla de símbolos (ver abajo). Estados por `options`: `pressed`, `closed`, `energized`, `tripped` (OLR), `timerQ`, `timerElapsedMs`.
- **Where**: `diagram/symbols.tsx`.
- **Why**: Requisito R3 / D7.
- **Considerations**: Mantener clases `diagram-symbol*` existentes. Textos de bornes en español solo si aplica (la norma usa números: 1-2 NC, 3-4 NO por defecto; `terminalLabels` ya permite editarlos).

### Step 6: Estilos y temporizadores

- **What**: `App.css` L342-470: clases para operador verde (NO), rojo (NC/paro), azul/negro (reset), amarillo (luz piloto), disparado (OLR rojo), bloque temporizador. `getTimedContactTimerDisplay` (DiagramBuilder L179) lee `engineTrace` (`timerElapsedMs`, `delayMs`, `timerDone`) para TON/TOF; NOTC/NCTO siguen igual.
- **Where**: `App.css`, `symbols.tsx`, `DiagramBuilder.tsx` L179-214 (mover si Step 1 lo permite).
- **Why**: Estados de OLR y temporizador visibles sin reinterpretar el motor.
- **Considerations**: No introducir `setInterval` nuevo; el contador sigue el scan.

### Step 7: Nombres, etiquetas y paleta

- **What**: `getComponentName` (terminals.ts L477) y `getInstructionSymbol` (L253) en español para tipos nuevos y existentes (D6): p. ej. "Pulsador NA (marcha)", "Pulsador NC (paro)", "Paro de emergencia", "Relevador de sobrecarga", "Temporizador TON", "Luz piloto", "Selector 2 posiciones". `palette.ts`: grupos **Control** (PB NO, PB NC, Reset, Paro de emergencia, Selector, Limit switch NO/NC, Luz piloto), **Protección** (Breaker 1P/2P, Fusible, Guardamotor, Interruptor de seguridad, Relevador de sobrecarga), **Temporización** (TON, TOF, NOTC, NCTO), **Contactos y bobinas** (XIC, XIO, OTE, OTL, OTU), **Potencia** (Fuente AC, Fuente DC, Motor y variantes). OTL y OTU se añaden a la paleta (hoy ausentes).
- **Where**: `terminals.ts`, `symbols.tsx`, `palette.ts`, `DiagramBuilder.tsx` L3268-3288 (render agrupado).
- **Why**: Paleta agrupada (entregable) y NF6.
- **Considerations**: `getDefaultComponentLabel` (L368) y `getDefaultTag` (L717) deben cubrir los tipos nuevos (dispositivos no usan tag de label).

### Step 8: Estado de disparo OLR (solo si OD3-3 = a)

- **What**: `plc-engine/src/types.ts` L3-14: `TraceStep.tripped?: boolean`. `programRunner.ts` L268-279: `tripped` en el paso OLR. `electricalView`: el visual de OLR usa `tripped` del trace.
- **Where**: `plc-engine/src/types.ts`, `programRunner.ts`.
- **Why**: `powerAfter`/`readValue` no distinguen "disparado con sano=true y sin energía" (ambiguo).
- **Considerations**: Aditivo; los 31 tests de `plc-engine` no cambian. Test nuevo en `plc-engine/test/safety.spec.ts` (caso OLR sano tras disparo → `tripped` true).

### Step 9: Pruebas y cierre visual

- **What**: Ejecutar Testing Plan. Capturas manuales (`pnpm dev`) de cada símbolo contra su referencia y guardarlas en `implementation/phase-3-captures/`. Sign-off del usuario en changelog del plan.
- **Where**: `ui/src/**/*.spec.ts(x)`, `implementation/`.
- **Why**: DoD de fase 3 (revisión visual aprobada).
- **Considerations**: Playwright queda para fase 6 (ver Testing Plan).

## Símbolos: especificación

Convención de coordenadas: viewBox crudo indicado; bornes proyectados con `projectSymbolPoint(x, y, H)`. Familias: **C64** = contacto horizontal, viewBox 128×64, bornes `in(6.4,32)` / `out(121.6,32)`. **P72** = pulsador, viewBox 128×72, bornes `in(6,36)` / `out(122,36)`.

| Tipo | Archivo / símbolo | Bornes (id: x,y; pair) | Referencia | Estados visuales | Motor / compilador |
|------|-------------------|------------------------|-----------|------------------|--------------------|
| `PUSH_BUTTON_NO` (existe) | `symbols.tsx` case PUSH_BUTTON_NO (L563); `terminals.ts` L244 | in 6,36 / out 122,36; main. P72 | Ref 2, 22: NO, operador verde | pulsado: barra baja (existe) | `XIC` dispositivo; `isPressed === true` |
| `PUSH_BUTTON_NC` (existe, corregir) | L583; `terminals.ts` L245 | P72 | Ref 3, 22 (paro): NC, operador rojo | pulsado: barra abre. **Corregir** círculos cy=30 → 36 | `XIC` dispositivo; `isPressed !== true` |
| `ESTOP` (nuevo) | `symbols.tsx`: hongo rojo sobre contacto NC | P72 (como NC) | Sin imagen en el set: convención ANSI; validar con usuario | pulsado = contacto abierto, hongo hundido | `ESTOP` sobre tag dispositivo; sano = `isPressed !== true`; UNSET = sano (D13) |
| `OLR` (nuevo) | `symbols.tsx`: 3 espiras térmicas + contacto NC 95-96 | C64; main | Ref 23: 95/96, 3 polos | disparado (rojo, contacto abierto) / sano | `OLR` sobre tag dispositivo; sano = `isClosed ?? true`; disparo: trace `tripped` (OD3-3) |
| `RESET_BUTTON` (nuevo) | Pulsador NA, operador azul/negro, rótulo RESET | P72 | ANSI (reset) | pulsado | `XIC` sobre **`SYS:RESET`** fijo (D12); `isPressed === true`; OR si hay varios |
| `TON` (nuevo) | Caja con contacto NA temporizado, rótulo "TON" + preset | C64 | Ref 13 (ON DELAY), 16-18 | Q=true → contacto cerrado; contando → cuenta regresiva | `TON` con `tag` = Q, `delayMs` (ms), input = `powerBefore` (`programRunner` L299) |
| `TOF` (nuevo) | Caja con contacto NA temporizado, rótulo "TOF" | C64 | Ref 13 (OFF DELAY) | energizado → cerrado; al caer, cuenta y abre | `TOF` (Q = true con energía; hold `delayMs`) |
| `NOTC` / `NCTO` (existen) | glifos actuales `renderTimedContactGlyph` L437 | C64 (círculos 25.6/102.4, y=30) | Ref 13 (55-56/67-68) | igual que hoy (`contactClosed` del trace) | Sin cambio (OD3-2) |
| `XIC` / `XIO` (existen) | L607-647 | C64 | Ref 14: NA `-| |-`, NC `-|/|-` | contacto energizado / activado | Sin cambio |
| `OTE` / `OTL` / `OTU` (existen) | L685-713 | 128×60, `in`/`out` P60 | Ref 12: bobina circular; L y U | `coil-active` | Sin cambio; OTL/OTU entran en paleta |
| `SWITCH_1P` (existe, = selector 2 pos.) | L522-537 | C64; **corregir** círculos (cx 25.6/102.4) para que coincidan con bornes | Ref 29 (palanca) | cerrado/abierto por `isClosed` | `XIC` dispositivo; `isClosed === true` |
| `LIMIT_SWITCH_NO` / `_NC` (nuevos) | Émbolo con rodillo sobre contacto | C64 | Ref 5, 6 (con diagrama) | `isPressed` (accionado) | `XIC` dispositivo; NO: `isPressed === true`; NC: `!== true` |
| `FUSE` (nuevo) | Rectángulo con línea central, estado intacto/fundido | C64 | Ref 7 | intacto = conduce; fundido = abierto (toggle como switch) | `XIC` dispositivo; `isClosed ?? true` |
| `DISCONNECT_SWITCH` (nuevo) | Interruptor de seguridad: palanca + candado | C64 | Ref 9, 10 | `isClosed` | `XIC` dispositivo; `isClosed ?? true` |
| `BREAKER_1P` (existe) | L490-500 | C64-like (6,34 / 122,34; H64) | Ref 8, 8.1 | `isClosed ?? true` | `XIC` dispositivo (sin cambio de mapeo) |
| `BREAKER_2P` (existe) | L502-521 | 4 bornes px crudos (8/152; y 24/78) | Ref 8.4 | `isClosed ?? true` | `XIC` dispositivo |
| `GUARDAMOTOR` (nuevo) | 3 polos con "I>", palanca STOP/START | 6 bornes px: t1 20,8 / t2 20,56; t3 64,8 / t4 64,56; t5 108,8 / t6 108,56; pairs p1,p2,p3 | Ref 28 (1-6, I>, STOP/START) | `isClosed`; polos conducen juntos | `XIC` dispositivo `isClosed ?? true`; térmico NO en potencia (OLR aparte, OD3-3) |
| `LAMP` (existe) → "Luz piloto" | L538-546 | C64; `end` | Ref 22 (x1/x2, verde) | energizado (`lampGlowColor`) | `OTE` sobre tag dispositivo (sin cambio) |
| `MOTOR` (existe) | L547-562 | C64; `end` | Ref 24, 34 (símbolo M) | `coil-active` (rotor) | `OTE` dispositivo (sin cambio) |
| `MOTOR_6T` / `_9T` / `_12T` (nuevos, OD3-1) | Como MOTOR + bornes T1…T6/T9/T12 en la base | in/out conductores + sockets `Tn` sin pair (no conducen) | Ref 36 (6), 34-35 (9), 31-33 (12) | igual que MOTOR | `OTE` dispositivo |
| `POWER_SOURCE` / `DC_SOURCE` | L469-489 | 6,30 / 122,30; H60 | — | sin cambio | fuente |

## Testing Plan

**Verify command (único, primario):** `pnpm -r test` (raíz) → `plc-engine` (31 tests) + `ui` (vitest: parity, compiler, runtime, solver y los nuevos de fase 3).

Gates secundarios: `cd ui && npx tsc --noEmit` (0 errores, hoy limpio) · `cd plc-engine && npx tsc -p tsconfig.json --noEmit` · `pnpm -r build`.

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| (a) geometría `ui/src/diagram/symbolGeometry.spec.ts` | Por tipo de paleta: bornes dentro del viewBox; ids únicos; en familias C64/P72, `in`/`out` simétricos respecto a x=64 (±0.5); todo borne conductor tiene pair; `getDefaultEntry/ExitTerminalId` existen; bornes proyectados = `snapPointToTerminalLattice` (idempotente); GUARDAMOTOR = 3 pares | Pasa |
| (a) mapeo `ui/src/compiler/deviceMapping.spec.ts` | Tabla tipo → instrucción/tag/estado: PB NO/NC, ESTOP (NC), OLR (default sano), RESET (tag `SYS:RESET`), LIMIT NO/NC, FUSE, DISCONNECT, GUARDAMOTOR, LAMP/MOTOR/variantes; `switch` exhaustivo con `never` | Coincide con la tabla de Step 4 |
| (a) compilador `compileDiagram.spec.ts` (ampliar) | ESTOP en serie con PB → renglón `ESTOP(dev)`+`XIC(dev)`; OLR en serie; TON en serie → `TON` con `delayMs` en ms y tag Q; dos RESET → `deviceInputs["SYS:RESET"]` = OR; determinismo | Renglones y tags exactos |
| (a) vista `solver/electricalView.spec.ts` (ampliar) | ESTOP abierto corta la vista; OLR `isClosed=false` corta; TON con Q conduce | Pasa (regresión del `component.tag` nulo) |
| (a) parser `ui/src/projectData.spec.ts` (nuevo) | `parseProgram` acepta ESTOP/OLR/TON/TOF (TON sin `delayMs` → error); rechaza `"FOO"`; tipos antiguos siguen | Pasa |
| (a) snapshot v1 `ui/src/DiagramBuilder.snapshot.spec.ts` (nuevo, si la función es exportable tras Step 1; si no, `diagram/snapshotParse.spec.ts`) | Snapshot v1 con XIC, XIO, NOTC, NCTO, OTE, PB, breaker, lámpara, motor carga sin error; TON/TOF conservan `delayMs` | Pasa |
| (b) markup `diagram/symbols.spec.tsx` | `renderToStaticMarkup` por tipo × estado (default, energizado, pulsado, cerrado, disparado, Q). Baseline de 14 tipos de Step 0 **idéntico** tras Step 1 | Snapshots aprobados; sin ids aleatorios |
| (b) motor `plc-engine/test/safety.spec.ts` (si OD3-3 = a) | OLR sano tras disparo → `tripped` true; tras reset → false | Pasa |
| (c) visual | Capturas de `pnpm dev` por símbolo vs. referencia; sign-off del usuario | Fuera de automatización en fase 3; Playwright en fase 6 |

### Test Integrity Constraints

- Los 31 tests de `plc-engine` no se modifican (solo se añaden casos si OD3-3 = a).
- Tests de `ui` existentes (fases 1-2: compilador, parity, engineSession, electricalView) **no se modifican**; `parity.spec.ts` y goldens F01-F12 no cambian (ninguna fixture usa los tipos nuevos). Si algún golden cambia, bloquea y requiere entrada en changelog.
- Snapshots de markup de los 14 tipos existentes: generados en Step 0 y deben seguir iguales tras Step 1; cambios visuales intencionales (corrección de círculos PB NC, SWITCH_1P) se aprueban explícitamente y se registran en changelog.
- Test de fase 2 sobre `deviceMapping` (`compileDiagram.spec.ts` L247-250) sigue válido: PB/NC no cambian.

## Rollback Strategy

- **Checkpoint**: copia de `ui/src`, `plc-engine/src`, `ladder-types/src` en `C:\Users\Johan\AppData\Local\Temp\opencode\phase3-base\` (Step 0). Árbol sin commit.
- **Por paso**: Step 1 es refactor puro (revertir = mover de vuelta). Step 2 reescribe terminales: revertir con la copia. Steps 3-7 son aditivos (tipos nuevos fuera de la paleta no rompen nada). Step 8 es aditivo en el motor (campo opcional).
- **Flag**: no se usa flag nuevo. Los tipos nuevos pueden retirarse de `palette.ts` sin tocar el motor.
- **Snapshots**: no hay bump de versión; si un snapshot v2 futuro (fase 4) cambia campos, eso se maneja allí.

## Open Decisions

Máximo 5 decisiones abiertas. Las demás se toman por recomendación de este plan (ver Reality Check, "Decisiones tomadas por recomendación") y se registran en changelog.

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| **OD3-1** Variantes de motor 6/9/12 | (a) tipos `MOTOR_6T/9T/12T`, bornes extra **no conductores** (cosméticos); (b) campo `motorTerminals` en `BuilderComponent` (requiere entrada explícita en parser y, en la práctica, v2 en fase 4); (c) solo `MOTOR` de 2 bornes | **(a) propuesta** | El solver es de un camino por carga; los bornes de fase son referencia visual. (b) mezcla con snapshot v2. Confirmar con usuario. |
| **OD3-2** TON/TOF frente a NOTC/NCTO | (a) bloques nuevos TON/TOF (caja + rótulo) y NOTC/NCTO con glifo actual; (b) renombrar NOTC→TON en visual | **(a) propuesta** | Semántica distinta: NOTC lee su tag como entrada; TON escribe Q a su tag y propaga energía (fase 1, D13). Renombrar mentiría al usuario. El phase-3.md dice "mostrados como TON/TOF": requiere confirmación del primario. |
| **OD3-3** Disparo OLR y guardamotor | (a) `TraceStep.tripped?` aditivo en el motor + simulación de fallo = toggle `isClosed` del OLR; guardamotor = breaker de 3 polos sin térmico propio (OLR aparte en serie); (b) derivar disparo de `readValue`/`powerAfter` | **(a) propuesta** | (b) es ambiguo cuando no hay energía (`plc-engine/src/programRunner.ts` L268-279). Precedente: `contactClosed` en fase 2. Cambia `plc-engine` dentro de fase 3. |
| **OD3-4** Dispositivo de reset | (a) tipo propio `RESET_BUTTON` con tag fijo `SYS:RESET`; (b) PB con campo de tag override | **(a) propuesta** | Cumple D12 ("cualquier dispositivo cableado a SYS:RESET") sin nuevo campo ni bump de snapshot. |
| **OD3-5** Nombre de luz piloto | (a) mantener ID `LAMP` y etiqueta "Luz piloto"; (b) nuevo ID `PILOT_LIGHT` con alias | **(a) propuesta** | Cero migración; la forma ANSI es un cambio visual. |

### Decisiones tomadas por recomendación (registrar en changelog, sin pregunta)

- Limit switch = dos tipos (NO/NC) con la misma lógica que PB; selector 2 posiciones = `SWITCH_1P` restilizado; selector 3 posiciones fuera de alcance.
- ESTOP = dispositivo NC (`isPressed !== true`), no instrucción de contacto; UNSET = sano (D13).
- Fusible y interruptor de seguridad = dispositivos `XIC` con `isClosed`.
- Símbolos a `diagram/symbols.tsx` y paleta a `diagram/palette.ts`; geometría en `symbolGeometry.ts`.
- Paleta y nombres en español (D6); OTL/OTU en paleta.
- Dos `RESET_BUTTON` = OR sobre `SYS:RESET`.

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `ui/src/DiagramBuilder.tsx` | `instructionPalette` L55-73; `getInstructionSymbol` L253; `getDefaultComponentLabel` L368; `renderSymbolGraphic` L420-715; render paleta L3268-3288; calls L5335, L5385 | Ubicaciones reales (fase 3 indicaba L295-313 y L1272-1564: ya no aplican). |
| `ui/src/diagram/terminals.ts` | `isCoilType` L6, `isTimedContactType` L14, `getConductiveTerminalPairs` L97, `projectSymbolPoint` L167, `getTerminalDefinitions` L189-290, `getDefaultEntryTerminalId` L296, `getComponentName` L477 | Geometría y conducción ya migradas en fase 2. |
| `ui/src/diagram/model.ts` | `BuilderComponentType` L11 | Lugar del union de tipos. |
| `ui/src/diagram/constants.ts` | `circuitSnapshotComponentTypes` L93-110, `SYMBOL_VIEWPORT_*` L9-13 | Lista blanca de snapshot. |
| `ui/src/compiler/deviceMapping.ts` | `DEVICE_BINDINGS` L15-23, `getDeviceContactState` L37-51, `RESERVED_INSTRUCTION_TYPES` L54 | Mapeo a extender. |
| `ui/src/compiler/compileDiagram.ts` | `CONDUCTING_CONTACT_TYPES` L21, `DEVICE_TYPES` L22-28, `deviceInputs` L232-243, `toElement` L268-288 | Duplicado de la tabla de bindings: unificar. |
| `ui/src/solver/electricalView.ts` | `getViewConductivePairs` L42-67, `isTagContactClosed` L92 | ESTOP/OLR leen `component.tag` (L56-57): incorrecto en dispositivos. |
| `ui/src/projectData.ts` | `instructionTypes` L7, `parseProgram` L203-240 (`delayMs` solo NOTC/NCTO, L222) | Parser a extender. |
| `ui/src/DiagramBuilder.tsx` | `parseCircuitSnapshotComponent` L1401-1443 | Lista blanca de tipos (L1405) y de `delayMs` (`isTimedContactType`). |
| `plc-engine/src/programRunner.ts` | ESTOP L260-267, OLR L268-279, TON/TOF L299-318 | Semántica del motor que el símbolo debe reflejar. |
| `plc-engine/src/types.ts` | `TraceStep` L3-14 | Sin campo `tripped` (OD3-3). |
| `ui/src/App.css` | `.diagram-symbol*` L342-470 | Estilos. |
| `ui/vitest.config.ts` | `include: ["src/**/*.spec.ts"]` | Requiere `.tsx` para markup. |
| `ui/package.json` | `react-dom ^18.3.1` (dependencia existente), `vitest 2.1.8` | `renderToStaticMarkup` sin dependencia nueva (D5/NF3). |

Verificado: `cd ui && npx tsc --noEmit` → sin salida (0 errores). Fase 2 en árbol: `ui/src/{compiler,diagram,solver,runtime,parity}` con tests, `phase-2-parity.md` (58 tests de ui según informe).

### Mismatches / Notes

- **Estado de fase 2 (bloqueante para ejecutar, no para autorar)**: el código de fase 2 está en el árbol (legacy retirado, goldens F01-F12, `phase-2-parity.md`), pero `phases/phase-2.md` y `implementation/phase-2-impl.md` siguen `pending`/`draft`, y `plan.md` lista fase 2 como pendiente. Fase 3 exige "Fase 2 completada". El primario debe cerrar fase 2 antes de ejecutar esta fase.
- **Líneas de fase 3 desactualizadas**: palette L295-313 → L55-73; `getTerminalDefinitions` L1120-1217 → `diagram/terminals.ts` L189-290; `renderSymbolGraphic` L1272-1564 → `DiagramBuilder.tsx` L420-715; `BuilderComponentType` L18 → `diagram/model.ts` L11.
- **ESTOP/OLR/TON/TOF ya existen en `ladder-types` y motor**, pero no en UI: `RESERVED_INSTRUCTION_TYPES` (deviceMapping L54), `CONDUCTING_CONTACT_TYPES` (compileDiagram L21), `isPassThroughType`/`getTerminalDefinitions` (terminals.ts L77-106, L254-257) ya los contemplan. No son alcanzables desde la paleta.
- **Bug de vista a corregir en Step 4**: `electricalView.ts` L56-57 lee `component.tag` para ESTOP/OLR; al pasar a dispositivos (tag `null`) nunca conducirían.
- **Parser de snapshot**: `isTimedContactType` (terminals.ts L14) solo NOTC/NCTO → TON/TOF perderían `delayMs` al cargar (DiagramBuilder L1424). Tipos nuevos no están en la lista (L1405).
- **Desalineación SVG↔bornes (verificar visualmente en Step 9)**: PB NC dibuja círculos en cy=30 mientras la línea de terminal está en y=36 (DiagramBuilder L590-599; terminals.ts L245-251). SWITCH_1P dibuja círculos en x=25.6/102.4 y bornes en 6.4/121.6 (L522-528; terminals.ts L211-218). BREAKER_1P idem (círculos 34/94 vs bornes 6/122). Puede ser diseño (pivotes) o error; la tabla compartida de Step 2 lo fija.
- **BREAKER_2P**: bornes en px crudos; el arco baja a y=-8.9 (DiagramBuilder L513), fuera del viewBox 0..64 → recorte visible. Revisar en Step 9.
- **Palabras en inglés en la paleta** (`instructionPalette` L55-73; `getComponentName` terminals.ts L477-500): viola D6/NF6. Se corrige en Step 7.
- **OTL/OTU no están en la paleta** (confirmado). Se añaden.
- **Referencias**: el set no incluye imagen de paro de emergencia tipo hongo; la forma ESTOP se basa en convención ANSI y requiere confirmación del usuario. Las imágenes 15-18 y 5-6 se verifican en Step 9 (no se revisaron todas en esta exploración).
- **Numeración de bornes**: las referencias usan 55-68 (timers, contactores) o 95-96 (OL) y 1-6 (guardamotor, breaker 2P/3P). Por defecto: ANSI 1-2 NC, 3-4 NO, 95-96 OLR, 1-6 guardamotor. Editable por `terminalLabels`.
- **Sin conflicto de tests**: `ui` tiene tests de fase 2 (no hay snapshot visual previo). El plan de fase 3 dice "sin snapshots visuales frágiles": los snapshots de markup de esta fase son de estructura (sin ids aleatorios) y se limitan a 14 tipos + nuevos; registrar la excepción en changelog.

### Blocking findings

1. **Gate de fase 2** (ver arriba). No bloquea autorar este plan; sí bloquea ejecutarlo.
2. **OD3-3 (disparo OLR)**: sin campo `tripped` el estado visual de sobrecarga es ambiguo. Requiere decisión antes de Step 8; si el usuario rechaza el cambio de motor, el visual de disparo queda derivado con esa limitación.

Ningún otro hallazgo bloquea la fase: los cambios de código necesarios están localizados y son aditivos.
