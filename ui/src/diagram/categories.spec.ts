import { describe, expect, it } from "vitest";
import {
  COMPONENT_CATEGORIES,
  COMPONENT_TYPE_REGISTRY,
  getComponentCategory,
  getUncategorizedComponentTypes,
  instructionPalette
} from "../DiagramBuilder";

describe("component category registry", () => {
  it("places every registry type in exactly one category", () => {
    const categorized = COMPONENT_CATEGORIES.flatMap((category) => [...category.types]);

    expect(COMPONENT_TYPE_REGISTRY).toHaveLength(24);
    expect(categorized).toHaveLength(COMPONENT_TYPE_REGISTRY.length);
    expect(categorized).not.toContain("OTL");
    expect(categorized).not.toContain("OTU");
    expect(new Set(categorized).size).toBe(categorized.length);
    expect([...categorized].sort()).toEqual([...COMPONENT_TYPE_REGISTRY].sort());
    expect(getUncategorizedComponentTypes()).toEqual([]);
  });

  it("keeps the palette order driven by the category table", () => {
    expect(instructionPalette.map((entry) => entry.type)).toEqual(
      COMPONENT_CATEGORIES.flatMap((category) => [...category.types])
    );
    expect(instructionPalette).toHaveLength(24);
    expect(instructionPalette[4]).toMatchObject({ type: "FUSE", category: "protection" });
  });

  it("matches fuse and level searches through palette names/descriptions", () => {
    const search = (query: string) => instructionPalette
      .filter((entry) => `${entry.label} ${entry.description}`.toLowerCase().includes(query))
      .map((entry) => entry.type);

    expect(search("fuse")).toEqual(["FUSE"]);
    expect(search("level")).toEqual(["LEVEL_SWITCH_NO", "LEVEL_SWITCH_NC"]);
    expect(getComponentCategory("FUSE")).toBe("protection");
    expect(getComponentCategory("LEVEL_SWITCH_NO")).toBe("sensors");
    expect(getComponentCategory("LEVEL_SWITCH_NC")).toBe("sensors");
  });
});
