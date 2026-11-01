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
  it("detecta un cruce y solo puentea el cable mas nuevo", () => {
    const horizontal = wire("wire-1", [[0, 0], [100, 0]]);
    const vertical = wire("wire-2", [[50, -50], [50, 50]]);
    const wires = [horizontal, vertical];

    expect(findWireCrossings(vertical, wires)).toEqual([{ point: { x: 50, y: 0 }, segmentIndex: 0 }]);
    expect(findWireCrossings(horizontal, wires)).toEqual([]);
    expect(findWireCrossings(vertical, [...wires].reverse())).toEqual([
      { point: { x: 50, y: 0 }, segmentIndex: 0 }
    ]);
  });

  it("no marca puente en un nodo compartido", () => {
    const horizontal = wire("wire-1", [[0, 0], [50, 0], [100, 0]]);
    const vertical = wire("wire-2", [[50, -50], [50, 0], [50, 50]]);

    expect(findWireCrossings(vertical, [horizontal, vertical])).toEqual([]);
  });

  it("no marca puente en una union en T", () => {
    const horizontal = wire("wire-1", [[0, 0], [100, 0]]);
    const vertical = wire("wire-2", [[50, 50], [50, 0]]);

    expect(findWireCrossings(vertical, [horizontal, vertical])).toEqual([]);
  });

  it("no marca puente en una esquina", () => {
    const horizontal = wire("wire-1", [[0, 0], [100, 0]]);
    const vertical = wire("wire-2", [[0, -50], [0, 0], [0, 50]]);

    expect(findWireCrossings(vertical, [horizontal, vertical])).toEqual([]);
  });

  it("ignora cables paralelos", () => {
    const first = wire("wire-1", [[0, 0], [100, 0]]);
    const second = wire("wire-2", [[0, 20], [100, 20]]);

    expect(findWireCrossings(second, [first, second])).toEqual([]);
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
