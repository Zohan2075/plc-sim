---
type: planning
entity: phase
plan: "hoja-plano-logica-y-ui"
phase: 7
status: done  # pending | in_progress | completed | skipped | done
created: "2026-10-30"
updated: "2026-10-31"
---

# Phase 7: Símbolos sobre el código original (revert + adiciones + redraws) + hoja completa + cables/menús

> Part of [hoja-plano-logica-y-ui](../plan.md)

## Objective

**What**: (1) restaurar el proyecto a su estado original de trabajo — revert completo a git HEAD (570779c), ya ejecutado y verificado — y (2) aplicar **solo los cambios de símbolos ANSI** que pidió el usuario, usando las imágenes de referencia de `D:\Relevant files\Download (del cel viejo)\Electricidad\Controles eléctricos\reference\` (`selector.webp`, `NO limit switch.webp`, `NC limit switch.png`, `Emergency push button.png`, `Breaker 1P.png`).

**Why**: el usuario reportó que el proyecto "worked perfectly before" las fases 1-6: peores visuales, peor layout y lógica distinta (D24). Con su aprobación se revirtió TODO el código de la sesión a HEAD. Lo único que se conserva como trabajo nuevo son adiciones aditivas de símbolos y redraws de glifos (D26). **El motor, los tipos ladder, el layout, la rejilla/panel, el solver y la lógica quedan EXACTAMENTE como en HEAD** (comportamiento original, incluidas sus peculiaridades).

## Scope

### Includes

- **Deliverable 1 — Revert completo a HEAD (D24) — HECHO**: archivos tracked restaurados, archivos untracked creados en la sesión eliminados; `plans/` y los `docs/` nuevos conservados. Ver gates abajo.
- **Deliverable 2 — Trabajo WP8 de símbolos (D25, D26)** — aditivo sobre el código original de HEAD:
  - **(1) `PUSH_BUTTON_NC`**: sin cambios — ya es el diseño original tras el revert (ítem 1 del usuario satisfecho).
  - **(3) AÑADIR `ESTOP`**: hongo rojo, cuerpo NC como el pulsador NC original, comportamiento NC momentáneo en el solver original.
  - **(4) Redibujar `SWITCH_1P`** según `reference\selector.webp`.
  - **(5) AÑADIR `LIMIT_SWITCH_NO` / `LIMIT_SWITCH_NC`** según `reference\NO limit switch.webp` y `reference\NC limit switch.png`.
  - **(6) `BREAKER_1P`**: **SIN cambios** — el usuario aprobó el diseño original de HEAD (byte-idéntico); el ítem 6 de redraw se cancela (D28).
  - **(9) AÑADIR contacto OL** = contacto NC normal con el texto **"OL"** encima.
  - **(12) Añadir `MOTOR` a la paleta** (glifo original; el tipo existe pero no estaba en la paleta original — D25).
  - **Items (2)(7)(8)(10)(11)**: **nada que hacer** — no existen en HEAD (se añadieron en fase 3 y el revert las ausentó); las retiradas están CANCELADAS por D25.
- **Deliverable 3 — WP9 "Hoja completa"** (nuevo 2026-10-30, D29): portar el trabajo de hoja/alignment de la fase 4 desde el checkpoint `C:\Users\Johan\AppData\Local\Temp\opencode\phase5-base\src\diagram\` sobre HEAD+WP8 — ver sección de deliverables abajo.
- **Deliverable 4 — WP10 "Cables y menús"** (nuevo 2026-10-30, D30): limpieza de trazado de cables + click derecho cancela cable + menú flotante en componente — ver sección abajo.
- **Deliverable 5 — WP11 "NC limit switch trazado"** (2026-10-30): `LIMIT_SWITCH_NC` redibujado píxel a píxel desde `reference\NC limit switch.png` — ver sección abajo.
- **Deliverable 6 — WP12 "Intercambio de gestos + limit switch NO vectorial + NC accionado"** (2026-10-30, D32/D33): menú a click derecho, cancelación de cable solo en el origen, `LIMIT_SWITCH_NO`/`LIMIT_SWITCH_NC` desde los SVG exactos del usuario (copiados completos) y NC accionado = NO — ver sección abajo.
- **Deliverable 7 — WP13 "AC source, SPST, Emergency pb y OL desde arte del usuario"** (2026-10-30, D35): `POWER_SOURCE`, `SWITCH_1P`, `ESTOP` y `OL_CONTACT` migrados al arte vectorial — ver sección abajo.
- **Deliverable 8 — WP14 "ESTOP accionado, OL naranja, LAMP y alineación de terminales"** (2026-10-31, D36): estado accionado del ESTOP desde `Emergency push button (opened).svg`, color naranja del OL, `LAMP` desde `Lamp_symbol.svg` y auditoría de simetría de terminales — ver sección abajo.
- **Deliverable 9 — WP15 "E-stop enclavado + alineación de cables"** (2026-10-31, D37): el ESTOP enclava con click, la fuente AC tapa el cable en los anillos huecos con discos blancos y `BREAKER_1P` se alinea a la retícula del cable — ver sección abajo.
- **Deliverable 10 — WP16 "Causa raíz del desfase cable/pata"** (2026-10-31, D38): la altura del contenedor del glifo pasa de **96 a 102 px** (= `COMPONENT_GLYPH_HEIGHT`) y el cable queda alineado con la pata en **todos** los símbolos — ver sección abajo.
- **Deliverable 11 — WP17 "E-stop con las nuevas trazas normal/opened"** (2026-10-31, D39): el ESTOP reposo/accionado usa el **par de trazas nuevas** del usuario, con **mapeo independiente por estado** y anillos como círculos blancos con trazo — ver sección abajo.

### Excludes (deferred to later phases)

- Cualquier cambio en `plc-engine/src`, `ladder-types/src`, semántica del solver, layout, rejilla o panel — quedan **EXACTAMENTE como en HEAD** (D26).
- Rediseño o reescritura de `PUSH_BUTTON_NC` (ya es el original).
- Eliminación de ningún dispositivo o tipo (D25: retiradas canceladas, no se borra nada).
- Nuevas dependencias; búsqueda web de referencias.

## Prerequisites

- [x] Repositorio en HEAD (570779c) tras el revert de D24 — verificado.
- [x] Imágenes de referencia disponibles en `D:\Relevant files\Download (del cel viejo)\Electricidad\Controles eléctricos\reference\` — verificado: **5 imágenes** (`selector.webp`, `NO limit switch.webp`, `NC limit switch.png`, `Emergency push button.png`, `Breaker 1P.png`).
- [x] Decisiones D24-D33 registradas como RESOLVED en [plan.md · Decision Log](../plan.md#decision-log).

## Deliverables

### Deliverable 1 — Revert completo a HEAD + verificación (D24)

- [x] Revert completo a git HEAD (570779c): tracked restaurados, untracked de la sesión eliminados; `plans/` y `docs/` nuevos conservados.
- [x] Gates de verificación del revert: `pnpm install` OK; `pnpm -r build` OK; plc-engine **7/7** (la suite original de `engine.spec.ts`); repo status == HEAD + `plans/`/`docs/` untracked.

### Deliverable 2 — WP8: trabajo de símbolos sobre el código original (D25, D26, D28) — DONE

- [x] (3) `ESTOP` añadido: hongo rojo, cuerpo NC idéntico al pulsador NC original, NC momentáneo en el solver original. <!-- completed: 2026-10-30 -->
- [x] (4) `SWITCH_1P` redibujado según `selector.webp`. <!-- completed: 2026-10-30 -->
- [x] (5) `LIMIT_SWITCH_NO` y `LIMIT_SWITCH_NC` añadidos según sus imágenes de referencia. <!-- completed: 2026-10-30 -->
- [x] (6) `BREAKER_1P`: **sin cambios** (byte-idéntico a HEAD) — redraw cancelado, el usuario aprobó el diseño original (D28). <!-- completed: 2026-10-30 -->
- [x] (9) Contacto OL añadido = contacto NC + texto "OL" encima. <!-- completed: 2026-10-30 -->
- [x] (12) `MOTOR` añadido a la paleta (glifo original) y alcanzable desde ella. <!-- completed: 2026-10-30 -->
- [x] (1) `PUSH_BUTTON_NC`: sin cambios (ya es el diseño original — verificado tras el revert). <!-- completed: 2026-10-30 -->

**Gates de WP8 (verificados 2026-10-30)**: `pnpm -r build` 0 errores · plc-engine **7/7** (sin cambios en el motor) · `cd ui && npx tsc --noEmit` **29 → 29** errores (todos pre-existentes en HEAD, intocados).

**EOL (hallazgo)**: los archivos de HEAD en el repo son **LF** (autocrlf sin configurar); se preservó LF en todos los archivos editados (la premisa "CRLF preservados" de este documento era incorrecta para HEAD).

**Sign-off visual pendiente** (usuario): `ESTOP` (reposo y **accionado: seta hundida + barra suelta**), selector (`SWITCH_1P`), contacto OL (**naranja**), tile `MOTOR` en paleta, **LAMP con X**; limit switch — **NO abierto = SVG exacto (13/14)**, **NC cerrado = SVG exacto (11/12)**, **NC accionado = dibujo abierto del NO**, **NO cerrado = barra + cuña**; hoja (rejilla/marco/zonas/cuadro), menú de componente (**click derecho**), cables simplificados, click izquierdo en el origen cancela el cable y click derecho cancela cable (WP9/WP10/WP12); `BREAKER_2P` alineado (ver Deliverable 3); revisión de los **±2.5 px** de `BREAKER_1P`/`NOTC`/`NCTO` (Deliverable 8).

### Deliverable 3 — WP9 "Hoja completa" (nuevo 2026-10-30; D29)

Portar desde el checkpoint `C:\Users\Johan\AppData\Local\Temp\opencode\phase5-base\src\diagram\` (implementación descartada de fase 4/5) sobre HEAD+WP8 **SOLO** el trabajo de hoja/alignment:

- [x] Rejilla SVG (líneas mayor/menor), marco, marcas de zona y cuadro de título (`sheet.tsx`, `SheetLayer`). <!-- completed: 2026-10-30 -->
- [x] Tarjeta "Hoja" en el inspector (Proyecto/Fecha/Escala/Página; el cuadro de título se edita desde ahí). <!-- completed: 2026-10-30 -->
- [x] `grid.ts`: snap como fuente única de verdad + clamp fix (padding siempre múltiplo del spacing). <!-- completed: 2026-10-30 -->
- [x] Congruencia de la retícula de terminales para **todos** los tipos (incluidos los nuevos de WP8: ESTOP, LIMIT_SWITCH_NO/NC, OL). <!-- completed: 2026-10-30 -->
- [x] Migración de snapshot v1→v2 (los archivos viejos siguen cargando) — `snapshot.ts` + tests. <!-- completed: 2026-10-30 -->
- [x] Tests de alineación (`alignment.spec.ts`) cubriendo también los tipos nuevos de WP8. <!-- completed: 2026-10-30 -->

**Gates de WP9 (verificados 2026-10-30)**: `pnpm -r build` **0** · plc-engine **7/7** · ui `tsc --noEmit` **28 errores** (baseline 29; el error pre-existente eliminado era la línea borrada de CSS-var `--grid-spacing`) · ui vitest **176/176** (alignment 149, snapshot 12, grid 8, sheet 7) · smoke del dev-server **HTTP 200** · prueba de migración: fixture v1 real parsea a v2 con defaults de hoja, versión desconocida rechazada.

**Portado**: `ui/src/diagram/{grid,sheet,snapshot}.ts(x)` + 4 spec files + fixture; `vitest` como única dependencia nueva en `ui` (devDep, `^2.1.8` resuelto a `2.1.9`, aprobada por D31). **Hallazgo (dev server)**: había un dev server pre-existente en el puerto **5173**, detectado y **dejado intacto**; el smoke corrió en **5174**.

**EXPLÍCITAMENTE NO portado** (sigue rechazado, D29): cambios de motor de fase 1/2, symbol restyles de fase 3, side panel de fase 5. **Excepción**: el glifo `BREAKER_1P` queda **byte-idéntico** (excepción dura, held); `BREAKER_2P` quedó **alineado** (terminales y 24→15 / 78→69, shift del glifo −7.2) y está **PENDIENTE de sign-off del usuario** (cambio visual; los circuitos 2P guardados pueden tener endpoints de cable sueltos hasta que se re-arrastren).

### Deliverable 4 — WP10 "Cables y menús" (nuevo 2026-10-30; D30)

- [x] (a) **Limpieza de trazado**: `moveAttachedWireEndpoints` ahora **simplifica** los wires (quita segmentos colineales, duplicados y de longitud cero; preserva endpoints y ortogonalidad); se re-simplifica al soltar un cable y al reconectar. <!-- completed: 2026-10-30 -->
- [x] (b) **Click derecho cancela** un cable en progreso (`contextmenu` consumido SOLO entonces; menú nativo del navegador intacto en el resto). <!-- completed: 2026-10-30 -->
- [x] (c) **Menú flotante en componente** (left-click, pequeño): **Duplicar / Rotar / Eliminar / Editar etiqueta (inline)**. Abre SOLO en un click limpio (delta < 6 px; no en drag, terminal ni inicio de cable); cierra con click en el canvas, drag, inicio de cable o Escape; oculto mientras corre el PLC; **primer listener global de keydown, con guard de inputs**. <!-- completed: 2026-10-30 -->

**Gates de WP10 (verificados 2026-10-30)**: `pnpm -r build` **0** · plc-engine **7/7** · ui `tsc --noEmit` **28 errores** (== baseline de WP9) · ui vitest **189/189** (+13: `interaction.spec.ts` pure helpers + casos de `grid.spec.ts` simplify-on-move) · smoke del dev-server **HTTP 200**.

**Archivos de WP10**: `ui/src/diagram/{grid.ts, interaction.ts (+interaction.spec.ts), grid.spec.ts}`, `ui/src/DiagramBuilder.tsx`, `ui/src/App.css`.

### Deliverable 5 — WP11 "NC limit switch trazado desde la referencia" (2026-10-30) — DONE

- [x] **Fuente**: imagen `D:\Relevant files\Download (del cel viejo)\Electricidad\Controles eléctricos\reference\NC limit switch.png`, trazada píxel a píxel (300x300; ink bbox x43-256 / y115-161; círculos en ref (107,149.5) y (192,149.5) con r_outer 11; barra desde el borde del círculo izquierdo subiendo hasta el tope del círculo derecho; cuña triangular de actuador colgando bajo la barra; números de terminal **"11"** / **"12"**). <!-- completed: 2026-10-30 -->
- [x] **Mapeo**: escala uniforme 0.571 dentro del viewBox **128x64**, con terminales en (6.4,32) y (121.6,32) — leads 3.2→34.5 y 93.5→124.8; círculos movidos a (40,32) y (88,32) r 5.5; barra (45.5,32)→(88,26); vértices de la cuña (79.4,27.4) / (75.7,38.6) / (45.5,32.5); textos en x16.6 / x110.3, y24. <!-- completed: 2026-10-30 -->
- [x] **Estado abierto**: rotación rígida de −10° de barra+cuña alrededor del pivote (45.5,32): fin de barra (86,19), cuña (78,21.6) / (76.4,33.3). <!-- completed: 2026-10-30 -->
- [x] `LIMIT_SWITCH_NO` separado (`case`) del NC y **byte-equivalente en comportamiento**; líneas del émbolo (plunger) eliminadas **solo** para NC (no están en la referencia). <!-- completed: 2026-10-30 -->

**Gates de WP11 (verificados 2026-10-30)**: ui `tsc --noEmit` **28 == baseline** · ui vitest **189/189** · plc-engine **7/7** · `pnpm -r build` **0**.

### Deliverable 6 — WP12 "Intercambio de gestos + limit switch NO vectorial + NC accionado" (2026-10-30) — DONE

**(a) Intercambio de interacción (petición del usuario)** — el menú flotante de componente ahora se abre **SOLO con click derecho** sobre un componente; el click izquierdo ya **no** lo abre. El handler se movió a la raíz `.freeplay-component`, así que funciona igual sobre el glifo, el press-target, la etiqueta y los puertos. El **click izquierdo ahora CANCELA** un cable en progreso **solo si cae en el punto de origen** (mismo botón de terminal o mismo punto del lienzo): helper `isWireOriginHit(draftPoints, point, tolerance = 6)` en `ui/src/diagram/interaction.ts`, conectado al `onClick` de terminal y a `handleCanvasClick`. El click derecho mientras se dibuja sigue cancelando (handler del canvas); el click derecho sobre un componente mientras se dibuja **burbujea** al canvas. El menú se cierra con click izquierdo en canvas, click izquierdo en componente, inicio de drag, inicio de cable, Escape y al ejecutar una acción. Se eliminó el código muerto `shouldOpenComponentMenu` / `COMPONENT_MENU_CLICK_THRESHOLD` y `componentPointerDownRef`. <!-- completed: 2026-10-30 -->

**(b) `LIMIT_SWITCH_NO` migrado al SVG vectorial del propio usuario** — vector suministrado por el usuario, `viewBox` **1024x768**, con los bornes **13/14** como paths. Mapeo aplicado: escala uniforme **0.1403** y traslación **(-7.85, -21.85)** → los círculos de terminal caen en **(40,32)** / **(88,32)** con r **5.5** y los leads en **3.2 / 34.5** y **93.5 / 124.8**, es decir, exactamente la misma retícula de terminales que el resto de símbolos. Los anillos de terminal son **huecos y vienen del propio SVG** (bornes **13/14** como paths), no discos macizos ni círculos de la app. Nueva clase CSS `.diagram-symbol__vector { fill: currentColor; stroke: none; }`. <!-- completed: 2026-10-30 -->

**(c) Ambos SVG de referencia copiados completos** — el path compuesto izquierdo de `NO limit switch.svg` (viewBox **1024x768**) tiene **TRES subpaths**: contorno exterior (leads + anillo de terminal + contorno de la cuchilla), el hueco del anillo izquierdo y el **interior hueco de la cuchilla**. La copia anterior al código se había **truncado a los dos primeros subpaths**, por eso la cuchilla salía maciza. Ahora se copia **completa** (5192 chars) y se renderiza con `fill-rule="evenodd"`: reproduce la referencia `NO limit switch.webp` exactamente (anillos huecos, cuchilla ahusada hueca, bornes **13/14** como paths vectoriales). También se usa ahora `NC limit switch.svg` (viewBox **220x53**): un path compuesto con **4 subpaths** (leads + barra + cuña + 2 huecos de anillo) más **4 paths de etiqueta** para "11"/"12"; el mapeo `translate(1.95 10.99) scale(0.568)` lleva los centros de anillo (66.99,37)/(151.49,37) a la retícula **(40,32)/(88,32)** y los leads a ~**3.5/124.5**. <!-- completed: 2026-10-30 -->

**(d) `LIMIT_SWITCH_NO` y `LIMIT_SWITCH_NC` comparten un `case` con cuatro combinaciones** — **NO abierto** = vector NO + **13/14** · **NO cerrado** = vector NC + **13/14** · **NC cerrado** = vector NC + **11/12** · **NC accionado (abierto)** = vector NO + **11/12**. Por tanto el NC accionado se ve exactamente como el NO abierto, y ambos estados tienen el **mismo grosor de trazo**. **Ambos estados son ahora paths vectoriales puros**: el cerrado usa `NC limit switch.svg` (con **11/12 como paths vectoriales**, no texto) y el peso se normaliza con el stroke del contorno (`2/escala`). Ya no hay `<line>`/`<circle>`/`<text>` para estos dos tipos: todo son paths `diagram-symbol__vector` con `fill-rule="evenodd"`, así que el glifo sigue `currentColor` y los colores de contacto cerrado/accionado siguen funcionando. <!-- completed: 2026-10-30 -->

> **Nota (copia de los SVG)**: ambos SVG de referencia deben copiarse **completos** al código. Truncar el path izquierdo del NO a sus dos primeros subpaths **pierde el hueco de la cuchilla** y el glifo sale macizo; el `fill-rule="evenodd"` solo funciona si están todos los subpaths.

> **Nota (WP12c, 2026-10-30) — peso de trazo normalizado**: el arte del usuario trae líneas de ~**1.2 unidades** frente a las **3.2** del resto de símbolos; se engrosa con `stroke`, no reescalando la geometría. Como el stroke se escala con el `transform` del grupo, el valor local es `stroke-width = 2 / escala`: **NO ≈ 14.256** (`2 / 0.1403`) y **NC ≈ 3.521** (`2 / 0.568`). Render en **dos capas**: `.diagram-symbol__vector` (`fill: currentColor; stroke: none`) con los paths completos (relleno exacto, huecos intactos) y `.diagram-symbol__vector--outline` (`fill: none; stroke: currentColor; stroke-linecap/linejoin: round`) con SOLO los subpaths de contorno y de los huecos de los bornes — los huecos decorativos (interior de la cuchilla/cuña) no se trazan para que queden abiertos. Helper `pickVectorSubpaths(pathData, indexes)` (regex `/M[^M]*/g`) en `ui/src/DiagramBuilder.tsx`. Procedimiento completo: [docs/vector-symbol-pipeline.md](../../../docs/vector-symbol-pipeline.md).

**Gates de WP12 (verificados 2026-10-30)**: ui `tsc --noEmit` **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` **0** · smoke del dev-server **HTTP 200**. Verificación visual en un **renderer SVG real** (screenshot de Chrome headless del markup React exacto) para los **cuatro estados** — coincidente con las referencias.

### Deliverable 7 — WP13 "AC source, SPST, Emergency pb y OL desde arte del usuario" (2026-10-30) — DONE

Migración de cuatro símbolos al arte del usuario con el pipeline de [docs/vector-symbol-pipeline.md](../../../docs/vector-symbol-pipeline.md). Validado con capturas Chrome-headless del markup React exacto a **160 px** y con zoom, además de las compuertas: ui tsc **28** (baseline), ui vitest **190/190**, plc-engine **7/7**, `pnpm -r build` OK y smoke del dev-server **HTTP 200**.

| Tipo | Fuente | viewBox fuente | Transform | Peso |
|------|--------|----------------|-----------|------|
| `POWER_SOURCE` | `AC source.svg` | 980x980 | `translate(-7.91 -39.49) scale(0.146087)` | nativo ~4.0 u (no se normaliza: el arte ya es más grueso que 3.2; se deja tal cual) |
| `SWITCH_1P` | `SPST-Switch.svg` (abierto) + variante cerrada | 347x100 | `translate(3.84 7.86) scale(0.365714)` | arte de trazo: `stroke-width = 3.2 / 0.365714 ≈ 8.75` local |
| `ESTOP` | `Emergency push button.svg` (+ `Emergency push button (opened).svg` en WP14) | 450.168x159.806 | `translate(-0.393 5.784) scale(0.29518)` (re-mapeado en WP14) | 2 capas, `stroke-width = 2 / 0.29518 ≈ 6.78` local; el accionado añade anillos `3.2 / escala` (ver Deliverable 8) |
| `OL_CONTACT` | sin SVG: reutiliza el glifo del contacto NC (`XIO`) | 128x72 | — | `diagram-symbol__line` 3.2 |

**Notas de implementación**:

- **Orden de pintado**: cuando el arte trae varios subpaths, el orden del SVG original importa y se reproduce literalmente — en `SPST-Switch.svg`, anillo izquierdo → palanca/salidas → anillo derecho; pintar los anillos primero hace que la palanca invada el hueco del anillo.
- **Peso nativo**: si el arte ya es más grueso que 3.2 unidades (`AC source.svg`, ~4.0 u), **no** se añade stroke de normalización; se documenta como excepción en vez de encoger el glifo.
- **`POWER_SOURCE`**: 2 paths (contorno con 4 subpaths + onda), `fill-rule="evenodd"`; anillos del arte en (8.54,31.90)/(119.21,32.44) y terminales de cable en (6.4,32)/(121.6,32) — la punta del cable queda dentro del hueco del anillo. viewBox del símbolo **128x60 → 128x64**; terminales vía `projectSymbolPoint(6.4, 32, 64)` / `(121.6, 32, 64)` (mismos píxeles 8/152, 68).
- **`SWITCH_1P`**: arte de trazo (no relleno) → peso directo con `stroke-width` local; anillos con `.diagram-symbol__vector-ring` (`stroke: currentColor; fill: rgba(255,255,255,0.98)`, mismo relleno que `.diagram-symbol__terminal`); abierto lleva `transform="translate(-9 -155)"` en la palanca, cerrado ya viene en coordenadas finales.
- **`ESTOP`**: 5 paths = símbolo (3 subpaths: contorno + 2 huecos de anillo) + 4 paths de 11/12; dos capas con los 3 subpaths en la de contorno; glifo **estático** dentro de cada estado (antes la barra se movía con `pushButtonPressed`, flag que nunca fue `true` para ESTOP por ser maintained → sin regresión funcional). **Actualizado en WP14** (D36): escala `0.29518`, estado accionado con `(opened).svg` y anillos replicados como círculos blancos superpuestos — ver Deliverable 8.
- **`OL_CONTACT`**: exactamente el contacto NC (`XIO`: platinas x=56/72 de y=16 a 56 + cuchilla (46,20)-(82,52) cerrado) + rótulo `OL`+número, viewBox **128x72** con línea de contacto en **y=36**; número desde `label` (`renderSymbolGraphic` recibe `label`; primer grupo de dígitos, por defecto `1`) → `OL2` muestra `OL2`; estilo `.diagram-symbol--ol` y estado por `switchClosed`.

**Gates de WP13 (verificados 2026-10-30)**: ui `tsc --noEmit` **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` OK · smoke del dev-server **HTTP 200** · capturas Chrome-headless del markup React exacto a 160 px y con zoom.

**Sign-off visual añadido**: AC source (anillo+onda, L1/L2) · SPST abierto/cerrado · Emergency pb (11/12) · OL = NC + OL n.

### Deliverable 8 — WP14 "ESTOP accionado, OL naranja, LAMP y alineación de terminales" (2026-10-31, D36) — DONE

Validado con capturas Chrome-headless del markup React exacto a **160 px** y con zoom, más las compuertas: ui tsc **28** (baseline), ui vitest **190/190**, plc-engine **7/7** y `pnpm -r build` OK.

- [x] **ESTOP — estado accionado**: se añadió `Emergency push button (opened).svg` (misma retícula **450.168x159.806**). El path principal tiene **5 subpaths** y en ese arte los **anillos no son huecos**: el SVG original los dibuja como **círculos blancos + trazo encima** de la traza. Reproducción en la app: relleno del path + trazo de contorno solo de los **3 subpaths no-anillo** + dos `<circle>` con la clase `.diagram-symbol__vector-ring` y `stroke-width = 3.2 / escala` (≈ **10.84**). Se activa con `options.estopPressed` (que el llamador calcula como `component.type === "ESTOP" && component.isPressed === true`, `ui/src/DiagramBuilder.tsx:6408`). **Sin esos círculos el anillo derecho queda macizo**. <!-- completed: 2026-10-31 -->
- [x] **ESTOP — re-mapeo**: la escala pasó a **`0.29518`** con `translate(-0.393 5.784)` para que los extremos de las salidas caigan exactamente en los terminales proyectados (**8/152 px**), no 4.3 px adentro. <!-- completed: 2026-10-31 -->
- [x] **OL_CONTACT**: patas extendidas a viewBox **2.3..125.7** (antes 6.4..121.6) por el mismo motivo (el viewBox 72 proyecta con `offsetX = 5.33`). Color del símbolo: **naranja `#ea580c`** (`.diagram-symbol--ol`), antes rojo. <!-- completed: 2026-10-31 -->
- [x] **LAMP**: `Lamp_symbol.svg` (280x120, trazo, sin `viewBox` declarado) mapeado a las proporciones del viewBox **128x64**: patas **6.4→46.72** y **81.28→121.6**, círculo **r=17.28** centrado en **(64,32)** y X inscrita **(52,20)-(76,44)** / **(76,20)-(52,44)**. Se dibuja con las clases de la app (`diagram-symbol__line` / `diagram-symbol__shape`) para conservar el brillo (`--lamp-glow-*`) y el relleno blanco que oculta cables. <!-- completed: 2026-10-31 -->
- [x] **Simetría de terminales**: auditoría hecha — todos los símbolos de dos terminales horizontales proyectan y redondean a los mismos puntos de retícula **(8,68)** y **(152,68)** en coordenadas del componente. Quedan dos desviaciones conocidas de **±2.5 px** entre la línea dibujada y el terminal redondeado: `BREAKER_1P` (pata en y=34 → **70.5 px**, terminal **68**) y `NOTC`/`NCTO` (pata en y=30 → **65.5 px**, terminal **68**). **No se tocaron**: `BREAKER_1P` está aprobado byte-idéntico (D28). <!-- completed: 2026-10-31 -->

**Gates de WP14 (verificados 2026-10-31)**: ui `tsc --noEmit` **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` **OK** · capturas Chrome-headless del markup React exacto a 160 px y con zoom.

**Docs de WP14**: [docs/vector-symbol-pipeline.md](../../../docs/vector-symbol-pipeline.md#símbolos-migrados) (tabla y notas de ESTOP reposo/accionado, LAMP y OL naranja) + sección [Simetría de terminales](../../../docs/vector-symbol-pipeline.md#simetría-de-terminales-auditoría-2026-10-31).

**Sign-off visual añadido**: ESTOP accionado (seta hundida + barra suelta) · OL naranja · LAMP con X.

### Deliverable 9 — WP15 "E-stop enclavado + alineación de cables" (2026-10-31, D37) — DONE

Validado con las compuertas: ui tsc **28** (baseline), ui vitest **194/194**, plc-engine **7/7** y `pnpm -r build` OK.

- [x] **E-stop enclavado**: `applyMomentaryPress` (`ui/src/DiagramBuilder.tsx:618`, exportada) distingue el ESTOP del resto de pulsadores momentáneos: un click lo acciona y lo deja enclavado (`isPressed=true` aunque se suelte el pointer) y otro click lo libera (toggle). `applyMomentaryRelease` (`:633`) ignora el ESTOP. El resto de pulsadores conserva press/release. Cubierto con **4 tests** en `ui/src/diagram/interaction.spec.ts` (`:121`). <!-- completed: 2026-10-31 -->
- [x] **Fuente AC — anillos y cable**: el arte dibuja los anillos como huecos transparentes y el cable (por detrás del componente) terminaba dentro del hueco como un muñón descentrado. Se añadieron **dos `<circle>` blancos de `r=45` en unidades fuente** (`ui/src/DiagramBuilder.tsx:1474`), bajo el mismo `transform` y **antes del vector**: el relleno blanco tapa el cable hasta el borde exterior del anillo y el cable queda unido limpio. Aplica a cualquier símbolo cuyo borne sea un anillo en el extremo del dibujo. `ty` de la fuente AC ajustado de −39.49 a **−39.68** (`:1382`) para que la pata caiga exactamente en **y=32** del viewBox. <!-- completed: 2026-10-31 -->
- [x] **Alineación vertical**: el cable se dibuja en la retícula de terminales (**y=68 px** del componente); una pata fuera de esa línea produce un escalón visible. Se alineó `BREAKER_1P`: patas/anillos de **y=34 → y=32** y arco de **28/10 → 26/8** (`ui/src/DiagramBuilder.tsx:1493`; terminales en `:1172`), rompiendo la byte-identidad de **D28** por pedido explícito del usuario sobre el alineado de cables (D28 se flexibiliza **solo** para alineación vertical). `NOTC`/`NCTO` siguen con la pata en **y=30** (2.5 px de desfase) porque su glifo es más alto y bajarlo **recorta las colas del temporizado** → queda como pendiente. <!-- completed: 2026-10-31 -->

**Gates de WP15 (verificados 2026-10-31)**: ui `tsc --noEmit` **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK**.

**Docs de WP15**: [docs/vector-symbol-pipeline.md](../../../docs/vector-symbol-pipeline.md#alineación-vertical-del-cable-wp15-d37) (alineación vertical, discos blancos en anillos huecos, sección ESTOP enclavado y simetría actualizada).

**Sign-off visual añadido**: E-stop enclava y libera con click · cable limpio en los anillos de la fuente AC · breaker alineado.

### Deliverable 10 — WP16 "Causa raíz del desfase cable/pata" (2026-10-31, D38) — DONE

- [x] **Síntoma**: en el lienzo el cable quedaba **1-3 px** desplazado en vertical respecto a la pata del símbolo (escalón visible en la unión), en **todos** los símbolos — no era un problema de ningún glifo en particular. <!-- completed: 2026-10-31 -->
- [x] **Causa raíz**: `projectSymbolPoint` (`ui/src/DiagramBuilder.tsx:1138`) asume `COMPONENT_GLYPH_HEIGHT = 102` (`:272`) y centra el glifo en esos 102 px (`SYMBOL_VIEWPORT_TOP = (102-84)/2 = 9`, `:275`), pero el contenedor CSS `.freeplay-component__symbol-rotator` medía **96 px**. El SVG de 84 px (viewBox 128x64 → contenido de 80 px centrado) arrancaba en **6 px** en vez de 9, así que la pata dibujada quedaba **3 px por encima** del terminal proyectado. <!-- completed: 2026-10-31 -->
- [x] **Arreglo**: `.freeplay-component__symbol-rotator { height: 102px }` (`ui/src/App.css:2156`) con un comentario que ata el valor a `COMPONENT_GLYPH_HEIGHT`. <!-- completed: 2026-10-31 -->
- [x] **Verificación**: arnés que replica la estructura DOM real (contenedor 160x136 → rotator → svg de 84 px) con un cable en la **y proyectada**: con 96 px se ve el escalón, con 102 px coincide exacto. <!-- completed: 2026-10-31 -->
- [x] **Consecuencia**: el rótulo del componente baja **6 px** y sigue dentro de los **136 px** del componente (`COMPONENT_HEIGHT`, `:271`). Los ajustes por símbolo de WP15 (`POWER_SOURCE` `ty=-39.68`, `BREAKER_1P` patas en y=32) **se mantienen**: corregían desfases propios de su arte. <!-- completed: 2026-10-31 -->
- [x] **Regla**: si cambia `COMPONENT_GLYPH_HEIGHT`, cambia también la altura del rotator; **deben ser el mismo número**. <!-- completed: 2026-10-31 -->

**Gates de WP16 (verificados 2026-10-31)**: ui `tsc --noEmit` **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK**.

**Docs de WP16**: [docs/vector-symbol-pipeline.md · Alineación del cable con la pata (causa raíz)](../../../docs/vector-symbol-pipeline.md#alineación-del-cable-con-la-pata-causa-raíz).

**Sign-off visual añadido**: cable alineado con la pata en todos los símbolos.

### Deliverable 11 — WP17 "E-stop con las nuevas trazas normal/opened" (2026-10-31, D39) — DONE

Validado con las compuertas: ui tsc **28** (baseline), ui vitest **194/194**, plc-engine **7/7** y `pnpm -r build` OK.

- [x] **ESTOP — reposo**: `Emergency push button.svg` es ahora la traza de reposo. Path principal de **3 subpaths** (salidas + barra + seta) y **sin huecos**; los anillos son **dos círculos blancos + trazo aparte**. Transform `translate(-0.193 6.482) scale(0.288588)`, `stroke-width = 2/escala ≈ 6.93` local y anillos con `3.2/escala ≈ 11.09`. <!-- completed: 2026-10-31 -->
- [x] **ESTOP — accionado** (`isPressed`): `Emergency push button (opened).svg`, misma estructura (3 subpaths + 2 anillos); la barra queda **~20 unidades fuente más abajo**. Transform `translate(-0.353 6.103) scale(0.290296)`, `stroke-width ≈ 6.89`, anillos `≈ 11.02`. <!-- completed: 2026-10-31 -->
- [x] **Mapeo propio por estado**: las dos trazas **no comparten la línea de bornes** (centros de anillo en `y=102.28` vs `y=102.99` en unidades fuente), así que cada estado calcula su escala/traslación para que el extremo de las salidas caiga en **(2.286,36)/(125.714,36)** del viewBox **128x72**, que proyecta a los terminales **(8,68)/(152,68)**. <!-- completed: 2026-10-31 -->
- [x] **Rótulos y anillos**: cada SVG re-exportado trae **sus propios paths de 11/12**; el render usa `ESTOP_VECTOR_LABEL_PATHS` o `ESTOP_VECTOR_OPEN_LABEL_PATHS` según el estado. Los anillos se dibujan **siempre** con `.diagram-symbol__vector-ring` (blanco + trazo `currentColor`) **después** del relleno/contorno, igual que en los SVG originales. <!-- completed: 2026-10-31 -->
- [x] **Constantes y render**: `ui/src/DiagramBuilder.tsx:1398` (reposo `:1405`, accionado `:1412`), render en `:1673`, anillos en `:1696`, rótulos en `:1708`; activación en el call site `:6433` (`component.type === "ESTOP" && component.isPressed === true`). <!-- completed: 2026-10-31 -->

**Gates de WP17 (verificados 2026-10-31)**: ui `tsc --noEmit` **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK**.

**Docs de WP17**: [docs/vector-symbol-pipeline.md · Símbolos migrados](../../../docs/vector-symbol-pipeline.md#símbolos-migrados) (tabla de trazas + mapeo por estado + anillos siempre dibujados).

**Sign-off visual añadido**: **E-stop reposo (seta arriba + barra cerrada)** · **E-stop accionado (seta hundida + barra suelta)**.

### Deliverable 12 - WP18 "E-stop re-exportado (traza abierta y rotulos nuevos)" (2026-10-31, D39 actualizado) - DONE

Los dos SVG de `reference/` se re-exportaron y se re-extrajo todo de los archivos:

- **Traza abierta nueva**: la barra y la linea de bornes bajaron (pata en `y=102.99`). Nuevo mapeo: `translate(-0.353 6.103) scale(0.290296)`, `stroke-width = 2/escala ≈ 6.89`, anillos `3.2/escala ≈ 11.02`. Reposo sin cambios.
- **Rótulos por estado**: cada SVG trae sus propios paths 11/12 (se movieron con el arte). Nuevas constantes `ESTOP_VECTOR_OPEN_LABEL_PATHS`; el render elige según `isPressed`.
- **Anillos**: `ESTOP_VECTOR_RINGS` (302.544,102.225 / 135.017,102.301) y `ESTOP_VECTOR_OPEN_RINGS` (302.603,102.873 / 134.947,102.873).
- Extraccion automatica de los archivos: `paths[2..5]` = digitos, `paths[6]` = traza principal, `<circle>`/`<ellipse>` blancos = anillos.

**Gates de WP18**: ui `tsc --noEmit` **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK**. Verificado con Chrome headless a 200 y 450 px en ambos estados.

## Acceptance Criteria

- [x] `pnpm -r build` en verde. — **Verificado 2026-10-30** (WP8).
- [x] plc-engine **7/7** sin cambios (la suite original; ningún test de motor modificado). — **Verificado 2026-10-30** (WP8).
- [x] **NO changes** to `plc-engine/src`, `ladder-types/src`, semantics del solver, layout/grid/panel — diff limitado a glifos/símbolos y listas de tipos de la UI. — **Verificado en WP8** (WP9/WP10 añaden cambios de UI de hoja/cables, pero siguen sin tocar motor/ladder/solver).
- [x] Cada tipo nuevo añadido **consistentemente a TODAS las listas originales**: `BuilderComponentType` union, paleta, whitelist de snapshot, definiciones de terminales, render de glifo, labels por defecto, helpers de conducción/solver — con **check de exhaustividad** (switch exhaustivo en verde). — Verificado en WP8 (ui tsc 29→29: sin errores nuevos).
- [ ] Símbolos visualmente coincidentes con las imágenes de referencia (sign-off del usuario). — **Pendiente**: ESTOP (reposo y accionado), selector, LIMIT_SWITCH_NO/NC, OL (naranja), LAMP con X, tile MOTOR.
- [x] `MOTOR` alcanzable en la paleta. — Verificado en WP8.
- [x] Sin dependencias nuevas; finales de línea **LF preservadas** (HEAD es LF, autocrlf sin configurar — la premisa CRLF original era incorrecta para HEAD).

## Dependencies on Other Phases

| Phase | Relationship | Notes |
|-------|-------------|-------|
| Phases 1-6 | reverted-by | Su código fue revertido por D24; sus docs quedan como registro histórico (D27). Phase 7 parte de HEAD (estado original), no de sus resultados. |
| Phase 3 | historical | Los items (3)(5)(9) se pidieron originalmente en fase 3; ahora son aditivos sobre HEAD (los tipos no existen allí). |

## Notes

- **Decisiones**: D24 (full revert aprobado), D25 (retiradas canceladas; `MOTOR` a la paleta), D26 (trabajo solo de símbolos sobre el código original), D27 (docs de fases 1-6 = registro histórico), **D28** (`BREAKER_1P` aprobado sin redraw; flexibilizado solo para alineación vertical en WP15), **D29** (portar de lo descartado SOLO la hoja completa/alignment), **D30** (cables = limpieza de trazado; click derecho cancela; menú en componente), **D31** (vitest en ui aprobado como dependencia solo de tests, sin Playwright ni otras), **D32** (menú = click derecho; click izquierdo cancela el cable solo en el punto de origen), **D33** (símbolos desde los SVG del usuario tal cual, copiados completos, con `fill-rule="evenodd"` para los subpaths huecos; el mapeo solo escala/traslada para que los anillos caigan en la retícula de terminales), **D34** (peso normalizado con `stroke-width = 2/escala` en la capa de contorno), **D35** (los SVG de trazo fijan el peso con `stroke-width` local; arte nativo >3.2 u se deja tal cual; el orden de pintado del SVG original se respeta), **D36** (el ESTOP accionado usa el SVG "(opened)" y replica los anillos como círculos blancos superpuestos; los terminales se alinean re-mapeando el arte a los píxeles proyectados 8/152) y **D37** (el E-stop enclava con click; el cable se dibuja en la retícula y=68, las patas deben caer ahí, `BREAKER_1P` se alinea y los anillos huecos llevan disco blanco debajo) y **D38** (la altura del contenedor del glifo debe ser igual a `COMPONENT_GLYPH_HEIGHT` = 102; estaba en 96 y producía un desfase global de 3 px entre cable y pata) y **D39** (el E-stop usa dos trazas distintas — reposo/accionado — con mapeo independiente por estado; ambas comparten los rótulos 11/12 y los anillos se dibujan como círculos blancos con trazo). D19-D21 anuladas por D25; D23 parcialmente anulada (`PUSH_BUTTON_NC` ya es el original); D30(c) corregida por D32 (el menú pasó de click izquierdo a click derecho).
- **Honestidad sobre el revert**: las fases 1-6 produjeron trabajo que el usuario rechazó; nada de su código sobrevive en HEAD. Los gates "34/34, E2E 7/7, ui vitest 501" de fases anteriores **no aplican al árbol actual** (es el original: plc-engine 7/7, sin ui tests de esas fases).
- **Checkpoint para WP9**: `C:\Users\Johan\AppData\Local\Temp\opencode\phase5-base\src\diagram\` — fuente del port de hoja/alignment. Cuidado: ese checkpoint también contiene motor (fase 1/2), restyles (fase 3) y side panel (fase 5) que NO se portan (D29).
- **vitest en ui (D31)**: para los tests de alignment/snapshot que traerá WP9 se aprobó añadir `vitest` como dependencia **solo de tests** en `ui`; no se añade Playwright ni ninguna otra dependencia.
- Orden sugerido: WP9 (hoja/alignment, base de lo visual) primero, luego WP10 (cables/menús). WP8 ya ejecutado (redraws + aditivos). Secuenciales, no en paralelo.

## Result (cierre 2026-10-30/31)

Phase 7 **done**: WP8 (símbolos), WP9 (hoja completa), WP10 (cables/menús), WP11 (limit switch NC trazado de la imagen de referencia), **WP12 (intercambio de gestos + limit switch NO vectorial + NC accionado)**, **WP13 (AC source, SPST, Emergency pb y OL desde arte del usuario)**, **WP14 (ESTOP accionado, OL naranja, LAMP y alineación de terminales)**, **WP15 (E-stop enclavado + alineación de cables)**, **WP16 (causa raíz del desfase cable/pata: rotator 96→102)** y **WP17 (E-stop con las nuevas trazas normal/opened, mapeo por estado)** completados con sus gates en verde (`pnpm -r build` 0, plc-engine 7/7, ui tsc 28 == baseline, **ui vitest 194/194**, dev smoke HTTP 200; WP14/WP15/WP17 validados además con Chrome-headless a 160 px y zoom). Único ítem abierto en todo el plan: **sign-off visual del usuario** (lista en Sign-off visual pendiente y en el handover). Pendiente técnico menor: **`NOTC`/`NCTO` 2.5 px** (glifo alto, recorta colas si se baja).

**WP20 (2026-10-31)**: geometría de terminales (top=9, sin desplazamiento CSS), reconciliación de topología (`wireTopology.ts`, puertos exactos, uniones, autoborrado de sueltos), lógica no dirigida sobre redes (`buildResolvedPortGraph` + `collectRungPaths`), puentes solo en cruces reales con el cable más nuevo, pan off/solo fondo, inputs del plano con commit en blur y clamp-only, y limpieza de capas/filtros/zoom/scroll para el desfase al bajar. Circuito de referencia guardado como fixture; `reference-circuit.spec.ts` valida 28 cables, idempotencia, rungs M/TR1/Y/D y simulación física (M + lámpara + TR1). Gates: ui tsc **25** (< baseline 28), ui vitest **212/212**, plc-engine **7/7**, `pnpm -r build` **OK**.
