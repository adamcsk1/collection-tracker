import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CollectionState, collectionStateToken, initialCollectionState } from '../collection-store';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_COLLECTION_LIST_ORDER_PREFERENCES } from '@shared/constants/storage-const';
import {
  CollectionItemApiModel,
  CollectionItemFiltersApiModel,
  CollectionItemsApiResponseModel,
} from '@shared/models/api-model';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { initialTagManagementState, tagManagementStateToken } from '../../tag-management/tag-management-store';
import { initialSharesState, sharesStateToken } from '../../shares/shares-store';
import { FloatActionButtons } from '../float-action-buttons/float-action-buttons';
import { FloatActionButtonsService } from '../float-action-buttons/float-action-buttons-service';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { List } from './list';
import { FLOAT_ACTION_SCROLLING_IDLE_MS } from './list-const';

vi.mock('marked', () => ({ marked: { parse: () => '' } }));

describe('List', () => {
  let fixture: ComponentFixture<List>;
  let component: List;
  let portal: { open: ReturnType<typeof vi.fn> };
  let api: {
    searchItems: Mock<
      (
        filters: CollectionItemFiltersApiModel,
        offset?: number,
        limit?: number
      ) => Observable<CollectionItemsApiResponseModel>
    >;
    getMatchedItems: ReturnType<typeof vi.fn>;
    getRandomItem: ReturnType<typeof vi.fn>;
    getShares: ReturnType<typeof vi.fn>;
  };
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let floatActions: FloatActionsService;
  let actionButtons: FloatActionButtonsService;
  let scrollSpy: ReturnType<typeof vi.fn>;
  let webstorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

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
    portal = { open: vi.fn() };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    webstorage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    api = {
      searchItems: vi.fn((_filters, offset = 0, limit = 50) => {
        const items = [buildItem('Alpha'), buildItem('Beta'), buildItem('Gamma')];
        return of({ items: items.slice(offset, offset + limit), total: items.length, offset, limit });
      }),
      getMatchedItems: vi.fn(() => of({ items: [buildItem('AI Match', 'tt-ai')], total: 1, offset: 0, limit: 50 })),
      getRandomItem: vi.fn(() => of(buildItem('Random Pick', 'tt-random'))),
      getShares: vi.fn(() => of({ userShareCode: 'own-code', outgoing: [], incoming: [] })),
    };

    TestBed.configureTestingModule({
      imports: [List],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: Router, useValue: router },
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
    fixture.componentRef.setInput('dataSource', ({ offset, limit, searchText }: any) =>
      api.searchItems(buildFilters(searchText), offset, limit)
    );
    collectionState = TestBed.inject(collectionStateToken);
    floatActions = TestBed.inject(FloatActionsService);
    actionButtons = TestBed.inject(FloatActionButtonsService);

    scrollSpy = vi.fn();
    (component as any).scrollContainer = () => ({ nativeElement: { scrollTo: scrollSpy } }) as ElementRef;
  });

  it('fires only one initial items request on creation', async () => {
    vi.useFakeTimers();
    try {
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).toHaveBeenCalledTimes(1);
      expect(api.searchItems).toHaveBeenCalledWith({}, 0, 50);
    } finally {
      vi.useRealTimers();
    }
  });

  it('loads items from the server and resets scroll position for search text', async () => {
    vi.useFakeTimers();
    try {
      collectionState.setState('searchText', 'be');
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).toHaveBeenLastCalledWith({ search: 'be' }, 0, 50);
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

      expect(api.searchItems).toHaveBeenCalledWith({ tags: ['#favorite'], tagMode: 'all' }, 0, 50);

      api.searchItems.mockClear();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).not.toHaveBeenCalledWith({ search: 'typed' }, 0, 50);
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

      expect(api.searchItems).toHaveBeenLastCalledWith({ tags: ['#favorite'], tagMode: 'all' }, 0, 50);
      expect(api.searchItems).not.toHaveBeenCalledWith({ search: 'typed' }, 0, 50);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the collection empty message when the collection is empty', async () => {
    api.searchItems.mockReturnValue(of({ items: [], total: 0, offset: 0, limit: 50 }));
    vi.useFakeTimers();
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      const emptyMessage = (fixture.nativeElement as HTMLElement).querySelector('[data-test-id="list-empty"]');
      expect(emptyMessage?.textContent).toContain('Message.EmptyCollection');
      expect(emptyMessage?.textContent).toContain('Message.AddFirstCollectionItem');
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="add-first-item"]')).toBeTruthy();
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

      expect(api.searchItems).toHaveBeenLastCalledWith({ tags: ['#unwatched'], tagMode: 'all' }, 0, 50);
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

      expect(api.searchItems).toHaveBeenLastCalledWith({ tags: ['#uncompleted'], tagMode: 'all' }, 0, 50);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the search empty message when filtered results are empty', async () => {
    api.searchItems.mockReturnValue(of({ items: [], total: 0, offset: 0, limit: 50 }));
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

  it('shows the filtered empty message when route filters return no items', async () => {
    api.searchItems.mockReturnValue(of({ items: [], total: 0, offset: 0, limit: 50 }));
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
      allowedContentTypes: ['movie', 'series', 'book'],
    });
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
      allowedContentTypes: ['movie', 'series', 'book'],
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
      allowedContentTypes: ['movie', 'series', 'book'],
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
    component['collectionLength'].set(6);
    component['visibleCollection'].set([buildItem('One')]);
    const element = { scrollHeight: 1000, scrollTop: 850, clientHeight: 100 };
    (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

    component['onScroll']();

    expect(api.searchItems).toHaveBeenCalledWith({}, 1, 50);
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
      component['collectionLength'].set(6);
      component['visibleCollection'].set([buildItem('One')]);
      const element = { scrollHeight: 1000, scrollTop: 850, clientHeight: 100 };
      (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

      component['onScroll']();

      expect(api.searchItems).toHaveBeenCalledWith({ tags: ['#watchlist'], tagMode: 'all' }, 1, 50);
    } finally {
      vi.useRealTimers();
    }
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
});
