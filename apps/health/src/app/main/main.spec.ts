import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { apiStateToken, initialApiState, type ApiState } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { SharedApiService } from '@services/api/shared-api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { HealthDiagnosticsApiResponseModel } from '@shared/models/api-model';
import { getApiPrefix } from '@shared/utils/get-api-prefix-util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { Main } from './main';

const healthData: HealthDiagnosticsApiResponseModel = {
  status: 'ok',
  memory: { usedPercent: 40 },
  cpu: { usagePercent: 20 },
  disk: { usedPercent: 60 },
  load: { avg1m: 0.5, avg5m: 0.3, avg15m: 0.2 },
  frontend: { status: 'up' },
  metadata: { status: 'up' },
  ai: { status: 'up' },
};

describe('Main component', () => {
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let sharedApiService: { getHealthDiagnostics: Mock };
  let publicApiService: { getHealth: Mock };
  let webStorage: { getItem: Mock; setItem: Mock };
  let ngxTranslate: { translate: Mock; setLanguage: Mock };

  beforeEach(() => {
    sharedApiService = { getHealthDiagnostics: vi.fn(() => of(healthData)) };
    publicApiService = { getHealth: vi.fn(() => of({ status: 'ok' })) };
    webStorage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    ngxTranslate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: SharedApiService, useValue: sharedApiService },
        { provide: PublicApiService, useValue: publicApiService },
        { provide: WebstorageService, useValue: webStorage },
        { provide: NgxSignalTranslateService, useValue: ngxTranslate },
        provideStore(initialApiState, apiStateToken),
      ],
    });

    apiState = TestBed.inject(apiStateToken) as NgxSimpleSignalStoreService<ApiState>;
  });

  it('sets language and API URL from defaults on construction', () => {
    TestBed.createComponent(Main);

    expect(ngxTranslate.setLanguage).toHaveBeenCalledWith('en');
    expect(apiState.state.apiUrl()).toBe(`${window.location.origin}${getApiPrefix()}`);
  });

  it('uses a stored API URL when available', () => {
    webStorage.getItem.mockReturnValue('https://stored-api');
    TestBed.createComponent(Main);

    expect(webStorage.getItem).toHaveBeenCalledWith(STORAGE_API_URL);
    expect(apiState.state.apiUrl()).toBe('https://stored-api');
  });

  it('fetches health data once on init and updates signals', () => {
    const fixture = TestBed.createComponent(Main);
    const component = fixture.componentInstance;

    component.ngOnInit();

    expect(sharedApiService.getHealthDiagnostics).toHaveBeenCalledTimes(1);
    expect(publicApiService.getHealth).not.toHaveBeenCalled();
    expect(component['diagnostics']()).toEqual(healthData);
    expect(component['loading']()).toBe(false);
  });

  it('sets loadedAt to a Date on successful fetch', () => {
    const before = new Date();
    const fixture = TestBed.createComponent(Main);
    const component = fixture.componentInstance;

    component.ngOnInit();

    const loadedAt = component['loadedAt']();
    expect(loadedAt).toBeInstanceOf(Date);
    expect(loadedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loaded-at')?.textContent).toContain('LoadedAt:');
  });

  it('sets loading to false on error and leaves health and loadedAt null', () => {
    sharedApiService.getHealthDiagnostics.mockReturnValue(throwError(() => new Error('network error')));

    const fixture = TestBed.createComponent(Main);
    const component = fixture.componentInstance;

    component.ngOnInit();

    expect(component['loading']()).toBe(false);
    expect(component['diagnostics']()).toBeNull();
    expect(component['publicStatus']()).toBeNull();
    expect(component['loadedAt']()).toBeNull();
    expect(component['loadError']()).toBe('error');
    expect(publicApiService.getHealth).not.toHaveBeenCalled();
  });

  it.each([401, 403])('shows public status and a diagnostics login action for a %i response', (status) => {
    sharedApiService.getHealthDiagnostics.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status, statusText: 'Unauthorized' }))
    );
    publicApiService.getHealth.mockReturnValue(of({ status: 'warn' }));
    const fixture = TestBed.createComponent(Main);

    fixture.detectChanges();

    const unauthorized = fixture.nativeElement.querySelector('[data-test-id="health-diagnostics-unauthorized"]');
    expect(unauthorized?.getAttribute('role')).toBe('status');
    expect(unauthorized?.textContent).toContain('Message.HealthDiagnosticsUnauthorized');
    expect(fixture.componentInstance['loading']()).toBe(false);
    expect(fixture.componentInstance['loadError']()).toBe('unauthorized');
    expect(fixture.componentInstance['publicStatus']()).toBe('warn');
    expect(fixture.componentInstance['diagnostics']()).toBeNull();
    expect(publicApiService.getHealth).toHaveBeenCalledWith({ suppressErrorAlert: true });
    expect(
      fixture.nativeElement.querySelector('[data-test-id="health-status-banner"]')?.getAttribute('data-status')
    ).toBe('warn');
    expect(fixture.nativeElement.querySelector('[data-test-id="health-metrics-grid"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="health-login-link"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test-id="health-diagnostics-error"]')).toBeNull();
  });

  it('keeps the unauthorized login action when public health also fails', () => {
    sharedApiService.getHealthDiagnostics.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' }))
    );
    publicApiService.getHealth.mockReturnValue(throwError(() => new Error('public health down')));
    const fixture = TestBed.createComponent(Main);

    fixture.detectChanges();

    expect(fixture.componentInstance['loading']()).toBe(false);
    expect(fixture.componentInstance['publicStatus']()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="health-status-banner"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="health-diagnostics-unauthorized"]')).toBeTruthy();
  });

  it('renders an alert and retries other diagnostics errors', () => {
    sharedApiService.getHealthDiagnostics
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })))
      .mockReturnValueOnce(of(healthData));
    const fixture = TestBed.createComponent(Main);
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('[data-test-id="health-diagnostics-error"]');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('Message.HealthDiagnosticsError');

    fixture.nativeElement.querySelector('[data-test-id="health-diagnostics-retry"]').click();
    fixture.detectChanges();

    expect(sharedApiService.getHealthDiagnostics).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[data-test-id="health-metrics-grid"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-test-id="health-diagnostics-error"]')).toBeNull();
  });

  it('returns correct bar level based on percentage thresholds', () => {
    const fixture = TestBed.createComponent(Main);
    const component = fixture.componentInstance;

    expect(component['barLevel'](0)).toBe('ok');
    expect(component['barLevel'](80)).toBe('ok');
    expect(component['barLevel'](81)).toBe('warn');
    expect(component['barLevel'](95)).toBe('warn');
    expect(component['barLevel'](96)).toBe('error');
    expect(component['barLevel'](100)).toBe('error');
  });

  it('maps every displayed status token through translations', () => {
    const fixture = TestBed.createComponent(Main);
    const component = fixture.componentInstance;

    expect(component['statusLabel']('ok')).toBe('Status.Ok');
    expect(component['statusLabel']('warn')).toBe('Status.Warn');
    expect(component['statusLabel']('error')).toBe('Status.Error');
    expect(component['statusLabel']('up')).toBe('Status.Up');
    expect(component['statusLabel']('down')).toBe('Status.Down');
  });

  it('renders metrics as a semantic list with non-color severity labels', () => {
    const fixture = TestBed.createComponent(Main);
    fixture.detectChanges();

    const grid = (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="health-metrics-grid"]');
    const cards = Array.from(grid?.children ?? []);
    const severityLabels = grid?.querySelectorAll('.visually-hidden');

    expect(grid?.tagName).toBe('UL');
    expect(cards.every((card) => card.tagName === 'LI')).toBe(true);
    expect(severityLabels).toHaveLength(3);
    expect(Array.from(severityLabels ?? []).map((label) => label.textContent?.trim())).toEqual([
      'Severity: Status.Ok',
      'Severity: Status.Ok',
      'Severity: Status.Ok',
    ]);
  });

  it('renders the metadata metric with a material icon and stable status selector', () => {
    const fixture = TestBed.createComponent(Main);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-test-id="health-metadata-card"] .material-icons')?.textContent.trim()
    ).toBe('cloud');
    expect(
      fixture.nativeElement.querySelector('[data-test-id="health-metadata-status"]')?.getAttribute('data-status')
    ).toBe('up');
  });

  it('renders the AI metric with a material icon and stable status selector', () => {
    const fixture = TestBed.createComponent(Main);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-test-id="health-ai-card"] .material-icons')?.textContent.trim()
    ).toBe('psychology');
    expect(fixture.nativeElement.querySelector('[data-test-id="health-ai-status"]')?.getAttribute('data-status')).toBe(
      'up'
    );
  });
});
