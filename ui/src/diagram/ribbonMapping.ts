export type RibbonAuditGroup = "H" | "P" | "T" | "S" | "R" | "ST" | "C" | "W" | "M";

export type RibbonDestinationKind = "tab" | "statusbar" | "context-menu" | "canvas" | "keyboard";

export interface RibbonAuditEntry {
  destination: string;
  group: RibbonAuditGroup;
  id: string;
  kind: RibbonDestinationKind;
  label: string;
}

function entry(
  id: string,
  group: RibbonAuditGroup,
  label: string,
  destination: string,
  kind: RibbonDestinationKind
): RibbonAuditEntry {
  return { destination, group, id, kind, label };
}

const headerEntries: RibbonAuditEntry[] = [
  entry("H1", "H", "Symbols count", "Status bar", "statusbar"),
  entry("H2", "H", "Wires count", "Status bar", "statusbar"),
  entry("H3", "H", "Runnable rungs count", "Status bar", "statusbar")
];

const paletteEntries: RibbonAuditEntry[] = [
  entry("P1", "P", "AC source", "Insert tab / Electrical and component list", "tab"),
  entry("P2", "P", "DC source", "Insert tab / Electrical and component list", "tab"),
  entry("P3", "P", "1P breaker", "Insert tab / Electrical and component list", "tab"),
  entry("P4", "P", "2P breaker", "Insert tab / Electrical and component list", "tab"),
  entry("P5", "P", "Single switch", "Insert tab / Electrical and component list", "tab"),
  entry("P6", "P", "NO push button", "Insert tab / Electrical and component list", "tab"),
  entry("P7", "P", "NC push button", "Insert tab / Electrical and component list", "tab"),
  entry("P8", "P", "E-stop", "Insert tab / Electrical and component list", "tab"),
  entry("P9", "P", "3-pos selector", "Insert tab / Electrical and component list", "tab"),
  entry("P10", "P", "Limit switch NO", "Insert tab / Electrical and component list", "tab"),
  entry("P11", "P", "Limit switch NC", "Insert tab / Electrical and component list", "tab"),
  entry("P12", "P", "OL contact", "Insert tab / Electrical and component list", "tab"),
  entry("P13", "P", "Lamp", "Insert tab / Electrical and component list", "tab"),
  entry("P14", "P", "Motor", "Insert tab / Electrical and component list", "tab"),
  entry("P15", "P", "XIC", "Insert tab / Logic and component list", "tab"),
  entry("P16", "P", "XIO", "Insert tab / Logic and component list", "tab"),
  entry("P17", "P", "NOTC", "Insert tab / Logic and component list", "tab"),
  entry("P18", "P", "NCTO", "Insert tab / Logic and component list", "tab"),
  entry("P19", "P", "OTE", "Insert tab / Logic and component list", "tab")
];

const toolsEntries: RibbonAuditEntry[] = [
  entry("T1", "T", "Move ready pill", "Status bar (dynamic Move ready/locked)", "statusbar"),
  entry("T2", "T", "Pan mode", "View tab / Navigate", "tab"),
  entry("T3", "T", "Wire mode", "Home tab / Wiring", "tab"),
  entry("T4", "T", "Wire color", "Home tab / Wiring", "tab"),
  entry("T5", "T", "Wire thickness", "Home tab / Wiring", "tab"),
  entry("T6", "T", "Canvas width", "View tab / Canvas", "tab"),
  entry("T7", "T", "Canvas height", "View tab / Canvas", "tab"),
  entry("T8", "T", "Grid spacing", "View tab / Canvas", "tab"),
  entry("T9", "T", "Finish wire", "Home tab / Wiring", "tab"),
  entry("T10", "T", "Cancel wire", "Home tab / Wiring", "tab"),
  entry("T11", "T", "Delete", "Home tab / Edit", "tab"),
  entry("T12", "T", "Reset canvas", "Home tab / Edit", "tab"),
  entry("T13", "T", "Load circuit", "File tab / Circuit", "tab"),
  entry("T14", "T", "Save circuit", "File tab / Circuit", "tab"),
  entry("T15", "T", "Hidden circuit file input", "File tab / Circuit (hidden input)", "tab")
];

const sheetEntries: RibbonAuditEntry[] = [
  entry("S1", "S", "Project", "File tab / Document", "tab"),
  entry("S2", "S", "Date", "File tab / Document", "tab"),
  entry("S3", "S", "Scale", "File tab / Document", "tab"),
  entry("S4", "S", "Page", "File tab / Document", "tab")
];

const runEntries: RibbonAuditEntry[] = [
  entry("R1", "R", "Run/Stop", "Simulation tab / Run", "tab"),
  entry("R2", "R", "Reset fault", "Simulation tab / Run", "tab"),
  entry("R3", "R", "Zoom out", "View tab / Zoom", "tab"),
  entry("R4", "R", "Zoom readout", "View tab / Zoom and status bar", "tab"),
  entry("R5", "R", "Zoom in", "View tab / Zoom", "tab"),
  entry("R6", "R", "100%", "View tab / Zoom", "tab")
];

const stateEntries: RibbonAuditEntry[] = [
  entry("ST1", "ST", "Fault latched", "Status bar and Simulation tab / Status", "statusbar"),
  entry("ST2", "ST", "Running/Ready", "Status bar and Simulation tab / Status", "statusbar"),
  entry("ST3", "ST", "Wire on/off", "Status bar and Simulation tab / Status", "statusbar"),
  entry("ST4", "ST", "Pan on/off", "Status bar and Simulation tab / Status", "statusbar"),
  entry("ST5", "ST", "Move locked/ready", "Status bar and Simulation tab / Status", "statusbar"),
  entry("ST6", "ST", "Tick", "Status bar and Simulation tab / Status", "statusbar"),
  entry("ST7", "ST", "Scan ms", "Status bar and Simulation tab / Status", "statusbar"),
  entry("ST8", "ST", "Connected wires", "Status bar and Simulation tab / Status", "statusbar"),
  entry("ST9", "ST", "Loose wires", "Status bar and Simulation tab / Status", "statusbar"),
  entry("ST10", "ST", "Live wires", "Status bar and Simulation tab / Status", "statusbar")
];

const componentEntries: RibbonAuditEntry[] = [
  entry("C1", "C", "Symbol", "Component tab / Properties", "tab"),
  entry("C2", "C", "Logic or plane name", "Component tab / Properties", "tab"),
  entry("C3", "C", "Terminals count", "Component tab / Properties", "tab"),
  entry("C4", "C", "Rotation", "Component tab / Properties", "tab"),
  entry("C5", "C", "Delay", "Component tab / Properties", "tab"),
  entry("C6", "C", "Current", "Component tab / Properties", "tab"),
  entry("C7", "C", "Voltage", "Component tab / Properties", "tab"),
  entry("C8", "C", "State", "Component tab / Properties", "tab"),
  entry("C9", "C", "Live voltage", "Component tab / Properties", "tab"),
  entry("C10", "C", "Rotate -90", "Component tab / Edit", "tab"),
  entry("C11", "C", "Rotate +90", "Component tab / Edit", "tab"),
  entry("C12", "C", "Label input", "Component tab / Edit", "tab"),
  entry("C13", "C", "On-delay", "Component tab / Parameters", "tab"),
  entry("C14", "C", "Terminal labels", "Component tab / Terminals", "tab"),
  entry("C15", "C", "Source voltage", "Component tab / Parameters", "tab"),
  entry("C16", "C", "Lamp glow", "Component tab / Parameters", "tab"),
  entry("C17", "C", "Open/Close switch", "Component tab / Parameters", "tab"),
  entry("C18", "C", "Selector position", "Component tab / Parameters", "tab")
];

const wireEntries: RibbonAuditEntry[] = [
  entry("W1", "W", "Wire status pill", "Wire tab / Status", "tab"),
  entry("W2", "W", "Solver chip", "Wire tab / Status", "tab"),
  entry("W3", "W", "Reconnect chip", "Wire tab / Status", "tab"),
  entry("W4", "W", "Points", "Wire tab / Status", "tab"),
  entry("W5", "W", "Color swatch", "Wire tab / Status", "tab"),
  entry("W6", "W", "Thickness readout", "Wire tab / Status", "tab"),
  entry("W7", "W", "Segments", "Wire tab / Status", "tab"),
  entry("W8", "W", "Bends", "Wire tab / Status", "tab"),
  entry("W9", "W", "Length", "Wire tab / Status", "tab"),
  entry("W10", "W", "Start endpoint card", "Wire tab / Endpoints", "tab"),
  entry("W11", "W", "End endpoint card", "Wire tab / Endpoints", "tab"),
  entry("W12", "W", "Start Reconnect/Pick point", "Wire tab / Endpoints", "tab"),
  entry("W13", "W", "Start Disconnect", "Wire tab / Endpoints", "tab"),
  entry("W14", "W", "End Reconnect/Pick point", "Wire tab / Endpoints", "tab"),
  entry("W15", "W", "End Disconnect", "Wire tab / Endpoints", "tab"),
  entry("W16", "W", "Add bend", "Wire tab / Geometry", "tab"),
  entry("W17", "W", "Reverse route", "Wire tab / Geometry", "tab"),
  entry("W18", "W", "Simplify path", "Wire tab / Geometry", "tab"),
  entry("W19", "W", "Delete", "Wire tab / Edit", "tab"),
  entry("W20", "W", "Color input", "Wire tab / Appearance", "tab"),
  entry("W21", "W", "Thickness range", "Wire tab / Appearance", "tab")
];

const menuEntries: RibbonAuditEntry[] = [
  entry("M1", "M", "Rotate submenu", "Context menu (unchanged)", "context-menu"),
  entry("M2", "M", "Position submenu", "Context menu (unchanged)", "context-menu"),
  entry("M3", "M", "Color submenu", "Context menu (unchanged)", "context-menu"),
  entry("M4", "M", "Copy", "Context menu (unchanged)", "context-menu"),
  entry("M5", "M", "Duplicate", "Context menu (unchanged)", "context-menu"),
  entry("M6", "M", "Rename", "Context menu (unchanged)", "context-menu"),
  entry("M7", "M", "Delete component", "Context menu (unchanged)", "context-menu"),
  entry("M8", "M", "Delete wire", "Context menu (unchanged)", "context-menu"),
  entry("M9", "M", "Simplify", "Context menu (unchanged)", "context-menu"),
  entry("M10", "M", "Wire color", "Context menu (unchanged)", "context-menu"),
  entry("M11", "M", "Wire thickness", "Context menu (unchanged)", "context-menu"),
  entry("M12", "M", "Paste", "Context menu (unchanged)", "context-menu"),
  entry("M13", "M", "Undo", "Context menu (unchanged)", "context-menu"),
  entry("M14", "M", "Redo", "Context menu (unchanged)", "context-menu")
];

export const RIBBON_AUDIT_MAP: readonly RibbonAuditEntry[] = [
  ...headerEntries,
  ...paletteEntries,
  ...toolsEntries,
  ...sheetEntries,
  ...runEntries,
  ...stateEntries,
  ...componentEntries,
  ...wireEntries,
  ...menuEntries
];

export const RIBBON_AUDIT_IDS = RIBBON_AUDIT_MAP.map((item) => item.id);

export function getRibbonAuditEntry(id: string): RibbonAuditEntry | null {
  return RIBBON_AUDIT_MAP.find((item) => item.id === id) ?? null;
}
