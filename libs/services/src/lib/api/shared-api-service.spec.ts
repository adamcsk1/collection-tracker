import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AlertService } from '../alert-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { lastValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiState, apiStateToken, initialApiState } from './api-store';
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

  it('updates user settings', async () => {
    const payload = {
      fetchBatchSize: 50,
      theme: 'dark' as const,
      animatedBackground: false,
      language: 'en' as const,
    };
    const promise = lastValueFrom(service.updateUserSettings(payload));

    const request = httpMock.expectOne('https://api.test/user/settings');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({});

    await expect(promise).resolves.toEqual({});
  });

  it('alerts and rethrows when updating user settings fails', async () => {
    const promise = lastValueFrom(
      service.updateUserSettings({
        fetchBatchSize: 50,
        theme: 'dark',
        animatedBackground: false,
        language: 'en',
      })
    );

    const request = httpMock.expectOne('https://api.test/user/settings');
    request.flush('bad', { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ status: 400 });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
