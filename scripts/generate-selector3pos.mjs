import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "ui/src/diagram/selector3pos");
const outputFile = path.join(root, "ui/src/diagram/selector3posArt.generated.ts");

const files = [
  { state: 1, file: "Selector-1st_position.svg" },
  { state: 2, file: "Selector-2nd_position_OFF.svg" },
  { state: 3, file: "Selector-3rd_position.svg" }
];

const TARGET = {
  in1: { x: 53, y: 24 },
  out1: { x: 107, y: 24 },
  in2: { x: 53, y: 78 },
  out2: { x: 107, y: 78 }
};

function parseElements(text) {
  const elements = [];
  const re = /<(path|polygon)\b([^>]*?)\/?>(?:<\/\1>)?/g;
  let match;

  while ((match = re.exec(text))) {
    const tag = match[1];
    const attrs = match[2];
    const dataMatch = tag === "path"
      ? attrs.match(/\bd="([^"]*)"/)
      : attrs.match(/\bpoints="([^"]*)"/);
    const fillRuleMatch = attrs.match(/\bfill-rule="([^"]*)"/);

    if (!dataMatch) {
      throw new Error(`Missing ${tag === "path" ? "d" : "points"} on <${tag}>`);
    }

    elements.push({
      tag,
      data: dataMatch[1],
      ...(fillRuleMatch ? { fillRule: fillRuleMatch[1] } : {})
    });
  }

  return elements;
}

function numbers(data) {
  return (data.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
}

function pathCenter(data) {
  const values = numbers(data);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let index = 0; index + 1 < values.length; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    x: Number(((minX + maxX) / 2).toFixed(3)),
    y: Number(((minY + maxY) / 2).toFixed(3))
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function pathBounds(data) {
  const commandPattern = /([MLCZ])([^MLCZ]*)/g;
  let match;
  let current = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const include = (point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  };

  while ((match = commandPattern.exec(data))) {
    const command = match[1];
    const values = (match[2].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

    if (command === "M") {
      current = { x: values[0], y: values[1] };
      start = current;
      include(current);
    } else if (command === "L") {
      current = { x: values[0], y: values[1] };
      include(current);
    } else if (command === "C") {
      const p0 = current;
      const p1 = { x: values[0], y: values[1] };
      const p2 = { x: values[2], y: values[3] };
      const p3 = { x: values[4], y: values[5] };

      for (let step = 0; step <= 32; step += 1) {
        const t = step / 32;
        const mt = 1 - t;
        include({
          x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
          y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
        });
      }

      current = p3;
    } else if (command === "Z") {
      current = start;
      include(current);
    }
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function pathRadii(data) {
  const subpaths = data.match(/M[^Z]*Z/g) || [];

  if (subpaths.length < 2) {
    throw new Error(`Expected two ring subpaths, found ${subpaths.length}`);
  }

  const outer = pathBounds(subpaths[0]);
  const inner = pathBounds(subpaths[1]);

  return {
    outer: (outer.width + outer.height) / 4,
    inner: (inner.width + inner.height) / 4
  };
}

const OUTLINE_STROKE_WIDTH = 3.5;

function getLeverJointFiller(state, elements) {
  if (state === 2) {
    return null;
  }

  const lever = elements.find((element) => element.tag === "path" && !/Z\s+M/.test(element.data));

  if (!lever) {
    throw new Error(`State ${state}: lever path not found`);
  }

  const points = [...lever.data.matchAll(/([ML])\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
    .map((match) => ({ command: match[1], x: Number(match[2]), y: Number(match[3]) }));

  if (points.length < 5) {
    throw new Error(`State ${state}: lever path has only ${points.length} M/L points`);
  }

  const first = points[0];
  const last = points[points.length - 1];
  const barTop = points[3].y;
  const barBottom = first.y;

  if (Math.abs(last.y - barBottom) > 0.01) {
    throw new Error(`State ${state}: open lever ends are not on the bar bottom (${first.y} vs ${last.y})`);
  }

  const stemMinX = Math.min(first.x, last.x);
  const stemMaxX = Math.max(first.x, last.x);

  return {
    x: Number(stemMinX.toFixed(3)),
    y: Number((barTop - OUTLINE_STROKE_WIDTH).toFixed(3)),
    width: Number((stemMaxX - stemMinX).toFixed(3)),
    height: Number(((barBottom - barTop) + OUTLINE_STROKE_WIDTH).toFixed(3)),
    source: {
      barTop,
      barBottom,
      stemMinX,
      stemMaxX
    }
  };
}

const parsed = files.map(({ state, file }) => {
  const text = readFileSync(path.join(sourceDir, file), "utf8");
  const elements = parseElements(text);
  const ringElements = elements.filter((element) => element.tag === "path" && /Z\s+M/.test(element.data));
  const ringEntries = ringElements
    .map((element) => ({ center: pathCenter(element.data), radii: pathRadii(element.data) }))
    .sort((a, b) => (Math.abs(a.center.y - b.center.y) > 0.01 ? a.center.y - b.center.y : a.center.x - b.center.x));

  if (ringEntries.length !== 4) {
    throw new Error(`${file}: expected 4 ring paths, found ${ringEntries.length}`);
  }

  return {
    state,
    file,
    elements,
    rings: ringEntries.map((entry) => entry.center),
    ringRadii: {
      in1: ringEntries[0].radii,
      out1: ringEntries[1].radii,
      in2: ringEntries[2].radii,
      out2: ringEntries[3].radii
    },
    filler: getLeverJointFiller(state, elements)
  };
});

const state2 = parsed.find((entry) => entry.state === 2);
const scaleX = (TARGET.out1.x - TARGET.in1.x) / (state2.rings[1].x - state2.rings[0].x);
const scaleY = (TARGET.in2.y - TARGET.in1.y) / (state2.rings[2].y - state2.rings[0].y);

const wrappers = {};
const computedCenters = {};
for (const entry of parsed) {
  const [in1, out1, in2, out2] = entry.rings;
  const translateX = TARGET.in1.x - scaleX * in1.x;
  const translateY = TARGET.in1.y - scaleY * in1.y;
  wrappers[entry.state] = `translate(${translateX} ${translateY}) scale(${scaleX} ${scaleY})`;
  computedCenters[entry.state] = {
    in1: { x: Number((translateX + scaleX * in1.x).toFixed(3)), y: Number((translateY + scaleY * in1.y).toFixed(3)) },
    out1: { x: Number((translateX + scaleX * out1.x).toFixed(3)), y: Number((translateY + scaleY * out1.y).toFixed(3)) },
    in2: { x: Number((translateX + scaleX * in2.x).toFixed(3)), y: Number((translateY + scaleY * in2.y).toFixed(3)) },
    out2: { x: Number((translateX + scaleX * out2.x).toFixed(3)), y: Number((translateY + scaleY * out2.y).toFixed(3)) }
  };
}

for (const entry of parsed) {
  const centers = computedCenters[entry.state];
  for (const id of ["in1", "out1", "in2", "out2"]) {
    if (Math.abs(centers[id].x - TARGET[id].x) > 0.005 || Math.abs(centers[id].y - TARGET[id].y) > 0.005) {
      throw new Error(`${entry.file}: ring ${id} normalized to ${centers[id].x},${centers[id].y}, expected ${TARGET[id].x},${TARGET[id].y}`);
    }
  }
}

const ringRadii = {};
for (const entry of parsed) {
  ringRadii[entry.state] = {};
  for (const terminalId of ["in1", "out1", "in2", "out2"]) {
    const sourceRadii = entry.ringRadii[terminalId];
    const outerArt = sourceRadii.outer + OUTLINE_STROKE_WIDTH / 2;
    const innerArt = Math.max(0, sourceRadii.inner - OUTLINE_STROKE_WIDTH / 2);
    ringRadii[entry.state][terminalId] = {
      outerX: Number((outerArt * scaleX).toFixed(6)),
      outerY: Number((outerArt * scaleY).toFixed(6)),
      innerX: Number((innerArt * scaleX).toFixed(6)),
      innerY: Number((innerArt * scaleY).toFixed(6))
    };
  }
}

const hashes = {};
const counts = {};
const fillers = {};
const generatedStates = {};
for (const entry of parsed) {
  counts[entry.state] = entry.elements.length;
  hashes[entry.state] = entry.elements.map((element) => sha256(element.data));
  fillers[entry.state] = entry.filler
    ? {
        x: entry.filler.x,
        y: entry.filler.y,
        width: entry.filler.width,
        height: entry.filler.height
      }
    : null;
  generatedStates[entry.state] = entry.elements
    .map((element) => {
      const fillRule = element.fillRule ? `, fillRule: "${element.fillRule}"` : "";
      if (element.tag === "path") {
        return `    { tag: "path", d: ${JSON.stringify(element.data)}${fillRule} }`;
      }
      return `    { tag: "polygon", points: ${JSON.stringify(element.data)}${fillRule} }`;
    })
    .join(",\n");
}

const output = `// Generated by scripts/generate-selector3pos.mjs from the supplied SVG files.
// Do not edit this file by hand. Re-run the script after changing the SVGs.

export type Selector3PosState = 1 | 2 | 3;

export type Selector3PosElement =
  | { tag: "path"; d: string; fillRule?: "nonzero" | "evenodd" }
  | { tag: "polygon"; points: string; fillRule?: "nonzero" | "evenodd" };

export const SELECTOR_3POS_WRAPPERS: Record<Selector3PosState, string> = {
  1: ${JSON.stringify(wrappers[1])},
  2: ${JSON.stringify(wrappers[2])},
  3: ${JSON.stringify(wrappers[3])}
};

export const SELECTOR_3POS_RING_CENTERS = {
  in1: { x: ${TARGET.in1.x}, y: ${TARGET.in1.y} },
  out1: { x: ${TARGET.out1.x}, y: ${TARGET.out1.y} },
  in2: { x: ${TARGET.in2.x}, y: ${TARGET.in2.y} },
  out2: { x: ${TARGET.out2.x}, y: ${TARGET.out2.y} }
} as const;

export const SELECTOR_3POS_ELEMENT_COUNTS: Record<Selector3PosState, number> = {
  1: ${counts[1]},
  2: ${counts[2]},
  3: ${counts[3]}
};

export const SELECTOR_3POS_ELEMENT_HASHES: Record<Selector3PosState, readonly string[]> = {
  1: ${JSON.stringify(hashes[1])},
  2: ${JSON.stringify(hashes[2])},
  3: ${JSON.stringify(hashes[3])}
};

export const SELECTOR_3POS_JOINT_FILLERS: Record<Selector3PosState, { x: number; y: number; width: number; height: number } | null> = {
  1: ${JSON.stringify(fillers[1])},
  2: null,
  3: ${JSON.stringify(fillers[3])}
};

export const SELECTOR_3POS_RING_RADII: Record<Selector3PosState, Record<"in1" | "out1" | "in2" | "out2", { outerX: number; outerY: number; innerX: number; innerY: number }>> = {
  1: ${JSON.stringify(ringRadii[1])},
  2: ${JSON.stringify(ringRadii[2])},
  3: ${JSON.stringify(ringRadii[3])}
};

export const SELECTOR_3POS_STATES: Record<Selector3PosState, readonly Selector3PosElement[]> = {
  1: [
${generatedStates[1]}
  ],
  2: [
${generatedStates[2]}
  ],
  3: [
${generatedStates[3]}
  ]
};
`;

writeFileSync(outputFile, output, "utf8");

console.log(`scale x = ${scaleX}`);
console.log(`scale y = ${scaleY}`);
console.log(`scale difference = ${Math.abs(scaleX - scaleY)} (${(Math.abs(scaleX - scaleY) / scaleX * 100).toFixed(2)}% of x)`);
for (const entry of parsed) {
  console.log(`\n${entry.file}`);
  console.log(`  elements: ${entry.elements.length}`);
  entry.elements.forEach((element, index) => {
    console.log(`  #${index + 1} ${element.tag} sha256=${hashes[entry.state][index]} ${element.data.slice(0, 48)}${element.data.length > 48 ? "…" : ""}`);
  });
  console.log(`  rings (normalized): ${JSON.stringify(computedCenters[entry.state])}`);
  console.log(`  ring radii (rendered world): ${JSON.stringify(ringRadii[entry.state])}`);
  console.log(`  joint filler: ${JSON.stringify(fillers[entry.state])}`);
}
console.log(`\nwrote ${outputFile}`);
