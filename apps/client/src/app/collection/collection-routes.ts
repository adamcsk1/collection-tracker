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
        path: 'up-next',
        loadComponent: () => import('./up-next/up-next').then((module) => module.UpNext),
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
        path: 'watchlist',
        redirectTo: 'up-next',
        pathMatch: 'full',
      },
      {
        path: 'watch-later',
        redirectTo: 'up-next',
        pathMatch: 'full',
      },
      {
        path: 'watching',
        redirectTo: 'tracking',
        pathMatch: 'full',
      },
      {
        path: 'watched',
        redirectTo: 'tracking',
        pathMatch: 'full',
      },
      {
        path: 'finished',
        redirectTo: 'tracking',
        pathMatch: 'full',
      },
      {
        path: 'movie-tracker',
        redirectTo: 'tracking',
        pathMatch: 'full',
      },
      {
        path: 'series-tracker',
        redirectTo: 'tracking',
        pathMatch: 'full',
      },
      {
        path: 'book-tracker',
        redirectTo: 'books',
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
