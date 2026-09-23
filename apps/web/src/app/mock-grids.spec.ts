import { describe, expect, it } from 'vitest';
import { MockGridKey, buildMockGame } from './mock-grids';

const ANSWERS_6 = [
  'NU',
  'OS',
  'LE',
  'OR',
  'DO',
  'CARRE',
  'A',
  'RA',
  'TU',
  'ET',
  'AI',
  'OU',
  'NI',
  'A',
  'RE',
  'T',
];

const ANSWERS_10 = [
  'CI',
  'CHRONIQUES',
  'PI',
  'PERFORMANT',
  'SAL',
  'SOLUTIONNE',
  'HA',
  'ET',
  'OSE',
  'RU',
  'RA',
  'LUE',
  'ON',
  'FI',
  'UNI',
  'NE',
  'ON',
  'TAU',
  'IL',
  'RE',
  'IRE',
  'QI',
  'MA',
  'OSA',
  'UN',
  'AN',
  'NID',
  'EN',
  'NU',
  'NET',
  'SI',
  'TA',
  'EAU',
];

describe('mock grids', () => {
  it.each([
    ['6', ANSWERS_6],
    ['10', ANSWERS_10],
  ] as [MockGridKey, string[]][])(
    'construit la grille %s et verrouille ses reponses',
    (key, answers) => {
      const result = buildMockGame(key);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.words.map((w) => w.answer)).toEqual(answers);
      for (const word of result.value.words) {
        expect(word.answer).toMatch(/^[A-Z]+$/);
      }
    },
  );
});
