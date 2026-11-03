import { describe, expect, it } from "vitest";
import {
  clampMenuPosition,
  getNextMenuIndex,
  getSubmenuSide,
  isLongPressCancelled,
  shouldRestoreMenuFocus
} from "./contextMenu";

const MENU_SIZE = { height: 320, width: 240 };
const LARGE_VIEWPORT = { height: 1160, width: 1720 };
const PHONE_VIEWPORT = { height: 667, width: 375 };
const MARGIN = 8;

function expectInside(
  position: { left: number; maxHeight: number; maxWidth: number; top: number },
  viewport: { height: number; width: number }
): void {
  expect(position.left).toBeGreaterThanOrEqual(MARGIN);
  expect(position.top).toBeGreaterThanOrEqual(MARGIN);
  expect(position.left + Math.min(MENU_SIZE.width, position.maxWidth))
    .toBeLessThanOrEqual(viewport.width - MARGIN);
  expect(position.top + Math.min(MENU_SIZE.height, position.maxHeight))
    .toBeLessThanOrEqual(viewport.height - MARGIN);
}

describe("clampMenuPosition", () => {
  const largeAnchors = [
    { x: 0, y: 0 },
    { x: LARGE_VIEWPORT.width, y: 0 },
    { x: 0, y: LARGE_VIEWPORT.height },
    { x: LARGE_VIEWPORT.width, y: LARGE_VIEWPORT.height },
    { x: LARGE_VIEWPORT.width / 2, y: 0 },
    { x: LARGE_VIEWPORT.width / 2, y: LARGE_VIEWPORT.height },
    { x: 0, y: LARGE_VIEWPORT.height / 2 },
    { x: LARGE_VIEWPORT.width, y: LARGE_VIEWPORT.height / 2 }
  ];

  for (const anchor of largeAnchors) {
    it(`keeps the large-canvas menu inside at (${anchor.x},${anchor.y})`, () => {
      const position = clampMenuPosition(anchor, MENU_SIZE, LARGE_VIEWPORT, MARGIN);

      console.log(`1720x1160 anchor (${anchor.x},${anchor.y}) -> left=${position.left.toFixed(1)} top=${position.top.toFixed(1)}`);
      expectInside(position, LARGE_VIEWPORT);
    });
  }

  for (const anchor of [
    { x: 0, y: 0 },
    { x: PHONE_VIEWPORT.width, y: 0 },
    { x: 0, y: PHONE_VIEWPORT.height },
    { x: PHONE_VIEWPORT.width, y: PHONE_VIEWPORT.height },
    { x: PHONE_VIEWPORT.width, y: PHONE_VIEWPORT.height / 2 }
  ]) {
    it(`keeps the menu inside a 375px viewport at (${anchor.x},${anchor.y})`, () => {
      const position = clampMenuPosition(anchor, MENU_SIZE, PHONE_VIEWPORT, MARGIN);

      console.log(`375x667 anchor (${anchor.x},${anchor.y}) -> left=${position.left.toFixed(1)} top=${position.top.toFixed(1)} maxWidth=${position.maxWidth}`);
      expectInside(position, PHONE_VIEWPORT);
    });
  }
});

describe("getSubmenuSide", () => {
  it("opens right when there is room", () => {
    expect(getSubmenuSide({ left: 20, right: 200 }, 160, 800)).toBe("right");
  });

  it("opens left when the right side is tight", () => {
    expect(getSubmenuSide({ left: 220, right: 360 }, 180, 400)).toBe("left");
  });
});

describe("getNextMenuIndex", () => {
  it("wraps in both directions", () => {
    expect(getNextMenuIndex(2, 3, 1)).toBe(0);
    expect(getNextMenuIndex(0, 3, -1)).toBe(2);
    expect(getNextMenuIndex(1, 3, 1)).toBe(2);
  });
});

describe("shouldRestoreMenuFocus", () => {
  it("does not steal focus when close() runs without an open menu", () => {
    expect(shouldRestoreMenuFocus(false)).toBe(false);
    expect(shouldRestoreMenuFocus(true)).toBe(true);
  });
});

describe("isLongPressCancelled", () => {
  it("keeps a 0-8 px move alive and cancels a 10 px move", () => {
    expect(isLongPressCancelled({ x: 0, y: 0 }, { x: 5, y: 5 }, 8)).toBe(false);
    expect(isLongPressCancelled({ x: 0, y: 0 }, { x: 10, y: 0 }, 8)).toBe(true);
  });
});
