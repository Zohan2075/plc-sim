---
type: planning
entity: parity-report
plan: "hoja-plano-logica-y-ui"
phase: 2
status: draft  # draft | active | completed | revised
created: "2026-10-29"
updated: "2026-10-29"
---

# Informe de paridad: Fase 2 (solver legacy vs. motor compilado)

> **Estado WP2-9 (superseded):** el solver legacy y su comparación se eliminaron (`legacyTagSolver.ts`, `TAG_SOURCE`,
> `runLegacy`, test D4 y contraste del compilador viejo). Lo que queda como evidencia: goldens F01-F12
> (`ui/src/parity/goldens/`, copia en `phase2-goldens`), expectativas explícitas (F06, F07, M01-M06), round-trip de
> `data/program-data/` y contadores de estado (tabla en `parity.spec.ts`). Las secciones de legacy de abajo son
> históricas: el legacy fue el árbitro hasta la aprobación de paridad.

> Generado a mano a partir de la salida de `ui/` (`npx vitest run`, 58 tests) y de `ui/src/parity/parity.spec.ts`.
> Referencia de implementación: [phase-2-impl.md](phase-2-impl.md). Goldens: `ui/src/parity/goldens/` y copia en `C:\Users\Johan\AppData\Local\Temp\opencode\phase2-goldens\`.

## Criterio

- **Motor == golden** en todas las fixtures de diagrama (F01-F12): regresión del programa compilado.
- **Legacy == motor** por scan y tag/observación, salvo divergencias **declaradas** en la fixture. Una divergencia declarada que no ocurre hace fallar el test (sin declaraciones vacuas).
- **Explícitas** (`expected`) donde el solver legacy no modela la semántica (`legacy: "not-modelled"`, con `legacyNote`).

## Tabla fixture × resultado

| Fixture | Descripción | Legacy vs motor | Motor vs golden | Notas |
|---|---|---|---|---|
| F01 | XIC → OTE | pass | pass | |
| F02 | serie XIC/XIO → OTE | pass | pass | |
| F03 | paralelo a bobina (R-OR) | pass | pass | Dos renglones. |
| F04 | seal-in con paro | pass | pass | |
| F05 | XIC → NOTC 300 ms → OTE | **diverge R-GATE, scan 2** (declarada) | pass | Legacy temporiza sin energía de rama (bug 3). |
| F06 | OTL + OTE mismo tag | not-modelled | pass | Expectativas explícitas del motor. |
| F07 | OTL / OTU | not-modelled | pass | Expectativas explícitas del motor. |
| F08 | cortocircuito | pass (`fault`) | pass | Sin renglón. |
| F09 | contacto de retorno (R-RET) | pass | pass | El compilador viejo no lo veía (test de contraste). |
| F10 | T-junction (R-JCT) | pass | pass | El grafo de puertos viejo no lo veía (test de contraste). |
| F11 | lámpara como carga | pass (`lit:`) | pass | Lámpara = OTE sobre tag de dispositivo. |
| F12 | output-deferral (R-FB) | **diverge R-FB, scans 1 y 3** (declarada) | pass | El motor usa el scan anterior (test de fase 1 L183). |

Totales: 12 fixtures de diagrama. 10 pasan sin divergencia. 2 con divergencia declarada (F05, F12). 2 `not-modelled` (F06, F07), verificadas por expectativas explícitas del motor.

## Divergencias declaradas

| Clase | Fixture | Scans | Motivo |
|---|---|---|---|
| R-GATE | F05 | 2 | El legacy sigue temporizando un NOTC cuya rama no tiene energía (bug 3). El motor reinicia el temporizador con la energía de renglón. |
| R-FB | F12 | 1, 3 | El legacy resuelve la bobina en el mismo scan; el motor lee el valor del scan anterior (fase 1, "OTE writes do not affect logic mid-scan"). Gana el motor. |

## Divergencias no declaradas y clases no observadas

- **D4 (250 ms de actuación del legacy):** no aparece en las fixtures porque la paridad corre el legacy con 0 ms. Test documental: con 250 ms, F05 cambia frente a la línea base de 0 ms (`parity: documented legacy defects`).
- **OD2-5 (feedback de un scan en la vista):** ninguna fixture produce diferencia en el estado energizado de bobinas/lámparas. No se declara; se registra como comportamiento aceptado de la vista (la bobina refleja el tag tras el scan).

## Motor (sin diagrama, semántica de fase 1)

| Fixture | Descripción | Resultado |
|---|---|---|
| M01 | E-stop abierto desenergiza en el mismo scan | pass |
| M02 | E-stop abierto borra latch OTL; no rearranca al soltar | pass |
| M03 | OLR: dispara, permanece disparado, rearma con flanco SYS:RESET | pass |
| M04 | TON cuenta ms, escribe Q, pasa potencia, reinicia sin energía | pass |
| M05 | TOF mantiene Q tras caída; nunca energizado = false | pass |
| M06 | Flanco de SYS:RESET borra el latch en ese scan | pass |

## Round-trip (`data/program-data/`, igualdad exacta scan a scan)

| Circuito | Resultado |
|---|---|
| `latch-cycle-demo.program.json` | pass (60 scans, todos los tags) |
| `output-deferral-demo.program.json` | pass (60 scans, todos los tags) |

`sample-programs/` y `data/` no se modificaron. El round-trip usa `programToScene` (helper de test: una fila por renglón, retorno a L2).

## Veredicto

- Paridad **en verde** para todas las aserciones. No se debilitó ninguna comparación. Las 2 divergencias declaradas son bugs del legacy documentados en la fixture.
- `TAG_SOURCE` queda en **`"engine"`** (permitido por la enmienda: paridad verde). El legacy sigue detrás del flag hasta la aprobación del Step 9.
