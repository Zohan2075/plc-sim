import {
  MAJOR_GRID_MULTIPLIER,
  SHEET_FRAME_INSET,
  TITLE_BLOCK_HEIGHT,
  TITLE_BLOCK_PADDING,
  TITLE_BLOCK_ROW_HEIGHT,
  TITLE_BLOCK_WIDTH
} from "../DiagramBuilder";
import { memo } from "react";
import type { BuilderPlaneSettings } from "../DiagramBuilder";

/** Pure sheet geometry: grid lines, zone marks, frame and title-block rect. */

export interface SheetMetadata {
  date: string;
  page: string;
  projectName: string;
  scale: string;
}

export interface GridLines {
  majorX: number[];
  majorY: number[];
  minorX: number[];
  minorY: number[];
}

export interface ZoneMarks {
  columns: { index: number; x: number }[];
  rows: { label: string; y: number }[];
}

export interface SheetFrame {
  height: number;
  width: number;
  x: number;
  y: number;
}

function buildAxisLinePositions(extent: number, spacing: number): number[] {
  const positions: number[] = [];

  for (let position = 0; position <= extent; position += spacing) {
    positions.push(position);
  }

  return positions;
}

/** Minor lines at every grid spacing; major lines at every `MAJOR_GRID_MULTIPLIER`th spacing. All positions are multiples of `gridSpacing`. */
export function buildGridLines(planeSettings: BuilderPlaneSettings): GridLines {
  const majorSpacing = planeSettings.gridSpacing * MAJOR_GRID_MULTIPLIER;

  return {
    majorX: buildAxisLinePositions(planeSettings.width, majorSpacing),
    majorY: buildAxisLinePositions(planeSettings.height, majorSpacing),
    minorX: buildAxisLinePositions(planeSettings.width, planeSettings.gridSpacing),
    minorY: buildAxisLinePositions(planeSettings.height, planeSettings.gridSpacing)
  };
}

/** 1-based index -> spreadsheet-style row label: 1 "A" .. 26 "Z", 27 "AA", 28 "AB" ... */
export function zoneLabel(index: number): string {
  let value = index;
  let label = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

/** Zone marks derived from the major cell size (OD4-1): columns 1..N across, rows A.. down. */
export function computeZoneMarks(planeSettings: BuilderPlaneSettings): ZoneMarks {
  const majorSpacing = planeSettings.gridSpacing * MAJOR_GRID_MULTIPLIER;
  const columnCount = Math.ceil(planeSettings.width / majorSpacing);
  const rowCount = Math.ceil(planeSettings.height / majorSpacing);
  const columns: { index: number; x: number }[] = [];
  const rows: { label: string; y: number }[] = [];

  for (let column = 1; column <= columnCount; column += 1) {
    columns.push({ index: column, x: (column - 1) * majorSpacing });
  }

  for (let row = 1; row <= rowCount; row += 1) {
    rows.push({ label: zoneLabel(row), y: (row - 1) * majorSpacing });
  }

  return { columns, rows };
}

/** Sheet frame rect, inset from the plane edge. */
export function computeSheetFrame(planeSettings: BuilderPlaneSettings): SheetFrame {
  return {
    height: planeSettings.height - SHEET_FRAME_INSET * 2,
    width: planeSettings.width - SHEET_FRAME_INSET * 2,
    x: SHEET_FRAME_INSET,
    y: SHEET_FRAME_INSET
  };
}

/** Title-block rect anchored bottom-right inside the sheet frame. */
export function computeTitleBlockRect(planeSettings: BuilderPlaneSettings): SheetFrame {
  return {
    height: TITLE_BLOCK_HEIGHT,
    width: TITLE_BLOCK_WIDTH,
    x: planeSettings.width - SHEET_FRAME_INSET - TITLE_BLOCK_WIDTH,
    y: planeSettings.height - SHEET_FRAME_INSET - TITLE_BLOCK_HEIGHT
  };
}

interface TitleBlockField {
  key: keyof SheetMetadata;
  label: string;
  value: string;
}

function getTitleBlockFields(sheet: SheetMetadata | undefined): TitleBlockField[] {
  return [
    { key: "projectName", label: "Project", value: sheet?.projectName ?? "" },
    { key: "date", label: "Date", value: sheet?.date ?? "" },
    { key: "scale", label: "Scale", value: sheet?.scale ?? "" },
    { key: "page", label: "Page", value: sheet?.page ?? "" }
  ];
}

/** Default title-block metadata: projectName copied from the circuit name, date from `savedAt` (YYYY-MM-DD). */
export function createDefaultSheetMetadata(projectName: string, savedAtIso: string): SheetMetadata {
  const savedAt = new Date(savedAtIso);
  const date = Number.isNaN(savedAt.getTime())
    ? ""
    : `${savedAt.getFullYear()}-${String(savedAt.getMonth() + 1).padStart(2, "0")}-${String(savedAt.getDate()).padStart(2, "0")}`;

  return {
    date,
    page: "1",
    projectName,
    scale: "1:1"
  };
}

/**
 * The sheet layer: visible grid lines (minor/major), sheet frame, zone marks and the title
 * block. Rendered as the first child of the free-play SVG so components and wires sit on top.
 * Geometry shares `gridSpacing` with `grid.ts`, so the drawn grid is exactly where snapping happens.
 */
function SheetLayerBase({ planeSettings, sheet }: { planeSettings: BuilderPlaneSettings; sheet?: SheetMetadata | undefined }) {
  const gridLines = buildGridLines(planeSettings);
  const zoneMarks = computeZoneMarks(planeSettings);
  const frame = computeSheetFrame(planeSettings);
  const titleBlock = computeTitleBlockRect(planeSettings);
  const fields = getTitleBlockFields(sheet);

  return (
    <g className="sheet-grid" data-testid="sheet-grid">
      {gridLines.minorX.map((x) => (
        <line className="sheet-grid__line sheet-grid__line--minor" data-axis="minor" key={`minor-x-${x}`} x1={x} x2={x} y1={0} y2={planeSettings.height} />
      ))}
      {gridLines.minorY.map((y) => (
        <line className="sheet-grid__line sheet-grid__line--minor" data-axis="minor" key={`minor-y-${y}`} x1={0} x2={planeSettings.width} y1={y} y2={y} />
      ))}
      {gridLines.majorX.map((x) => (
        <line className="sheet-grid__line sheet-grid__line--major" data-axis="major" key={`major-x-${x}`} x1={x} x2={x} y1={0} y2={planeSettings.height} />
      ))}
      {gridLines.majorY.map((y) => (
        <line className="sheet-grid__line sheet-grid__line--major" data-axis="major" key={`major-y-${y}`} x1={0} x2={planeSettings.width} y1={y} y2={y} />
      ))}

      <rect className="sheet-frame" data-testid="sheet-frame" height={frame.height} width={frame.width} x={frame.x} y={frame.y} />

      <defs>
        <clipPath id="sheet-title-block-clip">
          <rect
            height={titleBlock.height - 4}
            width={titleBlock.width - 4}
            x={titleBlock.x + 2}
            y={titleBlock.y + 2}
          />
        </clipPath>
      </defs>

      {zoneMarks.columns.map((column) => (
        <text className="sheet-zone-label" data-zone="column" key={`zone-column-${column.index}`} x={column.x + 4} y={SHEET_FRAME_INSET + 11}>
          {column.index}
        </text>
      ))}
      {zoneMarks.rows.map((row) => (
        <text className="sheet-zone-label" data-zone="row" key={`zone-row-${row.label}`} x={SHEET_FRAME_INSET + 4} y={row.y + 13}>
          {row.label}
        </text>
      ))}

      <g className="sheet-title-block" data-testid="sheet-title-block">
        <rect className="sheet-title-block__frame" height={titleBlock.height} width={titleBlock.width} x={titleBlock.x} y={titleBlock.y} />
        <g clipPath="url(#sheet-title-block-clip)">
          {fields.map((field, index) => {
            const rowY = titleBlock.y + TITLE_BLOCK_PADDING + TITLE_BLOCK_ROW_HEIGHT * index + 14;

            return (
              <g key={`title-block-${field.key}`}>
                <text className="sheet-title-block__label" x={titleBlock.x + TITLE_BLOCK_PADDING} y={rowY}>
                  {field.label}
                </text>
                <text className="sheet-title-block__value" data-field={field.key} x={titleBlock.x + 110} y={rowY}>
                  {field.value}
                </text>
              </g>
            );
          })}
        </g>
      </g>
    </g>
  );
}

export const SheetLayer = memo(SheetLayerBase);
