import type { InstructionType, Program } from "@plc-sim/ladder-types";

export interface TraceStep {
  delayMs?: number;
  instructionId: string;
  timerDone?: boolean;
  timerElapsedMs?: number;
  tag: string;
  powerBefore: boolean;
  powerAfter: boolean;
  readValue?: boolean;
  pendingWrite?: boolean;
  type: InstructionType;
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
  scan(elapsedMs?: number): void;
  scanWithTrace(elapsedMs?: number): ScanTrace;
  getTag(tag: string): boolean;
}
