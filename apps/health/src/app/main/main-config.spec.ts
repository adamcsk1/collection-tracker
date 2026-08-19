import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiStateToken } from '@services/api/api-store';
import { SharedApiService } from '@services/api/shared-api-service';
import type { HealthDiagnosticsApiResponseModel } from '@shared/models/api-model';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { mainConfig } from './main-config';

describe('health mainConfig', () => {
  let httpTestingController: HttpTestingController;

  afterEach(() => {
    httpTestingController.verify();
  });

  it('refreshes an expired session and retries authenticated health diagnostics', async () => {
    TestBed.configureTestingModule({
      providers: [...mainConfig.providers, provideHttpClientTesting()],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    TestBed.inject(apiStateToken).setState('apiUrl', 'https://api.test');

    const responsePromise = firstValueFrom(TestBed.inject(SharedApiService).getHealthDiagnostics());

    httpTestingController
      .expectOne('https://api.test/users/me/health')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    httpTestingController.expectOne('https://api.test/auth/session/refresh').flush(null);

    const diagnostics: HealthDiagnosticsApiResponseModel = {
      status: 'ok',
      memory: { usedPercent: 40 },
      cpu: { usagePercent: 20 },
      disk: { usedPercent: 60 },
      load: { avg1m: 0.5, avg5m: 0.3, avg15m: 0.2 },
      frontend: { status: 'up' },
      ai: { status: 'up' },
    };
    httpTestingController.expectOne('https://api.test/users/me/health').flush({ data: diagnostics });

    await expect(responsePromise).resolves.toEqual(diagnostics);
  });

  it('propagates a failed session refresh for authenticated health diagnostics', async () => {
    TestBed.configureTestingModule({
      providers: [...mainConfig.providers, provideHttpClientTesting()],
    });
    httpTestingController = TestBed.inject(HttpTestingController);
    TestBed.inject(apiStateToken).setState('apiUrl', 'https://api.test');

    const responsePromise = firstValueFrom(TestBed.inject(SharedApiService).getHealthDiagnostics());

    httpTestingController
      .expectOne('https://api.test/users/me/health')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    httpTestingController
      .expectOne('https://api.test/auth/session/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(responsePromise).rejects.toMatchObject({ status: 401 });
  });
});
