import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildGridLines,
  computeSheetFrame,
  computeTitleBlockRect,
  computeZoneMarks,
  SheetLayer,
  zoneLabel
} from "./sheet";
import type { SheetMetadata } from "./sheet";
import { DEFAULT_GRID_SPACING, DEFAULT_PLANE_SETTINGS, MAJOR_GRID_MULTIPLIER, SHEET_FRAME_INSET } from "../DiagramBuilder";

const majorSpacing = DEFAULT_GRID_SPACING * MAJOR_GRID_MULTIPLIER;

describe("buildGridLines", () => {
  it("puts every line on a multiple of gridSpacing and covers the plane", () => {
    const lines = buildGridLines(DEFAULT_PLANE_SETTINGS);

    for (const x of lines.minorX) {
      expect(x % DEFAULT_GRID_SPACING).toBe(0);
    }
    for (const y of lines.minorY) {
      expect(y % DEFAULT_GRID_SPACING).toBe(0);
    }
    expect(lines.minorX[0]).toBe(0);
    expect(lines.minorY[0]).toBe(0);
    expect(lines.minorX[lines.minorX.length - 1]).toBeLessThanOrEqual(DEFAULT_PLANE_SETTINGS.width);
    expect(lines.minorY[lines.minorY.length - 1]).toBeLessThanOrEqual(DEFAULT_PLANE_SETTINGS.height);
    // Coverage: the last line is within one spacing of the plane edge.
    expect(DEFAULT_PLANE_SETTINGS.width - (lines.minorX[lines.minorX.length - 1] ?? 0)).toBeLessThan(DEFAULT_GRID_SPACING);
  });

  it("puts major lines on multiples of spacing x 5 only", () => {
    const lines = buildGridLines(DEFAULT_PLANE_SETTINGS);

    for (const x of lines.majorX) {
      expect(x % majorSpacing).toBe(0);
    }
    for (const y of lines.majorY) {
      expect(y % majorSpacing).toBe(0);
    }
    expect(lines.majorX).toHaveLength(Math.floor(DEFAULT_PLANE_SETTINGS.width / majorSpacing) + 1);
  });
});

describe("zoneLabel", () => {
  it("follows spreadsheet conventions", () => {
    expect(zoneLabel(1)).toBe("A");
    expect(zoneLabel(26)).toBe("Z");
    expect(zoneLabel(27)).toBe("AA");
    expect(zoneLabel(28)).toBe("AB");
    expect(zoneLabel(52)).toBe("AZ");
    expect(zoneLabel(53)).toBe("BA");
  });
});

describe("computeZoneMarks (cells derived from the major cell size)", () => {
  it("derives columns 1..N and rows A.. from width/height divided by the major spacing", () => {
    const marks = computeZoneMarks(DEFAULT_PLANE_SETTINGS);

    expect(marks.columns).toHaveLength(Math.ceil(DEFAULT_PLANE_SETTINGS.width / majorSpacing));
    expect(marks.rows).toHaveLength(Math.ceil(DEFAULT_PLANE_SETTINGS.height / majorSpacing));
    expect(marks.columns[0]).toEqual({ index: 1, x: 0 });
    expect(marks.columns[1]).toEqual({ index: 2, x: majorSpacing });
    expect(marks.rows[0]).toEqual({ label: "A", y: 0 });
    expect(marks.rows[1]).toEqual({ label: "B", y: majorSpacing });
  });
});

describe("computeSheetFrame / computeTitleBlockRect", () => {
  it("keeps the frame inset and the title block inside the frame, bottom-right", () => {
    const frame = computeSheetFrame(DEFAULT_PLANE_SETTINGS);
    const titleBlock = computeTitleBlockRect(DEFAULT_PLANE_SETTINGS);

    expect(frame).toEqual({
      height: DEFAULT_PLANE_SETTINGS.height - SHEET_FRAME_INSET * 2,
      width: DEFAULT_PLANE_SETTINGS.width - SHEET_FRAME_INSET * 2,
      x: SHEET_FRAME_INSET,
      y: SHEET_FRAME_INSET
    });
    expect(titleBlock.x + titleBlock.width).toBeLessThanOrEqual(DEFAULT_PLANE_SETTINGS.width - SHEET_FRAME_INSET);
    expect(titleBlock.y + titleBlock.height).toBeLessThanOrEqual(DEFAULT_PLANE_SETTINGS.height - SHEET_FRAME_INSET);
  });
});

describe("SheetLayer markup (DOM assertions without jsdom)", () => {
  function markup(sheet?: SheetMetadata): string {
    return renderToStaticMarkup(createElement(SheetLayer, { planeSettings: DEFAULT_PLANE_SETTINGS, sheet }));
  }

  it("renders minor and major grid lines as svg elements", () => {
    const html = markup();

    expect(html).toContain('data-axis="minor"');
    expect(html).toContain('data-axis="major"');
    expect(html).toContain('class="sheet-grid"');
  });

  it("renders the frame, zone marks and the title block", () => {
    const html = markup({ date: "2026-10-30", page: "1", projectName: "Bombeo", scale: "1:1" });

    expect(html).toContain('data-testid="sheet-frame"');
    expect(html).toContain('data-zone="column"');
    expect(html).toContain('data-zone="row"');
    expect(html).toContain('data-testid="sheet-title-block"');
    expect(html).toContain('data-field="projectName"');
    expect(html).toContain("Bombeo");
    expect(html).toContain("Project");
    expect(html).toContain("Date");
    expect(html).toContain("Scale");
    expect(html).toContain("Page");
  });
});
