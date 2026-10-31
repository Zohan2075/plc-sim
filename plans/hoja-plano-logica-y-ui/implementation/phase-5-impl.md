---
type: planning
entity: implementation-plan
plan: "hoja-plano-logica-y-ui"
phase: 5
status: draft  # draft | active | completed | revised
created: "2026-10-30"
updated: "2026-10-30"
---

# Implementation Plan: Phase 5 - Reshape de UI: hoja + panel físico

> Implements [Phase 5](../phases/phase-5.md) of [hoja-plano-logica-y-ui](../plan.md). Aplica D2/D3/D10-D13, R12/R13. Verificado contra el árbol actual (2026-10-30): fase 4 **completed**; `EngineSession` ya nunca se recrea (deliverable "no reconstruir engine" cumplido, solo falta verificación); los 4 huérfanos existen y sus clases CSS siguen en `App.css` (~L744-900).

## Approach

1. **Una sola fuente de actuación: el estado de los componentes del diagrama.** El panel NO escribe `engine.setInput` directamente (evita que `writeDeviceInputs()` sobrescriba el valor en cada tick, conflicto detectado al verificar): los controles del panel actúan los **mismos componentes** del diagrama (`isPressed`/`isClosed`/inspection-state) vía un handle imperativo nuevo en `DiagramBuilder`. El flujo sigue siendo el ya cableado: componente → `compileDiagram.deviceInputs` → efecto L2192 → `App.handleDeviceInputsChange` → `EngineSession.setDeviceInputs` → `engine.setInput` (letra de phase-5.md respetada: entradas por el motor, sin escribir tags). La luz piloto lee `getTag` (D1).
2. **El panel se enumeran los dispositivos del diagrama** (no hay lista fija de tags; resuelve el prerequisite de phase-5.md dinámicamente): `DiagramBuilder` reporta hacia arriba un inventario `PanelDevice[]` (id, tipo, label español, tag, contacto) derivado de `DEVICE_BINDINGS` (`deviceMapping.ts`).
3. **Reset del panel = tag `SYS:RESET` (D12)**: si el diagrama tiene `RESET_BUTTON`(s), el panel los acciona (OR en compilación, L237); si no, pulso directo `session.setInput("SYS:RESET", true→false)` (el tag no está en `deviceInputs` compilados, así que no se sobrescribe). Semántica idéntica a la del diagrama (D2).
4. **Pulso momentáneo garantizado de un scan** (`EngineSession`): un click más corto que `scanIntervalMs` hoy pierde el `true` (release lo pisa antes del scan); el session retiene el `false→true` hasta que un scan lo consuma.
5. **Huérfanos (D3)**: `ControlPanel` → sección de control de scan del panel (Run/Stop/1 scan/Reset/fault); `StatusDisplay` → sección "Estado de tags" (solo tags no-device); `TracePanel` → cajón desplegable "Trazo del último scan" (colapsado por defecto); `LadderDisplay` → segunda pestaña del mismo cajón (vista textual de renglones; destino final abierto, OD5-2). Ninguno se borra.
6. **Run/Stop/Reset se mudan al panel** (R13): se eliminan el botón Run y Reset-fault de `builderStageStatePanel` (zoom, pills y hints se quedan en el builder).

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `ui/src/panel/model.ts`, `panelControls.ts` | create | `PanelDevice`, `PanelControlKind`, inventario + tabla de mapeo (puro). |
| `ui/src/panel/SidePanel.tsx` | create | Composición: scan control + controles de dispositivo + estado de tags + cajón debug. |
| `ui/src/runtime/engineSession.ts` | modify | Pulso de un scan para entradas momentáneas. |
| `ui/src/DiagramBuilder.tsx` | modify | `forwardRef`+`DiagramBuilderHandle`, `onDeviceInventoryChange`, quitar Run/fault-reset. |
| `ui/control-panel/ControlPanel.tsx` | modify | Adaptar: español, `onReset`, `onFaultReset`, mantener `onStart/onStop/onSingleScan`. |
| `ui/status-display/StatusDisplay.tsx` | modify | Adaptar: excluir tags de dispositivo, español. |
| `ui/src/TracePanel.tsx`, `ui/ladder-display/LadderDisplay.tsx` | modify | Textos español; sin cambio de props. |
| `ui/src/App.tsx` | modify | Layout hoja+panel, panelOpen, inventario, ref del handle, Run/Stop/Reset en panel. |
| `ui/src/App.css` | modify | `.sim-layout` (grid 1fr + 360px), `.side-panel*`, media queries. |
| Specs: `panel/panelControls.spec.ts`, `panel/panelFlow.spec.ts`, `panel/SidePanel.spec.tsx`, `runtime/engineSession.spec.ts` (ampliar) | create/modify | Ver Testing Plan. |

## Required Context

| File | Why |
|------|-----|
| `plans/hoja-plano-logica-y-ui/plan.md` | D1-D16, R12/R13, NF3 (sin deps nuevas), D6. |
| `plans/hoja-plano-logica-y-ui/phases/phase-5.md` | Alcance/AC; prerequisite de lista de tags (resuelto por enumeración dinámica, ver Reality Check). |
| `ui/src/App.tsx` (202 líneas) | Estado, loop de scan L66-77, `handleRunToggle` L151-170, `handleDeviceInputsChange` L172-174. |
| `ui/src/DiagramBuilder.tsx` L33-52, L187-193, L1944, L2073-2171, L2192-2198, L3159-3203 | Props, compilación, panel de estado (botón Run L2076), efecto deviceInputs, actuación existente. |
| `ui/src/runtime/engineSession.ts` | `setDeviceInputs`/`writeDeviceInputs`/`tick` (pulso a añadir). |
| `ui/src/compiler/deviceMapping.ts`, `inspectionStates.ts`, `terminals.ts` L42-93 | Bindings, estados de inspección, tipos momentáneo/mantenido. |
| `ui/control-panel/ControlPanel.tsx`, `ui/status-display/StatusDisplay.tsx`, `ui/src/TracePanel.tsx`, `ui/ladder-display/LadderDisplay.tsx` | Los 4 huérfanos a adaptar (props actuales en su cabecera). |
| `ui/tsconfig.json` | `include` ya cubre `ladder-display`, `control-panel`, `status-display` (y `src` a `TracePanel`). |

## Implementation Steps

### Step 0: Gate y checkpoint

- **What**: `cd ui && npx tsc --noEmit` limpio y `pnpm -r test` verde. Copia de `ui/src` + `ui/{control-panel,status-display,ladder-display}` a `C:\Users\Johan\AppData\Local\Temp\opencode\phase5-base\`.
- **Why**: Punto de referencia antes del reshape (R-F).

### Step 1: Modelo y mapeo del panel (puro) - `ui/src/panel/model.ts` + `panelControls.ts`

- **What**: `PanelDevice { componentId; type; label; tag; contactClosed; inspectionStateId? }`; `PanelControlKind = "momentary" | "maintained" | "emergency" | "sensor" | "trip" | "lamp" | "motor"`. `getPanelDevices(components: BuilderComponent[]): PanelDevice[]` (filtra `getDeviceBinding(type)?.kind === "input"`, usa `getDeviceTag`, `getDeviceContactState`, `getActiveInspectionState`; para salidas `kind === "output"` produce entradas de tipo lamp/motor leyendo `getDeviceTag`). `getPanelControlKind(type)`: momentary = PUSH_BUTTON_NO/NC, RESET_BUTTON; emergency = ESTOP; sensor = LIMIT_SWITCH_NO/NC; maintained = SWITCH_1P, BREAKER_1P/2P, DISCONNECT_SWITCH, FUSE; trip = OLR, GUARDAMOTOR; lamp = LAMP; motor = MOTOR/MOTOR_6T/9T/12T. Etiquetas por defecto en español (D6) cuando `component.label` esté vacío.
- **Where**: `ui/src/panel/` (nuevo).
- **Why**: Enumeración desde el diagrama compilado (tag = `getDeviceTag`, misma fuente que `compileDiagram.ts` L227-239); testeable sin React.
- **Test**: `panelControls.spec.ts` — cada tipo del palette cae en un kind esperado; inventario refleja `getDeviceContactState`; RESET_BUTTON → tag `SYS:RESET`.

### Step 2: Pulso de un scan en `EngineSession`

- **What**: En `setDeviceInputs`/`writeDeviceInputs` (`engineSession.ts` L19-22, L54-58): si un tag pasa `false→true→false` sin que `tick()` intermedio lo consuma, el `true` se retiene hasta el primer tick y el `false` se aplica en el siguiente (pulso mínimo de un scan). `tick()` marca los valores retenidos como consumidos. API nueva mínima; sin cambios de firma.
- **Where**: `ui/src/runtime/engineSession.ts`.
- **Why**: AC "presionar pulsador en el panel cambia el tag en el mismo scan"; un click (~80 ms) < `scanIntervalMs` (150) hoy se pierde. Afecta también al press sobre la hoja (mismo canal).
- **Test**: `engineSession.spec.ts` (ampliar): press+release antes de `tick` → scan ve `true`, siguiente scan ve `false`; caso sin retención (mantenido) sin regresión.

### Step 3: `DiagramBuilder`: handle de actuación + inventario Run/Stop fuera

- **What**: (a) `export interface DiagramBuilderHandle { actuateDevice(componentId: string, closed: boolean): void; setMomentaryPressed(componentId: string, pressed: boolean): void }` via `forwardRef`; implementación interna **sin** `setSelection` (no roba selección de la hoja): maintained/trip → `setComponents` con `isClosed`/`applyInspectionState` (paralelo a `toggleMaintainedSwitch` L3159 y `setInspectionState` L3172); momentary → paralelo a `pressMomentaryPushButton`/`releaseMomentaryPushButton` (L3184-3203). (b) Prop `onDeviceInventoryChange?: (devices: PanelDevice[]) => void` + efecto con firma JSON (patrón de L2192-2198) emitiendo `getPanelDevices(components)`. (c) **Eliminar** el botón Run (L2076-2083) y Reset-fault (L2084-2092) de `builderStageStatePanel` y las props `onRunToggle`/`onFaultReset` (L36-37, L41); se conservan zoom, pills y hints.
- **Where**: `ui/src/DiagramBuilder.tsx`.
- **Why**: Canal único de actuación hoja↔panel (D2: mismo dispositivo, misma semántica); R13 (Run/Stop/Reset en el panel, una sola ubicación).
- **Considerations**: `running`, `runDisabled`, `fault`, `tick`, `scanIntervalMs` siguen usados por pills/hints. Quitar `onRunToggle` obliga a actualizar el call site de `App` (Step 6, mismo commit).

### Step 4: Adaptar los cuatro huérfanos (D3, textos ES)

- **What**: `ControlPanel.tsx`: textos español ("Marcha"/"Paro"/"Un scan"), añadir `onReset?: () => void` (botón "Reset (SYS:RESET)", siempre activo si hay tag) y `onFaultReset?` (visible con fault); conserva `onStart/onStop/onSingleScan`, pills de tick/intervalo. `StatusDisplay.tsx`: textos español; excluir del listado los tags con prefijo `__builder_device__:` (ya tienen control dedicado) manteniendo `getTag`/`setInput` para tags de proyecto. `TracePanel.tsx`/`LadderDisplay.tsx`: textos español ("Último scan", "Renglones"); props sin cambio.
- **Where**: `ui/control-panel/ControlPanel.tsx`, `ui/status-display/StatusDisplay.tsx`, `ui/src/TracePanel.tsx`, `ui/ladder-display/LadderDisplay.tsx`.
- **Why**: D3 (reutilizar, no borrar) + D6.
- **Test**: render smoke con `renderToStaticMarkup` (patrón de `sheet.spec.tsx`, sin deps nuevas).

### Step 5: `SidePanel.tsx` - composición del panel

- **What**: `SidePanel` compone: (1) `ControlPanel` (Run/Stop/1 scan/Reset/fault-reset); (2) controles de dispositivo desde `devices: PanelDevice[]` + `tagValues`: momento-momentáneo = botón con `onPointerDown/Up` → `handle.setMomentaryPressed(id, p)`; mantenido = toggle → `handle.actuateDevice(id, !contactClosed)`; ESTOP = botón hongo rojo momentáneo; trip (OLR/GUARDAMOTOR) = estado "Disparado/Normal" + toggle; sensor = botón "Simular activación"; FUSE = toggle "Intacto/Fundido"; lámparas/motores = luz piloto con `lampGlowColor` leyendo `tagValues[tag]`. Reset local = si existe algún `RESET_BUTTON` en devices → `setMomentaryPressed(true/false)` en todos; si no → `onSystemResetPulse` (prop → App → `session.setInput("SYS:RESET", …)`). (3) `StatusDisplay`. (4) Cajón desplegable (colapsado por defecto, `details`/estado) con pestañas `TracePanel` (`engineTrace`) y `LadderDisplay` (`program`, `engineTrace`).
- **Where**: `ui/src/panel/SidePanel.tsx` (nuevo).
- **Why**: R12; los cuatro huérfanos quedan importados desde el layout nuevo (AC de phase-5.md).
- **Considerations**: Sin deps nuevas (D5/NF3). Textos español (D6).

### Step 6: `App.tsx` - layout hoja + panel y cableado

- **What**: Layout: `<main className="sim-layout sim-layout--panel-open">` → `<div className="sim-layout__sheet">` (`DiagramBuilder` con `ref`) + `<SidePanel>`; estado `panelOpen` (default abierto) con botón conmutador. Estado `devices: PanelDevice[]` desde `onDeviceInventoryChange`; `engineTrace` ya existe (L44). Handlers: `handleRunStart/handleRunStop` (extraídos de `handleRunToggle` L151-170), `handleSingleScan` (`session.tick(scanIntervalMs)` solo si `!running`), `handleSystemResetPulse` (`session.setInput("SYS:RESET", true)` + `setTimeout(0)`/siguiente estado → `false`; el motor detecta flanco de subida en el siguiente scan, `programRunner.ts` L33). El botón Run y Reset-fault dejan de pasarse a `DiagramBuilder`.
- **Where**: `ui/src/App.tsx`.
- **Why**: R13; el panel es la única ubicación de Run/Stop/Reset.
- **Considerations**: `handleBuilderProgramChange`/`applyProject` no cambian (el engine persiste por `EngineSession`, verify del deliverable "no reconstruir engine": grep de `new PlcEngine` solo en `engineSession.ts`).

### Step 7: CSS de layout y responsive (1280 px)

- **What**: `.sim-layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: var(--space-4); align-items: start; }`; `.sim-layout__sheet { min-width: 0; }`; `.side-panel { position: sticky; top: var(--space-4); max-height: calc(100vh - var(--space-8)); overflow-y: auto; }` (patrón de `.builder-stage__state-panel--sidebar` L1603-1608). Media query `@media (max-width: 1180px)` (breakpoint existente, L2375): `grid-template-columns: 1fr` (panel debajo de la hoja). Reutilizar clases existentes de los huérfanos (`.panel--controls`, `.tag-groups`, `.trace-list`, `.ladder-rungs`, App.css ~L744-900). A 1280 px: hoja ≈ 880 px + panel 360 px, sin romper (verificación manual con `pnpm dev` + captura en `implementation/phase-5-captures/`).
- **Where**: `ui/src/App.css`.
- **Why**: Objetivo 4 del plan; suficiente para no romper a 1280 px (AC visual, E2E en fase 6).

## Testing Plan

**Verify command (único, primario):** `pnpm -r test` (raíz) → `plc-engine` + `ui` (vitest: los nuevos `panelControls`, `panelFlow`, `SidePanel` smoke y los ampliados `engineSession`, más los existentes sin tocarse).

Gates secundarios: `cd ui && npx tsc --noEmit` · `pnpm -r build`.

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| vitest `panel/panelControls.spec.ts` | Mapeo tipo→kind completo; inventario = dispositivos de `compileDiagram` (mismo tag que `getDeviceTag`); RESET_BUTTON→`SYS:RESET`; labels ES por defecto | Pasa |
| vitest `runtime/engineSession.spec.ts` (ampliar) | Pulso de un scan (press+release pre-tick visible una vez); programación mantenida sin regresión; 4 tests existentes intactos | Pasa |
| vitest `panel/panelFlow.spec.ts` (integración) | `compileDiagram(components de prueba)` → `getPanelDevices` → `EngineSession`: press de pulsador cierra tag en el siguiente scan y enciende lámpara (`getTag`); toggle de breaker abre contacto; pulso `SYS:RESET` borra latch OTL (D2/D12); `stop()` conserva latch (D11) | Pasa |
| vitest `panel/SidePanel.spec.tsx` (smoke) | `renderToStaticMarkup`: renderiza los 4 huérfanos; lista controles por `devices`; secciones presentes | Pasa |
| visual manual | `pnpm dev` a 1280 px: hoja + panel, panel colapsable, capturas en `implementation/phase-5-captures/` | Sign-off (E2E Playwright en fase 6) |

### Test Integrity Constraints

- `plc-engine` (34 tests): **sin cambios**.
- `ui` existentes (parity, compiler, runtime/engineSession previos, electricalView, symbols, grid/sheet/snapshot/alignment): no se modifican. `engineSession.spec.ts` solo **añade** casos; los 4 existentes quedan intactos.
- El pulso de un scan (Step 2) es aditivo: los flujos con valores mantenidos no cambian de comportamiento (el retén solo aplica a `false→true→false` sin tick intermedio).
- Ningún test se deshabilita ni debilita. Playwright: los specs de los flujos principales quedan para fase 6 (ver Reality Check).

## Rollback Strategy

- **Checkpoint**: copia de `ui/` en `C:\Users\Johan\AppData\Local\Temp\opencode\phase5-base\` (Step 0).
- **Por paso**: Steps 1-2 aditivos. Step 3 es el corte de comportamiento (botón Run fuera del builder): revert = restaurar props/botones desde el checkpoint y quitar handle/inventario. Steps 4-6 son de presentación: revert = descomponer `App.tsx` al layout actual (un solo `main`). Step 7 es CSS puro.
- **Flag**: ninguno nuevo; el estado del motor no depende del layout, así que cualquier rollback parcial conserva la lógica.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| **OD5-1** Actuación del panel | (a) actúa componentes del diagrama vía handle imperativo (fuente única; el símbolo en la hoja reacciona); (b) `engine.setInput` directo con capa de overrides en `EngineSession` | **(a) propuesta** | (b) crea dos fuentes de verdad (hoja vs panel) y `writeDeviceInputs` pisaría el valor cada tick. (a) respeta la letra de phase-5.md (entradas por `engine.setInput` vía el canal existente). Confirmar con usuario. |
| **OD5-2** Destino de `LadderDisplay` | (a) pestaña del cajón debug junto a `TracePanel` (colapsado); (b) sección propia del panel; (c) importar sin renderizar | **(a) propuesta** | Cumple AC ("importado desde el layout nuevo") sin estorbar (la hoja YA es la vista de renglones). Fate final → fase 6 (D3 no borra). Confirmar con usuario. |
| **OD5-3** Botón Run/Reset-fault en el builder | (a) eliminar (ubicación única en el panel); (b) mantener ambos sincronizados | **(a) propuesta** | R13 ubica Run/Stop/Reset en el panel; duplicarlos deriva. Riesgo: con panel colapsado el fault-reset queda lejos → el panel arranca abierto. Confirmar con usuario. |
| **OD5-4** Pulso mínimo de un scan en `EngineSession` | (a) retener `false→true` hasta un tick; (b) dejar el race actual | **(a) propuesta** | Sin (a), clicks rápidos no llegan al motor (rompe AC de fase). Cambio pequeño y testeable. Confirmar con usuario. |
| **OD5-5** Dispositivos "no operables" en panel (LIMIT_SWITCH_*, FUSE, OLR/GUARDAMOTOR) | (a) controles de simulación (toggle/"simular activación"); (b) solo lectura de estado | **(a) propuesta** | Resuelve OQ-g desde el panel reutilizando `inspectionStates`; mapear OLR/GUARDAMOTOR a "trip" con toggle normal/disparado. Confirmar con usuario. |

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `ui/src/App.tsx` | `handleRunToggle` L151-170, `handleDeviceInputsChange` L172-174, loop L66-77, props L179-198 | Run/Stop actuales y canal deviceInputs→session. |
| `ui/src/DiagramBuilder.tsx` | props L33-52, `deriveBuilderProgram` L187-193, `builderStageStatePanel` L2073-2171 (Run L2076-2092, fault-reset L2084-2092), efecto L2192-2198, `toggleMaintainedSwitch` L3159, `setInspectionState` L3172, `pressMomentaryPushButton` L3184 | Handle de actuación = paralelo de estas funciones; inventario desde `derivedState`; botones a mover. |
| `ui/src/runtime/engineSession.ts` | `setDeviceInputs` L19-22, `writeDeviceInputs` L54-58 | Pulso de un scan (OD5-4). |
| `ui/src/compiler/compileDiagram.ts` | `deviceInputs` L227-239 (OR por tag, L237) | Reset compartido por varios RESET_BUTTON; etiquetas de tag. |
| `ui/src/compiler/deviceMapping.ts` | `DEVICE_BINDINGS` L19-38, `getDeviceTag` L44, `getDeviceContactState` L53 | Fuente del inventario y de la tabla de mapeo. |
| `ui/src/diagram/inspectionStates.ts` | `INSPECTION_STATE_OPTIONS` L16-33, `isEngineTripStateType` L50 | Estados de OLR/GUARDAMOTOR/FUSE/DISCONNECT (OD5-5, OQ-g). |
| `plc-engine/src/programRunner.ts` | lectura `SYS:RESET` L33, `tripped` L273-277 | Flanco de subida de reset; estado "disparado" para el panel. |
| `ui/tsconfig.json` | `include` L7 | Los 3 dirs de huérfanos ya compilan; no bloquea importarlos desde `App`. |
| `ui/src/App.css` | `.builder-stage__state-panel--sidebar` L1603, media query L2375-2417, estilos de huérfanos ~L744-900 | Patrón sticky/scroll a reutilizar; breakpoint existente. |

### Mismatches / Notes

- **`phase-5.md` dice "el panel escribe entradas con `engine.setInput`"**: verificado que escribir directamente choca con `writeDeviceInputs()` (se sobrescribe en cada tick). OD5-1 resuelve por el canal existente `setDeviceInputs` (que termina en `engine.setInput`); elevar a la primary si prefiere el literal.
- **Prerequisite de phase-5.md "lista de tags de entrada acordada"**: el diseño enumerativo elimina la lista fija (los tags `__builder_device__:<id>` se generan por componente). Etiquetas = `component.label` (español del palette). Si la primary espera una lista fija, esto cambia el prerequisite (no el alcance).
- **"Playwright E2E en fase 5"** (phase-5.md Includes/Deliverables) vs. instrucción de esta tarea (E2E en fase 6): este plan deja los specs E2E fuera; los AC de fase 5 que dicen "(E2E)" quedan verificables con vitest `panelFlow` + revisión manual, y la verificación E2E definitiva en fase 6. Requiere confirmación de la primary.
- **Deliverable "App.tsx ya no reconstruye el engine" ya está cumplido** (fase 2): `App` usa `EngineSession` (ref L43) y `applyProgram`; verificación = grep `new PlcEngine` solo en `engineSession.ts`. No hay código que eliminar.
- **OQ-g está parcialmente resuelto**: el inspector ya ofrece estados OLR/FUSE/DISCONNECT/GUARDAMOTOR (`inspectionStates.ts` L16-33, fase 3); el panel añade la actuación de operador (OD5-5). OQ-h (sign-off visual de ESTOP) sigue abierto y no bloquea esta fase.
- **Carrera momentáneo existente** (no introducida por esta fase): presionar en la hoja con `onPointerUp` antes del tick pierde el pulso; OD5-4 lo arregla para ambos.

### Blocking findings

Ninguno bloqueante. Cinco decisiones abiertas (OD5-1..5, máx. 5) requieren confirmación de la primary antes de ejecutar los pasos afectados; OD5-1 y OD5-3 son las que más afectan a la forma final del layout.
