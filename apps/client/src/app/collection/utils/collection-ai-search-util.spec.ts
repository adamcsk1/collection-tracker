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
      getMatchedItems: vi.fn(() => of({ items: [], total: 0, offset: 0, limit: 50 })),
      searchItems: vi.fn(() => of({ items: [], total: 0, offset: 0, limit: 50 })),
    };
    aiSearch = {
      getMatchedIds: vi.fn(() => of(null)),
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

  const createSetup = (listType: 'watchlist' | 'books' = 'watchlist') => {
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
      offset: 0,
      limit: 50,
      searchText: 'matrix',
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });

    expect(api.searchItems).toHaveBeenCalledWith(
      { search: 'matrix', listType: 'watchlist', orderBy: 'createdAt', orderDirection: 'desc' },
      0,
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
          offset: 0,
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
    aiSearch.getMatchedIds.mockReturnValue(of(['tt1', 'tt2']));
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
      offset: 0,
      limit: 25,
      searchText: '',
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });

    expect(aiSearch.getMatchedIds).toHaveBeenCalledWith('sci-fi', 'watchlist');
    expect(api.getMatchedItems).toHaveBeenCalledWith({
      identities: [
        { source: 'imdb', id: 'tt1' },
        { source: 'imdb', id: 'tt2' },
      ],
      offset: 0,
      limit: 25,
      filters: { listType: 'watchlist' },
    });
  });

  it('loads provider-native book matches with their encoded identity source', async () => {
    aiSearch.getMatchedIds.mockReturnValue(of(['openlibrary:9780140328721']));
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
      offset: 0,
      limit: 25,
      searchText: '',
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });

    expect(api.getMatchedItems).toHaveBeenCalledWith({
      identities: [{ source: 'openlibrary', id: '9780140328721' }],
      offset: 0,
      limit: 25,
      filters: { listType: 'books' },
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
