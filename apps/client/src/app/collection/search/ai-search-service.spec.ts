import { TestBed } from '@angular/core/testing';
import {
  initialSpinnerLoadingState,
  SpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { ApiService } from '@services/api/api-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialMainState, MainState, mainStateToken } from '../../main/main-store';
import { AiSearchService } from './ai-search-service';

describe('AiSearchService', () => {
  let service: AiSearchService;
  let spinnerState: NgxSimpleSignalStoreService<SpinnerLoadingState>;
  let getAiQueryDataSpy: ReturnType<typeof vi.fn>;
  let getAiAvailableSpy: ReturnType<typeof vi.fn>;
  let mainState: NgxSimpleSignalStoreService<MainState>;

  const setup = () => {
    getAiQueryDataSpy = vi.fn();
    getAiAvailableSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        AiSearchService,
        { provide: ApiService, useValue: { getAiQueryData: getAiQueryDataSpy, getAiAvailable: getAiAvailableSpy } },
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
        provideStore(initialMainState, mainStateToken),
      ],
    });

    service = TestBed.inject(AiSearchService);
    spinnerState = TestBed.inject(spinnerLoadingStateToken);
    mainState = TestBed.inject(mainStateToken);
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null without calling API when searchText is empty', () => {
    setup();

    let result: string[] | null | undefined;
    service.getMatchedIds('').subscribe((value) => (result = value));

    expect(result).toBeNull();
    expect(getAiQueryDataSpy).not.toHaveBeenCalled();
  });

  it('calls getAiQueryData with the configured list type and returns matched IDs', () => {
    setup();
    service.setListType('watch-later');
    getAiQueryDataSpy.mockReturnValue(of({ matchedIds: ['tt0133093', 'tt0372784'] }));

    let result: string[] | null | undefined;
    service.getMatchedIds('sci-fi movies').subscribe((value) => (result = value));

    expect(getAiQueryDataSpy).toHaveBeenCalledWith('sci-fi movies', 'watch-later');
    expect(result).toEqual(['tt0133093', 'tt0372784']);
  });

  it('defaults list type to library', () => {
    setup();
    getAiQueryDataSpy.mockReturnValue(of({ matchedIds: [] }));

    service.getMatchedIds('query').subscribe();

    expect(getAiQueryDataSpy).toHaveBeenCalledWith('query', 'library');
  });

  it('resets searchInProgress and spinner after a successful response', () => {
    setup();
    getAiQueryDataSpy.mockReturnValue(of({ matchedIds: [] }));

    service.getMatchedIds('query').subscribe();

    expect(service.searchInProgress()).toBe(false);
    expect(spinnerState.state.show()).toBe(false);
  });

  it('returns null and resets searchInProgress and spinner on API error', () => {
    setup();
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
});
