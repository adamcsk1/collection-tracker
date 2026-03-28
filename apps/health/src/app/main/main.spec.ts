import { TestBed } from '@angular/core/testing';
import { ApiState, apiStateToken, initialApiState } from '@services/api/api-store';
import { PublicApiService } from '@services/api/public-api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { API_PREFIX } from '@shared/constants/api-const';
import { STORAGE_API_URL } from '@shared/constants/storage-const';
import { HealthApiResponseModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Main } from './main';

const healthData: HealthApiResponseModel = {
  status: 'ok',
  memory: { usedPercent: 40 },
  cpu: { usagePercent: 20 },
  disk: { usedPercent: 60 },
  load: { avg1m: 0.5, avg5m: 0.3, avg15m: 0.2 },
  frontend: { status: 'up' },
};

describe('Main component', () => {
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let publicApiService: { getHealth: Mock };
  let webStorage: { getItem: Mock; setItem: Mock };
  let ngxTranslate: { translate: Mock; setLanguage: Mock };

  beforeEach(() => {
    publicApiService = { getHealth: vi.fn(() => of(healthData)) };
    webStorage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    ngxTranslate = { translate: vi.fn((value: string) => value), setLanguage: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Main],
      providers: [
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
    expect(apiState.state.apiUrl()).toBe(`${window.location.origin}${API_PREFIX}`);
  });

  it('uses a stored API URL when available', () => {
    webStorage.getItem.mockReturnValue('https://stored-api');
    TestBed.createComponent(Main);

    expect(webStorage.getItem).toHaveBeenCalledWith(STORAGE_API_URL);
    expect(apiState.state.apiUrl()).toBe('https://stored-api');
  });

  it('starts in loading state with no health data', () => {
    const fixture = TestBed.createComponent(Main);
    const component = fixture.componentInstance;

    expect(component['loading']()).toBe(true);
    expect(component['health']()).toBeNull();
  });

  it('fetches health data once on init and updates signals', () => {
    const fixture = TestBed.createComponent(Main);
    const component = fixture.componentInstance;

    component.ngOnInit();

    expect(publicApiService.getHealth).toHaveBeenCalledTimes(1);
    expect(component['health']()).toEqual(healthData);
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
  });

  it('sets loading to false on error and leaves health and loadedAt null', () => {
    publicApiService.getHealth.mockReturnValue(throwError(() => new Error('network error')));

    const fixture = TestBed.createComponent(Main);
    const component = fixture.componentInstance;

    component.ngOnInit();

    expect(component['loading']()).toBe(false);
    expect(component['health']()).toBeNull();
    expect(component['loadedAt']()).toBeNull();
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
});
