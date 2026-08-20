# MotsFléchés — Moteur de grille : modèle, rendu, saisie, validation

Date : 2026-08-20

## Contexte

Deuxième sous-projet d'un découpage plus large :

1. **Fondations** (livré) — monorepo Nx, squelette front/back, CI, conventions
2. **Moteur de grille** (ce spec) — modèle de grille, rendu, saisie, validation
3. Backend de base — API NestJS + Prisma, auth, CRUD grilles, publication
4. Éditeur admin — outil visuel de création/édition de grilles
5. Progression & classements — suivi de partie, scores, classements
6. Grille du jour & engagement — daily puzzle, streak, notifications PWA

Chaque sous-projet suit sa propre boucle spec → plan → implémentation.

## Objectif

Livrer un moteur de grille de mots fléchés en bibliothèque TypeScript pure
(100% testable sans DOM), plus une première grille jouable dans l'app web
avec des grilles mockées. Le moteur est conçu sans backend : il ne dépend
que de données fournies en entrée (définition de grille + solution) et
servira de socle à l'éditeur admin et au backend.

## Format de grille retenu

Mots fléchés « pur » (pas de cases noires) :

- Grille rectangulaire dense, chaque cellule est soit une **case-indice**,
  soit une **case-lettre**.
- Une case-indice affiche 1 à 2 **définitions** en tout petit, chacune
  accompagnée d'une flèche indiquant la direction du mot. La case-indice
  n'est pas remplissable.
- Le mot commence dans la cellule désignée par la flèche et s'écrit
  rectilignement (horizontal ou vertical) jusqu'à la prochaine case-indice
  ou au bord de la grille.
- Chaque case-lettre appartient à exactement un mot horizontal et un mot
  vertical.

### Les quatre flèches

Le mot est toujours rectiligne. La flèche indique la position de départ du
mot et son sens d'écriture ; la case-indice est toujours au « coin
haut-gauche » du mot :

| Flèche         | Cellule de départ (pour une case-indice d'index `i`) | Direction du mot |
| -------------- | ---------------------------------------------------- | ---------------- |
| `→` right      | `i + 1` (à droite)                                   | horizontale      |
| `↓` down       | `i + width` (en dessous)                             | verticale        |
| `↳` down-right | `i + width` (en dessous)                             | horizontale      |
| `⬎` right-down | `i + 1` (à droite)                                   | verticale        |

La position d'une cellule se déduit de son index dans le tableau
ligne-par-ligne : `ligne = Math.floor(index / width)`, `colonne = index % width`.
Ces conversions sont des fonctions pures isolées et testées.

## Modèle de données

### Contrats partagés (dans `libs/shared`)

```ts
type Arrow = 'right' | 'down' | 'down-right' | 'right-down'; // → ↓ ↳ ⬎

interface ClueEntry {
  definition: string;
  arrow: Arrow;
}

type GridCell =
  | { kind: 'letter' } // cellule remplissable
  | { kind: 'clue'; entries: ClueEntry[] }; // 1 à 2 entrées

interface GridDefinition {
  width: number;
  height: number;
  cells: GridCell[]; // ordre ligne-par-ligne, longueur = width × height
}

interface GridSolution {
  letters: string[]; // longueur = width × height ; chaîne vide pour les cases-indices
}
```

La `GridDefinition` (structure + indices) est le contrat public consommé par
le front, l'éditeur admin et le backend. La `GridSolution` (les réponses)
est fournie au moteur au démarrage d'une partie et ne transite pas vers le
joueur avant la fin de partie.

### État de jeu (dans `libs/grille-engine`)

État immuable, construit une fois, puis évolué par fonctions pures :

```ts
interface GameState {
  grid: GridDefinition;
  solution: GridSolution;
  words: Word[]; // dérivé au build, figé ensuite
  letters: (string | null)[]; // saisie, par cellule
  statuses: LetterStatus[]; // 'empty' | 'filled' | 'correct' | 'wrong'
  gameStatus: 'playing' | 'won';
}

interface Word {
  id: number;
  clueIndex: number; // case-indice d'origine
  definition: string;
  arrow: Arrow;
  direction: 'horizontal' | 'vertical';
  start: number;
  cells: number[]; // indices des cellules du mot
  length: number;
  answer: string; // depuis la solution
}
```

## API du moteur

Fonctions pures, toutes retournant un `Result<T, E>` typé (union
discriminée) :

- `buildGame({ grid, solution })` → `Result<GameState, GridBuildError>` :
  dérive les mots depuis les flèches, puis **valide la cohérence** de la
  grille (garde-fous) : bornes respectées, aucun mot traversant une
  case-indice, aucun chevauchement dans un même axe, chaque case-lettre
  couverte par exactement un mot horizontal et un mot vertical, 1 à 2
  entrées par case-indice.
- `setLetter(state, cell, lettre)` → saisie d'une lettre majuscule (A-Z)
  dans une case-lettre.
- `clearLetter(state, cell)` → efface la saisie d'une case-lettre.
- `validateWord(state, wordId)` → marque les lettres du mot `correct` ou
  `wrong` selon la solution (les lettres fausses sont conservées pour
  correction).
- `validateAll(state)` → marque toute la grille de la même façon.
- `isWon(state)` → la partie est gagnée quand toutes les cases-lettres sont
  remplies avec la bonne lettre.
- `reset(state)` → vide toute la saisie.

La **sélection** (cellule courante, mot choisi) est de l'état UI (signaux
Angular) et non du moteur : les fonctions reçoivent tout en paramètres
explicites.

## Gestion d'erreurs

Unions discriminées typées, exhaustives :

```ts
type GridBuildError =
  | { kind: 'invalidDimensions' } // dimensions nulles ou négatives
  | { kind: 'cellsLength' } // tableau cells ≠ width × height
  | { kind: 'tooManyEntries' } // case-indice avec plus de 2 entrées
  | { kind: 'emptyEntries' } // case-indice sans entrée
  | { kind: 'wordOutOfBounds' } // mot qui sort de la grille
  | { kind: 'wordThroughClue' } // mot traversant une case-indice
  | { kind: 'wordOverlap' } // deux mots du même axe se chevauchent
  | { kind: 'uncoveredCell' } // case-lettre non couverte par H et/ou V
  | { kind: 'solutionMismatch' }; // longueur de solution invalide

type SetLetterError =
  | { kind: 'notALetterCell' } // saisie sur une case-indice
  | { kind: 'gameWon' }; // partie déjà gagnée

type ValidationError = { kind: 'wordNotFound' } | { kind: 'noWordSelected' };
```

Les erreurs de build sont levées au démarrage de la partie, jamais en jeu :
une grille invalide ne peut pas être jouée.

## Rendu Angular (`apps/web`)

- Composants `GrilleComponent` et `CelluleComponent` : rendu responsive
  (CSS grid) ; les cases-indices affichent les définitions en tout petit et
  la flèche correspondante.
- Réactivité par signaux Angular : l'état du moteur est exposé via un
  signal et des computeds.
- **Saisie clavier** : flèches pour naviguer entre les cellules, lettres
  pour taper, backspace pour effacer ; **click** sur une case-indice
  sélectionne le mot qu'elle pointe, click sur une cellule la rend courante.
- **Bouton « Vérifier »** : valide le mot sélectionné s'il y en a, sinon
  toute la grille.
- Page de jeu sous la route `/grille` : charge une grille mockée et permet
  de jouer jusqu'à la victoire.

## Grilles mockées

1-2 grilles hardcodées dans l'app (une petite 6×6 et une 10×10) avec leurs
solutions, définies avec les contrats `libs/shared`. Elles serviront au
développement de la démo et seront remplacées par de vraies grilles
provenant du backend au sous-projet 3.

## Tests

- **Moteur** : Vitest, 100% des règles pures couvertes — dérivation des mots
  (les 4 flèches, bornes, arrêt sur case-indice), garde-fous de build
  (chaque erreur typée), saisie/effacement, validation mot/grille, victoire,
  reset.
- **UI** : test smoke minimal + vérification manuelle de la démo.

## Non-Objectifs

- Pas d'aide/révélation dans le moteur (lettre, mot, solution) — l'UI
  décidera plus tard d'ajouter des aides.
- Pas de backend, pas de persistance, pas de comptes.
- Pas d'éditeur admin (sous-projet 4) ni de grille du jour (sous-projet 6).
- Pas de support des cases noires ni de la numérotation type mots croisés.

## Critères de réussite

- `npx nx run-many -t lint test build` passe de bout en bout.
- `npx nx format:check` passe.
- La lib `grille-engine` est testée à 100% sur ses fonctions pures.
- La route `/grille` affiche une grille jouable : saisie clavier et souris,
  vérification du mot sélectionné ou de la grille, détection de victoire
  quand toute la grille est correctement remplie.
- Le dépôt ne contient aucun secret ; `.env` reste gitignoré.
