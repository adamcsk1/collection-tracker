import { Routes } from '@angular/router';
import { Settings } from './settings';

export const settingsRoutes: Routes = [
  {
    path: '',
    component: Settings,
    children: [
      {
        path: 'basics',
        data: { titleKey: 'Basics' },
        loadComponent: () => import('./basics/basics').then((module) => module.SettingsBasics),
      },
      {
        path: 'account',
        data: { titleKey: 'User' },
        loadComponent: () => import('./account-actions/account-actions').then((module) => module.AccountActions),
      },
      {
        path: 'access-tokens',
        data: { titleKey: 'AccessTokens' },
        loadComponent: () => import('./access-tokens/access-tokens').then((module) => module.AccessTokens),
      },
      {
        path: 'tag-management',
        data: { titleKey: 'TagManagement' },
        loadComponent: () => import('./tag-management/tag-management').then((module) => module.TagManagement),
      },
      {
        path: 'collection-list-display',
        data: { titleKey: 'CollectionListDisplay' },
        loadComponent: () =>
          import('./collection-list-display/collection-list-display').then(
            (module) => module.SettingsCollectionListDisplay
          ),
      },
      {
        path: 'features',
        data: { titleKey: 'Features' },
        loadComponent: () => import('./features/features').then((module) => module.SettingsFeatures),
      },
      {
        path: 'media-refresh',
        data: { titleKey: 'MediaRefresh' },
        loadComponent: () => import('./media-refresh/media-refresh').then((module) => module.SettingsMediaRefresh),
      },
      {
        path: 'manage-tracker-data',
        data: { titleKey: 'ManageTrackerData' },
        loadComponent: () =>
          import('./manage-tracker-data/manage-tracker-data').then((module) => module.SettingsManageTrackerData),
      },
      {
        path: 'shares',
        data: { titleKey: 'Shares' },
        loadComponent: () => import('./shares/shares').then((module) => module.SettingsShares),
      },
      {
        path: 'export-import',
        data: { titleKey: 'ExportImport' },
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
