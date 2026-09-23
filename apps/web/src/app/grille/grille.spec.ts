import { TestBed } from '@angular/core/testing';
import { GameState, setLetter } from 'grille-engine';
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
      state: () => GameState;
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
