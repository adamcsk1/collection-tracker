import { Routes } from '@angular/router';
import { Collection } from './collection';

export const collectionRoutes: Routes = [
  {
    path: '',
    component: Collection,
    children: [
      {
        path: 'library',
        loadComponent: () => import('./library/library').then((module) => module.CollectionLibrary),
      },
      {
        path: 'watchlist',
        loadComponent: () => import('./watch-later/watch-later').then((module) => module.Watchlist),
      },
      {
        path: 'wishlist',
        loadComponent: () => import('./wishlist/wishlist').then((module) => module.Wishlist),
      },
      {
        path: 'tracking',
        loadComponent: () => import('./tracking/tracking').then((module) => module.Tracking),
      },
      {
        path: 'finished',
        redirectTo: 'tracking',
        pathMatch: 'full',
      },
      {
        path: 'books',
        loadComponent: () => import('./books/books').then((module) => module.Books),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'library',
      },
    ],
  },
];
