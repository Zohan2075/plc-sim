import { describe, expect, it } from "vitest";
import { PlcEngine } from "../src";
import type { Program } from "@plc-sim/ladder-types";

describe("PlcEngine scan semantics", () => {
  it("XIC + OTE writes at end of scan", () => {
    const program: Program = {
      rungs: [
        {
          id: "r1",
          instructions: [
            { id: "i1", type: "XIC", tag: "I:0/0" },
            { id: "i2", type: "OTE", tag: "O:0/0" }
          ]
        }
      ]
    };

    const engine = new PlcEngine();
    engine.loadProgram(program);

    engine.setInput("I:0/0", true);
    engine.scan();
    expect(engine.getTag("O:0/0")).toBe(true);

    engine.setInput("I:0/0", false);
    engine.scan();
    expect(engine.getTag("O:0/0")).toBe(false);
  });

  it("XIO is true when tag is false", () => {
    const program: Program = {
      rungs: [
        {
          id: "r1",
          instructions: [
            { id: "i1", type: "XIO", tag: "I:0/0" },
            { id: "i2", type: "OTE", tag: "O:0/0" }
          ]
        }
      ]
    };

    const engine = new PlcEngine();
    engine.loadProgram(program);

    engine.setInput("I:0/0", false);
    engine.scan();
    expect(engine.getTag("O:0/0")).toBe(true);

    engine.setInput("I:0/0", true);
    engine.scan();
    expect(engine.getTag("O:0/0")).toBe(false);
  });

  it("OTE writes do not affect logic mid-scan", () => {
    const program: Program = {
      rungs: [
        {
          id: "r1",
          instructions: [
            { id: "i1", type: "XIC", tag: "I:0/0" },
            { id: "i2", type: "OTE", tag: "O:0/0" }
          ]
        },
        {
          id: "r2",
          instructions: [
            { id: "i3", type: "XIC", tag: "O:0/0" },
            { id: "i4", type: "OTE", tag: "B3:0/0" }
          ]
        }
      ]
    };

    const engine = new PlcEngine();
    engine.loadProgram(program);

    // Ensure O:0/0 starts OFF
    engine.scan();
    expect(engine.getTag("O:0/0")).toBe(false);

    // Turn input ON. Rung1 schedules O:0/0=ON, but rung2 should still see old O:0/0=OFF.
    engine.setInput("I:0/0", true);
    engine.scan();

    expect(engine.getTag("O:0/0")).toBe(true);
    expect(engine.getTag("B3:0/0")).toBe(false);

    // Next scan, rung2 sees O:0/0=ON and can drive B3
    engine.scan();
    expect(engine.getTag("B3:0/0")).toBe(true);
  });

  it("OTL latches and OTU unlatches", () => {
    const program: Program = {
      rungs: [
        {
          id: "latch",
          instructions: [
            { id: "i1", type: "XIC", tag: "I:0/0" },
            { id: "i2", type: "OTL", tag: "B3:0/1" }
          ]
        },
        {
          id: "unlatch",
          instructions: [
            { id: "i3", type: "XIC", tag: "I:0/1" },
            { id: "i4", type: "OTU", tag: "B3:0/1" }
          ]
        }
      ]
    };

    const engine = new PlcEngine();
    engine.loadProgram(program);

    engine.setInput("I:0/0", true);
    engine.setInput("I:0/1", false);
    engine.scan();
    expect(engine.getTag("B3:0/1")).toBe(true);

    // Remove latch input; value should persist.
    engine.setInput("I:0/0", false);
    engine.scan();
    expect(engine.getTag("B3:0/1")).toBe(true);

    // Unlatch
    engine.setInput("I:0/1", true);
    engine.scan();
    expect(engine.getTag("B3:0/1")).toBe(false);
  });
});
