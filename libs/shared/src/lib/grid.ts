export type Arrow = 'right' | 'down' | 'down-right' | 'right-down';

export interface ClueEntry {
  definition: string;
  arrow: Arrow;
}

export type GridCell = { kind: 'letter' } | { kind: 'clue'; entries: ClueEntry[] };

export interface GridDefinition {
  width: number;
  height: number;
  cells: GridCell[];
}

export interface GridSolution {
  letters: string[];
}

export function rowOf(index: number, width: number): number {
  return Math.floor(index / width);
}

export function colOf(index: number, width: number): number {
  return index % width;
}

export function cellIndex(row: number, col: number, width: number): number {
  return row * width + col;
}
