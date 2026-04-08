import { Routes } from '@angular/router';
import { mainGuard } from './main-guard';
import { settingsLockedGuard } from '../settings/settings-locked-guard';

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
    path: 'tag-configs',
    loadComponent: () => import('../tag-configs/tag-configs').then((module) => module.TagConfigs),
    canActivate: [mainGuard, settingsLockedGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('../settings/settings').then((module) => module.Settings),
    canActivate: [mainGuard, settingsLockedGuard],
  },
  {
    path: 'parser',
    loadComponent: () => import('../parser/parser').then((module) => module.Parser),
    canActivate: [mainGuard, settingsLockedGuard],
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
