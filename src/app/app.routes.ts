import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Gastro Core UI — Foundation',
    loadComponent: () =>
      import('./features/foundation/foundation-page').then((m) => m.FoundationPage),
  },
  { path: '**', redirectTo: '' },
];
