import { HttpContext, HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { redirectToLogin } from '@shared/utils/redirect-to-login-util';
import { firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshTokenInterceptor } from './refresh-token-interceptor';
import { RefreshTokenService } from './refresh-token-service';
import { redirectOnRefreshFailureContext } from './auth-request-context';

vi.mock('@shared/utils/redirect-to-login-util', () => ({
  redirectToLogin: vi.fn(),
}));

describe('refreshTokenInterceptor', () => {
  let refresh: ReturnType<typeof vi.fn>;
  const request = new HttpRequest('GET', '/api/v1/collection-items');

  beforeEach(() => {
    refresh = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: RefreshTokenService, useValue: { refresh } }],
    });
    vi.mocked(redirectToLogin).mockClear();
  });

  it('preserves the session when refresh is rate limited', async () => {
    const rateLimitError = { status: 429 };
    refresh.mockReturnValue(throwError(() => rateLimitError));
    const next: HttpHandlerFn = vi.fn(() => throwError(() => ({ status: 401 })));

    const result = TestBed.runInInjectionContext(() => refreshTokenInterceptor(request, next));

    await expect(firstValueFrom(result)).rejects.toBe(rateLimitError);
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('redirects to login when refresh is rejected', async () => {
    refresh.mockReturnValue(throwError(() => ({ status: 403 })));
    const next: HttpHandlerFn = vi.fn(() => throwError(() => ({ status: 401 })));

    const result = TestBed.runInInjectionContext(() => refreshTokenInterceptor(request, next));
    await firstValueFrom(result, { defaultValue: new HttpResponse() });

    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('propagates a rejected refresh when redirect is disabled for the request', async () => {
    const refreshError = { status: 401 };
    refresh.mockReturnValue(throwError(() => refreshError));
    const next: HttpHandlerFn = vi.fn(() => throwError(() => ({ status: 401 })));
    const healthRequest = request.clone({
      context: new HttpContext().set(redirectOnRefreshFailureContext, false),
    });

    const result = TestBed.runInInjectionContext(() => refreshTokenInterceptor(healthRequest, next));

    await expect(firstValueFrom(result)).rejects.toBe(refreshError);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('retries the original request after a successful refresh', async () => {
    refresh.mockReturnValue(of(undefined));
    const next: HttpHandlerFn = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 401 })))
      .mockReturnValueOnce(of(new HttpResponse({ status: 200 })));

    const result = TestBed.runInInjectionContext(() => refreshTokenInterceptor(request, next));

    const response = await firstValueFrom(result);
    expect(response).toBeInstanceOf(HttpResponse);
    if (!(response instanceof HttpResponse)) throw new Error('Expected an HTTP response');
    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
