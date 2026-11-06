export interface GeneratedBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export function parsePathBounds(
  pathData: string,
  context?: string,
  strokeWidth?: number
): GeneratedBounds;
