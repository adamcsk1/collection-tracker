import { Routes } from '@angular/router';
import { mainGuard } from './main-guard';
import { settingsLockedGuard } from '../settings/settings-locked-guard';

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
    path: 'about',
    loadComponent: () => import('../about/about').then((module) => module.About),
    canActivate: [mainGuard],
  },
  {
    path: 'tag-configs',
    redirectTo: 'settings/tag-configs',
    pathMatch: 'full',
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'collection',
  },
];
