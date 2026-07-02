import { Routes } from '@angular/router';
import { settingsLockedGuard } from '../settings/settings-locked-guard';
import { mainGuard } from './main-guard';

export const routes: Routes = [
  {
    path: 'collection',
    loadChildren: () => import('../collection/collection-routes').then((module) => module.collectionRoutes),
    canActivate: [mainGuard],
  },
  {
    path: 'statistics',
    loadComponent: () => import('../statistics/statistics').then((module) => module.Statistics),
    canActivate: [mainGuard],
  },
  {
    path: 'settings',
    loadChildren: () => import('../settings/settings-routes').then((module) => module.settingsRoutes),
    canActivate: [mainGuard, settingsLockedGuard],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'collection',
  },
];
