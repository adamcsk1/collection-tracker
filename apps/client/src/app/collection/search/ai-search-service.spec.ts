import { TestBed } from '@angular/core/testing';
import {
  initialSpinnerLoadingState,
  spinnerLoadingStateToken,
  type SpinnerLoadingState,
} from '@components/spinner-loading/spinner-loading-store';
import { ApiService } from '@services/api/api-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialMainState, mainStateToken, type MainState } from '../../main/main-store';
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

  it('returns idle without calling API when searchText is empty', () => {
    setup();

    let result: unknown;
    service.getMatchedIds('', 'library').subscribe((value) => (result = value));

    expect(result).toEqual({ status: 'idle' });
    expect(getAiQueryDataSpy).not.toHaveBeenCalled();
  });

  it('calls getAiQueryData with the provided list type and returns matched IDs', () => {
    setup();
    getAiQueryDataSpy.mockReturnValue(of({ matchedIds: ['tt0133093', 'tt0372784'] }));

    const results: unknown[] = [];
    service.getMatchedIds('sci-fi movies', 'up-next').subscribe((value) => results.push(value));

    expect(getAiQueryDataSpy).toHaveBeenCalledWith('sci-fi movies', 'up-next');
    expect(results).toEqual([{ status: 'pending' }, { status: 'success', matchedIds: ['tt0133093', 'tt0372784'] }]);
  });

  it('resets searchInProgress and spinner after a successful response', () => {
    setup();
    getAiQueryDataSpy.mockReturnValue(of({ matchedIds: [] }));

    service.getMatchedIds('query', 'library').subscribe();

    expect(service.searchInProgress()).toBe(false);
    expect(spinnerState.state.show()).toBe(false);
  });

  it('returns error and resets searchInProgress and spinner on API error', () => {
    setup();
    getAiQueryDataSpy.mockReturnValue(throwError(() => new Error('network error')));

    const results: unknown[] = [];
    service.getMatchedIds('sci-fi', 'library').subscribe((value) => results.push(value));

    expect(results).toEqual([{ status: 'pending' }, { status: 'error' }]);
    expect(service.searchInProgress()).toBe(false);
    expect(spinnerState.state.show()).toBe(false);
  });

  it('resets searchInProgress and spinner when the search is unsubscribed', () => {
    setup();
    getAiQueryDataSpy.mockReturnValue(new Subject<{ matchedIds: string[] }>());

    const results: unknown[] = [];
    const subscription = service.getMatchedIds('sci-fi', 'library').subscribe((value) => results.push(value));
    expect(service.searchInProgress()).toBe(true);
    expect(spinnerState.state.show()).toBe(true);

    subscription.unsubscribe();

    expect(service.searchInProgress()).toBe(false);
    expect(spinnerState.state.show()).toBe(false);
    expect(results).toEqual([{ status: 'pending' }]);
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
