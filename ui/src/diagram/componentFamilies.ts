import type { BuilderComponent, BuilderComponentType } from "../DiagramBuilder";

export type ComponentFamilyVariant = "no" | "nc";

export interface ComponentFamilyDefinition {
  label: string;
  nc: BuilderComponentType;
  no: BuilderComponentType;
}

export const COMPONENT_FAMILIES = {
  LIMIT_SWITCH: {
    label: "Limit switch",
    nc: "LIMIT_SWITCH_NC",
    no: "LIMIT_SWITCH_NO"
  },
  LEVEL_SWITCH: {
    label: "Level switch",
    nc: "LEVEL_SWITCH_NC",
    no: "LEVEL_SWITCH_NO"
  }
} as const satisfies Record<string, ComponentFamilyDefinition>;

export type ComponentFamilyId = keyof typeof COMPONENT_FAMILIES;

export interface ComponentFamilyMatch extends ComponentFamilyDefinition {
  id: ComponentFamilyId;
}

export function getComponentFamily(type: BuilderComponentType): ComponentFamilyMatch | null {
  for (const [id, family] of Object.entries(COMPONENT_FAMILIES) as Array<
    [ComponentFamilyId, ComponentFamilyDefinition]
  >) {
    if (family.no === type || family.nc === type) {
      return { id, ...family };
    }
  }

  return null;
}

export function getComponentFamilyVariant(
  type: BuilderComponentType
): ComponentFamilyVariant | null {
  const family = getComponentFamily(type);

  if (!family) {
    return null;
  }

  return type === family.nc ? "nc" : "no";
}

/**
 * Actuator state, not raw continuity: a normally-open switch is operated when
 * its contact is closed; a normally-closed switch is operated when it is open.
 */
export function getComponentFamilyOperatedState(
  component: BuilderComponent
): boolean | null {
  const family = getComponentFamily(component.type);

  if (!family) {
    return null;
  }

  const closed = component.isClosed ?? (component.type === family.nc);

  return component.type === family.nc ? !closed : closed;
}

export function setComponentFamilyVariant(
  component: BuilderComponent,
  variant: ComponentFamilyVariant
): BuilderComponent {
  const family = getComponentFamily(component.type);

  if (!family) {
    return component;
  }

  const nextType = family[variant];

  if (component.type === nextType) {
    return component;
  }

  // Keep the actuator state: converting NO<->NC flips the continuity flag so a
  // resting NO (open) becomes a resting NC (closed), and vice versa.
  const operated = getComponentFamilyOperatedState(component) ?? false;
  const nextClosed = variant === "nc" ? !operated : operated;

  return { ...component, isClosed: nextClosed, type: nextType };
}
