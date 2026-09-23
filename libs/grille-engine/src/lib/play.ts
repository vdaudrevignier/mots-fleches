import { Result, err, ok } from 'shared';
import { SetLetterError, ValidationError } from './errors';
import { GameState, Word } from './types';

const LETTER_PATTERN = /^[A-Z]$/;

function isLetterCell(state: GameState, cell: number): boolean {
  return cell >= 0 && cell < state.grid.cells.length && state.grid.cells[cell].kind === 'letter';
}

function letterCells(state: GameState): number[] {
  const cells: number[] = [];
  for (let i = 0; i < state.grid.cells.length; i++) {
    if (state.grid.cells[i].kind === 'letter') cells.push(i);
  }
  return cells;
}

export function setLetter(
  state: GameState,
  cell: number,
  letter: string,
): Result<GameState, SetLetterError> {
  if (state.gameStatus === 'won') return err({ kind: 'gameWon' });
  if (!isLetterCell(state, cell)) return err({ kind: 'notALetterCell' });
  if (!LETTER_PATTERN.test(letter)) return err({ kind: 'invalidLetter' });

  const letters = [...state.letters];
  const statuses = [...state.statuses];
  letters[cell] = letter;
  statuses[cell] = 'filled';

  const next: GameState = { ...state, letters, statuses };
  return ok(isWon(next) ? { ...next, gameStatus: 'won' } : next);
}

export function clearLetter(state: GameState, cell: number): Result<GameState, SetLetterError> {
  if (state.gameStatus === 'won') return err({ kind: 'gameWon' });
  if (!isLetterCell(state, cell)) return err({ kind: 'notALetterCell' });

  const letters = [...state.letters];
  const statuses = [...state.statuses];
  letters[cell] = null;
  statuses[cell] = 'empty';

  return ok({ ...state, letters, statuses });
}

export function validateWord(
  state: GameState,
  wordId: number | null,
): Result<GameState, ValidationError> {
  if (wordId === null) return err({ kind: 'noWordSelected' });
  const word = state.words.find((candidate) => candidate.id === wordId);
  if (!word) return err({ kind: 'wordNotFound' });
  return ok(applyValidation(state, word.cells));
}

export function validateAll(state: GameState): GameState {
  return applyValidation(state, letterCells(state));
}

export function isWon(state: GameState): boolean {
  return letterCells(state).every((cell) => state.letters[cell] === state.solution.letters[cell]);
}

export function reset(state: GameState): GameState {
  const size = state.grid.width * state.grid.height;
  return {
    ...state,
    letters: Array.from({ length: size }, () => null),
    statuses: Array.from({ length: size }, () => 'empty' as const),
    gameStatus: 'playing',
  };
}

export function wordsAtCell(state: GameState, cell: number): Word[] {
  return state.words.filter((word) => word.cells.includes(cell));
}

export function wordsFromClue(state: GameState, clueIndex: number): Word[] {
  return state.words.filter((word) => word.clueIndex === clueIndex);
}

function applyValidation(state: GameState, cells: number[]): GameState {
  const statuses = [...state.statuses];
  for (const cell of cells) {
    if (state.letters[cell] === null) continue;
    statuses[cell] = state.letters[cell] === state.solution.letters[cell] ? 'correct' : 'wrong';
  }
  const next: GameState = { ...state, statuses };
  return isWon(next) ? { ...next, gameStatus: 'won' } : next;
}
