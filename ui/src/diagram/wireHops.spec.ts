import { describe, expect, it } from "vitest";
import { buildWirePathD, findWireCrossings } from "./wireHops";
import type { BuilderWire } from "../DiagramBuilder";

function wire(id: string, points: Array<[number, number]>): BuilderWire {
  return {
    color: "#111827",
    endPortId: null,
    id,
    points: points.map(([x, y]) => ({ x, y })),
    startPortId: null,
    thickness: 3.5
  };
}

describe("findWireCrossings", () => {
  it("detecta un cruce y solo puentea el cable posterior", () => {
    const horizontal = wire("a", [[0, 0], [100, 0]]);
    const vertical = wire("b", [[50, -50], [50, 50]]);
    const wires = [horizontal, vertical];

    expect(findWireCrossings(vertical, 1, wires)).toEqual([{ point: { x: 50, y: 0 }, segmentIndex: 0 }]);
    expect(findWireCrossings(horizontal, 0, wires)).toEqual([]);
  });

  it("no marca puente en un nodo compartido", () => {
    const horizontal = wire("a", [[0, 0], [50, 0], [100, 0]]);
    const vertical = wire("b", [[50, -50], [50, 0], [50, 50]]);

    expect(findWireCrossings(vertical, 1, [horizontal, vertical])).toEqual([]);
  });

  it("marca puente al cruzar el extremo de otro cable sin nodo compartido", () => {
    const horizontal = wire("a", [[0, 0], [100, 0]]);
    const vertical = wire("b", [[0, -50], [0, 50]]);

    expect(findWireCrossings(vertical, 1, [horizontal, vertical])).toEqual([
      { point: { x: 0, y: 0 }, segmentIndex: 0 }
    ]);
  });

  it("ignora cables paralelos", () => {
    const first = wire("a", [[0, 0], [100, 0]]);
    const second = wire("b", [[0, 20], [100, 20]]);

    expect(findWireCrossings(second, 1, [first, second])).toEqual([]);
  });
});

describe("buildWirePathD", () => {
  it("inserta un arco en el cruce", () => {
    const path = buildWirePathD(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [{ point: { x: 50, y: 0 }, segmentIndex: 0 }]
    );

    expect(path.startsWith("M 0 0")).toBe(true);
    expect(path).toContain("Q 50 -14");
    expect(path.endsWith("L 100 0")).toBe(true);
  });

  it("sin cruces devuelve la polilinea", () => {
    expect(buildWirePathD([{ x: 0, y: 0 }, { x: 100, y: 0 }], [])).toBe("M 0 0 L 100 0");
  });
});
