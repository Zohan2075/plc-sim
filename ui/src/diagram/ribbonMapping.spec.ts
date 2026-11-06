import { describe, expect, it } from "vitest";
import { instructionPalette } from "../DiagramBuilder";
import {
  getRibbonAuditEntry,
  RIBBON_AUDIT_IDS,
  RIBBON_AUDIT_MAP
} from "./ribbonMapping";
import type { RibbonAuditGroup } from "./ribbonMapping";

const expectedGroupCounts: Record<RibbonAuditGroup, number> = {
  H: 3,
  P: 27,
  T: 15,
  S: 4,
  R: 6,
  ST: 10,
  C: 18,
  W: 21,
  M: 14
};

describe("ribbon control audit map", () => {
  it("covers every audit group with the expected number of controls", () => {
    for (const [group, expectedCount] of Object.entries(expectedGroupCounts)) {
      const count = RIBBON_AUDIT_MAP.filter((item) => item.group === group).length;
      expect(count).toBe(expectedCount);
    }

    expect(RIBBON_AUDIT_MAP).toHaveLength(
      Object.values(expectedGroupCounts).reduce((total, count) => total + count, 0)
    );
  });

  it("has unique IDs and a non-empty destination for every control", () => {
    expect(new Set(RIBBON_AUDIT_IDS).size).toBe(RIBBON_AUDIT_IDS.length);

    for (const item of RIBBON_AUDIT_MAP) {
      expect(item.destination.trim().length).toBeGreaterThan(0);
    }
  });

  it("maps the palette IDs to the Insert tab in palette order", () => {
    const paletteEntries = RIBBON_AUDIT_MAP.filter((item) => item.group === "P");

    expect(paletteEntries.map((item) => item.label)).toEqual(
      instructionPalette.map((item) => item.label)
    );
    expect(paletteEntries.every((item) => item.destination.includes("Insert tab"))).toBe(true);
  });

  it("keeps the specific destinations from the phase-4 mapping", () => {
    const expectations: Array<[string, string]> = [
      ["T13", "File tab / Circuit"],
      ["T14", "File tab / Circuit"],
      ["T15", "File tab / Circuit (hidden input)"],
      ["T3", "Home tab / Wiring"],
      ["T4", "Home tab / Wiring"],
      ["T5", "Home tab / Wiring"],
      ["T9", "Home tab / Wiring"],
      ["T10", "Home tab / Wiring"],
      ["T6", "View tab / Canvas"],
      ["T7", "View tab / Canvas"],
      ["T8", "View tab / Canvas"],
      ["S1", "File tab / Document"],
      ["S2", "File tab / Document"],
      ["S3", "File tab / Document"],
      ["S4", "File tab / Document"],
      ["R1", "Simulation tab / Run"],
      ["R2", "Simulation tab / Run"],
      ["R3", "View tab / Zoom"],
      ["R5", "View tab / Zoom"],
      ["R6", "View tab / Zoom"],
      ["C10", "Component tab / Edit"],
      ["C11", "Component tab / Edit"],
      ["W19", "Wire tab / Edit"],
      ["M12", "Context menu (unchanged)"],
      ["M13", "Context menu (unchanged)"],
      ["M14", "Context menu (unchanged)"]
    ];

    for (const [id, destination] of expectations) {
      expect(getRibbonAuditEntry(id)?.destination).toBe(destination);
    }
  });

  it("keeps the state and wire panels fully represented", () => {
    for (let index = 1; index <= 10; index += 1) {
      expect(getRibbonAuditEntry(`ST${index}`)?.destination).toContain("Status");
    }

    for (let index = 1; index <= 21; index += 1) {
      expect(getRibbonAuditEntry(`W${index}`)?.destination).toContain("Wire tab");
    }

    for (let index = 1; index <= 18; index += 1) {
      expect(getRibbonAuditEntry(`C${index}`)?.destination).toContain("Component tab");
    }
  });
});
