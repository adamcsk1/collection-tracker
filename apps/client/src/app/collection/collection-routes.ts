import { Routes } from '@angular/router';
import { Collection } from './collection';
import { itemDraftGuard } from './item/item-dialog/item-draft-guard';

export const collectionRoutes: Routes = [
  {
    path: '',
    component: Collection,
    canDeactivate: [itemDraftGuard],
    runGuardsAndResolvers: 'always',
    children: [
      {
        path: 'library',
        data: { titleKey: 'Collection' },
        loadComponent: () => import('./library/library').then((module) => module.CollectionLibrary),
      },
      {
        path: 'up-next',
        data: { titleKey: 'UpNext' },
        loadComponent: () => import('./up-next/up-next').then((module) => module.UpNext),
      },
      {
        path: 'wishlist',
        data: { titleKey: 'Wishlist' },
        loadComponent: () => import('./wishlist/wishlist').then((module) => module.Wishlist),
      },
      {
        path: 'tracking',
        data: { titleKey: 'Tracking' },
        loadComponent: () => import('./tracking/tracking').then((module) => module.Tracking),
      },
      {
        path: 'books',
        data: { titleKey: 'Books' },
        loadComponent: () => import('./books/books').then((module) => module.Books),
      },
      {
        path: 'music',
        data: { titleKey: 'Music' },
        loadComponent: () => import('./music/music').then((module) => module.Music),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'library',
      },
    ],
  },
];
