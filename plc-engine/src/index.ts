import type { Program } from "@plc-sim/ladder-types";
import { TagMemory } from "./tagMemory";
import { ProgramRunner } from "./programRunner";
import type { PlcEngineApi, ScanTrace } from "./types";

export type { PlcEngineApi, ScanTrace, TraceRung, TraceStep } from "./types";

export class PlcEngine implements PlcEngineApi {
  private readonly memory = new TagMemory();
  private readonly runner = new ProgramRunner();
  private lastTrace: ScanTrace | undefined;

  loadProgram(program: Program): void {
    this.runner.load(program);
  }

  setInput(tag: string, value: boolean): void {
    this.memory.setInput(tag, value);
  }

  scan(): void {
    this.lastTrace = undefined;
    this.runner.runScan(this.memory);
  }

  scanWithTrace(): ScanTrace {
    const trace = this.runner.runScanWithTrace(this.memory);
    this.lastTrace = trace;
    return trace;
  }

  getLastTrace(): ScanTrace | undefined {
    return this.lastTrace;
  }

  getTag(tag: string): boolean {
    return this.memory.getCommitted(tag);
  }
}
