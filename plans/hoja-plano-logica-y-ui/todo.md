---
type: planning
entity: todo
plan: "hoja-plano-logica-y-ui"
updated: "2026-10-31"
---

# Todo: hoja-plano-logica-y-ui

> Tracking [hoja-plano-logica-y-ui](plan.md) · Plan completado 2026-10-30 (D1-D18), **fase 7 re-scoped y ampliada 2026-10-30/31 (D1-D39)** · Handover final: [handovers/hoja-plano-final.md](handovers/hoja-plano-final.md)
> **AVISO (D24)**: el código de las fases 1-6 fue revertido a git HEAD (570779c); el plan y sus docs de fase quedan como registro histórico. Fase 7 = símbolos sobre el código original (D25-D28) + hoja completa (D29) + cables/menús (D30).

## Active Phase: 7 — CERRADA (done 2026-10-30)

- **Scope**: [Phase 7](phases/phase-7.md) — Símbolos sobre el código original (revert D24 + WP8 hecho D25-D28) + **WP9 hoja completa (D29)** + **WP10 cables/menús (D30)** + **WP11 limit switch NC trazado** + **WP12 gestos/NO vectorial/NC accionado** + **WP13 AC source/SPST/Emergency pb/OL (D35)** + **WP14 ESTOP accionado/OL naranja/LAMP (D36)** + **WP15 E-stop enclavado/alineación de cables (D37)** + **WP16 causa raíz del desfase cable/pata (D38)** + **WP17 E-stop con las nuevas trazas normal/opened (D39)**; dependencia `vitest` en ui aprobada solo-tests (D31). **WP8 + WP9 + WP10 + WP11 + WP12 + WP13 + WP14 + WP15 + WP16 + WP17 completados; fase 7 → `done`.**
- **Implementation**: (sin `implementation/phase-7-impl.md` aún)
- **Relevant Docs**: [docs/symbol-catalog.md](../../docs/symbol-catalog.md) · [docs/vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md) · [docs/modules/ui.md](../../docs/modules/ui.md) · imágenes de referencia `D:\Relevant files\Download (del cel viejo)\Electricidad\Controles eléctricos\reference\` (5 imágenes) · checkpoint WP9 `C:\Users\Johan\AppData\Local\Temp\opencode\phase5-base\src\diagram\`
- **Previous Phase**: [Phase 6](phases/phase-6.md) (done; código revertido por D24)
- **Decisiones**: D1-D39 todas RESOLVED

### Completed (phase 7)

- [x] **Revert completo a HEAD (D24)**: tracked restaurados, untracked de la sesión eliminados; `plans/` y `docs/` conservados <!-- completed: 2026-10-30 -->
- [x] Gates del revert: `pnpm install` OK, `pnpm -r build` OK, plc-engine **7/7** (suite original), repo status == HEAD + plans/docs <!-- completed: 2026-10-30 -->
- [x] **WP8 · Símbolos sobre el código original (D25, D26, D28)** <!-- completed: 2026-10-30 -->
- [x] (3) Añadir `ESTOP`: hongo rojo, cuerpo NC como el pulsador NC original, NC momentáneo (ref `Emergency push button.png`) <!-- completed: 2026-10-30 -->
- [x] (4) Redibujar `SWITCH_1P` según `selector.webp` <!-- completed: 2026-10-30 -->
- [x] (5) Añadir `LIMIT_SWITCH_NO`/`LIMIT_SWITCH_NC` según `NO limit switch.webp` / `NC limit switch.png` <!-- completed: 2026-10-30 -->
- [x] (9) Añadir contacto OL = contacto NC + texto "OL" encima <!-- completed: 2026-10-30 -->
- [x] (12) Añadir `MOTOR` a la paleta (glifo original; alcanzable desde la paleta) <!-- completed: 2026-10-30 -->
- [x] (6) `BREAKER_1P`: **sin cambios, byte-idéntico a HEAD** — redraw cancelado, diseño original aprobado (D28) <!-- completed: 2026-10-30 -->
- [x] (1) `PUSH_BUTTON_NC` = diseño original tras el revert — sin cambios <!-- completed: 2026-10-30 -->
- Items (2)(7)(8)(10)(11): **nada que hacer** (no existen en HEAD; retiradas canceladas por D25)
- [x] Gates WP8: `pnpm -r build` 0 · plc-engine **7/7** · ui tsc **29→29** (errores pre-existentes intactos) <!-- completed: 2026-10-30 -->
- Hallazgo EOL: HEAD es **LF** (autocrlf sin configurar); LF preservado en los edits (la premisa CRLF era incorrecta para HEAD)

- [x] **WP9 · Hoja completa (D29)** — COMPLETADO 2026-10-30: portado de phase-4 sheet/alignment del checkpoint `phase5-base\src\diagram\` sobre HEAD+WP8 (`ui/src/diagram/{grid,sheet,snapshot}.ts(x)` + 4 spec files + fixture). NO portado: motor fases 1/2, restyles fase 3, side panel fase 5. `BREAKER_1P` byte-idéntico (excepción dura, held) <!-- completed: 2026-10-30 -->
- [x] Gates WP9: `pnpm -r build` **0** · plc-engine **7/7** · ui tsc **28** errores (baseline 29; el pre-existente eliminado = línea borrada de CSS-var `--grid-spacing`) · ui vitest **176/176** (alignment 149, snapshot 12, grid 8, sheet 7) · smoke dev-server **HTTP 200** · migración: fixture v1 real → v2 con defaults de hoja, versión desconocida rechazada <!-- completed: 2026-10-30 -->
- Dev server pre-existente detectado en puerto **5173** y dejado intacto; smoke corrió en **5174**
- [x] **WP10 · Cables y menús (D30)** — COMPLETADO 2026-10-30: (a) limpieza de trazado — `moveAttachedWireEndpoints` **simplifica** los wires (quita colineales, duplicados y de longitud cero; preserva endpoints y ortogonalidad), re-simplifica al soltar cable y al reconectar · (b) click derecho cancela cable en progreso (`contextmenu` consumido solo entonces; menú nativo intacto en el resto) · (c) menú flotante en componente **Duplicar / Rotar / Eliminar / Editar etiqueta (inline)**: abre solo en click limpio (delta < 6 px; no en drag/terminal/inicio de cable), cierra con click en canvas/drag/inicio de cable/Escape; oculto mientras corre; primer keydown global, input-guarded <!-- completed: 2026-10-30 -->
- [x] Gates WP10: `pnpm -r build` **0** · plc-engine **7/7** · ui tsc **28** (== baseline) · ui vitest **189/189** (+13: `interaction.spec.ts` pure helpers + simplify-on-move en `grid.spec.ts`) · smoke dev-server **HTTP 200** <!-- completed: 2026-10-30 -->
- Archivos WP10: `ui/src/diagram/{grid.ts, interaction.ts (+spec), grid.spec.ts}`, `DiagramBuilder.tsx`, `App.css`
- [x] **WP11 · NC limit switch trazado desde la imagen de referencia** — COMPLETADO 2026-10-30: fuente `D:\Relevant files\Download (del cel viejo)\Electricidad\Controles eléctricos\reference\NC limit switch.png`, trazado píxel a píxel (300x300, ink bbox x43-256/y115-161; círculos ref (107,149.5)/(192,149.5) r_outer 11; barra desde el borde del círculo izquierdo subiendo al tope del derecho; cuña triangular bajo la barra; terminales "11"/"12"). Mapeo: escala uniforme 0.571 → viewBox 128x64, terminales en (6.4,32)/(121.6,32) — leads 3.2→34.5 / 93.5→124.8, círculos (40,32)/(88,32) r5.5, barra (45.5,32)→(88,26), cuña (79.4,27.4)/(75.7,38.6)/(45.5,32.5), textos x16.6/x110.3 y24. Estado abierto = rotación rígida −10° de barra+cuña sobre el pivote (45.5,32): barra fin (86,19), cuña (78,21.6)/(76.4,33.3). `LIMIT_SWITCH_NO` separado del NC (`case`), byte-equivalente en comportamiento; líneas de émbolo quitadas **solo** para NC (no están en la referencia) <!-- completed: 2026-10-30 -->
- [x] Gates WP11: ui tsc **28 == baseline** · ui vitest **189/189** · plc-engine **7/7** · `pnpm -r build` **0** <!-- completed: 2026-10-30 -->
- [x] **WP12 · Intercambio de gestos + limit switch NO vectorial + NC accionado** — COMPLETADO 2026-10-30: (a) **intercambio de interacción** — el menú flotante de componente se abre **SOLO con click derecho** (handler movido a la raíz `.freeplay-component`: funciona sobre glifo, press-target, etiqueta y puertos); el click izquierdo ya no lo abre; el click izquierdo **cancela** un cable en progreso **solo si cae en el punto de origen** (mismo terminal o mismo punto del lienzo) vía `isWireOriginHit(draftPoints, point, tolerance = 6)` en `ui/src/diagram/interaction.ts`, conectado al `onClick` de terminal y a `handleCanvasClick`; click derecho mientras se dibuja sigue cancelando (canvas) y sobre un componente burbujea al canvas; el menú cierra con click izquierdo en canvas/componente, inicio de drag, inicio de cable, Escape y ejecución de acción; eliminado el código muerto `shouldOpenComponentMenu` / `COMPONENT_MENU_CLICK_THRESHOLD` y `componentPointerDownRef` <!-- completed: 2026-10-30 -->
- [x] WP12 (b) `LIMIT_SWITCH_NO` migrado al **SVG vectorial del usuario** (viewBox 1024x768, bornes 13/14 como paths): escala uniforme **0.1403** + traslación **(-7.85,-21.85)** → círculos de terminal en **(40,32)/(88,32) r5.5**, leads en **3.2/34.5** y **93.5/124.8** (misma retícula que el resto); terminales conservan el estilo de anillo `diagram-symbol__terminal` (no los discos macizos del trazado); nueva clase CSS `.diagram-symbol__vector { fill: currentColor; stroke: none; }` <!-- completed: 2026-10-30 -->
- [x] WP12 (c) ambos SVG de referencia copiados **completos**: el path compuesto izquierdo del NO (1024x768) tiene **3 subpaths** (contorno + hueco del anillo + **hueco de la cuchilla**) y se renderiza con `fill-rule="evenodd"` — la copia truncada anterior dejaba la cuchilla maciza; el NC (220x53) es un path compuesto de **4 subpaths** + 4 paths de etiqueta "11"/"12", mapeado con `translate(1.95 10.99) scale(0.568)` → anillos (66.99,37)/(151.49,37) a la retícula (40,32)/(88,32) <!-- completed: 2026-10-30 -->
- [x] WP12 (d) NO y NC comparten `case` con **4 combinaciones**: NO abierto = vector NO + 13/14 · NO cerrado = vector NC + 13/14 · NC cerrado = vector NC + 11/12 · NC accionado = vector NO + 11/12 (el NC accionado se ve igual que el NO abierto y ambos estados tienen el mismo grosor de trazo); sin `<line>`/`<circle>`/`<text>` para estos tipos — todo `diagram-symbol__vector` con `fill-rule="evenodd"`, sigue `currentColor` <!-- completed: 2026-10-30 -->
- [x] Gates WP12: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` **0** · smoke dev-server **HTTP 200**; verificación visual en renderer SVG real (Chrome headless del markup React exacto) para los **cuatro estados**, coincidente con las referencias <!-- completed: 2026-10-30 -->
- [x] **WP12c · peso de trazo normalizado + render en dos capas** — el arte del usuario (~1.2 unidades) se engrosa con `stroke-width = 2/escala` (**NO ≈ 14.256**, **NC ≈ 3.521**), aplicado solo al contorno: `.diagram-symbol__vector` (relleno exacto `fill: currentColor; stroke: none`) + `.diagram-symbol__vector--outline` (`fill: none; stroke: currentColor`) con los subpaths de contorno/bornes; los huecos decorativos quedan abiertos. Helper `pickVectorSubpaths` (`/M[^M]*/g`). Procedimiento en [docs/vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md) (D34) <!-- completed: 2026-10-30 -->
- [x] **WP13 · AC source, SPST, Emergency pb y OL desde arte del usuario (D35)** — COMPLETADO 2026-10-30: `POWER_SOURCE` desde `AC source.svg` (980x980, `translate(-7.91 -39.49) scale(0.146087)`, viewBox **128x64**, terminales `projectSymbolPoint(6.4, 32, 64)`/`(121.6, 32, 64)`, peso nativo ~4.0 u sin normalizar); `SWITCH_1P` desde `SPST-Switch.svg` (347x100, `translate(3.84 7.86) scale(0.365714)`, trazo `3.2/0.365714 ≈ 8.75` local, `.diagram-symbol__vector-ring`, orden anillo izq → palanca → anillo der, abierto `translate(-9 -155)`); `ESTOP` desde `Emergency push button.svg` (450.168x159.806, `translate(3.478 7.599) scale(0.277444)`, 2 capas `2/0.277444 ≈ 7.21`, bornes 11/12 vectoriales); `OL_CONTACT` = glifo NC (`XIO`) + rótulo `OL`+número desde `label` (por defecto `1`). Docs: [vector-symbol-pipeline.md · Símbolos migrados](../../docs/vector-symbol-pipeline.md#símbolos-migrados) + gotchas de orden de pintado y peso nativo >3.2 u <!-- completed: 2026-10-30 -->
- [x] Gates WP13: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` OK · smoke dev-server **HTTP 200** · capturas Chrome-headless del markup React exacto a 160 px y con zoom <!-- completed: 2026-10-30 -->
- [x] **WP14 · ESTOP accionado + OL naranja + LAMP + alineación de terminales (D36)** — COMPLETADO 2026-10-31: `ESTOP` accionado desde `Emergency push button (opened).svg` (path principal de **5 subpaths**; anillos **no huecos**: se replican como **círculos blancos + trazo** superpuestos) → relleno + contorno de los **3 subpaths no-anillo** + 2 `<circle>` `.diagram-symbol__vector-ring` con `stroke-width = 3.2 / 0.29518 ≈ 10.84`, activado por `options.estopPressed` (`component.type === "ESTOP" && component.isPressed === true`); sin los círculos el anillo derecho queda **macizo** <!-- completed: 2026-10-31 -->
- [x] WP14 · ESTOP **re-mapeado** a escala **`0.29518`** + `translate(-0.393 5.784)` para que las salidas caigan en los terminales proyectados (**8/152 px**), no 4.3 px adentro <!-- completed: 2026-10-31 -->
- [x] WP14 · `OL_CONTACT` con patas extendidas al viewBox **2.3..125.7** (antes 6.4..121.6; el viewBox 72 proyecta con `offsetX = 5.33`) y color **naranja `#ea580c`** (`.diagram-symbol--ol`), antes rojo <!-- completed: 2026-10-31 -->
- [x] WP14 · `LAMP` desde `Lamp_symbol.svg` (280x120, trazo, sin `viewBox`): patas 6.4→46.72 / 81.28→121.6, círculo r=17.28 en (64,32) y X inscrita; clases `diagram-symbol__line`/`__shape` para conservar brillo (`--lamp-glow-*`) y relleno blanco <!-- completed: 2026-10-31 -->
- [x] WP14 · **auditoría de simetría**: todos los símbolos de dos terminales horizontales proyectan y redondean a **(8,68)/(152,68)**; desviaciones conocidas de **±2.5 px** en `BREAKER_1P` y `NOTC`/`NCTO` documentadas sin tocar (D28) <!-- completed: 2026-10-31 -->
- [x] Gates WP14: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` **OK** · capturas Chrome-headless del markup React exacto a 160 px y con zoom <!-- completed: 2026-10-31 -->
- [x] **WP15 · E-stop enclavado + alineación de cables (D37)** — COMPLETADO 2026-10-31: `applyMomentaryPress` (exportada, `ui/src/DiagramBuilder.tsx:618`) togglea `isPressed` para ESTOP (un click acciona y enclava aunque se suelte el pointer; otro click libera) y `applyMomentaryRelease` (`:633`) lo ignora; resto de pulsadores momentáneos sin cambios. 4 tests en `ui/src/diagram/interaction.spec.ts` <!-- completed: 2026-10-31 -->
- [x] WP15 · **fuente AC**: 2 `<circle>` blancos `r=45` en unidades fuente (`ui/src/DiagramBuilder.tsx:1474`), bajo el mismo `transform` y antes del vector, tapan el cable en los anillos huecos (el muñón descentrado desaparece); `ty` −39.49 → **−39.68** para que la pata caiga en y=32 <!-- completed: 2026-10-31 -->
- [x] WP15 · **alineación vertical**: `BREAKER_1P` patas/anillos **y=34 → y=32** y arco **28/10 → 26/8** (`ui/src/DiagramBuilder.tsx:1493`; terminales `:1172`); D28 (byte-identidad) flexibilizado **solo** para alineación vertical por pedido explícito del usuario. `NOTC`/`NCTO` sin cambio (pendiente) <!-- completed: 2026-10-31 -->
- [x] Gates WP15: ui tsc **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK** <!-- completed: 2026-10-31 -->
- [x] **WP16 · Causa raíz del desfase cable/pata (D38)** — COMPLETADO 2026-10-31: el cable quedaba **1-3 px** desplazado en vertical respecto a la pata (escalón visible) en **todos** los símbolos. `projectSymbolPoint` (`ui/src/DiagramBuilder.tsx:1138`) asume `COMPONENT_GLYPH_HEIGHT = 102` (`:272`) y centra el glifo en 102 px (`SYMBOL_VIEWPORT_TOP = 9`, `:275`), pero `.freeplay-component__symbol-rotator` medía **96 px** → el SVG arrancaba en 6 px y la pata caía 3 px por encima del terminal. **Arreglo**: `height: 102px` en el rotator (`ui/src/App.css:2156`) con comentario que lo ata a `COMPONENT_GLYPH_HEIGHT`; verificado con arnés DOM real (160x136 → rotator → svg 84 px) y cable en la y proyectada. El rótulo baja 6 px y sigue dentro de los 136 px del componente. Los ajustes por símbolo de WP15 (`BREAKER_1P`, `POWER_SOURCE`) **se mantienen** (corregían desfases de su propio arte) <!-- completed: 2026-10-31 -->
- [x] Gates WP16: ui tsc **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK** <!-- completed: 2026-10-31 -->
- [x] **WP17 · E-stop con las nuevas trazas normal/opened (D39)** — COMPLETADO 2026-10-31: el ESTOP usa el **par de trazas nuevas** del usuario. **Reposo** (`Emergency push button.svg`): salidas + barra + seta = **3 subpaths sin huecos**; anillos = 2 círculos blancos + trazo aparte; `translate(-0.193 6.482) scale(0.288588)`, `stroke-width = 2/escala ≈ 6.93`, anillos `3.2/escala ≈ 11.09`. **Accionado** (`isPressed`, `Emergency push button (opened).svg`): misma estructura, barra **~20 unidades fuente más abajo**; `translate(-0.351 7.173) scale(0.290154)`, `stroke-width ≈ 6.89`, anillos `≈ 11.03`. **Mapeo propio por estado** (centros de bornes 102.28 vs 99.35 en y fuente): salidas a **(2.286,36)/(125.714,36)** del viewBox 128x72 → terminales **(8,68)/(152,68)**. Los **rótulos 11/12 son los mismos paths** en ambos estados y usan la transformación del estado activo; los anillos se dibujan **siempre** con `.diagram-symbol__vector-ring` después del relleno/contorno <!-- completed: 2026-10-31 -->
- [x] Gates WP17: ui tsc **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK** <!-- completed: 2026-10-31 -->

### Pending

- [ ] **Sign-off visual del usuario — ÚNICO pendiente del plan**: símbolos **ESTOP, selector (`SWITCH_1P`)**, OL, tile `MOTOR` (WP8) · **limit switch (WP12, actualizado 2026-10-30)**:
  - NO abierto = `NO limit switch.svg` exacto + 13/14 vectoriales
  - NO cerrado = `NC limit switch.svg` exacto + 13/14 vectoriales
  - NC cerrado = `NC limit switch.svg` exacto + 11/12 vectoriales
  - NC accionado = `NO limit switch.svg` + 11/12 vectoriales
  - Ambos estados con el peso normalizado (NO ≈ 14.256 · NC ≈ 3.521) y render en dos capas
  - AC source (anillo+onda, L1/L2)
  - SPST abierto/cerrado
  - Emergency pb (11/12)
  - OL = NC + OL n
  - **E-stop reposo (seta arriba + barra cerrada)** (WP17)
  - **E-stop accionado (seta hundida + barra suelta)** (WP14/WP17)
  - OL naranja
  - LAMP con X
  - **E-stop enclava y libera con click** (WP15)
  - **Cable limpio en los anillos de la fuente AC** (WP15)
  - **Breaker alineado** a la retícula del cable (WP15)
  - **Cable alineado con la pata en todos los símbolos** (WP16: rotator 102 px = `COMPONENT_GLYPH_HEIGHT`)
- [ ] **`NOTC`/`NCTO`: 2.5 px de desfase entre la pata (y=30 → 65.5 px) y el terminal redondeado (68 px)** — no se bajó el glifo porque es más alto y **recorta las colas del temporizado**; queda como pendiente. Ver [docs/vector-symbol-pipeline.md · Simetría de terminales](../../docs/vector-symbol-pipeline.md#simetría-de-terminales-auditoría-2026-10-31-actualizada-wp15).
- [ ] **Refresh `docs/symbol-catalog.md` line references** — still points at the reverted `ui/src/diagram/symbols.tsx`.
- **`BREAKER_2P` alineado** (terminales y 24→15 / 78→69, shift glifo −7.2; posible endpoints de cable sueltos en circuitos 2P guardados hasta re-drag) · **hoja** (rejilla/marco/zonas/cuadro de título) · **menú de componente = click derecho** · **click izquierdo en el origen cancela el cable** · **cables simplificados** · **click derecho cancela cable**

**Gates de aceptación (fase)**: `pnpm -r build` verde · plc-engine 7/7 sin cambios · NO changes en `plc-engine/src`, `ladder-types/src`, solver · cada tipo nuevo en TODAS las listas originales con exhaustiveness check · símbolos == referencias (sign-off usuario) · MOTOR en paleta · sin dependencias nuevas salvo `vitest` en ui solo-tests (D31) · finales LF preservadas.

## Plan Completed (histórico: fases 1-6)

El plan se cerró el 2026-10-30 con la fase 6 (ver changelog en [plan.md](plan.md#changelog)).
Único pendiente restante: **sign-off visual del usuario** (OQ-h + capturas de fases 4/5, ver
[plan.md · Pending user sign-off](plan.md#pending-user-sign-off)).

### Phase Context (histórico de la fase 6, ya cerrada)

- **Scope**: [Phase 6](phases/phase-6.md) — Migración de datos, E2E y documentación (R14; D15)
- **Implementation**: [implementation/phase-6-impl.md](implementation/phase-6-impl.md)
- **Latest Handover**: [handovers/hoja-plano-final.md](handovers/hoja-plano-final.md)
- **Relevant Docs**: [docs/README.md](../../docs/README.md) · [docs/modules/](../../docs/modules/ui.md) · [docs/rules-contract.md](../../docs/rules-contract.md) · [docs/symbol-catalog.md](../../docs/symbol-catalog.md)
- **Previous Phase**: [Phase 5](phases/phase-5.md) (done; ver Result en el archivo)
- **Decisiones**: D1-D18 todas RESOLVED; **pending user sign-off** (capturas fases 4/5 + ESTOP, ver [plan.md](plan.md#pending-user-sign-off))

### Pending

- [ ] OQ-h · Sign-off visual de ESTOP (sin imagen de referencia; implementado por convención) — **pendiente del usuario**; ver lista de capturas en [plan.md · Pending user sign-off](plan.md#pending-user-sign-off)
- [ ] Revisión visual de símbolos vs. imágenes de referencia (plan Testing Strategy; ver OQ-h) — único ítem de DoD sin marcar
- [ ] Normalizar finales de línea CRLF o documentar decisión (R-D; arrastrado de fases 1-4). `docs/*.md` quedaron en CRLF en fase 6; las fuentes del repositorio siguen sin decisión registrada

### In Progress

<!-- Empty -->

### Completed

- [x] Fase 6 · Migración de datos, E2E y documentación (R14; D15) <!-- completed: 2026-10-30 -->
- [x] Fase 6 · Datos: delta de formato cero verificado (OD6-1); originales intactos como fixtures; demo aditiva `motor-guard-demo` → 3 demos en `data/` y `sample-programs/` <!-- completed: 2026-10-30 -->
- [x] Fase 6 · `ui/src/projectData.samples.spec.ts` (17 tests): cada archivo de `data/` y `sample-programs/` parsea con los parsers reales y corre en `PlcEngine` <!-- completed: 2026-10-30 -->
- [x] Fase 6 · `projectData.ts`: parsers exportados; **7 loaders huérfanos eliminados** (OD6-2) <!-- completed: 2026-10-30 -->
- [x] Fase 6 · Playwright en `ui` (D5): `playwright.config.ts`, specs `e2e/01..06` + 5 fixtures v2 + validador `e2eFixtures.spec.ts`; `pnpm test:e2e` separado de `pnpm test` (OD6-5); `data/` = publicDir de vite (OD6-3) <!-- completed: 2026-10-30 -->
- [x] Fase 6 · E2E **7/7** (run/stop, E-stop, sobrecarga, edición en marcha, panel momentáneo, v1-load, versión desconocida) <!-- completed: 2026-10-30 -->
- [x] Fase 6 · Fix del harness de paridad: entradas de dispositivo vía `setDeviceInputs(compileDiagram(...).deviceInputs)` (`ui/src/parity/harness.ts:81`) <!-- completed: 2026-10-30 -->
- [x] Fase 6 · Desviación registrada: tercer caso de spec 06 descartado (fixture v1 sin cable de retorno, no ejecutable por diseño) <!-- completed: 2026-10-30 -->
- [x] Fase 6 · Docs (D15): `docs/README.md` (índice/arquitectura D1/comandos), `docs/modules/{ui,plc-engine,ladder-types,server}.md`, `docs/symbol-catalog.md`, `docs/rules-contract.md`, `docs/DEPLOYMENT.md` (E2E), análisis con banner **Superseded**; link check **0 enlaces rotos** <!-- completed: 2026-10-30 -->
- [x] Fase 6 · Gates: ui tsc 0, ui vitest **501/501 (20 files)**, plc-engine **34/34**, `pnpm -r build` OK <!-- completed: 2026-10-30 -->
- [x] Fase 6 · Cierre: `phases/phase-6.md` → done, `plan.md` → **completed**, changelog final, handover `handovers/hoja-plano-final.md` <!-- completed: 2026-10-30 -->
- [x] Fase 5 · Reshape de UI: hoja + panel físico (R12, R13; D2/D3/D5, D18) <!-- completed: 2026-10-30 -->
- [x] Fase 5 · `ui/src/panel/{model,panelControls,panelActuation,SidePanel}.ts(x)`: `SidePanel` con `ControlPanel` (Run/Stop/Un scan/Reset/reset de fallo), controles por dispositivo (momentáneo, mantenido, ESTOP, sensor, trip, FUSE, luces de motor/lámpara desde tags del motor) <!-- completed: 2026-10-30 -->
- [x] Fase 5 · `StatusDisplay` integrado (excluye tags `__builder_device__`); drawer de debug colapsable con pestañas Trazo (`TracePanel`) y Renglones (`LadderDisplay`) — huérfanos reutilizados, ninguno borrado (D3) <!-- completed: 2026-10-30 -->
- [x] Fase 5 · `DiagramBuilder` expone handle `forwardRef` (`actuateDevice`/`setMomentaryPressed`) y `onDeviceInventoryChange`; Run/fault-reset quitados del builder (colocación única, OD5-3) <!-- completed: 2026-10-30 -->
- [x] Fase 5 · `EngineSession`: hold de pulso de un scan solo para `SYS:RESET` (OD5-4) <!-- completed: 2026-10-30 -->
- [x] Fase 5 · `App` grid layout: hoja + panel 360 px; ≤1180 px una sola columna <!-- completed: 2026-10-30 -->
- [x] Fase 5 · Gates: ui tsc 0, ui vitest 470/470, plc-engine 34/34, `pnpm -r build` OK <!-- completed: 2026-10-30 -->
- [x] Fase 5 · Decisión D18 (actuación solo vía handle→`deviceInputs`; Run/Stop/Reset solo en panel; drawer debug; pulso solo `SYS:RESET`) registrada <!-- completed: 2026-10-30 -->
- [x] Fase 4 · Hoja tipo plano + migración snapshot v2 (R1, R2, R14; D8, D17) <!-- completed: 2026-10-30 -->
- [x] Fase 4 · `ui/src/diagram/grid.ts` (snap/ortogonalidad; clamp fix: padding siempre múltiplo del spacing) <!-- completed: 2026-10-30 -->
- [x] Fase 4 · `sheet.tsx`: rejilla SVG mayor/menor, marcas de zona, marco, cuadro de título, `SheetLayer`; gradiente CSS de rejilla eliminado de `App.css` (SVG = fuente única de verdad) <!-- completed: 2026-10-30 -->
- [x] Fase 4 · `snapshot.ts`: `CIRCUIT_SNAPSHOT_VERSION = 2`, `migrateCircuitSnapshot` v1→v2 con defaults de hoja, versión desconocida lanza error <!-- completed: 2026-10-30 -->
- [x] Fase 4 · `BREAKER_2P` y 24→15/78→69 y `GUARDAMOTOR` x 8/62/116 y 15/69 alineados a la retícula de terminales (resto de D16) <!-- completed: 2026-10-30 -->
- [x] Fase 4 · Tarjeta "Hoja" en el inspector (Proyecto/Fecha/Escala/Página); cuadro de título editado desde ahí (D17) <!-- completed: 2026-10-30 -->
- [x] Fase 4 · Gates: ui tsc 0, ui vitest 450/450 (236 de alineación), `pnpm -r build` OK <!-- completed: 2026-10-30 -->
- [x] Fase 4 · Baseline: solo las 4 claves `BREAKER_2P` regeneradas; el resto byte-idéntico <!-- completed: 2026-10-30 -->
- [x] Fase 4 · Incidente: `DiagramBuilder.tsx` vaciado a mitad de sesión por edición fallida; restaurado byte-idéntico desde el checkpoint <!-- completed: 2026-10-30 -->
- [x] Fase 4 · Decisión D17 (marcas de zona desde rejilla mayor, snapshot v2 en px, cuadro vía inspector, alineación BREAKER_2P/GUARDAMOTOR) registrada <!-- completed: 2026-10-30 -->
- [x] Plan creado y fases 1-6 escritas (borrador) <!-- completed: 2026-10-29 -->
- [x] Plan aprobado; decisiones D1-D8 registradas en Decision Log <!-- completed: 2026-10-29 -->
- [x] Fase 3 · Símbolos ANSI/NEMA: `ui/src/diagram/symbols.tsx` (`renderSymbolGraphic`, `getInstructionSymbol`) y `symbolGeometry.ts` (tabla única terminales/geometría) <!-- completed: 2026-10-29 -->
- [x] Fase 3 · Paleta `ui/src/diagram/palette.ts` en español, agrupada (control/protección/potencia/señalización), OTL/OTU incluidos <!-- completed: 2026-10-29 -->
- [x] Fase 3 · Baseline: spec + `__baseline__/symbols-14.baseline.json`; diff = solo 3 fixes de alineación aprobados, otras 44 claves byte-idénticas (D16) <!-- completed: 2026-10-29 -->
- [x] Fase 3 · `projectData.ts` acepta ESTOP/OLR/TON/TOF (`delayMs`); whitelist de snapshot actualizada <!-- completed: 2026-10-29 -->
- [x] Fase 3 · `deviceMapping.ts` bindings incl. tag fijo `SYS:RESET` (UNSET = sano, D13); `TraceStep.tripped` en el motor; OLR vía trace <!-- completed: 2026-10-29 -->
- [x] Fase 3 · Gates: ui tsc 0, ui vitest 181/181, plc-engine 34/34, `pnpm -r build` OK <!-- completed: 2026-10-29 -->
- [x] Fase 3 · Decisiones D16 (baseline, solo 3 fixes; BREAKER_2P/GUARDAMOTOR px fuera de alcance) registradas <!-- completed: 2026-10-29 -->
- [x] Fase 2 · Compilador `ui/src/compiler/compileDiagram.ts` + `deviceMapping.ts` (cableado → rungs) <!-- completed: 2026-10-29 -->
- [x] Fase 2 · `EngineSession` (`ui/src/runtime/engineSession.ts`) reemplaza la recreación de `PlcEngine` en `App.tsx` (bug 6) <!-- completed: 2026-10-29 -->
- [x] Fase 2 · Solver de vista read-only `ui/src/solver/electricalView.ts` (energía, flujo, `fault`) <!-- completed: 2026-10-29 -->
- [x] Fase 2 · Paridad: F01-F12 + fixtures de motor + round-trip; goldens en `ui/src/parity/goldens` <!-- completed: 2026-10-29 -->
- [x] Fase 2 · WP2-9: solver legacy retirado (`legacyTagSolver.ts`, `TAG_SOURCE`) <!-- completed: 2026-10-29 -->
- [x] Fase 2 · Diagnóstico `search-truncated` añadido <!-- completed: 2026-10-29 -->
- [x] Fase 2 · `ui` typecheck 34 → 0 errores <!-- completed: 2026-10-29 -->
- [x] Fase 2 · Gates: plc-engine 32/32, ui tsc 0, ui vitest 56, `pnpm -r build` OK <!-- completed: 2026-10-29 -->
- [x] Fase 2 · Quitado el retardo de 250 ms de `DiagramBuilder.tsx` (known gap de fase 1) <!-- completed: 2026-10-29 -->
- [x] Fase 2 · Redactado y cerrado `implementation/phase-2-impl.md` <!-- completed: 2026-10-29 -->
- [x] Fase 2 · Navegador no verificado: diferido a E2E de fase 6 <!-- completed: 2026-10-29 -->
- [x] Decisiones D9-D13 registradas en Decision Log (OR de bobinas, E-stop borra latches, Stop de-energiza no latcheadas, reset `SYS:RESET`, UNSET sano en ESTOP/OLR) <!-- completed: 2026-10-29 -->
- [x] Fase 1 · Definir tipos nuevos en `ladder-types/src/index.ts` (paro de emergencia, sobrecarga con rearme, TON/TOF con preset en ms, tag de reset) <!-- completed: 2026-10-29 -->
- [x] Fase 1 · OR de ramas en paralelo a la misma salida en `plc-engine/src/programRunner.ts` (quita last-writer-wins) <!-- completed: 2026-10-29 -->
- [x] Fase 1 · Paro de emergencia con prioridad sobre el scan <!-- completed: 2026-10-29 -->
- [x] Fase 1 · Relevador de sobrecarga con disparo latcheado y entrada de rearme manual <!-- completed: 2026-10-29 -->
- [x] Fase 1 · Pulsadores, interruptores y breakers como entradas reales del motor (`setInput` operativo) <!-- completed: 2026-10-29 -->
- [x] Fase 1 · D4: power-gating TON/TOF y eliminación de `TIMED_CONTACT_ACTUATION_DELAY_MS` (250 ms); preset en ms <!-- completed: 2026-10-29 -->
- [x] Fase 1 · Regla de prioridad OTE/OTL/OTU sobre un mismo tag definida y documentada (D9) <!-- completed: 2026-10-29 -->
- [x] Fase 1 · D2: persistencia por nombre de tag en rebuild; Stop conserva latches; Reset (`SYS:RESET`) limpia salidas latcheadas y enclavamientos <!-- completed: 2026-10-29 -->
- [x] Fase 1 · Revisados los casos de `plc-engine/test/engine.spec.ts` (6 aserciones por D4, justificadas en changelog) <!-- completed: 2026-10-29 -->
- [x] Fase 1 · 24 casos nuevos en 5 spec files (OR, E-stop, sobrecarga, TON/TOF, OTE/OTL/OTU, persistencia, Stop vs. Reset) <!-- completed: 2026-10-29 -->
- [x] Fase 1 · `tsc -p tsconfig.json` en `plc-engine` y `ladder-types` OK <!-- completed: 2026-10-29 -->
- [x] Fase 1 · Gates: vitest `plc-engine` 31/31, `pnpm -r build` OK <!-- completed: 2026-10-29 -->

### Phase 1 open items (no cerrados)

- [ ] Normalizar finales de línea (CRLF) o documentar la decisión (R-D)
- [ ] Revisar y completar `implementation/phase-1-impl.md` con decisiones D9-D13 y desviaciones
- [ ] Marcar criterios de aceptación de `phases/phase-1.md` que se verifiquen formalmente

### Phase 3 open items (ver `phases/phase-3.md` Result)

- [x] OQ-g · Cómo actuar OLR/FUSE/DISCONNECT/GUARDAMOTOR desde el diagrama — **resuelto por el inspector WP3-B con estados múltiples**: OLR/GUARDAMOTOR `normal|disparado`, FUSE `intacto|fundido`, DISCONNECT `cerrado|abierto` <!-- resolved: 2026-10-30 -->
- [ ] OQ-h · Sign-off visual de ESTOP (sin imagen de referencia; implementado por convención) — diferido al final del plan; **capturas de fases 4 y 5 pendientes de revisión del usuario** (lista en [plan.md · Pending user sign-off](plan.md#pending-user-sign-off))
- [x] Catálogo de símbolos en `docs/` diferido a fase 6 (D15) → `docs/symbol-catalog.md` <!-- resolved: 2026-10-30 -->

### Blocked

<!-- Empty -->

## Upcoming

- **Fase 7 CERRADA (done 2026-10-30/31)**: WP8 (símbolos), WP9 (hoja completa), WP10 (cables/menús), WP11 (NC limit switch trazado de la referencia), WP12 (gestos + NO vectorial + NC accionado), WP13 (AC source/SPST/Emergency pb/OL), WP14 (ESTOP accionado + OL naranja + LAMP + simetría de terminales), **WP15 (E-stop enclavado + alineación de cables)**, **WP16 (causa raíz del desfase cable/pata: rotator 96→102)** y **WP17 (E-stop con las nuevas trazas normal/opened)** completados con gates en verde (build 0, engine 7/7, tsc 28 == baseline, vitest **194/194**).
- **Único pendiente del plan**: sign-off visual del usuario — ESTOP/selector/OL/MOTOR, **E-stop reposo (seta arriba + barra cerrada)**, **E-stop accionado (seta hundida + barra suelta)**, **OL naranja**, **LAMP con X**, **E-stop enclava y libera con click**, **cable limpio en los anillos de la fuente AC**, **breaker alineado**, **cable alineado con la pata en todos los símbolos (WP16)**, limit switch (NO abierto = `NO` SVG exacto 13/14 · NO cerrado = `NC` SVG exacto 13/14 · NC cerrado = `NC` SVG exacto 11/12 · NC accionado = `NO` SVG + 11/12; ambos estados vectoriales con peso normalizado y dos capas), `BREAKER_2P` shift, hoja, menú de componente (click derecho), cancelación por origen, cables simplificados, click derecho cancela cable; más el pendiente de **`NOTC`/`NCTO` 2.5 px** (glifo alto, recorta colas si se baja; ver [Pending](#pending)).

## Changelog

<!-- Append-only log of significant changes and decisions -->

### 2026-10-29

- Plan created (borrador). Pendiente de confirmación del usuario antes de ejecutar la fase 1.
- Plan approved; decisions recorded (see Decision Log). Fase 2 re-scoped (D1). Fase 1 actualizada por D2 y D4. Fases siguen `pending`.
- Phase 1 implemented (engine logic). Gates: vitest 31/31, tsc, pnpm -r build. Decisiones D9-D13 registradas. Fase 1 → `done`; Phase 2 → siguiente.

### 2026-10-29 (fase 2)

- Phase 2 implemented; WP2-9 legacy removal done. Gates: plc-engine 32/32, ui tsc 0, ui vitest 56, `pnpm -r build` OK. Fase 2 → `done`; Phase 3 → activa. Decisiones D14 y D15 registradas.

### 2026-10-29 (fase 3)

- Phase 3 implemented (ANSI/NEMA symbols): `ui/src/diagram/{symbols,symbolGeometry,palette}.tsx/.ts`, baseline spec + `symbols-14.baseline.json`, `projectData.ts` ESTOP/OLR/TON/TOF, `deviceMapping` `SYS:RESET`, `TraceStep.tripped`, OLR via trace. Gates: ui tsc 0, ui vitest 181/181, plc-engine 34/34, `pnpm -r build` OK. Fase 3 → `done`; Phase 4 → activa. Decisión D16 registrada.
- Abiertos (no bloquean): OQ-g (actuación OLR/FUSE/DISCONNECT/GUARDAMOTOR desde el diagrama, pendiente usuario) y OQ-h (sign-off visual ESTOP, pendiente usuario). Catálogo en `docs/` diferido a fase 6 (D15).

### 2026-10-30 (fase 4)

- Phase 4 implemented (hoja tipo plano + snapshot v2): `ui/src/diagram/grid.ts`, `sheet.tsx` (rejilla SVG mayor/menor, marcas de zona, marco, cuadro de título, `SheetLayer`; gradiente CSS eliminado), `snapshot.ts` (`CIRCUIT_SNAPSHOT_VERSION = 2` + `migrateCircuitSnapshot` v1→v2 con defaults de hoja; versión desconocida rechazada), tarjeta "Hoja" en el inspector. `BREAKER_2P` y `GUARDAMOTOR` alineados a la retícula de terminales. Gates: ui tsc 0, ui vitest 450/450 (236 de alineación), `pnpm -r build` OK. Baseline: solo las 4 claves `BREAKER_2P` regeneradas. Fase 4 → `done`; Phase 5 → activa. Decisión D17 registrada. Incidente: `DiagramBuilder.tsx` vaciado por edición fallida y restaurado byte-idéntico desde el checkpoint.
- OQ-g resuelta por el inspector WP3-B (estados múltiples: OLR/GUARDAMOTOR `normal|disparado`, FUSE `intacto|fundido`, DISCONNECT `cerrado|abierto`). OQ-h sigue abierta, diferida al final; capturas de fase 4 pendientes de revisión del usuario.

### 2026-10-30 (fase 5)

- Phase 5 implemented (hoja + panel físico): `ui/src/panel/{model,panelControls,panelActuation,SidePanel}.ts(x)` (`ControlPanel` Run/Stop/Un scan/Reset/reset de fallo; controles por dispositivo; `StatusDisplay` sin `__builder_device__`; drawer de debug con Trazo/Renglones), `DiagramBuilder` con handle `forwardRef` (`actuateDevice`/`setMomentaryPressed`) y `onDeviceInventoryChange` (Run/fault-reset fuera del builder, OD5-3), `EngineSession` con hold de pulso de un scan solo para `SYS:RESET` (OD5-4), `App` grid hoja + panel 360 px (≤1180 px una columna). Gates: ui tsc 0, ui vitest 470/470, plc-engine 34/34, `pnpm -r build` OK. Fase 5 → `done`; Phase 6 → activa. Decisión D18 registrada. Se añade la sección "Pending user sign-off" en `plan.md` (capturas de fases 4/5 + ESTOP); OQ-h sigue pendiente del usuario.

### 2026-10-30 (fase 7)

- Phase 7 requested by user (symbol removals + ANSI redraws). Nueva fase `phases/phase-7.md`; `todo.md` → Active Phase 7 con WP7 (retiradas + convert-on-load) y WP8 (redraws ANSI) en Pending. Decisiones D19-D23 RESOLVED en [plan.md](plan.md#decision-log).

### 2026-10-30 (fase 6, plan completado)

- Phase 6 implemented (data compat + demo, E2E 7/7, docs): sin script de migración (delta de formato cero); demo aditiva `motor-guard-demo` (3 demos en `data/` + `sample-programs/`); `projectData.samples.spec.ts` (17 tests) carga y ejecuta cada archivo en el motor; parsers exportados y **7 loaders huérfanos eliminados**; Playwright en `ui` (specs `e2e/01..06`, fixtures v2, `pnpm test:e2e` separado de `pnpm test`); fix del harness de paridad (entradas de dispositivo vía `setDeviceInputs`); tercer caso de spec 06 descartado (fixture v1 sin cable de retorno, no ejecutable por diseño). Docs: `docs/README.md`, `docs/modules/{ui,plc-engine,ladder-types,server}.md`, `docs/symbol-catalog.md`, `docs/rules-contract.md`, `docs/DEPLOYMENT.md` (E2E), análisis con banner **Superseded**; link check **0 enlaces rotos**. Gates: ui tsc 0, ui vitest **501/501 (20 files)**, plc-engine **34/34**, `pnpm -r build` OK, E2E **7/7**. Fase 6 → `done`; **plan → `completed`**; handover `handovers/hoja-plano-final.md`. Pendiente único: OQ-h + capturas de fases 4/5 (sign-off del usuario).

### 2026-10-30 (revert + re-scope fase 7)

- **Full revert a HEAD (570779c) aprobado por el usuario (D24)**: el código de las fases 1-6 se revirtió (tracked restaurados, untracked de la sesión eliminados; `plans/` y `docs/` conservados). Gates: `pnpm install` OK, `pnpm -r build` OK, plc-engine **7/7** (suite original). Motivo: el usuario reportó regresiones ("worked perfectly before").
- **Retiradas CANCELADAS (D25)**: reset button, MPCB/guardamotor, interruptor de seguridad, TON/TOF, OTL/OTU y motores NO se eliminan (D19-D21 anuladas); `MOTOR` se añade a la paleta.
- **Fase 7 re-scoped a solo símbolos (D26)**: adiciones aditivas (ESTOP, LIMIT_SWITCH_NO/NC, OL, MOTOR en paleta) + redraws (`SWITCH_1P`, `BREAKER_1P`) sobre el código original de HEAD; motor/ladder/layout/solver/lógica EXACTAMENTE como en HEAD.
- `phases/phase-1..6.md` marcados con nota "code reverted by D24 (2026-10-30); kept as historical record" (D27); `phases/phase-7.md` reescrito; `todo.md` → Active Phase 7 = revert hecho + WP8 pendiente.

### 2026-10-30 (WP8 done; WP9/WP10 añadidos)

- **WP8 (símbolos) COMPLETADO**: `ESTOP`, `LIMIT_SWITCH_NO`/`NC`, contacto OL añadidos; `MOTOR` en la paleta; `SWITCH_1P` redibujado; `BREAKER_1P` byte-idéntico a HEAD (redraw cancelado, aprobado — D28). Gates: `pnpm -r build` 0, plc-engine **7/7**, ui tsc **29→29** (pre-existentes intactos). Hallazgo EOL: HEAD es **LF**, LF preservado.
- **WP9 hoja completa (D29)** y **WP10 cables/menús (D30)** añadidos a la fase 7 como Pending; **D31** (vitest en ui solo-tests, sin Playwright). Decisiones D28-D31 RESOLVED en [plan.md](plan.md#decision-log).

### 2026-10-30 (WP9 done; WP10 pendiente)

- **WP9 (hoja completa) COMPLETADO**: portado del checkpoint (`ui/src/diagram/{grid,sheet,snapshot}.ts(x)` + 4 specs + fixture). Gates: `pnpm -r build` 0, plc-engine **7/7**, ui tsc **28** (baseline 29; eliminado el pre-existente de la CSS-var `--grid-spacing`), ui vitest **176/176** (alignment 149, snapshot 12, grid 8, sheet 7), smoke dev-server HTTP 200 (en 5174; pre-existente en 5173 intacto), migración v1 real→v2 ok y versión desconocida rechazada. Única dependencia nueva: `vitest` devDep en ui (^2.1.8 → 2.1.9, D31). `BREAKER_1P` byte-idéntico; **`BREAKER_2P` alineado → sign-off pendiente** (terminales y 24→15/78→69, shift −7.2). **WP10 (cables/menús) sigue Pending**.

### 2026-10-30 (WP10 done; fase 7 completa)

- **WP10 (cables y menús) COMPLETADO**: (a) limpieza de trazado — `moveAttachedWireEndpoints` simplifica los wires al mover/soltar/reconectar (quita colineales, duplicados y de longitud cero, preservando endpoints y ortogonalidad); (b) click derecho cancela cable en progreso (`contextmenu` consumido solo entonces); (c) menú flotante de componente (Duplicar/Rotar/Eliminar/Editar etiqueta inline) con apertura en click limpio (delta < 6 px), cierre en canvas/drag/inicio de cable/Escape, oculto en Run, keydown global input-guarded. Archivos: `ui/src/diagram/{grid.ts, interaction.ts (+spec), grid.spec.ts}`, `DiagramBuilder.tsx`, `App.css`. Gates: `pnpm -r build` **0** · plc-engine **7/7** · ui tsc **28** (== baseline) · ui vitest **189/189** (+13) · smoke dev-server **HTTP 200**.
- **Fase 7 → `done`** (`phases/phase-7.md` frontmatter + tabla de fases de `plan.md`); las 7 fases están cerradas. **Todos los items de fase 7 completados; solo queda el sign-off visual del usuario.**

### 2026-10-30 (WP11 done)

- **WP11 (limit switch NC trazado) COMPLETADO**: glifo `LIMIT_SWITCH_NC` redibujado píxel a píxel desde `reference\NC limit switch.png` (escala 0.571 → viewBox 128x64, terminales 11/12 en (6.4,32)/(121.6,32), círculos (40,32)/(88,32) r5.5, barra (45.5,32)→(88,26), cuña del actuador, estado abierto = rotación rígida −10° sobre el pivote (45.5,32)); `LIMIT_SWITCH_NO` separado en `case` con comportamiento byte-equivalente; líneas de émbolo quitadas solo en NC. Gates: ui tsc 28 == baseline · ui vitest 189/189 · plc-engine 7/7 · `pnpm -r build` 0. Lista de sign-off visual actualizada (incluye el NC trazado con 11/12 y su estado abierto).

### 2026-10-30 (WP12 done)

- **WP12 COMPLETADO** (petición del usuario, D32/D33):
  - **(a) Intercambio de gestos**: el menú de componente se abre **solo con click derecho** (handler movido a la raíz `.freeplay-component` → glifo, press-target, etiqueta y puertos); el click izquierdo ya no lo abre y **cancela** el cable en progreso **solo en el punto de origen** (`isWireOriginHit(draftPoints, point, tolerance = 6)` en `ui/src/diagram/interaction.ts`, en terminal `onClick` y `handleCanvasClick`); click derecho durante el dibujo sigue cancelando y sobre un componente burbujea al canvas; menú cierra con click izquierdo (canvas/componente), drag, inicio de cable, Escape y ejecución de acción; eliminados `shouldOpenComponentMenu`, `COMPONENT_MENU_CLICK_THRESHOLD` y `componentPointerDownRef`.
  - **(b) `LIMIT_SWITCH_NO` vectorial del usuario** (viewBox 1024x768, bornes 13/14 como paths): escala 0.1403 + traslación (-7.85,-21.85) → terminales (40,32)/(88,32) r5.5 y leads 3.2/34.5 · 93.5/124.8 (misma retícula); anillos `diagram-symbol__terminal` en vez de discos macizos; nueva clase `.diagram-symbol__vector`.
  - **(c) SVG completos**: el path izquierdo del NO tiene 3 subpaths (contorno + hueco del anillo + hueco de la cuchilla) y ahora se copia completo con `fill-rule="evenodd"` (la copia truncada dejaba la cuchilla maciza); el NC (220x53) usa su path compuesto de 4 subpaths + 4 paths de etiqueta 11/12, mapeado `translate(1.95 10.99) scale(0.568)` → anillos (40,32)/(88,32).
  - **(d) 4 combinaciones en un solo `case`**: NO abierto = NO + 13/14 · NO cerrado = NC + 13/14 · NC cerrado = NC + 11/12 · NC accionado = NO + 11/12; sin `<line>`/`<circle>`/`<text>` (todo `diagram-symbol__vector` con `fill-rule="evenodd"`, sigue `currentColor`).
  - Gates: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` **0** · verificado en renderer SVG real (Chrome headless) para los 4 estados. Lista de sign-off actualizada.

### 2026-10-30 (WP12b)

- **Limit switch NO/NC desde los SVG exactos del usuario**: ambos SVG copiados **completos** y renderizados con `fill-rule="evenodd"`; el NO (1024x768) necesita sus 3 subpaths para que la cuchilla salga hueca. NC mapeado con `translate(1.95 10.99) scale(0.568)` (anillos (66.99,37)/(151.49,37) → (40,32)/(88,32)). Cuatro combinaciones en un `case` (NO abierto / NO cerrado / NC cerrado / NC accionado), sin `<line>`/`<circle>`/`<text>`. Gates: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` **0** · Chrome headless de los 4 estados OK. Sign-off actualizado: NO abierto = `NO` SVG exacto (13/14), NC cerrado = `NC` SVG exacto (11/12), NC accionado = dibujo abierto del NO, NO cerrado = `NC` SVG exacto (13/14).

### 2026-10-30 (WP12c) peso de trazo normalizado + pipeline de símbolos vectoriales documentado

- **WP12c**: peso del trazo normalizado con `stroke-width = 2/escala` solo en el contorno (NO ≈ **14.256**, NC ≈ **3.521**); render en **dos capas** (relleno exacto + contorno) con los huecos decorativos abiertos. Ambos estados del limit switch son paths vectoriales puros (`NC limit switch.svg` para el cerrado, 11/12 como paths). Nuevo [docs/vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md) (D34) enlazado desde el índice y el catálogo; añadido el pendiente de refrescar las referencias de línea de `docs/symbol-catalog.md`. Sin cambios de código; gates vigentes: ui tsc **28 == baseline** · ui vitest **190** · plc-engine **7** · `pnpm -r build` **0**.

### 2026-10-30 (WP13): AC source, SPST, Emergency pb y OL desde arte del usuario

- **WP13 COMPLETADO** (D35): `POWER_SOURCE` desde `AC source.svg` (980x980, `translate(-7.91 -39.49) scale(0.146087)`, viewBox 128x64, terminales `projectSymbolPoint(6.4, 32, 64)`, peso nativo ~4.0 u sin normalizar) · `SWITCH_1P` desde `SPST-Switch.svg` (347x100, `translate(3.84 7.86) scale(0.365714)`, trazo `3.2/0.365714 ≈ 8.75` local, `.diagram-symbol__vector-ring`, orden anillo izq → palanca → anillo der) · `ESTOP` desde `Emergency push button.svg` (450.168x159.806, `translate(3.478 7.599) scale(0.277444)`, 2 capas `2/0.277444 ≈ 7.21`, 11/12 vectoriales) · `OL_CONTACT` = glifo NC (`XIO`) + rótulo `OL`+número desde `label` (por defecto `1`). Docs: [vector-symbol-pipeline.md · Símbolos migrados](../../docs/vector-symbol-pipeline.md#símbolos-migrados) + gotchas de orden de pintado y peso nativo >3.2 u. Gates: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` OK · smoke HTTP 200 · capturas Chrome-headless a 160 px y con zoom. Lista de sign-off actualizada (AC source, SPST abierto/cerrado, Emergency pb 11/12, OL = NC + OL n).

### 2026-10-31 (WP14)

- **WP14 COMPLETADO** (D36): **ESTOP accionado** con `Emergency push button (opened).svg` — path principal de **5 subpaths**, anillos **no huecos** (círculos blancos + trazo encima), render con relleno + contorno de los **3 subpaths no-anillo** + 2 `<circle>` `.diagram-symbol__vector-ring` (`stroke-width = 3.2 / escala ≈ 10.84`), activado por `options.estopPressed`; re-mapeo a **`0.29518`** + `translate(-0.393 5.784)` para alinear las salidas a **8/152 px**. **`OL_CONTACT`** naranja `#ea580c` y patas **2.3..125.7**. **`LAMP`** desde `Lamp_symbol.svg` (patas 6.4→46.72 / 81.28→121.6, círculo r=17.28, X inscrita, clases `__line`/`__shape`). **Auditoría de simetría**: (8,68)/(152,68) para todos los de dos terminales horizontales; pendientes ±2.5 px de `BREAKER_1P` y `NOTC`/`NCTO` (no tocar `BREAKER_1P` sin aprobación). Gates: ui tsc **28 == baseline** · ui vitest **190/190** · plc-engine **7/7** · `pnpm -r build` OK · Chrome-headless del markup exacto a 160 px y con zoom. Docs: [vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md#símbolos-migrados). Sign-off añadido: ESTOP accionado, OL naranja, LAMP con X.

### 2026-10-31 (WP15): E-stop enclavado + alineación de cables

- **WP15 COMPLETADO** (D37): **E-stop enclavado** — `applyMomentaryPress` (`ui/src/DiagramBuilder.tsx:618`) togglea `isPressed` para ESTOP (click acciona y queda enclavado aunque se suelte el pointer; segundo click libera) y `applyMomentaryRelease` (`:633`) lo ignora; 4 tests en `ui/src/diagram/interaction.spec.ts` → ui vitest **194/194**. **Fuente AC** — 2 discos blancos `r=45` en unidades fuente (`:1474`) bajo el mismo `transform` y antes del vector, tapan el cable en los anillos huecos (fin del muñón descentrado); `ty` −39.49 → **−39.68** para que la pata caiga en y=32. **Alineación vertical** — `BREAKER_1P` patas/anillos y=34 → **y=32** y arco 28/10 → **26/8** (`:1493`), flexibilizando la byte-identidad de D28 solo para alineación vertical; `NOTC`/`NCTO` siguen con 2.5 px de desfase (glifo alto, recorta colas si se baja) → pendiente. Gates: ui tsc **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK**. Sign-off añadido: E-stop enclava y libera con click · cable limpio en los anillos de la fuente AC · breaker alineado. Docs: [vector-symbol-pipeline.md](../../docs/vector-symbol-pipeline.md#alineación-vertical-del-cable-wp15-d37).

### 2026-10-31 (WP18): E-stop re-exportado (traza abierta y rotulos nuevos)

- **WP18 COMPLETADO** (D39 actualizado): los dos SVG de `reference/` se re-exportaron; la traza **abierta** cambio (pata en `y=102.99`) y **cada SVG trae sus propios paths de 11/12**. Nuevo mapeo accionado `translate(-0.353 6.103) scale(0.290296)`, `stroke-width ≈ 6.89`, anillos `≈ 11.02`; reposo sin cambios. Render con rotulos por estado (`ESTOP_VECTOR_LABEL_PATHS` / `ESTOP_VECTOR_OPEN_LABEL_PATHS`). Gates: ui tsc **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK**; verificado con Chrome headless a 200 y 450 px.

### 2026-10-31 (WP17): E-stop con las nuevas trazas normal/opened

- **WP17 COMPLETADO** (D39): ESTOP reposo/accionado con las dos trazas del usuario, mapeo independiente por estado, anillos blancos + trazo y rotulos 11/12 vectoriales. Ver `plan.md` §WP17.

### 2026-10-31 (WP16): causa raíz del desfase cable/pata (rotator 96→102)

- **WP16 COMPLETADO** (D38): causa raíz del escalón cable/pata que se veía en **todos** los símbolos. `projectSymbolPoint` (`ui/src/DiagramBuilder.tsx:1138`) asume `COMPONENT_GLYPH_HEIGHT = 102` (`:272`) y centra el glifo en 102 px (`SYMBOL_VIEWPORT_TOP = 9`, `:275`), pero `.freeplay-component__symbol-rotator` medía **96 px**: el SVG de 84 px arrancaba en **6 px** en vez de 9 y la pata quedaba **3 px por encima** del terminal proyectado. Arreglo: `height: 102px` en el rotator (`ui/src/App.css:2156`) con comentario que lo ata a `COMPONENT_GLYPH_HEIGHT`; verificado con un arnés que replica la estructura DOM real (160x136 → rotator → svg 84 px) y un cable en la y proyectada (96 px = escalón visible, 102 px = coincidencia exacta). El rótulo baja 6 px y sigue dentro de los 136 px del componente. Los ajustes por símbolo de WP15 (`BREAKER_1P`, `POWER_SOURCE`) se mantienen. Gates: ui tsc **28 == baseline** · ui vitest **194/194** · plc-engine **7/7** · `pnpm -r build` **OK**. Sign-off añadido: **cable alineado con la pata en todos los símbolos**. Docs: [vector-symbol-pipeline.md · Alineación del cable con la pata (causa raíz)](../../docs/vector-symbol-pipeline.md#alineación-del-cable-con-la-pata-causa-raíz).
