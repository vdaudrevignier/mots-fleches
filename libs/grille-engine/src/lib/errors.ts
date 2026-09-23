export type GridBuildError =
  | { kind: 'invalidDimensions' }
  | { kind: 'cellsLength' }
  | { kind: 'tooManyEntries' }
  | { kind: 'emptyEntries' }
  | { kind: 'wordOutOfBounds' }
  | { kind: 'wordThroughClue' }
  | { kind: 'wordOverlap' }
  | { kind: 'uncoveredCell' }
  | { kind: 'solutionMismatch' };

export type SetLetterError =
  { kind: 'notALetterCell' } | { kind: 'invalidLetter' } | { kind: 'gameWon' };

export type ValidationError = { kind: 'wordNotFound' } | { kind: 'noWordSelected' };
