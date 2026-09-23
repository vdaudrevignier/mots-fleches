import { GridDefinition, GridSolution, Result, err, ok } from 'shared';
import { deriveWords } from './derive-words';
import { GridBuildError } from './errors';
import { GameState, Word } from './types';

export interface BuildGameInput {
  grid: GridDefinition;
  solution: GridSolution;
}

export function buildGame({ grid, solution }: BuildGameInput): Result<GameState, GridBuildError> {
  if (
    !Number.isInteger(grid.width) ||
    !Number.isInteger(grid.height) ||
    grid.width <= 0 ||
    grid.height <= 0
  ) {
    return err({ kind: 'invalidDimensions' });
  }

  const size = grid.width * grid.height;

  if (grid.cells.length !== size) {
    return err({ kind: 'cellsLength' });
  }

  if (solution.letters.length !== size) {
    return err({ kind: 'solutionMismatch' });
  }

  for (let i = 0; i < grid.cells.length; i++) {
    const cell = grid.cells[i];
    if (cell.kind === 'clue') {
      if (cell.entries.length === 0) {
        return err({ kind: 'emptyEntries' });
      }
      if (cell.entries.length > 2) {
        return err({ kind: 'tooManyEntries' });
      }
    }
  }

  const derived = deriveWords(grid);
  if (!derived.ok) {
    return err(derived.error);
  }

  for (let a = 0; a < derived.value.length; a++) {
    for (let b = a + 1; b < derived.value.length; b++) {
      const first = derived.value[a];
      const second = derived.value[b];
      if (first.direction !== second.direction) continue;
      if (first.cells.some((cell) => second.cells.includes(cell))) {
        return err({ kind: 'wordOverlap' });
      }
    }
  }

  const covered = new Set<number>();
  for (const word of derived.value) {
    for (const cell of word.cells) covered.add(cell);
  }
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i].kind === 'letter' && !covered.has(i)) {
      return err({ kind: 'uncoveredCell' });
    }
  }

  const words: Word[] = derived.value.map((candidate, id) => ({
    id,
    clueIndex: candidate.clueIndex,
    definition: candidate.definition,
    arrow: candidate.arrow,
    direction: candidate.direction,
    start: candidate.start,
    cells: candidate.cells,
    length: candidate.cells.length,
    answer: candidate.cells.map((cell) => solution.letters[cell]).join(''),
  }));

  return ok({
    grid,
    solution,
    words,
    letters: Array.from({ length: size }, () => null),
    statuses: Array.from({ length: size }, () => 'empty' as const),
    gameStatus: 'playing' as const,
  });
}
