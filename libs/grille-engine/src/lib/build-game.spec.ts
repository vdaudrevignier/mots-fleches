import { describe, expect, it } from 'vitest';
import { ClueEntry, GridDefinition, GridSolution } from 'shared';
import { buildGame } from './build-game';

function gridFrom(rows: string[], entries: Record<number, ClueEntry[]>): GridDefinition {
  const height = rows.length;
  const width = rows[0].length;
  const cells: GridDefinition['cells'] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const index = r * width + c;
      const char = rows[r][c];
      cells.push(
        char === 'C' ? { kind: 'clue', entries: entries[index] ?? [] } : { kind: 'letter' },
      );
    }
  }
  return { width, height, cells };
}

function solutionFrom(rows: string[]): GridSolution {
  return { letters: rows.join('').split('') };
}

const VALID_GRID = gridFrom(['CAB', 'CD.'], {
  0: [{ definition: 'mot un', arrow: 'right' }],
  3: [{ definition: 'mot deux', arrow: 'right' }],
});
const VALID_SOLUTION = solutionFrom(['.AB', '.CD']);

function expectBuildError(
  rows: string[],
  entries: Record<number, ClueEntry[]>,
  solution: string[],
  kind: string,
) {
  const result = buildGame({ grid: gridFrom(rows, entries), solution: { letters: solution } });
  expect(result).toEqual({ ok: false, error: { kind } });
}

describe('buildGame', () => {
  it('construit une partie valide avec les mots enrichis', () => {
    const result = buildGame({ grid: VALID_GRID, solution: VALID_SOLUTION });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.words).toHaveLength(2);
    expect(result.value.words[0]).toMatchObject({
      id: 0,
      clueIndex: 0,
      direction: 'horizontal',
      start: 1,
      cells: [1, 2],
      length: 2,
      answer: 'AB',
    });
    expect(result.value.words[1]).toMatchObject({
      id: 1,
      clueIndex: 3,
      direction: 'horizontal',
      start: 4,
      cells: [4, 5],
      length: 2,
      answer: 'CD',
    });
    expect(result.value.letters).toEqual([null, null, null, null, null, null]);
    expect(result.value.statuses).toEqual(['empty', 'empty', 'empty', 'empty', 'empty', 'empty']);
    expect(result.value.gameStatus).toBe('playing');
  });

  it('ne mute pas les entrees', () => {
    const grid = gridFrom(['CAB'], { 0: [{ definition: 'd', arrow: 'right' }] });
    const snapshot = JSON.stringify(grid);
    buildGame({ grid, solution: { letters: ['', 'X', 'X'] } });
    expect(JSON.stringify(grid)).toBe(snapshot);
  });

  it('rejette des dimensions invalides', () => {
    const zero = buildGame({
      grid: { width: 0, height: 0, cells: [] },
      solution: { letters: [] },
    });
    expect(zero).toEqual({ ok: false, error: { kind: 'invalidDimensions' } });
    const negative = buildGame({
      grid: { width: 2, height: -1, cells: [] },
      solution: { letters: [] },
    });
    expect(negative).toEqual({ ok: false, error: { kind: 'invalidDimensions' } });
  });

  it('rejette un tableau cells de mauvaise longueur', () => {
    const result = buildGame({
      grid: {
        width: 2,
        height: 2,
        cells: [{ kind: 'letter' }, { kind: 'letter' }, { kind: 'letter' }],
      },
      solution: { letters: ['A', 'B', 'C', 'D'] },
    });
    expect(result).toEqual({ ok: false, error: { kind: 'cellsLength' } });
  });

  it('rejette une solution de mauvaise longueur', () => {
    expectBuildError(
      ['CCA'],
      { 0: [{ definition: 'd', arrow: 'right' }] },
      ['X', 'X'],
      'solutionMismatch',
    );
  });

  it('rejette une case-indice sans entree puis une case-indice surchargee', () => {
    expectBuildError(['CC.'], {}, ['X', 'X', 'X'], 'emptyEntries');
    expectBuildError(
      ['CC.'],
      {
        0: [
          { definition: 'a', arrow: 'right' },
          { definition: 'b', arrow: 'right' },
          { definition: 'c', arrow: 'right' },
        ],
      },
      ['X', 'X', 'X'],
      'tooManyEntries',
    );
  });

  it('rejette un mot hors bornes', () => {
    expectBuildError(
      ['ABC'],
      { 2: [{ definition: 'd', arrow: 'right' }] },
      ['X', 'X', 'X'],
      'wordOutOfBounds',
    );
  });

  it('rejette un mot dont le depart est une case-indice', () => {
    expectBuildError(
      ['CC.'],
      {
        0: [{ definition: 'a', arrow: 'right' }],
        1: [{ definition: 'b', arrow: 'right' }],
      },
      ['X', 'X', 'X'],
      'wordThroughClue',
    );
  });

  it('rejette le chevauchement de deux mots du meme axe', () => {
    expectBuildError(
      ['CC.', '...'],
      {
        0: [{ definition: 'a', arrow: 'down-right' }],
        1: [{ definition: 'b', arrow: 'down-right' }],
      },
      ['A', 'B', 'C', 'D', 'E', 'F'],
      'wordOverlap',
    );
  });

  it('accepte deux mots du meme axe sans chevauchement et une couverture complete', () => {
    const grid = gridFrom(['CB', 'B.', 'B.'], {
      0: [
        { definition: 'colonne', arrow: 'down' },
        { definition: 'colonne decalee', arrow: 'right-down' },
      ],
    });
    const result = buildGame({ grid, solution: { letters: ['.', 'A', 'B', 'C', 'D', 'E'] } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.words).toHaveLength(2);
  });

  it('rejette une case-lettre couverte par aucun mot', () => {
    expectBuildError(
      ['C.C', '...'],
      {
        0: [{ definition: 'a', arrow: 'right' }],
        2: [{ definition: 'b', arrow: 'down' }],
      },
      ['A', 'B', 'C', 'D', 'E', 'F'],
      'uncoveredCell',
    );
  });
});
