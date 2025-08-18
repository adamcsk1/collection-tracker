import { Route } from '@angular/router';

export const mainRoutes: Route[] = [
  {
    path: 'sign-in',
    loadComponent: () => import('../sign-in/sign-in').then((module) => module.SignIn),
  },
  {
    path: 'sign-up',
    loadComponent: () => import('../sign-up/sign-up').then((module) => module.SignUp),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'sign-in',
  },
];
