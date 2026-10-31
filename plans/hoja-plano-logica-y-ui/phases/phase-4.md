---
type: planning
entity: phase
plan: "hoja-plano-logica-y-ui"
phase: 4
status: completed  # pending | in_progress | completed | skipped
created: "2026-10-29"
updated: "2026-10-30"
---

# Phase 4: Hoja tipo plano + migración de snapshot v2

> Part of [hoja-plano-logica-y-ui](../plan.md)

> **code reverted by D24 (2026-10-30); kept as historical record**

## Objective

Dar a la vista de diagrama aspecto de hoja de plano: rejilla dibujada en SVG, marco, zonas, cuadro de título; snap-to-grid y alineación ortogonal para componentes y cables; centralizar constantes de rejilla; y migrar `CircuitSnapshot` de v1 a v2 con tests sobre fixtures antiguos.

## Scope

### Includes

- Rejilla visible en SVG (líneas mayores y menores) dentro del plane (`freeplay-svg` L6511), en lugar de solo CSS (`App.css` L1789-1830).
- Marco de hoja, numeración de zonas (columnas numéricas, filas alfabéticas, o según confirmación), cuadro de título (nombre del circuito, fecha, autor, escala, número de hoja).
- Snap-to-grid para componentes (`snapPointToGrid` L1603, `snapComponentToPlaneGrid` L1691) y cables; cables ortogonales (`createOrthogonalPath` L1780). Alineación simétrica de líneas principales a líneas de rejilla.
- Centralizar constantes: `DEFAULT_GRID_SPACING` (L226-228), `TERMINAL_LATTICE_X/Y_OFFSET` (L257-258), `getComponentPlanePadding` (L1641) en un único módulo.
- CircuitSnapshot v1 → v2: nuevos campos (estado de sobrecarga, guardamotor, metadatos de hoja/título, posiciones en unidades de rejilla si se decide) con migración automática y versión explícita.
- Tests de migración sobre fixtures v1 (ver Testing Strategy del plan).
- Partir `DiagramBuilder.tsx` si la fase lo requiere (módulo de rejilla, módulo de snapshot).

### Excludes (deferred to later phases)

- Panel físico y layout de App (fase 5).
- Migración de `data/` y `sample-programs/` (fase 6), salvo los fixtures necesarios para tests.
- Auto-layout automático.
- Lienzo con carriles fijos (D8: lienzo libre con snap-to-grid).

## Prerequisites

- [ ] Fase 3 completada (símbolos y terminales nuevos definidos).
- [ ] Decisión de numeración de zonas y contenido del cuadro de título confirmada por el usuario.
- [ ] Decisión de si las posiciones se guardan en píxeles o en unidades de rejilla (registrar en `implementation/phase-4-impl.md`).
- [ ] Snapshot v1 de muestra capturado (desde la app actual) para fixture.

## Deliverables

- [ ] Módulo de rejilla y hoja (constantes, cálculo de zonas, geometría de marco y título) usado por el canvas.
- [ ] Rejilla SVG + marco + zonas + cuadro de título renderizados.
- [ ] Snap y ortogonalidad aplicados a componentes y cables; alineación simétrica documentada.
- [ ] `CIRCUIT_SNAPSHOT_VERSION = 2` con `migrateCircuitSnapshot(v1 → v2)` y rechazo explícito de versiones desconocidas.
- [ ] Tests de migración con fixtures v1 y round-trip v2.
- [ ] Constantes de rejilla sin duplicados (grep sin coincidencias fuera del módulo).

## Acceptance Criteria

- [ ] La rejilla existe como líneas SVG en el DOM (no depende de CSS).
- [ ] Marco, zonas y cuadro de título visibles en tamaño por defecto (1720×940) y al hacer zoom.
- [ ] Al mover un componente o cable, las coordenadas quedan en la rejilla (test unitario de helpers de snap).
- [ ] Cables resultan ortogonales en todos los casos de prueba de routing.
- [ ] Un snapshot v1 real carga, se migra a v2 y se re-guarda como v2 sin pérdida de componentes, cables ni tags (test de round-trip).
- [ ] Snapshot con versión desconocida se rechaza con mensaje claro.
- [ ] `pnpm build` pasa; todos los tests de fases anteriores verdes.

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phase 3 | blocked-by | Símbolos y terminales definitivos antes de fijar la geometría. |
| Phase 5 | blocks | El layout de App asume hoja v2. |
| Phase 6 | blocks | Migración de `data/` y `sample-programs/` usa el formato final. |

## Notes

- **Riesgo R-B**: cambiar `BuilderComponent`/`BuilderWire` rompe snapshots. v2 con migración es obligatorio, no opcional.
- Limpieza sugerida: `BuilderComponent` declara `x/y/rotation/label/tag/...` dos veces (analysis §2, L41-55); unificar en esta fase.
- Referencias: analysis §2 (rendering, snapping) y §7 (formato de snapshot, parser L2360).

## Result

**Status: done (2026-10-30).** Hoja tipo plano y snapshot v2 implementados.

- **Rejilla/hoja**: nuevo `ui/src/diagram/grid.ts` (snap, ortogonalidad; fix del clamp para que el padding sea siempre múltiplo del spacing). `sheet.tsx` dibuja líneas de rejilla (mayores/menores), marcas de zona, marco y cuadro de título vía `SheetLayer`. El `App.css` con gradiente CSS de rejilla se eliminó: el SVG es la única rejilla (fuente única de verdad).
- **Snapshot v2**: `CIRCUIT_SNAPSHOT_VERSION = 2`; `migrateCircuitSnapshot` migra v1→v2 con defaults de hoja; versión desconocida lanza error explícito.
- **Alineación a la retícula de terminales**: `BREAKER_2P` y 24→15/78→69, y `GUARDAMOTOR` x 8/62/116 y 15/69, sobre la retícula de terminales (resuelve el "resto" de D16 diferido en fase 3).
- **Inspector**: tarjeta "Hoja" (Proyecto/Fecha/Escala/Página); cuadro de título editado desde ahí (D17).
- **Nota de incidente**: `DiagramBuilder.tsx` quedó vacío a mitad de sesión por una edición fallida; se restauró byte-idéntico desde el checkpoint.

**Gates**: ui tsc 0; ui vitest 450/450 (236 de alineación); `pnpm -r build` OK.

**Baseline**: solo las 4 claves `BREAKER_2P` regeneradas; el resto byte-idéntico.
