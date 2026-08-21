# Moteur de grille — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un moteur de mots fléchés en TypeScript pur (lib `grille-engine` 100% testable sans DOM) plus une page de jeu `/grille` jouable au clavier et à la souris avec deux grilles mockées.

**Architecture:** Contrats de données partagés dans `libs/shared` (grille + `Result`), moteur pur dans `libs/grille-engine` (dérivation des mots depuis les flèches, garde-fous de cohérence, gameplay immuable), rendu Angular par signaux dans `apps/web` (composants `Grille` et `Cellule`, route `/grille`). Le moteur ne dépend que de ses entrées ; la sélection (cellule/mot courants) reste de l'état UI.

**Tech Stack:** TypeScript, Nx 23, Vitest, Angular 22 (signaux, composants standalone, OnPush), aucun backend.

**Spec:** `docs/superpowers/specs/2026-08-20-moteur-grille-design.md` — le plan s'appuie sur la spec ; les exécuteurs lisent les deux.

## Global Constraints

- Node 24 / npm 11 (aligné avec la CI, cf. `.github/workflows/ci.yml`).
- Tests : Vitest partout, commande `npx nx test <projet>`.
- Commits : Conventional Commits (commitlint actif) ; hook pre-commit = prettier via lint-staged.
- Format : `.prettierrc` = printWidth 100, singleQuote, trailingComma all. Le hook reformate au commit.
- Angular 22 : classes **sans suffixe** (`App`, `Grille`, `Cellule`), composants standalone, `ChangeDetectionStrategy.OnPush`, API `input()`/`output()`/`signal()`.
- Moteur : fonctions pures, état immuable — ne jamais muter `GameState`, toujours créer de nouveaux tableaux/objets. Aucune dépendance à Angular ou au DOM dans `libs/grille-engine`.
- Interdiction de commentaires dans le code.
- Imports inter-lib via les alias tsconfig : `'shared'` existe déjà ; après génération de `grille-engine`, vérifier l'alias exact créé dans `tsconfig.base.json` et l'utiliser partout (ce plan suppose `'grille-engine'`).
- Environnement Windows PowerShell : chaîner avec `;` ou `if ($?) { }` (pas de `&&`) ; timeouts généreux (`api:build` ≈ 40 s).
- Copie UI en français (« Vérifier », « Rejouer », « Gagné ! »).

## Interprétations du spec (décisions liantes)

1. `validateAll`, `isWon` et `reset` retournent des valeurs nues (`GameState` / `boolean`), pas des `Result` : ils n'ont aucune voie d'erreur.
2. `SetLetterError` est étendu avec `{ kind: 'invalidLetter' }` : une saisie qui n'est pas une majuscule A-Z est rejetée avec une erreur typée plutôt qu'acceptée silencieusement.
3. Sélecteurs purs ajoutés pour l'UI : `wordsAtCell(state, cell)` et `wordsFromClue(state, clueIndex)`. La sélection reste hors moteur.
4. `validateWord(state, wordId)` accepte `number | null` ; `null` → `{ kind: 'noWordSelected' }`, id inconnu → `{ kind: 'wordNotFound' }`.
5. La validation ne touche pas les cases vides : elles restent `'empty'` (pas de rouge sur du vide).
6. `setLetter` bascule `gameStatus` à `'won'` dès que la grille est complète et juste ; `validateAll` fait de même.
7. `clearLetter` sur une partie gagnée → `{ kind: 'gameWon' }` (cohérent avec `setLetter`).
8. `wordThroughClue` signifie : la cellule de départ désignée par la flèche est elle-même une case-indice. Les mots s'arrêtent normalement sur une case-indice rencontrée en chemin (cf. spec, « jusqu'à la prochaine case-indice »).
9. Ordre déterministe des garde-fous de `buildGame` (les tests s'y fient quand plusieurs erreurs s'appliquent) : `invalidDimensions` → `cellsLength` → `solutionMismatch` → `emptyEntries`/`tooManyEntries` (parcours par index) → `wordOutOfBounds`/`wordThroughClue` (ordre de dérivation) → `wordOverlap` → `uncoveredCell`.

## Structure de fichiers

```
libs/shared/
  src/lib/grid.ts                    # Arrow, ClueEntry, GridCell, GridDefinition, GridSolution + rowOf/colOf/cellIndex
  src/lib/grid.spec.ts
  src/lib/result.ts                  # Result<T,E>, ok(), err()
  src/lib/result.spec.ts
  src/index.ts                       # modifié : ré-exporte tout (garde shared())

libs/grille-engine/                  # généré par Nx (tâche 2)
  src/index.ts                       # ré-exporte types, errors, build-game, play
  src/lib/types.ts                   # LetterStatus, GameStatus, Word, GameState
  src/lib/types.spec.ts              # test léger de contrats
  src/lib/errors.ts                  # GridBuildError, SetLetterError, ValidationError
  src/lib/derive-words.ts            # dérivation géométrique des mots
  src/lib/derive-words.spec.ts
  src/lib/build-game.ts              # buildGame + garde-fous
  src/lib/build-game.spec.ts
  src/lib/play.ts                    # setLetter, clearLetter, validateWord, validateAll, isWon, reset + sélecteurs
  src/lib/play.spec.ts

apps/web/src/app/
  mock-grids.ts                      # MOCK_GRID_6/_SOLUTION, MOCK_GRID_10/_SOLUTION, buildMockGame
  mock-grids.spec.ts
  grille/
    grille.ts | grille.html | grille.scss | grille.spec.ts
    cellule.ts | cellule.html | cellule.scss
  app.routes.ts                      # modifié : route /grille (lazy)
  app.ts                             # modifié : import RouterLink
  app.html                           # remplacé : nav minimale + router-outlet
  app.spec.ts                        # modifié : provideRouter([]) + nouveau titre
```

---

### Task 1: Contrats partagés — grille, coordonnées, Result

**Files:**

- Create: `libs/shared/src/lib/grid.ts`
- Create: `libs/shared/src/lib/grid.spec.ts`
- Create: `libs/shared/src/lib/result.ts`
- Create: `libs/shared/src/lib/result.spec.ts`
- Modify: `libs/shared/src/index.ts`

**Interfaces:**

- Consumes: rien (feuille).
- Produces: `Arrow`, `ClueEntry`, `GridCell`, `GridDefinition`, `GridSolution`, `rowOf(index, width)`, `colOf(index, width)`, `cellIndex(row, col, width)`, `Result<T, E>`, `ok(value)`, `err(error)` — utilisés par toutes les tâches suivantes.

- [ ] **Step 1: Écrire les tests qui échouent**

`libs/shared/src/lib/grid.spec.ts` :

```ts
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
```

`libs/shared/src/lib/result.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { err, ok } from './result';

describe('Result', () => {
  it('encapsule une valeur', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('encapsule une erreur', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx nx test shared`
Expected: FAIL — modules `./grid` et `./result` introuvables.

- [ ] **Step 3: Implémenter**

`libs/shared/src/lib/grid.ts` :

```ts
export type Arrow = 'right' | 'down' | 'down-right' | 'right-down';

export interface ClueEntry {
  definition: string;
  arrow: Arrow;
}

export type GridCell = { kind: 'letter' } | { kind: 'clue'; entries: ClueEntry[] };

export interface GridDefinition {
  width: number;
  height: number;
  cells: GridCell[];
}

export interface GridSolution {
  letters: string[];
}

export function rowOf(index: number, width: number): number {
  return Math.floor(index / width);
}

export function colOf(index: number, width: number): number {
  return index % width;
}

export function cellIndex(row: number, col: number, width: number): number {
  return row * width + col;
}
```

`libs/shared/src/lib/result.ts` :

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

`libs/shared/src/index.ts` (contenu complet, garder l'existant `shared`) :

```ts
export * from './lib/shared';
export * from './lib/grid';
export * from './lib/result';
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx nx test shared`
Expected: PASS (tests existants `shared()` inclus).

- [ ] **Step 5: Commit**

```bash
git add libs/shared
git commit -m "feat(shared): grid contracts, coords helpers and Result type"
```

---

### Task 2: Squelette grille-engine — types et erreurs

**Files:**

- Create: `libs/grille-engine/` (généré Nx) puis `src/lib/types.ts`, `src/lib/types.spec.ts`, `src/lib/errors.ts`
- Modify: `libs/grille-engine/src/index.ts`, suppression du boilerplate `src/lib/grille-engine.ts`

**Interfaces:**

- Consumes: `Arrow`, `GridDefinition`, `GridSolution` depuis `'shared'` (Task 1).
- Produces: `LetterStatus`, `GameStatus`, `Word`, `GameState`, `GridBuildError`, `SetLetterError`, `ValidationError` — consommés par Tasks 3-7.

- [ ] **Step 1: Générer la lib**

Run: `npx nx g @nx/js:lib grille-engine --unitTestRunner=vitest --projectNameAndRootFormat=as-provided`
Expected: lib créée dans `libs/grille-engine` avec `project.json`, `vitest.config.mts`, `tsconfig*.json`, et un alias ajouté dans `tsconfig.base.json`.

Vérifier l'alias créé dans `tsconfig.base.json` (`"grille-engine"` attendu, peut être préfixé d'un scope). Si l'alias diffère, utiliser l'alias réel dans TOUS les imports des tâches suivantes.

- [ ] **Step 2: Nettoyer le boilerplate**

Supprimer `libs/grille-engine/src/lib/grille-engine.ts` et `libs/grille-engine/src/lib/grille-engine.spec.ts`. Remplacer `libs/grille-engine/src/index.ts` par :

```ts
export * from './lib/types';
export * from './lib/errors';
```

- [ ] **Step 3: Écrire le test de contrats (échoue)**

`libs/grille-engine/src/lib/types.spec.ts` :

```ts
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
```

Run: `npx nx test grille-engine`
Expected: FAIL — `./types` et `./errors` introuvables.

- [ ] **Step 4: Implémenter types et erreurs**

`libs/grille-engine/src/lib/types.ts` :

```ts
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
```

`libs/grille-engine/src/lib/errors.ts` :

```ts
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
```

- [ ] **Step 5: Vérifier que les tests passent**

Run: `npx nx test grille-engine`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/grille-engine tsconfig.base.json
git commit -m "feat(grille-engine): scaffold lib with game types and error unions"
```

---

### Task 3: Dérivation des mots depuis les flèches

**Files:**

- Create: `libs/grille-engine/src/lib/derive-words.ts`
- Create: `libs/grille-engine/src/lib/derive-words.spec.ts`
- Modify: `libs/grille-engine/src/index.ts` (ajouter le ré-export)

**Interfaces:**

- Consumes: `Arrow`, `GridDefinition`, `colOf`, `rowOf` depuis `'shared'` ; `Result`, `err`, `ok`.
- Produces: `WordCandidate` (forme géométrique sans `id`/`answer`), `DeriveError = { kind: 'wordOutOfBounds' } | { kind: 'wordThroughClue' }`, `deriveWords(grid): Result<WordCandidate[], DeriveError>` — consommés par Task 4.

Géométrie (spec, « Les quatre flèches »), pour une case-indice d'index `i`, ligne `r`, colonne `c` :

| Flèche       | Départ     | Direction  |
| ------------ | ---------- | ---------- |
| `right`      | `(r, c+1)` | horizontal |
| `down`       | `(r+1, c)` | vertical   |
| `down-right` | `(r+1, c)` | horizontal |
| `right-down` | `(r, c+1)` | vertical   |

Le mot avance case par case tant qu'il reste dans la grille sur des cases-lettres ; il s'arrête au bord ou sur la première case-indice rencontrée. Erreurs : départ hors grille → `wordOutOfBounds` ; départ sur case-indice → `wordThroughClue`.

- [ ] **Step 1: Écrire les tests qui échouent**

`libs/grille-engine/src/lib/derive-words.spec.ts` :

```ts
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
    const grid = gridFrom(['C..', 'ABC'], { 0: [{ definition: 'd', arrow: 'down-right' }] });
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
    const grid = gridFrom(['A'], { 0: [{ definition: 'd', arrow: 'down' }] });
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
```

Run: `npx nx test grille-engine`
Expected: FAIL — `./derive-words` introuvable.

- [ ] **Step 2: Implémenter**

`libs/grille-engine/src/lib/derive-words.ts` :

```ts
import { Arrow, GridDefinition, colOf, rowOf } from 'shared';
import { Result, err, ok } from 'shared';

export type DeriveError = { kind: 'wordOutOfBounds' } | { kind: 'wordThroughClue' };

export interface WordCandidate {
  clueIndex: number;
  definition: string;
  arrow: Arrow;
  direction: 'horizontal' | 'vertical';
  start: number;
  cells: number[];
}

export function deriveWords(grid: GridDefinition): Result<WordCandidate[], DeriveError> {
  const { width, height, cells } = grid;
  const candidates: WordCandidate[] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.kind !== 'clue') continue;

    for (const entry of cell.entries) {
      const r = rowOf(i, width);
      const c = colOf(i, width);

      let startRow: number;
      let startCol: number;
      let direction: 'horizontal' | 'vertical';
      switch (entry.arrow) {
        case 'right':
          startRow = r;
          startCol = c + 1;
          direction = 'horizontal';
          break;
        case 'down':
          startRow = r + 1;
          startCol = c;
          direction = 'vertical';
          break;
        case 'down-right':
          startRow = r + 1;
          startCol = c;
          direction = 'horizontal';
          break;
        case 'right-down':
          startRow = r;
          startCol = c + 1;
          direction = 'vertical';
          break;
      }

      if (startRow < 0 || startRow >= height || startCol < 0 || startCol >= width) {
        return err({ kind: 'wordOutOfBounds' });
      }

      const start = startRow * width + startCol;
      if (cells[start].kind !== 'letter') {
        return err({ kind: 'wordThroughClue' });
      }

      const wordCells: number[] = [];
      let wr = startRow;
      let wc = startCol;
      while (
        wr >= 0 &&
        wr < height &&
        wc >= 0 &&
        wc < width &&
        cells[wr * width + wc].kind === 'letter'
      ) {
        wordCells.push(wr * width + wc);
        if (direction === 'horizontal') {
          wc++;
        } else {
          wr++;
        }
      }

      candidates.push({
        clueIndex: i,
        definition: entry.definition,
        arrow: entry.arrow,
        direction,
        start,
        cells: wordCells,
      });
    }
  }

  return ok(candidates);
}
```

Ajouter à `libs/grille-engine/src/index.ts` :

```ts
export * from './lib/derive-words';
```

- [ ] **Step 3: Vérifier que les tests passent**

Run: `npx nx test grille-engine`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/grille-engine
git commit -m "feat(grille-engine): derive words from clue arrows"
```

---

### Task 4: buildGame — construction et garde-fous

**Files:**

- Create: `libs/grille-engine/src/lib/build-game.ts`
- Create: `libs/grille-engine/src/lib/build-game.spec.ts`
- Modify: `libs/grille-engine/src/index.ts` (ajouter le ré-export)

**Interfaces:**

- Consumes: `GridDefinition`, `GridSolution`, `Result`, `err`, `ok` depuis `'shared'` ; `DeriveError`, `deriveWords`, `WordCandidate` (Task 3) ; `GameState`, `Word`, `GridBuildError` (Task 2).
- Produces: `buildGame(input: { grid: GridDefinition; solution: GridSolution }): Result<GameState, GridBuildError>` — consommé par Tasks 5-7.

Ordre des garde-fous (Interprétation 9) : `invalidDimensions` → `cellsLength` → `solutionMismatch` → `emptyEntries`/`tooManyEntries` → `wordOutOfBounds`/`wordThroughClue` → `wordOverlap` → `uncoveredCell`. Les ids des mots sont attribués dans l'ordre de dérivation (index de case-indice croissant, puis ordre des entrées).

- [ ] **Step 1: Écrire les tests qui échouent**

`libs/grille-engine/src/lib/build-game.spec.ts` :

```ts
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
```

Run: `npx nx test grille-engine`
Expected: FAIL — `./build-game` introuvable.

- [ ] **Step 2: Implémenter**

`libs/grille-engine/src/lib/build-game.ts` :

```ts
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
```

Ajouter à `libs/grille-engine/src/index.ts` :

```ts
export * from './lib/build-game';
```

- [ ] **Step 3: Vérifier que les tests passent**

Run: `npx nx test grille-engine`
Expected: PASS (tous les fichiers de spec du projet).

- [ ] **Step 4: Commit**

```bash
git add libs/grille-engine
git commit -m "feat(grille-engine): buildGame with grid coherence guards"
```

---

### Task 5: Gameplay — saisie, validation, victoire, sélecteurs

**Files:**

- Create: `libs/grille-engine/src/lib/play.ts`
- Create: `libs/grille-engine/src/lib/play.spec.ts`
- Modify: `libs/grille-engine/src/index.ts` (ajouter le ré-export)

**Interfaces:**

- Consumes: `Result`, `err`, `ok` depuis `'shared'` ; `GameState`, `Word`, `SetLetterError`, `ValidationError` (Tasks 2 et 4) ; `buildGame` (Task 4) pour les fixtures.
- Produces: `setLetter(state, cell, letter): Result<GameState, SetLetterError>`, `clearLetter(state, cell): Result<GameState, SetLetterError>`, `validateWord(state, wordId: number | null): Result<GameState, ValidationError>`, `validateAll(state): GameState`, `isWon(state): boolean`, `reset(state): GameState`, `wordsAtCell(state, cell): Word[]`, `wordsFromClue(state, clueIndex): Word[]` — consommés par Task 7.

- [ ] **Step 1: Écrire les tests qui échouent**

`libs/grille-engine/src/lib/play.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { ClueEntry, GridDefinition, GridSolution } from 'shared';
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
```

Run: `npx nx test grille-engine`
Expected: FAIL — `./play` introuvable.

- [ ] **Step 2: Implémenter**

`libs/grille-engine/src/lib/play.ts` :

```ts
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
```

Remplacer `libs/grille-engine/src/index.ts` par :

```ts
export * from './lib/types';
export * from './lib/errors';
export * from './lib/derive-words';
export * from './lib/build-game';
export * from './lib/play';
```

- [ ] **Step 3: Vérifier que les tests passent**

Run: `npx nx test grille-engine`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/grille-engine
git commit -m "feat(grille-engine): gameplay mutations, validation and selectors"
```

---

### Task 6: Grilles mockées avec solutions vérifiées

**Files:**

- Create: `apps/web/src/app/mock-grids.ts`
- Create: `apps/web/src/app/mock-grids.spec.ts`

**Interfaces:**

- Consumes: `buildGame` depuis `'grille-engine'` ; `GridCell`, `GridDefinition`, `GridSolution` depuis `'shared'`.
- Produces: `MOCK_GRID_6`, `MOCK_GRID_6_SOLUTION`, `MOCK_GRID_10`, `MOCK_GRID_10_SOLUTION`, `type MockGridKey = '6' | '10'`, `buildMockGame(key: MockGridKey)` — consommés par Task 7.

Les deux grilles ont été conçues et validées hors dépôt (couverture 100% des cases-lettres, aucun chevauchement par axe, croisements H/V présents, solutions cohérentes lettre à lettre). Le spec de cette tâche verrouille les données : nombre de mots et réponses exactes.

6×6 « quadrant + anneau » : 8 case-indices (entrées ×2), 16 mots, 28 cases-lettres couvertes.
10×10 « bandes » : indices aux colonnes 0/3/6 de chaque ligne, 3 verticales traversantes (CHRONIQUES, PERFORMANT, SOLUTIONNE), 33 mots, 70 cases-lettres couvertes.

- [ ] **Step 1: Écrire le test qui échoue**

`apps/web/src/app/mock-grids.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { MockGridKey, buildMockGame } from './mock-grids';

const ANSWERS_6 = [
  'AU',
  'OS',
  'LE',
  'UR',
  'LU',
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
  'IL',
  'TAU',
  'QI',
  'RE',
  'IRE',
  'UN',
  'MA',
  'OSA',
  'EN',
  'AN',
  'NID',
  'SA',
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
```

Run: `npx nx test web`
Expected: FAIL — `./mock-grids` introuvable.

- [ ] **Step 2: Implémenter les données**

`apps/web/src/app/mock-grids.ts` :

```ts
import { buildGame } from 'grille-engine';
import { GridCell, GridDefinition, GridSolution } from 'shared';

export const MOCK_GRID_6: GridDefinition = {
  width: 6,
  height: 6,
  cells: [
    {
      kind: 'clue',
      entries: [
        { definition: 'Métal précieux', arrow: 'right' },
        { definition: 'Dans le squelette', arrow: 'down' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    {
      kind: 'clue',
      entries: [
        { definition: 'Article défini', arrow: 'right' },
        { definition: 'Bœuf sauvage', arrow: 'down' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    {
      kind: 'clue',
      entries: [
        { definition: 'A été parcouru des yeux', arrow: 'right' },
        { definition: 'Quatre côtés égaux', arrow: 'down-right' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    {
      kind: 'clue',
      entries: [
        { definition: 'Voyelle', arrow: 'right' },
        { definition: 'Dieu solaire égyptien', arrow: 'down' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    {
      kind: 'clue',
      entries: [
        { definition: 'Pronom personnel', arrow: 'right' },
        { definition: 'Conjonction de coordination', arrow: 'down' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    {
      kind: 'clue',
      entries: [
        { definition: 'Forme de « avoir »', arrow: 'right' },
        { definition: 'Choix entre deux choses', arrow: 'down' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    {
      kind: 'clue',
      entries: [
        { definition: 'Négation appariée', arrow: 'right-down' },
        { definition: 'Première voyelle', arrow: 'down' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    {
      kind: 'clue',
      entries: [
        { definition: 'Note de musique', arrow: 'right-down' },
        { definition: 'Lettre', arrow: 'down' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
  ],
};

export const MOCK_GRID_6_SOLUTION: GridSolution = {
  letters: [
    '',
    'A',
    'U',
    '',
    'L',
    'E',
    'O',
    '',
    'L',
    'U',
    '',
    'A',
    'S',
    'C',
    'A',
    'R',
    'R',
    'E',
    '',
    'T',
    'U',
    '',
    'A',
    'I',
    'E',
    '',
    'N',
    'O',
    '',
    'R',
    'T',
    'A',
    'I',
    'U',
    'T',
    'E',
  ],
};

export const MOCK_GRID_10: GridDefinition = {
  width: 10,
  height: 10,
  cells: [
    {
      kind: 'clue',
      entries: [
        { definition: 'Ancien pronom démonstratif', arrow: 'right' },
        { definition: 'Rubriques journalistiques', arrow: 'right-down' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    {
      kind: 'clue',
      entries: [
        { definition: 'Environ 3,14', arrow: 'right' },
        { definition: 'Qui donne de bons résultats', arrow: 'right-down' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    {
      kind: 'clue',
      entries: [
        { definition: 'Sel, en latin', arrow: 'right' },
        { definition: 'Résout', arrow: 'right-down' },
      ],
    },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Exclamation de rire', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Conjonction de coordination', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Tente, ose', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Petit ruisseau', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Dieu solaire égyptien', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Lu, au féminin', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Pronom indéfini', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Vieille exclamation de dégoût', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Sans aspérités', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Adverbe de négation', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Pronom personnel', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Lettre grecque', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Indice d intelligence', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Note de musique', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Courroux', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Nombre', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Mon, au féminin', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Passé simple de « oser »', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Préposition ou pronom', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Douze mois', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Logement des oiseaux', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Son, au féminin', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Sans vêtements', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Propre', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Conjonction de condition', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'Ton, au féminin', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'clue', entries: [{ definition: 'H₂O', arrow: 'right' }] },
    { kind: 'letter' },
    { kind: 'letter' },
    { kind: 'letter' },
  ],
};

export const MOCK_GRID_10_SOLUTION: GridSolution = {
  letters: [
    '',
    'C',
    'I',
    '',
    'P',
    'I',
    '',
    'S',
    'A',
    'L',
    '',
    'H',
    'A',
    '',
    'E',
    'T',
    '',
    'O',
    'S',
    'E',
    '',
    'R',
    'U',
    '',
    'R',
    'A',
    '',
    'L',
    'U',
    'E',
    '',
    'O',
    'N',
    '',
    'F',
    'I',
    '',
    'U',
    'N',
    'I',
    '',
    'N',
    'E',
    '',
    'O',
    'N',
    '',
    'T',
    'A',
    'U',
    '',
    'I',
    'L',
    '',
    'R',
    'E',
    '',
    'I',
    'R',
    'E',
    '',
    'Q',
    'I',
    '',
    'M',
    'A',
    '',
    'O',
    'S',
    'A',
    '',
    'U',
    'N',
    '',
    'A',
    'N',
    '',
    'N',
    'I',
    'D',
    '',
    'E',
    'N',
    '',
    'N',
    'U',
    '',
    'N',
    'E',
    'T',
    '',
    'S',
    'I',
    '',
    'T',
    'A',
    '',
    'E',
    'A',
    'U',
  ],
};

export type MockGridKey = '6' | '10';

export function buildMockGame(key: MockGridKey) {
  return key === '6'
    ? buildGame({ grid: MOCK_GRID_6, solution: MOCK_GRID_6_SOLUTION })
    : buildGame({ grid: MOCK_GRID_10, solution: MOCK_GRID_10_SOLUTION });
}
```

Note : le type `GridCell` est utilisé implicitement via `GridDefinition` ; si ESLint signale un import inutilisé, retirer `GridCell` de l'import.

- [ ] **Step 3: Vérifier que les tests passent**

Run: `npx nx test web`
Expected: PASS — les deux grilles construisent avec exactement les réponses attendues (si une réponse diffère, une coquille s'est glissée dans les données : corriger la donnée, jamais le test).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/mock-grids.ts apps/web/src/app/mock-grids.spec.ts
git commit -m "feat(web): mock grids with verified solutions"
```

---

### Task 7: Page de jeu /grille — rendu, clavier, souris, victoire

**Files:**

- Create: `apps/web/src/app/grille/cellule.ts`, `cellule.html`, `cellule.scss`
- Create: `apps/web/src/app/grille/grille.ts`, `grille.html`, `grille.scss`, `grille.spec.ts`
- Modify: `apps/web/src/app/app.routes.ts`
- Modify: `apps/web/src/app/app.ts`
- Modify: `apps/web/src/app/app.html` (remplacement complet)
- Modify: `apps/web/src/app/app.spec.ts`
- Verify: `apps/web/src/app/app.config.ts` contient bien `provideRouter(routes)` (le squelette Angular l'inclut ; l'ajouter sinon)

**Interfaces:**

- Consumes: tout le moteur (`setLetter`, `clearLetter`, `validateWord`, `validateAll`, `isWon`, `reset`, `wordsAtCell`, `wordsFromClue`, `GameState`) et `buildMockGame`/`MockGridKey` (Task 6) ; `rowOf`, `colOf`, `GridCell` depuis `'shared'`.
- Produces: composants `Cellule` (selector `app-cellule`) et `Grille` (selector `app-grille`), route `/grille`.

- [ ] **Step 1: Créer le composant Cellule**

`apps/web/src/app/grille/cellule.ts` :

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { GridCell } from 'shared';

const ARROW_GLYPHS: Record<string, string> = {
  right: '→',
  down: '↓',
  'down-right': '↳',
  'right-down': '⬎',
};

@Component({
  selector: 'app-cellule',
  templateUrl: './cellule.html',
  styleUrl: './cellule.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cellule {
  readonly cell = input.required<GridCell>();
  readonly letter = input<string | null>(null);
  readonly status = input.required<'empty' | 'filled' | 'correct' | 'wrong'>();
  readonly selected = input(false);
  readonly inSelectedWord = input(false);
  readonly cellClick = output<void>();

  protected glyph(arrow: string): string {
    return ARROW_GLYPHS[arrow] ?? '?';
  }
}
```

`apps/web/src/app/grille/cellule.html` :

```html
@if (cell(); as c) { @if (c.kind === 'clue') {
<button type="button" class="case-indice" (click)="cellClick.emit()">
  @for (entry of c.entries; track $index) {
  <span class="definition">
    <span class="fleche">{{ glyph(entry.arrow) }}</span>
    {{ entry.definition }}
  </span>
  }
</button>
} @else {
<button
  type="button"
  class="case-lettre"
  [class.selected]="selected()"
  [class.in-word]="inSelectedWord()"
  [class.correct]="status() === 'correct'"
  [class.wrong]="status() === 'wrong'"
  (click)="cellClick.emit()"
>
  {{ letter() ?? '' }}
</button>
} }
```

`apps/web/src/app/grille/cellule.scss` :

```scss
:host {
  display: block;
  aspect-ratio: 1;
}

button {
  width: 100%;
  height: 100%;
  border: 1px solid #b8b2a7;
  background: #fffdf7;
  font: inherit;
  cursor: pointer;
  padding: 0;
}

.case-lettre {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.9rem, 2.5vw, 1.4rem);
  font-weight: 600;
  color: #2b2b2b;
  text-transform: uppercase;

  &.in-word {
    background: #fdf3d7;
  }

  &.selected {
    outline: 3px solid #1a73e8;
    outline-offset: -3px;
    background: #e8f0fe;
  }

  &.correct {
    color: #1e7d32;
    background: #e6f4ea;
  }

  &.wrong {
    color: #b3261e;
    background: #fce8e6;
  }
}

.case-indice {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 2px;
  background: #efe9dc;
  overflow: hidden;
  padding: 2px;
  text-align: left;

  .definition {
    display: block;
    font-size: clamp(0.34rem, 1vw, 0.55rem);
    line-height: 1.15;
    color: #4a4438;
  }

  .fleche {
    font-weight: 700;
    margin-right: 2px;
  }
}
```

- [ ] **Step 2: Créer le composant Grille**

`apps/web/src/app/grille/grille.ts` :

```ts
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  GameState,
  clearLetter,
  reset,
  setLetter,
  validateAll,
  validateWord,
  wordsAtCell,
  wordsFromClue,
} from 'grille-engine';
import { colOf, rowOf } from 'shared';
import { MockGridKey, buildMockGame } from '../mock-grids';
import { Cellule } from './cellule';

function builtOrThrow(key: MockGridKey): GameState {
  const result = buildMockGame(key);
  if (!result.ok) throw new Error(`grille mockee invalide: ${result.error.kind}`);
  return result.value;
}

@Component({
  selector: 'app-grille',
  imports: [Cellule],
  templateUrl: './grille.html',
  styleUrl: './grille.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class Grille {
  protected readonly state = signal<GameState>(builtOrThrow('6'));
  protected readonly selectedCell = signal<number | null>(null);
  protected readonly selectedWordId = signal<number | null>(null);

  protected readonly columns = computed(() => this.state().grid.width);
  protected readonly selectedWord = computed(
    () => this.state().words.find((w) => w.id === this.selectedWordId()) ?? null,
  );

  protected switchGrid(key: MockGridKey): void {
    this.state.set(builtOrThrow(key));
    this.selectedCell.set(null);
    this.selectedWordId.set(null);
  }

  protected onCellClick(cell: number): void {
    const state = this.state();
    if (state.grid.cells[cell].kind !== 'letter') {
      this.cycleClue(cell);
      return;
    }
    const covering = wordsAtCell(state, cell);
    if (covering.length === 0) return;
    if (this.selectedCell() === cell) {
      const position = covering.findIndex((w) => w.id === this.selectedWordId());
      this.selectedWordId.set(covering[(position + 1) % covering.length].id);
    } else {
      this.selectedCell.set(cell);
      const kept = covering.find((w) => w.id === this.selectedWordId());
      this.selectedWordId.set((kept ?? covering[0]).id);
    }
  }

  private cycleClue(clueIndex: number): void {
    const words = wordsFromClue(this.state(), clueIndex);
    if (words.length === 0) return;
    const position = words.findIndex((w) => w.id === this.selectedWordId());
    const next = words[(position + 1) % words.length];
    this.selectedWordId.set(next.id);
    this.selectedCell.set(next.start);
  }

  protected verifier(): void {
    const state = this.state();
    if (this.selectedWordId() === null) {
      this.state.set(validateAll(state));
      return;
    }
    const result = validateWord(state, this.selectedWordId());
    if (result.ok) this.state.set(result.value);
  }

  protected rejouer(): void {
    this.state.set(reset(this.state()));
    this.selectedCell.set(null);
    this.selectedWordId.set(null);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const state = this.state();
    if (state.gameStatus === 'won') return;
    const cell = this.selectedCell();

    if (event.key === 'Backspace') {
      event.preventDefault();
      if (cell === null) return;
      const result = clearLetter(state, cell);
      if (result.ok) this.state.set(result.value);
      return;
    }

    if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault();
      if (cell === null) return;
      const result = setLetter(state, cell, event.key.toUpperCase());
      if (!result.ok) return;
      this.state.set(result.value);
      this.advanceCursor();
      return;
    }

    const deltas: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const delta = deltas[event.key];
    if (delta && cell !== null) {
      event.preventDefault();
      this.moveCursor(cell, delta[0], delta[1]);
    }
  }

  private advanceCursor(): void {
    const word = this.selectedWord();
    const cell = this.selectedCell();
    if (!word || cell === null) return;
    const position = word.cells.indexOf(cell);
    if (position >= 0 && position < word.cells.length - 1) {
      this.selectedCell.set(word.cells[position + 1]);
    }
  }

  private moveCursor(from: number, deltaRow: number, deltaCol: number): void {
    const grid = this.state().grid;
    let r = rowOf(from, grid.width) + deltaRow;
    let c = colOf(from, grid.width) + deltaCol;
    while (r >= 0 && r < grid.height && c >= 0 && c < grid.width) {
      const index = r * grid.width + c;
      if (grid.cells[index].kind === 'letter') {
        this.selectedCell.set(index);
        return;
      }
      r += deltaRow;
      c += deltaCol;
    }
  }
}
```

`apps/web/src/app/grille/grille.html` :

```html
<div class="barre">
  <button type="button" (click)="verifier()">Vérifier</button>
  <button type="button" (click)="rejouer()">Rejouer</button>
  <span class="separateur"></span>
  <button type="button" (click)="switchGrid('6')">6×6</button>
  <button type="button" (click)="switchGrid('10')">10×10</button>
</div>

@if (state().gameStatus === 'won') {
<p class="victoire">Gagné ! Bravo.</p>
}

<div class="cadre">
  <div class="grille" [style.grid-template-columns]="'repeat(' + columns() + ', 1fr)'">
    @for (cell of state().grid.cells; track $index) {
    <app-cellule
      [cell]="cell"
      [letter]="state().letters[$index]"
      [status]="state().statuses[$index]"
      [selected]="selectedCell() === $index"
      [inSelectedWord]="selectedWord()?.cells.includes($index) ?? false"
      (cellClick)="onCellClick($index)"
    />
    }
  </div>
</div>
```

`apps/web/src/app/grille/grille.scss` :

```scss
:host {
  display: block;
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem;
}

.barre {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;

  button {
    padding: 0.4rem 0.9rem;
    border: 1px solid #b8b2a7;
    border-radius: 6px;
    background: #fffdf7;
    font: inherit;
    cursor: pointer;

    &:hover {
      background: #f1ead9;
    }
  }

  .separateur {
    flex: 1;
  }
}

.victoire {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1e7d32;
  background: #e6f4ea;
  border: 1px solid #1e7d32;
  border-radius: 8px;
  padding: 0.6rem 1rem;
}

.cadre {
  border: 2px solid #6b6357;
  border-radius: 8px;
  overflow: hidden;
}

.grille {
  display: grid;
  width: 100%;
}
```

- [ ] **Step 3: Écrire le smoke test de la page**

`apps/web/src/app/grille/grille.spec.ts` :

```ts
import { TestBed } from '@angular/core/testing';
import { setLetter } from 'grille-engine';
import { Grille } from './grille';

describe('Grille', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Grille] }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(Grille);
    fixture.autoDetectChanges();
    return fixture;
  }

  it('rend les 36 cellules de la grille 6x6 par defaut', async () => {
    const fixture = createComponent();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-cellule').length).toBe(36);
  });

  it('bascule sur la grille 10x10', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as unknown as {
      switchGrid: (key: '10') => void;
      state: () => { grid: { cells: unknown[] } };
    };
    await fixture.whenStable();
    component.switchGrid('10');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('app-cellule').length).toBe(100);
  });

  it('declenche la victoire quand la solution complete est saisie', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as unknown as {
      state: () => ReturnType<typeof setLetter> extends never ? never : any;
    };
    await fixture.whenStable();
    let state = component.state();
    for (let i = 0; i < state.solution.letters.length; i++) {
      const letter = state.solution.letters[i];
      if (letter === '') continue;
      const result = setLetter(state, i, letter);
      if (result.ok) state = result.value;
    }
    expect(state.gameStatus).toBe('won');
  });
});
```

Note : ce test pilote le moteur via l'état du composant (smoke minimal conforme à la spec) ; l'interaction clavier/souris est vérifiée manuellement à l'étape finale.

Run: `npx nx test web`
Expected: FAIL — composants inexistants… puisqu'on écrit le test avant d'avoir branché quoi que ce soit d'autre ; ici `Grille` vient d'être créé donc ce test doit passer dès cette étape. Si un point compile mal, corriger avant de continuer.

- [ ] **Step 4: Brancher la route et la navigation**

`apps/web/src/app/app.routes.ts` (contenu complet) :

```ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'grille',
    loadComponent: () => import('./grille/grille').then((m) => m.Grille),
  },
];
```

`apps/web/src/app/app.ts` — ajouter `RouterLink` aux imports du décorateur :

```ts
imports: [RouterOutlet, RouterLink],
```

`apps/web/src/app/app.html` — remplacer TOUT le contenu (placeholder Angular compris) par :

```html
<header class="entete">
  <h1>Mots fléchés</h1>
  <nav>
    <a routerLink="/grille">Jouer</a>
  </nav>
</header>

<main>
  <router-outlet />
</main>
```

`apps/web/src/app/app.scss` — remplacer par :

```scss
.entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid #ddd6c8;

  h1 {
    margin: 0;
    font-size: 1.4rem;
  }

  a {
    color: #1a73e8;
    text-decoration: none;
    font-weight: 600;

    &:hover {
      text-decoration: underline;
    }
  }
}

main {
  padding: 0.5rem;
}
```

`apps/web/src/app/app.spec.ts` (contenu complet — le titre change et RouterLink exige le router) :

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Mots fléchés');
  });
});
```

Vérifier `apps/web/src/app/app.config.ts` : il doit contenir `provideRouter(routes)` avec `import { routes } from './app.routes'` — c'est le cas dans le squelette Angular ; ajouter ces lignes seulement s'il les manque.

- [ ] **Step 5: Vérifier tous les tests**

Run: `npx nx test web`
Expected: PASS (smoke App + smoke Grille + mock grids).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): playable /grille demo page"
```

---

### Task 8: Gates complets et vérification manuelle

**Files:**

- Aucun fichier modifié (verification uniquement).

- [ ] **Step 1: Linter tout**

Run: `npx nx run-many -t lint`
Expected: PASS sur les 3 projets.

- [ ] **Step 2: Tester tout**

Run: `npx nx run-many -t test`
Expected: PASS sur les 3 projets.

- [ ] **Step 3: Builder tout**

Run: `npx nx run-many -t build`
Expected: PASS sur les 3 projets.

- [ ] **Step 4: Format check**

Run: `npx nx format:check`
Expected: PASS. Si échec : `npx nx format:write` puis recommencer depuis l'étape 1.

- [ ] **Step 5: Vérification manuelle de la démo**

Run: `npx nx serve web`
Ouvrir `http://localhost:4200/grille` puis vérifier :

1. La grille 6×6 s'affiche avec définitions minuscules et flèches → ↓ ↳ ⬎
2. Cliquer une case-lettre : elle devient courante, son mot se surligne
3. Re-cliquer la même case : bascule sur l'autre mot (croisement)
4. Cliquer une case-indice : cycle parmi ses mots
5. Taper des lettres : saisie + curseur avance dans le mot ; Backspace efface
6. Flèches du clavier : déplacement en sautant les cases-indices
7. Bouton Vérifier sans sélection : toute la grille se colore (vert/rouge, vide inchangé)
8. Compléter toute la grille correctement : bandeau « Gagné ! Bravo. » apparaît, Rejouer remet à zéro
9. Boutons 6×6 / 10×10 : bascule entre les deux grilles mockées

- [ ] **Step 6: Pousser et vérifier la CI**

```bash
git push
```

Run: vérifier sur GitHub Actions que le run sur le dernier commit est vert (lint + test + build + format).

---

## Auto-revue (effectuée à la rédaction)

- **Couverture spec** : modèle de données (T1/T2), dérivation 4 flèches + bornes (T3), garde-fous build (T4), saisie/validation/victoire/reset (T5), grilles mockées 6×6 et 10×10 (T6), rendu responsive + clavier + clics + Vérifier + route /grille (T7), critères de réussite `run-many` + `format:check` + démo (T8). Non-objectifs respectés : pas d'aide, pas de backend, pas de cases noires.
- **Scan placeholders** : aucun TBD/TODO ; tout le code est fourni intégralement, y compris les données des grilles.
- **Cohérence des types** : `WordCandidate` (T3) enrichi en `Word` (T4) ; erreurs nues conformes au spec ; `validateWord(state, number | null)` cohérent entre T5 (implémentation) et T7 (appel avec `selectedWordId()` qui est `number | null`) ; `buildMockGame` retourne le `Result` brut, déballé par `builtOrThrow` côté UI.
