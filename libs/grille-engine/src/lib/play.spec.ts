import { describe, expect, it } from 'vitest';
import { ClueEntry, GridDefinition } from 'shared';
import { buildGame } from './build-game';
import { GameState } from './types';
import {
  clearLetter,
  isWon,
  reset,
  setLetter,
  validateAll,
  validateWord,
  wordsAtCell,
  wordsFromClue,
} from './play';

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

function makeGame(): GameState {
  const grid = gridFrom(['CAB', 'CD.'], {
    0: [{ definition: 'deux lettres', arrow: 'right' }],
    3: [{ definition: 'mot du bas', arrow: 'right' }],
  });
  const result = buildGame({ grid, solution: { letters: ['', 'A', 'B', '', 'C', 'D'] } });
  if (!result.ok) throw new Error('fixture invalide');
  return result.value;
}

describe('setLetter', () => {
  it('remplit une case-lettre avec statut filled', () => {
    const state = makeGame();
    const result = setLetter(state, 1, 'A');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.letters[1]).toBe('A');
      expect(result.value.statuses[1]).toBe('filled');
      expect(state.letters[1]).toBeNull();
    }
  });

  it('rejette une saisie sur une case-indice ou hors grille', () => {
    const state = makeGame();
    expect(setLetter(state, 0, 'C')).toEqual({ ok: false, error: { kind: 'notALetterCell' } });
    expect(setLetter(state, 99, 'C')).toEqual({ ok: false, error: { kind: 'notALetterCell' } });
  });

  it('rejette autre chose qu une majuscule A-Z', () => {
    const state = makeGame();
    expect(setLetter(state, 1, 'a')).toEqual({ ok: false, error: { kind: 'invalidLetter' } });
    expect(setLetter(state, 1, '1')).toEqual({ ok: false, error: { kind: 'invalidLetter' } });
    expect(setLetter(state, 1, 'É')).toEqual({ ok: false, error: { kind: 'invalidLetter' } });
  });

  it('passe la partie en won quand la derniere case correcte est posee', () => {
    const state = makeGame();
    const step1 = setLetter(state, 1, 'A');
    const step2 = setLetter(step1.value, 2, 'B');
    const step3 = setLetter(step2.value, 4, 'C');
    const step4 = setLetter(step3.value, 5, 'D');
    expect(step4.value.gameStatus).toBe('won');
    expect(isWon(step4.value)).toBe(true);
  });

  it('rejette toute saisie apres la victoire', () => {
    const state = makeGame();
    const won = setLetter(
      setLetter(setLetter(setLetter(state, 1, 'A').value, 2, 'B').value, 4, 'C').value,
      5,
      'D',
    ).value;
    expect(setLetter(won, 1, 'A')).toEqual({ ok: false, error: { kind: 'gameWon' } });
    expect(clearLetter(won, 1)).toEqual({ ok: false, error: { kind: 'gameWon' } });
  });
});

describe('clearLetter', () => {
  it('vide une case remplie', () => {
    const state = setLetter(makeGame(), 1, 'A').value;
    const result = clearLetter(state, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.letters[1]).toBeNull();
      expect(result.value.statuses[1]).toBe('empty');
    }
  });

  it('rejette une case-indice', () => {
    expect(clearLetter(makeGame(), 0)).toEqual({ ok: false, error: { kind: 'notALetterCell' } });
  });
});

describe('validateWord', () => {
  it('marque correct les bonnes lettres et wrong les mauvaises, conservees', () => {
    const state = setLetter(makeGame(), 1, 'Z').value;
    const result = validateWord(state, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.statuses[1]).toBe('wrong');
      expect(result.value.letters[1]).toBe('Z');
      expect(result.value.statuses[2]).toBe('empty');
    }
  });

  it('rejette null et un id inconnu', () => {
    const state = makeGame();
    expect(validateWord(state, null)).toEqual({ ok: false, error: { kind: 'noWordSelected' } });
    expect(validateWord(state, 42)).toEqual({ ok: false, error: { kind: 'wordNotFound' } });
  });
});

describe('validateAll', () => {
  it('marque toute la grille et laisse les cases vides en empty', () => {
    const state = setLetter(makeGame(), 1, 'Z').value;
    const next = validateAll(state);
    expect(next.statuses[1]).toBe('wrong');
    expect(next.statuses[2]).toBe('empty');
    expect(next.statuses[4]).toBe('empty');
    expect(next.statuses[5]).toBe('empty');
  });

  it('declare la victoire quand tout est correct', () => {
    let state = makeGame();
    state = setLetter(state, 1, 'A').value;
    state = setLetter(state, 2, 'B').value;
    state = setLetter(state, 4, 'C').value;
    state = setLetter(state, 5, 'D').value;
    expect(validateAll(state).gameStatus).toBe('won');
  });
});

describe('isWon', () => {
  it('est fausse au demarrage et vraie quand tout est juste', () => {
    expect(isWon(makeGame())).toBe(false);
    let state = makeGame();
    state = setLetter(state, 1, 'A').value;
    state = setLetter(state, 2, 'B').value;
    state = setLetter(state, 4, 'C').value;
    state = setLetter(state, 5, 'D').value;
    expect(isWon(state)).toBe(true);
  });
});

describe('reset', () => {
  it('vide toute la saisie et repasse en playing', () => {
    let state = makeGame();
    state = setLetter(state, 1, 'A').value;
    state = validateAll(state);
    const fresh = reset(state);
    expect(fresh.letters.every((l) => l === null)).toBe(true);
    expect(fresh.statuses.every((s) => s === 'empty')).toBe(true);
    expect(fresh.gameStatus).toBe('playing');
    expect(fresh.words).toBe(state.words);
  });
});

describe('selecteurs', () => {
  it('wordsAtCell retourne les mots couvrant une case', () => {
    const state = makeGame();
    expect(wordsAtCell(state, 1).map((w) => w.id)).toEqual([0]);
    expect(wordsAtCell(state, 4).map((w) => w.id)).toEqual([1]);
  });

  it('wordsFromClue retourne les mots d une case-indice dans lordre des entrees', () => {
    const state = makeGame();
    expect(wordsFromClue(state, 0).map((w) => w.id)).toEqual([0]);
    expect(wordsFromClue(state, 3).map((w) => w.id)).toEqual([1]);
  });
});
