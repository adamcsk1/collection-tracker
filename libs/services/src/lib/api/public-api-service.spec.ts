import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AlertService } from '../alert-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { lastValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiStateToken, initialApiState, type ApiState } from './api-store';
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

  it('returns background image URLs without alerting on failure', async () => {
    const promise = lastValueFrom(service.getBackgroundImages());

    const request = httpMock.expectOne('https://api.test/images/background');
    expect(request.request.method).toBe('GET');
    request.flush({ data: { images: ['https://images.example/poster.jpg'] } });

    await expect(promise).resolves.toEqual({ images: ['https://images.example/poster.jpg'] });
  });

  it('suppresses the alert when background images fail', async () => {
    const promise = lastValueFrom(service.getBackgroundImages());

    httpMock
      .expectOne('https://api.test/images/background')
      .flush({ title: 'Service Unavailable', status: 503 }, { status: 503, statusText: 'Service Unavailable' });

    await expect(promise).rejects.toMatchObject({ status: 503 });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('returns health data on success', async () => {
    const healthData = {
      status: 'ok',
    };

    const promise = lastValueFrom(service.getHealth());

    const healthRequest = httpMock.expectOne('https://api.test/health');
    expect(healthRequest.request.method).toBe('GET');
    healthRequest.flush({ data: healthData });

    await expect(promise).resolves.toEqual(healthData);
  });

  it('suppresses the alert when public health is requested with suppressErrorAlert', async () => {
    const promise = lastValueFrom(service.getHealth({ suppressErrorAlert: true }));

    httpMock
      .expectOne('https://api.test/health')
      .flush({ title: 'Service Unavailable', status: 503 }, { status: 503, statusText: 'Service Unavailable' });

    await expect(promise).rejects.toMatchObject({ status: 503 });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('falls back to the HTTP message and rethrows unchanged when RFC 9457 detail is missing', async () => {
    const problem = { title: 'Service Unavailable', status: 503 };
    const promise = lastValueFrom(service.getHealth());

    const healthRequest = httpMock.expectOne('https://api.test/health');
    healthRequest.flush(problem, { status: 503, statusText: 'Service Unavailable' });

    await expect(promise).rejects.toMatchObject({ status: 503, error: problem });
    expect(alertSpy).toHaveBeenCalledOnce();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Service Unavailable'));
  });

  it('posts signIn request with credentials', async () => {
    const promise = lastValueFrom(service.signIn('neo', 'matrix'));

    const signInRequest = httpMock.expectOne('https://api.test/auth/sign-in');
    expect(signInRequest.request.method).toBe('POST');
    expect(signInRequest.request.body).toEqual({ username: 'neo', token: 'matrix' });
    signInRequest.flush(null, { status: 204, statusText: 'No Content' });

    await expect(promise).resolves.toBeNull();
  });

  it('alerts and rethrows when signIn fails', async () => {
    const promise = lastValueFrom(service.signIn('neo', 'invalid'));

    const signInRequest = httpMock.expectOne('https://api.test/auth/sign-in');
    signInRequest.flush('bad', { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('validates session by refreshing the access token', async () => {
    const promise = lastValueFrom(service.validateSession());

    const request = httpMock.expectOne('https://api.test/auth/session/refresh');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expect(promise).resolves.toBeNull();
  });

  it('posts signUp request with username', async () => {
    const promise = lastValueFrom(service.signUp('neo'));

    const signUpRequest = httpMock.expectOne('https://api.test/auth/sign-up');
    expect(signUpRequest.request.method).toBe('POST');
    expect(signUpRequest.request.body).toEqual({ username: 'neo' });
    signUpRequest.flush({ data: { token: 'secret' } });

    await expect(promise).resolves.toEqual({ token: 'secret' });
  });

  it('alerts and rethrows when signUp fails', async () => {
    const promise = lastValueFrom(service.signUp('neo'));

    const signUpRequest = httpMock.expectOne('https://api.test/auth/sign-up');
    signUpRequest.flush('invalid', { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
