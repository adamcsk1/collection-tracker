import { Routes } from '@angular/router';
import { mainGuard } from '@client/main/main-guard';

export const routes: Routes = [
  {
    path: 'collection',
    loadComponent: () => import('../collection/collection').then((module) => module.Collection),
    canActivate: [mainGuard],
  },
  {
    path: 'statistics',
    loadComponent: () => import('../statistics/statistics').then((module) => module.Statistics),
    canActivate: [mainGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('../settings/settings').then((module) => module.Settings),
    canActivate: [mainGuard],
  },
  {
    path: 'about',
    loadComponent: () => import('../about/about').then((module) => module.About),
    canActivate: [mainGuard],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'collection',
  },
];
