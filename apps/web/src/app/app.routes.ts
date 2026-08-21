import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'grille',
    loadComponent: () => import('./grille/grille').then((m) => m.Grille),
  },
];
