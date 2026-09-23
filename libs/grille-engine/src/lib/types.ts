import { Arrow, GridDefinition, GridSolution } from 'shared';

export type LetterStatus = 'empty' | 'filled' | 'correct' | 'wrong';

export type GameStatus = 'playing' | 'won';

export interface Word {
  id: number;
  clueIndex: number;
  definition: string;
  arrow: Arrow;
  direction: 'horizontal' | 'vertical';
  start: number;
  cells: number[];
  length: number;
  answer: string;
}

export interface GameState {
  grid: GridDefinition;
  solution: GridSolution;
  words: Word[];
  letters: (string | null)[];
  statuses: LetterStatus[];
  gameStatus: GameStatus;
}
