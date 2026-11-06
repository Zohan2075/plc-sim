import type { BuilderComponentType } from "../DiagramBuilder";

export type ComponentOperability = "toggle" | "momentary" | "position" | "none";

export const isOperable: Record<BuilderComponentType, ComponentOperability> = {
  POWER_SOURCE: "none",
  DC_SOURCE: "none",
  BREAKER_1P: "none",
  BREAKER_2P: "none",
  FUSE: "none",
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

export function isComponentOperable(type: BuilderComponentType): boolean {
  return isOperable[type] !== "none";
}
