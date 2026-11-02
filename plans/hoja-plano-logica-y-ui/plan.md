---
type: planning
entity: plan
plan: "hoja-plano-logica-y-ui"
status: completed  # draft | approved | active | completed | abandoned
created: "2026-10-29"
updated: "2026-10-31"
---

# Plan: hoja-plano-logica-y-ui

> Estado: **COMPLETADO el 2026-10-30** (fases 1-6, código revertido por D24 — quedan como registro histórico); **fase 7 completada el 2026-10-30/31** (WP8 símbolos + WP9 hoja completa + WP10 cables/menús + WP11 NC trazado + WP12 gestos/NO vectorial/NC accionado + WP13 AC source/SPST/Emergency pb/OL + WP14 ESTOP accionado/OL naranja/LAMP + **WP15 E-stop enclavado/alineación de cables** + **WP16 causa raíz del desfase cable/pata** + **WP17 E-stop con las nuevas trazas normal/opened**). Decisiones D1-D39 registradas en [Decision Log](#decision-log); **las 7 fases están `done`** (ver changelog). Fueron secuenciales, nunca en paralelo. Ver [Pending user sign-off](#pending-user-sign-off) (único pendiente: revisión visual del usuario, OQ-h).
> **AVISO (2026-10-30, D24): el código de las fases 1-6 fue REVERTIDO a git HEAD (570779c)** — el usuario reportó que el proyecto "worked perfectly before" con peores visuales, peor layout y lógica distinta tras las 6 fases. El plan y sus documentos de fase quedan como registro histórico; la fase 7 se re-scoped a trabajo solo de símbolos (D25-D27).
> Base de análisis: [docs/analysis-ladder-rendering-and-logic.md](../../docs/analysis-ladder-rendering-and-logic.md) (referencias file:line; **superado**, ver banner). Índice de docs: [docs/README.md](../../docs/README.md). Handover final: [handovers/hoja-plano-final.md](handovers/hoja-plano-final.md).

## Objective

Convertir jPLC Sim en un simulador en el que:

1. El diagrama se dibuje sobre una **hoja tipo plano** (rejilla visible, marco, zonas, cuadro de título) con componentes y cables que se alinean a la rejilla y de forma ortogonal.
2. Los símbolos sigan la convención **ANSI/NEMA** (la actual, reforzada, no una reescritura completa).
3. La **lógica sea correcta y real**: pulsadores, paro de emergencia, relevador de sobrecarga, breakers e interruptores son entradas que el motor ve; las ramas en paralelo se combinan con OR; los temporizadores respetan la energización del renglón; el estado sobrevive a ediciones y a Run/Stop. **El motor PLC es la única fuente de valores de tags** (D1).
4. La UI tenga un **panel de control físico** lateral (pulsadores, selectores, luces piloto ligados a tags del motor) junto a la hoja.

## Motivation

Estado actual verificado en [analysis §4 y §5](../../docs/analysis-ladder-rendering-and-logic.md):

- La rejilla es solo CSS (`ui/src/App.css` L1789-1830); el SVG no dibuja líneas, no hay marco ni cuadro de título (analysis §2).
- Las ramas en paralelo a una misma bobina generan renglones separados que se pisan (last-writer-wins en `plc-engine/src/programRunner.ts` L126). Divergencia real entre el solver físico de la UI y el motor (analysis §4 bug 1).
- Pulsadores, interruptores y breakers no producen instrucciones: el motor no los ve (analysis §4 bug 2). `isBreakerClosed` siempre devuelve true (analysis §3).
- Los temporizadores avanzan aunque el renglón no tenga energía (analysis §4 bug 3).
- El estado del motor se descarta en cada reconstrucción (`ui/src/App.tsx` L98-177; analysis §4 bug 6).
- No existe ruta de entrada viva: `engine.setInput` solo lo llama un componente huérfano (analysis §5 bug 5).
- La UI contiene un segundo simulador (`computeElectricalState`, `resolvePhysicalInstructionTagValues`) que contradice `docs/README.md` ("ui sin lógica de simulación"). Resuelto por D1: el solver deja de ser fuente de tags.

## Requirements

Mapeo a los 4 objetivos del usuario: (1) alineación a rejilla, (2) símbolos ANSI/NEMA, (3) refuerzo de lógica + reshape de UI, (4) consultar al usuario en todas las decisiones (todas resueltas, ver Decision Log).

### Functional

- [ ] **R1 (obj 1) Hoja tipo plano**: rejilla dibujada en SVG (líneas visibles, no solo CSS), marco/borde, numeración de zonas (columnas/filas), cuadro de título.
- [ ] **R2 (obj 1) Snap-to-grid**: componentes y cables se ajustan a la rejilla; cables ortogonales; las líneas principales se alinean simétricamente a líneas de rejilla. Modelo de lienzo **libre con snap-to-grid** (D8), no carriles fijos.
- [ ] **R3 (obj 2) Símbolos ANSI/NEMA** (D7: ANSI/NEMA sobre el set actual): NO/NC, pulsador NO verde / NC rojo (paro), paro de emergencia (hongo rojo), guardamotor, relevador de sobrecarga, selector, luz piloto, limit switch, TON/TOF, motor trifásico con 6/9/12 terminales, breaker, fusible, interruptor de seguridad. Referencias: `D:\Relevant files\Download (del cel viejo)\Electricidad\Controles eléctricos\New\`.
- [ ] **R4 (obj 3) Dispositivos visibles para el motor**: pulsadores, paro, sobrecarga, breakers e interruptores se convierten en entradas/instrucciones reales del motor (cierra analysis §4 bug 2).
- [ ] **R5 (obj 3) OR de ramas en paralelo**: varias ramas que alimentan una misma bobina se combinan con OR en el motor. El solver de UI deja de calcularlo (D1); la vista lo muestra leyendo el resultado del motor (cierra bug 1).
- [ ] **R6 (obj 3) Paro de emergencia con prioridad**: contacto NC; anula cualquier otra lógica del scan.
- [ ] **R7 (obj 3) Relevador de sobrecarga con disparo y rearme manual**: disparo enclavado; rearme por entrada explícita; distinto del paro de emergencia.
- [ ] **R8 (obj 3) TON/TOF con energización del renglón** (semántica ANSI): el temporizador solo cuenta cuando el renglón tiene energía. **Preset en milisegundos; sin retardo oculto** (D4: se elimina `TIMED_CONTACT_ACTUATION_DELAY_MS` = 250 ms).
- [ ] **R9 (obj 3) Regla de prioridad OTE/OTL/OTU** sobre un mismo tag, definida y documentada, con tests.
- [ ] **R10 (obj 3) Persistencia de estado** (D2): Stop conserva tags latcheados; Reset borra salidas latcheadas y enclavamientos; editar el diagrama conserva el estado **por nombre de tag**. Reset es una **entrada de tag** disparable desde un pulsador de reset del diagrama o del panel (dispositivo de entrada, no solo botón de UI).
- [ ] **R11 (obj 3) Motor como única fuente de tags** (D1): el cableado se compila a programa del motor (rungs/instrucciones); el motor decide los valores. Antes de retirar el solver de UI como fuente de tags, tests de paridad sobre fixtures (valores del solver viejo == valores del motor compilado) y un punto de rollback. El solver puede sobrevivir **solo como ayuda visual** que lee tags del motor, sin lógica propia.
- [ ] **R12 (obj 3/4) Panel de control físico lateral**: pulsadores, selectores, paro y reset; los pulsadores envían entradas vía `engine.setInput`; las luces leen tags del motor (una sola fuente de verdad). Reutiliza los componentes huérfanos (D3).
- [ ] **R13 (obj 3/4) Reshape de App**: vista principal = hoja del diagrama; lateral = panel; Run/Stop/Reset en el panel (además de los pulsadores de reset del diagrama, D2).
- [ ] **R14 (compat.) Migración**: `CircuitSnapshot` v1 se migra automáticamente a v2; `data/` y `sample-programs/` siguen cargando.
- [ ] **R15 (proceso) Consulta**: ninguna decisión se toma sin confirmación del usuario; fases secuenciales. Decisiones D1-D8 ya confirmadas.

### Non-Functional

- [ ] **NF1 Determinismo**: `plc-engine` sigue determinista y testeable en Node sin UI.
- [ ] **NF2 Pureza**: `ladder-types` sin lógica de ejecución (solo tipos y, si se aprueba, el contrato de reglas puro).
- [ ] **NF3 Sin nuevas dependencias de runtime**. Dependencias aprobadas (D5), solo para test: **vitest** (en `ui`) y **Playwright** (E2E). Cualquier otra dependencia requiere nueva aprobación.
- [ ] **NF4 Compatibilidad hacia atrás**: snapshots y bundles antiguos cargan; cambios de formato van con versión y migración.
- [ ] **NF5 Rendimiento**: el scan con `scanIntervalMs` mínimo (25 ms, `projectData.ts`) no degrada la UI visiblemente en una hoja de tamaño por defecto (1720×940).
- [ ] **NF6 Idioma** (D6): identificadores de código en inglés; textos de usuario en español.
- [ ] **NF7 Higiene de archivos**: finales de línea normalizados antes de la fase 1 (ver Risks).

## Scope

### In Scope

- `plc-engine/` (scan, timers, OR, prioridades, persistencia de estado, API de entradas, reset).
- `ladder-types/` (nuevos tipos de instrucción y contrato de reglas compartido).
- `ui/src/DiagramBuilder.tsx`, `ui/src/projectData.ts`, `ui/src/App.tsx`, `ui/src/App.css`, `ui/src/styles.css` (símbolos, rejilla, snapshot v2, panel).
- Compilación del cableado a programa del motor y retirada del solver como fuente de tags (fase 2, D1).
- Huérfanos `ControlPanel`, `StatusDisplay`, `TracePanel`, `LadderDisplay`: **reutilizar** en el panel nuevo (D3). No se borran.
- Migración de `data/` y `sample-programs/` (fase 6).
- Pruebas: vitest (plc-engine, ladder-types, paridad, UI), Playwright E2E para flujos principales.
- Actualización de `docs/` (README, inventarios de módulo, contrato, catálogo de símbolos) con `update-docs`. La nota de intención de `docs/README.md` se actualiza en fase 2.

### Out of Scope

- Set completo IEC 60617 (solo se usa la convención ANSI/NEMA sobre el set actual, D7).
- Hardware PLC real, I/O física, protocolos industriales (Modbus, etc.).
- APIs de servidor (`server/` sigue siendo solo estático + healthz).
- Reescritura completa del editor de diagrama o de los estilos.
- Auto-layout que escriba posiciones automáticamente (choca con drag del usuario y con el formato de snapshot).
- Lienzo con carriles fijos (descartado por D8).
- Borrado de componentes huérfanos (descartado por D3).

## Decision Log

Todas las decisiones están **RESOLVED** (confirmadas por el usuario el 2026-10-29). Sustituyen a la antigua tabla de preguntas abiertas: cada OQ se mapea a su decisión.

| ID | Decisión | Resuelve | Consecuencias |
|----|----------|----------|---------------|
| **D1** | **Fuente de verdad: el motor PLC (`plc-engine`) es la ÚNICA fuente de valores de tags, a largo plazo.** El solver de UI (`DiagramBuilder` `computeElectricalState` / `resolvePhysicalInstructionTagValues`) deja de ser fuente de tags. El cableado se compila a programa del motor (renglones/instrucciones) y el motor decide. El solver puede quedar **solo como ayuda visual de flujo de energía que LEE tags del motor**, sin lógica propia. | OQ-a | Fase 2 re-scoped: "Compilar el cableado a programa del motor y retirar el solver como fuente de tags". Paridad antes de retirar + punto de rollback. Riesgo R-A pasa a riesgo de migración. Actualizar nota de intención de `docs/README.md` en fase 2. |
| **D2** | **Reset/Stop**: Stop conserva tags latcheados. Reset borra salidas latcheadas y enclavamientos. Editar el diagrama conserva el estado **por nombre de tag**. Reset es un **dispositivo de entrada** (tag de entrada), disparable desde un pulsador de reset del diagrama y desde el panel de control, no solo un botón de UI. | OQ-d | Fase 1 (semántica y tag de reset en el motor). Fase 5 (pulsador de reset en panel, Run/Stop/Reset con esta semántica). |
| **D3** | **Huérfanos** (`ControlPanel`, `StatusDisplay`, `TracePanel`, `LadderDisplay`): **reutilizar** en el nuevo layout de fase 5. Ninguno se borra. | OQ-b | Fase 5 integra los cuatro; fase 6 decide loaders de `projectData.ts` sin borrar componentes. |
| **D4** | **TON/TOF**: preset en **milisegundos**; se elimina el retardo oculto de 250 ms (`TIMED_CONTACT_ACTUATION_DELAY_MS`, `programRunner.ts` L15). | OQ-c | Fase 1: criterios de TON/TOF. Algunos tests existentes pueden requerir actualizar expectativa; se justifica en changelog. |
| **D5** | **Dependencias**: aprobadas **vitest** (en `ui`) y **Playwright** (E2E). Sin otras dependencias nuevas. | OQ-e | NF3. Fases 2, 5, 6. |
| **D6** | **Nombres**: identificadores de código en inglés; textos de UI en español. | OQ-f | NF6. |
| **D7** | **Símbolos**: convención ANSI/NEMA **sobre el set actual** (refuerzo, no reescritura). | Nuevo | Fase 3 y R3. IDs de tipo existentes se mantienen. |
| **D8** | **Modelo de dibujo**: lienzo **libre con snap-to-grid**, no carriles de renglón fijos. | Nuevo | R2, fase 4. |
| **D9** | **OR de bobinas**: varios renglones que escriben la misma bobina se combinan con **OR** en el motor (no hay last-writer-wins). Prioridad OTU > OTL > OTE sobre un mismo tag. | Nuevo (OD-1, fase 1) | Fase 1 (`programRunner.ts`, quita L126 last-writer-wins). R5 y bug 1. |
| **D10** | **Paro de emergencia**: E-stop borra los latches OTL; no hay rearranque automático al soltar el paro. | Nuevo (OD-2, fase 1) | Fase 1. Reset es el único borrado de latches además de E-stop. Fase 5 (panel). |
| **D11** | **Stop**: `stop()` de-energiza las bobinas no latcheadas; los latches persisten. | Nuevo (OD-3, fase 1) | Fase 1. Complementa D2 ("Stop conserva tags latcheados"). |
| **D12** | **Reset**: tag reservado **`SYS:RESET`** (flanco de subida), más API `reset()`. Cualquier dispositivo cableado a `SYS:RESET` puede actuar como reset (pulsador de diagrama o de panel). | Nuevo | Fase 1 (motor), fases 3 y 5 (UI). Refina D2. |
| **D13** | **Entradas de seguridad y temporizadores**: ESTOP y OLR (sobrecarga) tratan un tag de dispositivo **no definido (UNSET)** como sano; XIC/XIO genéricos mantienen el default `false`. TON/TOF: `powerAfter = Q`. | Nuevo | Fase 1 (`programRunner.ts`, `tagMemory.ts`). Refina D4. |
| **D14** | **Fase 3 (símbolos)**: TON/TOF como **bloques nuevos**, manteniendo los glifos NOTC/NCTO; `RESET_BUTTON` con tag fijo `SYS:RESET`; motor 6T/9T/12T como **tipos separados** con terminales cosméticos; `TraceStep.tripped` aditivo; el ID `LAMP` se conserva con etiqueta **"Luz piloto"**. Aceptados los defaults OD3-1..5. | OD3-1..5 (fase 3) | RESOLVED (2026-10-29). Fase 3 (`phases/phase-3.md`, `implementation/phase-3-impl.md`). IDs de tipo existentes se mantienen (D7). |
| **D15** | **Documentación**: no se crea catálogo de docs en fase 3; la decisión de docs se difiere a fase 6. | Nuevo | RESOLVED (2026-10-29). Fase 6 decide el alcance de `docs/` (README, inventarios, contrato, catálogo de símbolos). |
| **D16** | **Baseline de fase 3**: solo los 3 fixes de alineación de símbolos aprobados modificaron el markup existente (PUSH_BUTTON_NC `cy`, SWITCH_1P `cx`, BREAKER_1P círculo+labels); las otras 44 claves del baseline quedan byte-idénticas. `BREAKER_2P` y `GUARDAMOTOR` mantienen px en bruto (fuera de alcance de fase 3). | Nuevo | RESOLVED (2026-10-29). R-E (módulos de símbolos) parcialmente ejecutado en fase 3; resto en fase 4. |
| **D17** | **Hoja tipo plano (fase 4)**: las marcas de zona se derivan del tamaño de celda de la rejilla mayor; el snapshot v2 conserva posiciones en **px** (no en unidades de rejilla); el cuadro de título se edita desde la tarjeta "Hoja" del inspector (Proyecto/Fecha/Escala/Página); `BREAKER_2P` y `GUARDAMOTOR` se alinean a la retícula de terminales en fase 4 (el diferido de D16 queda resuelto). | Nuevo | RESOLVED (2026-10-30). Fase 4 (`phases/phase-4.md` Result). Baseline de fase 4: solo las 4 claves `BREAKER_2P` regeneradas. |
| **D18** | **Panel de actuación (fase 5)**: la actuación de dispositivos del panel pasa **solo** por el handle del builder → canal `deviceInputs`; Run/Stop/Reset viven **solo en el panel** (se quitan del builder, colocación única, OD5-3); `LadderDisplay` + `TracePanel` van en un drawer de debug con pestañas; el hold de pulso de un scan se limita a `SYS:RESET` (OD5-4). | Nuevo | RESOLVED (2026-10-30). Fase 5 (`phases/phase-5.md` Result). |

| **D19** | **Retirada de tipos (fase 7)**: los 11 tipos quitados de la paleta/UI (`RESET_BUTTON`, `GUARDAMOTOR`/`MPCB`, `DISCONNECT_SWITCH`, `TON`, `TOF`, `OTL`, `OTU`, `MOTOR`, `MOTOR_6T/9T/12T`) se manejan con **conversión on-load**: ningún archivo antiguo deja de cargar; el mapeo preserva el comportamiento del que dependen los tests; los conflictos se escalan al agente primario. | Nuevo | RESOLVED (2026-10-30). ~~Fase 7 WP7.~~ **ANULADA por D25** (retiradas canceladas; código revertido por D24). |
| **D20** | **OTL/OTU/TON/TOF se retiran solo del dibujo**: `plc-engine`, `ladder-types`, el set de instrucciones de `projectData.ts` y los archivos `data/` los conservan (`latch-cycle-demo` etc. siguen funcionando; **sin cambios de tests de motor**). | Nuevo | RESOLVED (2026-10-30). ~~Fase 7 WP7.~~ **ANULADA por D25** (retiradas canceladas; código revertido por D24). |
| **D21** | **Cargas en diagramas**: los `MOTOR*` retirados se representan como **bobina con etiqueta + lámpara** (todos los motores eliminados). | Nuevo | RESOLVED (2026-10-30). ~~Fase 7 WP7 (mapeo de conversión on-load, D19).~~ **ANULADA por D25** (motores no se eliminan; `MOTOR` vuelve a la paleta). |
| **D22** | **Imágenes de referencia para los redraws**: solo la carpeta `reference\` (4 imágenes: `Emergency push button.png`, `NO limit switch.webp`, `NC limit switch.png`, `Breaker 1P.png`) + la foto `New\29` como contexto del selector; **sin búsqueda web**. | Nuevo | RESOLVED (2026-10-30). Fase 7 WP8. |
| **D23** | **Diseño de glifos**: `PUSH_BUTTON_NC` vuelve a su diseño **pre-fase-3** (solo diseño; terminales siguen en la rejilla); `ESTOP` usa ese cuerpo de pulsador NC + **cabeza hongo ANSI real**. | Nuevo | RESOLVED (2026-10-30). Parcialmente anulada por D24/D26: tras el revert, `PUSH_BUTTON_NC` ya es el diseño original (sin cambios necesarios); el hongo ANSI de ESTOP se mantiene en el alcance de WP8. |
| **D24** | **FULL REVERT a git HEAD (570779c), aprobado por el usuario.** Los cambios de código de la sesión (fases 1-6) se revirtieron: archivos tracked restaurados, archivos untracked creados en la sesión eliminados; se conservan `plans/` y los archivos nuevos de `docs/`. Motivo: el usuario reportó que el proyecto "worked perfectly before" — peores visuales, peor layout y lógica distinta tras las fases 1-6. Verificado: `pnpm install` OK, `pnpm -r build` OK, plc-engine **7/7** (la suite original). | Nuevo | RESOLVED (2026-10-30). Las fases 1-6 quedan como registro histórico (docs marcados). Fase 7 re-scoped (D26). |
| **D25** | **Retiradas CANCELADAS (no se borra nada)**: reset button, MPCB/guardamotor, interruptor de seguridad, TON/TOF, bobinas OTL/OTU y motores **NO se eliminan**. Casi ninguno existía en HEAD (se añadieron en fase 3), así que el revert ya los ausenta. `MOTOR` (glifo original) **debe ser alcanzable**: se añade a la paleta (existe como tipo pero no estaba en la paleta original). Anula las retiradas de D19/D20/D21. | Nuevo | RESOLVED (2026-10-30). WP7 de fase 7 eliminada; `MOTOR` entra en el alcance de WP8. |
| **D26** | **El trabajo restante es solo de símbolos sobre la base de código original**: adiciones aditivas (ESTOP, `LIMIT_SWITCH_NO`/`NC`, contacto OL, entrada `MOTOR` en paleta) + redraws de glifos (`SWITCH_1P` según `selector.webp`, `BREAKER_1P` según `Breaker 1P.png`). Motor, tipos ladder, layout, rejilla/panel, solver y lógica quedan **EXACTAMENTE como en HEAD** (comportamiento original, incluidas sus peculiaridades). `PUSH_BUTTON_NC` queda como el diseño original (ítem 1 del usuario satisfecho con el revert). | Nuevo | RESOLVED (2026-10-30). Alcance de fase 7 (D26/D27). |
| **D27** | **Trabajo de código de las fases 1-6 descartado por D24**; sus documentos de fase permanecen como registro histórico de la implementación descartada. Los docs `phase-1..phase-6.md` se marcan con una sola línea: "code reverted by D24 (2026-10-30); kept as historical record" (sin reescribir su contenido). | Nuevo | RESOLVED (2026-10-30). Nota aplicada en los 6 archivos de fase. |
| **D28** | **`BREAKER_1P` aprobado tal cual** (ítem 6 del redraw CANCELADO): el usuario aprobó el diseño original de HEAD; el glifo queda **byte-idéntico**, sin redraw según `Breaker 1P.png`. | Nuevo | RESOLVED (2026-10-30). WP8 de fase 7: ítem (6) → "sin cambios". |
| **D29** | **De la implementación descartada se porta SOLO la hoja completa/alignment** (fase 4): rejilla SVG, marco, zonas, cuadro de título + tarjeta "Hoja", snap single-source + clamp fix, congruencia de retícula de terminales para todos los tipos (incluidos los nuevos de WP8), migración snapshot v1→v2 (los archivos viejos cargan) y tests de alineación. **NO se portan**: cambios de motor de fases 1/2, symbol restyles de fase 3, side panel de fase 5. Excepción: `BREAKER_1P` intacto (D28); el cambio de terminales/viewBox de `BREAKER_2P` queda marcado para sign-off. | Nuevo | RESOLVED (2026-10-30). WP9 de fase 7. Fuente: checkpoint `C:\Users\Johan\AppData\Local\Temp\opencode\phase5-base\src\diagram\`. |
| **D30** | **Trabajo de cables = limpieza de trazado** (re-simplificar wires al mover componentes, quitar quiebros redundantes; portar `normalize`/`simplify` del `grid.ts` del checkpoint si ayuda); **click derecho CANCELA** un cable en progreso; **menú flotante al left-click en un componente** con duplicar, rotar, eliminar, editar etiqueta. No es una reescritura del sistema de cables. | Nuevo | RESOLVED (2026-10-30). WP10 de fase 7. |
| **D31** | **Dependencias (fase 7)**: `vitest` aprobado en `ui` como dependencia **solo de tests** (para los tests de alignment/snapshot de WP9). **Sin Playwright ni ninguna otra dependencia nueva.** | Nuevo (refina D5 para fase 7) | RESOLVED (2026-10-30). NF3 actualizada para fase 7. |
| **D32** | **Menú de componente = click derecho; click izquierdo cancela el cable solo en el punto de origen (terminal o punto del lienzo)**. El handler del menú vive en la raíz `.freeplay-component` (funciona sobre glifo, press-target, etiqueta y puertos); el click izquierdo ya no abre el menú. Cancelación por origen: `isWireOriginHit(draftPoints, point, tolerance = 6)` (`ui/src/diagram/interaction.ts`) en el `onClick` de terminal y en `handleCanvasClick`; el click derecho sigue cancelando (canvas) y burbujea desde un componente. Se retira el código muerto `shouldOpenComponentMenu` / `COMPONENT_MENU_CLICK_THRESHOLD` / `componentPointerDownRef`. | Nuevo | RESOLVED (2026-10-30). WP12(a) de fase 7. Corrige el gesto de WP10 (D30c abría con click izquierdo). |
| **D33** | **Los simbolos se migran a los SVG del usuario tal cual (copiados completos, con fill-rule=evenodd para los subpaths huecos); el mapeo solo escala/traslada para que los anillos caigan en la reticula de terminales**. `LIMIT_SWITCH_NO` (viewBox 1024x768, path compuesto de 3 subpaths, bornes 13/14 como paths) y `LIMIT_SWITCH_NC` (viewBox 220x53, path compuesto de 4 subpaths + 4 paths de etiqueta 11/12) se renderizan como `diagram-symbol__vector` con `fill-rule="evenodd"`; NC mapeado con `translate(1.95 10.99) scale(0.568)` → anillos (66.99,37)/(151.49,37) a (40,32)/(88,32). NO y NC comparten `case` con 4 combinaciones (NO abierto / NO cerrado / NC cerrado / NC accionado). | Nuevo | RESOLVED (2026-10-30). WP12(b)(c)(d) de fase 7. Ambas copias SVG deben ser completas: truncar el path izquierdo del NO pierde el hueco de la cuchilla. |
| **D34** | **Los símbolos se migran a los SVG del usuario copiados completos y con fill-rule=evenodd; el mapeo solo escala/traslada a la retícula y el peso se normaliza con un stroke de 2 unidades del viewBox aplicado solo al contorno (stroke-width = 2/escala), dejando intactos los huecos decorativos. Procedimiento en docs/vector-symbol-pipeline.md**. | Nuevo | RESOLVED (2026-10-30). WP12c de fase 7. Dos capas de render: relleno exacto (`.diagram-symbol__vector`) + contorno (`--outline`); NO `stroke-width ≈ 14.256`, NC ≈ 3.521. Documentado en [docs/vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md). |
| **D35** | **Los símbolos migran por el pipeline de docs/vector-symbol-pipeline.md; los SVG de trazo fijan el peso con stroke-width local, los de relleno con la capa de contorno, y el orden de pintado del SVG original se respeta. Si el arte nativo ya supera 3.2 unidades se deja tal cual.** | Nuevo (WP13) | RESOLVED (2026-10-30). Fase 7 Deliverable 7: `POWER_SOURCE` (AC source, nativo ~4.0 u sin normalizar), `SWITCH_1P` (SPST de trazo, `3.2/0.365714 ≈ 8.75` local, anillos con `.diagram-symbol__vector-ring`), `ESTOP` (2 capas, `2/0.277444 ≈ 7.21`; **re-mapeado en WP14/D36 a `0.29518`**) y `OL_CONTACT` (glifo NC `XIO` + rótulo `OL`+número). |
| **D36** | **El estado accionado del ESTOP usa el SVG (opened) del usuario; cuando el arte dibuja los anillos como círculos blancos superpuestos hay que replicarlos, no convertirlos en huecos. Los terminales se alinean re-mapeando el arte a los píxeles proyectados (8/152).** | Nuevo (WP14) | RESOLVED (2026-10-31). Fase 7 Deliverable 8: `ESTOP` accionado con `Emergency push button (opened).svg` + 2 `<circle class="diagram-symbol__vector-ring">` (`stroke-width = 3.2/0.29518 ≈ 10.84`), escala `0.29518` + `translate(-0.393 5.784)`; `OL_CONTACT` naranja `#ea580c` con patas 2.3..125.7; `LAMP` desde `Lamp_symbol.svg`; auditoría de simetría de terminales documentada en [docs/vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md#simetría-de-terminales-auditoría-2026-10-31). |
| **D37** | **El E-stop enclava**: `applyMomentaryPress/Release` distinguen ESTOP del resto de pulsadores momentáneos (click alterna accionado/liberado). **El cable se dibuja en la retícula y=68**: las patas de los símbolos deben caer exactamente ahí; se corrigió `BREAKER_1P` (D28 se flexibiliza **solo** para alineación vertical) y la fuente AC. Los bornes con anillo hueco llevan un **disco blanco debajo** para que el cable termine limpio. | Nuevo (WP15) | RESOLVED (2026-10-31). `applyMomentaryPress` togglea `isPressed` para ESTOP y `applyMomentaryRelease` lo ignora (4 tests en `ui/src/diagram/interaction.spec.ts`; ui vitest **194/194**). `POWER_SOURCE` con `ty=-39.68` y 2 discos blancos `r=45`; `BREAKER_1P` patas/anillos de y=34 a **y=32** y arco 26/8. `NOTC`/`NCTO` siguen con 2.5 px de desfase (glifo alto: bajarlos recorta las colas) → pendiente. |
| **D38** | **La altura del contenedor del glifo debe ser igual a `COMPONENT_GLYPH_HEIGHT` (102).** Estaba en **96** y producía un **desfase global de 3 px** entre el cable y la pata de **todos** los símbolos (la proyección centra el glifo en 102 px, así que el SVG arrancaba en 6 px en vez de 9). Los ajustes por símbolo (`BREAKER_1P` y `POWER_SOURCE`) **se mantienen** porque corregían desfases propios de su arte. | Nuevo (WP16) | RESOLVED (2026-10-31). `.freeplay-component__symbol-rotator { height: 102px }` (`ui/src/App.css:2156`) con comentario que lo ata a `COMPONENT_GLYPH_HEIGHT` (`ui/src/DiagramBuilder.tsx:272`); el rótulo baja 6 px y sigue dentro de los 136 px del componente. Verificado con un arnés DOM real (160x136 → rotator → svg 84 px). Documentado en [docs/vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md#alineación-del-cable-con-la-pata-causa-raíz). |
| **D39** | **El E-stop usa dos trazas distintas (reposo/accionado) con mapeo independiente; ambas comparten los rótulos y los anillos se dibujan como círculos blancos con trazo.** | Nuevo (WP17) | RESOLVED (2026-10-31). Fase 7 Deliverable 11: `ESTOP` reposo `Emergency push button.svg` (`translate(-0.193 6.482) scale(0.288588)`) y accionado `Emergency push button (opened).svg` (`translate(-0.353 6.103) scale(0.290296)`); salidas a (2.286,36)/(125.714,36) del viewBox 128x72 → terminales (8,68)/(152,68); anillos con `.diagram-symbol__vector-ring` y `stroke-width = 3.2/escala` (≈11.09 reposo / 11.02 accionado); rótulos 11/12 propios de cada SVG re-exportado (cada estado usa su propio array de paths). |

Preguntas abiertas de decisión: **ninguna**. Cualquier decisión nueva se registra aquí con ID `D39...` y changelog.

Pendientes abiertos (no decisiones, ver [phase-3 Result](phases/phase-3.md)):

- **OQ-g (bajo) Actuación de OLR/FUSE/DISCONNECT/GUARDAMOTOR desde el diagrama**: el inspector solo tiene wired breakers/selectores; falta decidir cómo se accionan estos dispositivos. Pendiente de decisión del usuario (posible fase 5).
- **OQ-h (bajo) Sign-off visual de ESTOP**: implementado por convención (hongo rojo) sin imagen de referencia; pendiente de revisión del usuario.

## Pending user sign-off

Capturas que el usuario debe revisar al final del plan (fase 6), pendientes hasta ahora:

1. **(a) Hoja de fase 4** a 1720×940 por defecto: zoom 50 % y 200 %, cuadro de título poblado.
2. **(b) Glifos `BREAKER_2P` y `GUARDAMOTOR`** contra sus cables (alineación a la retícula de terminales de fase 4).
3. **(c) Fase 5 a 1280 px**: panel abierto con un diagrama poblado (pulsador presionado desde el panel + lámpara encendida, ESTOP presionado, breaker conmutado), drawer de debug abierto en Trazo y Renglones, y panel colapsado.
4. **(d) Símbolo ESTOP** (OQ-h): sin imagen de referencia; implementado por convención (hongo rojo) — requiere aprobación explícita.
5. **(e) WP15**: E-stop enclava y libera con click · cable limpio en los anillos de la fuente AC · breaker alineado a la retícula del cable.
6. **(f) WP16**: **cable alineado con la pata en todos los símbolos** (rotator a 102 px = `COMPONENT_GLYPH_HEIGHT`).

## Definition of Done

Cada fase tiene sus propios criterios en `phases/phase-N.md`. Para cerrar el plan completo deben cumplirse **todos** (evidencia al cierre, 2026-10-30):

- [x] Todos los tests existentes de `plc-engine` (7 casos en `plc-engine/test/engine.spec.ts`) pasan, y los casos que cambien de comportamiento (p. ej. TON/TOF sin retardo de 250 ms, D4) están actualizados con justificación documentada en changelog. — **Evidencia**: `engine.spec.ts` 7/7 (plc-engine 34/34 total); 6 aserciones por D4 justificadas en el changelog de 2026-10-29 (fase 1).
- [x] Nuevos tests de `plc-engine` pasan (paralelo/OR, E-stop, sobrecarga, TON/TOF gating y preset en ms, prioridad OTE/OTL/OTU, persistencia, reset por entrada). — **Evidencia**: `plc-engine/test/{parallel-or,safety,timers,coil-priority,persistence,olr-trace}.spec.ts` → 34/34 en 7 archivos.
- [x] Tests de paridad (cableado en solver viejo vs. programa compilado en motor) pasaron **antes** de retirar el solver como fuente de tags; quedan como regresión del programa compilado. — **Evidencia**: `ui/src/parity/` F01-F12 (goldens) + M01-M06 + round-trip de `data/program-data` (35 tests en `parity.spec.ts`); informe en `implementation/phase-2-parity.md`; ejecución actual idéntica.
- [x] El solver de UI no escribe ni decide valores de tags (sólo lee tags del motor) y no contiene lógica de simulación propia. — **Evidencia**: `ui/src/solver/electricalView.ts:7` ("never writes tags"), `computeElectricalView` solo recibe `tagValues` en lectura; `legacyTagSolver.ts`/`TAG_SOURCE` retirados (WP2-9); `electricalView.spec.ts` 5 tests.
- [x] Tests de migración: snapshots v1 de fixtures y `data/` + `sample-programs/` cargan y producen el mismo circuito lógico. — **Evidencia**: `ui/src/diagram/snapshot.spec.ts` (12, v1→v2 + versión desconocida), `ui/src/projectData.samples.spec.ts` (17: cada archivo de `data/` y `sample-programs/` parsea y corre en el motor), E2E `06-snapshot-load` (carga v1 real en navegador).
- [x] Playwright E2E cubre: arranque/paro, paro de emergencia, disparo y rearme de sobrecarga, reset por pulsador, edición que conserva estado. — **Evidencia**: `ui/e2e/01-run-stop`, `02-estop`, `03-overload`, `04-edit-while-running`, `05-panel-lamp`, `06-snapshot-load` = **7/7** en una ejecución limpia.
- [ ] **Revisión visual de símbolos contra las imágenes de referencia aprobada por el usuario.** — **Pendiente del usuario** (OQ-h: ESTOP sin imagen de referencia; capturas de fases 4 y 5 sin aprobar, ver [Pending user sign-off](#pending-user-sign-off)). Es el único criterio abierto.
- [x] `pnpm build` y `pnpm test` en raíz pasan. — **Evidencia**: `pnpm test` → ui **501/501 (20 archivos)** + plc-engine **34/34**; `pnpm -r build` OK; `cd ui && npx tsc --noEmit` 0.
- [x] `docs/` actualizado (README + inventarios de módulo) y el análisis marcado como superado donde corresponda. — **Evidencia**: [docs/README.md](../../docs/README.md) (índice, arquitectura D1, comandos), `docs/modules/{ui,plc-engine,ladder-types,server}.md`, [docs/symbol-catalog.md](../../docs/symbol-catalog.md), [docs/rules-contract.md](../../docs/rules-contract.md), `docs/DEPLOYMENT.md` (E2E), análisis con banner **Superseded**; link check **0 enlaces rotos** (92 enlaces relativos / 25 archivos en `docs/` + `plans/`).

## Testing Strategy

- [x] **plc-engine (vitest, Node)**: unidad por instrucción, escenarios de renglón completo, OR de ramas, E-stop, sobrecarga, timers con gating y preset en ms, prioridad OTE/OTL/OTU, persistencia entre rebuild, Stop vs. Reset. Regresión de los 7 casos actuales. — **Hecho**: 34/34 en 7 specs (`plc-engine/test/`); los 7 casos originales intactos salvo las 6 aserciones de D4 justificadas.
- [x] **ladder-types**: vitest si el contrato de reglas vive aquí (tests de tipos/guards y del contrato). — **No aplica**: el contrato quedó documentado en [docs/rules-contract.md](../../docs/rules-contract.md) y `ladder-types` sigue sin lógica (NF2); sin tests propios, como se decidió.
- [x] **Paridad solver viejo ↔ programa compilado** (fase 2): fixtures de circuito (JSON) ejecutados por ambos evaluadores antes de retirar el solver; comparar tags por scan. Fallo = bloqueo de retirada y fases siguientes. — **Hecho** en fase 2 (F01-F12 + round-trip); queda como regresión del programa compilado (`ui/src/parity/`).
- [x] **Migración**: fixtures v1 reales (de `data/`, `sample-programs/` y un snapshot v1 capturado) → v2 → mismo resultado lógico; rechazo explícito de versiones desconocidas. — **Hecho**: `snapshot.spec.ts` (v1→v2 + rechazo), `projectData.samples.spec.ts` (17 tests), E2E `06-snapshot-load`.
- [x] **UI (vitest + Testing Library)**: parser/serializer de snapshot, helpers de snap a rejilla, cálculo de zonas. Sin snapshots visuales frágiles. — **Hecho**: `snapshot.spec.ts` (12), `grid.spec.ts` (8), `sheet.spec.tsx` (7), `alignment.spec.ts` (236); total ui 501/501.
- [x] **Playwright E2E (default para cambios visuales)**: flujos de la sección Definition of Done. Ejecutar en fase 5 y 6. — **Hecho** (fase 6): 7/7 (`pnpm test:e2e`).
- [ ] **Revisión visual manual**: símbolos vs. imágenes de referencia (fase 3) y hoja (fase 4); capturas guardadas en `implementation/`. — **Pendiente del usuario** (OQ-h + capturas; ver [Pending user sign-off](#pending-user-sign-off)).

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Motor PLC: lógica de enclavamiento, paro y reset | [Detail](phases/phase-1.md) | done (code reverted by D24) |
| 2 | Compilar el cableado a programa del motor y retirar el solver como fuente de tags | [Detail](phases/phase-2.md) | done (code reverted by D24) |
| 3 | Símbolos ANSI/NEMA | [Detail](phases/phase-3.md) | done (code reverted by D24) |
| 4 | Hoja tipo plano + migración de snapshot v2 | [Detail](phases/phase-4.md) | done (code reverted by D24) |
| 5 | Reshape de UI: hoja + panel físico | [Detail](phases/phase-5.md) | done (code reverted by D24) |
| 6 | Migración de datos, E2E y documentación | [Detail](phases/phase-6.md) | done (code reverted by D24) |
| 7 | Símbolos sobre el código original + hoja completa + cables/menús (D26, D29, D30) | [Detail](phases/phase-7.md) | done |

Orden estricto: 1 → 2 → 3 → 4 → 5 → 6 → 7. Fase 3 puede empezar tras fase 2 aunque sus dependencias formales sean solo fase 1; no se ejecutan en paralelo.

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| **R-A (alto) Migración del solver a motor (D1)**: al compilar el cableado a programa del motor, el comportamiento visible del diagrama puede cambiar respecto al solver actual. | Regresiones de lógica durante la retirada; pérdida de confianza del usuario. | Paridad sobre fixtures **antes** de retirar el solver como fuente de tags (fase 2, bloqueante); punto de rollback explícito antes del corte; el solver residual solo lee tags, así que no hay doble lógica que mantener. |
| **R-B (alto) Compatibilidad de snapshots y datos**: cambiar `BuilderComponent`/`BuilderWire` puede romper archivos guardados. | Pérdida de circuitos de usuarios; `data/` y `sample-programs/` no cargan. | Versión v2 con migración automática; fixtures v1 en tests; fases 4 y 6 con verificación. |
| **R-C (medio) Cambio de semántica del motor** (timers gating y sin retardo 250 ms, OR, persistencia). | Tests antiguos fallan o cambian de significado. | Revisar los 7 casos existentes en fase 1 y documentar cada cambio de expectativa en el changelog. |
| **R-D (medio) Finales de línea**: 48 archivos modificados por CRLF (analysis §1, nota). | Diffs ruidosos, conflictos al revisar. | Normalizar EOL o documentar antes de fase 1 (acción en todo.md). |
| **R-E (medio) `DiagramBuilder.tsx` tiene 6866 líneas**. | Cambios de alto riesgo y revisión difícil. | Dividir en módulos (símbolos, solver de vista, rejilla, snapshot, compilador a programa) durante fases 2-4. |
| **R-F (medio) Alcance grande** (6 fases, 3 paquetes). | Plan no termina en una sesión; deriva. | Fases secuenciales con handover al cerrar cada una; criterios de aceptación por fase. |
| **R-G (medio) Persistencia de estado vs. edición**: al editar un circuito, el estado previo puede no corresponder a los tags nuevos. | Enclavamientos "fantasma" o valores inconsistentes. | Regla de preservación por nombre de tag (D2); reset por entrada; test E2E de edición. |
| **R-H (bajo) Dependencias de test**: vitest en `ui` y Playwright son las únicas aprobadas (D5). | Tentación de añadir librerías de UI. | NF3: cualquier otra dependencia requiere nueva aprobación registrada en Decision Log. |

## Changelog

<!-- Append-only log of significant changes to this plan -->

### 2026-10-29

- Plan created (borrador, pendiente de confirmación del usuario).
- Plan approved; decisions recorded (see Decision Log). Status `draft` → `approved`. Fases siguen `pending`. OQ-a..OQ-f resueltas como D1-D6; añadidas D7 (ANSI/NEMA sobre set actual) y D8 (lienzo libre con snap). Fase 2 re-scoped a "Compilar el cableado a programa del motor y retirar el solver como fuente de tags". R-A reformulado como riesgo de migración.
- Decisiones D9-D13 registradas (OR de bobinas, E-stop borra latches, Stop de-energiza no latcheadas, reset como `SYS:RESET`, UNSET = sano en ESTOP/OLR y TON/TOF powerAfter = Q).

### 2026-10-29 (fase 1)

- Phase 1 implemented (engine logic). Gates: vitest 31/31, tsc, pnpm -r build. Fase 1 `pending` → `done`. Fase 2 pasa a siguiente.
- Test expectations changed by D4 (250 ms removed): `plc-engine/test/engine.spec.ts` L80, L83 (NOTC) y L121, L124 (NCTO) pasan de false/true a true/false porque el preset se cumple en el scan en que se alcanza; L171 y L176 (timers con mismo label) pasan a true al cumplirse el preset sin retardo extra. Ningún caso eliminado. 24 casos nuevos en 5 archivos de spec.

### 2026-10-29 (fase 2)

- Phase 2 implemented; WP2-9 legacy removal done. Compilador `ui/src/compiler/`, `EngineSession`, solver de vista `ui/src/solver/electricalView.ts`, paridad F01-F12 + motor + round-trip con goldens. Gates: plc-engine 32/32, ui tsc 0, ui vitest 56, `pnpm -r build` OK. Fase 2 `pending` → `done`. Navegador no verificado (E2E en fase 6).
- Cambios de comportamiento: `runnableRungs` F10 0→1, F11 0→2; breakers con `isClosed ?? true`.
- Decisiones D14 (fase 3) y D15 (docs diferido a fase 6) registradas.

### 2026-10-29 (fase 3)

- Phase 3 implemented (ANSI/NEMA symbols). Nuevos módulos `ui/src/diagram/symbols.tsx`, `symbolGeometry.ts`, `palette.ts`; `projectData.ts` acepta ESTOP/OLR/TON/TOF (`delayMs`); whitelist de snapshot actualizada; bindings `deviceMapping.ts` incl. `SYS:RESET`; `TraceStep.tripped` en el motor; OLR vía trace. Gates: ui tsc 0, ui vitest 181/181, plc-engine 34/34, `pnpm -r build` OK. Baseline diff = solo los 3 fixes de alineación aprobados (D16); otras 44 claves byte-idénticas. Fase 3 `pending` → `done`; fase 4 pasa a `in_progress`. Catálogo de `docs/` diferido a fase 6 (D15).
- Pendientes abiertos (fase 3): OQ-g (actuación de OLR/FUSE/DISCONNECT/GUARDAMOTOR desde el diagrama) y OQ-h (sign-off visual de ESTOP). Ninguno bloquea fase 4.

### 2026-10-30 (fase 4)

- Phase 4 implemented (hoja tipo plano + snapshot v2): nuevo `ui/src/diagram/grid.ts`, `sheet.tsx` (rejilla SVG mayor/menor, marcas de zona, marco, cuadro de título, `SheetLayer`), `snapshot.ts` (`CIRCUIT_SNAPSHOT_VERSION = 2`, `migrateCircuitSnapshot` v1→v2 con defaults de hoja, versión desconocida rechazada); gradiente CSS de rejilla eliminado de `App.css` (SVG = fuente única). `BREAKER_2P` y `GUARDAMOTOR` alineados a la retícula de terminales (D16 diferido resuelto); tarjeta "Hoja" en el inspector. Gates: ui tsc 0, ui vitest 450/450 (236 de alineación), `pnpm -r build` OK. Baseline: solo las 4 claves `BREAKER_2P` regeneradas. Fase 4 → `done`; fase 5 → `in_progress`. Decisión D17 registrada. Incidente: `DiagramBuilder.tsx` vaciado por una edición fallida y restaurado byte-idéntico desde el checkpoint.

### 2026-10-30 (fase 5)

- Phase 5 implemented (hoja + panel físico): nuevos `ui/src/panel/{model,panelControls,panelActuation,SidePanel}.ts(x)` — `SidePanel` con `ControlPanel` (Run/Stop/Un scan/Reset/reset de fallo), controles por dispositivo (momentáneo, mantenido, ESTOP, sensor, trip, FUSE, luces de motor/lámpara desde tags del motor), `StatusDisplay` (excluye `__builder_device__`) y drawer de debug con pestañas Trazo (`TracePanel`) y Renglones (`LadderDisplay`). `DiagramBuilder` expone handle `forwardRef` (`actuateDevice`/`setMomentaryPressed`) y `onDeviceInventoryChange`; botones Run/fault-reset fuera del builder (colocación única, OD5-3). `EngineSession`: hold de pulso de un scan solo para `SYS:RESET` (OD5-4). `App`: grid hoja + panel 360 px, ≤1180 px una sola columna. Gates: ui tsc 0, ui vitest 470/470, plc-engine 34/34, `pnpm -r build` OK. Fase 5 → `done`; fase 6 pasa a siguiente. Decisión D18 registrada. Se añade sección "Pending user sign-off" (capturas de fases 4/5 + ESTOP); OQ-h sigue pendiente del usuario.

### 2026-10-30 (fase 6, cierre del plan)

- Phase 6 implemented (data compat + demo, E2E 7/7, docs): sin script de migración (delta de formato cero, OD6-1) — originales intactos como fixtures, demo aditiva `motor-guard-demo` (3 demos), `projectData.samples.spec.ts` (17 tests) carga y ejecuta cada archivo; parsers exportados y **7 loaders huérfanos eliminados** (OD6-2); Playwright en `ui` (config + `data/` como publicDir, `pnpm test:e2e` separado de `pnpm test`, OD6-3/OD6-5) con specs `01..06` = **7/7**; fix del harness de paridad (entradas de dispositivo vía `setDeviceInputs`); desviación: tercer caso de spec 06 descartado (el fixture v1 no tiene cable de retorno, no ejecutable por diseño). Docs: `docs/README.md` (índice/arquitectura D1/comandos), `docs/modules/{ui,plc-engine,ladder-types,server}.md`, `docs/symbol-catalog.md` (D15/OD6-4), `docs/rules-contract.md`, `docs/DEPLOYMENT.md` (E2E + publicDir), análisis con banner **Superseded**; link check **0 rotos**. Gates: ui tsc 0, ui vitest **501/501 (20 files)**, plc-engine **34/34**, `pnpm -r build` OK, E2E **7/7**. Fase 6 → `done`; **plan → `completed`**; handover `handovers/hoja-plano-final.md`. Único pendiente: sign-off visual del usuario (OQ-h + capturas de fases 4/5).

### 2026-10-30 (fase 7)

- Phase 7 requested by user (symbol removals + ANSI redraws). Nueva fase `phases/phase-7.md` (WP7 retiradas + conversión on-load, WP8 redraws ANSI) en `in_progress`; decisiones D19-D23 registradas como RESOLVED (convert-on-load, OTL/OTU/TON/TOF solo del dibujo, cargas = bobina + lámpara, referencias locales, NC pre-fase-3 + ESTOP hongo ANSI).

### 2026-10-30 (revert + re-scope de fase 7)

- **Full revert a HEAD (D24)**: el usuario reportó regresiones tras las fases 1-6 ("worked perfectly before"); con su aprobación se revirtió todo el código de la sesión a git HEAD (570779c). Gates de verificación: `pnpm install` OK, `pnpm -r build` OK, plc-engine **7/7** (suite original). `plans/` y los `docs/` nuevos se conservan.
- **Fase 7 re-scoped a solo símbolos (D25-D27)**: retiradas CANCELADAS (reset button, MPCB/guardamotor, interruptor de seguridad, TON/TOF, OTL/OTU y motores NO se eliminan; D19-D21 anuladas); `MOTOR` se añade a la paleta; trabajo restante = adiciones aditivas (ESTOP, LIMIT_SWITCH_NO/NC, contacto OL, MOTOR en paleta) + redraws (`SWITCH_1P` según `selector.webp`, `BREAKER_1P` según `Breaker 1P.png`) sobre la base original de HEAD. Motor, ladder-types, layout, rejilla/panel, solver y lógica quedan EXACTAMENTE como en HEAD.
- Docs de fases 1-6 marcados con nota "code reverted by D24 (2026-10-30); kept as historical record" (D27); `phases/phase-7.md` reescrito con el nuevo alcance. `todo.md` → Active Phase 7 = revert hecho + WP8 pendiente.

### 2026-10-30 (WP8 done; WP9/WP10 añadidos)

- **WP8 (símbolos) COMPLETADO**: 4 tipos añadidos (`ESTOP`, `LIMIT_SWITCH_NO`, `LIMIT_SWITCH_NC`, contacto OL) + `MOTOR` en la paleta + `SWITCH_1P` redibujado; `BREAKER_1P` queda **byte-idéntico** (redraw cancelado, aprobado por el usuario — **D28**). Gates: `pnpm -r build` 0, plc-engine **7/7**, ui tsc **29→29** (errores pre-existentes intactos). Hallazgo EOL: los archivos de HEAD son **LF** (autocrlf sin configurar); LF preservado en los edits.
- **WP9 "Hoja completa" añadida (D29)**: portar desde el checkpoint `phase5-base/src/diagram/` SOLO la hoja/alignment de fase 4 (rejilla SVG, marco, zonas, cuadro de título + inspector, snap single-source + clamp, retícula de terminales de todos los tipos incl. nuevos, snapshot v1→v2, tests de alineación). NO portado: motor fases 1/2, restyles fase 3, side panel fase 5. `BREAKER_1P` intacto; cambio `BREAKER_2P` para sign-off.
- **WP10 "Cables y menús" añadida (D30)**: limpieza de trazado (re-simplificar wires al mover componentes), click derecho cancela cable en progreso, menú flotante en componente (duplicar/rotar/eliminar/editar etiqueta).
- **D31**: `vitest` aprobado en `ui` como dependencia solo de tests (sin Playwright ni otras). Fase 7 sigue `in_progress` (WP9 → WP10); sign-off visual de WP8 pendiente (ESTOP, selector, limit switches, OL, MOTOR).

### 2026-10-30 (WP9 done)

- **WP9 done (hoja completa ported from checkpoint; 176 tests; BREAKER_2P flagged for sign-off)**. Portados `ui/src/diagram/{grid,sheet,snapshot}.ts(x)` + 4 spec files + fixture; única dependencia nueva `vitest` devDep en `ui` (^2.1.8 → 2.1.9, D31). Gates: `pnpm -r build` 0 · plc-engine **7/7** · ui tsc **28** (baseline 29; el pre-existente eliminado fue la línea borrada de la CSS-var `--grid-spacing`) · ui vitest **176/176** (alignment 149, snapshot 12, grid 8, sheet 7) · smoke dev-server HTTP 200 (puerto 5174; dev server pre-existente en 5173 detectado y dejado intacto) · migración: fixture v1 real parsea a v2 con defaults de hoja; versión desconocida rechazada. `BREAKER_1P` **byte-idéntico** (excepción dura, held); `BREAKER_2P` **alineado** (terminales y 24→15 / 78→69, shift del glifo −7.2) → **PENDIENTE de sign-off del usuario** (cambio visual + posibles endpoints de cable sueltos en circuitos 2P guardados hasta re-drag). Fase 7 sigue `in_progress`; queda WP10 (cables/menús).

### 2026-10-30 (WP10 done; fase 7 completa)

- **WP10 (cables y menús) COMPLETADO**: (a) limpieza de trazado — `moveAttachedWireEndpoints` simplifica los wires (quita colineales, duplicados y de longitud cero preservando endpoints y ortogonalidad), con re-simplificación al soltar un cable y al reconectar; (b) click derecho cancela un cable en progreso (`contextmenu` consumido solo entonces); (c) menú flotante de componente (Duplicar / Rotar / Eliminar / Editar etiqueta inline) que abre solo en click limpio (delta < 6 px), cierra con click/drag/inicio de cable/Escape, oculto en Run, con primer keydown global input-guarded. Archivos: `ui/src/diagram/{grid.ts, interaction.ts (+spec), grid.spec.ts}`, `DiagramBuilder.tsx`, `App.css`. Gates: `pnpm -r build` **0** · plc-engine **7/7** · ui tsc **28** (== baseline) · ui vitest **189/189** (+13) · smoke dev HTTP **200**.
- **Fase 7 → `done`** (WP8 + WP9 + WP10). Las 7 fases están cerradas; **único pendiente del plan: sign-off visual del usuario** (símbolos ESTOP/selector/limit NO-NC/OL/MOTOR, `BREAKER_2P` shift, hoja, menú de componente, cables simplificados, click derecho cancela cable).

### 2026-10-30

- **WP11: limit switch NC trazado desde la imagen de referencia**. `LIMIT_SWITCH_NC` redibujado píxel a píxel desde `D:\Relevant files\Download (del cel viejo)\Electricidad\Controles eléctricos\reference\NC limit switch.png` (300x300, ink bbox x43-256/y115-161; círculos ref (107,149.5)/(192,149.5) r_outer 11; barra, cuña de actuador y terminales "11"/"12"), mapeado con escala uniforme 0.571 a viewBox 128x64 (terminales (6.4,32)/(121.6,32), leads 3.2→34.5 / 93.5→124.8, círculos (40,32)/(88,32) r5.5, barra (45.5,32)→(88,26), cuña (79.4,27.4)/(75.7,38.6)/(45.5,32.5), textos x16.6/x110.3 y24); estado abierto = rotación rígida −10° de barra+cuña sobre el pivote (45.5,32) → barra (86,19), cuña (78,21.6)/(76.4,33.3). `LIMIT_SWITCH_NO` separado del NC (`case`), byte-equivalente en comportamiento; líneas de émbolo quitadas solo en NC. Gates: ui tsc 28 == baseline · ui vitest **189/189** · plc-engine **7/7** · `pnpm -r build` **0**.

### 2026-10-30 (WP12)

- **WP12: menú a click derecho, cancelación por origen, limit switch NO desde vector, NC accionado = NO**. (a) Interacción: el menú flotante de componente se abre **solo con click derecho** (handler movido a la raíz `.freeplay-component`, cubre glifo/press-target/etiqueta/puertos); el click izquierdo ya no lo abre y **cancela** el cable en progreso **solo en el punto de origen** — `isWireOriginHit(draftPoints, point, tolerance = 6)` en `ui/src/diagram/interaction.ts`, conectado al `onClick` de terminal y a `handleCanvasClick`; el click derecho durante el dibujo sigue cancelando (canvas) y sobre un componente burbujea al canvas; el menú cierra con click izquierdo (canvas/componente), drag, inicio de cable, Escape y ejecución de acción; eliminados `shouldOpenComponentMenu`, `COMPONENT_MENU_CLICK_THRESHOLD` y `componentPointerDownRef`. (b) `LIMIT_SWITCH_NO` migrado al **SVG vectorial del usuario** (viewBox 1024x768, bornes 13/14 como paths): escala uniforme 0.1403 + traslación (-7.85,-21.85) → terminales (40,32)/(88,32) r5.5 y leads 3.2/34.5 · 93.5/124.8 (misma retícula); anillos `diagram-symbol__terminal` en lugar de discos macizos; nueva clase `.diagram-symbol__vector { fill: currentColor; stroke: none; }`. (c) Cuchilla: el trazado la daba **rellena** y despegada 5 unidades del terminal; el arte original (`NO limit switch.webp`, decodificado con WPF/WIC) es un **triángulo fino hueco** con vértice en el borde del terminal 13 → `M45.5 32 L75.8 49 L81.2 42.7 Z` con `.diagram-symbol__line` (fill:none, stroke 3.2). (d) Estado accionado del **NC = NO** (petición del usuario): NO y NC comparten un `case`; cerrado = barra (45.5,32)→(88,26) + cuña del actuador; abierto = la misma cuchilla hueca; defaults NO abierto / NC cerrado; NC conserva 11/12 como texto y NO usa 13/14 del vector (tamaños ligeramente distintos → **cuestión cosmética abierta**). Gates: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` **0** · smoke dev-server **HTTP 200**; prueba visual renderizada off-line desde la misma geometría (PNG de preview) y comparada con la referencia. Decisiones **D32** y **D33** registradas.

### 2026-10-30 (WP12b)

- **(WP12b) limit switch NO/NC desde los SVG exactos**: ambos SVG del usuario copiados **completos** y renderizados con `fill-rule="evenodd"` (el path izquierdo del NO tiene 3 subpaths: contorno + hueco del anillo + **hueco de la cuchilla**; la copia truncada anterior dejaba la cuchilla maciza). `NC limit switch.svg` (220x53, 4 subpaths + 4 paths de etiqueta 11/12) mapeado con `translate(1.95 10.99) scale(0.568)` → anillos en (40,32)/(88,32). NO y NC comparten `case`: NO abierto = NO + 13/14 · NO cerrado = NC + 13/14 · NC cerrado = NC + 11/12 · NC accionado = NO + 11/12, sin `<line>`/`<circle>`/`<text>` (todo `diagram-symbol__vector`, sigue `currentColor`). Gates: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` **0** · verificado en renderer SVG real (Chrome headless) para los 4 estados.

### 2026-10-30 (WP12c) peso de trazo normalizado + pipeline de símbolos vectoriales documentado

- **WP12c**: el peso del trazo de los símbolos vectoriales se normaliza con `stroke-width = 2/escala` aplicado **solo al contorno** (NO ≈ **14.256**, NC ≈ **3.521**), no reescalando la geometría; render en **dos capas** (relleno exacto `.diagram-symbol__vector` + contorno `.diagram-symbol__vector--outline`) que deja abiertos los huecos decorativos. Ambos estados del limit switch son paths vectoriales puros (cerrado = `NC limit switch.svg`, con 11/12 como paths). Nuevo [docs/vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md) (D34), enlazado desde el índice de docs y desde el catálogo de símbolos. Sin cambios de código; gates vigentes: ui tsc **28 == baseline** · ui vitest **190** · plc-engine **7** · `pnpm -r build` **0**.

### 2026-10-30 (WP13): AC source, SPST, Emergency pb y OL desde arte del usuario

- **WP13 (símbolos) COMPLETADO**: cuatro símbolos migrados al arte del usuario y documentados en [docs/vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md#símbolos-migrados). `POWER_SOURCE` desde `AC source.svg` (980x980, `translate(-7.91 -39.49) scale(0.146087)`, viewBox **128x64**, terminales `projectSymbolPoint(6.4, 32, 64)`/`(121.6, 32, 64)`, peso nativo ~4.0 u **sin normalizar**); `SWITCH_1P` desde `SPST-Switch.svg` (347x100, `translate(3.84 7.86) scale(0.365714)`, peso de trazo `3.2/0.365714 ≈ 8.75` local, anillos `.diagram-symbol__vector-ring`, orden anillo izq → palanca → anillo der); `ESTOP` desde `Emergency push button.svg` (450.168x159.806, `translate(3.478 7.599) scale(0.277444)`, 2 capas `2/0.277444 ≈ 7.21`, bornes 11/12 vectoriales); `OL_CONTACT` = glifo NC (`XIO`) + rótulo `OL`+número desde `label` (por defecto `1`). **Decisión D35**. Gates: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` OK · smoke dev-server **HTTP 200** · capturas Chrome-headless del markup React exacto a 160 px y con zoom. Gotchas nuevas: orden de pintado del SVG original y arte nativo >3.2 u sin stroke de normalización.

### 2026-10-31 (WP14): ESTOP accionado, OL naranja, lampara y alineacion de terminales

- **WP14 COMPLETADO** (D36). **ESTOP accionado**: se añadió `Emergency push button (opened).svg` (misma retícula 450.168x159.806); el path principal tiene **5 subpaths** y en ese arte los anillos **no son huecos** (el SVG original los dibuja como **círculos blancos + trazo encima** de la traza). Render: relleno del path + contorno solo de los **3 subpaths no-anillo** + dos `<circle>` con `.diagram-symbol__vector-ring` y `stroke-width = 3.2 / escala ≈ 10.84`; se activa con `options.estopPressed` (el llamador lo calcula como `component.type === "ESTOP" && component.isPressed === true`). Sin esos círculos el anillo derecho queda **macizo**. **Re-mapeo**: escala **`0.29518`** + `translate(-0.393 5.784)` para que los extremos de las salidas caigan exactamente en los terminales proyectados (**8/152 px**), no 4.3 px adentro.
- **`OL_CONTACT`**: patas extendidas al viewBox **2.3..125.7** (antes 6.4..121.6) porque el viewBox 72 proyecta con `offsetX = 5.33`; color **naranja `#ea580c`** (`.diagram-symbol--ol`), antes rojo. **`LAMP`**: `Lamp_symbol.svg` (280x120, trazo, sin `viewBox`) mapeado al viewBox 128x64 — patas 6.4→46.72 y 81.28→121.6, círculo r=17.28 en (64,32) y X inscrita; se dibuja con `diagram-symbol__line`/`__shape` para conservar el brillo (`--lamp-glow-*`) y el relleno blanco que oculta cables.
- **Simetría de terminales**: auditoría hecha — todos los símbolos de dos terminales horizontales proyectan y redondean a (8,68)/(152,68) en coordenadas del componente. Quedan dos desviaciones conocidas de **±2.5 px** entre la línea dibujada y el terminal redondeado: `BREAKER_1P` (pata y=34 → 70.5 px vs terminal 68) y `NOTC`/`NCTO` (pata y=30 → 65.5 px vs terminal 68); **no se tocaron** (`BREAKER_1P` está aprobado byte-idéntico, D28).
- Gates: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` **OK** · capturas Chrome-headless del markup React exacto a 160 px y con zoom. Docs actualizados: [docs/vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md#símbolos-migrados) (tabla + notas de ESTOP accionado/LAMP/OL y sección de simetría de terminales).

### 2026-10-31 (WP15): E-stop enclavado + alineación de cables

- **WP15 COMPLETADO** (D37). **E-stop enclavado**: `applyMomentaryPress` (`ui/src/DiagramBuilder.tsx:618`) hace que un click accione el ESTOP y lo deje enclavado (`isPressed=true` aunque se suelte el pointer); un segundo click lo libera; `applyMomentaryRelease` (`:633`) ignora el ESTOP. 4 tests nuevos en `ui/src/diagram/interaction.spec.ts` (`:121`) → ui vitest **194/194**.
- **Fuente AC — anillos y cable**: el arte dibuja los anillos como huecos transparentes y el cable (por detrás del componente) asomaba como un muñón descentrado. Se añadieron **2 `<circle>` blancos de `r=45` en unidades fuente** (`ui/src/DiagramBuilder.tsx:1474`), bajo el mismo `transform` y **antes del vector**; el relleno tapa el cable hasta el borde exterior del anillo. Aplica a cualquier símbolo cuyo borne sea un anillo en el extremo del dibujo. `ty` de la fuente AC ajustado de −39.49 a **−39.68** (`:1382`) para que la pata caiga en **y=32** del viewBox.
- **Alineación vertical**: el cable se dibuja en la retícula **y=68 px** del componente; una pata fuera de esa línea produce un escalón. Se alineó `BREAKER_1P`: patas/anillos de **y=34 → y=32** y arco de **28/10 → 26/8** (`:1493`), rompiendo la byte-identidad de **D28** por pedido explícito del usuario sobre el alineado de cables. `NOTC`/`NCTO` siguen con pata en y=30 (2.5 px de desfase) porque su glifo es más alto y bajarlo recorta las colas del temporizado → **pendiente**.
- Gates: ui tsc **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK**. Docs: [docs/vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md#alineación-vertical-del-cable-wp15-d37) (alineación vertical, discos blancos, ESTOP enclavado, simetría actualizada).

### 2026-10-31 (WP16): causa raíz del desfase cable/pata (rotator 96→102)

- **WP16 COMPLETADO** (D38). **Síntoma**: el cable quedaba **1-3 px** desplazado en vertical respecto a la pata del símbolo (escalón visible en la unión) en **todos** los símbolos. **Causa raíz**: `projectSymbolPoint` (`ui/src/DiagramBuilder.tsx:1138`) asume `COMPONENT_GLYPH_HEIGHT = 102` (`:272`) y centra el glifo en 102 px (`SYMBOL_VIEWPORT_TOP = (102-84)/2 = 9`, `:275`), pero `.freeplay-component__symbol-rotator` medía **96 px**: el SVG de 84 px arrancaba en **6 px** en vez de 9 y la pata caía **3 px por encima** del terminal proyectado. **Arreglo**: `height: 102px` en el rotator (`ui/src/App.css:2156`) con comentario que lo ata a `COMPONENT_GLYPH_HEIGHT`; verificado con un arnés que replica la estructura DOM real (contenedor 160x136 → rotator → svg 84 px) y un cable en la y proyectada (96 px = escalón, 102 px = coincidencia exacta). El rótulo baja 6 px y sigue dentro de los 136 px del componente. Los ajustes por símbolo de WP15 (`BREAKER_1P`, `POWER_SOURCE`) se mantienen (corregían desfases de su propio arte). **Regla**: si cambia `COMPONENT_GLYPH_HEIGHT`, cambia también la altura del rotator; deben ser el mismo número.
- Gates: ui tsc **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK**. Docs: [docs/vector-symbol-pipeline.md · Alineación del cable con la pata (causa raíz)](../../docs/vector-symbol-pipeline.md#alineación-del-cable-con-la-pata-causa-raíz).

### 2026-10-31 (WP17): E-stop con las nuevas trazas normal/opened

- **WP17 COMPLETADO** (D39). El ESTOP usa ahora el **par de trazas nuevas** del usuario en lugar de las anteriores: **reposo** `Emergency push button.svg` (salidas + barra + seta, **3 subpaths sin huecos**; anillos = 2 círculos blancos + trazo aparte) y **accionado** (`isPressed`) `Emergency push button (opened).svg` (misma estructura; la barra queda **~20 unidades fuente más abajo**).
- **Mapeo independiente por estado**: las trazas no comparten la línea de bornes (centros `y=102.28` vs `y=99.35` en unidades fuente), así que cada estado calcula su escala/traslación para que el extremo de las salidas caiga en **(2.286,36)/(125.714,36)** del viewBox **128x72**, que proyecta a los terminales **(8,68)/(152,68)**. Reposo: `translate(-0.193 6.482) scale(0.288588)`, `stroke-width = 2/escala ≈ 6.93`. Accionado: `translate(-0.351 7.173) scale(0.290154)`, `stroke-width ≈ 6.89`.
- **Rótulos y anillos**: los rótulos **11/12 son los mismos paths en ambos estados** y usan la transformación del estado activo. Los anillos se dibujan **siempre** como `<circle class="diagram-symbol__vector-ring">` (blanco + trazo `currentColor`) después del relleno/contorno, con `stroke-width = 3.2/escala` (≈ **11.09** reposo / **11.03** accionado).
- Constantes en `ui/src/DiagramBuilder.tsx:1398` (reposo `:1405`, accionado `:1412`); render en `:1673`; anillos en `:1696`; rótulos en `:1708`; activación en el call site `:6433`. Docs: [docs/vector-symbol-pipeline.md · Símbolos migrados](../../docs/vector-symbol-pipeline.md#símbolos-migrados).
- Gates: ui tsc **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK**. Sign-off: **E-stop reposo (seta arriba + barra cerrada)** · **E-stop accionado (seta hundida + barra suelta)**.

### 2026-10-31 (WP18): E-stop re-exportado (traza abierta y rótulos nuevos)

- **WP18 COMPLETADO** (D39 actualizado). Los dos SVG en `reference/` se re-exportaron: la traza **abierta** cambió (la barra y la línea de bornes bajaron; pata en `y=102.99`) y **cada SVG trae ahora sus propios paths de 11/12** (los dígitos se movieron con el arte).
- **Mapeo recalculado**: accionado `translate(-0.353 6.103) scale(0.290296)`, `stroke-width = 2/escala ≈ 6.89`, anillos `3.2/escala ≈ 11.02`. Reposo sin cambios (`translate(-0.193 6.482) scale(0.288588)`).
- **Rótulos por estado**: `ESTOP_VECTOR_LABEL_PATHS` (reposo) y `ESTOP_VECTOR_OPEN_LABEL_PATHS` (accionado); el render elige según `isPressed`. Anillos: `ESTOP_VECTOR_RINGS` / `ESTOP_VECTOR_OPEN_RINGS`.
- Constantes extraídas de los archivos con script (paths[2..5] = dígitos, paths[6] = traza principal, círculos/elipse = anillos). Gates: ui tsc **28** · vitest **194/194** · engine **7/7** · build **OK**. Verificado con Chrome headless a 200 y 450 px.

### 2026-10-31 (WP19): cableado — uniones deliberadas, puentes, rotación y menú

- **Uniones deliberadas**: `findNearestWireSegmentAnchor` usa `WIRE_ANCHOR_DISTANCE = 4` en vez de `SNAP_DISTANCE = 18`; antes cualquier click dentro de una celda se fusionaba con el cable. Los terminales conservan la tolerancia de 18.
- **Puentes en cruces**: nuevo `ui/src/diagram/wireHops.ts` (`findWireCrossings`, `buildWirePathD`, `WIRE_HOP_RADIUS = 5`). Los cruces horizontal/vertical sin punto compartido se dibujan con un arco (Q) sobre el otro cable, como en un plano eléctrico; un nodo compartido (union eléctrica) no lleva puente. 6 tests nuevos.
- **Rotación**: `detachWiresFromComponent` suelta los cables del componente al rotar (conservan sus puntos, pierden `startPortId`/`endPortId`); ya no se mueven con el giro ni se duplican.
- **Menú de cable (click derecho)**: Eliminar, Color (`input type=color`), Grosor (2/3.5/5/7) y Simplificar, con `wireMenu` y helpers por id (`deleteWireById`, `updateWireColorById`, `updateWireThicknessById`, `simplifyWireById`). Se cierra con click/context/Escape/acción.
- **Feedback al dibujar**: los nodos de cable son `pointer-events: none` mientras el modo cable está activo (el click llega al canvas y engancha al nodo) y se dibuja un marcador discontinuo en el punto de enganche (`freeplay-wire__snap-marker`).
- Gates: ui tsc **28 == baseline** · ui vitest **204/204** · plc-engine **7/7** · `pnpm -r build` **OK**. Verificado el puente con Chrome headless.

### 2026-10-31 (WP20): geometría de terminales, topología de cables, lógica no dirigida y plano

- **D40 — geometría**: `SYMBOL_VIEWPORT_TOP` vuelve a **9** (centro puro) y se elimina el `top: -1px` de `.freeplay-component__glyph .diagram-symbol`. Con `ROTATION_CENTER_Y = 51`, todos los viewBox (64/60/72) proyectan la pata en `y=51`; con componentes en la retícula (`y % 18 = 3`) los terminales caen en múltiplos de 18. Las posiciones guardadas del circuito de referencia ya eran correctas para esta geometría; el parche de 1 px era la causa del desfase.
- **D41 — reconciliación**: nuevo `ui/src/diagram/wireTopology.ts` (`reconcileWireTopology`). En load/save/commit/reconnect/drag/rotate: endpoints con puerto al terminal exacto (sin tolerancia de 3 px); extremo nulo a ≤4 px de un terminal se conecta y obtiene puerto; a ≤2 px de un vértice/segmento se fusiona e inserta el punto de unión; si no coincide con nada, **se elimina el cable** y se reporta. Reconstruye el trazado ortogonal desde los extremos fijados y elimina escalones de 1–2 px.
- **D42 — normalización**: `cleanWirePath` limpia duplicados/quiebres menores sin cuantizar a la rejilla; `insertPointIntoWire` inserta el punto exacto; `moveAttachedWireEndpoints` mueve el extremo exacto aunque el delta sea <3 px.
- **D43 — lógica**: `buildResolvedPortGraph` colapsa las redes de `buildElectricalNodeGraph` (clique de puertos por red, no cadena); `collectRungPaths` es no dirigido (entra por cualquier borne, sale por el par) y las bobinas terminan por cualquiera de sus bornes. Se arranca solo desde el borne de alimentación de la fuente; se conservan los caminos maximales por bobina. El circuito de referencia deriva M, TR1, Y y D.
- **D44 — puentes**: `findWireCrossings` exige cruce estrictamente interior a ambos segmentos; descarta extremos, esquinas, T, nodos compartidos y segmentos nulos. **El cable más nuevo** (sufijo numérico del id) dibuja el puente, sin depender del orden del array. `buildWirePathD` omite arcos que no caben cerca de un extremo.
- **D45 — plano/UI**: Pan **off por defecto**; solo desde el fondo y con umbral de 4 px; no se reinicia al cargar. Los inputs Ancho/Alto/Rejilla usan borrador local y confirman en blur/Enter (Esc revierte). Ancho/Alto solo recortan lo que queda fuera; Rejilla re-cuantiza todo al confirmar. Al arrastrar cerca del borde inferior/derecho el plano crece en vez de aplastar la fila.
- **D45b — subpíxel**: se quitan `filter: drop-shadow` del rotador y de los cables seleccionados/energizados, `will-change` y la transición de escala del canvas; zoom en pasos de 0.05 y scroll redondeado a enteros. Objetivo: que la capa HTML de componentes y el SVG de cables no se desplacen entre sí al hacer scroll/zoom.
- **D rung**: se deja como está (decisión del usuario). `XIC D` en serie con `NOTC TR1` no puede arrancar desde reposo porque `D` solo lo escribe `OTE D`; queda documentado, no se cambia la lógica.
- **Tests**: nuevo `ui/src/diagram/reference-circuit.spec.ts` con el circuito guardado como fixture; valida reconciliación (28 cables, sin borrados), idempotencia, rungs M/TR1/Y/D y simulación física (M, lámpara paralela, TR1; M enclavado tras soltar). `wireHops.spec` cubre cruce real, T, esquina, nodo compartido, paralelos y orden. `grid.spec` cubre `cleanWirePath` y `clampSceneBounds`.
- Gates: ui tsc **25** (por debajo del baseline 28; sin errores nuevos) · ui vitest **212/212** · plc-engine **7/7** · `pnpm -r build` **OK**. Verificado el circuito de referencia con un render SVG headless (terminales y extremos de cable coincidentes).

### 2026-11-01 (D46): error creciente con la Y — content-box del canvas y snap de terminales

- **Causa raíz**: `.freeplay-canvas` tenía `border:1px` con `box-sizing:border-box`; su content-box era **1718×938**, pero el SVG de cables tenía `viewBox 1720×940` y `width/height:100%`. Los cables se escalaban **0.99787** y los componentes HTML no: el error crecía linealmente con Y (≈1.65 px a 777, ≈42 px a 20000).
- **Arreglo**: borde del canvas a `0` (se dibuja con `box-shadow`, sin layout); SVG con `width/height` explícitos del plano y `preserveAspectRatio="none"` (1:1); `getCanvasPointFromClient` resta `clientLeft/clientTop`.
- **Terminales**: se eliminó `snapPointToTerminalLattice` de `projectSymbolPoint`; los offsets locales son la proyección exacta del arte (en viewBox 72, 12.333/147.667, antes 8/152 → 4.3 px de error). Los extremos de cable se derivan del `portId` en cada render (`resolveWirePointsWithMap`) y la simulación/lógica usan esos puntos resueltos.
- **Debug**: `?debugTerminals=1` + capa `freeplay-debug-overlay`.
- **Test**: `terminal-alignment.spec.ts` (288 casos) con `y=0/500/5000/20000` y rotaciones 0–3, error <0.01. Gates actualizados: ui vitest **572/572**; tsc **25**; engine **7/7**; build **OK**.

### 2026-11-01 (D47): vano horizontal común y verticales rectas

- **Causa**: los símbolos horizontales de dos bornes tenían vanos distintos según el aspect ratio del arte: XIC/LAMP 8..152 (144 px), PUSH_BUTTON/ESTOP 12.333..147.667 (135.33 px) por el letterbox del viewBox 72, y OL con modelo 12.333 aunque su arte caía en 8..152. Alinear dos componentes por un borne dejaba el otro con un codo de 8.667 px.
- **Arreglo**: vano común **8..152, y=51** para todos. Los glifos con arte 6..122 se escalan uniformemente a 160 px de ancho (`height = viewBoxHeight * 144/116`): PB/ESTOP 89.379 px, BREAKER_1P 79.448 px; el OL conserva 84 px porque su arte 2.3..125.7 ya cubre el vano.
- **Migración/cables**: `clampSceneToPlane` vuelve a alinear componentes al cargar (borne de entrada) y mueve los cables; `reconcileWireTopology` fija extremos y colapsa a recta cualquier cable cuyos extremos queden en la misma X/Y.
- **Test**: `ui/src/diagram/__fixtures__/vertical-pb-circuit.json` + `vertical-wires.spec.ts` verifican que los dos cables XIC↔PB_NO quedan en 2 puntos y misma X (<0.01). Gates: ui vitest **574/574**; tsc **25**; engine **7/7**; build **OK**.
- **Hoja**: tarjeta y título en inglés (Sheet/Project/Date/Scale/Page); title block 420 px con `clipPath` para que valores largos no crucen el marco; inputs con `maxLength` y `width:100%`.

### 2026-11-02 (D48): reset de temporizadores al desenergizar la bobina

- **Causa**: el fallback de oscilación de `resolvePhysicalInstructionTagValues` forzaba **todas** las bobinas físicas a `true`, incluidas `TM1/TM2/TM3`; los temporizadores quedaban en `5000 ms` y no volvían a reposo al desenergizarse su bobina.
- **Arreglo**: historial de estados del punto fijo; al repetirse un estado se identifican solo las bobinas que cambian en el ciclo. Las estables (CR1) conservan su valor; las oscilantes se resuelven en reposo salvo que el grafo con todas accionadas tenga un lazo sin carga (entonces `true` para reportar el cortocircuito). `collectTimedContactRuntimeStates` elimina el estado cuando el tag es falso, por lo que NOTC/NCTO vuelven a su estado normal.
- **Test**: `timer-reset.spec.ts` (reset sintético, regresión de cortocircuito y cascada real `timer-cascade.circuit.json`); ui vitest **577/577**. Gates: tsc **25**, engine **7/7**, build **OK**.
