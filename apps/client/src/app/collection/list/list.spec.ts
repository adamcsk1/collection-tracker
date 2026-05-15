import { ElementRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '../collection-model';
import { CollectionState, collectionStateToken, initialCollectionState } from '../collection-store';
import { AiSearchService } from '../search/ai-search-service';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { VIRTUAL_UNWATCHED_TAG, WATCH_LATER_TAG } from '@shared/constants/tags-const';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialTagConfigsState, tagConfigsStateToken } from '../../settings/tag-configs/tag-configs-store';
import { initialSharesState, sharesStateToken } from '../../shares/shares-store';
import { List } from './list';

vi.mock('marked', () => ({ marked: { parse: () => '' } }));

describe('List', () => {
  let fixture: ComponentFixture<List>;
  let component: List;
  let portal: { open: ReturnType<typeof vi.fn> };
  let api: {
    searchItems: ReturnType<typeof vi.fn>;
    getMatchedItems: ReturnType<typeof vi.fn>;
    getRandomItem: ReturnType<typeof vi.fn>;
    getShares: ReturnType<typeof vi.fn>;
  };
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let scrollSpy: ReturnType<typeof vi.fn>;

  const buildFilters = (searchText: string) => {
    const search = searchText.trim();
    if (search === VIRTUAL_UNWATCHED_TAG) return { watched: false };
    if (search.startsWith('#')) return { tags: [search], tagMode: 'all' };
    return search ? { search } : {};
  };

  const buildItem = (title: string, IMDbId = title): CollectionItemModel => ({
    image: '',
    title,
    titleLower: title.toLowerCase(),
    genre: [],
    IMDbId,
    tags: [],
    year: null,
    rate: '',
    userRate: null,
    hash: '',
    actors: '',
    plot: '',
    listType: 'library',
  });

  beforeEach(() => {
    portal = { open: vi.fn() };
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
        { provide: ApiService, useValue: api },
        {
          provide: AiSearchService,
          useFactory: () => ({
            useAiSearch: signal(false),
            getMatchedIds: () => of(['tt-ai']),
            searchInProgress: signal(false),
            checkAiAvailable: vi.fn(() => of(true)),
          }),
        },
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialCollectionState, collectionStateToken),
        provideStore(initialTagConfigsState, tagConfigsStateToken),
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

  it('maps virtual unwatched search to watched=false server filter', async () => {
    vi.useFakeTimers();
    try {
      collectionState.setState('searchText', VIRTUAL_UNWATCHED_TAG);
      fixture.detectChanges();
      await fixture.whenStable();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).toHaveBeenLastCalledWith({ watched: false }, 0, 50);
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

  it('opens the new item dialog in watch later mode on the watch later page', () => {
    fixture.componentRef.setInput('listType', 'watch-later');
    fixture.detectChanges();

    component['onAddNew']();

    expect(portal.open).toHaveBeenCalledWith(expect.any(Function), { watchLater: true, wishlist: false });
  });

  it('opens the new item dialog in wishlist mode on the wishlist page', () => {
    fixture.componentRef.setInput('listType', 'wishlist');
    fixture.detectChanges();

    component['onAddNew']();

    expect(portal.open).toHaveBeenCalledWith(expect.any(Function), { watchLater: false, wishlist: true });
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
      fixture.componentRef.setInput('routeSearchText', WATCH_LATER_TAG);
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

      expect(api.searchItems).toHaveBeenCalledWith({ tags: [WATCH_LATER_TAG], tagMode: 'all' }, 1, 50);
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
});
