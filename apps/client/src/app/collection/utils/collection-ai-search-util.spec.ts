import { DestroyRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { provideStore } from 'ngx-simple-signal-store';
import { firstValueFrom, of, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { collectionStateToken, initialCollectionState } from '../collection-store';
import { AiSearchService } from '../search/ai-search-service';
import { setupCollectionAiSearch } from './collection-ai-search-util';

describe('setupCollectionAiSearch', () => {
  let api: {
    getMatchedItems: ReturnType<typeof vi.fn>;
    searchItems: ReturnType<typeof vi.fn>;
  };
  let aiSearch: {
    getMatchedIds: ReturnType<typeof vi.fn>;
    checkAiAvailable: ReturnType<typeof vi.fn>;
  };
  let portal: { open: ReturnType<typeof vi.fn> };
  let floatActions: FloatActionsService;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      getMatchedItems: vi.fn(() => of({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } })),
      searchItems: vi.fn(() => of({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } })),
    };
    aiSearch = {
      getMatchedIds: vi.fn(() => of({ status: 'idle' as const })),
      checkAiAvailable: vi.fn(() => of(true)),
    };
    portal = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideStore(initialCollectionState, collectionStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        FloatActionsService,
        { provide: ApiService, useValue: api },
        { provide: AiSearchService, useValue: aiSearch },
        { provide: PortalService, useValue: portal },
      ],
    });

    floatActions = TestBed.inject(FloatActionsService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const createSetup = (listType: 'up-next' | 'books' = 'up-next') => {
    const collectionState = TestBed.inject(collectionStateToken);
    const destroyRef = TestBed.inject(DestroyRef);

    return setupCollectionAiSearch({
      collectionState,
      aiSearch: aiSearch as unknown as AiSearchService,
      api: api as unknown as ApiService,
      portal: portal as unknown as PortalService,
      floatActions,
      destroyRef,
      listType,
      queryFilters: signal({}),
      forceStandardSearch: signal(false),
      placeholder: signal('Ask AI'),
      aiAvailable: signal(true),
    });
  };

  it('uses standard searchItems when AI filter is inactive', () => {
    const setup = TestBed.runInInjectionContext(() => createSetup());

    setup.dataSource({
      reset: true,
      cursor: null,
      limit: 50,
      searchText: 'matrix',
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });

    expect(api.searchItems).toHaveBeenCalledWith(
      { search: 'matrix', listType: 'up-next', orderBy: 'createdAt', orderDirection: 'desc' },
      null,
      50
    );
    expect(api.getMatchedItems).not.toHaveBeenCalled();
  });

  it('returns EMPTY while AI matched ids are pending', async () => {
    const setup = TestBed.runInInjectionContext(() => createSetup());
    const collectionState = TestBed.inject(collectionStateToken);
    collectionState.setState('aiSearchPromptText', 'sci-fi');
    collectionState.setState('forceStandardSearch', false);

    const emissions = await firstValueFrom(
      setup
        .dataSource({
          reset: true,
          cursor: null,
          limit: 50,
          searchText: '',
          orderBy: 'createdAt',
          orderDirection: 'desc',
        })
        .pipe(toArray())
    );

    expect(emissions).toEqual([]);
    expect(api.getMatchedItems).not.toHaveBeenCalled();
  });

  it('loads matched items with listType when AI filter is active', async () => {
    aiSearch.getMatchedIds.mockReturnValue(of({ status: 'success', matchedIds: ['tt1', 'tt2'] }));
    const setup = TestBed.runInInjectionContext(() => createSetup());
    const collectionState = TestBed.inject(collectionStateToken);
    collectionState.setState('aiSearchPromptText', 'sci-fi');
    collectionState.setState('aiSearchSendVersion', 1);
    collectionState.setState('forceStandardSearch', false);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(500);
    TestBed.tick();

    setup.dataSource({
      reset: true,
      cursor: 'matched-page',
      limit: 25,
      searchText: '',
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });

    expect(aiSearch.getMatchedIds).toHaveBeenCalledWith('sci-fi', 'up-next');
    expect(api.getMatchedItems).toHaveBeenCalledWith({
      identities: [
        { source: 'imdb', id: 'tt1' },
        { source: 'imdb', id: 'tt2' },
      ],
      cursor: 'matched-page',
      limit: 25,
      filters: { listType: 'up-next' },
    });
  });

  it('does not reuse previous matches for reloads during a new prompt debounce', async () => {
    aiSearch.getMatchedIds
      .mockReturnValueOnce(of({ status: 'success', matchedIds: ['tt-old'] }))
      .mockReturnValueOnce(of({ status: 'success', matchedIds: ['tt-new'] }));
    const setup = TestBed.runInInjectionContext(() => createSetup());
    const collectionState = TestBed.inject(collectionStateToken);
    const request = {
      reset: true,
      cursor: null,
      limit: 50,
      searchText: '',
      orderBy: 'createdAt' as const,
      orderDirection: 'desc' as const,
    };
    collectionState.setState('aiSearchPromptText', 'old prompt');
    collectionState.setState('aiSearchSendVersion', 1);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(500);
    TestBed.tick();
    setup.dataSource(request).subscribe();

    expect(api.getMatchedItems).toHaveBeenCalledWith(
      expect.objectContaining({ identities: [{ source: 'imdb', id: 'tt-old' }] })
    );
    api.getMatchedItems.mockClear();

    collectionState.setState('aiSearchPromptText', 'new prompt');
    collectionState.setState('aiSearchSendVersion', 2);
    TestBed.tick();

    const reloadEmissions = await firstValueFrom(setup.dataSource(request).pipe(toArray()));
    const scrollEmissions = await firstValueFrom(
      setup.dataSource({ ...request, reset: false, cursor: 'old-cursor' }).pipe(toArray())
    );

    expect(reloadEmissions).toEqual([]);
    expect(scrollEmissions).toEqual([]);
    expect(api.getMatchedItems).not.toHaveBeenCalled();
    expect(aiSearch.getMatchedIds).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    TestBed.tick();
    setup.dataSource(request).subscribe();

    expect(aiSearch.getMatchedIds).toHaveBeenLastCalledWith('new prompt', 'up-next');
    expect(api.getMatchedItems).toHaveBeenCalledWith(
      expect.objectContaining({ identities: [{ source: 'imdb', id: 'tt-new' }] })
    );
  });

  it('loads provider-native book matches with their encoded identity source', async () => {
    aiSearch.getMatchedIds.mockReturnValue(of({ status: 'success', matchedIds: ['openlibrary:9780140328721'] }));
    const setup = TestBed.runInInjectionContext(() => createSetup('books'));
    const collectionState = TestBed.inject(collectionStateToken);
    collectionState.setState('aiSearchPromptText', 'fantasy books');
    collectionState.setState('aiSearchSendVersion', 1);
    collectionState.setState('forceStandardSearch', false);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(500);
    TestBed.tick();

    setup.dataSource({
      reset: true,
      cursor: null,
      limit: 25,
      searchText: '',
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });

    expect(api.getMatchedItems).toHaveBeenCalledWith({
      identities: [{ source: 'openlibrary', id: '9780140328721' }],
      limit: 25,
      filters: { listType: 'books' },
    });
  });

  it('surfaces AI errors and retries the current prompt', async () => {
    aiSearch.getMatchedIds
      .mockReturnValueOnce(of({ status: 'error' }))
      .mockReturnValueOnce(of({ status: 'success', matchedIds: ['tt-retry'] }));
    const setup = TestBed.runInInjectionContext(() => createSetup());
    const collectionState = TestBed.inject(collectionStateToken);
    collectionState.setState('aiSearchPromptText', 'retry me');
    collectionState.setState('aiSearchSendVersion', 1);
    collectionState.setState('forceStandardSearch', false);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(500);
    TestBed.tick();

    const request = {
      reset: true,
      cursor: null,
      limit: 50,
      searchText: '',
      orderBy: 'createdAt' as const,
      orderDirection: 'desc' as const,
    };
    await expect(firstValueFrom(setup.dataSource(request))).rejects.toThrow('AI search failed');

    collectionState.setState('aiSearchSendVersion', 2);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(500);
    TestBed.tick();
    setup.dataSource(request).subscribe();

    expect(aiSearch.getMatchedIds).toHaveBeenCalledTimes(2);
    expect(api.getMatchedItems).toHaveBeenCalledWith({
      identities: [{ source: 'imdb', id: 'tt-retry' }],
      limit: 50,
      filters: { listType: 'up-next' },
    });
  });

  it('clears AI filter when standard search is used', () => {
    const setup = TestBed.runInInjectionContext(() => createSetup());
    const collectionState = TestBed.inject(collectionStateToken);
    collectionState.setState('aiSearchPromptText', 'sci-fi');
    collectionState.setState('forceStandardSearch', false);

    setup.clearAiFilterOnStandardSearch();

    expect(collectionState.state.aiSearchPromptText()).toBe('');
    expect(collectionState.state.forceStandardSearch()).toBe(true);
  });
});
