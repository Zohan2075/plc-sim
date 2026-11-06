import { describe, expect, it } from "vitest";
import type { BuilderComponentType } from "../DiagramBuilder";
import {
  isComponentOperable,
  isOperable
} from "./operability";
import type { ComponentOperability } from "./operability";

const expectedTable: Record<BuilderComponentType, ComponentOperability> = {
  POWER_SOURCE: "none",
  DC_SOURCE: "none",
  BREAKER_1P: "none",
  BREAKER_2P: "none",
  SWITCH_1P: "toggle",
  PUSH_BUTTON_NO: "momentary",
  PUSH_BUTTON_NC: "momentary",
  ESTOP: "momentary",
  SELECTOR_3POS: "position",
  LIMIT_SWITCH_NO: "toggle",
  LIMIT_SWITCH_NC: "toggle",
  LEVEL_SWITCH_NO: "toggle",
  LEVEL_SWITCH_NC: "toggle",
  OL_CONTACT: "toggle",
  LAMP: "none",
  MOTOR: "none",
  XIC: "none",
  XIO: "none",
  NOTC: "none",
  NCTO: "none",
  NOTO: "none",
  NCTC: "none",
  OTE: "none",
  OTL: "none",
  OTU: "none"
};

describe("component operability table", () => {
  it("maps every component type to the expected operation mode", () => {
    expect(isOperable).toEqual(expectedTable);

    for (const [type, mode] of Object.entries(expectedTable) as Array<[BuilderComponentType, ComponentOperability]>) {
      expect(isComponentOperable(type)).toBe(mode !== "none");
    }
  });

  it("marks breakers as non-operable and prints the table", () => {
    for (const type of ["BREAKER_1P", "BREAKER_2P"] as const) {
      expect(isOperable[type]).toBe("none");
      expect(isComponentOperable(type)).toBe(false);
    }

    console.log("isOperable table:\n" + JSON.stringify(isOperable, null, 2));
  });
});
