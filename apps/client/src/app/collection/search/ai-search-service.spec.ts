import { TestBed } from '@angular/core/testing';
import {
  initialSpinnerLoadingState,
  SpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { ApiService } from '@services/api/api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_USE_AI_SEARCH } from '@shared/constants/storage-const';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialMainState, MainState, mainStateToken } from '../../main/main-store';
import { AiSearchService } from './ai-search-service';

describe('AiSearchService', () => {
  let service: AiSearchService;
  let spinnerState: NgxSimpleSignalStoreService<SpinnerLoadingState>;
  let getItemSpy: ReturnType<typeof vi.fn>;
  let setItemSpy: ReturnType<typeof vi.fn>;
  let getAiQueryDataSpy: ReturnType<typeof vi.fn>;
  let getAiAvailableSpy: ReturnType<typeof vi.fn>;
  let mainState: NgxSimpleSignalStoreService<MainState>;

  const setup = (storedValue: string | null = null) => {
    getItemSpy = vi.fn().mockReturnValue(storedValue);
    setItemSpy = vi.fn();
    getAiQueryDataSpy = vi.fn();
    getAiAvailableSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        AiSearchService,
        {
          provide: WebstorageService,
          useValue: { getItem: getItemSpy, setItem: setItemSpy, removeItem: vi.fn() },
        },
        { provide: ApiService, useValue: { getAiQueryData: getAiQueryDataSpy, getAiAvailable: getAiAvailableSpy } },
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        provideStore(initialMainState, mainStateToken),
      ],
    });

    service = TestBed.inject(AiSearchService);
    spinnerState = TestBed.inject(spinnerLoadingStateToken);
    mainState = TestBed.inject(mainStateToken);
    TestBed.tick();
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes useAiSearch to true when storage contains "true"', () => {
    setup('true');

    expect(service.useAiSearch()).toBe(true);
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_USE_AI_SEARCH, 'true');
  });

  it('initializes useAiSearch to false when storage is empty', () => {
    setup(null);

    expect(service.useAiSearch()).toBe(false);
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_USE_AI_SEARCH, 'false');
  });

  it('returns null without calling API when useAiSearch is false', () => {
    setup(null);

    let result: string[] | null | undefined;
    service.getMatchedIds('sci-fi movies').subscribe((value) => (result = value));

    expect(result).toBeNull();
    expect(getAiQueryDataSpy).not.toHaveBeenCalled();
  });

  it('returns null without calling API when searchText is empty', () => {
    setup('true');

    let result: string[] | null | undefined;
    service.getMatchedIds('').subscribe((value) => (result = value));

    expect(result).toBeNull();
    expect(getAiQueryDataSpy).not.toHaveBeenCalled();
  });

  it('calls getAiQueryData and returns matched IDs when useAiSearch is true', () => {
    setup('true');
    getAiQueryDataSpy.mockReturnValue(of({ matchedIds: ['tt0133093', 'tt0372784'] }));

    let result: string[] | null | undefined;
    service.getMatchedIds('sci-fi movies').subscribe((value) => (result = value));

    expect(getAiQueryDataSpy).toHaveBeenCalledWith('sci-fi movies');
    expect(result).toEqual(['tt0133093', 'tt0372784']);
  });

  it('resets searchInProgress and spinner after a successful response', () => {
    setup('true');
    getAiQueryDataSpy.mockReturnValue(of({ matchedIds: [] }));

    service.getMatchedIds('query').subscribe();

    expect(service.searchInProgress()).toBe(false);
    expect(spinnerState.state.show()).toBe(false);
  });

  it('returns null and resets searchInProgress and spinner on API error', () => {
    setup('true');
    getAiQueryDataSpy.mockReturnValue(throwError(() => new Error('network error')));

    let result: string[] | null | undefined;
    service.getMatchedIds('sci-fi').subscribe((value) => (result = value));

    expect(result).toBeNull();
    expect(service.searchInProgress()).toBe(false);
    expect(spinnerState.state.show()).toBe(false);
  });

  it('checks AI availability and updates main state on success', () => {
    setup();
    getAiAvailableSpy.mockReturnValue(of({ aiAvailable: true }));

    let result: boolean | undefined;
    service.checkAiAvailable().subscribe((value) => (result = value));

    expect(result).toBe(true);
    expect(mainState.state.aiAvailable()).toBe(true);
  });

  it('sets AI availability to false and returns false on API error', () => {
    setup();
    getAiAvailableSpy.mockReturnValue(throwError(() => new Error('network error')));

    let result: boolean | undefined;
    service.checkAiAvailable().subscribe((value) => (result = value));

    expect(result).toBe(false);
    expect(mainState.state.aiAvailable()).toBe(false);
  });

  it('switches off AI search automatically when AI becomes unavailable', () => {
    setup('true');

    mainState.setState('aiAvailable', true);
    TestBed.tick();
    mainState.setState('aiAvailable', false);
    TestBed.tick();

    expect(service.useAiSearch()).toBe(false);
  });

  it('clears AI search storage when AI becomes unavailable while AI search is active', () => {
    setup('true');
    const webstorage = TestBed.inject(WebstorageService);

    mainState.setState('aiAvailable', true);
    TestBed.tick();
    mainState.setState('aiAvailable', false);
    TestBed.tick();

    expect(webstorage.removeItem).toHaveBeenCalledWith(STORAGE_USE_AI_SEARCH);
  });
});
