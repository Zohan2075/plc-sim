import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePathBounds } from "../../../scripts/generate-off-delay-level-art.mjs";
import { OFF_DELAY_ART } from "./offDelayArt.generated";
import { LEVEL_SWITCH_ART } from "./levelSwitchArt.generated";
import { SENSOR_SWITCH_ART } from "./sensorSwitchArt.generated";

function readReferencePaths(relativePath: string): string[] {
  const raw = readFileSync(new URL(`../../../reference/${relativePath}`, import.meta.url), "utf8");

  return [...raw.matchAll(/<path\b[^>]*\/>/g)]
    .map((match) => /d="([^"]*)"/.exec(match[0])?.[1])
    .filter((value): value is string => Boolean(value));
}

function readReferenceElements(relativePath: string) {
  const raw = readFileSync(new URL(`../../../reference/${relativePath}`, import.meta.url), "utf8");

  return [...raw.matchAll(/<(path|circle|line)\b[^>]*\/>/g)].map((match) => {
    const attrs: Record<string, string> = {};
    for (const attr of match[0].matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)) {
      if (attr[1] && attr[2] !== undefined) {
        attrs[attr[1]] = attr[2];
      }
    }
    return { attrs, tag: match[1] };
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const offDelayPaths = readReferencePaths("Off delays contacts (on and off).svg");
const offDelayElements = readReferenceElements("Off delays contacts (on and off).svg");
const levelSwitchElements = readReferenceElements("Liquid level switch (on and off).svg");
const limitSwitchPaths = new Set(readReferencePaths("NO limit switch.svg"));

const SENSOR_SWITCH_SOURCES = [
  { type: "TEMPERATURE_SWITCH", source: "Temperature switch.svg", openRange: [5, 10], closedRange: [0, 5] },
  { type: "FLOW_SWITCH", source: "Flow switch.svg", openRange: [5, 10], closedRange: [0, 5] },
  { type: "PRESSURE_SWITCH", source: "Pressure switch.svg", openRange: [0, 5], closedRange: [5, 10] }
] as const;

type SourceElement = ReturnType<typeof readReferenceElements>[number];
type GeneratedSensorElement = (typeof SENSOR_SWITCH_ART)[
  typeof SENSOR_SWITCH_SOURCES[number]["type"]
]["open"]["elements"][number];

function sourceGeometrySignature(element: SourceElement): string {
  const { attrs, tag } = element;

  if (tag === "circle") {
    return `circle:${Number(attrs.cx)}:${Number(attrs.cy)}:${Number(attrs.r)}`;
  }

  if (tag === "line") {
    return `line:${Number(attrs.x1)}:${Number(attrs.y1)}:${Number(attrs.x2)}:${Number(attrs.y2)}`;
  }

  return `path:${attrs.d}`;
}

function generatedGeometrySignature(element: GeneratedSensorElement): string {
  if (element.tag === "circle") {
    return `circle:${element.cx}:${element.cy}:${element.r}`;
  }

  if (element.tag === "line") {
    return `line:${element.x1}:${element.y1}:${element.x2}:${element.y2}`;
  }

  return `path:${element.d}`;
}

const sensorSwitchSourceElements = new Map(
  SENSOR_SWITCH_SOURCES.map((definition) => [
    definition.type,
    readReferenceElements(definition.source)
  ])
);

describe("off-delay generated art", () => {
  it("copies the new SVG paths, lines and terminal circles without redrawing", () => {
    expect(offDelayElements).toHaveLength(12);
    expect(offDelayPaths).toHaveLength(2);
    expect(OFF_DELAY_ART.NCTC.elements).toHaveLength(6);
    expect(OFF_DELAY_ART.NOTO.elements).toHaveLength(6);

    const nctc = OFF_DELAY_ART.NCTC.elements;
    const noto = OFF_DELAY_ART.NOTO.elements;

    expect(nctc[0]?.d).toBe(offDelayElements[0]!.attrs.d);
    expect(nctc[1]).toMatchObject({ tag: "line", x1: 214.622, y1: 99.474, x2: 202.122, y2: 114.474 });
    expect(nctc[2]).toMatchObject({ tag: "line", x1: 189.258, y1: 99.479, x2: 201.758, y2: 114.479 });
    expect(nctc[3]).toMatchObject({ tag: "circle", cx: 152.756, cy: 72.233, r: 8 });
    expect(nctc[4]).toMatchObject({ tag: "circle", cx: 248.756, cy: 72.233, r: 8 });
    expect(nctc[5]).toMatchObject({ tag: "line", x1: 160.756, y1: 72.233, x2: 240.756, y2: 63.483 });

    expect(noto[0]).toMatchObject({ tag: "circle", cx: 152.778, cy: 201.082, r: 8 });
    expect(noto[1]).toMatchObject({ tag: "circle", cx: 248.747, cy: 201.155, r: 8 });
    expect(noto[2]).toMatchObject({ tag: "line", x1: 162.167, y1: 200.639, x2: 239.481, y2: 222.98 });
    expect(noto[3]?.d).toBe(offDelayElements[9]!.attrs.d);
    expect(noto[4]).toMatchObject({ tag: "line", x1: 214.081, y1: 243.835, x2: 201.581, y2: 258.835 });
    expect(noto[5]).toMatchObject({ tag: "line", x1: 188.717, y1: 243.84, x2: 201.217, y2: 258.84 });

    for (const element of [...nctc, ...noto].filter((entry) => entry.tag === "line")) {
      expect(element).toMatchObject({ strokeLinecap: "round", strokeLinejoin: "round" });
    }

    for (const element of [...nctc, ...noto]) {
      if (element.d) {
        expect(limitSwitchPaths.has(element.d)).toBe(false);
      }
    }
  });
});

describe("level-switch generated art", () => {
  it("copies the new SVG body paths and terminal circles without redrawing", () => {
    expect(levelSwitchElements).toHaveLength(7);
    expect(LEVEL_SWITCH_ART.LEVEL_SWITCH_NO.elements).toHaveLength(4);
    expect(LEVEL_SWITCH_ART.LEVEL_SWITCH_NC.elements).toHaveLength(3);

    const [noLever, noFloat, noRightRing, noLeftRing] = LEVEL_SWITCH_ART.LEVEL_SWITCH_NO.elements;
    const [ncBody, ncRightRing, ncLeftRing] = LEVEL_SWITCH_ART.LEVEL_SWITCH_NC.elements;

    expect(noLever?.d).toBe(levelSwitchElements[0]!.attrs.d);
    expect(noFloat?.d).toBe(levelSwitchElements[1]!.attrs.d);
    expect(noRightRing).toMatchObject({ cx: 181.71, cy: 106.469, r: 8, strokeWidth: 4.375, tag: "circle" });
    expect(noLeftRing).toMatchObject({ cx: 92.14, cy: 106.456, r: 8, strokeWidth: 4.375, tag: "circle" });
    expect(ncBody?.d).toBe(levelSwitchElements[4]!.attrs.d);
    expect(ncRightRing).toMatchObject({ cx: 352.775, cy: 106.452, r: 8, strokeWidth: 4.375, tag: "circle" });
    expect(ncLeftRing?.d).toBe(levelSwitchElements[6]!.attrs.d);

    for (const element of [...LEVEL_SWITCH_ART.LEVEL_SWITCH_NO.elements, ...LEVEL_SWITCH_ART.LEVEL_SWITCH_NC.elements]) {
      if (element.d) {
        expect(limitSwitchPaths.has(element.d)).toBe(false);
      }
    }
  });
});

describe("generated path parser and resized metadata", () => {
  it("computes line, closed-subpath, and cubic-extrema bounds", () => {
    expect(parsePathBounds("M0 0 L10 0 L10 10 Z")).toEqual({
      bottom: 10,
      left: 0,
      right: 10,
      top: 0
    });
    expect(parsePathBounds("M0 0 C0 10 10 10 10 0")).toEqual({
      bottom: 7.5,
      left: 0,
      right: 10,
      top: 0
    });
    expect(parsePathBounds("M0 0 L10 0 L10 10 Z M20 20 C20 30 30 30 30 20")).toEqual({
      bottom: 27.5,
      left: 0,
      right: 30,
      top: 0
    });
  });

  it("validates the supported command set and tuple arity", () => {
    expect(() => parsePathBounds("m0 0 l10 0", "lowercase fixture")).toThrow(/unsupported command/);
    expect(() => parsePathBounds("M0 0 H10", "unsupported fixture")).toThrow(/unsupported command/);
    expect(() => parsePathBounds("M0 0 C1 2 3", "bad tuple fixture")).toThrow(/malformed C tuple/);
    expect(parsePathBounds("M+1.5e1,-2.5 20 5 Z")).toEqual({
      bottom: 5,
      left: 15,
      right: 20,
      top: -2.5
    });
  });

  it("includes the miter outline and respects butt caps", () => {
    const strokedClosedPath = parsePathBounds("M0 0 L10 0 L10 10 Z", "miter", 2);
    const strokedOpenPath = parsePathBounds("M0 0 L10 0", "butt cap", 2);

    expect(strokedClosedPath.left).toBeLessThan(-0.99);
    expect(strokedClosedPath.right).toBeGreaterThan(10.99);
    expect(strokedOpenPath).toEqual({ bottom: 1, left: 0, right: 10, top: -1 });
  });

  it("maps the new off-delay SVG to 32/128 anchors and NCTO ring weight", () => {
    for (const symbol of [OFF_DELAY_ART.NOTO, OFF_DELAY_ART.NCTC]) {
      expect(symbol.ringCenters[0].x * 1.25).toBeCloseTo(32, 7);
      expect(symbol.ringCenters[1].x * 1.25).toBeCloseTo(128, 7);
      expect(Math.abs(symbol.ringCenters[0].y * 1.25 + 11 - 48.5)).toBeLessThan(0.05);
      expect(Math.abs(symbol.ringCenters[1].y * 1.25 + 11 - 48.5)).toBeLessThan(0.05);
      expect(symbol.strokeWidth).toBe(0);
      expect(symbol.ringRadii[0]).toBeCloseTo(10.19, 1);
      expect(symbol.ringRadii[1]).toBeCloseTo(10.19, 1);
      expect(symbol.tightBounds.right - symbol.tightBounds.left).toBeGreaterThan(110);
      expect(symbol.tightBounds.right - symbol.tightBounds.left).toBeLessThan(120);
      expect(Object.values(symbol.tightBounds).every(Number.isFinite)).toBe(true);
    }
  });

  it("maps the new level SVG to the level terminal pitch", () => {
    for (const symbol of [LEVEL_SWITCH_ART.LEVEL_SWITCH_NO, LEVEL_SWITCH_ART.LEVEL_SWITCH_NC]) {
      expect(symbol.ringCenters[0].x * 1.25).toBeCloseTo(35, 7);
      expect(symbol.ringCenters[1].x * 1.25).toBeCloseTo(125, 7);
      expect(Math.abs(symbol.ringCenters[0].y * 1.25 + 11 - 48.5)).toBeLessThan(0.02);
      expect(Math.abs(symbol.ringCenters[1].y * 1.25 + 11 - 48.5)).toBeLessThan(0.02);
      expect(symbol.strokeWidth).toBe(0);
      expect(symbol.ringRadii[0]).toBeCloseTo(10.24, 1);
      expect(symbol.ringRadii[1]).toBeCloseTo(10.24, 1);
      expect(symbol.tightBounds.right - symbol.tightBounds.left).toBeGreaterThan(100);
      expect(symbol.tightBounds.right - symbol.tightBounds.left).toBeLessThan(140);
      expect(Object.values(symbol.tightBounds).every(Number.isFinite)).toBe(true);
    }
  });
});

describe("sensor-switch generated art", () => {
  it("copies exactly five source elements per state with 1:1 geometry hashes", () => {
    for (const definition of SENSOR_SWITCH_SOURCES) {
      const sourceElements = sensorSwitchSourceElements.get(definition.type)!;

      expect(sourceElements).toHaveLength(10);

      for (const state of ["open", "closed"] as const) {
        const range = state === "open" ? definition.openRange : definition.closedRange;
        const symbol = SENSOR_SWITCH_ART[definition.type][state];

        expect(symbol.elements).toHaveLength(5);

        symbol.elements.forEach((element, index) => {
          const source = sourceElements[range[0] + index]!;

          const generatedHash = sha256(generatedGeometrySignature(element));
          const sourceHash = sha256(sourceGeometrySignature(source));

          expect(element.tag).toBe(source.tag);
          expect(generatedHash).toBe(sourceHash);

          if (element.tag === "circle" || element.tag === "line") {
            expect(element.strokeLinecap).toBe("round");
            expect(element.strokeLinejoin).toBe("round");
          }

          if (source.tag === "path") {
            expect(element.d).toBe(source.attrs.d);
          } else if (source.tag === "circle") {
            expect(element).toMatchObject({
              cx: Number(source.attrs.cx),
              cy: Number(source.attrs.cy),
              r: Number(source.attrs.r)
            });
          } else {
            expect(element).toMatchObject({
              x1: Number(source.attrs.x1),
              y1: Number(source.attrs.y1),
              x2: Number(source.attrs.x2),
              y2: Number(source.attrs.y2)
            });
          }
        });
      }
    }
  });

  it("maps every sensor state to the 96 pitch and 80,48.5 pair midpoint", () => {
    for (const definition of SENSOR_SWITCH_SOURCES) {
      for (const state of ["open", "closed"] as const) {
        const symbol = SENSOR_SWITCH_ART[definition.type][state];
        const [left, right] = symbol.ringCenters;
        const projectedLeft = { x: left.x * 1.25, y: left.y * 1.25 + 11 };
        const projectedRight = { x: right.x * 1.25, y: right.y * 1.25 + 11 };

        expect(symbol.elements).toHaveLength(5);
        expect(projectedLeft.x).toBeCloseTo(32, 8);
        expect(projectedRight.x).toBeCloseTo(128, 8);
        expect(projectedLeft.y).toBeCloseTo(48.5, 8);
        expect(projectedRight.y).toBeCloseTo(48.5, 8);
        expect(Math.hypot(projectedRight.x - projectedLeft.x, projectedRight.y - projectedLeft.y)).toBeCloseTo(96, 8);
        expect((projectedLeft.x + projectedRight.x) / 2).toBeCloseTo(80, 8);
        expect((projectedLeft.y + projectedRight.y) / 2).toBeCloseTo(48.5, 8);
        expect(symbol.ringRadii[0]).toBeCloseTo(10.19, 1);
        expect(symbol.ringRadii[1]).toBeCloseTo(10.19, 1);
        expect(symbol.underDiscRadius).toBeCloseTo(6.72, 1);
        expect(symbol.strokeWidth).toBe(0);
        expect(Object.values(symbol.tightBounds).every(Number.isFinite)).toBe(true);
      }
    }
  });
});
