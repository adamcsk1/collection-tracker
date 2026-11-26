import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { collectionStateToken, initialCollectionState, type CollectionState } from '../collection-store';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState, type ApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_COLLECTION_LIST_ORDER_PREFERENCES } from '@shared/constants/storage-const';
import {
  CollectionItemApiModel,
  CollectionItemFiltersApiModel,
  CollectionItemsPageModel,
} from '@shared/models/api-model';
import { NgxSignalTranslateService, provideSignalTranslateConfig } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { initialTagManagementState, tagManagementStateToken } from '../../tag-management/tag-management-store';
import { initialSharesState, sharesStateToken } from '../../shares/shares-store';
import { FloatActionButtons } from '../float-action-buttons/float-action-buttons';
import { FloatActionButtonsService } from '../float-action-buttons/float-action-buttons-service';
import { ItemDialog } from '../item/item-dialog/item-dialog';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { List } from './list';
import { FLOAT_ACTION_SCROLLING_IDLE_MS } from './list-const';

vi.mock('marked', () => ({ marked: { parse: () => '' } }));

describe('List', () => {
  let fixture: ComponentFixture<List>;
  let component: List;
  let portal: { open: ReturnType<typeof vi.fn>; closeAll: ReturnType<typeof vi.fn> };
  let api: {
    searchItems: Mock<
      (
        filters: CollectionItemFiltersApiModel,
        cursor?: string | null,
        limit?: number
      ) => Observable<CollectionItemsPageModel>
    >;
    getMatchedItems: ReturnType<typeof vi.fn>;
    getRandomItem: ReturnType<typeof vi.fn>;
    getShares: ReturnType<typeof vi.fn>;
  };
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let apiState: NgxSimpleSignalStoreService<ApiState>;
  let floatActions: FloatActionsService;
  let actionButtons: FloatActionButtonsService;
  let scrollSpy: ReturnType<typeof vi.fn>;
  let webstorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn>; url: string };
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const buildFilters = (searchText: string): CollectionItemFiltersApiModel => {
    const search = searchText.trim();
    if (search.startsWith('#')) return { tags: [search], tagMode: 'all' };
    return search ? { search } : {};
  };

  const buildItem = (title: string, IMDbId = title): CollectionItemApiModel => ({
    image: '',
    title,
    titleLower: title.toLowerCase(),
    genre: [],
    IMDbId,
    externalProvider: 'omdb',
    externalItemId: IMDbId,
    tags: [],
    year: null,
    rate: '',
    rottenTomatoesRate: '',
    metacriticRate: '',
    userRate: null,
    hash: '',
    actors: '',
    plot: '',
    listType: 'library',
    contentType: 'movie',
    favorite: false,
    watchedAt: null,
    ownerShareCode: 'own-code',
  });

  beforeEach(() => {
    portal = { open: vi.fn(), closeAll: vi.fn() };
    router = { navigate: vi.fn(() => Promise.resolve(true)), url: '/collection' };
    queryParamMap = new BehaviorSubject(convertToParamMap({}));
    webstorage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    api = {
      searchItems: vi.fn(() => {
        const items = [buildItem('Alpha'), buildItem('Beta'), buildItem('Gamma')];
        return of({ items, page: { limit: 50, hasMore: false, nextCursor: null } } as const);
      }),
      getMatchedItems: vi.fn(() =>
        of({ items: [buildItem('AI Match', 'tt-ai')], page: { limit: 50, hasMore: false, nextCursor: null } })
      ),
      getRandomItem: vi.fn(() => of(buildItem('Random Pick', 'tt-random'))),
      getShares: vi.fn(() => of({ userShareCode: 'own-code', outgoing: [], incoming: [] })),
    };

    TestBed.configureTestingModule({
      imports: [List],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: {} }, queryParamMap },
        },
        { provide: WebstorageService, useValue: webstorage },
        { provide: ApiService, useValue: api },

        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialCollectionState, collectionStateToken),
        provideStore(initialTagManagementState, tagManagementStateToken),
        provideStore(initialSharesState, sharesStateToken),
        provideSignalTranslateConfig({ path: '' }),
      ],
    });

    fixture = TestBed.createComponent(List);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('dataSource', ({ cursor, limit, searchText }: any) =>
      api.searchItems(buildFilters(searchText), cursor, limit)
    );
    collectionState = TestBed.inject(collectionStateToken);
    apiState = TestBed.inject(apiStateToken);
    floatActions = TestBed.inject(FloatActionsService);
    actionButtons = TestBed.inject(FloatActionButtonsService);

    scrollSpy = vi.fn();
    (component as any).scrollContainer = () => ({ nativeElement: { scrollTo: scrollSpy } }) as ElementRef;
  });

  it('exposes active filters and clears query filters without changing ordering', () => {
    const focusSearch = vi.spyOn(floatActions, 'focusSearch');
    fixture.componentRef.setInput('routeFilterKey', JSON.stringify({ type: 'album', favorite: true }));
    collectionState.setState('searchText', 'Album');
    collectionState.setState('aiSearchPromptText', 'Calm music');
    expect(component['activeFilters']().map((filter) => filter.value)).toEqual(['album', 'favorite']);
    expect(component['hasActiveFilters']()).toBe(true);
    component['onClearFilters']();
    expect(focusSearch).toHaveBeenCalledOnce();
    expect(collectionState.state.searchText()).toBe('');
    expect(collectionState.state.aiSearchPromptText()).toBe('');
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { search: null, type: null, watched: null, favorite: null, completed: null, shared: null },
      queryParamsHandling: 'merge',
    });
  });

  it('removes an album scope through the type query parameter', () => {
    const focusSearch = vi.spyOn(floatActions, 'focusSearch');
    fixture.componentRef.setInput('routeFilterKey', JSON.stringify({ type: 'album' }));
    component['onRemoveFilter']('album');
    expect(focusSearch).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith([], { queryParams: { type: null }, queryParamsHandling: 'merge' });
  });

  it.each([
    ['movie', 'Movies'],
    ['series', 'Series'],
    ['book', 'Books'],
    ['album', 'Music'],
  ])('labels %s as a media filter with an explicit removal action', (type, label) => {
    vi.spyOn(TestBed.inject(NgxSignalTranslateService), 'translate').mockImplementation((key, params) => {
      if (key === 'Filter.Media') return `Media: ${params?.['media']}`;
      if (key === 'Filter.Remove') return `Remove filter: ${params?.['filter']}`;
      return key;
    });
    fixture.componentRef.setInput('routeFilterKey', JSON.stringify({ type, favorite: true }));
    expect(component['activeFilters']()).toEqual([
      { value: type, label: `Media: ${label}`, removeLabel: `Remove filter: Media: ${label}` },
      { value: 'favorite', label: 'Favorites', removeLabel: 'Remove filter: Favorites' },
    ]);
  });

  it('renders filter context and removal names, and removes only the clicked filter', async () => {
    vi.spyOn(TestBed.inject(NgxSignalTranslateService), 'translate').mockImplementation((key, params) => {
      if (key === 'ActiveFilters') return 'Active filters';
      if (key === 'Filter.Media') return `Media: ${params?.['media']}`;
      if (key === 'Filter.Remove') return `Remove filter: ${params?.['filter']}`;
      return key;
    });
    fixture.componentRef.setInput('routeFilterKey', JSON.stringify({ type: 'album', favorite: true }));
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[data-test-id="collection-active-filters-label"]')?.textContent).toBe(
      'Active filters:'
    );
    const music = element.querySelector<HTMLButtonElement>('[data-test-id="active-filter-album"]')!;
    expect(music.textContent?.trim()).toBe('Media: Music ×');
    expect(music.getAttribute('aria-label')).toBe('Remove filter: Media: Music');
    expect(music.title).toBe('Remove filter: Media: Music');
    expect(music.hasAttribute('aria-pressed')).toBe(false);
    music.click();
    expect(router.navigate).toHaveBeenCalledWith([], { queryParams: { type: null }, queryParamsHandling: 'merge' });
  });

  it.each([
    { name: 'no filters', filters: {}, search: '', ai: '', visible: false },
    { name: 'one chip', filters: { type: 'album' }, search: '', ai: '', visible: false },
    { name: 'one chip and whitespace', filters: { type: 'album' }, search: '  ', ai: '', visible: false },
    { name: 'two chips', filters: { type: 'album', favorite: true }, search: '', ai: '', visible: true },
    { name: 'one chip and text search', filters: { type: 'album' }, search: 'Calm', ai: '', visible: true },
    { name: 'text search alone', filters: {}, search: 'Calm', ai: '', visible: true },
    { name: 'AI search alone', filters: {}, search: '', ai: 'Calm music', visible: true },
  ])('shows clear filters only when useful: $name', async ({ filters, search, ai, visible }) => {
    if (Object.keys(filters).length) {
      fixture.componentRef.setInput('routeFilterKey', JSON.stringify(filters));
    }
    collectionState.setState('searchText', search);
    collectionState.setState('aiSearchPromptText', ai);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(!!element.querySelector('[data-test-id="collection-clear-filters"]')).toBe(visible);
    if ('type' in filters) {
      expect(element.querySelector('[data-test-id="active-filter-album"]')).not.toBeNull();
    }
  });

  it('fires only one initial items request on creation', async () => {
    vi.useFakeTimers();
    try {
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).toHaveBeenCalledTimes(1);
      expect(api.searchItems).toHaveBeenCalledWith({}, null, 50);
    } finally {
      vi.useRealTimers();
    }
  });

  it('derives list labels and internal prefilter state', () => {
    expect(component['translations'].collection()).toBe('Collection');
    expect(component['translations'].messageEmptyCollection()).toBe('Message.EmptyCollection');
    expect(component['translations'].messageAddFirstCollectionItem()).toBe('Message.AddFirstCollectionItem');
    expect(component['translations'].messageEmptySearch()).toBe('Message.EmptySearch');
    expect(component['translations'].messageSearchError()).toBe('Message.SearchError');
    expect(component['isInternalCollectionPrefiltered']()).toBe(false);

    fixture.componentRef.setInput('listType', 'tracking');
    fixture.detectChanges();

    expect(component['isInternalCollectionPrefiltered']()).toBe(true);
  });

  it('loads items from the server and resets scroll position for search text', async () => {
    vi.useFakeTimers();
    try {
      collectionState.setState('searchText', 'be');
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).toHaveBeenLastCalledWith({ search: 'be' }, null, 50);
      expect(component['visibleCollection']().map((item) => item.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
      expect(scrollSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets immediately when the route search changes', async () => {
    vi.useFakeTimers();
    try {
      collectionState.setState('searchText', 'typed');
      fixture.detectChanges();

      fixture.componentRef.setInput('routeSearchText', '#favorite');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(api.searchItems).toHaveBeenCalledWith({ tags: ['#favorite'], tagMode: 'all' }, null, 50);

      api.searchItems.mockClear();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).not.toHaveBeenCalledWith({ search: 'typed' }, null, 50);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the initial route search after the store search debounce settles', async () => {
    vi.useFakeTimers();
    try {
      collectionState.setState('searchText', 'typed');
      fixture.componentRef.setInput('routeSearchText', '#favorite');
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).toHaveBeenLastCalledWith({ tags: ['#favorite'], tagMode: 'all' }, null, 50);
      expect(api.searchItems).not.toHaveBeenCalledWith({ search: 'typed' }, null, 50);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the collection empty message when the collection is empty', async () => {
    api.searchItems.mockReturnValue(of({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } }));
    vi.useFakeTimers();
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      const emptyMessage = (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-empty"]');
      const list = (fixture.nativeElement as HTMLElement).querySelector('[role="list"]');
      const addFirstButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '[data-test-id="add-first-item"]'
      );
      expect(emptyMessage?.textContent).toContain('Message.EmptyCollection');
      expect(emptyMessage?.textContent).toContain('Message.AddFirstCollectionItem');
      expect(list?.contains(emptyMessage)).toBe(false);
      expect(addFirstButton?.tagName).toBe('BUTTON');
      expect(addFirstButton?.type).toBe('button');

      addFirstButton?.click();

      expect(portal.open).toHaveBeenCalledWith(NewItemDialog, expect.any(Object));
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats old virtual unwatched search as a custom tag filter', async () => {
    vi.useFakeTimers();
    try {
      collectionState.setState('searchText', '#unwatched');
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).toHaveBeenLastCalledWith({ tags: ['#unwatched'], tagMode: 'all' }, null, 50);
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats old virtual uncompleted search as a custom tag filter', async () => {
    vi.useFakeTimers();
    try {
      collectionState.setState('searchText', '#uncompleted');
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).toHaveBeenLastCalledWith({ tags: ['#uncompleted'], tagMode: 'all' }, null, 50);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the search empty message when filtered results are empty', async () => {
    api.searchItems.mockReturnValue(of({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } }));
    fixture.componentRef.setInput('routeSearchText', '#favorite');
    vi.useFakeTimers();
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      const emptyMessage = (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-empty"]');
      expect(emptyMessage?.textContent).toContain('Message.EmptySearch');
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="add-first-item"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['library', 'books', 'music', 'tracking', 'up-next', 'wishlist'])(
    'announces completed empty searches in a persistent text-only status on %s',
    async (listType) => {
      const response = new Subject<CollectionItemsPageModel>();
      api.searchItems.mockReturnValue(response);
      fixture.componentRef.setInput('listType', listType);
      fixture.componentRef.setInput('routeSearchText', 'missing');
      await fixture.whenStable();

      const element = fixture.nativeElement as HTMLElement;
      const status = element.querySelector('[data-test-id="collection-search-status"]');
      expect(status?.getAttribute('role')).toBe('status');
      expect(status?.getAttribute('aria-live')).toBe('polite');
      expect(status?.getAttribute('aria-atomic')).toBe('true');
      expect(status?.closest('[aria-busy]')).toBeNull();
      expect(status?.textContent?.trim()).toBe('');
      const focusedElement = document.activeElement;

      response.next({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } });
      await fixture.whenStable();

      expect(element.querySelector('[data-test-id="collection-search-status"]')).toBe(status);
      expect(status?.textContent?.trim()).toBe('Message.EmptySearch');
      expect(status?.children.length).toBe(0);
      expect(document.activeElement).toBe(focusedElement);
      expect(element.querySelector('[role="list"]')?.hasAttribute('aria-live')).toBe(false);

      const mutations = vi.fn();
      const observer = new MutationObserver(mutations);
      observer.observe(status!, { childList: true, characterData: true, subtree: true });
      component['scrolling'].set(true);
      fixture.componentRef.setInput('emptyIcon', 'search_off');
      apiState.setState('loadNetworkStatus', 'pending');
      await fixture.whenStable();
      apiState.setState('loadNetworkStatus', 'finished');
      await fixture.whenStable();
      expect(mutations).not.toHaveBeenCalled();
      observer.disconnect();

      component['loadItems'](true, 'another search');
      await fixture.whenStable();
      expect(status?.textContent?.trim()).toBe('');
      response.next({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } });
      await fixture.whenStable();
      expect(status?.textContent?.trim()).toBe('Message.EmptySearch');

      component['loadItems'](true, 'matching search');
      await fixture.whenStable();
      expect(status?.textContent?.trim()).toBe('');
      response.next({ items: [buildItem('Match')], page: { limit: 50, hasMore: false, nextCursor: null } });
      await fixture.whenStable();
      expect(status?.textContent?.trim()).toBe('');
      expect(element.querySelector('[data-test-id="collection-search-status"]')).toBe(status);
    }
  );

  it('keeps empty collections and failed searches out of the no-results status', async () => {
    const response = new Subject<CollectionItemsPageModel>();
    api.searchItems.mockReturnValue(response);
    await fixture.whenStable();
    const status = (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="collection-search-status"]');

    response.next({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } });
    await fixture.whenStable();
    expect(status?.textContent?.trim()).toBe('');

    component['loadItems'](true, 'failed');
    response.error(new Error('failed'));
    await fixture.whenStable();
    expect(status?.textContent?.trim()).toBe('');
  });

  it.each(['route filter', 'AI'])('announces empty %s results without standard search text', async (searchMode) => {
    const response = new Subject<CollectionItemsPageModel>();
    fixture.componentRef.setInput('dataSource', () => response);
    if (searchMode === 'route filter') {
      fixture.componentRef.setInput('routeFilterKey', JSON.stringify({ favorite: true }));
    } else {
      collectionState.setState('aiSearchPromptText', 'science fiction');
      collectionState.setState('forceStandardSearch', false);
    }
    await fixture.whenStable();
    const status = (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="collection-search-status"]');
    expect(status?.textContent?.trim()).toBe('');

    response.next({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } });
    await fixture.whenStable();
    expect(status?.textContent?.trim()).toBe('Message.EmptySearch');
  });

  it('shows the filtered empty message when route filters return no items', async () => {
    api.searchItems.mockReturnValue(of({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } }));
    fixture.componentRef.setInput(
      'routeFilterKey',
      JSON.stringify({ type: null, favorite: true, watched: null, completed: null })
    );
    vi.useFakeTimers();
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      const emptyMessage = (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-empty"]');
      expect(emptyMessage?.textContent).toContain('Message.EmptySearch');
      expect(emptyMessage?.textContent).not.toContain('Message.EmptyCollection');
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="add-first-item"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the new item dialog in watch later mode on the watch later page', () => {
    fixture.componentRef.setInput('listType', 'up-next');
    fixture.detectChanges();

    component['onAddNew']();

    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, {
      upNext: true,
      wishlist: false,
      tracking: false,
      books: false,
      music: false,
      allowedContentTypes: ['movie', 'series', 'book', 'album'],
    });
  });

  it('passes the floating focus fallback to the portal', () => {
    const fallback = vi.fn(() => document.createElement('button'));
    component['onAddNew'](fallback);
    const resolveFallback = vi.mocked(portal.open).mock.calls.at(-1)?.[2];
    expect(resolveFallback?.()).toBeInstanceOf(HTMLButtonElement);
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('skips the floating focus fallback after the route changes', () => {
    const fallback = vi.fn(() => document.createElement('button'));
    component['onAddNew'](fallback);
    const resolveFallback = vi.mocked(portal.open).mock.calls.at(-1)?.[2];
    router.url = '/other';

    expect(resolveFallback?.()).toBeNull();
    expect(fallback).not.toHaveBeenCalled();
  });

  it('skips the floating focus fallback after the list is destroyed', () => {
    const fallback = vi.fn(() => document.createElement('button'));
    component['onAddNew'](fallback);
    const resolveFallback = vi.mocked(portal.open).mock.calls.at(-1)?.[2];
    fixture.destroy();

    expect(resolveFallback?.()).toBeNull();
    expect(fallback).not.toHaveBeenCalled();
  });

  it('opens the new item dialog in wishlist mode on the wishlist page', () => {
    fixture.componentRef.setInput('listType', 'wishlist');
    fixture.detectChanges();

    component['onAddNew']();

    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, {
      upNext: false,
      wishlist: true,
      tracking: false,
      books: false,
      music: false,
      allowedContentTypes: ['movie', 'series', 'book', 'album'],
    });
  });

  it('opens the new item dialog in tracking mode on the tracking page', () => {
    fixture.componentRef.setInput('listType', 'tracking');
    fixture.detectChanges();

    component['onAddNew']();

    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, {
      upNext: false,
      wishlist: false,
      tracking: true,
      books: false,
      music: false,
      allowedContentTypes: ['movie', 'series', 'book', 'album'],
    });
  });

  it('emits a random pick request', async () => {
    const randomPick = vi.fn();
    fixture.componentRef.instance.randomPick.subscribe(randomPick);
    fixture.detectChanges();

    component['onRandomPick']();

    expect(randomPick).toHaveBeenCalled();
  });

  it('loads more items when scrolled near the bottom', () => {
    component['hasMore'].set(true);
    component['nextCursor'].set('next-page');
    component['visibleCollection'].set([buildItem('One')]);
    const element = { scrollHeight: 1000, scrollTop: 850, clientHeight: 100 };
    (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

    component['onScroll']();

    expect(api.searchItems).toHaveBeenCalledWith({}, 'next-page', 50);
  });

  it('prevents concurrent scroll requests when global network status changes', () => {
    const pageResponse = new Subject<CollectionItemsPageModel>();
    api.searchItems.mockReturnValue(pageResponse);
    component['hasMore'].set(true);
    component['nextCursor'].set('next-page');
    const element = { scrollHeight: 1000, scrollTop: 850, clientHeight: 100 };
    (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

    component['onScroll']();
    apiState.setState('loadNetworkStatus', 'finished');
    component['onScroll']();

    expect(api.searchItems).toHaveBeenCalledTimes(1);
    expect(api.searchItems).toHaveBeenCalledWith({}, 'next-page', 50);
  });

  it('loads more route-filtered items when scrolled on a prefiltered page', async () => {
    vi.useFakeTimers();
    try {
      fixture.componentRef.setInput('routeSearchText', '#watchlist');
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      api.searchItems.mockClear();
      component['hasMore'].set(true);
      component['nextCursor'].set('next-page');
      component['visibleCollection'].set([buildItem('One')]);
      const element = { scrollHeight: 1000, scrollTop: 850, clientHeight: 100 };
      (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

      component['onScroll']();

      expect(api.searchItems).toHaveBeenCalledWith({ tags: ['#watchlist'], tagMode: 'all' }, 'next-page', 50);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores an older response after the search changes', () => {
    const firstResponse = new Subject<CollectionItemsPageModel>();
    const secondResponse = new Subject<CollectionItemsPageModel>();
    api.searchItems.mockReturnValueOnce(firstResponse).mockReturnValueOnce(secondResponse);

    component['loadItems'](true, 'first');
    component['loadItems'](true, 'second');
    secondResponse.next({
      items: [buildItem('Second')],
      page: { limit: 50, hasMore: true, nextCursor: 'second-cursor' },
    });
    firstResponse.next({
      items: [buildItem('First')],
      page: { limit: 50, hasMore: true, nextCursor: 'first-cursor' },
    });

    expect(component['visibleCollection']().map((item) => item.title)).toEqual(['Second']);
    expect(component['nextCursor']()).toBe('second-cursor');
  });

  it('lets a reset supersede a pending page request', () => {
    const pageResponse = new Subject<CollectionItemsPageModel>();
    const resetResponse = new Subject<CollectionItemsPageModel>();
    api.searchItems.mockReturnValueOnce(pageResponse).mockReturnValueOnce(resetResponse);
    component['visibleCollection'].set([buildItem('Existing')]);
    component['nextCursor'].set('next-page');

    component['loadItems'](false);
    component['loadItems'](true, 'new search');
    pageResponse.next({
      items: [buildItem('Old Page')],
      page: { limit: 50, hasMore: false, nextCursor: null },
    });
    resetResponse.next({
      items: [buildItem('Reset Result')],
      page: { limit: 50, hasMore: true, nextCursor: 'reset-cursor' },
    });

    expect(component['visibleCollection']().map((item) => item.title)).toEqual(['Reset Result']);
    expect(component['nextCursor']()).toBe('reset-cursor');
    expect(apiState.state.loadNetworkStatus()).toBe('finished');
  });

  it('retains current rows until a reset succeeds, including through errors', () => {
    const pendingResponse = new Subject<CollectionItemsPageModel>();
    api.searchItems.mockReturnValueOnce(pendingResponse);
    component['visibleCollection'].set([buildItem('Existing')]);

    component['loadItems'](true, 'new search');
    expect(component['visibleCollection']().map((item) => item.title)).toEqual(['Existing']);

    pendingResponse.error(new Error('failed'));
    expect(component['visibleCollection']().map((item) => item.title)).toEqual(['Existing']);
    expect(apiState.state.loadNetworkStatus()).toBe('error');

    api.searchItems.mockReturnValueOnce(of({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } }));
    component['loadItems'](true, 'new search');

    expect(component['visibleCollection']()).toEqual([]);
    expect(apiState.state.loadNetworkStatus()).toBe('finished');
  });

  it('clears retained AI rows and renders an alert with a retry action when AI search fails', () => {
    const pendingResponse = new Subject<CollectionItemsPageModel>();
    fixture.componentRef.setInput('dataSource', () => pendingResponse);
    collectionState.setState('aiSearchPromptText', 'science fiction');
    collectionState.setState('forceStandardSearch', false);
    component['visibleCollection'].set([buildItem('Stale AI Match')]);

    component['loadItems'](true);
    pendingResponse.error(new Error('AI search failed'));
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('[data-test-id="ai-search-error"]');
    expect(component['visibleCollection']()).toEqual([]);
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('Message.AiSearchError');

    fixture.nativeElement.querySelector('[data-test-id="ai-search-retry"]').click();

    expect(collectionState.state.aiSearchPromptText()).toBe('science fiction');
    expect(collectionState.state.aiSearchSendVersion()).toBe(1);
  });

  it('shows a standard failure and retries the standard request when a route filter retains an AI prompt', () => {
    const pendingResponse = new Subject<CollectionItemsPageModel>();
    fixture.componentRef.setInput('dataSource', () => pendingResponse);
    fixture.componentRef.setInput('routeFilterKey', JSON.stringify({ favorite: true }));
    collectionState.setState('aiSearchPromptText', 'science fiction');
    collectionState.setState('forceStandardSearch', false);
    component['visibleCollection'].set([buildItem('Existing')]);

    component['loadItems'](true);
    pendingResponse.error(new Error('Standard search failed'));
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('[data-test-id="ai-search-error"]');
    expect(component['aiFilterActive']()).toBe(false);
    expect(component['visibleCollection']().map((item) => item.title)).toEqual(['Existing']);
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('Message.SearchError');
    expect(error?.textContent).not.toContain('Message.AiSearchError');

    const reloadTrigger = TestBed.inject(mainCollectionStateToken).state.reloadTrigger();
    fixture.nativeElement.querySelector('[data-test-id="ai-search-retry"]').click();

    expect(TestBed.inject(mainCollectionStateToken).state.reloadTrigger()).toBe(reloadTrigger + 1);
    expect(collectionState.state.aiSearchSendVersion()).toBe(0);
  });

  it('retries a failed AI continuation without resetting successful rows or cursor', () => {
    const failedResponse = new Subject<CollectionItemsPageModel>();
    const successfulResponse = new Subject<CollectionItemsPageModel>();
    const dataSource = vi.fn().mockReturnValueOnce(failedResponse).mockReturnValueOnce(successfulResponse);
    fixture.detectChanges();
    fixture.componentRef.setInput('dataSource', dataSource);
    collectionState.setState('aiSearchPromptText', 'science fiction');
    collectionState.setState('forceStandardSearch', false);
    component['visibleCollection'].set([buildItem('AI Match')]);
    component['collectionLength'].set(1);
    component['nextCursor'].set('next-page');
    component['hasMore'].set(true);

    component['loadItems'](false);
    failedResponse.error(new Error('AI continuation failed'));
    fixture.detectChanges();

    expect(component['visibleCollection']().map((item) => item.title)).toEqual(['AI Match']);
    expect(component['collectionLength']()).toBe(1);
    expect(component['nextCursor']()).toBe('next-page');
    expect(component['hasMore']()).toBe(true);
    const error = fixture.nativeElement.querySelector('[data-test-id="ai-search-error"]');
    const list = (fixture.nativeElement as HTMLElement).querySelector('[role="list"]');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(list?.contains(error)).toBe(false);
    expect(Array.from(list?.children ?? []).every((child) => child.getAttribute('role') === 'listitem')).toBe(true);

    fixture.nativeElement.querySelector('[data-test-id="ai-search-retry"]').click();
    successfulResponse.next({
      items: [buildItem('Next AI Match')],
      page: { limit: 50, hasMore: false, nextCursor: null },
    });

    expect(dataSource).toHaveBeenNthCalledWith(2, {
      reset: false,
      cursor: 'next-page',
      limit: 50,
      searchText: '',
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });
    expect(component['visibleCollection']().map((item) => item.title)).toEqual(['AI Match', 'Next AI Match']);
    expect(component['collectionLength']()).toBe(2);
    expect(collectionState.state.aiSearchSendVersion()).toBe(0);
    expect(apiState.state.loadNetworkStatus()).toBe('finished');
  });

  it('keeps loading placeholders outside the collection list semantics', () => {
    const pendingResponse = new Subject<CollectionItemsPageModel>();
    fixture.componentRef.setInput('dataSource', () => pendingResponse);

    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector('[role="list"]');
    const loadingPlaceholder = fixture.nativeElement.querySelector('ct-list-item-skeleton');
    expect(loadingPlaceholder).toBeTruthy();
    expect(list?.contains(loadingPlaceholder)).toBe(false);
  });

  it('does not let a stale error clear the current pending request or status', () => {
    const staleResponse = new Subject<CollectionItemsPageModel>();
    const currentResponse = new Subject<CollectionItemsPageModel>();
    api.searchItems.mockReturnValueOnce(staleResponse).mockReturnValueOnce(currentResponse);
    component['nextCursor'].set('next-page');
    const element = { scrollHeight: 1000, scrollTop: 850, clientHeight: 100 };
    (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

    component['loadItems'](false);
    component['loadItems'](true, 'new search');
    staleResponse.error(new Error('stale request failed'));
    component['onScroll']();

    expect(api.searchItems).toHaveBeenCalledTimes(2);
    expect(apiState.state.loadNetworkStatus()).toBe('pending');

    currentResponse.next({
      items: [buildItem('Current')],
      page: { limit: 50, hasMore: false, nextCursor: null },
    });

    expect(component['visibleCollection']().map((item) => item.title)).toEqual(['Current']);
    expect(apiState.state.loadNetworkStatus()).toBe('finished');
  });

  it('appends a malformed page once, stops pagination, and marks the load as an error', () => {
    api.searchItems.mockReturnValue(
      of({
        items: [buildItem('Malformed Page')],
        page: { limit: 50, hasMore: true, nextCursor: null },
      } as unknown as CollectionItemsPageModel)
    );
    component['visibleCollection'].set([buildItem('Existing')]);
    component['nextCursor'].set('next-page');
    component['hasMore'].set(true);
    const element = { scrollHeight: 1000, scrollTop: 850, clientHeight: 100 };
    (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

    component['onScroll']();
    component['onScroll']();

    expect(component['visibleCollection']().map((item) => item.title)).toEqual(['Existing', 'Malformed Page']);
    expect(component['nextCursor']()).toBeNull();
    expect(component['hasMore']()).toBe(false);
    expect(apiState.state.loadNetworkStatus()).toBe('error');
    expect(api.searchItems).toHaveBeenCalledTimes(1);
  });

  it('keeps scroll-to-top available after reset scroll events while still scrolled down', async () => {
    vi.useFakeTimers();
    try {
      const element = document.createElement('div');
      element.scrollTop = 120;
      element.scrollTo = vi.fn();
      (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;
      component['scrollToTopAvailable'].set(true);

      component['onResetScrollPosition']();
      element.dispatchEvent(new Event('scroll'));
      await vi.advanceTimersByTimeAsync(500);

      expect(component['scrollToTopAvailable']()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('publishes scrolling state while the list is actively scrolling', async () => {
    vi.useFakeTimers();
    try {
      fixture.detectChanges();
      const element = { scrollHeight: 1000, scrollTop: 120, clientHeight: 900 };
      (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

      component['onScroll']();
      fixture.detectChanges();

      expect(floatActions.config().scrolling).toBe(true);

      await vi.advanceTimersByTimeAsync(FLOAT_ACTION_SCROLLING_IDLE_MS);
      fixture.detectChanges();

      expect(floatActions.config().scrolling).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('emits when float button functions are shown', () => {
    const showFunctions = vi.fn();
    fixture.componentRef.instance.showFunctions.subscribe(showFunctions);
    component['onShowFunctions']();

    expect(showFunctions).toHaveBeenCalled();
  });

  it('publishes float action config and resets it on destroy', () => {
    fixture.detectChanges();

    expect(floatActions.config().actionsAvailable).toBe(true);
    expect(actionButtons.config().showActions).toBe(true);
    expect(actionButtons.config().showOrderButtons).toBe(true);
    expect(actionButtons.config().filterActions).toEqual(['unwatched', 'favorite']);
    expect(actionButtons.config().activeFilterActions).toEqual([]);
    expect(actionButtons.config().orderBy).toBe('createdAt');
    expect(actionButtons.config().orderDirection).toBe('desc');
    expect(floatActions.actionsComponent()).toBe(FloatActionButtons);

    fixture.destroy();

    expect(floatActions.config().actionsAvailable).toBe(false);
    expect(actionButtons.config().showActions).toBe(false);
    expect(floatActions.actionsComponent()).toBeNull();
  });

  it('registers float action callbacks', () => {
    fixture.detectChanges();
    const addNewSpy = vi.spyOn(component as any, 'onAddNew');

    actionButtons.addNew();

    expect(addNewSpy).toHaveBeenCalled();
  });

  it('opens the new item dialog in books list mode', () => {
    fixture.componentRef.setInput('listType', 'books');

    component['onAddNew']();

    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, {
      upNext: false,
      wishlist: false,
      tracking: false,
      books: true,
      music: false,
      allowedContentTypes: ['book'],
    });
  });

  it('navigates when a filter action is applied', () => {
    fixture.detectChanges();

    actionButtons.applyFilter('completed');

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { completed: 'true' },
      queryParamsHandling: 'merge',
    });
  });

  it('applies the unwatched filter without constraining content type', () => {
    fixture.detectChanges();

    actionButtons.applyFilter('unwatched');

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { watched: 'false' },
      queryParamsHandling: 'merge',
    });
  });

  it('applies the favorite filter without constraining content type', () => {
    fixture.detectChanges();

    actionButtons.applyFilter('favorite');

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { favorite: 'true' },
      queryParamsHandling: 'merge',
    });
  });

  it('removes an active content type filter when it is applied again', () => {
    fixture.componentRef.setInput(
      'routeFilterKey',
      JSON.stringify({ type: 'movie', favorite: null, watched: false, completed: null })
    );
    fixture.detectChanges();

    actionButtons.applyFilter('movie');

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { type: null },
      queryParamsHandling: 'merge',
    });
  });

  it('removes an active watched filter when it is applied again', () => {
    fixture.componentRef.setInput(
      'routeFilterKey',
      JSON.stringify({ type: 'series', favorite: null, watched: false, completed: null })
    );
    fixture.detectChanges();

    actionButtons.applyFilter('unwatched');

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { watched: null },
      queryParamsHandling: 'merge',
    });
  });

  it('removes an active favorite filter when it is applied again', () => {
    fixture.componentRef.setInput(
      'routeFilterKey',
      JSON.stringify({ type: null, favorite: true, watched: null, completed: null })
    );
    fixture.detectChanges();

    actionButtons.applyFilter('favorite');

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { favorite: null },
      queryParamsHandling: 'merge',
    });
  });

  it('removes an active completed filter when it is applied again', () => {
    fixture.componentRef.setInput(
      'routeFilterKey',
      JSON.stringify({ type: null, favorite: null, watched: null, completed: false })
    );
    fixture.detectChanges();

    actionButtons.applyFilter('uncompleted');

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { completed: null },
      queryParamsHandling: 'merge',
    });
  });

  it('publishes contextual filter actions for tracking', () => {
    fixture.componentRef.setInput('listType', 'tracking');
    fixture.detectChanges();

    expect(actionButtons.config().filterActions).toEqual(['completed', 'uncompleted']);
  });

  it('publishes active filter actions from the route filter key', () => {
    fixture.componentRef.setInput(
      'routeFilterKey',
      JSON.stringify({ type: 'series', favorite: true, watched: false, completed: null })
    );
    fixture.detectChanges();

    expect(actionButtons.config().activeFilterActions).toEqual(['series', 'unwatched', 'favorite']);
  });

  it('publishes active completed filters from the route filter key', () => {
    fixture.componentRef.setInput(
      'routeFilterKey',
      JSON.stringify({ type: null, favorite: null, watched: null, completed: false })
    );
    fixture.detectChanges();

    expect(actionButtons.config().activeFilterActions).toEqual(['uncompleted']);
  });

  it.each([
    ['mine', 'sharedMine'],
    ['shared', 'sharedOnly'],
  ] as const)('preserves the books content filter while toggling the %s shared filter', (shared, action) => {
    fixture.componentRef.setInput('listType', 'books');
    fixture.componentRef.setInput(
      'routeFilterKey',
      JSON.stringify({ type: 'book', favorite: null, watched: null, completed: null, shared })
    );
    fixture.detectChanges();

    expect(actionButtons.config().activeFilterActions).toEqual(['book', action]);

    component['onApplyFilter'](action);

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { shared: null },
      queryParamsHandling: 'merge',
    });
  });

  it('restores list order preference from local storage', () => {
    webstorage.getItem.mockReturnValue(JSON.stringify({ library: { orderBy: 'alphabet', orderDirection: 'asc' } }));

    fixture.detectChanges();

    expect(component['orderBy']()).toBe('alphabet');
    expect(component['orderDirection']()).toBe('asc');
    expect(api.searchItems).toHaveBeenCalled();
  });

  it('stores list order preference under the current page key', () => {
    fixture.componentRef.setInput('listType', 'wishlist');
    fixture.detectChanges();

    component['onToggleOrderBy']();
    component['onToggleOrderDirection']();
    fixture.detectChanges();

    const latestStoredValue = webstorage.setItem.mock.calls.at(-1)?.[1] as string;
    expect(webstorage.setItem.mock.calls.at(-1)?.[0]).toBe(STORAGE_COLLECTION_LIST_ORDER_PREFERENCES);
    expect(JSON.parse(latestStoredValue)).toEqual({ wishlist: { orderBy: 'alphabet', orderDirection: 'asc' } });
  });

  it.each([
    ['movie', 'movie'],
    ['series', 'series'],
    ['book', 'book'],
  ] as const)('locks new item content type to active %s filter', (filter, contentType) => {
    fixture.componentRef.setInput('routeFilterKey', JSON.stringify({ type: filter }));
    fixture.detectChanges();

    component['onAddNew']();

    expect(portal.open).toHaveBeenCalledWith(
      NewItemDialog,
      expect.objectContaining({ books: contentType === 'book', allowedContentTypes: [contentType] })
    );
  });

  it('does not load another page while far from the bottom', () => {
    api.searchItems.mockClear();
    component['hasMore'].set(true);
    const element = { scrollHeight: 1000, scrollTop: 100, clientHeight: 100 };
    (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

    component['onScroll']();

    expect(api.searchItems).not.toHaveBeenCalled();
  });

  it('toggles order controls in both directions', () => {
    component['onToggleOrderBy']();
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { orderBy: 'alphabet', orderDirection: null },
      queryParamsHandling: 'merge',
    });
    component['onToggleOrderDirection']();
    expect(component['orderBy']()).toBe('alphabet');
    expect(component['orderDirection']()).toBe('asc');
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { orderBy: 'alphabet', orderDirection: 'asc' },
      queryParamsHandling: 'merge',
    });

    component['onToggleOrderBy']();
    component['onToggleOrderDirection']();
    expect(component['orderBy']()).toBe('createdAt');
    expect(component['orderDirection']()).toBe('desc');
    expect(router.navigate).toHaveBeenLastCalledWith([], {
      queryParams: { orderBy: null, orderDirection: null },
      queryParamsHandling: 'merge',
    });
  });

  it.each([
    ['sharedMine', { shared: 'mine' }],
    ['sharedOnly', { shared: 'shared' }],
    ['uncompleted', { completed: 'false' }],
  ] as const)('adds inactive %s filter', (filter, queryParams) => {
    component['onApplyFilter'](filter);

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams,
      queryParamsHandling: 'merge',
    });
  });

  it('does not emit functions action for internal collections', () => {
    const showFunctions = vi.fn();
    fixture.componentRef.instance.showFunctions.subscribe(showFunctions);
    fixture.componentRef.setInput('listType', 'tracking');

    component['onShowFunctions']();

    expect(showFunctions).not.toHaveBeenCalled();
  });

  it('handles missing scroll container for scroll actions', () => {
    (component as any).scrollContainer = () => undefined;

    component['onScroll']();
    component['onResetScrollPosition']();

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('marks current load errors and clears pending request', () => {
    const response = new Subject<CollectionItemsPageModel>();
    api.searchItems.mockReturnValue(response);

    component['loadItems'](true, 'failed');
    response.error(new Error('failed'));

    expect(apiState.state.loadNetworkStatus()).toBe('error');
    expect(component['pendingLoadRequestId']).toBeNull();
  });

  it('hides filter actions when float actions are hidden', () => {
    fixture.componentRef.setInput('hideFloatActions', true);
    fixture.detectChanges();

    expect(actionButtons.config().filterActions).toEqual([]);
    expect(actionButtons.config().showActions).toBe(false);
  });

  it('adds shared filters for readable incoming grants', () => {
    TestBed.inject(sharesStateToken).setState('incoming', [
      {
        ownerUserShareCode: 'owner-code',
        ownerDisplayName: null,
        ownerAvatarRevision: null,
        ownerUsername: null,
        grants: [
          {
            listType: 'books',
            contentType: 'book',
            canRead: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            readMode: 'all',
          },
        ],
      },
    ]);
    fixture.detectChanges();

    expect(actionButtons.config().filterActions).toEqual(['unwatched', 'favorite', 'sharedMine', 'sharedOnly']);
  });

  it('uses reduced library filters while book scope is active', () => {
    fixture.componentRef.setInput('routeFilterKey', JSON.stringify({ type: 'book' }));
    fixture.detectChanges();

    expect(actionButtons.config().filterActions).toEqual(['favorite']);
  });

  it.each(['invalid-json', 'null', '1'])('falls back from malformed stored order preferences %s', (storedValue) => {
    webstorage.getItem.mockReturnValue(storedValue);
    fixture.componentRef.setInput('orderStorageKey', `key-${storedValue}`);
    fixture.detectChanges();

    expect(component['orderBy']()).toBe('createdAt');
    expect(component['orderDirection']()).toBe('desc');
  });

  it('uses explicit order storage key', () => {
    webstorage.getItem.mockReturnValue(JSON.stringify({ custom: { orderBy: 'alphabet', orderDirection: 'asc' } }));
    fixture.componentRef.setInput('orderStorageKey', 'custom');
    fixture.detectChanges();

    expect(component['orderBy']()).toBe('alphabet');
    expect(component['orderDirection']()).toBe('asc');
  });

  it('applies order from query params over stored preferences', () => {
    webstorage.getItem.mockReturnValue(JSON.stringify({ library: { orderBy: 'createdAt', orderDirection: 'desc' } }));
    queryParamMap.next(convertToParamMap({ orderBy: 'alphabet', orderDirection: 'asc' }));
    fixture.detectChanges();

    expect(component['orderBy']()).toBe('alphabet');
    expect(component['orderDirection']()).toBe('asc');
  });

  it('opens an item dialog from the item query param', () => {
    const matchedItem = buildItem('Deep Link', 'tt-deep');
    api.getMatchedItems.mockReturnValue(
      of({ items: [matchedItem], page: { limit: 1, hasMore: false, nextCursor: null } })
    );
    fixture.detectChanges();

    queryParamMap.next(convertToParamMap({ item: 'omdb:tt-deep' }));
    fixture.detectChanges();

    expect(api.getMatchedItems).toHaveBeenCalledWith({
      identities: [{ source: 'omdb', id: 'tt-deep' }],
      limit: 1,
      filters: { listType: 'library' },
    });
    expect(portal.open).toHaveBeenCalledWith(ItemDialog, { collectionItem: matchedItem });
  });

  it('closes the opened item when the item query param is cleared', () => {
    const matchedItem = buildItem('Deep Link', 'tt-deep');
    api.getMatchedItems.mockReturnValue(
      of({ items: [matchedItem], page: { limit: 1, hasMore: false, nextCursor: null } })
    );
    fixture.detectChanges();
    queryParamMap.next(convertToParamMap({ item: 'omdb:tt-deep' }));
    fixture.detectChanges();

    queryParamMap.next(convertToParamMap({}));
    fixture.detectChanges();

    expect(portal.closeAll).toHaveBeenCalled();
  });

  it('strips an invalid item query param', () => {
    fixture.detectChanges();
    queryParamMap.next(convertToParamMap({ item: 'not-an-identity' }));
    fixture.detectChanges();

    expect(api.getMatchedItems).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { item: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('strips an item query param when no match is found', () => {
    api.getMatchedItems.mockReturnValue(of({ items: [], page: { limit: 1, hasMore: false, nextCursor: null } }));
    fixture.detectChanges();
    queryParamMap.next(convertToParamMap({ item: 'omdb:missing' }));
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { item: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    expect(portal.open).not.toHaveBeenCalled();
  });

  it('strips the item query param when matching the item fails', () => {
    api.getMatchedItems.mockReturnValue(throwError(() => new Error('offline')));
    fixture.detectChanges();
    queryParamMap.next(convertToParamMap({ item: 'omdb:tt-deep' }));
    fixture.detectChanges();

    expect(portal.open).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { item: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('closes an opened item dialog when the list is destroyed', () => {
    const matchedItem = buildItem('Deep Link', 'tt-deep');
    api.getMatchedItems.mockReturnValue(
      of({ items: [matchedItem], page: { limit: 1, hasMore: false, nextCursor: null } })
    );
    fixture.detectChanges();
    queryParamMap.next(convertToParamMap({ item: 'omdb:tt-deep' }));
    fixture.detectChanges();
    portal.closeAll.mockClear();

    fixture.destroy();

    expect(portal.closeAll).toHaveBeenCalled();
  });
});
