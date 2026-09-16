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
        path: 'books',
        loadComponent: () => import('./books/books').then((module) => module.Books),
      },
      {
        path: 'music',
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
