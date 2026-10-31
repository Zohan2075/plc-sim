---
type: planning
entity: phase
plan: "hoja-plano-logica-y-ui"
phase: 5
status: done  # pending | in_progress | completed | skipped | done
created: "2026-10-29"
updated: "2026-10-30"
---

# Phase 5: Reshape de UI: hoja + panel físico

> Part of [hoja-plano-logica-y-ui](../plan.md)

> **code reverted by D24 (2026-10-30); kept as historical record**

## Objective

Reorganizar la aplicación en dos zonas: la **hoja del diagrama** como vista principal y un **panel de control físico** lateral (pulsadores, selectores, luces piloto). El panel envía entradas al motor con `engine.setInput` y lee luces desde tags del motor. Run/Stop/Reset se trasladan al panel. Se decide el destino de los componentes huérfanos.

## Scope

### Includes

- Layout de `ui/src/App.tsx` y `App.css`: hoja (principal) + panel (lateral, colapsable).
- Cableado de `engine.setInput` desde el panel (hoy solo lo llama `StatusDisplay`, huérfano; analysis §5 bug 5).
- Luces piloto alimentadas por `engine.getTag` (una sola fuente de verdad, D1: el solver de vista solo lee tags del motor).
- Pulsadores del panel con semántica del motor fijada en fase 1 (momentáneo vs. mantenido).
- Selectores, paro de emergencia y **pulsador de reset** en el panel vinculados a tags de entrada del motor (D2: reset es dispositivo de entrada).
- Run/Stop/Reset en el panel con la semántica D2: Stop conserva latches; Reset borra salidas latcheadas y enclavamientos. El pulsador de reset del diagrama (fase 3) y el del panel activan el mismo tag.
- Huérfanos `ControlPanel`, `StatusDisplay`, `TracePanel`, `LadderDisplay`: **reutilizar e integrar** en el nuevo layout (D3). No se borran.
- Eliminar `buildEngine` como reconstrucción en cada edición: el engine persiste y se reconfigura con `loadProgram` (fase 1).
- Playwright E2E para flujos principales (D5 aprobado): arranque/paro, paro de emergencia, sobrecarga, reset por pulsador, edición que conserva estado.

### Excludes (deferred to later phases)

- Migración de datos y documentación final (fase 6).
- Nuevos símbolos (fase 3 ya cerrada).
- Protocolos de hardware.

## Prerequisites

- [ ] Fases 1-4 completadas.
- [x] Huérfanos: reutilizar (D3). Reset/clear: D2.
- [x] Playwright aprobado (D5).
- [ ] Lista de tags de entrada del panel (nombres y etiquetas en español) acordada con el usuario; el tag de reset es uno de ellos.

## Deliverables

- [ ] Layout nuevo en App con hoja + panel.
- [ ] Panel físico con pulsadores, selector, paro de emergencia, pulsador de reset y luces piloto conectados al motor.
- [ ] Run/Stop/Reset operativos desde el panel con semántica D2 de fase 1.
- [ ] Huérfanos `ControlPanel`, `StatusDisplay`, `TracePanel`, `LadderDisplay` reutilizados e integrados en el layout (ninguno borrado, D3).
- [ ] `App.tsx` ya no reconstruye el engine en cada edición (test o verificación en E2E).
- [ ] Specs Playwright de los flujos principales.

## Acceptance Criteria

- [ ] Presionar pulsador de marcha en el panel cambia el tag en el motor y la bobina en la hoja, en el mismo scan (verificado en E2E).
- [ ] Paro de emergencia en el panel corta todas las salidas en el siguiente scan (E2E).
- [ ] Disparo de sobrecarga se muestra en el panel y se rearma solo con el botón de rearme (E2E).
- [ ] Editar el circuito durante un enclavamiento activo no pierde el estado de tags que siguen existiendo (E2E).
- [ ] Reset por pulsador (panel y diagrama) limpia salidas latcheadas y enclavamientos; Stop conserva latches (E2E, D2).
- [ ] Ningún componente huérfano queda eliminado; los cuatro se importan desde el layout nuevo (D3).
- [ ] `pnpm build` y `pnpm test` en raíz pasan.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 4 | blocked-by | Hoja v2 y geometría final. |
| Phase 6 | blocks | Documentación y migración de datos sobre el layout final. |

## Notes

- Las luces piloto leen tags del motor; el solver de vista solo muestra energía en el diagrama y nunca decide tags (D1, fase 2).
- El panel escribe entradas con `engine.setInput`; no escribe tags directamente.
- Riesgo: el panel expone de inmediato la pérdida de estado de `buildEngine` (analysis §9d); esta fase la elimina.
- Referencias: analysis §5 (App, props de DiagramBuilder L200-217, botón Run L4765, reset de fallo) y §9(d).

## Result

**Status: done (2026-10-30).** Reshape de UI: hoja + panel físico implementado.

- **Nuevos módulos de panel**: `ui/src/panel/{model,panelControls,panelActuation,SidePanel}.ts(x)`:
  - `ControlPanel` (Run/Stop/Un scan/Reset/reset de fallo) y controles por dispositivo (momentáneo, mantenido, ESTOP, sensor, trip, FUSE, luces de motor/lámpara desde tags del motor).
  - `StatusDisplay` integrado (excluye tags `__builder_device__`).
  - Drawer de debug colapsable con pestañas **Trazo** (`TracePanel`) y **Renglones** (`LadderDisplay`) — huérfanos reutilizados, ninguno borrado (D3).
- **`DiagramBuilder`**: expone handle vía `forwardRef` (`actuateDevice`/`setMomentaryPressed`) y callback `onDeviceInventoryChange`; botones Run/fault-reset eliminados del builder (colocación única en el panel, OD5-3).
- **`EngineSession`**: hold de pulso de un scan para `SYS:RESET` únicamente (OD5-4).
- **Layout `App`**: grid hoja + panel de 360 px; a ≤1180 px una sola columna (panel colapsable).
- **Decisiones de diseño de fase 5** (consolidadas como D18): actuación del panel solo vía handle del builder → canal `deviceInputs`; Run/Stop/Reset solo en el panel.

**Gates**: ui tsc 0; ui vitest 470/470; plc-engine 34/34; `pnpm -r build` OK.

**Pendiente de usuario**: OQ-h (sign-off visual de ESTOP) y capturas de fases 4/5 — ver "Pending user sign-off" en [plan.md](../plan.md).
