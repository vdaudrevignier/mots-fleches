import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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

  protected readonly ariaLabel = computed(() => {
    const l = this.letter();
    return `case-lettre, ${l ? `lettre ${l}` : 'vide'}`;
  });

  protected glyph(arrow: string): string {
    return ARROW_GLYPHS[arrow] ?? '?';
  }
}
