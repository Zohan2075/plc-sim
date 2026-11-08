export interface ViewSettings {
  componentMenuCategory?: string;
  mouseWheelZooms: boolean;
  ribbonCollapsed?: boolean;
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
  const settings: ViewSettings = { mouseWheelZooms: false };

  if (typeof record.mouseWheelZooms === "boolean") {
    settings.mouseWheelZooms = record.mouseWheelZooms;
  }

  if (typeof record.componentMenuCategory === "string") {
    settings.componentMenuCategory = record.componentMenuCategory;
  }

  if (typeof record.ribbonCollapsed === "boolean") {
    settings.ribbonCollapsed = record.ribbonCollapsed;
  }

  return settings;
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
    const payload: ViewSettings = { mouseWheelZooms: Boolean(settings.mouseWheelZooms) };

    if (typeof settings.componentMenuCategory === "string") {
      payload.componentMenuCategory = settings.componentMenuCategory;
    }

    if (typeof settings.ribbonCollapsed === "boolean") {
      payload.ribbonCollapsed = settings.ribbonCollapsed;
    }

    target.setItem(VIEW_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to save view settings", error);
  }
}
