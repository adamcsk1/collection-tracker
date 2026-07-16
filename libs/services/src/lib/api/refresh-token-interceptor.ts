import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { redirectToLogin } from '@shared/utils/redirect-to-login-util';
import { catchError, EMPTY, switchMap, throwError } from 'rxjs';
import { isRateLimitError } from './http-error-util';
import { RefreshTokenService } from './refresh-token-service';

export const refreshTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const refreshService = inject(RefreshTokenService);
  return next(req).pipe(
    catchError((error) => {
      const isAuthRequest =
        req.url.includes('/session/refresh') || req.url.includes('/sign-in') || req.url.includes('/sign-up');
      if (error.status === 401 && !isAuthRequest) {
        return refreshService.refresh().pipe(
          switchMap(() => next(req)),
          catchError((refreshError: unknown) => {
            if (isRateLimitError(refreshError)) return throwError(() => refreshError);
            redirectToLogin();
            return EMPTY;
          })
        );
      }
      throw error;
    })
  );
};
