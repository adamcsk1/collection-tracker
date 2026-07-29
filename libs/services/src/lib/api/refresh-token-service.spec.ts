import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicApiService } from './public-api-service';
import { RefreshTokenService } from './refresh-token-service';

describe('RefreshTokenService', () => {
  let validateSession: ReturnType<typeof vi.fn>;
  let service: RefreshTokenService;

  beforeEach(() => {
    validateSession = vi.fn();
    TestBed.configureTestingModule({
      providers: [RefreshTokenService, { provide: PublicApiService, useValue: { validateSession } }],
    });
    service = TestBed.inject(RefreshTokenService);
  });

  it('shares a successful refresh with concurrent callers', async () => {
    const refreshResponse = new Subject<void>();
    validateSession.mockReturnValue(refreshResponse);

    const firstRefresh = firstValueFrom(service.refresh());
    const secondRefresh = firstValueFrom(service.refresh());

    expect(validateSession).toHaveBeenCalledTimes(1);

    refreshResponse.next();
    refreshResponse.complete();

    await expect(Promise.all([firstRefresh, secondRefresh])).resolves.toEqual([undefined, undefined]);
  });

  it('propagates a refresh failure to concurrent callers and permits a retry', async () => {
    const refreshResponse = new Subject<void>();
    const refreshError = new Error('Session refresh failed');
    validateSession.mockReturnValueOnce(refreshResponse).mockReturnValueOnce(of(undefined));

    const firstRefresh = firstValueFrom(service.refresh());
    const secondRefresh = firstValueFrom(service.refresh());

    refreshResponse.error(refreshError);

    await expect(firstRefresh).rejects.toBe(refreshError);
    await expect(secondRefresh).rejects.toBe(refreshError);

    await expect(firstValueFrom(service.refresh())).resolves.toBeUndefined();
    expect(validateSession).toHaveBeenCalledTimes(2);
  });
});
