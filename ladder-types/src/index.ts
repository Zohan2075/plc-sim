export type InstructionType = "XIC" | "XIO" | "OTE" | "OTL" | "OTU";

export interface InstructionBase {
  id: string;
  tag: string;
  type: InstructionType;
}

export interface Rung {
  id: string;
  instructions: InstructionBase[];
}

export interface Program {
  rungs: Rung[];
}

export type TagName = string;
