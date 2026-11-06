import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW_SETTINGS,
  VIEW_SETTINGS_STORAGE_KEY,
  loadViewSettings,
  parseViewSettings,
  saveViewSettings
} from "./viewSettings";

function createFakeStorage() {
  const values = new Map<string, string>();

  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      }
    }
  };
}

describe("parseViewSettings", () => {
  it("returns the default for missing or malformed values", () => {
    expect(parseViewSettings(null)).toEqual(DEFAULT_VIEW_SETTINGS);
    expect(parseViewSettings(undefined)).toEqual(DEFAULT_VIEW_SETTINGS);
    expect(parseViewSettings("nope")).toEqual(DEFAULT_VIEW_SETTINGS);
    expect(parseViewSettings([])).toEqual(DEFAULT_VIEW_SETTINGS);
    expect(parseViewSettings({ mouseWheelZooms: "yes" })).toEqual(DEFAULT_VIEW_SETTINGS);
  });

  it("reads only the known boolean field", () => {
    expect(parseViewSettings({ extra: 1, mouseWheelZooms: true })).toEqual({ mouseWheelZooms: true });
    expect(parseViewSettings({ mouseWheelZooms: false })).toEqual({ mouseWheelZooms: false });
  });
});

describe("view settings persistence", () => {
  it("defaults to wheel-off when storage is empty", () => {
    const { storage } = createFakeStorage();

    expect(loadViewSettings(storage)).toEqual({ mouseWheelZooms: false });
  });

  it("round-trips through the dedicated storage key", () => {
    const { storage, values } = createFakeStorage();

    saveViewSettings({ mouseWheelZooms: true }, storage);

    expect(JSON.parse(values.get(VIEW_SETTINGS_STORAGE_KEY) ?? "null"))
      .toEqual({ mouseWheelZooms: true });
    expect(loadViewSettings(storage)).toEqual({ mouseWheelZooms: true });
  });

  it("falls back to defaults when the stored JSON is corrupt", () => {
    const { storage, values } = createFakeStorage();

    values.set(VIEW_SETTINGS_STORAGE_KEY, "{oops");

    expect(loadViewSettings(storage)).toEqual(DEFAULT_VIEW_SETTINGS);
  });
});
