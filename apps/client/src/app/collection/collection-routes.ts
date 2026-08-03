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
        path: 'watch-later',
        loadComponent: () => import('./watch-later/watch-later').then((module) => module.WatchLater),
      },
      {
        path: 'wishlist',
        loadComponent: () => import('./wishlist/wishlist').then((module) => module.Wishlist),
      },
      {
        path: 'series-tracker',
        loadComponent: () => import('./series-tracker/series-tracker').then((module) => module.SeriesTracker),
      },
      {
        path: 'movie-tracker',
        loadComponent: () => import('./movie-tracker/movie-tracker').then((module) => module.MovieTracker),
      },
      {
        path: 'book-tracker',
        loadComponent: () => import('./book-tracker/book-tracker').then((module) => module.BookTracker),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'library',
      },
    ],
  },
];
