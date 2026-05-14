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
        path: 'favorites',
        loadComponent: () => import('./favorites/favorites').then((module) => module.Favorites),
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
        path: '',
        pathMatch: 'full',
        redirectTo: 'library',
      },
    ],
  },
];
