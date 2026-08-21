import { describe, expect, it } from 'vitest';
import { ClueEntry, GridDefinition } from 'shared';
import { deriveWords } from './derive-words';

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

describe('deriveWords', () => {
  it('derives un mot right horizontal arrete par une case-indice', () => {
    const grid = gridFrom(['CABC'], { 0: [{ definition: 'd', arrow: 'right' }] });
    const result = deriveWords(grid);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          clueIndex: 0,
          definition: 'd',
          arrow: 'right',
          direction: 'horizontal',
          start: 1,
          cells: [1, 2],
        },
      ],
    });
  });

  it('derives un mot down vertical arrete par le bord', () => {
    const grid = gridFrom(['C', 'A', 'B'], { 0: [{ definition: 'd', arrow: 'down' }] });
    const result = deriveWords(grid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        direction: 'vertical',
        start: 1,
        cells: [1, 2],
      });
    }
  });

  it('derives down-right: depart en dessous, ecriture horizontale', () => {
    const grid = gridFrom(['C..', 'ABD'], { 0: [{ definition: 'd', arrow: 'down-right' }] });
    const result = deriveWords(grid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        direction: 'horizontal',
        start: 3,
        cells: [3, 4, 5],
      });
    }
  });

  it('derives right-down: depart a droite, ecriture verticale', () => {
    const grid = gridFrom(['CA', 'B.', 'B.'], { 0: [{ definition: 'd', arrow: 'right-down' }] });
    const result = deriveWords(grid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        direction: 'vertical',
        start: 1,
        cells: [1, 3, 5],
      });
    }
  });

  it('echoue en wordOutOfBounds quand la fleche sort de la grille', () => {
    const grid = gridFrom(['ABC'], { 2: [{ definition: 'd', arrow: 'right' }] });
    expect(deriveWords(grid)).toEqual({ ok: false, error: { kind: 'wordOutOfBounds' } });
  });

  it('echoue en wordOutOfBounds pour un down sur la derniere ligne', () => {
    const grid = gridFrom(['C'], { 0: [{ definition: 'd', arrow: 'down' }] });
    expect(deriveWords(grid)).toEqual({ ok: false, error: { kind: 'wordOutOfBounds' } });
  });

  it('echoue en wordThroughClue quand le depart designe une case-indice', () => {
    const grid = gridFrom(['CC'], { 0: [{ definition: 'd', arrow: 'right' }] });
    expect(deriveWords(grid)).toEqual({ ok: false, error: { kind: 'wordThroughClue' } });
  });

  it('ignore les cases-lettres sans indice et derive plusieurs entrees dans lordre', () => {
    const grid = gridFrom(['CA', 'B.'], {
      0: [
        { definition: 'h', arrow: 'right' },
        { definition: 'v', arrow: 'down' },
      ],
    });
    const result = deriveWords(grid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((w) => w.definition)).toEqual(['h', 'v']);
    }
  });
});
