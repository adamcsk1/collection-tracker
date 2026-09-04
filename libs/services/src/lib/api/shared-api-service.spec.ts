import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AlertService } from '../alert-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { lastValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiStateToken, initialApiState, type ApiState } from './api-store';
import { SharedApiService } from './shared-api-service';

describe('SharedApiService', () => {
  let service: SharedApiService;
  let httpMock: HttpTestingController;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let alertSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    alertSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        SharedApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(initialApiState, apiStateToken),
        { provide: AlertService, useValue: { show: alertSpy } },
      ],
    });

    service = TestBed.inject(SharedApiService);
    httpMock = TestBed.inject(HttpTestingController);
    apiState = TestBed.inject(apiStateToken);
    apiState.setState('apiUrl', 'https://api.test');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('gets authenticated health diagnostics', async () => {
    const diagnostics = {
      status: 'ok' as const,
      memory: { usedPercent: 40 },
      cpu: { usagePercent: 20 },
      disk: { usedPercent: 60 },
      load: { avg1m: 0.5, avg5m: 0.3, avg15m: 0.2 },
      frontend: { status: 'up' as const },
      metadata: { status: 'up' as const },
      ai: { status: 'up' as const },
    };
    const promise = lastValueFrom(service.getHealthDiagnostics());

    const request = httpMock.expectOne('https://api.test/users/me/health');
    expect(request.request.method).toBe('GET');
    request.flush({ data: diagnostics });

    await expect(promise).resolves.toEqual(diagnostics);
  });

  it('suppresses the global alert and rethrows when health diagnostics fail', async () => {
    const promise = lastValueFrom(service.getHealthDiagnostics());

    const request = httpMock.expectOne('https://api.test/users/me/health');
    request.flush('bad', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('updates user settings', async () => {
    const payload = {
      theme: 'dark' as const,
      animatedBackground: false,
      language: 'en' as const,
    };
    const settings = {
      ...payload,
      defaultCollectionOwners: [
        { listType: 'library' as const, contentType: 'movie' as const, ownerUserShareCode: 'owner-code' },
      ],
    };
    const promise = lastValueFrom(service.updateUserSettings(payload));

    const request = httpMock.expectOne('https://api.test/users/me/settings');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ data: settings });

    await expect(promise).resolves.toEqual(settings);
  });

  it('alerts and rethrows when updating user settings fails', async () => {
    const promise = lastValueFrom(
      service.updateUserSettings({
        theme: 'dark',
        animatedBackground: false,
        language: 'en',
      })
    );

    const request = httpMock.expectOne('https://api.test/users/me/settings');
    request.flush('bad', { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
