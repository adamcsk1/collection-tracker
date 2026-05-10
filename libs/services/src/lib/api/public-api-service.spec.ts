import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AlertService } from '../alert-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { lastValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiState, apiStateToken, initialApiState } from './api-store';
import { PublicApiService } from './public-api-service';

describe('PublicApiService', () => {
  let service: PublicApiService;
  let httpMock: HttpTestingController;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let alertSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    alertSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        PublicApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(initialApiState, apiStateToken),
        { provide: AlertService, useValue: { show: alertSpy } },
      ],
    });

    service = TestBed.inject(PublicApiService);
    httpMock = TestBed.inject(HttpTestingController);
    apiState = TestBed.inject(apiStateToken);
    apiState.setState('apiUrl', 'https://api.test');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns health data on success', async () => {
    const healthData = {
      status: 'ok',
      memory: { usedPercent: 40 },
      cpu: { usagePercent: 20 },
      disk: { usedPercent: 60 },
      load: { avg1m: 0.5, avg5m: 0.3, avg15m: 0.2 },
      frontend: { status: 'up' },
      ai: { status: 'up' },
    };

    const promise = lastValueFrom(service.getHealth());

    const healthRequest = httpMock.expectOne('https://api.test/health');
    expect(healthRequest.request.method).toBe('GET');
    healthRequest.flush(healthData);

    await expect(promise).resolves.toEqual(healthData);
  });

  it('alerts and rethrows when health check fails', async () => {
    const promise = lastValueFrom(service.getHealth());

    const healthRequest = httpMock.expectOne('https://api.test/health');
    healthRequest.flush('down', { status: 503, statusText: 'Service Unavailable' });

    await expect(promise).rejects.toMatchObject({ status: 503 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toContain('Service Unavailable');
  });

  it('posts signIn request with credentials', async () => {
    const promise = lastValueFrom(service.signIn('neo', 'matrix'));

    const signInRequest = httpMock.expectOne('https://api.test/sign-in');
    expect(signInRequest.request.method).toBe('POST');
    expect(signInRequest.request.body).toEqual({ username: 'neo', token: 'matrix' });
    signInRequest.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('alerts and rethrows when signIn fails', async () => {
    const promise = lastValueFrom(service.signIn('neo', 'invalid'));

    const signInRequest = httpMock.expectOne('https://api.test/sign-in');
    signInRequest.flush('bad', { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('validates session by refreshing the access token', async () => {
    const promise = lastValueFrom(service.validateSession());

    const request = httpMock.expectOne('https://api.test/session/refresh');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('posts signUp request with username', async () => {
    const promise = lastValueFrom(service.signUp('neo'));

    const signUpRequest = httpMock.expectOne('https://api.test/sign-up');
    expect(signUpRequest.request.method).toBe('POST');
    expect(signUpRequest.request.body).toEqual({ username: 'neo' });
    signUpRequest.flush({ token: 'secret' });

    await expect(promise).resolves.toEqual({ token: 'secret' });
  });

  it('alerts and rethrows when signUp fails', async () => {
    const promise = lastValueFrom(service.signUp('neo'));

    const signUpRequest = httpMock.expectOne('https://api.test/sign-up');
    signUpRequest.flush('invalid', { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
