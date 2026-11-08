import { describe, expect, it } from "vitest";
import {
  ALL_COMPONENT_MENU_TAB,
  COMPONENT_CATEGORIES,
  COMPONENT_MENU_ENTRIES,
  COMPONENT_TYPE_REGISTRY,
  PLANNED_COMPONENT_MENU_ENTRIES,
  getComponentCategory,
  getComponentMenuEntrySearchText,
  getUncategorizedComponentTypes,
  instructionPalette,
  isComponentMenuEntryActive
} from "../DiagramBuilder";
import type { ComponentMenuEntry } from "../DiagramBuilder";
import { getComponentFamily, getComponentFamilyVariant } from "./componentFamilies";

const EXPECTED_ENTRY_IDS = [
  "ac-source",
  "dc-source",
  "breaker-1p",
  "breaker-2p",
  "fuse",
  "ol-contact",
  "push-button-no",
  "push-button-nc",
  "estop",
  "selector-3pos",
  "switch-1p",
  "notc",
  "noto",
  "nctc",
  "ncto",
  "limit-switch",
  "level-switch",
  "temperature-switch",
  "flow-switch",
  "pressure-switch",
  "xic",
  "xio",
  "motor",
  "light",
  "ote"
] as const;

describe("component category registry", () => {
  it("uses the five requested categories in order, with other last and hidden", () => {
    expect(COMPONENT_CATEGORIES.map((category) => category.id)).toEqual([
      "sources",
      "protection",
      "control",
      "contacts",
      "loads",
      "other"
    ]);
    expect(COMPONENT_CATEGORIES.map((category) => category.label)).toEqual([
      "Sources",
      "Protection devices",
      "Control circuit devices",
      "Contacts",
      "Loads",
      "Other"
    ]);
    expect(COMPONENT_CATEGORIES.map((category) => category.entries)).toEqual([
      ["ac-source", "dc-source"],
      ["breaker-1p", "breaker-2p", "fuse", "ol-contact"],
      [
        "push-button-no",
        "push-button-nc",
        "estop",
        "selector-3pos",
        "switch-1p",
        "notc",
        "noto",
        "nctc",
        "ncto",
        "limit-switch",
        "level-switch",
        "temperature-switch",
        "flow-switch",
        "pressure-switch"
      ],
      ["xic", "xio"],
      ["motor", "light", "ote"],
      []
    ]);

    expect(COMPONENT_CATEGORIES.at(-1)).toMatchObject({ id: "other", entries: [] });
    expect(COMPONENT_MENU_ENTRIES.some((entry) => entry.category === "other")).toBe(false);
  });

  it("exposes All components with every active entry in category-table order", () => {
    expect(ALL_COMPONENT_MENU_TAB).toEqual({ id: "all", label: "All components" });
    expect(COMPONENT_CATEGORIES.filter((category) => category.id !== "other").flatMap((category) => category.entries))
      .toEqual(COMPONENT_MENU_ENTRIES.map((entry) => entry.id));
    expect(COMPONENT_MENU_ENTRIES).toHaveLength(25);
  });

  it("exposes the exact active entry order and leaves planned entries empty", () => {
    expect(COMPONENT_MENU_ENTRIES.map((entry) => entry.id)).toEqual([...EXPECTED_ENTRY_IDS]);
    expect(instructionPalette.map((entry) => entry.id)).toEqual([...EXPECTED_ENTRY_IDS]);
    expect(COMPONENT_MENU_ENTRIES).toHaveLength(25);
    expect(PLANNED_COMPONENT_MENU_ENTRIES).toEqual([]);
    expect(COMPONENT_MENU_ENTRIES.every((entry) => entry.status === "active")).toBe(true);
  });

  it("places every registry type exactly once across primary and alternate entries", () => {
    const covered = COMPONENT_MENU_ENTRIES.flatMap((entry) =>
      entry.altType ? [entry.type, entry.altType] : [entry.type]
    );

    expect(COMPONENT_TYPE_REGISTRY).toHaveLength(27);
    expect(covered).toHaveLength(27);
    expect(new Set(covered).size).toBe(27);
    expect([...covered].sort()).toEqual([...COMPONENT_TYPE_REGISTRY].sort());
    expect(getUncategorizedComponentTypes()).toEqual([]);
  });

  it("keeps OTE in Loads because an existing registry type must remain covered", () => {
    const loads = COMPONENT_CATEGORIES.find((category) => category.id === "loads")!;
    const ote = COMPONENT_MENU_ENTRIES.find((entry) => entry.type === "OTE")!;

    // OTE added to Loads to satisfy each-type-once.
    expect(loads.entries).toContain("ote");
    expect(ote).toMatchObject({ category: "loads", label: "OTE", status: "active" });
  });

  it("activates planned entries only when their type exists in the registry", () => {
    const plannedFuse: ComponentMenuEntry = {
      category: "protection",
      description: "Planned fuse",
      id: "planned-fuse",
      label: "Planned fuse",
      status: "others",
      type: "FUSE"
    };
    const plannedOtl: ComponentMenuEntry = {
      category: "other",
      description: "Planned output latch",
      id: "planned-otl",
      label: "Planned OTL",
      status: "others",
      type: "OTL"
    };

    expect(isComponentMenuEntryActive(plannedFuse)).toBe(true);
    expect(isComponentMenuEntryActive(plannedOtl)).toBe(false);
  });

  it("maps limit and level families to one entry each and both variants to Control", () => {
    for (const familyId of ["LIMIT_SWITCH", "LEVEL_SWITCH"] as const) {
      const entries = COMPONENT_MENU_ENTRIES.filter((entry) => entry.family === familyId);

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        altType: familyId === "LIMIT_SWITCH" ? "LIMIT_SWITCH_NC" : "LEVEL_SWITCH_NC",
        category: "control",
        status: "active",
        type: familyId === "LIMIT_SWITCH" ? "LIMIT_SWITCH_NO" : "LEVEL_SWITCH_NO"
      });
      expect(entries[0]?.label).toBe(familyId === "LIMIT_SWITCH" ? "Limit switch" : "Level switch");
    }

    expect(getComponentCategory("LIMIT_SWITCH_NO")).toBe("control");
    expect(getComponentCategory("LIMIT_SWITCH_NC")).toBe("control");
    expect(getComponentCategory("LEVEL_SWITCH_NO")).toBe("control");
    expect(getComponentCategory("LEVEL_SWITCH_NC")).toBe("control");
    expect(getComponentFamily("LIMIT_SWITCH_NC")?.id).toBe("LIMIT_SWITCH");
    expect(getComponentFamily("LEVEL_SWITCH_NC")?.id).toBe("LEVEL_SWITCH");
    expect(getComponentFamilyVariant("LIMIT_SWITCH_NC")).toBe("nc");
    expect(getComponentFamilyVariant("LEVEL_SWITCH_NO")).toBe("no");
  });

  it("matches palette searches through labels, descriptions, types and aliases", () => {
    const search = (query: string) => instructionPalette
      .filter((entry) => getComponentMenuEntrySearchText(entry).includes(query.toLowerCase()))
      .map((entry) => entry.type);

    expect(search("fuse")).toEqual(["FUSE"]);
    expect(search("level")).toEqual(["LEVEL_SWITCH_NO"]);
    expect(search("timer")).toEqual(["NOTC", "NOTO", "NCTC", "NCTO"]);
    expect(search("off delay")).toEqual(["NOTO", "NCTC"]);
    expect(search("noto")).toEqual(["NOTO"]);
    expect(search("normally open")).toEqual([
      "PUSH_BUTTON_NO",
      "NOTC",
      "NOTO",
      "LIMIT_SWITCH_NO",
      "LEVEL_SWITCH_NO",
      "XIC"
    ]);
    expect(search("light")).toEqual(["LAMP"]);
    expect(search("protection")).toEqual(["BREAKER_1P", "BREAKER_2P", "FUSE", "OL_CONTACT"]);
    expect(search("loads")).toEqual(["MOTOR", "LAMP", "OTE"]);
    expect(search("control circuit devices")).toEqual([
      "PUSH_BUTTON_NO",
      "PUSH_BUTTON_NC",
      "ESTOP",
      "SELECTOR_3POS",
      "SWITCH_1P",
      "NOTC",
      "NOTO",
      "NCTC",
      "NCTO",
      "LIMIT_SWITCH_NO",
      "LEVEL_SWITCH_NO",
      "TEMPERATURE_SWITCH",
      "FLOW_SWITCH",
      "PRESSURE_SWITCH"
    ]);
    expect(getComponentCategory("FUSE")).toBe("protection");
    expect(getComponentCategory("TEMPERATURE_SWITCH")).toBe("control");
    expect(getComponentCategory("FLOW_SWITCH")).toBe("control");
    expect(getComponentCategory("PRESSURE_SWITCH")).toBe("control");
  });
});
