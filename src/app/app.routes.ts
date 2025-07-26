import { Routes } from '@angular/router';
import { newCollectionItemGuard } from '@pages/new-collection-item/new-collection-item-guard';

export const routes: Routes = [
  {
    path: 'collection',
    loadComponent: () => import('./pages/collection/collection').then((module) => module.Collection),
  },
  {
    path: 'new/collection-item',
    loadComponent: () =>
      import('./pages/new-collection-item/new-collection-item').then((module) => module.NewCollectionItem),
    canActivate: [newCollectionItemGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then((module) => module.Settings),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'collection',
  },
];
