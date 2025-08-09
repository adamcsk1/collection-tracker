import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'collection',
    loadComponent: () => import('./collection/collection').then((module) => module.Collection),
  },
  {
    path: 'statistics',
    loadComponent: () => import('./statistics/statistics').then((module) => module.Statistics),
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings').then((module) => module.Settings),
  },
  {
    path: 'about',
    loadComponent: () => import('./about/about').then((module) => module.About),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'collection',
  },
];
