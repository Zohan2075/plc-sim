---
type: planning
entity: audit
plan: "menus-run-view"
created: "2026-11-05"
---

# Menu audit (running app, 1600×1000 and 820×760)

| # | Area | Finding | Fix |
|---|---|---|---|
| A1 | Ribbon tabs | 5 tabs are under 40 px high; no ArrowLeft/Right/Home/End navigation; Escape leaves focus on the tab. | Min-height 40 px (44 coarse); roving tabIndex + arrow/Home/End; Escape focuses canvas. |
| A2 | Ribbon buttons | All visible Home buttons have icon + label + title. 7 have no shortcut hint because no shortcut exists. | Keep tooltips; add shortcut metadata only where a shortcut exists; command search exposes the rest. |
| A3 | Ribbon touch | Ribbon tabs below 40 px on fine pointers; no coarse-specific ribbon sizing. | Coarse min 44×44 for tabs/buttons; 44 px context rows. |
| A4 | Ribbon narrow | 4 compact groups, no ribbon/tab overflow, context menu stays inside 820 px viewport. | Preserve compact groups; verify no clipping after command search is added. |
| A5 | Command search | No Ctrl+K palette. | Add `CommandPalette` with filter, icons, shortcuts, Arrow/Enter/Escape and focus return. |
| A6 | Run controls | No persistent Run cluster in the title bar; Run/Stop is buried in the Simulation tab. | Title-bar Run/Stop + Reset + status pill; same handlers as Simulation group; F5/Shift+F5. |
| C1 | Context menu icons | All 5 component rows and all wire rows render an empty icon slot. | Add a per-item icon and render it in the icon slot; color options keep swatches. |
| C2 | Context multi-select | Duplicate/Delete only use the primary component id even when several are selected. | Add `duplicateComponents(ids)` / `deleteComponents(ids)`; label actions with the count. |
| C3 | Context menu focus | First item is focused; Escape closes and returns focus to canvas. | Keep; add Tab/Shift+Tab cycle and test. |
| C4 | Context touch | Fine-pointer rows are 32 px; coarse rows are 42 px. | Coarse rows 44 px; thickness buttons 44 px. |
| C5 | Context labels | No clipped labels; degree/check glyphs render correctly. | No label change needed; keep ellipsis. |
| C6 | Context animation | Open transition is 80 ms, but close unmounts immediately. | Add 80 ms closing state and focus restoration after it. |
| C7 | Context re-render | Opening on an already-selected target returns early from selection, so the diagram does not re-render; menu state is portal-local. | Preserve; verify with a render counter. |
| V1 | Wheel | Plain wheel changes zoom (100%→90%) and scrollTop (12→0); it does not pan. | Default wheel pans vertically; Shift pans horizontally; Ctrl/Cmd/pinch zooms. |
| V2 | Scrollbars | Stage scrollbars are hidden (`scrollbar-width:none`). | Show styled horizontal/vertical scrollbars; extents = diagram + margin. |
| V3 | Zoom range | 50%–200%. | 10%–800%. |
| V4 | View shortcuts | No Ctrl+0 fit, Ctrl+1 100%, Ctrl+plus/minus, fit/zoom menu. | Add shortcuts and a bottom zoom menu (Fit, 100%, 50%, 200%, Zoom to selection). |
| V5 | Pan gestures | No Space+drag or middle-drag temporary hand tool. | Add with previous-tool/cursor restoration. |
| V6 | Wheel setting | No “Mouse wheel zooms” setting. | Add default-OFF setting persisted in user localStorage (not diagram file). |
| V7 | Grid LOD | Minor grid lines remain at fixed opacity at every zoom. | Fade/hide minor lines below 8 px/4 px spacing; keep major lines and crisp strokes. |
| V8 | Re-render | Zoom is React state and re-renders the diagram tree. | Make zoom/pan imperative; only the zoom indicator subscribes to a view store. |

## Measured audit values

- Ribbon buttons: 12 visible Home buttons, 0 missing icon/label/title, 0 clipped labels, 0 under 40 px (buttons); 5 tabs under 40 px.
- Ribbon ArrowRight: focus stayed on Home; Escape focus stayed on the tab.
- Component context menu: 5 rows, all icon slots empty, row height 32 px, transition 80 ms, inside viewport.
- Multi-select menu: labels `Rotate/Copy/Duplicate/Rename/Delete` with no counts; duplicate/delete only primary.
- Wire menu: `Delete/Simplify` icon slots empty; Color/Thickness fields present.
- Narrow 820 px: 4 compact groups; no overflow; context menu inside viewport.
- View: scrollbarWidth `none`; wheel deltaY 100 changed zoom 100→90 and scrollTop 12→0.
