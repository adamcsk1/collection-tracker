import { TestBed } from '@angular/core/testing';
import {
  initialSpinnerLoadingState,
  SpinnerLoadingState,
  spinnerLoadingStateToken,
} from '@components/spinner-loading/spinner-loading-store';
import { ApiService } from '@services/api/api-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_USE_CLAUDE_AI } from '@shared/constants/storage-const';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClaudeSearchService } from './claude-search-service';

describe('ClaudeSearchService', () => {
  let service: ClaudeSearchService;
  let spinnerState: NgxSimpleSignalStoreService<SpinnerLoadingState>;
  let getItemSpy: ReturnType<typeof vi.fn>;
  let setItemSpy: ReturnType<typeof vi.fn>;
  let getClaudeQueryDataSpy: ReturnType<typeof vi.fn>;

  const setup = (storedValue: string | null = null) => {
    getItemSpy = vi.fn().mockReturnValue(storedValue);
    setItemSpy = vi.fn();
    getClaudeQueryDataSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ClaudeSearchService,
        { provide: WebstorageService, useValue: { getItem: getItemSpy, setItem: setItemSpy } },
        { provide: ApiService, useValue: { getClaudeQueryData: getClaudeQueryDataSpy } },
        provideStore(initialSpinnerLoadingState, spinnerLoadingStateToken),
      ],
    });

    service = TestBed.inject(ClaudeSearchService);
    spinnerState = TestBed.inject(spinnerLoadingStateToken);
    TestBed.tick();
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes useClaudeAi to true when storage contains "true"', () => {
    setup('true');

    expect(service.useClaudeAi()).toBe(true);
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_USE_CLAUDE_AI, 'true');
  });

  it('initializes useClaudeAi to false when storage is empty', () => {
    setup(null);

    expect(service.useClaudeAi()).toBe(false);
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_USE_CLAUDE_AI, 'false');
  });

  it('returns null without calling API when useClaudeAi is false', () => {
    setup(null);

    let result: string[] | null | undefined;
    service.getMatchedIds('sci-fi movies').subscribe((value) => (result = value));

    expect(result).toBeNull();
    expect(getClaudeQueryDataSpy).not.toHaveBeenCalled();
  });

  it('returns null without calling API when searchText is empty', () => {
    setup('true');

    let result: string[] | null | undefined;
    service.getMatchedIds('').subscribe((value) => (result = value));

    expect(result).toBeNull();
    expect(getClaudeQueryDataSpy).not.toHaveBeenCalled();
  });

  it('calls getClaudeQueryData and returns matched IDs when useClaudeAi is true', () => {
    setup('true');
    getClaudeQueryDataSpy.mockReturnValue(of({ matchedIds: ['tt0133093', 'tt0372784'] }));

    let result: string[] | null | undefined;
    service.getMatchedIds('sci-fi movies').subscribe((value) => (result = value));

    expect(getClaudeQueryDataSpy).toHaveBeenCalledWith('sci-fi movies');
    expect(result).toEqual(['tt0133093', 'tt0372784']);
  });

  it('resets searchInProgress and spinner after a successful response', () => {
    setup('true');
    getClaudeQueryDataSpy.mockReturnValue(of({ matchedIds: [] }));

    service.getMatchedIds('query').subscribe();

    expect(service.searchInProgress()).toBe(false);
    expect(spinnerState.state.show()).toBe(false);
  });

  it('returns null and resets searchInProgress and spinner on API error', () => {
    setup('true');
    getClaudeQueryDataSpy.mockReturnValue(throwError(() => new Error('network error')));

    let result: string[] | null | undefined;
    service.getMatchedIds('sci-fi').subscribe((value) => (result = value));

    expect(result).toBeNull();
    expect(service.searchInProgress()).toBe(false);
    expect(spinnerState.state.show()).toBe(false);
  });
});
