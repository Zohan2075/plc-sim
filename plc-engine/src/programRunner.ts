import type {
  InstructionBase,
  Program,
  Rung,
  TimedContactInstruction
} from "@plc-sim/ladder-types";
import type { ScanTrace, TraceRung, TraceStep } from "./types";
import { TagMemory } from "./tagMemory";

interface TimedContactRuntimeState {
  actuationElapsedMs: number;
  elapsedMs: number;
}

const TIMED_CONTACT_ACTUATION_DELAY_MS = 250;

function isTimedContactInstruction(instruction: InstructionBase): instruction is TimedContactInstruction {
  return instruction.type === "NOTC" || instruction.type === "NCTO";
}

export class ProgramRunner {
  private program: Program = { rungs: [] };
  private readonly timedContactStateByInstructionId = new Map<string, TimedContactRuntimeState>();

  load(program: Program): void {
    this.program = program;
    this.timedContactStateByInstructionId.clear();
  }

  runScan(memory: TagMemory, elapsedMs = 0): void {
    const inputImage = memory.snapshotInputs();
    const pendingWrites = new Map<string, boolean>();
    const elapsedMsThisScan = this.normalizeElapsedMs(elapsedMs);

    for (const rung of this.program.rungs) {
      this.evaluateRung(rung, memory, inputImage, pendingWrites, elapsedMsThisScan);
    }

    memory.commitWrites(pendingWrites);
  }

  runScanWithTrace(memory: TagMemory, elapsedMs = 0): ScanTrace {
    const inputImage = memory.snapshotInputs();
    const pendingWrites = new Map<string, boolean>();
    const rungTraces: TraceRung[] = [];
    const elapsedMsThisScan = this.normalizeElapsedMs(elapsedMs);

    for (const rung of this.program.rungs) {
      rungTraces.push(this.evaluateRungWithTrace(rung, memory, inputImage, pendingWrites, elapsedMsThisScan));
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
    pendingWrites: Map<string, boolean>,
    elapsedMsThisScan: number
  ): void {
    let power = true;

    for (const instruction of rung.instructions) {
      power = this.evaluateInstruction(instruction, power, memory, inputImage, pendingWrites, elapsedMsThisScan);
    }
  }

  private evaluateRungWithTrace(
    rung: Rung,
    memory: TagMemory,
    inputImage: ReadonlyMap<string, boolean>,
    pendingWrites: Map<string, boolean>,
    elapsedMsThisScan: number
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
        pendingWrites,
        elapsedMsThisScan
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
    pendingWrites: Map<string, boolean>,
    elapsedMsThisScan: number
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
      case "NOTC":
      case "NCTO": {
        const inputValue = memory.readDuringScan(instruction.tag, inputImage);
        const { contactClosed } = this.advanceTimedContact(instruction, inputValue, elapsedMsThisScan);
        return powerBefore && contactClosed;
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
        const _exhaustive: never = instruction;
        return powerBefore;
      }
    }
  }

  private evaluateInstructionWithTrace(
    instruction: InstructionBase,
    powerBefore: boolean,
    memory: TagMemory,
    inputImage: ReadonlyMap<string, boolean>,
    pendingWrites: Map<string, boolean>,
    elapsedMsThisScan: number
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
      case "NOTC":
      case "NCTO": {
        const inputValue = memory.readDuringScan(instruction.tag, inputImage);
        const timedContactState = this.advanceTimedContact(instruction, inputValue, elapsedMsThisScan);
        const powerAfter = powerBefore && timedContactState.contactClosed;
        return {
          powerAfter,
          step: {
            ...base,
            delayMs: timedContactState.delayMs,
            powerBefore,
            powerAfter,
            readValue: inputValue,
            timerDone: timedContactState.done,
            timerElapsedMs: timedContactState.elapsedMs
          }
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
        const _exhaustive: never = instruction;
        return {
          powerAfter: powerBefore,
          step: { ...base, powerBefore, powerAfter: powerBefore }
        };
      }
    }
  }

  private advanceTimedContact(
    instruction: TimedContactInstruction,
    inputValue: boolean,
    elapsedMsThisScan: number
  ): { contactClosed: boolean; delayMs: number; done: boolean; elapsedMs: number } {
    const delayMs = this.normalizeDelayMs(instruction.delayMs);

    if (!inputValue) {
      this.timedContactStateByInstructionId.delete(instruction.id);

      return {
        contactClosed: instruction.type === "NCTO",
        delayMs,
        done: false,
        elapsedMs: 0
      };
    }

    const previousState = this.timedContactStateByInstructionId.get(instruction.id);
    const previousActuationElapsedMs = previousState?.actuationElapsedMs ?? 0;
    const previousElapsedMs = previousState?.elapsedMs ?? 0;
    const actuationRemainingMs = Math.max(0, TIMED_CONTACT_ACTUATION_DELAY_MS - previousActuationElapsedMs);
    const actuationStepMs = Math.min(elapsedMsThisScan, actuationRemainingMs);
    const nextActuationElapsedMs = Math.min(
      TIMED_CONTACT_ACTUATION_DELAY_MS,
      previousActuationElapsedMs + elapsedMsThisScan
    );
    const nextElapsedMs = Math.min(delayMs, previousElapsedMs + Math.max(0, elapsedMsThisScan - actuationStepMs));
    const done = nextActuationElapsedMs >= TIMED_CONTACT_ACTUATION_DELAY_MS && nextElapsedMs >= delayMs;

    this.timedContactStateByInstructionId.set(instruction.id, {
      actuationElapsedMs: nextActuationElapsedMs,
      elapsedMs: nextElapsedMs
    });

    return {
      contactClosed: instruction.type === "NOTC" ? done : !done,
      delayMs,
      done,
      elapsedMs: nextElapsedMs
    };
  }

  private normalizeDelayMs(delayMs: number): number {
    return Number.isFinite(delayMs) ? Math.max(0, Math.round(delayMs)) : 0;
  }

  private normalizeElapsedMs(elapsedMs: number): number {
    return Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  }
}
