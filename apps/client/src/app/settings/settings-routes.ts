import { Routes } from '@angular/router';
import { Settings } from './settings';

export const settingsRoutes: Routes = [
  {
    path: '',
    component: Settings,
    children: [
      {
        path: 'basics',
        loadComponent: () => import('./basics/basics').then((module) => module.SettingsBasics),
      },
      {
        path: 'account',
        loadComponent: () => import('./account-actions/account-actions').then((module) => module.AccountActions),
      },
      {
        path: 'access-tokens',
        loadComponent: () => import('./access-tokens/access-tokens').then((module) => module.AccessTokens),
      },
      {
        path: 'tag-configs',
        loadComponent: () => import('./tag-configs/tag-configs').then((module) => module.TagConfigs),
      },
      {
        path: 'images',
        loadComponent: () => import('./images/images').then((module) => module.SettingsImages),
      },
      {
        path: 'global-watch-status',
        loadComponent: () =>
          import('./global-watch-status/global-watch-status').then((module) => module.SettingsGlobalWatchStatus),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'basics',
      },
    ],
  },
];
