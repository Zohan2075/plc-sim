import type { InstructionBase, Program, Rung } from "@plc-sim/ladder-types";
import type { ScanTrace, TraceRung, TraceStep } from "./types";
import { TagMemory } from "./tagMemory";

export class ProgramRunner {
  private program: Program = { rungs: [] };

  load(program: Program): void {
    this.program = program;
  }

  runScan(memory: TagMemory): void {
    const inputImage = memory.snapshotInputs();
    const pendingWrites = new Map<string, boolean>();

    for (const rung of this.program.rungs) {
      this.evaluateRung(rung, memory, inputImage, pendingWrites);
    }

    memory.commitWrites(pendingWrites);
  }

  runScanWithTrace(memory: TagMemory): ScanTrace {
    const inputImage = memory.snapshotInputs();
    const pendingWrites = new Map<string, boolean>();
    const rungTraces: TraceRung[] = [];

    for (const rung of this.program.rungs) {
      rungTraces.push(this.evaluateRungWithTrace(rung, memory, inputImage, pendingWrites));
    }

    memory.commitWrites(pendingWrites);

    return {
      programRungCount: this.program.rungs.length,
      rungs: rungTraces
    };
  }

  private evaluateRung(
    rung: Rung,
    memory: TagMemory,
    inputImage: ReadonlyMap<string, boolean>,
    pendingWrites: Map<string, boolean>
  ): void {
    let power = true;

    for (const instruction of rung.instructions) {
      power = this.evaluateInstruction(instruction, power, memory, inputImage, pendingWrites);
    }
  }

  private evaluateRungWithTrace(
    rung: Rung,
    memory: TagMemory,
    inputImage: ReadonlyMap<string, boolean>,
    pendingWrites: Map<string, boolean>
  ): TraceRung {
    let power = true;
    const steps: TraceStep[] = [];

    for (const instruction of rung.instructions) {
      const powerBefore = power;
      const { powerAfter, step } = this.evaluateInstructionWithTrace(
        instruction,
        powerBefore,
        memory,
        inputImage,
        pendingWrites
      );

      steps.push(step);
      power = powerAfter;
    }

    return { rungId: rung.id, steps };
  }

  private evaluateInstruction(
    instruction: InstructionBase,
    powerBefore: boolean,
    memory: TagMemory,
    inputImage: ReadonlyMap<string, boolean>,
    pendingWrites: Map<string, boolean>
  ): boolean {
    switch (instruction.type) {
      case "XIC": {
        const value = memory.readDuringScan(instruction.tag, inputImage);
        return powerBefore && value;
      }
      case "XIO": {
        const value = memory.readDuringScan(instruction.tag, inputImage);
        return powerBefore && !value;
      }
      case "OTE": {
        pendingWrites.set(instruction.tag, powerBefore);
        return powerBefore;
      }
      case "OTL": {
        if (powerBefore) pendingWrites.set(instruction.tag, true);
        return powerBefore;
      }
      case "OTU": {
        if (powerBefore) pendingWrites.set(instruction.tag, false);
        return powerBefore;
      }
      default: {
        const _exhaustive: never = instruction.type;
        return powerBefore;
      }
    }
  }

  private evaluateInstructionWithTrace(
    instruction: InstructionBase,
    powerBefore: boolean,
    memory: TagMemory,
    inputImage: ReadonlyMap<string, boolean>,
    pendingWrites: Map<string, boolean>
  ): { powerAfter: boolean; step: TraceStep } {
    const base: Omit<TraceStep, "powerAfter" | "powerBefore"> = {
      instructionId: instruction.id,
      type: instruction.type,
      tag: instruction.tag
    };

    switch (instruction.type) {
      case "XIC": {
        const value = memory.readDuringScan(instruction.tag, inputImage);
        const powerAfter = powerBefore && value;
        return {
          powerAfter,
          step: { ...base, powerBefore, powerAfter, readValue: value }
        };
      }
      case "XIO": {
        const value = memory.readDuringScan(instruction.tag, inputImage);
        const powerAfter = powerBefore && !value;
        return {
          powerAfter,
          step: { ...base, powerBefore, powerAfter, readValue: value }
        };
      }
      case "OTE": {
        pendingWrites.set(instruction.tag, powerBefore);
        return {
          powerAfter: powerBefore,
          step: { ...base, powerBefore, powerAfter: powerBefore, pendingWrite: powerBefore }
        };
      }
      case "OTL": {
        const willWrite = powerBefore;
        if (willWrite) pendingWrites.set(instruction.tag, true);
        return {
          powerAfter: powerBefore,
          step: {
            ...base,
            powerBefore,
            powerAfter: powerBefore,
            ...(willWrite ? { pendingWrite: true } : {})
          }
        };
      }
      case "OTU": {
        const willWrite = powerBefore;
        if (willWrite) pendingWrites.set(instruction.tag, false);
        return {
          powerAfter: powerBefore,
          step: {
            ...base,
            powerBefore,
            powerAfter: powerBefore,
            ...(willWrite ? { pendingWrite: false } : {})
          }
        };
      }
      default: {
        const _exhaustive: never = instruction.type;
        return {
          powerAfter: powerBefore,
          step: { ...base, powerBefore, powerAfter: powerBefore }
        };
      }
    }
  }
}
