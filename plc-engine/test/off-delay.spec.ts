import { describe, expect, it } from "vitest";
import type { Program } from "@plc-sim/ladder-types";
import { PlcEngine } from "../src";

function offDelayProgram(type: "NOTO" | "NCTC", delayMs: number): Program {
  return {
    rungs: [
      {
        id: "r1",
        instructions: [
          { id: "i1", type, tag: "I:0/0", delayMs },
          { id: "i2", type: "OTE", tag: "O:0/0" }
        ]
      }
    ]
  };
}

function isRestClosed(type: "NOTO" | "NCTC"): boolean {
  return type === "NCTC";
}

describe("off-delay contacts", () => {
  for (const type of ["NOTO", "NCTC"] as const) {
    it(`${type}: actuates immediately and returns after 0/500/3000 ms`, () => {
      for (const delayMs of [0, 500, 3000]) {
        const engine = new PlcEngine();
        engine.loadProgram(offDelayProgram(type, delayMs));

        engine.setInput("I:0/0", false);
        engine.scan(0);
        expect(engine.getTag("O:0/0")).toBe(isRestClosed(type));

        engine.setInput("I:0/0", true);
        engine.scan(0);
        expect(engine.getTag("O:0/0")).toBe(!isRestClosed(type));

        engine.setInput("I:0/0", false);
        engine.scan(0);
        expect(engine.getTag("O:0/0")).toBe(delayMs === 0 ? isRestClosed(type) : !isRestClosed(type));

        if (delayMs > 0) {
          engine.scan(delayMs);
          expect(engine.getTag("O:0/0")).toBe(isRestClosed(type));
        }
      }
    });

    it(`${type}: re-energizing cancels the delay and the next drop restarts it`, () => {
      const engine = new PlcEngine();
      engine.loadProgram(offDelayProgram(type, 500));

      engine.setInput("I:0/0", true);
      engine.scan(0);
      expect(engine.getTag("O:0/0")).toBe(!isRestClosed(type));

      engine.setInput("I:0/0", false);
      engine.scan(250);
      expect(engine.getTag("O:0/0")).toBe(!isRestClosed(type));

      engine.setInput("I:0/0", true);
      engine.scan(0);
      expect(engine.getTag("O:0/0")).toBe(!isRestClosed(type));

      engine.setInput("I:0/0", false);
      engine.scan(250);
      expect(engine.getTag("O:0/0")).toBe(!isRestClosed(type));

      engine.scan(250);
      expect(engine.getTag("O:0/0")).toBe(isRestClosed(type));
    });

    it(`${type}: loadProgram clears a running off-delay`, () => {
      const program = offDelayProgram(type, 500);
      const engine = new PlcEngine();
      engine.loadProgram(program);

      engine.setInput("I:0/0", true);
      engine.scan(0);
      engine.setInput("I:0/0", false);
      engine.scan(250);
      expect(engine.getTag("O:0/0")).toBe(!isRestClosed(type));

      engine.loadProgram(program);
      engine.setInput("I:0/0", false);
      engine.scan(0);
      expect(engine.getTag("O:0/0")).toBe(isRestClosed(type));
    });
  }

  it("runs on-delay and off-delay side by side on the same driver", () => {
    const program: Program = {
      rungs: [
        {
          id: "on-delay",
          instructions: [
            { id: "notc", type: "NOTC", tag: "I:0/0", delayMs: 300 },
            { id: "on-out", type: "OTE", tag: "O:0/0" }
          ]
        },
        {
          id: "off-delay",
          instructions: [
            { id: "noto", type: "NOTO", tag: "I:0/0", delayMs: 300 },
            { id: "off-out", type: "OTE", tag: "O:0/1" }
          ]
        }
      ]
    };
    const engine = new PlcEngine();
    engine.loadProgram(program);

    engine.setInput("I:0/0", true);
    engine.scan(0);
    expect(engine.getTag("O:0/0")).toBe(false);
    expect(engine.getTag("O:0/1")).toBe(true);

    engine.scan(250);
    expect(engine.getTag("O:0/0")).toBe(false);
    expect(engine.getTag("O:0/1")).toBe(true);

    engine.scan(300);
    expect(engine.getTag("O:0/0")).toBe(true);
    expect(engine.getTag("O:0/1")).toBe(true);

    engine.setInput("I:0/0", false);
    engine.scan(0);
    expect(engine.getTag("O:0/0")).toBe(false);
    expect(engine.getTag("O:0/1")).toBe(true);

    engine.scan(300);
    expect(engine.getTag("O:0/1")).toBe(false);
  });
});
