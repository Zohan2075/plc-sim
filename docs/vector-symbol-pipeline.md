---
type: documentation
entity: feature
version: 1.5
---

# Pipeline de símbolos vectoriales (SVG del usuario)

> Procedimiento para convertir un SVG entregado por el usuario en un símbolo de la app **sin
> redibujar el arte**. Catálogo de símbolos: [symbol-catalog.md](symbol-catalog.md). Módulo:
> [modules/ui.md](modules/ui.md). Implementación de referencia: `LIMIT_SWITCH_NO` /
> `LIMIT_SWITCH_NC` en `ui/src/DiagramBuilder.tsx`.

## Fuente de verdad

Los SVG del usuario viven en
`D:\Relevant files\Download (del cel viejo)\Electricidad\Controles eléctricos\reference\`
(`NO limit switch.svg`, `NC limit switch.svg`, `Emergency push button.svg`, ...). Se **copian al
código**, no se redibujan.

Excepciones aprobadas:

- `BREAKER_1P`: aprobado tal cual, no se redibuja (D28). **Única excepción (WP15/D37)**: se movió
  su pata/anillo de `y=34` a `y=32` para alinearla con la retícula del cable (la byte-identidad se
  flexibiliza **solo** por alineación vertical, pedido explícito del usuario).
- Solo `MOTOR` sigue trazado a mano. `POWER_SOURCE`, `SWITCH_1P`, `ESTOP`, `LAMP` y `OL_CONTACT` ya
  se migraron desde el arte del usuario (ver [Símbolos migrados](#símbolos-migrados)).

## Procedimiento

### 1. Copiar el path completo

Cada `<path d="...">` se copia **entero**. Verificar el número de subpaths (`M`) contra el SVG
original:

- `NO limit switch.svg`: path izquierdo **3** subpaths (contorno, hueco del anillo, hueco de la
  cuchilla), path derecho **2**.
- `NC limit switch.svg`: path del símbolo **4** subpaths (contorno/leads, barra, cuña y huecos de
  los anillos) + 4 paths de rótulo.
- `Emergency push button.svg` y `Emergency push button (opened).svg`: path principal **3** subpaths
  (salidas + barra + seta), **sin huecos**; los 2 anillos **no son subpaths**, son círculos aparte
  (blancos + trazo) que se replican con `<circle>`.
Un copiado truncado pierde los subpaths huecos y la cuchilla se ve **maciza**: ese fue el bug real
que se corrigió. Si faltan subpaths, el dibujo no coincide aunque el `fill-rule` sea correcto.

### 2. `fill-rule="evenodd"` obligatorio

Los huecos son subpaths. Con el `nonzero` por defecto se rellenan (discos y cuchilla macizos). El
grupo que contiene los paths lleva `fillRule="evenodd"`.

### 3. Mapear a la retícula (viewBox del símbolo 128x64)

Escala uniforme + traslación para que los **centros de los anillos** caigan en `(40,32)` y
`(88,32)`. Los terminales de cable del simulador siguen en `(6.4,32)` y `(121.6,32)` sobre las
salidas del dibujo.

Con `(x1,y1)` = centro del anillo izquierdo y `(x2,y2)` = centro del derecho, en coordenadas del
SVG fuente:

```text
s  = (88 - 40) / (x2 - x1)
tx = 40 - x1 * s
ty = 32 - y1 * s
```

Valores ya usados:

| Símbolo | viewBox fuente | Transform aplicado |
|---------|----------------|--------------------|
| `LIMIT_SWITCH_NO` | 1024x768 | `translate(-7.85 -21.85) scale(0.1403)` |
| `LIMIT_SWITCH_NC` | 220x53 | `translate(1.95 10.99) scale(0.568)` |
| `POWER_SOURCE` | 980x980 | `translate(-7.91 -39.68) scale(0.146087)` |

### 4. Normalizar el peso del trazo

El arte del usuario trae líneas de ~**1.2 unidades** y el resto de símbolos usa **3.2**. Se
engrosa con `stroke`, **no** reescalando la geometría. El stroke se escala con el `transform` del
grupo, así que el valor local es `stroke-width = 2 / s` (2 unidades del viewBox 128x64):

- `LIMIT_SWITCH_NO`: `2 / 0.1403` ≈ **14.256**.
- `LIMIT_SWITCH_NC`: `2 / 0.568` ≈ **3.521**.

Se dibuja en **dos capas**:

| Capa | Clase | Estilo | Contenido |
|------|-------|--------|-----------|
| Relleno | `.diagram-symbol__vector` (`ui/src/App.css:410`) | `fill: currentColor; stroke: none;` | El/los path(s) completos: relleno exacto, huecos intactos. |
| Contorno | `.diagram-symbol__vector--outline` (`ui/src/App.css:415`) | `fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round;` | SOLO los subpaths de contorno y de los huecos de los bornes. |

Los huecos decorativos (interior de la cuchilla/cuña) **no** se trazan, para que queden abiertos.
El helper `pickVectorSubpaths(pathData, indexes)` (regex `/M[^M]*/g`) está en
`ui/src/DiagramBuilder.tsx:1329`; las constantes de trazo en `:1344` y el `case` que renderiza ambas
capas en `:1512`. Cuando el SVG es de **trazo** (no de relleno) o el arte nativo ya supera 3.2
unidades, el tratamiento es distinto: ver [Símbolos migrados](#símbolos-migrados).

### 5. Rótulos

Los dígitos de bornes (**13/14**, **11/12**) son **paths del SVG**, no `<text>`, con su propia
transformación y **sin stroke**. Nunca sustituirlos por texto.

### 6. Sin primitivas SVG

No usar `<line>`, `<circle>` ni `<text>` para estos símbolos: todo son paths con
`fill: currentColor`, así siguen respondiendo a `currentColor` (colores de contacto cerrado /
accionado).

**Excepciones (WP14/WP15/WP17)**: cuando el arte del usuario ya es de **trazo** y se reproduce con
las clases de la app (`LAMP`, `ui/src/DiagramBuilder.tsx:1561`), cuando el SVG original superpone
**círculos blancos** a la traza para simular anillos huecos (`ESTOP` reposo y accionado, `:1696`), o
cuando los anillos son huecos transparentes y el cable pasa por detrás (`POWER_SOURCE`, `:1474`), sí
se usan `<line>`/`<circle>`. En todos los casos el color sigue saliendo de `currentColor` y el
relleno blanco (`.diagram-symbol__shape` / `.diagram-symbol__vector-ring` / disco blanco
`fill: rgba(255,255,255,0.98)`) es necesario para tapar el cable que queda detrás; no son huecos
reales de path.

### 7. Verificación obligatoria

1. Volcar el markup exacto que genera React a un HTML y capturarlo con Chrome headless
   (`--headless --screenshot`) a **160 px** (tamaño real del componente: `COMPONENT_WIDTH = 160`,
   `ui/src/DiagramBuilder.tsx:270`) y a **640 px** (zoom), comparando contra el raster de
   referencia.
2. Pasar las compuertas:
   - `npx tsc --noEmit` → **28 errores de baseline**, no deben aumentar.
   - `npx vitest run` en `ui` → **194**.
   - `npx vitest run` en `plc-engine` → **7**.
   - `pnpm -r build` → OK.

## Símbolos migrados

Los símbolos migrados en **WP13** (2026-10-30), **WP14** (2026-10-31), **WP15** (2026-10-31) y
**WP17** (2026-10-31). Todos validados con capturas Chrome-headless del markup React exacto a
**160 px** y con zoom, más las compuertas: ui tsc **28** (baseline), ui vitest **194/194**,
plc-engine **7/7**, `pnpm -r build` OK y smoke del dev-server **HTTP 200**.

| Tipo | Fuente | viewBox fuente | Transform | Peso |
|------|--------|----------------|-----------|------|
| `POWER_SOURCE` | `AC source.svg` | 980x980 | `translate(-7.91 -39.68) scale(0.146087)` (WP15) | nativo ~4.0 u (no se normaliza: el arte ya es más grueso que 3.2; se deja tal cual) |
| `SWITCH_1P` | `SPST-Switch.svg` (abierto) + variante cerrada | 347x100 | `translate(3.84 7.86) scale(0.365714)` | arte de trazo: `stroke-width = 3.2 / 0.365714 ≈ 8.75` local |
| `ESTOP` (reposo) | `Emergency push button.svg` | 450.168x159.806 | `translate(-0.193 6.482) scale(0.288588)` | 2 capas, `stroke-width = 2 / 0.288588 ≈ 6.93` local; anillos `3.2 / escala ≈ 11.09` |
| `ESTOP` (accionado) | `Emergency push button (opened).svg` | 450.168x159.806 | `translate(-0.353 6.103) scale(0.290296)` | 2 capas, `stroke-width = 2 / 0.290296 ≈ 6.89` local; anillos `3.2 / escala ≈ 11.02` |
| `LAMP` | `Lamp_symbol.svg` | 280x120 (trazo, sin `viewBox` declarado) | — (proporciones llevadas a primitivas sobre el viewBox 128x64) | `diagram-symbol__line` 3.2 · `diagram-symbol__shape` 3 |
| `OL_CONTACT` | sin SVG: reutiliza el glifo del contacto NC (`XIO`) | 128x72 | — | `diagram-symbol__line` 3.2 |

- **`POWER_SOURCE`**: el símbolo son **2 paths** (contorno con 4 subpaths + onda senoidal),
  `fill-rule="evenodd"`. Los anillos del arte caen en **(8.54,31.90)/(119.21,32.44)** y los
  terminales de cable en **(6.4,32)/(121.6,32)**. Como el arte dibuja los anillos como **huecos
  transparentes**, el cable (pintado por detrás del componente) terminaba dentro del hueco y se veía
  un muñón descentrado: se añadieron **dos `<circle>` blancos de `r=45` en unidades fuente**
  (`cx=112.624 cy=488.707` y `cx=870.167 cy=492.374`, `fill: rgba(255,255,255,0.98)`) **dibujados
  antes del vector** y bajo el mismo `transform`, de modo que el disco tapa el cable hasta el borde
  exterior del anillo y el cable queda unido limpio. `ty` se ajustó de **−39.49 a −39.68** para que
  la pata caiga exactamente en **y=32** del viewBox (ver [Alineación vertical](#alineación-vertical-del-cable)).
  El viewBox del símbolo pasó de **128x60 a 128x64** y las definiciones de terminal pasaron a
  `projectSymbolPoint(6.4, 32, 64)` / `(121.6, 32, 64)` (mismos píxeles: 8/152, 68).
  Constantes en `ui/src/DiagramBuilder.tsx:1381`; discos blancos en `:1481`; caso de render en
  `:1472`; terminales en `:1164`.
- **`SWITCH_1P`**: el arte es de **trazo** (no relleno), así que el peso se fija directo con
  `stroke-width` local en vez de la capa de contorno. Los anillos usan la clase nueva
  `.diagram-symbol__vector-ring` (`stroke: currentColor; fill: rgba(255,255,255,0.98)`,
  `ui/src/App.css:424`), mismo relleno que `.diagram-symbol__terminal`. **Orden de pintado**: anillo
  izquierdo → palanca/salidas → anillo derecho, igual que el SVG original; si se pintan los anillos
  primero, la palanca invade el hueco del anillo. El estado abierto lleva
  `transform="translate(-9 -155)"` en el path de la palanca (como el SVG original); el cerrado ya
  viene en coordenadas finales. Constantes en `ui/src/DiagramBuilder.tsx:1390`; caso en `:1532`.
- **`ESTOP`**: cada SVG tiene **7 `<path>`** (2 clipPaths de los anillos + 4 dígitos 11/12 + 1 traza
  principal) y **2 grupos de anillo** (círculo blanco + círculo con trazo). El arte del usuario son
  **dos trazas independientes**: `Emergency push button.svg` (reposo) y
  `Emergency push button (opened).svg` (accionado). Cada traza principal tiene **3 subpaths**
  (salidas + barra + seta) y **sin huecos**; los anillos se replican **siempre** con
  `.diagram-symbol__vector-ring` (`stroke: currentColor; fill: rgba(255,255,255,0.98)`,
  `ui/src/App.css:424`), `r=22.97` en unidades fuente y `stroke-width = 3.2 / escala`
  (≈ **11.09** reposo / **11.02** accionado), pintados **después** del relleno y del contorno, igual
  que en los SVG originales.
- **Mapeo propio por estado**: las dos trazas **no comparten la línea de bornes** (centro de la pata
  en `y=102.28` reposo vs `y=102.99` accionado tras la re-exportación), así que se calcula
  escala/traslación por estado para que el extremo de las salidas caiga en
  **(2.286,36)/(125.714,36)** del viewBox **128x72**, que proyecta exactamente a los terminales
  **(8,68)/(152,68)** (el viewBox 72 proyecta con `offsetX = 5.33` y escala 1.1667). Reposo:
  `translate(-0.193 6.482) scale(0.288588)`, `stroke-width = 2 / 0.288588 ≈ 6.93`. Accionado:
  `translate(-0.353 6.103) scale(0.290296)`, `stroke-width = 2 / 0.290296 ≈ 6.89`. Constantes en
  `ui/src/DiagramBuilder.tsx:1398`; caso de render en `:1673`.
- **`ESTOP` accionado** (`options.estopPressed`, que el llamador calcula como
  `component.type === "ESTOP" && component.isPressed === true`, `ui/src/DiagramBuilder.tsx:6434`):
  usa `Emergency push button (opened).svg` → **seta hundida y barra suelta**. Misma estructura que el
  reposo (3 subpaths + 2 anillos), pero la barra queda **~20 unidades fuente más abajo**. El render
  elige transform/path/stroke/anillos/rótulos según `isPressed`; los anillos se añaden tras el relleno
  y el contorno. Los **rótulos 11/12 son paths propios de cada SVG** (en la re-exportación se movieron
  con el arte), así que el render usa `ESTOP_VECTOR_LABEL_PATHS` o `ESTOP_VECTOR_OPEN_LABEL_PATHS`
  según el estado (`:1709`). Sin los `<circle>` el **anillo derecho queda macizo**. Constantes en
  `:1409` y `:1412`; caso de render en `:1673`.
- **`OL_CONTACT`**: el glifo es **exactamente el contacto NC** (`XIO`: dos platinas verticales
  x=56/72 de y=16 a 56 + cuchilla diagonal (46,20)-(82,52) cuando está cerrado) con el rótulo `OL` +
  número encima, en viewBox **128x72** con la línea de contacto en **y=36**. Las **patas** se
  extendieron a **x=2.3..54** y **74..125.7** (antes 6.4..121.6) por el mismo motivo que el ESTOP:
  el viewBox 72 proyecta con `offsetX = 5.33`, así el extremo dibujado cae en los píxeles del
  terminal redondeado (8/152) y no dentro del glifo. El número sale de la etiqueta del componente
  (`renderSymbolGraphic` ahora recibe `label`; primer grupo de dígitos, por defecto `1`): renombrar
  el componente a `OL2` muestra `OL2`. El color del símbolo es **naranja `#ea580c`**
  (`.diagram-symbol--ol`, `ui/src/App.css:365`), antes rojo; el estado abierto/cerrado viene de
  `switchClosed`. Caso en `ui/src/DiagramBuilder.tsx:1714`; extracción del número en `:1719`;
  `label` en la firma `:1428` y en el call site `:6428`.
- **`LAMP`**: `Lamp_symbol.svg` del usuario (**280x120**, arte de trazo, sin `viewBox` declarado)
  mapeado a las proporciones del viewBox **128x64**: patas **6.4→46.72** y **81.28→121.6** en
  `y=32`, círculo **r=17.28** centrado en **(64,32)** y X inscrita **(52,20)-(76,44)** /
  **(76,20)-(52,44)**. Se dibuja con las clases de la app (`diagram-symbol__line` /
  `diagram-symbol__shape`) para conservar el **brillo** (`--lamp-glow-fill` / `--lamp-glow-stroke`
  vía `.freeplay-component--lamp-on .diagram-symbol__shape`, `ui/src/App.css:2224`) y el relleno
  blanco de `.diagram-symbol__shape` (`App.css:381`) que oculta el cable por detrás. Caso en
  `ui/src/DiagramBuilder.tsx:1605`; terminales en `:1207`.

### Alineación vertical del cable (WP15, D37)

El cable se dibuja en la **retícula de terminales** del componente (**y=68 px**). Cualquier pata que
no caiga exactamente en esa línea produce un **escalón visible** al unir el cable con el glifo. En
WP15 se alinearon:

| Tipo | Antes | Ahora | Nota |
|------|-------|-------|------|
| `POWER_SOURCE` | pata no exactamente en y=32 | pata en **y=32** del viewBox → 68 px | `ty` ajustado de −39.49 a **−39.68** (`ui/src/DiagramBuilder.tsx:1382`) |
| `BREAKER_1P` | patas/anillos en **y=34** (70.5 px) | patas/anillos en **y=32**; arco de **26/8** (antes 28/10) | rompe la byte-identidad de D28 por pedido explícito del usuario sobre el alineado de cables (`:1493`; terminales en `:1172`) |
| `NOTC` / `NCTO` | pata en **y=30** (65.5 px) | **sin cambio** | su glifo es más alto; bajarlo recorta las colas del temporizado → **pendiente** (2.5 px de desfase) |

La alineación es **solo vertical**: no se redibuja el arte ni se cambian las coordenadas x de los
bornes.

### Alineación del cable con la pata (causa raíz)

**Síntoma**: en el lienzo el cable quedaba desplazado **1-3 px en vertical** respecto a la pata del
símbolo (escalón visible en la unión) y le pasaba a **todos** los símbolos, no a uno en concreto.

**Causa raíz**: la proyección de terminales (`projectSymbolPoint`,
`ui/src/DiagramBuilder.tsx:1138`) asume `COMPONENT_GLYPH_HEIGHT = 102`
(`ui/src/DiagramBuilder.tsx:272`) y centra el glifo en esos 102 px
(`SYMBOL_VIEWPORT_TOP = (COMPONENT_GLYPH_HEIGHT - SYMBOL_VIEWPORT_HEIGHT) / 2 = (102-84)/2 = 9`,
`:275`), pero el contenedor CSS del glifo (`.freeplay-component__symbol-rotator`,
`ui/src/App.css:2149`) medía **96 px**. El SVG del símbolo (84 px de alto) quedaba centrado en 96 px,
así que el contenido de 80 px útil arrancaba en **6 px** en vez de en **9 px**: la pata dibujada caía
**3 px por encima** del terminal proyectado. No era un problema de ningún símbolo en particular (ni
del arte ni de las coordenadas del viewBox), sino de la caja que contiene el glifo.

**Arreglo**: `.freeplay-component__symbol-rotator { height: 102px }` (`ui/src/App.css:2156`), con un
comentario que ata explícitamente el valor a `COMPONENT_GLYPH_HEIGHT`. Verificado con un arnés que
replica la estructura DOM real (contenedor 160x136 → rotator → svg de 84 px) y un cable en la **y
proyectada**: con 96 px se ve el escalón; con 102 px el cable y la pata coinciden exacto.

**Consecuencia**: el rótulo del componente baja **6 px**; sigue dentro de los **136 px** de alto del
componente (`COMPONENT_HEIGHT`, `ui/src/DiagramBuilder.tsx:271`), así que no recorta nada.

**Regla**: si algún día cambia `COMPONENT_GLYPH_HEIGHT`, hay que cambiar también la altura del
rotator. **Deben ser el mismo número**; si difieren, el desfase cable/pata reaparece en todos los
símbolos a la vez.

Los ajustes por símbolo de WP15 (`POWER_SOURCE` con `ty=-39.68` y `BREAKER_1P` con patas en y=32)
se mantienen: corregían desfases propios de su arte y siguen siendo válidos con el rotator en 102.

### Simetría de terminales (auditoría 2026-10-31, actualizada WP15)

Todos los símbolos de **dos terminales horizontales** proyectan y redondean a los mismos puntos de
retícula: **(8,68)** y **(152,68)** en coordenadas del componente (`projectSymbolPoint` +
`snapPointToTerminalLattice`, `ui/src/DiagramBuilder.tsx:1108` y `:1846`). Los tipos con viewBox
**72** (ESTOP, OL_CONTACT, PUSH_BUTTON_*) llegan ahí por el `offsetX = 5.33` del aspect ratio
160:84 (escala 1.1667), no por coincidencia de coordenadas del arte; por eso las patas del OL se
extienden hasta x≈2.3/125.7.

Tras WP15 queda **una sola desviación conocida de −2.5 px** entre la línea dibujada y el terminal
redondeado:

| Tipo | Pata dibujada | Terminal redondeado | Δ |
|------|---------------|---------------------|---|
| `NOTC` / `NCTO` | y=30 → **65.5 px** | **68 px** | −2.5 px |

`BREAKER_1P` ya no aparece: se alineó a y=32 en WP15 (D37), flexibilizando D28 solo para la
alineación vertical. Para `NOTC`/`NCTO` no se tocó a propósito: su glifo es más alto y bajar la pata
recorta las colas del temporizado; queda **pendiente** en
[plans/hoja-plano-logica-y-ui/todo.md](../plans/hoja-plano-logica-y-ui/todo.md).

### ESTOP enclavado (WP15, D37)

El paro de emergencia **ya no es momentáneo**. `applyMomentaryPress`
(`ui/src/DiagramBuilder.tsx:618`, exportada) distingue el ESTOP del resto de pulsadores: un click lo
**acciona y lo deja enclavado** (`isPressed=true` aunque se suelte el pointer), y un segundo click lo
**libera** (toggle). `applyMomentaryRelease` (`:633`) **ignora el ESTOP**, así que el pointer-up no lo
suelta. El resto de pulsadores momentáneos conserva el comportamiento press/release. Los call sites
son `:5420` y `:5425`.

Cubierto por **4 tests** en `ui/src/diagram/interaction.spec.ts` (`describe` en `:121`): press/release
de un pulsador normal, enclavamiento del ESTOP al soltar, liberación con el segundo press y no
alteración de otros componentes. Compuerta: **ui vitest 194/194**.

### Topología de cables y plano (WP20, D40–D45)

- **Geometría**: `SYMBOL_VIEWPORT_TOP` es **9** (centro puro, sin `top:-1px` en CSS). Todos los
  viewBox (64/60/72) proyectan la pata en `y=51`; los componentes en la retícula (`y % 18 = 3`)
  dejan los terminales en múltiplos de 18. No desplazar el glifo por CSS: el terminal proyectado y
  la pata se mueven juntos.
- **Reconciliación**: `ui/src/diagram/wireTopology.ts` (`reconcileWireTopology`) se ejecuta en
  load/save/commit/reconnect/drag/rotate. Los endpoints con `startPortId`/`endPortId` se fijan al
  terminal exacto; un extremo nulo a **≤4 px** de un terminal se conecta; a **≤2 px** de un
  vértice/segmento se fusiona e inserta el punto de unión; si no coincide con nada, el cable se
  **elimina** y se reporta. La pasada es idempotente.
- **Trazado**: `cleanWirePath` no cuantiza a la rejilla; solo quita duplicados y escalones de
  **≤3 px**, conservando los extremos. `insertPointIntoWire` inserta el punto exacto y
  `moveAttachedWireEndpoints` mueve el extremo aunque el delta sea <3 px.
- **Lógica**: `buildResolvedPortGraph` colapsa las redes de `buildElectricalNodeGraph` y conecta
  los puertos de cada red en **clique** (no en cadena). `collectRungPaths` es **no dirigido**:
  entra por cualquier borne y sale por el par; las bobinas terminan por cualquiera de sus bornes.
  Se arranca solo desde el borne de alimentación de la fuente y se conservan los caminos maximales
  por bobina (un contacto de enclavamiento en paralelo produce su propio rung).
- **Puentes**: `findWireCrossings` exige cruce **estrictamente interior** a ambos segmentos y
  descarta extremos, esquinas, T, nodos compartidos y segmentos nulos. **El cable más nuevo**
  (sufijo numérico del id) dibuja el puente, sin depender del orden del array.
- **Plano**: pan **off por defecto**, solo desde el fondo y con umbral de 4 px; los inputs
  Ancho/Alto/Rejilla usan borrador local y confirman en blur/Enter (Esc revierte). Ancho/Alto solo
  recortan lo que queda fuera; Rejilla re-cuantiza al confirmar; al arrastrar cerca del borde el
  plano crece. Se quitaron filtros/`will-change`/transición de escala, el zoom va en pasos de 0.05
  y el scroll se redondea a enteros para que la capa HTML y el SVG no se separen al bajar.
- **Regresión**: `ui/src/diagram/__fixtures__/reference-latch.circuit.json` +
  `reference-circuit.spec.ts` validan el circuito del usuario (28 cables, wire 64 en `(1098,342)`,
  idempotencia, rungs M/TR1/Y/D, M enclavado y lámpara). Gates WP20: ui tsc **25** (< baseline 28),
  ui vitest **212/212**, plc-engine **7/7**, `pnpm -r build` **OK**.

### Vano horizontal común de dos bornes (2026-11-01, D47)

- **Síntoma**: un XIC (viewBox 64) y un PUSH_BUTTON_NO (viewBox 72) alineados por el borne
  izquierdo no podían tener una vertical recta entre sus bornes derechos: el XIC proyectaba
  8..152 (144 px) y el pulsador, con letterbox horizontal, 12.333..147.667 (135.33 px). El cable
  derecho quedaba con un codo de **8.667 px**.
- **Causa**: el viewBox 72 se escalaba por altura (`84/72 = 1.1667`), centrando el arte 128x72 y
  dejando 5.333 px de margen horizontal; el viewBox 64 se escalaba por anchura (`1.25`) y ocupaba
  160 px. El vano de terminales dependía del **aspect ratio del arte**, no del modelo.
- **Arreglo**: todos los símbolos horizontales de dos bornes usan el mismo vano local
  **8..152** y `y=51`. Para que el glifo coincida, los símbolos con arte 6..122 se escalan
  uniformemente a 160 px de ancho: `height = viewBoxHeight * (144/116)` — pulsadores/ESTOP
  `72 * 1.241379 = 89.379 px`, breaker 1P `64 * 1.241379 = 79.448 px`. El OL (arte 2.3..125.7)
  ya caía en 8..152 con su altura de 84 px.
- **Migración**: al cargar, `clampSceneToPlane` reajusta cada componente a la retícula de su
  borne de entrada y mueve sus cables; `reconcileWireTopology` fija los extremos y, si ambos
  quedan en la misma X/Y, colapsa el trazado a una recta. Así un circuito guardado con el vano
  viejo se abre ya alineado.
- **Test**: `vertical-pb-circuit.json` + `vertical-wires.spec.ts` abren el circuito del usuario y
  exigen que los dos cables XIC↔PUSH_BUTTON_NO tengan 2 puntos y la misma X (<0.01).

### Error creciente con la Y (2026-11-01, D46)

- **Síntoma**: el cable quedaba por encima/debajo del borne y el error **crecía** con la
  coordenada Y del componente (no era un offset fijo).
- **Causa raíz**: `.freeplay-canvas` tenía `width:1720; height:940; border:1px` con
  `box-sizing:border-box` (`styles.css:43`), así que su **content-box** medía **1718×938**.
  El SVG de cables usaba `inset:0; width:100%; height:100%` (`App.css:1965`) con
  `viewBox="0 0 1720 940"`: el contenido SVG se escalaba por `938/940 = 0.99787`, mientras los
  componentes HTML se posicionaban en coordenadas de modelo sin escalar. Error lineal:
  `y·(1-938/940)` → ≈1.65 px a y=777 y ≈42 px a y=20000.
- **Arreglo**: se eliminó el `border` del canvas (el borde se dibuja con `box-shadow`, que no
  ocupa layout) y el SVG usa `width={planeSettings.width} height={planeSettings.height}` +
  `preserveAspectRatio="none"`, de modo que `viewBox` y caja CSS son **1:1**. `getCanvasPointFromClient`
  resta `clientLeft/clientTop` (borde sin escalar × zoom) para convertir screen→model una sola vez.
- **Segunda fuente de error**: `projectSymbolPoint` aplicaba `snapPointToTerminalLattice` al
  terminal local. En viewBox 72 (PUSH_BUTTON_*, ESTOP, OL) el arte proyecta x=12.333/147.667,
  pero el snap lo movía a 8/152: **4.3 px** de error horizontal constante respecto al glifo.
  Se eliminó el snap; los terminales son la proyección exacta del arte y los cables se resuelven
  desde el `portId` en cada render (`resolveWirePointsWithMap`).
- **Regla**: el snap de rejilla aplica a la **posición del componente** (su borne de entrada) y a
  los quiebres libres del cable; **nunca** a un offset local derivado del arte ni a un extremo con
  `portId`.
- **Debug**: `?debugTerminals=1` dibuja un punto rojo en cada terminal calculado, en una capa SVG
  por encima de los componentes (`freeplay-debug-overlay`).
- **Test**: `terminal-alignment.spec.ts` recorre todos los tipos y rotaciones con
  `y = 0, 500, 5000, 20000`; el extremo del cable y el terminal difieren <0.01.

### Temporizadores al desenergizar la bobina (2026-11-02, D48)

- **Síntoma**: al desenergizarse una bobina, sus contactos/temporizadores no volvían a reposo; en
  cascadas de temporizadores (`NOTC`/`NCTO`) los estados se quedaban en `5000 ms` y las bobinas
  `TM*` seguían accionadas.
- **Causa**: `resolvePhysicalInstructionTagValues` detectaba un ciclo (oscilador de relés) y
  forzaba **todas** las bobinas físicas a `true` para que el detector de cortocircuito viera los
  contactos cerrados. Eso también fijaba los temporizadores y las bobinas estables, impidiendo el
  reset.
- **Arreglo**: se guarda el historial de estados del punto fijo. Al repetirse un estado se
  identifican **solo las bobinas que cambian dentro del ciclo**:
  - las bobinas estables (p. ej. el enclavamiento `CR1`) conservan su valor;
  - las oscilantes se resuelven en **reposo** (`false`) salvo que el grafo con todas accionadas
    tenga un lazo sin carga; en ese caso se dejan en `true` para que el detector reporte el
    cortocircuito.
  - `previewTimedContactState` ya reseteaba con `inputValue=false`; al dejar de forzar `TM*` a
    `true`, `collectTimedContactRuntimeStates` elimina el estado y el contacto vuelve a su estado
    normal (NOTC abierto, NCTO cerrado).
- **Test**: `timer-reset.spec.ts` cubre (1) reset de un `NOTC` cuando su bobina se desenergiza,
  (2) regresión de cortocircuito bobina+contacto, y (3) la cascada real `timer-cascade.circuit.json`
  mantiene `CR1` enclavado pero reinicia los temporizadores tras un ciclo.
- Gates: ui vitest **577/577**; tsc **25**; engine **7/7**; build **OK**.

## Gotchas

- **PowerShell 5.1**: no escribir archivos fuente con `Get-Content`/`Set-Content` sin
  `-Encoding utf8` explícito. Añade BOM y duplica la codificación de los acentos.
- **LF**: los archivos usan LF; no introducir CRLF en las ediciones.
- **`vector-effect: non-scaling-stroke` NO sirve**: usa píxeles de pantalla, no unidades del
  viewBox. El trazo se normaliza con `stroke-width = 2 / s`, no con ese atributo.
- **Orden de pintado con varios subpaths**: cuando el arte original trae varios subpaths, el orden
  de pintado del SVG **importa** y hay que reproducirlo literalmente. En `SPST-Switch.svg` los
  anillos van **después** de la palanca (anillo izquierdo → palanca/salidas → anillo derecho); si se
  pintan los anillos primero, la palanca invade el hueco del anillo.
- **Anillos que no son huecos**: si el SVG original dibuja los anillos como **círculos blancos
  superpuestos** a la traza (caso `ESTOP`, tanto `Emergency push button.svg` como
  `Emergency push button (opened).svg`), no se inventa un subpath hueco: se replican los `<circle>`
  con `.diagram-symbol__vector-ring` (blanco + trazo `currentColor`) y
  `stroke-width = 3.2 / escala`, pintados **después** del relleno y del contorno. Sin ellos el
  anillo derecho queda macizo. En el ESTOP los círculos se dibujan **siempre** (ambos estados).
- **Anillos huecos con cable por detrás**: si el arte deja los anillos como **huecos transparentes**
  (caso `AC source.svg`), el cable que pasa por detrás asoma dentro del hueco como un muñón
  descentrado. Solución: **discos blancos** (`r=45` en unidades fuente,
  `fill: rgba(255,255,255,0.98)`) en el mismo `transform`, **pintados antes del vector**, bajo cada
  anillo; el disco tapa el cable hasta el borde exterior del anillo y la unión queda limpia.
  Aplica a cualquier símbolo cuyo borne sea un anillo en el extremo del dibujo.
- **Alineación vertical**: el cable se dibuja en la retícula de terminales (**y=68 px** del
  componente). Cualquier pata fuera de esa línea produce un escalón visible. Al añadir o retocar un
  símbolo, verificar que la pata caiga exactamente en `y=32` del viewBox (o en el punto proyectado
  equivalente) antes de dar el glifo por terminado.
- **Altura del contenedor del glifo**: si el cable se ve desplazado **en todos** los símbolos a la
  vez, no es el arte: comprobar que `.freeplay-component__symbol-rotator` mide
  `COMPONENT_GLYPH_HEIGHT` (**102 px**, `ui/src/App.css:2156`). Con 96 px el glifo arrancaba 3 px
  arriba del terminal proyectado — ver [Alineación del cable con la pata](#alineación-del-cable-con-la-pata-causa-raíz).
- **Arte nativo más grueso que 3.2 unidades**: si el trazo nativo ya supera 3.2 unidades del viewBox
  (caso `AC source.svg`, ~4.0 u), **NO** se añade stroke de normalización; se deja el arte tal cual y
  la excepción se documenta, en vez de encoger el glifo para forzar el peso estándar.
