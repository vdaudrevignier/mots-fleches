import { Arrow, GridDefinition, colOf, rowOf } from 'shared';
import { Result, err, ok } from 'shared';

export type DeriveError = { kind: 'wordOutOfBounds' } | { kind: 'wordThroughClue' };

export interface WordCandidate {
  clueIndex: number;
  definition: string;
  arrow: Arrow;
  direction: 'horizontal' | 'vertical';
  start: number;
  cells: number[];
}

export function deriveWords(grid: GridDefinition): Result<WordCandidate[], DeriveError> {
  const { width, height, cells } = grid;
  const candidates: WordCandidate[] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.kind !== 'clue') continue;

    for (const entry of cell.entries) {
      const r = rowOf(i, width);
      const c = colOf(i, width);

      let startRow: number;
      let startCol: number;
      let direction: 'horizontal' | 'vertical';
      switch (entry.arrow) {
        case 'right':
          startRow = r;
          startCol = c + 1;
          direction = 'horizontal';
          break;
        case 'down':
          startRow = r + 1;
          startCol = c;
          direction = 'vertical';
          break;
        case 'down-right':
          startRow = r + 1;
          startCol = c;
          direction = 'horizontal';
          break;
        case 'right-down':
          startRow = r;
          startCol = c + 1;
          direction = 'vertical';
          break;
      }

      if (startRow < 0 || startRow >= height || startCol < 0 || startCol >= width) {
        return err({ kind: 'wordOutOfBounds' });
      }

      const start = startRow * width + startCol;
      if (cells[start].kind !== 'letter') {
        return err({ kind: 'wordThroughClue' });
      }

      const wordCells: number[] = [];
      let wr = startRow;
      let wc = startCol;
      while (
        wr >= 0 &&
        wr < height &&
        wc >= 0 &&
        wc < width &&
        cells[wr * width + wc].kind === 'letter'
      ) {
        wordCells.push(wr * width + wc);
        if (direction === 'horizontal') {
          wc++;
        } else {
          wr++;
        }
      }

      candidates.push({
        clueIndex: i,
        definition: entry.definition,
        arrow: entry.arrow,
        direction,
        start,
        cells: wordCells,
      });
    }
  }

  return ok(candidates);
}
