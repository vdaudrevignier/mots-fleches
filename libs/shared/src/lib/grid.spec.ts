import { describe, expect, it } from 'vitest';
import { cellIndex, colOf, rowOf } from './grid';

describe('coordonnées de grille', () => {
  it('calcule ligne et colonne depuis un index', () => {
    expect(rowOf(0, 6)).toBe(0);
    expect(rowOf(5, 6)).toBe(0);
    expect(rowOf(6, 6)).toBe(1);
    expect(rowOf(35, 6)).toBe(5);
    expect(colOf(0, 6)).toBe(0);
    expect(colOf(5, 6)).toBe(5);
    expect(colOf(6, 6)).toBe(0);
    expect(colOf(35, 6)).toBe(5);
  });

  it('fait l aller-retour index <-> (ligne, colonne)', () => {
    for (let index = 0; index < 36; index++) {
      expect(cellIndex(rowOf(index, 6), colOf(index, 6), 6)).toBe(index);
    }
  });
});
