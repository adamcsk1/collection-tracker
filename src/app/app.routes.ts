import { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then((module) => module.Settings),
  },
];
