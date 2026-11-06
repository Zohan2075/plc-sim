import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePathBounds } from "../../../scripts/generate-off-delay-level-art.mjs";
import { OFF_DELAY_ART } from "./offDelayArt.generated";
import { LEVEL_SWITCH_ART } from "./levelSwitchArt.generated";

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
    for (const attr of match[0].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
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

    for (const element of [...nctc, ...noto]) {
      if (element.d) {
        expect(limitSwitchPaths.has(element.d)).toBe(false);
      }
    }
  });
});

describe("level-switch generated art", () => {
  it("copies the new SVG body paths and terminal circles without redrawing", () => {
    expect(levelSwitchElements).toHaveLength(6);
    expect(LEVEL_SWITCH_ART.LEVEL_SWITCH_NO.elements).toHaveLength(3);
    expect(LEVEL_SWITCH_ART.LEVEL_SWITCH_NC.elements).toHaveLength(3);

    const [noBody, noRightRing, noLeftRing] = LEVEL_SWITCH_ART.LEVEL_SWITCH_NO.elements;
    const [ncBody, ncRightRing, ncLeftRing] = LEVEL_SWITCH_ART.LEVEL_SWITCH_NC.elements;

    expect(noBody?.d).toBe(levelSwitchElements[0]!.attrs.d);
    expect(noRightRing).toMatchObject({ cx: 181.71, cy: 106.469, r: 8, strokeWidth: 4.375, tag: "circle" });
    expect(noLeftRing).toMatchObject({ cx: 92.14, cy: 106.456, r: 8, strokeWidth: 4.375, tag: "circle" });
    expect(ncBody?.d).toBe(levelSwitchElements[3]!.attrs.d);
    expect(ncRightRing).toMatchObject({ cx: 352.761, cy: 101.784, r: 8, strokeWidth: 4.375, tag: "circle" });
    expect(ncLeftRing?.d).toBe(levelSwitchElements[5]!.attrs.d);

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
