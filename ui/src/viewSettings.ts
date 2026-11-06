export interface ViewSettings {
  mouseWheelZooms: boolean;
}

export const DEFAULT_VIEW_SETTINGS: ViewSettings = { mouseWheelZooms: false };
export const VIEW_SETTINGS_STORAGE_KEY = "plc-sim.view-settings";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    console.warn("Failed to access view settings storage", error);
    return null;
  }
}

export function parseViewSettings(value: unknown): ViewSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ...DEFAULT_VIEW_SETTINGS };
  }

  const record = value as Record<string, unknown>;

  if (typeof record.mouseWheelZooms === "boolean") {
    return { mouseWheelZooms: record.mouseWheelZooms };
  }

  return { ...DEFAULT_VIEW_SETTINGS };
}

export function loadViewSettings(storage?: ReadableStorage): ViewSettings {
  const target = storage ?? getLocalStorage();

  if (!target) {
    return { ...DEFAULT_VIEW_SETTINGS };
  }

  try {
    const raw = target.getItem(VIEW_SETTINGS_STORAGE_KEY);

    return raw === null ? { ...DEFAULT_VIEW_SETTINGS } : parseViewSettings(JSON.parse(raw));
  } catch (error) {
    console.warn("Failed to load view settings; using defaults", error);
    return { ...DEFAULT_VIEW_SETTINGS };
  }
}

export function saveViewSettings(settings: ViewSettings, storage?: WritableStorage): void {
  const target = storage ?? getLocalStorage();

  if (!target) {
    return;
  }

  try {
    target.setItem(
      VIEW_SETTINGS_STORAGE_KEY,
      JSON.stringify({ mouseWheelZooms: Boolean(settings.mouseWheelZooms) })
    );
  } catch (error) {
    console.warn("Failed to save view settings", error);
  }
}
