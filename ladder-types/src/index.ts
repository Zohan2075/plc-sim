export type TimedContactInstructionType = "NOTC" | "NCTO";
export type InstructionType = "XIC" | "XIO" | TimedContactInstructionType | "OTE" | "OTL" | "OTU";

interface InstructionCommon {
  id: string;
  tag: string;
}

export interface ImmediateInstruction extends InstructionCommon {
  type: Exclude<InstructionType, TimedContactInstructionType>;
}

export interface TimedContactInstruction extends InstructionCommon {
  delayMs: number;
  type: TimedContactInstructionType;
}

export type InstructionBase = ImmediateInstruction | TimedContactInstruction;

export interface Rung {
  id: string;
  instructions: InstructionBase[];
}

export interface Program {
  rungs: Rung[];
}

export type TagName = string;
