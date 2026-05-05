import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, EMPTY, switchMap } from 'rxjs';
import { RefreshTokenService } from './refresh-token-service';

export const refreshTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const refreshService = inject(RefreshTokenService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error) => {
      const isAuthRequest =
        req.url.includes('/session/refresh') || req.url.includes('/sign-in') || req.url.includes('/sign-up');
      if (error.status === 401 && !isAuthRequest) {
        return refreshService.refresh().pipe(
          switchMap(() => next(req)),
          catchError(() => {
            router.navigateByUrl('/login/');
            return EMPTY;
          })
        );
      }
      throw error;
    })
  );
};
