import { describe, expect, expectTypeOf, it } from 'vitest';
import { GridBuildError, SetLetterError, ValidationError } from './errors';
import { GameStatus, Word } from './types';

describe('contrats du moteur', () => {
  it('expose les statuts et directions attendus', () => {
    expectTypeOf<GameStatus>().toEqualTypeOf<'playing' | 'won'>();
    expectTypeOf<Word['direction']>().toEqualTypeOf<'horizontal' | 'vertical'>();
  });

  it('expose les unions d erreurs discriminées', () => {
    const buildErrors: GridBuildError['kind'][] = [
      'invalidDimensions',
      'cellsLength',
      'tooManyEntries',
      'emptyEntries',
      'wordOutOfBounds',
      'wordThroughClue',
      'wordOverlap',
      'uncoveredCell',
      'solutionMismatch',
    ];
    const setLetterErrors: SetLetterError['kind'][] = [
      'notALetterCell',
      'invalidLetter',
      'gameWon',
    ];
    const validationErrors: ValidationError['kind'][] = ['wordNotFound', 'noWordSelected'];
    expect(buildErrors).toHaveLength(9);
    expect(setLetterErrors).toHaveLength(3);
    expect(validationErrors).toHaveLength(2);
  });
});
