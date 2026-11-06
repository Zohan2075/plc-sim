---
type: planning
entity: implementation-plan
plan: "connection-hitbox-label-fixes"
phase: 1
status: ready
created: "2026-11-05"
updated: "2026-11-05"
---

# Phase 1: Connection editing lock

## Goal

While the simulator runs, block every wire-creation path with one `canEditConnections` flag, provide non-stacking terminal feedback, and cancel an in-flight draft when Run/F5 starts.

## Files

- `ui/src/diagram/interaction.ts`, `ui/src/diagram/interaction.spec.ts`
- `ui/src/DiagramBuilder.tsx`
- `ui/src/App.css`

## Design

### One flag

In `interaction.ts`:

```ts
export const WIRE_CREATION_BLOCKED_MESSAGE = "Stop the simulation to create wires";
export function canEditConnections(running: boolean): boolean { return !running; }
```

In `DiagramBuilder`, immediately after the run props/refs:

```ts
const canEditConnections = canEditConnectionsForRun(running);
```

Use this flag for every connection path. Do not add new `running` checks for wire creation.

### Blocked paths

- `appendDraftPoint`: return immediately when `!canEditConnections`.
- `commitWireFromPoints`: return immediately when `!canEditConnections`.
- `handleWirePointMouseDown`, `startWireReconnect`, `finishWireReconnect`, `disconnectWireEndpoint`, `reverseSelectedWire`, `simplifySelectedWire`, `simplifyWireById`, `deleteWireById`: replace their wire-edit `running` guard with `!canEditConnections`.
- `handleCanvasClick`: guard reconnect/draft commit branches with `canEditConnections`; normal selection/clear still works.
- Wire hit `onClick` and wire node `onClick`: guard only the reconnect/commit branches; selecting a wire still works while running.
- Port `onClick`: keep component selection; guard the wire-authoring branches with `canEditConnections`.
- Port `onPointerDown`: when `!canEditConnections`, `preventDefault`/`stopPropagation` and call `setRotationToast(WIRE_CREATION_BLOCKED_MESSAGE)`. This is the only feedback trigger, so pointer moves cannot repeat it.
- `wireTerminalsEnabled = canEditConnections && (isWireAuthoringEnabled || wireReconnectTarget !== null)`.
- `isWirePointerPreviewVisible` follows `wireTerminalsEnabled`.
- `toggleWireAuthoring`: no-op when `!canEditConnections`.

### Run-start cancellation

Add an effect keyed on `canEditConnections`:

```ts
useEffect(() => {
  if (!canEditConnections) {
    clearWireInteraction();
    wirePointDragState.current = null;
    setDraggingComponentId(null);
  }
}, [canEditConnections]);
```

This cancels draft points, cursor preview, reconnect target and endpoint drag without touching undo/redo or saved wires.

### Feedback styles/classes

- Port class: add `freeplay-port--connections-locked` when `!canEditConnections`.
- CSS:
  - `.freeplay-port--connections-locked { cursor: not-allowed; }`
  - `.freeplay-port--connections-locked:hover { transform: translate(-50%, -50%); box-shadow: none; }`
- `freeplay-port--active` remains only when `wireTerminalsEnabled`, so the ready ring hover never appears while running.

### Ribbon / command palette

- Disable Wire on/off, Finish wire and Cancel-wire commands when `!canEditConnections`.
- Keep color/thickness appearance controls working.
- Pass `locked={!canEditConnections || layoutEditingLocked}` to `ContextMenuLayer` (it already closes on lock); no new menu wiring.

## Tests

- `interaction.spec.ts`: `canEditConnections(false) === false`, `canEditConnections(true) === true`, exact toast message.
- Browser phase 3 covers 0 wires / 0 undo / 0 dirty per attempt, run-start cancellation, Stop restoration, toast count.

## Acceptance

- Wire creation is impossible while running from terminals, canvas, wire hits, nodes, reconnect, finish or command palette.
- Starting Run/F5 with a draft leaves no half wire and no undo entry.
- Stop restores wire creation immediately.
- Terminal cursor/feedback match the spec; toast does not stack.
- No glyph/anchor/router/wire-point change.
