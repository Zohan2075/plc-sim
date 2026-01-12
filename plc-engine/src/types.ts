import type { InstructionType, Program } from "@plc-sim/ladder-types";

export interface TraceStep {
  instructionId: string;
  type: InstructionType;
  tag: string;
  powerBefore: boolean;
  powerAfter: boolean;
  readValue?: boolean;
  pendingWrite?: boolean;
}

export interface TraceRung {
  rungId: string;
  steps: TraceStep[];
}

export interface ScanTrace {
  programRungCount: number;
  rungs: TraceRung[];
}

export interface PlcEngineApi {
  loadProgram(program: Program): void;
  setInput(tag: string, value: boolean): void;
  scan(): void;
  getTag(tag: string): boolean;
}
