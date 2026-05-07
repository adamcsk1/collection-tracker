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
import { AiSearchService } from './ai-search-service';

describe('AiSearchService', () => {
  let service: AiSearchService;
  let spinnerState: NgxSimpleSignalStoreService<SpinnerLoadingState>;
  let getItemSpy: ReturnType<typeof vi.fn>;
  let setItemSpy: ReturnType<typeof vi.fn>;
  let getAiQueryDataSpy: ReturnType<typeof vi.fn>;

  const setup = (storedValue: string | null = null) => {
    getItemSpy = vi.fn().mockReturnValue(storedValue);
    setItemSpy = vi.fn();
    getAiQueryDataSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        AiSearchService,
        { provide: WebstorageService, useValue: { getItem: getItemSpy, setItem: setItemSpy } },
        { provide: ApiService, useValue: { getAiQueryData: getAiQueryDataSpy } },
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
      ],
    });

    service = TestBed.inject(AiSearchService);
    spinnerState = TestBed.inject(spinnerLoadingStateToken);
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
});
