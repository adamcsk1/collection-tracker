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
        path: 'watching',
        loadComponent: () => import('./series-tracker/series-tracker').then((module) => module.Watching),
      },
      {
        path: 'watched',
        loadComponent: () => import('./movie-tracker/movie-tracker').then((module) => module.Watched),
      },
      {
        path: 'books',
        loadComponent: () => import('./book-tracker/book-tracker').then((module) => module.Books),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'library',
      },
    ],
  },
];
