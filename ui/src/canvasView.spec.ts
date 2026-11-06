import { describe, expect, it } from "vitest";
import {
  MAX_VIEW_ZOOM,
  MIN_VIEW_ZOOM,
  VIEW_MARGIN,
  VIEW_ZOOM_STEP,
  clampViewZoom,
  computeAnchoredScroll,
  computeFitView,
  computeGridMinorOpacity,
  normalizeWheelAxis,
  resolveWheelIntent
} from "./canvasView";

const BASE_EVENT = {
  ctrlKey: false,
  deltaMode: 0,
  deltaX: 0,
  deltaY: 0,
  metaKey: false,
  shiftKey: false
};

function getFocusModel(scroll: number, focus: number, zoom: number): number {
  return (scroll + focus - VIEW_MARGIN) / zoom;
}

describe("normalizeWheelAxis", () => {
  it("converts line and page deltas to pixels", () => {
    expect(normalizeWheelAxis(3, 1)).toBe(48);
    expect(normalizeWheelAxis(1, 2)).toBe(120);
    expect(normalizeWheelAxis(120, 0)).toBe(120);
  });

  it("caps each axis at ±240 pixels", () => {
    expect(normalizeWheelAxis(1000, 0)).toBe(240);
    expect(normalizeWheelAxis(-1000, 0)).toBe(-240);
    expect(normalizeWheelAxis(10, 2)).toBe(240);
  });

  it("returns 0 for non-finite deltas", () => {
    expect(normalizeWheelAxis(Number.NaN, 0)).toBe(0);
    expect(normalizeWheelAxis(Number.POSITIVE_INFINITY, 1)).toBe(0);
  });
});

describe("resolveWheelIntent", () => {
  it("pans vertically on a plain wheel by default", () => {
    expect(resolveWheelIntent({ ...BASE_EVENT, deltaY: 100 }, false))
      .toEqual({ dx: 0, dy: 100, type: "pan" });
  });

  it("pans both axes on a plain diagonal wheel", () => {
    expect(resolveWheelIntent({ ...BASE_EVENT, deltaX: 30, deltaY: 100 }, false))
      .toEqual({ dx: 30, dy: 100, type: "pan" });
  });

  it("pans horizontally on Shift and falls back to deltaY when the browser swaps axes", () => {
    expect(resolveWheelIntent({ ...BASE_EVENT, deltaY: 100, shiftKey: true }, false))
      .toEqual({ dx: 100, dy: 0, type: "pan" });
    expect(resolveWheelIntent({ ...BASE_EVENT, deltaX: 40, deltaY: 100, shiftKey: true }, false))
      .toEqual({ dx: 40, dy: 0, type: "pan" });
  });

  it("zooms on Ctrl or Meta (pinch) regardless of the wheel setting", () => {
    const expected = { factor: Math.exp(-100 * 0.0015), type: "zoom" };

    expect(resolveWheelIntent({ ...BASE_EVENT, ctrlKey: true, deltaY: 100 }, false)).toEqual(expected);
    expect(resolveWheelIntent({ ...BASE_EVENT, deltaY: 100, metaKey: true }, false)).toEqual(expected);
    expect(resolveWheelIntent({ ...BASE_EVENT, ctrlKey: true, deltaY: 100 }, true)).toEqual(expected);
  });

  it("zooms on a plain wheel when the setting is on", () => {
    expect(resolveWheelIntent({ ...BASE_EVENT, deltaY: 100 }, true))
      .toEqual({ factor: Math.exp(-100 * 0.0015), type: "zoom" });
  });

  it("keeps Shift as horizontal pan even when the setting is on", () => {
    expect(resolveWheelIntent({ ...BASE_EVENT, deltaY: 100, shiftKey: true }, true))
      .toEqual({ dx: 100, dy: 0, type: "pan" });
  });

  it("uses the dominant axis for zoom and normalizes line deltas first", () => {
    expect(resolveWheelIntent({ ...BASE_EVENT, ctrlKey: true, deltaX: 2, deltaY: 1, deltaMode: 1 }, false))
      .toEqual({ factor: Math.exp(-32 * 0.0015), type: "zoom" });
  });

  it("returns null when nothing would move", () => {
    expect(resolveWheelIntent(BASE_EVENT, false)).toBeNull();
    expect(resolveWheelIntent({ ...BASE_EVENT, ctrlKey: true }, true)).toBeNull();
  });
});

describe("clampViewZoom", () => {
  it("clamps to the 10–800% range and falls back for invalid values", () => {
    expect(clampViewZoom(0.05)).toBe(MIN_VIEW_ZOOM);
    expect(clampViewZoom(20)).toBe(MAX_VIEW_ZOOM);
    expect(clampViewZoom(1.2345)).toBe(1.2345);
    expect(clampViewZoom(Number.NaN)).toBe(1);
  });

  it("uses a multiplicative step that grows both ways", () => {
    expect(VIEW_ZOOM_STEP).toBeGreaterThan(1);
    expect(1 / VIEW_ZOOM_STEP).toBeLessThan(1);
  });
});

describe("computeAnchoredScroll", () => {
  it("keeps the model point under the viewport focus for 10%, 25%, 100%, 200% and 800%", () => {
    const transitions = [0.1, 0.25, 1, 2, 8];

    for (const newZoom of transitions) {
      const result = computeAnchoredScroll({
        focusX: 300,
        focusY: 260,
        margin: VIEW_MARGIN,
        newZoom,
        oldZoom: 1,
        scrollLeft: 100,
        scrollTop: 340
      });

      expect(getFocusModel(result.scrollLeft, 300, newZoom))
        .toBeCloseTo(getFocusModel(100, 300, 1), 6);
      expect(getFocusModel(result.scrollTop, 260, newZoom))
        .toBeCloseTo(getFocusModel(340, 260, 1), 6);
    }
  });

  it("preserves the focus across a zoom-in followed by a zoom-out", () => {
    const zoomed = computeAnchoredScroll({
      focusX: 500,
      focusY: 200,
      margin: VIEW_MARGIN,
      newZoom: 2.5,
      oldZoom: 1.5,
      scrollLeft: 240,
      scrollTop: 90
    });
    const restored = computeAnchoredScroll({
      focusX: 500,
      focusY: 200,
      margin: VIEW_MARGIN,
      newZoom: 1.5,
      oldZoom: 2.5,
      scrollLeft: zoomed.scrollLeft,
      scrollTop: zoomed.scrollTop
    });

    expect(restored.scrollLeft).toBeCloseTo(240, 6);
    expect(restored.scrollTop).toBeCloseTo(90, 6);
  });
});

describe("computeFitView", () => {
  it("fits the plane inside the viewport with margins", () => {
    const fit = computeFitView({
      contentHeight: 940,
      contentWidth: 1720,
      margin: VIEW_MARGIN,
      viewportHeight: 700,
      viewportWidth: 1200
    });

    expect(fit.zoom).toBeCloseTo(1104 / 1720, 6);
    expect(fit.scrollLeft).toBe(0);
    expect(fit.scrollTop).toBe(0);
  });

  it("clamps tiny and huge content to the zoom range", () => {
    expect(computeFitView({
      contentHeight: 10,
      contentWidth: 10,
      margin: VIEW_MARGIN,
      viewportHeight: 700,
      viewportWidth: 1200
    }).zoom).toBe(MAX_VIEW_ZOOM);

    expect(computeFitView({
      contentHeight: 100_000,
      contentWidth: 100_000,
      margin: VIEW_MARGIN,
      viewportHeight: 700,
      viewportWidth: 1200
    }).zoom).toBe(MIN_VIEW_ZOOM);
  });
});

describe("computeGridMinorOpacity", () => {
  it("hides minor lines below 3 px and fades them below 7 px", () => {
    expect(computeGridMinorOpacity(2.9)).toBe(0);
    expect(computeGridMinorOpacity(3)).toBe(0.35);
    expect(computeGridMinorOpacity(6.99)).toBe(0.35);
    expect(computeGridMinorOpacity(7)).toBe(1);
    expect(computeGridMinorOpacity(18)).toBe(1);
  });
});
