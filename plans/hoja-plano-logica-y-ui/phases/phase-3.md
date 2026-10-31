---
type: planning
entity: phase
plan: "hoja-plano-logica-y-ui"
phase: 3
status: done  # pending | in_progress | completed | skipped | done
created: "2026-10-29"
updated: "2026-10-29"
---

# Phase 3: Símbolos ANSI/NEMA

> Part of [hoja-plano-logica-y-ui](../plan.md)

> **code reverted by D24 (2026-10-30); kept as historical record**

## Objective

Añadir y ajustar símbolos a la convención ANSI/NEMA sobre el set actual, sin reescritura completa, de forma que el diagrama se lea como un plano de control de motores estándar. Aceptación visual contra las imágenes de referencia.

## Scope

### Includes

- Símbolos nuevos o ajustados: NO/NC pulsador (verde NO / rojo NC de paro), paro de emergencia (hongo rojo), guardamotor, relevador de sobrecarga (térmico), selector (2/3 posiciones), luz piloto, limit switch, TON/TOF (con marca de temporizador), motor trifásico con 6/9/12 terminales, breaker, fusible, interruptor de seguridad.
- Ajuste de contactos XIC/XIO a símbolos NO/NC ANSI; NOTC/NCTO mostrados como TON/TOF (sin romper IDs de snapshot).
- Actualizar en `DiagramBuilder.tsx`: `BuilderComponentType` (L18), `circuitSnapshotComponentTypes` (L268), `instructionPalette` (L295-313), `getTerminalDefinitions` (L1120-1217), `renderSymbolGraphic` (L1272-1564), labels (L915-1091), helpers de clasificación (L321-412).
- Actualizar `ui/src/projectData.ts` L7 y `parseProgram` para los tipos de instrucción nuevos de fase 1.
- Estilos `.diagram-symbol*` en `ui/src/App.css` (L342 en adelante).
- Estados visuales (pulsado, cerrado, energizado) derivados de tags leídos del motor (D1, fase 2).
- Paleta con los nuevos símbolos agrupados (control, protección, potencia, señalización).

### Excludes (deferred to later phases)

- Hoja, rejilla, cuadro de título (fase 4).
- Panel físico (fase 5).
- Set IEC 60617 completo.
- Migración formal de snapshots (fase 4); aquí solo se mantienen los IDs existentes.

## Prerequisites

- [x] Fase 1 completada (tipos de instrucción nuevos definidos).
- [x] Fase 2 completada (estados visuales leídos de tags del motor disponibles).
- [x] Imágenes de referencia revisadas por el usuario: `D:\Relevant files\Download (del cel viejo)\Electricidad\Controles eléctricos\New\`. Baseline aprobado salvo ESTOP (sin imagen de referencia; sign-off pendiente, ver Open items).

## Deliverables

- [x] Catálogo de símbolos con nombre ANSI/NEMA, terminales y estados por tipo, documentado en `docs/`. (Diferido a fase 6 por D15.)
- [x] Símbolos implementados para cada ítem de la lista de Includes.
- [x] Paleta actualizada con agrupación.
- [x] `parseProgram` acepta los tipos nuevos; los tipos anteriores siguen aceptados.
- [ ] Capturas de cada símbolo contra su referencia en `implementation/` (sustituido por baseline SVG; ver Result).

## Acceptance Criteria

- [x] Cada símbolo de la lista tiene: forma ANSI/NEMA revisada por el usuario, terminales correctos (motor 6/9/12, breaker 1P/2P/3P, etc.) y estados visuales. (Pendiente ESTOP sign-off; ver Open items.)
- [x] Un snapshot v1 con componentes antiguos (XIC, XIO, NOTC, NCTO, OTE, PB, breaker, lámpara, motor) se sigue renderizando sin error.
- [x] Tipos nuevos aparecen en la paleta y se pueden colocar, conectar y guardar.
- [x] `projectData.parseProgram` rechaza tipos desconocidos y acepta los nuevos (test unitario).
- [ ] Revisión visual aprobada por el usuario contra las referencias (baseline aprobado con 3 fixes; sign-off de ESTOP pendiente, ver Open items).
- [x] `pnpm build` pasa; tests de fases 1-2 verdes.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 1 | blocked-by | Tipos de instrucción nuevos. |
| Phase 2 | blocked-by | Estados visuales desde tags del motor (única fuente, D1). |
| Phase 4 | blocks | La hoja usa los símbolos y sus tamaños/terminales. |

## Notes

- Convención: ANSI/NEMA sobre el set actual (D7). No es una reescritura; no se añade IEC 60617.
- Mantener IDs de tipo existentes (`PUSH_BUTTON_NO`, `MOTOR`, etc.) para compatibilidad (analysis §9b).
- Lámpara genérica (`LAMP`) pasa a luz piloto ANSI; decidir si se renombra o se añade alias.
- Símbolos con estado (sobrecarga, guardamotor) necesitan campos en `BuilderComponent`; en fase 4 esos campos entran en v2.
- Referencia de código: analysis §3 y §9(b).

## Result

**Status: done (2026-10-29).** Símbolos ANSI/NEMA implementados. Ver [implementation/phase-3-impl.md](../implementation/phase-3-impl.md).

- **Símbolos**: nuevos `ui/src/diagram/symbols.tsx` (`renderSymbolGraphic`, `getInstructionSymbol`) y `ui/src/diagram/symbolGeometry.ts` (tabla única de terminales/geometría). Estilos `.diagram-symbol*` en `ui/src/App.css`.
- **Paleta**: `ui/src/diagram/palette.ts` en español, agrupada (control, protección, potencia, señalización), con OTL/OTU incluidos.
- **Baseline**: spec de baseline + `__baseline__/symbols-14.baseline.json`. Diff contra baseline = **solo los 3 fixes de alineación aprobados** (PUSH_BUTTON_NC `cy` 30→36, SWITCH_1P `cx`, BREAKER_1P círculo+labels a x=6/122); las otras 44 claves byte-idénticas.
- **Datos**: `ui/src/projectData.ts` acepta ESTOP, OLR y TON/TOF (con `delayMs` para temporizadores); whitelist de snapshot actualizada.
- **Cableado/estados**: `deviceMapping.ts` con bindings de dispositivos incl. tag fijo `SYS:RESET` (dispositivo UNSET = sano, D13). `TraceStep.tripped` añadido en el motor (aditivo, D14). Visualización del disparo de OLR vía trace.
- **Catálogo en `docs/` NO creado**: diferido a fase 6 (D15).

**Gates**: `ui` tsc 0 errores; `ui` vitest 181/181; `plc-engine` 34/34; `pnpm -r build` OK.

**Open items (no cerrados)**:

- [ ] Cómo actuar OLR/FUSE/DISCONNECT/GUARDAMOTOR desde el diagrama (el inspector solo tiene wired breakers/selectores) — pendiente de decisión del usuario.
- [ ] Sign-off visual de ESTOP (sin imagen de referencia; implementado por convención, hongo rojo) — pendiente de revisión del usuario.
