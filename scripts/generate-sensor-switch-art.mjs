import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parsePathBounds } from "./generate-off-delay-level-art.mjs";

const OUTPUT = "ui/src/diagram/sensorSwitchArt.generated.ts";
const PROJECTION_SCALE = 1.25;
const PROJECTION_Y = 11;
const OUTPUT_PITCH = 96 / PROJECTION_SCALE;
const OUTPUT_CENTER_X = 64;
const OUTPUT_CENTER_Y = 30;
const EPSILON = 0.001;

const CLASS_STYLES = {
  "cls-1": { fill: "#153047", stroke: "none", strokeWidth: 0 },
  "cls-2": { fill: "#ffffff", stroke: "#153047", strokeWidth: 4.375, linecap: "round", linejoin: "round" },
  "cls-3": { fill: "none", stroke: "#153047", strokeWidth: 4.375, linecap: "round", linejoin: "round" }
};

const SOURCES = [
  {
    type: "TEMPERATURE_SWITCH",
    source: "reference/Temperature switch.svg",
    openRange: [5, 10],
    closedRange: [0, 5]
  },
  {
    type: "FLOW_SWITCH",
    source: "reference/Flow switch.svg",
    openRange: [5, 10],
    closedRange: [0, 5]
  },
  {
    type: "PRESSURE_SWITCH",
    source: "reference/Pressure switch.svg",
    openRange: [0, 5],
    closedRange: [5, 10]
  }
];

function readSvgElements(sourcePath) {
  const raw = readFileSync(sourcePath, "utf8");
  return [...raw.matchAll(/<(path|circle|line)\b[^>]*\/>/g)].map((match, index) => {
    const attrs = {};
    for (const attr of match[0].matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)) {
      attrs[attr[1]] = attr[2];
    }
    return { index, tag: match[1], attrs };
  });
}

function styleOf(element) {
  return CLASS_STYLES[element.attrs.class] ?? {
    fill: element.attrs.fill ?? "none",
    stroke: element.attrs.stroke ?? "none",
    strokeWidth: Number(element.attrs["stroke-width"] ?? 0) || 0
  };
}

function elementStrokeWidth(element) {
  return styleOf(element).strokeWidth;
}

function elementSourceBounds(element, source, type) {
  const strokeWidth = elementStrokeWidth(element);
  const half = strokeWidth / 2;

  if (element.tag === "circle") {
    const cx = Number(element.attrs.cx);
    const cy = Number(element.attrs.cy);
    const r = Number(element.attrs.r);
    return { bottom: cy + r + half, left: cx - r - half, right: cx + r + half, top: cy - r - half };
  }

  if (element.tag === "line") {
    const x1 = Number(element.attrs.x1);
    const y1 = Number(element.attrs.y1);
    const x2 = Number(element.attrs.x2);
    const y2 = Number(element.attrs.y2);
    return {
      bottom: Math.max(y1, y2) + half,
      left: Math.min(x1, x2) - half,
      right: Math.max(x1, x2) + half,
      top: Math.min(y1, y2) - half
    };
  }

  return parsePathBounds(element.attrs.d, `${source} ${type} element ${element.index}`, strokeWidth);
}

function ringFromElement(element, source, type) {
  const style = styleOf(element);
  const bounds = elementSourceBounds(element, source, type);

  return {
    center: { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 },
    outerRadius: (bounds.right - bounds.left + bounds.bottom - bounds.top) / 4,
    strokeWidth: style.strokeWidth
  };
}

function emptyBounds() {
  return { bottom: -Infinity, left: Infinity, right: -Infinity, top: Infinity };
}

function includePoint(bounds, point) {
  bounds.left = Math.min(bounds.left, point.x);
  bounds.top = Math.min(bounds.top, point.y);
  bounds.right = Math.max(bounds.right, point.x);
  bounds.bottom = Math.max(bounds.bottom, point.y);
}

function unionBounds(target, source) {
  target.left = Math.min(target.left, source.left);
  target.top = Math.min(target.top, source.top);
  target.right = Math.max(target.right, source.right);
  target.bottom = Math.max(target.bottom, source.bottom);
}

function transformBounds(bounds, scale, translateX, translateY) {
  return {
    bottom: bounds.bottom * scale + translateY,
    left: bounds.left * scale + translateX,
    right: bounds.right * scale + translateX,
    top: bounds.top * scale + translateY
  };
}

function projectBounds(bounds) {
  return {
    bottom: (bounds.bottom * PROJECTION_SCALE) + PROJECTION_Y,
    left: bounds.left * PROJECTION_SCALE,
    right: bounds.right * PROJECTION_SCALE,
    top: (bounds.top * PROJECTION_SCALE) + PROJECTION_Y
  };
}

function buildSymbol(type, elements, source) {
  const ringElements = elements.filter((element) => (
    element.tag === "circle"
    || (element.tag === "path" && element.attrs.class === "cls-2")
  ));

  if (ringElements.length !== 2) {
    throw new Error(`${type}: expected 2 ring elements, found ${ringElements.length}`);
  }

  const rings = ringElements
    .map((element) => ringFromElement(element, source, type))
    .sort((left, right) => left.center.x - right.center.x);

  const [left, right] = rings;
  const scale = OUTPUT_PITCH / (right.center.x - left.center.x);
  const translateX = OUTPUT_CENTER_X - ((left.center.x + right.center.x) / 2) * scale;
  const translateY = OUTPUT_CENTER_Y - ((left.center.y + right.center.y) / 2) * scale;
  const transform = `translate(${translateX.toFixed(8)} ${translateY.toFixed(8)}) scale(${scale.toFixed(8)})`;
  const ringCenters = rings.map((ring) => ({
    x: ring.center.x * scale + translateX,
    y: ring.center.y * scale + translateY
  }));
  const ringRadii = rings.map((ring) => ring.outerRadius * scale * PROJECTION_SCALE);
  const underDiscRadius = Math.max(
    ...rings.map((ring) => Math.max(0, ring.outerRadius - ring.strokeWidth / 2) * scale * 1.05)
  );
  const localBounds = emptyBounds();

  for (const element of elements) {
    unionBounds(localBounds, transformBounds(
      elementSourceBounds(element, source, type),
      scale,
      translateX,
      translateY
    ));
  }

  for (const center of ringCenters) {
    unionBounds(localBounds, {
      bottom: center.y + underDiscRadius,
      left: center.x - underDiscRadius,
      right: center.x + underDiscRadius,
      top: center.y - underDiscRadius
    });
  }

  const tightBounds = projectBounds(localBounds);

  return {
    elements: elements.map((element) => {
      const style = styleOf(element);
      const isRing = element.tag === "circle"
        || (element.tag === "path" && element.attrs.class === "cls-2");

      if (element.tag === "circle") {
        return {
          tag: "circle",
          cx: Number(element.attrs.cx),
          cy: Number(element.attrs.cy),
          r: Number(element.attrs.r),
          fill: "#ffffff",
          stroke: "currentColor",
          strokeWidth: style.strokeWidth,
          ...(style.linecap ? { strokeLinecap: style.linecap } : {}),
          ...(style.linejoin ? { strokeLinejoin: style.linejoin } : {})
        };
      }

      if (element.tag === "line") {
        return {
          tag: "line",
          x1: Number(element.attrs.x1),
          y1: Number(element.attrs.y1),
          x2: Number(element.attrs.x2),
          y2: Number(element.attrs.y2),
          fill: "none",
          stroke: "currentColor",
          strokeWidth: style.strokeWidth,
          ...(style.linecap ? { strokeLinecap: style.linecap } : {}),
          ...(style.linejoin ? { strokeLinejoin: style.linejoin } : {})
        };
      }

      return {
        tag: "path",
        d: element.attrs.d,
        fill: isRing ? "#ffffff" : "currentColor",
        stroke: isRing ? "currentColor" : "none",
        ...(isRing ? { strokeWidth: style.strokeWidth } : {}),
        ...(style.linecap ? { strokeLinecap: style.linecap } : {}),
        ...(style.linejoin ? { strokeLinejoin: style.linejoin } : {}),
        ...(element.attrs["fill-rule"] ? { fillRule: element.attrs["fill-rule"] } : {})
      };
    }),
    ringCenters,
    ringRadii,
    scale,
    strokeWidth: 0,
    tightBounds,
    localBounds,
    transform,
    underDiscRadius
  };
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

const artifacts = [];

for (const definition of SOURCES) {
  const elements = readSvgElements(definition.source);
  if (elements.length !== 10) {
    throw new Error(`${definition.source}: expected 10 elements, found ${elements.length}`);
  }

  const openElements = elements.slice(definition.openRange[0], definition.openRange[1]);
  const closedElements = elements.slice(definition.closedRange[0], definition.closedRange[1]);
  artifacts.push({
    type: definition.type,
    source: definition.source,
    open: buildSymbol(definition.type, openElements, definition.source),
    closed: buildSymbol(definition.type, closedElements, definition.source)
  });
}

const lines = [
  "/* This file is generated by scripts/generate-sensor-switch-art.mjs. */",
  "/* Sources: reference/Temperature switch.svg, reference/Flow switch.svg, reference/Pressure switch.svg. */",
  "/* Original element geometry preserved; each type has open and closed states. */",
  "",
  "export interface SensorSwitchGeneratedElement {",
  "  d?: string;",
  '  tag?: "path" | "circle" | "line";',
  "  cx?: number;",
  "  cy?: number;",
  "  r?: number;",
  "  x1?: number;",
  "  y1?: number;",
  "  x2?: number;",
  "  y2?: number;",
  "  fill?: string;",
  '  fillRule?: "evenodd" | "nonzero";',
  "  stroke?: string;",
  "  strokeWidth?: number;",
  '  strokeLinecap?: "butt" | "round" | "square";',
  '  strokeLinejoin?: "miter" | "round" | "bevel";',
  "}",
  "",
  "export interface SensorSwitchGeneratedPoint {",
  "  x: number;",
  "  y: number;",
  "}",
  "",
  "export interface SensorSwitchGeneratedBounds {",
  "  bottom: number;",
  "  left: number;",
  "  right: number;",
  "  top: number;",
  "}",
  "",
  "export interface SensorSwitchGeneratedSymbol {",
  "  elements: readonly SensorSwitchGeneratedElement[];",
  "  ringCenters: readonly [SensorSwitchGeneratedPoint, SensorSwitchGeneratedPoint];",
  "  ringRadii: readonly [number, number];",
  "  scale: number;",
  "  strokeWidth: number;",
  "  tightBounds: SensorSwitchGeneratedBounds;",
  "  localBounds: SensorSwitchGeneratedBounds;",
  "  transform: string;",
  "  underDiscRadius: number;",
  "}",
  "",
  "export const SENSOR_SWITCH_ART: {",
  "  TEMPERATURE_SWITCH: { open: SensorSwitchGeneratedSymbol; closed: SensorSwitchGeneratedSymbol };",
  "  FLOW_SWITCH: { open: SensorSwitchGeneratedSymbol; closed: SensorSwitchGeneratedSymbol };",
  "  PRESSURE_SWITCH: { open: SensorSwitchGeneratedSymbol; closed: SensorSwitchGeneratedSymbol };",
  "} = {"
];

for (const artifact of artifacts) {
  lines.push(`  ${artifact.type}: {`);
  for (const state of ["open", "closed"]) {
    const symbol = artifact[state];
    lines.push(`    ${state}: {`);
    lines.push(`      transform: ${JSON.stringify(symbol.transform)},`);
    lines.push(`      scale: ${symbol.scale},`);
    lines.push(`      strokeWidth: ${symbol.strokeWidth},`);
    lines.push(`      ringCenters: [${symbol.ringCenters.map((point) => JSON.stringify(point)).join(", ")}],`);
    lines.push(`      ringRadii: [${symbol.ringRadii.join(", ")}],`);
    lines.push(`      underDiscRadius: ${symbol.underDiscRadius},`);
    lines.push(`      tightBounds: ${JSON.stringify(symbol.tightBounds)},`);
    lines.push(`      localBounds: ${JSON.stringify(symbol.localBounds)},`);
    lines.push("      elements: [");
    for (const element of symbol.elements) {
      const fields = [];
      if (element.tag) fields.push(`tag: ${JSON.stringify(element.tag)}`);
      if (element.d) fields.push(`d: ${JSON.stringify(element.d)}`);
      if (element.cx !== undefined) fields.push(`cx: ${element.cx}`);
      if (element.cy !== undefined) fields.push(`cy: ${element.cy}`);
      if (element.r !== undefined) fields.push(`r: ${element.r}`);
      if (element.x1 !== undefined) fields.push(`x1: ${element.x1}`);
      if (element.y1 !== undefined) fields.push(`y1: ${element.y1}`);
      if (element.x2 !== undefined) fields.push(`x2: ${element.x2}`);
      if (element.y2 !== undefined) fields.push(`y2: ${element.y2}`);
      if (element.fill) fields.push(`fill: ${JSON.stringify(element.fill)}`);
      if (element.fillRule) fields.push(`fillRule: ${JSON.stringify(element.fillRule)}`);
      if (element.stroke) fields.push(`stroke: ${JSON.stringify(element.stroke)}`);
      if (element.strokeWidth !== undefined) fields.push(`strokeWidth: ${element.strokeWidth}`);
      if (element.strokeLinecap) fields.push(`strokeLinecap: ${JSON.stringify(element.strokeLinecap)}`);
      if (element.strokeLinejoin) fields.push(`strokeLinejoin: ${JSON.stringify(element.strokeLinejoin)}`);
      lines.push(`        { ${fields.join(", ")} },`);
    }
    lines.push("      ],");
    lines.push("    },");
  }
  lines.push("  },");
}
lines.push("};");
lines.push("");
writeFileSync(OUTPUT, lines.join("\n"));

for (const artifact of artifacts) {
  for (const state of ["open", "closed"]) {
    const symbol = artifact[state];
    console.log(`${artifact.type}.${state}: elements=${symbol.elements.length} transform=${symbol.transform} ringCenters=${JSON.stringify(symbol.ringCenters)} tight=${JSON.stringify(symbol.tightBounds)}`);
    symbol.elements.forEach((element, index) => {
      const serialized = element.d ?? JSON.stringify(element);
      console.log(`  ${index}: ${rackHash(serialized)} ${serialized.length}`);
    });
  }
}

function rackHash(value) {
  return hash(value).slice(0, 16);
}
