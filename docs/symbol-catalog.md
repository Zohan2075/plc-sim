---
type: documentation
entity: feature
version: 1.0
---

# Symbol catalog (ANSI/NEMA)

> Per-type reference across glyphs, palette, compiler bindings, panel controls and engine
> instructions. Sources: `ui/src/diagram/symbols.tsx`, `ui/src/diagram/symbolGeometry.ts`,
> `ui/src/diagram/palette.ts`, `ui/src/compiler/deviceMapping.ts`, `ui/src/panel/panelControls.ts`,
> `ui/src/diagram/inspectionStates.ts`. Index: [docs/README.md](README.md); rules:
> [rules-contract.md](rules-contract.md); module: [modules/ui.md](modules/ui.md).

## Conventions

- **D7**: the ANSI/NEMA convention was applied **on top of the existing symbol set** (reinforcement,
  not a rewrite) and **all existing `BuilderComponentType` IDs were kept** — old snapshots keep loading.
- **D14/D17**: type IDs kept; the approved alignment fixes only — phase 3: `PUSH_BUTTON_NC` `cy`,
  `SWITCH_1P` `cx`, `BREAKER_1P` circle + labels (the other 44 baseline keys stayed byte-identical,
  D16); phase 4: `BREAKER_2P` and `GUARDAMOTOR` regenerated to the terminal lattice (D17). `LAMP`
  keeps its ID with the Spanish label **"Luz piloto"**; `MOTOR_6T/9T/12T` are separate types whose
  extra terminals are cosmetic; `TON`/`TOF` are blocks that keep the NOTC/NCTO glyphs.
- Glyph column: `symbols.tsx` = `renderSymbolGraphic` case line (SVG); text fallback from
  `getInstructionSymbol` (`symbols.tsx:5`). Terminal geometry: `symbolGeometry.ts` case line.
- **Símbolos vectoriales**: `POWER_SOURCE`, `SWITCH_1P`, `LIMIT_SWITCH_NO`, `LIMIT_SWITCH_NC`,
  `ESTOP` y `OL_CONTACT` ya usan arte vectorial del usuario (paths completos; peso por capa de
  contorno o por `stroke-width` local). `OL_CONTACT` comparte glifo con `XIO` más el rótulo
  OL+número. Procedimiento: [vector-symbol-pipeline.md](vector-symbol-pipeline.md).
- Device tag: `getDeviceTag` = `__builder_device__:<componentId>` unless a fixed tag is set
  (`deviceMapping.ts:44`).

## Catalog

| ID | Etiqueta (ES, `palette.ts`) | Glifo ANSI/NEMA (`symbols.tsx`) | Geometría (`symbolGeometry.ts`) | Grupo de paleta | Binding del compilador (`deviceMapping.ts` / regla de estado) | Control en panel (`panelControls.ts`) | Instrucción en el motor |
|----|------------------------------|----------------------------------|----------------------------------|-----------------|---------------------------------------------------------------|----------------------------------------|--------------------------|
| `POWER_SOURCE` | Fuente AC | L112 · fallback `L1 ~ L2` | L27 | Potencia | Sin instrucción: origen de los renglones (`compileDiagram.ts:113`) | — (fuente) | — |
| `DC_SOURCE` | Fuente DC | L123 · `- DC +` | L35 | Potencia | Sin instrucción: origen de renglón | — (fuente) | — |
| `MOTOR` | Motor | L190 · `--(Motor)--` | L77 | Potencia | Carga → `OTE` sobre `__builder_device__:<id>` (`compileDiagram.ts:289`) | `motor` (indicador lee el tag) | `OTE` |
| `MOTOR_6T` | Motor 6T | L482 · `--(Motor)--` | L241 | Potencia | Carga → `OTE` sobre el tag de dispositivo | `motor` | `OTE` |
| `MOTOR_9T` | Motor 9T | L483 · `--(Motor)--` | L255 | Potencia | Carga → `OTE` sobre el tag de dispositivo | `motor` | `OTE` |
| `MOTOR_12T` | Motor 12T | L484 · `--(Motor)--` | L272 | Potencia | Carga → `OTE` sobre el tag de dispositivo | `motor` | `OTE` |
| `PUSH_BUTTON_NO` | Pulsador NA (marcha) | L206 · `--[PB NO]--` | L85 | Control | Entrada → `XIC` sobre el tag de dispositivo; estado `isPressed === true` (`deviceMapping.ts:56`) | `momentary` | `XIC` |
| `PUSH_BUTTON_NC` | Pulsador NC (paro) | L226 · `--[/PB NC]--` | L93 | Control | Entrada → `XIC`; estado `isPressed !== true` (sin pulsar = cerrado) | `momentary` | `XIC` |
| `RESET_BUTTON` | Reset | L401 · `--[RESET]--` | L189 | Control | Entrada → `XIC` con **tag fijo `SYS:RESET`** (D12, `deviceMapping.ts:27`); estado `isPressed === true` | `momentary` | `XIC` (lee `SYS:RESET`) |
| `ESTOP` | Paro de emergencia | L353 · `--] [--` + hongo rojo | L101 | Control | `ESTOP` sobre el tag de dispositivo; estado `isPressed !== true` = sano (**UNSET = sano**, D13) | `emergency` | `ESTOP` (fuerza el scan, D10) |
| `SWITCH_1P` | Selector 2 posiciones | L165 · `--o/ o--` | L61 | Control | Entrada → `XIC`; estado `isClosed === true` | `maintained` | `XIC` |
| `LIMIT_SWITCH_NO` | Limit switch NA | L416 · `--[LS NO]--` | L197 | Control | Entrada → `XIC`; estado `isPressed === true` | `sensor` | `XIC` |
| `LIMIT_SWITCH_NC` | Limit switch NC | L417 · `--[/LS NC]--` | L205 | Control | Entrada → `XIC`; estado `isPressed !== true` | `sensor` | `XIC` |
| `LAMP` | Luz piloto | L181 · `--(Lamp)--` | L69 | Control | Carga → `OTE` sobre `__builder_device__:<id>` | `lamp` (lee el tag del motor) | `OTE` |
| `BREAKER_1P` | Breaker 1P | L133 · `--/ CB1 --` | L43 | Protección | Entrada → `XIC`; estado `isClosed ?? true` (sin dato = cerrado) | `maintained` | `XIC` |
| `BREAKER_2P` | Breaker 2P | L145 · `--// CB2 --` | L51 | Protección | Entrada → `XIC`; estado `isClosed ?? true` | `maintained` | `XIC` |
| `FUSE` | Fusible | L436 · `--[FUSE]--` | L213 | Protección | Entrada → `XIC`; estado `isClosed ?? true`; inspector `intacto|fundido` (`inspectionStates.ts:25`) | `trip` | `XIC` |
| `GUARDAMOTOR` | Guardamotor | L466 · `--/I> GM--` | L229 | Protección | Entrada → `XIC`; estado `isClosed ?? true`; inspector `normal|disparado` (viaje ligado al motor, `isEngineTripStateType` L50) | `trip` | `XIC` |
| `DISCONNECT_SWITCH` | Interruptor de seguridad | L452 · `--/ DS --` | L221 | Protección | Entrada → `XIC`; estado `isClosed ?? true`; inspector `cerrado|abierto` | `maintained` | `XIC` |
| `OLR` | Relevador de sobrecarga | L368 · bimetálico 95-96 | L109 | Protección | `OLR` sobre el tag de dispositivo; estado `isClosed ?? true` (UNSET = sano); viaje enclavado en el motor | `trip` | `OLR` (viaje + `TraceStep.tripped`, rearme por flanco `SYS:RESET`) |
| `TON` | Temporizador TON | L385 · bloque con preset | L117 | Temporización | Instrucción `TON` con `delayMs` del componente (`getTimedContactDelayMs`) sobre `component.tag` | — (no es dispositivo) | `TON` (acumula con energía; `powerAfter = Q`) |
| `TOF` | Temporizador TOF | L385 · bloque con preset | L125 | Temporización | Instrucción `TOF` con `delayMs` sobre `component.tag` | — | `TOF` (sostiene `Q` tras perder energía) |
| `NOTC` | Contacto NA temporizado | L288 · `--]T[--` | L149 | Temporización | Contacto `NOTC` con `delayMs` sobre `component.tag` | — | `NOTC` |
| `NCTO` | Contacto NC temporizado | L306 · `--]/T[--` | L157 | Temporización | Contacto `NCTO` con `delayMs` sobre `component.tag` | — | `NCTO` |
| `XIC` | Contacto NA (XIC) | L246 · `--] [--` | L133 | Contactos y bobinas | Contacto `XIC` sobre `component.tag` (`compileDiagram.ts:272`) | — | `XIC` |
| `XIO` | Contacto NC (XIO) | L267 · `--]/[--` | L141 | Contactos y bobinas | Contacto `XIO` sobre `component.tag` | — | `XIO` |
| `OTE` | Bobina (OTE) | L324 · `--( )--` | L165 | Contactos y bobinas | Bobina `OTE` sobre `component.tag` (`toCoilElement`, L288) | — | `OTE` |
| `OTL` | Bobina de enclavamiento (OTL) | L333 · `--(L)--` | L173 | Contactos y bobinas | Bobina `OTL` sobre `component.tag` | — | `OTL` (enclava; borra el E-stop) |
| `OTU` | Bobina de desenclavamiento (OTU) | L343 · `--(U)--` | L181 | Contactos y bobinas | Bobina `OTU` sobre `component.tag` | — | `OTU` (prioridad sobre OTL/OTE) |

## Process switches (current builder)

Added 2026-11-06 from the user's Temperature/Flow/Pressure SVGs. These are **single
maintained switch components**; there are no separate normally-closed variants.
Open and closed are two art states of the same component, selected by `isClosed`.

| ID | Label | Default label | Palette group | Terminals | Art | Behaviour |
|----|-------|---------------|---------------|-----------|-----|-----------|
| `TEMPERATURE_SWITCH` | Temperature switch | `TS-1` | Sensors & limit switches | `in`/`out`, `(32,48.5)` / `(128,48.5)`, pitch `96` | `sensorSwitchArt.generated.ts` (`open`/`closed`) from `reference/Temperature switch.svg` | maintained toggle; conducts only when closed; default open |
| `FLOW_SWITCH` | Flow switch | `FS-1` | Sensors & limit switches | `in`/`out`, `(32,48.5)` / `(128,48.5)`, pitch `96` | `sensorSwitchArt.generated.ts` (`open`/`closed`) from `reference/Flow switch.svg` | maintained toggle; conducts only when closed; default open |
| `PRESSURE_SWITCH` | Pressure switch | `PS-1` | Sensors & limit switches | `in`/`out`, `(32,48.5)` / `(128,48.5)`, pitch `96` | `sensorSwitchArt.generated.ts` (`open`/`closed`) from `reference/Pressure switch.svg` | maintained toggle; conducts only when closed; default open |

- Palette order (current builder, 27 entries): positions `16` Temperature switch,
  `17` Flow switch, `18` Pressure switch, immediately after the level switches.
- Generator: `scripts/generate-sensor-switch-art.mjs` (reads the SVGs; 5 elements per
  state, original geometry preserved).
- Operability: `"toggle"` (`ui/src/diagram/operability.ts`); saved/loaded through the
  generic `isClosed` component field.
- Compiler/engine: these are UI pass-through devices, not `InstructionType`s; they do
  not add a new `PlcEngine` instruction.

## Device state rules (single source: `getDeviceContactState`, `deviceMapping.ts:53`)

| Rule | Types |
|------|-------|
| `isPressed === true` (NO) | `PUSH_BUTTON_NO`, `RESET_BUTTON`, `LIMIT_SWITCH_NO` |
| `isPressed !== true` (NC, unset = closed) | `PUSH_BUTTON_NC`, `ESTOP`, `LIMIT_SWITCH_NC` |
| `isClosed === true` | `SWITCH_1P` |
| `isClosed ?? true` (unset = healthy/closed, D13) | `BREAKER_1P`, `BREAKER_2P`, `FUSE`, `DISCONNECT_SWITCH`, `GUARDAMOTOR`, `OLR` |
| No es contacto (carga/origen) | `LAMP`, `MOTOR*`, `POWER_SOURCE`, `DC_SOURCE`, `XIC`…`OTU` |

Every input device also contributes `deviceInputs[deviceTag] = contactState` to
`EngineSession.setDeviceInputs` (`compileDiagram.ts:237`), so the engine input image always matches
the drawn contact.

## Palette groups (`palette.ts:3`)

`Control` (8) · `Protección` (6) · `Temporización` (4) · `Contactos y bobinas` (5) · `Potencia` (6) —
29 entries = the 29 `BuilderComponentType`s, all with `SYMBOL_GEOMETRY`.

## Panel control kinds (`panel/model.ts:4`)

| Kind | Meaning | Types |
|------|---------|-------|
| `momentary` | press/release via `setMomentaryPressed` | `PUSH_BUTTON_NO`, `PUSH_BUTTON_NC`, `RESET_BUTTON` |
| `maintained` | open/close via `actuateDevice` | `SWITCH_1P`, `BREAKER_1P`, `BREAKER_2P`, `DISCONNECT_SWITCH` |
| `emergency` | hongo rojo, corta el scan | `ESTOP` |
| `sensor` | momentáneo de posición | `LIMIT_SWITCH_NO`, `LIMIT_SWITCH_NC` |
| `trip` | disparo/rearme (estados de inspector) | `FUSE`, `OLR`, `GUARDAMOTOR` |
| `lamp` / `motor` | indicador que **lee** el tag del motor | `LAMP`, `MOTOR`, `MOTOR_6T/9T/12T` |
