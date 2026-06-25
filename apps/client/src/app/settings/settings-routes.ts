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
        path: 'tag-management',
        loadComponent: () => import('./tag-management/tag-management').then((module) => module.TagManagement),
      },
      {
        path: 'collection-list-display',
        loadComponent: () =>
          import('./collection-list-display/collection-list-display').then(
            (module) => module.SettingsCollectionListDisplay
          ),
      },
      {
        path: 'media-refresh',
        loadComponent: () => import('./media-refresh/media-refresh').then((module) => module.SettingsMediaRefresh),
      },
      {
        path: 'manage-tracker-data',
        loadComponent: () =>
          import('./manage-tracker-data/manage-tracker-data').then((module) => module.SettingsManageTrackerData),
      },
      {
        path: 'shares',
        loadComponent: () => import('./shares/shares').then((module) => module.SettingsShares),
      },
      {
        path: 'export-import',
        loadComponent: () => import('./export-import/export-import').then((module) => module.ExportImport),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'basics',
      },
    ],
  },
];
