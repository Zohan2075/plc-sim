---
type: planning
entity: implementation-plan
plan: "hoja-plano-logica-y-ui"
phase: 4
status: draft  # draft | active | completed | revised
created: "2026-10-30"
updated: "2026-10-30"
---

# Implementation Plan: Phase 4 - Hoja tipo plano + migración de snapshot v2

> Implements [Phase 4](../phases/phase-4.md) of [hoja-plano-logica-y-ui](../plan.md). Aplica D8 (lienzo libre con snap-to-grid), D6 (textos en español) y R1/R2/R14. Verificado contra el árbol de trabajo actual (2026-10-30): la fase 3 ya movió geometría a `ui/src/diagram/{symbolGeometry,terminals,symbols,palette}.ts` y las constantes de rejilla ya viven en `ui/src/diagram/constants.ts` (el "centralizar" de fase 4 está **medio hecho**: falta el módulo de snap y la rejilla visual en SVG).

## Approach

1. **Snap como módulo, no como privados de React.** Las funciones de snap/ortogonalidad (hoy privadas en `DiagramBuilder.tsx` L395-760) se mueven a `ui/src/diagram/grid.ts` sin cambios de comportamiento. Pasa a ser testeable en Node (R-E).
2. **Rejilla visible = líneas SVG explícitas.** `ui/src/diagram/sheet.ts` calcula geometría pura (líneas menor/mayor, marco, zonas, rect de cuadro de título) a partir de `planeSettings`; `DiagramBuilder` la renderiza como primer hijo de `freeplay-svg` (L4706). La rejilla CSS (gradientes de `App.css` L1806-1833) se **elimina**: una sola fuente visual, alineada por construcción con el snap (misma `gridSpacing`).
3. **Alineación real = anclajes en la rejilla.** Por diseño actual, `snapComponentToPlaneGrid` ancla la terminal de entrada del componente a un múltiplo de `gridSpacing` y las terminales familia C64/P72/H60 caen en la retícula `TERMINAL_LATTICE_*` (offset 8/15 px), de modo que **todas** las terminales de las familias no-crudas quedan en intersecciones de rejilla. El test de prueba de alineación lo demuestra sobre helpers puros; los dos tipos con bornes en px crudos (BREAKER_2P, GUARDAMOTOR, D16) se corrigen a la retícula en esta fase (OD4-4).
4. **Snapshot v2 = aditivo + migración explícita.** `CIRCUIT_SNAPSHOT_VERSION = 2`; campo nuevo `sheet` (projectName, date, scale, page) alimenta el cuadro de título. El parser se extrae a `ui/src/diagram/snapshot.ts` con `migrateCircuitSnapshot` (v1→v2) y rechazo de versiones desconocidas (hoy `parseCircuitSnapshot` L1162 acepta **cualquier** número de versión). Posiciones siguen en píxeles (OD4-2).
5. **Fixture v1 capturado del schema actual.** No existe ningún `.circuit.json` v1 en el repo (`sample-programs/` son proyectos del motor, formato distinto; `data/` no existe); el fixture se escribe desde el schema que hoy acepta `parseCircuitSnapshot` (ver Step 0).

## Affected Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `ui/src/diagram/grid.ts` | create (move) | Snap/ortogonalidad desde `DiagramBuilder.tsx` L395-760. |
| `ui/src/diagram/sheet.ts` | create | Geometría de rejilla/marcas/zonas/cuadro de título + `zoneLabel`. |
| `ui/src/diagram/snapshot.ts` | create (move) | `parseCircuitSnapshot` + familia (L820-1171) + `migrateCircuitSnapshot`, `CIRCUIT_SNAPSHOT_VERSION = 2`. |
| `ui/src/diagram/constants.ts` | modify | `CIRCUIT_SNAPSHOT_VERSION` 1→2 (L63); nuevos `SHEET_FRAME_INSET`, `TITLE_BLOCK_*`. |
| `ui/src/diagram/model.ts` | modify | `CircuitSnapshot` (L111) += `sheet: SheetMetadata`. |
| `ui/src/diagram/symbolGeometry.ts` | modify | Bornes BREAKER_2P y GUARDAMOTOR alineados a la retícula (OD4-4). |
| `ui/src/DiagramBuilder.tsx` | modify | Importar grid/sheet/snapshot; render capa `<g className="sheet-grid">` en `freeplay-svg` (L4706); tarjeta "Hoja" en el inspector; quitar vars CSS L2848-2849. |
| `ui/src/App.css` | modify | Eliminar `.freeplay-canvas::before` (L1806-1833) y vars L1789-1790; estilos `.sheet-grid*`, `.sheet-title-block*`. |
| `ui/src/diagram/grid.spec.ts`, `sheet.spec.ts(x)`, `snapshot.spec.ts`, `alignment.spec.ts` | create | Ver Testing Plan. |
| `ui/src/diagram/__fixtures__/snapshot-v1.circuit.json` | create | Fixture v1 capturado (Step 0). |

## Required Context

| File | Why |
|------|-----|
| `plans/hoja-plano-logica-y-ui/plan.md` | D6, D8, R1, R2, R14, R-E, DoD. |
| `plans/hoja-plano-logica-y-ui/phases/phase-4.md` | Alcance, criterios, prerequisites (zonas, px vs unidades, fixture v1). |
| `plans/hoja-plano-logica-y-ui/implementation/phase-3-impl.md` | Módulos de fase 3 y familias C64/P72 (bornes simétricos). |
| `docs/analysis-ladder-rendering-and-logic.md` §2, §7 | Rendering actual, snapshot, líneas de referencia (muchas desplazadas: ver Reality Check). |
| `ui/src/DiagramBuilder.tsx` L213-219, L395-760, L789-830, L937-1171, L2843-2853, L4684-4730 | Plane settings, snap, snapshot, CSS vars, render del canvas. |
| `ui/src/diagram/constants.ts` L17-35, L63, L77-91 | Constantes de plano/rejilla, versión, offsets de retícula. |
| `ui/src/diagram/terminals.ts` L225-264, L370-409, L453-458, L531 | `projectSymbolPoint`, `getTerminalPoint`, `snapPointToTerminalLattice`. |
| `ui/src/diagram/model.ts` L97-125 | `BuilderPlaneSettings`, `CircuitSnapshot` (a extender). |
| `ui/src/App.css` L1788-1844 | Gradientes de rejilla a eliminar. |

## Implementation Steps

### Step 0: Gate, línea base y fixture v1

- **What**: (a) Confirmar `cd ui && npx tsc --noEmit` limpio y `pnpm -r test` verde. (b) Escribir `ui/src/diagram/__fixtures__/snapshot-v1.circuit.json` con el schema **actual** (version 1): `name`, `savedAt`, `settings{gridSpacing,height,scanIntervalMs,width}`, `components[]` (incl. campos crudos `isClosed/isPressed/delayMs/terminalLabels/lampGlowColor/sourceVoltage`), `wires[]` (points + start/endPortId + color/thickness), `program`, `tags`. (c) Test temporal que el fixture carga con `parseCircuitSnapshot` actual (se convierte en el test de migración en Step 5).
- **Where**: `ui/src/diagram/__fixtures__/`.
- **Why**: No hay v1 en el repo; el fixture debe reflejar lo que el parser de hoy acepta, no una memoria del plan.
- **Considerations**: Copia de `ui/src` a `C:\Users\Johan\AppData\Local\Temp\opencode\phase4-base\` como checkpoint.

### Step 1: Módulo de snap (`grid.ts`) - refactor puro

- **What**: Mover de `DiagramBuilder.tsx` a `ui/src/diagram/grid.ts` y exportar: `snapPointToGrid` (L403), `getCanonicalWirePoint` (L415), `requantizeCoordinateToGrid`/`requantizePointToPlaneGrid`/`requantizeComponentToPlaneGrid` (L419-489), `getComponentPlanePadding` (L441), `getComponentPlaneSnapOffset` (L445), `snapComponentToPlaneGrid` (L491), `clampComponentToPlane` (L512), `clampWireToPlane`/`clampSceneToPlane` (L522-557), `requantizeSceneToPlaneGrid` (L559), `createOrthogonalPath` (L580), `normalizeWirePoints` (L626), `simplifyWirePoints` (L646), `repositionWireEndpointOrthogonally` (L704), helpers pequeños (`distanceBetween`, `pointsAreClose`, `arePointsCollinear`, `getSegmentAxis`, `buildEndpointElbow`, `isWireEndpointIndex`, `getWireSegmentMidpoint`, `clampPointToPlane`). `DiagramBuilder` los importa.
- **Where**: `ui/src/diagram/grid.ts` (nuevo); `DiagramBuilder.tsx` L395-760 (borrar tras mover).
- **Why**: (a) del alcance: una sola definición de snap, testeable sin React. Ningún cambio de comportamiento.
- **Considerations**: Importa de `./terminals` (`getTerminalDefinition`, `getDefaultEntryTerminalId`, `rotatePoint`) y `./constants`; sin ciclos (terminals no importa grid). Los call sites (~40, ver grep L1461-L4002) solo cambian de origen, no de nombre.

### Step 2: Geometría de hoja (`sheet.ts`)

- **What**: Exportar: `buildGridLines(planeSettings) -> { minorX, minorY, majorX, majorY: number[] }` (líneas en múltiplos de `gridSpacing`; mayores en `gridSpacing * MAJOR_GRID_MULTIPLIER`); `computeZoneMarks(planeSettings) -> { columns: {index, x}[], rows: {label, y}[] }` (columnas 1..N, filas A..Z→AA, celda = espaciado mayor); `zoneLabel(index)`; `computeSheetFrame(planeSettings)` (rect con `SHEET_FRAME_INSET = 10` px); `computeTitleBlockRect(planeSettings)` (abajo-derecha dentro del marco, ~360×110 px, `TITLE_BLOCK_*` en constants).
- **Where**: `ui/src/diagram/sheet.ts` (nuevo).
- **Why**: (c) del alcance; geometría pura = testeable en Node y reutilizable en fase 5.
- **Considerations**: `useMemo` en el render: la geometría solo depende de `planeSettings`. Peor caso 4200×2400 @ 8 px ≈ 825 `<line>`: aceptable; si la revisión visual lo objeta, sustituir menores por `<pattern>` (misma geometría).

### Step 3: Capa SVG de rejilla + marco + zonas; eliminar rejilla CSS - (b), (f)

- **What**: En `freeplay-svg` (L4706), **primer** hijo: `<g className="sheet-grid">` con `<line data-axis="minor|major">` de `buildGridLines`, rect del marco, texto de marcas de zona (columnas arriba, filas a la izquierda, dentro del margen). Eliminar `App.css` `.freeplay-canvas::before` (L1806-1833) y las vars `--grid-spacing`/`--major-grid-spacing` (defaults L1789-1790 e inline `canvasStyle` L2848-2849); `MAJOR_GRID_MULTIPLIER` pasa a usarse solo desde `sheet.ts`. Clases nuevas: `.sheet-grid__line--minor` (rgba(15,23,42,0.05)), `--major` (rgba(30,41,59,0.12)), `.sheet-frame`, `.sheet-zone-label`, `.sheet-title-block*` (colores actuales para continuidad visual).
- **Where**: `DiagramBuilder.tsx` L4696-4706; `App.css` L1788-1844.
- **Why**: La rejilla SVG queda como única fuente visual y comparte `gridSpacing` con el snap: alineación exacta por construcción (R1, R2). El overlay de ejes X/Y existente (L4696-4704) se conserva.
- **Considerations**: El SVG escala con el zoom (`viewBox` L4706) sin trabajo extra. Los componentes (HTML absolutos, L4868) quedan **encima** del marco/título: documentado, aceptado (el cuadro vive en la esquina y el canvas es libre, D8).

### Step 4: Cuadro de título editable + campo `sheet` en el modelo - (c)

- **What**: `model.ts`: `SheetMetadata { projectName: string; date: string; scale: string; page: string }`; `CircuitSnapshot.sheet: SheetMetadata`. `createCircuitSnapshot` (L789) incluye `sheet` con defaults (`projectName` = nombre del circuito, `date` = fecha de `savedAt` `YYYY-MM-DD`, `scale` = `"1:1"`, `page` = `"1"`). Estado `sheetMetadata` en `DiagramBuilder` (se carga desde el snapshot, L3711-3729); tarjeta "Hoja" en el inspector con 4 inputs (textos en español, D6); el SVG dibuja el rect + textos del cuadro de título en `computeTitleBlockRect`.
- **Where**: `model.ts`, `DiagramBuilder.tsx` (estado + inspector + render), `sheet.ts`/`App.css` (render/estilos).
- **Why**: Requisito del usuario: cuadro de título con campos editables (nombre de proyecto, fecha, escala, página).
- **Considerations**: La fecha es editable (no auto-sobrescrita al guardar; el default se rellena en la migración/save si está vacía). Sin campos nuevos en componentes/cables: solo metadata de hoja.

### Step 5: Snapshot v2: módulo + migración + rechazo de versiones - (e)

- **What**: Crear `ui/src/diagram/snapshot.ts` moviendo `downloadCircuitSnapshot` (L820), `parseCircuitSnapshot*` (L937-1167) y `readCircuitSnapshotFile` (L1169). `CIRCUIT_SNAPSHOT_VERSION = 2` (constants.ts L63). Nuevo `migrateCircuitSnapshot(raw: unknown): unknown`: `version === 1` → inyecta `sheet` con defaults y `version: 2`; `version === 2` → pasa tal cual; cualquier otro valor (ausente, 0, 3, string) → `throw Error("Circuit snapshot version X no soportada (soportadas: 1, 2).")`. `parseCircuitSnapshot` llama a la migración antes del parseo y **deja de** aceptar versiones arbitrarias (hoy L1162 solo valida que sea número).
- **Where**: `ui/src/diagram/snapshot.ts` (nuevo); `DiagramBuilder.tsx` (importar; borrar código movido).
- **Why**: R14/NF4/R-B: v1 carga automáticamente; formatos desconocidos se rechazan con mensaje claro (AC de fase 4).
- **Considerations**: El parser es whitelist de campos: `sheet` se parsea con defaults si algún v2 parcial lo omite (defensa, no migración). `handleLoadCircuit` (L3701) no cambia: sigue llamando a `parseCircuitSnapshot`.

### Step 6: Bornes crudos a la retícula (BREAKER_2P, GUARDAMOTOR)

- **What**: Ajustar coordenadas en `symbolGeometry.ts` (raw: true) para que todos los bornes caigan en la retícula relativa al ancla: BREAKER_2P x 8/152 → 8/152 ok (≡8 mod 18), y 24/78 → 15/69 (≡15 mod 18); GUARDAMOTOR x 20/64/108 → 8/70/132; y 8/56 → 15/69. Actualizar los bornes de `symbols.tsx` para que el markup quede alineado (baseline D16 solo cubre los 44+3 keys: estos 2 sí cambian, aprobados por D16 como "resto en fase 4").
- **Where**: `ui/src/diagram/symbolGeometry.ts` L51-59, L229-241; `ui/src/diagram/symbols.tsx` (casos BREAKER_2P, GUARDAMOTOR).
- **Why**: Sin esto, "toda línea/terminal en la rejilla" es falso para estos 2 tipos (bornes en px arbitrarios, ver Reality Check).
- **Considerations**: Cambio visual menor y aprobado por el requisito 1; los tests de geometría de fase 3 (`symbolGeometry.spec.ts`) deben seguir pasando (simetría respecto a x=64 se preserva ajustando pares).

### Step 7: Pruebas de alineación y cierre - (d)

- **What**: `ui/src/diagram/alignment.spec.ts`: (1) para cada tipo del palette: `snapComponentToPlaneGrid` → ancla (x+anchor.x, y+anchor.y) es múltiplo de `gridSpacing` (rotaciones 0-3); (2) tras Step 6, **todas** las terminales de todos los tipos son múltiplos de `gridSpacing` absolutos; (3) escena construida con `createOrthogonalPath`+`normalizeWirePoints`: todo punto de cable es múltiplo de `gridSpacing` o coincide exactamente con una terminal; (4) toda polilínea es ortogonal (consecutive points comparten x o y); (5) `requantizeSceneToPlaneGrid` preserva invariantes al cambiar spacing 18→24. Ejecutar el Testing Plan completo; capturas de `pnpm dev` (hoja default 1720×940, zoom 50%/200%, con título) en `implementation/phase-4-captures/`; sign-off del usuario.
- **Where**: `ui/src/diagram/alignment.spec.ts`; `implementation/`.
- **Why**: DoD: la prueba de alineación es el entregable central del requisito 1.
- **Considerations**: Clamp edge: `snapComponentToPlaneGrid` puede sacar del grid si el clamp (padding) lo fuerza; el test usa posiciones interiores (caso normal) y añade un caso documentado de borde.

## Testing Plan

**Verify command (único, primario):** `pnpm -r test` (raíz) → `plc-engine` + `ui` (vitest: parity, compiler, runtime, solver, symbols y los nuevos grid/sheet/snapshot/alignment).

Gates secundarios: `cd ui && npx tsc --noEmit` · `pnpm -r build`.

| Test Type | What to Test | Expected Outcome |
|-----------|-------------|-----------------|
| (a) `grid.spec.ts` | `snapPointToGrid` idempotente y múltiplo de spacing; `createOrthogonalPath` siempre ortogonal y en grid; `normalizeWirePoints` deduplica en canonical; `snapComponentToPlaneGrid` ancla en grid + clamp dentro del plano; `requantizeSceneToPlaneGrid` 18→24→18 estable | Pasa |
| (a) `sheet.spec.ts` | `buildGridLines`: todas las coords múltiplos de spacing; mayores en múltiplos de spacing×5; cubren el plano. `computeZoneMarks`: columnas 1..ceil(w/major), filas A.. con `zoneLabel` correcto (26→"AA"). `computeTitleBlockRect` dentro del marco | Pasa |
| (a) `snapshot.spec.ts` | Fixture v1 (Step 0) migra a v2 con `sheet` por default y componentes/wires/tags/program idénticos; round-trip v2→v2 idempotente; versión 3/0/ausente → error con mensaje; parser actual sobre el fixture (gate de Step 0) se conserva como caso v1 | Pasa |
| (b) `alignment.spec.ts` | Los 5 invariantes de Step 7 sobre todos los tipos del palette y rotaciones; familia C64/P72 simétrica respecto al ancla | Pasa |
| (b) markup `symbols.spec.tsx` (ampliar) | BREAKER_2P/GUARDAMOTOR tras Step 6: bornes coinciden con `getTerminalDefinitions`; baseline de los 44+3 keys restantes byte-idéntico | Pasa |
| (c) visual | Capturas hoja default + zoom; revisión de marco/zonas/título | Sign-off del usuario (fuera de automatización; Playwright fase 6) |

### Test Integrity Constraints

- `plc-engine` (34 tests): sin cambios.
- `ui` existentes (parity F01-F12 + goldens, compiler, engineSession, electricalView, symbols, symbolGeometry): **no se modifican**. Los goldens no usan snapshot ni hoja. `symbolGeometry.spec.ts` puede requerir actualización de expectativa **solo** si Step 6 cambia números referenciados (simetría/ids se preservan; los valores crudos cambian → revisar y justificar en changelog).
- `symbols.baseline.spec.tsx`: las claves de BREAKER_2P/GUARDAMOTOR cambian de forma intencionada (Step 6); el resto debe seguir idéntico.
- Ningún test se deshabilita ni debilita; el parser v1 existente pasa a migración interna (mismo resultado observable).

## Rollback Strategy

- **Checkpoint**: copia de `ui/src` en `C:\Users\Johan\AppData\Local\Temp\opencode\phase4-base\` (Step 0).
- **Por paso**: Steps 1-2 son refactor/aditivos puros. Step 3 es el corte visual: revertir = restaurar gradientes CSS y quitar la capa `<g>`. Step 5 conserva la ruta v1 dentro de la migración: revertir = volver `CIRCUIT_SNAPSHOT_VERSION = 1` y quitar `migrateCircuitSnapshot` (el parser de v1 no cambió semánticamente). Step 6 es un ajuste de constantes de bornes.
- **Flag**: no se usa flag nuevo. Los snapshots v2 siguen cargando tras cualquier rollback parcial de visual porque el formato no depende del render.

## Open Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| **OD4-1** Base de zonas | (a) celda = espaciado mayor (cols 1..N, filas A..); (b) conteo fijo (p.ej. 6 filas A..F) con celdas derivadas | **(a) propuesta** | Simetría con la rejilla dibujada; "A..F" del requisito es ilustrativo (940/90 ≈ 11 filas). Confirmar con usuario. |
| **OD4-2** Unidades de posición | (a) píxeles (formato actual); (b) unidades de rejilla en v2 | **(a) propuesta** | El snap ya cuantiza a rejilla; (b) duplica precisión, rompe compat y complica la migración. Phase-4.md lo deja a registro aquí. |
| **OD4-3** Edición del cuadro de título | (a) tarjeta "Hoja" en el inspector con 4 inputs; (b) edición inline sobre la hoja | **(a) propuesta** | Reutiliza el patrón inspector existente; (b) añadiría inputs HTML superpuestos al SVG. Confirmar con usuario. |
| **OD4-4** Bornes crudos BREAKER_2P/GUARDAMOTOR | (a) alinear a la retícula en fase 4 (Step 6); (b) dejar px y excluir del test de alineación | **(a) propuesta** | El requisito 1 pide alineación simétrica; D16 dejó estos 2 como "resto". (b) dejaría huecos en la prueba. Confirmar con usuario (cambio visual menor). |

### Decisiones tomadas por recomendación (registrar en changelog, sin pregunta)

- La rejilla CSS se **elimina** (no se mantiene como fondo): el SVG es la única rejilla visible (f del alcance; evita doble dibujo y deriva).
- Zonas siempre visibles (sin toggle) en esta fase; un toggle, si se pide, sería fase 5.
- La fecha del cuadro de título es un campo editable con default `YYYY-MM-DD` de `savedAt`; no se auto-actualiza.
- `sheet.projectName` nace como copia editable del nombre; no se enlaza bidireccionalmente con el nombre del archivo.

## Reality Check

### Code Anchors Used

| File | Symbol/Area | Why it matters |
|------|-------------|----------------|
| `ui/src/DiagramBuilder.tsx` | `snapPointToGrid` L403, `getComponentPlanePadding` L441, `snapComponentToPlaneGrid` L491, `requantizeSceneToPlaneGrid` L559, `createOrthogonalPath` L580, `normalizeWirePoints` L626, `simplifyWirePoints` L646 | Snap/ortogonalidad a mover a `grid.ts` (a). |
| `ui/src/DiagramBuilder.tsx` | `createCircuitSnapshot` L789, `downloadCircuitSnapshot` L820, `parseCircuitSnapshot*` L937-1167, `readCircuitSnapshotFile` L1169 | Parser/serializer a `snapshot.ts`; `version` se parsea sin validar (L1162). |
| `ui/src/DiagramBuilder.tsx` | `canvasStyle` L2847-2853 (vars inline), `freeplay-svg` L4706, `freeplay-plane-overlay` L4696-4704, componentes HTML L4867-4889 | Render actual; la capa SVG va como primer hijo del svg; componentes quedan encima del marco. |
| `ui/src/diagram/constants.ts` | `DEFAULT_GRID_SPACING` L21, `CIRCUIT_SNAPSHOT_VERSION` L63 (=1), `TERMINAL_LATTICE_X/Y_OFFSET` L77-79, `MAJOR_GRID_MULTIPLIER` L81, `DEFAULT_PLANE_SETTINGS` L87 | Fuente única de constantes (ya centralizada en fase 2/3); offsets de retícula ≡ (8, 15) mod 18. |
| `ui/src/diagram/terminals.ts` | `projectSymbolPoint` L225, `getTerminalPoint` L396, `snapPointToTerminalLattice` L453, `snapCoordinateToLattice` L531 | Terminales familia C64/P72 caen en retícula offset → todas en intersecciones de rejilla tras snap del componente. |
| `ui/src/diagram/symbolGeometry.ts` | `BREAKER_2P` L51-59 (raw), `GUARDAMOTOR` L229-241 (raw) | Únicos bornes fuera de la retícula (y=24/78 mod 18 = 6; x=20/64/108 mod 18 = 2/10/2). |
| `ui/src/App.css` | `.freeplay-canvas` L1788-1804 (vars hardcodeadas), `.freeplay-canvas::before` L1806-1833 (gradientes), `.freeplay-plane-overlay` L1843 | Rejilla CSS a eliminar (f). |
| `ui/src/diagram/model.ts` | `BuilderPlaneSettings` L97, `CircuitSnapshot` L111 | `sheet` a añadir (v2). |
| `sample-programs/*.project.json`, `ui/src/parity/fixtures/*.json` | — | Verificado: **no** son snapshots v1 (formato de programa del motor / escenas de paridad). `data/` no existe. Fixture v1 = capturar del schema actual. |

### Mismatches / Notes

- **Líneas de phase-4.md desactualizadas**: `freeplay-svg` L6511 → L4706; `snapPointToGrid` L1603 → L403; `snapComponentToPlaneGrid` L1691 → L491; `createOrthogonalPath` L1780 → L580; `getComponentPlanePadding` L1641 → L441; constantes L226-228/257-258 → `diagram/constants.ts` L21/L77-79; parser L2360 → L1129; `BuilderComponent` duplicado (L41-55 del análisis) → ya unificado en `model.ts` L45-60.
- **"Centralizar constantes" está a medio hacer**: no queda duplicación de números en `DiagramBuilder` (fase 2/3 lo movió); lo que falta es el módulo de snap (`grid.ts`) y quitar las vars CSS hardcodeadas de `App.css` L1789-1790. El grep de la DoD debe apuntar a `DEFAULT_GRID_SPACING|MAJOR_GRID_MULTIPLIER|TERMINAL_LATTICE` sin coincidencias fuera de `diagram/{constants,grid,sheet,terminals}.ts`.
- **Parser sin validación de versión**: `parseCircuitSnapshot` L1162 acepta hoy `version: 99`. Step 5 lo corrige; es un AC de la fase, no un cambio de alcance.
- **Snap vs. clamp**: `snapComponentToPlaneGrid` (L497-509) puede romper el múltiplo de `gridSpacing` si el clamp a `[padding, width-W-padding]` aplica (padding = `max(gridSpacing, 16)`, no múltiplo para spacing < 16). Borde documentado; el test de alineación cubre el caso normal y deja constancia del borde.

### Blocking findings

Ninguno bloqueante. Cuatro decisiones abiertas (OD4-1..4) requieren confirmación del usuario antes de ejecutar los pasos afectados; el resto del plan es ejecutable con las recomendaciones registradas.
