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
