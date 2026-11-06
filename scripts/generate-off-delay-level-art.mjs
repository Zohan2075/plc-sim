import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OFF_SOURCE = "reference/Off delays contacts (on and off).svg";
const LEVEL_SOURCE = "reference/Liquid level switch (on and off).svg";
const OFF_OUT = "ui/src/diagram/offDelayArt.generated.ts";
const LEVEL_OUT = "ui/src/diagram/levelSwitchArt.generated.ts";
const OFF_OUTPUT_PITCH = 96 / 1.25;
const LEVEL_OUTPUT_PITCH = 90 / 1.25;
const OUTPUT_CENTER_X = 64;
const OUTPUT_CENTER_Y = 30;
const OUTPUT_PROJECTION_SCALE = 1.25;
const OUTPUT_PROJECTION_Y = 11;
const OUTPUT_STROKE_BAND = 1;
const OUTPUT_UNDER_DISC_RADIUS = 14 * 0.75;
const STROKE_MITER_LIMIT = 4;
const BOUNDS_SAMPLES = 256;
const EPSILON = 1e-10;

function fail(context, message) {
  throw new Error(`${context}: ${message}`);
}

function tokenizePathData(pathData, context = "SVG path") {
  const tokens = [];
  const numberPattern = /[-+]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][-+]?\d+)?/y;
  let index = 0;

  while (index < pathData.length) {
    if (/[\s,]/.test(pathData[index] ?? "")) {
      index += 1;
      continue;
    }

    const character = pathData[index];

    if (/[a-zA-Z]/.test(character ?? "")) {
      if (!"MLCZ".includes(character)) {
        fail(context, `unsupported command ${JSON.stringify(character)} at character ${index}`);
      }
      tokens.push({ type: "command", value: character, index });
      index += 1;
      continue;
    }

    numberPattern.lastIndex = index;
    const match = numberPattern.exec(pathData);

    if (!match) {
      fail(context, `invalid token at character ${index}`);
    }

    const value = Number(match[0]);

    if (!Number.isFinite(value)) {
      fail(context, `non-finite number at character ${index}`);
    }

    tokens.push({ type: "number", value, index });
    index = numberPattern.lastIndex;
  }

  return tokens;
}

function parsePathData(pathData, context = "SVG path") {
  const tokens = tokenizePathData(pathData, context);
  const subpaths = [];
  let tokenIndex = 0;
  let command = null;
  let current = null;
  let activeSubpath = null;

  const finishSubpath = () => {
    if (activeSubpath) {
      subpaths.push(activeSubpath);
      activeSubpath = null;
    }
  };

  const readNumber = (expected) => {
    const token = tokens[tokenIndex];

    if (!token || token.type !== "number") {
      fail(context, `malformed ${command} tuple: expected ${expected} at token ${tokenIndex}`);
    }

    tokenIndex += 1;
    return token.value;
  };

  while (tokenIndex < tokens.length) {
    const token = tokens[tokenIndex];

    if (token?.type === "command") {
      command = token.value;
      tokenIndex += 1;

      if (command === "Z") {
        if (!activeSubpath || !current) {
          fail(context, `Z without an open subpath at character ${token.index}`);
        }

        if (current.x !== activeSubpath.start.x || current.y !== activeSubpath.start.y) {
          activeSubpath.segments.push({
            kind: "line",
            p0: current,
            p1: activeSubpath.start
          });
        }
        activeSubpath.closed = true;
        current = activeSubpath.start;
        command = null;
      }

      continue;
    }

    if (!command) {
      fail(context, `number without a command at token ${tokenIndex}`);
    }

    if (command === "M") {
      const x = readNumber("x/y pair");
      const y = readNumber("x/y pair");
      finishSubpath();
      current = { x, y };
      activeSubpath = { closed: false, segments: [], start: current };
      command = "L";
      continue;
    }

    if (!activeSubpath || !current) {
      fail(context, `${command} before M at token ${tokenIndex}`);
    }

    if (command === "L") {
      const x = readNumber("x/y pair");
      const y = readNumber("x/y pair");
      const next = { x, y };
      activeSubpath.segments.push({ kind: "line", p0: current, p1: next });
      current = next;
      continue;
    }

    if (command === "C") {
      const p1 = { x: readNumber("six-value cubic tuple"), y: readNumber("six-value cubic tuple") };
      const p2 = { x: readNumber("six-value cubic tuple"), y: readNumber("six-value cubic tuple") };
      const p3 = { x: readNumber("six-value cubic tuple"), y: readNumber("six-value cubic tuple") };
      activeSubpath.segments.push({ kind: "cubic", p0: current, p1, p2, p3 });
      current = p3;
      continue;
    }

    fail(context, `unsupported command ${JSON.stringify(command)}`);
  }

  finishSubpath();
  return subpaths;
}

function pointOnSegment(segment, t) {
  if (segment.kind === "line") {
    return {
      x: segment.p0.x + (segment.p1.x - segment.p0.x) * t,
      y: segment.p0.y + (segment.p1.y - segment.p0.y) * t
    };
  }

  const inverse = 1 - t;
  const a = inverse * inverse * inverse;
  const b = 3 * inverse * inverse * t;
  const c = 3 * inverse * t * t;
  const d = t * t * t;

  return {
    x: a * segment.p0.x + b * segment.p1.x + c * segment.p2.x + d * segment.p3.x,
    y: a * segment.p0.y + b * segment.p1.y + c * segment.p2.y + d * segment.p3.y
  };
}

function segmentTangent(segment, t) {
  if (segment.kind === "line") {
    return { x: segment.p1.x - segment.p0.x, y: segment.p1.y - segment.p0.y };
  }

  const inverse = 1 - t;
  return {
    x: 3 * inverse * inverse * (segment.p1.x - segment.p0.x)
      + 6 * inverse * t * (segment.p2.x - segment.p1.x)
      + 3 * t * t * (segment.p3.x - segment.p2.x),
    y: 3 * inverse * inverse * (segment.p1.y - segment.p0.y)
      + 6 * inverse * t * (segment.p2.y - segment.p1.y)
      + 3 * t * t * (segment.p3.y - segment.p2.y)
  };
}

function cubicCoordinateRoots(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;

  if (Math.abs(a) < EPSILON) {
    return Math.abs(b) < EPSILON ? [] : [-c / b];
  }

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return [];
  }

  const root = Math.sqrt(Math.max(0, discriminant));
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)];
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

function segmentExactBounds(segment) {
  const bounds = emptyBounds();
  includePoint(bounds, segment.p0);
  includePoint(bounds, segment.kind === "line" ? segment.p1 : segment.p3);

  if (segment.kind === "cubic") {
    const endpoint = segment.p3;

    for (const t of [
      ...cubicCoordinateRoots(segment.p0.x, segment.p1.x, segment.p2.x, endpoint.x),
      ...cubicCoordinateRoots(segment.p0.y, segment.p1.y, segment.p2.y, endpoint.y)
    ]) {
      if (t > 0 && t < 1) {
        includePoint(bounds, pointOnSegment(segment, t));
      }
    }
  }

  return bounds;
}

function subpathExactBounds(subpath) {
  const bounds = emptyBounds();

  if (subpath.segments.length === 0) {
    includePoint(bounds, subpath.start);
  }

  for (const segment of subpath.segments) {
    unionBounds(bounds, segmentExactBounds(segment));
  }

  return bounds;
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y);
  return length > EPSILON ? { x: vector.x / length, y: vector.y / length } : null;
}

function segmentDirection(segment, atEnd) {
  const tangent = segmentTangent(segment, atEnd ? 1 : 0);
  const normalized = normalize(tangent);

  if (normalized) {
    return normalized;
  }

  return segment.kind === "line"
    ? normalize({ x: segment.p1.x - segment.p0.x, y: segment.p1.y - segment.p0.y })
    : normalize(atEnd
      ? { x: segment.p3.x - segment.p2.x, y: segment.p3.y - segment.p2.y }
      : { x: segment.p1.x - segment.p0.x, y: segment.p1.y - segment.p0.y });
}

function includeJoinBounds(bounds, vertex, incoming, outgoing, radius, miterLimit) {
  const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;

  if (Math.abs(cross) < EPSILON) {
    return;
  }

  for (const side of [-1, 1]) {
    const n1 = { x: -incoming.y * side, y: incoming.x * side };
    const n2 = { x: -outgoing.y * side, y: outgoing.x * side };
    const p1 = { x: vertex.x + n1.x * radius, y: vertex.y + n1.y * radius };
    const p2 = { x: vertex.x + n2.x * radius, y: vertex.y + n2.y * radius };
    const t = ((p2.x - p1.x) * outgoing.y - (p2.y - p1.y) * outgoing.x) / cross;
    const miter = { x: p1.x + incoming.x * t, y: p1.y + incoming.y * t };
    const miterRatio = Math.hypot(miter.x - vertex.x, miter.y - vertex.y) / (2 * radius);

    if (Number.isFinite(miterRatio) && miterRatio <= miterLimit) {
      includePoint(bounds, miter);
    } else {
      includePoint(bounds, p1);
      includePoint(bounds, p2);
    }
  }
}

function strokedSubpathBounds(subpath, strokeWidth) {
  const bounds = subpathExactBounds(subpath);
  const radius = strokeWidth / 2;

  if (radius <= 0 || subpath.segments.length === 0) {
    return bounds;
  }

  for (const segment of subpath.segments) {
    for (let index = 0; index <= BOUNDS_SAMPLES; index += 1) {
      const t = index / BOUNDS_SAMPLES;
      let tangent = normalize(segmentTangent(segment, t));

      if (!tangent && segment.kind === "cubic") {
        const delta = 1 / BOUNDS_SAMPLES;
        const before = pointOnSegment(segment, Math.max(0, t - delta));
        const after = pointOnSegment(segment, Math.min(1, t + delta));
        tangent = normalize({ x: after.x - before.x, y: after.y - before.y });
      }

      if (!tangent) {
        continue;
      }

      const point = pointOnSegment(segment, t);
      const normal = { x: -tangent.y * radius, y: tangent.x * radius };
      includePoint(bounds, { x: point.x + normal.x, y: point.y + normal.y });
      includePoint(bounds, { x: point.x - normal.x, y: point.y - normal.y });
    }
  }

  for (let index = 1; index < subpath.segments.length; index += 1) {
    const incomingSegment = subpath.segments[index - 1];
    const outgoingSegment = subpath.segments[index];
    const incoming = incomingSegment && segmentDirection(incomingSegment, true);
    const outgoing = outgoingSegment && segmentDirection(outgoingSegment, false);

    if (incoming && outgoing && outgoingSegment) {
      includeJoinBounds(bounds, outgoingSegment.p0, incoming, outgoing, radius, STROKE_MITER_LIMIT);
    }
  }

  if (subpath.closed && subpath.segments.length > 1) {
    const incomingSegment = subpath.segments[subpath.segments.length - 1];
    const outgoingSegment = subpath.segments[0];
    const incoming = incomingSegment && segmentDirection(incomingSegment, true);
    const outgoing = outgoingSegment && segmentDirection(outgoingSegment, false);

    if (incoming && outgoing) {
      includeJoinBounds(bounds, subpath.start, incoming, outgoing, radius, STROKE_MITER_LIMIT);
    }
  }

  return bounds;
}

export function parsePathBounds(pathData, context = "SVG path", strokeWidth = 0) {
  const bounds = emptyBounds();
  const subpaths = parsePathData(pathData, context);

  for (const subpath of subpaths) {
    unionBounds(bounds, strokedSubpathBounds(subpath, strokeWidth));
  }

  if (!Number.isFinite(bounds.left)) {
    fail(context, "path contains no geometry");
  }

  return bounds;
}

function readPaths(path) {
  const raw = readFileSync(path, "utf8");
  const matches = [...raw.matchAll(/<path\b[^>]*\/>/g)].map((match) => match[0]);

  return matches.map((element, index) => {
    const d = /d="([^"]*)"/.exec(element)?.[1];
    const fillRule = /fill-rule="([^"]*)"/.exec(element)?.[1];

    if (!d) {
      throw new Error(`Path ${index} in ${path} has no d attribute`);
    }

    return {
      d,
      ...(fillRule ? { fillRule } : {}),
      index
    };
  });
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function transformBounds(bounds, scale, translateX, translateY) {
  return {
    bottom: (bounds.bottom * scale + translateY) * OUTPUT_PROJECTION_SCALE + OUTPUT_PROJECTION_Y,
    left: (bounds.left * scale + translateX) * OUTPUT_PROJECTION_SCALE,
    right: (bounds.right * scale + translateX) * OUTPUT_PROJECTION_SCALE,
    top: (bounds.top * scale + translateY) * OUTPUT_PROJECTION_SCALE + OUTPUT_PROJECTION_Y
  };
}

function findRingRadius(paths, ringCenter, context) {
  const candidates = [];

  for (const { d, index } of paths) {
    for (const subpath of parsePathData(d, `${context} path ${index}`)) {
      if (!subpath.closed || subpath.segments.length < 4) {
        continue;
      }

      const bounds = subpathExactBounds(subpath);
      const width = bounds.right - bounds.left;
      const height = bounds.bottom - bounds.top;
      const center = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
      const centerError = Math.hypot(center.x - ringCenter.x, center.y - ringCenter.y);
      const roundnessError = Math.abs(width - height);

      if (centerError < 2 && width > 0 && height > 0 && roundnessError < Math.max(width, height) * 0.12) {
        candidates.push({ centerError, radius: (width + height) / 4, roundnessError });
      }
    }
  }

  candidates.sort((left, right) => left.centerError - right.centerError || left.roundnessError - right.roundnessError);
  const candidate = candidates[0];

  if (!candidate) {
    fail(context, `could not derive a terminal ring radius near (${ringCenter.x}, ${ringCenter.y})`);
  }

  return candidate.radius;
}

function buildSymbol(type, paths, left, right, source) {
  const scale = OUTPUT_PITCH / (right.x - left.x);
  const translateX = OUTPUT_CENTER_X - ((left.x + right.x) / 2) * scale;
  const translateY = OUTPUT_CENTER_Y - ((left.y + right.y) / 2) * scale;
  const transform = `translate(${translateX.toFixed(8)} ${translateY.toFixed(8)}) scale(${scale.toFixed(8)})`;
  const strokeWidth = OUTPUT_STROKE_BAND / (scale * OUTPUT_PROJECTION_SCALE);
  const ringCenters = [left, right].map((center) => ({
    x: center.x * scale + translateX,
    y: center.y * scale + translateY
  }));
  const ringRadii = [left, right].map((center) => (
    findRingRadius(paths, center, `${source} ${type}`) * scale * OUTPUT_PROJECTION_SCALE
      + OUTPUT_STROKE_BAND / 2
  ));
  const tightBounds = emptyBounds();

  for (const { d, index } of paths) {
    const sourceBounds = parsePathBounds(d, `${source} ${type} path ${index}`, strokeWidth);
    unionBounds(tightBounds, transformBounds(sourceBounds, scale, translateX, translateY));
  }

  for (const center of ringCenters) {
    const projectedCenter = {
      x: center.x * OUTPUT_PROJECTION_SCALE,
      y: center.y * OUTPUT_PROJECTION_SCALE + OUTPUT_PROJECTION_Y
    };
    const projectedRadius = OUTPUT_UNDER_DISC_RADIUS * OUTPUT_PROJECTION_SCALE;
    unionBounds(tightBounds, {
      bottom: projectedCenter.y + projectedRadius,
      left: projectedCenter.x - projectedRadius,
      right: projectedCenter.x + projectedRadius,
      top: projectedCenter.y - projectedRadius
    });
  }

  return {
    elements: paths.map(({ d, fillRule }) => ({
      d,
      ...(fillRule ? { fillRule } : {})
    })),
    ringCenters,
    ringRadii,
    scale,
    strokeWidth,
    tightBounds,
    transform,
    type,
    underDiscRadius: OUTPUT_UNDER_DISC_RADIUS
  };
}

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

function elementStrokeWidth(element) {
  return Number(element.attrs["stroke-width"] ?? 0) || 0;
}

function elementSourceBounds(element, source, type) {
  const strokeWidth = elementStrokeWidth(element);

  if (element.tag === "circle") {
    const cx = Number(element.attrs.cx);
    const cy = Number(element.attrs.cy);
    const r = Number(element.attrs.r);
    const half = strokeWidth / 2;
    return { bottom: cy + r + half, left: cx - r - half, right: cx + r + half, top: cy - r - half };
  }

  if (element.tag === "line") {
    const x1 = Number(element.attrs.x1);
    const y1 = Number(element.attrs.y1);
    const x2 = Number(element.attrs.x2);
    const y2 = Number(element.attrs.y2);
    const half = strokeWidth / 2;
    return {
      bottom: Math.max(y1, y2) + half,
      left: Math.min(x1, x2) - half,
      right: Math.max(x1, x2) + half,
      top: Math.min(y1, y2) - half
    };
  }

  return parsePathBounds(
    element.attrs.d,
    `${source} ${type} element ${element.index}`,
    strokeWidth
  );
}

function ringFromElement(element, source, type) {
  const strokeWidth = elementStrokeWidth(element);
  const bounds = elementSourceBounds(element, source, type);

  return {
    center: { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 },
    outerRadius: (bounds.right - bounds.left + bounds.bottom - bounds.top) / 4,
    strokeWidth
  };
}

function buildElementSymbol(type, elements, leftElement, rightElement, source, outputPitch) {
  const leftRing = ringFromElement(leftElement, source, type);
  const rightRing = ringFromElement(rightElement, source, type);
  const rings = [leftRing, rightRing].sort((left, right) => left.center.x - right.center.x);
  const left = rings[0];
  const right = rings[1];
  const scale = outputPitch / (right.center.x - left.center.x);
  const translateX = OUTPUT_CENTER_X - ((left.center.x + right.center.x) / 2) * scale;
  const translateY = OUTPUT_CENTER_Y - ((left.center.y + right.center.y) / 2) * scale;
  const transform = `translate(${translateX.toFixed(8)} ${translateY.toFixed(8)}) scale(${scale.toFixed(8)})`;
  const ringCenters = rings.map((ring) => ({
    x: ring.center.x * scale + translateX,
    y: ring.center.y * scale + translateY
  }));
  const ringRadii = rings.map((ring) => ring.outerRadius * scale * OUTPUT_PROJECTION_SCALE);
  const underDiscRadius = Math.max(
    ...rings.map((ring) => (ring.outerRadius - ring.strokeWidth / 2) * scale * 1.05)
  );
  const tightBounds = emptyBounds();

  for (const element of elements) {
    const sourceBounds = elementSourceBounds(element, source, type);
    unionBounds(tightBounds, transformBounds(sourceBounds, scale, translateX, translateY));
  }

  for (const center of ringCenters) {
    const projectedCenter = {
      x: center.x * OUTPUT_PROJECTION_SCALE,
      y: center.y * OUTPUT_PROJECTION_SCALE + OUTPUT_PROJECTION_Y
    };
    const projectedRadius = underDiscRadius * OUTPUT_PROJECTION_SCALE;
    unionBounds(tightBounds, {
      bottom: projectedCenter.y + projectedRadius,
      left: projectedCenter.x - projectedRadius,
      right: projectedCenter.x + projectedRadius,
      top: projectedCenter.y - projectedRadius
    });
  }

  return {
    elements: elements.map((element) => {
      const strokeWidth = elementStrokeWidth(element);
      const fill = element.attrs.fill;
      const isWhiteRing = element.tag === "circle" || fill === "#ffffff";

      if (element.tag === "circle") {
        return {
          tag: "circle",
          cx: Number(element.attrs.cx),
          cy: Number(element.attrs.cy),
          r: Number(element.attrs.r),
          fill: "#ffffff",
          stroke: "currentColor",
          strokeWidth
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
          strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round"
        };
      }

      return {
        tag: "path",
        d: element.attrs.d,
        fill: isWhiteRing ? "#ffffff" : "currentColor",
        stroke: isWhiteRing ? "currentColor" : "none",
        ...(isWhiteRing ? { strokeWidth } : {}),
        ...(element.attrs["fill-rule"] ? { fillRule: element.attrs["fill-rule"] } : {})
      };
    }),
    ringCenters,
    ringRadii,
    scale,
    strokeWidth: 0,
    tightBounds,
    transform,
    type,
    underDiscRadius
  };
}

function emit(moduleName, symbols, source, note, outputPath, artifactType) {
  const lines = [
    "/* This file is generated by scripts/generate-off-delay-level-art.mjs. */",
    `/* Source: ${source} */`,
    `/* ${note} */`,
    "",
    "export interface GeneratedSymbolElement {",
    "  d?: string;",
    "  tag?: \"path\" | \"circle\" | \"line\";",
    "  cx?: number;",
    "  cy?: number;",
    "  r?: number;",
    "  x1?: number;",
    "  y1?: number;",
    "  x2?: number;",
    "  y2?: number;",
    "  fill?: string;",
    "  fillRule?: \"evenodd\" | \"nonzero\";",
    "  stroke?: string;",
    "  strokeWidth?: number;",
    "  strokeLinecap?: \"butt\" | \"round\" | \"square\";",
    "  strokeLinejoin?: \"miter\" | \"round\" | \"bevel\";",
    "}",
    "",
    "export interface GeneratedSymbolPoint {",
    "  x: number;",
    "  y: number;",
    "}",
    "",
    "export interface GeneratedSymbolBounds {",
    "  bottom: number;",
    "  left: number;",
    "  right: number;",
    "  top: number;",
    "}",
    "",
    "export interface GeneratedSymbol {",
    "  elements: readonly GeneratedSymbolElement[];",
    "  ringCenters: readonly [GeneratedSymbolPoint, GeneratedSymbolPoint];",
    "  ringRadii: readonly [number, number];",
    "  scale: number;",
    "  strokeWidth: number;",
    "  tightBounds: GeneratedSymbolBounds;",
    "  transform: string;",
    "  underDiscRadius: number;",
    "}",
    "",
    `export const ${moduleName}: ${artifactType} = {`
  ];

  for (const symbol of symbols) {
    lines.push(`  ${symbol.type}: {`);
    lines.push(`    transform: ${JSON.stringify(symbol.transform)},`);
    lines.push(`    scale: ${symbol.scale},`);
    lines.push(`    strokeWidth: ${symbol.strokeWidth},`);
    lines.push(`    ringCenters: ${JSON.stringify(symbol.ringCenters)},`);
    lines.push(`    ringRadii: ${JSON.stringify(symbol.ringRadii)},`);
    lines.push(`    underDiscRadius: ${symbol.underDiscRadius},`);
    lines.push(`    tightBounds: ${JSON.stringify(symbol.tightBounds)},`);
    lines.push("    elements: [");
    for (const element of symbol.elements) {
      const fields = [];
      if (element.tag === "circle") {
        fields.push(`tag: "circle"`);
        fields.push(`cx: ${element.cx}`);
        fields.push(`cy: ${element.cy}`);
        fields.push(`r: ${element.r}`);
        fields.push(`fill: ${JSON.stringify(element.fill)}`);
        fields.push(`stroke: ${JSON.stringify(element.stroke)}`);
        fields.push(`strokeWidth: ${element.strokeWidth}`);
      } else if (element.tag === "line") {
        fields.push(`tag: "line"`);
        fields.push(`x1: ${element.x1}`);
        fields.push(`y1: ${element.y1}`);
        fields.push(`x2: ${element.x2}`);
        fields.push(`y2: ${element.y2}`);
        fields.push(`fill: ${JSON.stringify(element.fill)}`);
        fields.push(`stroke: ${JSON.stringify(element.stroke)}`);
        fields.push(`strokeWidth: ${element.strokeWidth}`);
        if (element.strokeLinecap) fields.push(`strokeLinecap: ${JSON.stringify(element.strokeLinecap)}`);
        if (element.strokeLinejoin) fields.push(`strokeLinejoin: ${JSON.stringify(element.strokeLinejoin)}`);
      } else {
        fields.push(`d: ${JSON.stringify(element.d)}`);
        if (element.fill) fields.push(`fill: ${JSON.stringify(element.fill)}`);
        if (element.fillRule) fields.push(`fillRule: ${JSON.stringify(element.fillRule)}`);
        if (element.stroke) fields.push(`stroke: ${JSON.stringify(element.stroke)}`);
        if (element.strokeWidth !== undefined) fields.push(`strokeWidth: ${element.strokeWidth}`);
      }
      lines.push(`      { ${fields.join(", ")} },`);
    }
    lines.push("    ]");
    lines.push("  },");
  }

  lines.push("};");
  lines.push("");
  writeFileSync(outputPath, lines.join("\n"));
}

function main() {
  const offElements = readSvgElements(OFF_SOURCE);
  const levelElements = readSvgElements(LEVEL_SOURCE);
  const offSymbols = [
    buildElementSymbol(
      "NCTC",
      offElements.slice(0, 6),
      offElements[3],
      offElements[4],
      OFF_SOURCE,
      OFF_OUTPUT_PITCH
    ),
    buildElementSymbol(
      "NOTO",
      offElements.slice(6, 12),
      offElements[6],
      offElements[7],
      OFF_SOURCE,
      OFF_OUTPUT_PITCH
    )
  ];
  const levelSymbols = [
    buildElementSymbol(
      "LEVEL_SWITCH_NO",
      [levelElements[0], levelElements[1], levelElements[2], levelElements[3]],
      levelElements[3],
      levelElements[2],
      LEVEL_SOURCE,
      LEVEL_OUTPUT_PITCH
    ),
    buildElementSymbol(
      "LEVEL_SWITCH_NC",
      [levelElements[4], levelElements[5], levelElements[6]],
      levelElements[6],
      levelElements[5],
      LEVEL_SOURCE,
      LEVEL_OUTPUT_PITCH
    )
  ];

  emit("OFF_DELAY_ART", offSymbols, OFF_SOURCE, "New off-delay SVG (paths, lines, terminal circles); NCTC = closed contact, NOTO = open contact.", OFF_OUT, "{ NCTC: GeneratedSymbol; NOTO: GeneratedSymbol }");
  emit("LEVEL_SWITCH_ART", levelSymbols, LEVEL_SOURCE, "New level-switch SVG (paths + terminal circles), mapped to the level terminal pitch; original element geometry preserved.", LEVEL_OUT, "{ LEVEL_SWITCH_NO: GeneratedSymbol; LEVEL_SWITCH_NC: GeneratedSymbol }");

  console.log("=== off-delay ===");
  for (const symbol of offSymbols) {
    console.log(`${symbol.type}: elements=${symbol.elements.length} transform=${symbol.transform} bounds=${JSON.stringify(symbol.tightBounds)}`);
    symbol.elements.forEach((element, index) => {
      const serialized = element.d ?? JSON.stringify(element);
      console.log(`  ${index}: ${hash(serialized)} ${serialized.length}`);
    });
  }
  console.log("=== level ===");
  for (const symbol of levelSymbols) {
    console.log(`${symbol.type}: elements=${symbol.elements.length} transform=${symbol.transform} bounds=${JSON.stringify(symbol.tightBounds)}`);
    symbol.elements.forEach((element, index) => {
      const serialized = element.d ?? JSON.stringify(element);
      console.log(`  ${index}: ${hash(serialized)} ${serialized.length}`);
    });
  }
  console.log("=== source counts ===");
  console.log(`off-delay source elements=${offElements.length}; generated=${offSymbols.reduce((sum, symbol) => sum + symbol.elements.length, 0)}`);
  console.log(`level source elements=${levelElements.length}; generated=${levelSymbols.reduce((sum, symbol) => sum + symbol.elements.length, 0)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
