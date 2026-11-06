import { describe, expect, it, vi } from "vitest";
import { createCanvasZoomStore } from "./canvasZoomStore";

describe("createCanvasZoomStore", () => {
  it("exposes and updates the current zoom", () => {
    const store = createCanvasZoomStore(1);

    expect(store.getSnapshot()).toBe(1);

    store.set(2);

    expect(store.getSnapshot()).toBe(2);
  });

  it("notifies subscribers once per real change", () => {
    const store = createCanvasZoomStore(1);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set(2);
    store.set(2);

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.set(3);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(3);
  });

  it("supports several independent subscribers", () => {
    const store = createCanvasZoomStore(0.5);
    const first = vi.fn();
    const second = vi.fn();

    store.subscribe(first);
    store.subscribe(second);
    store.set(0.75);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
