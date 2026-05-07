import { ElementRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '../collection-model';
import { CollectionState, collectionStateToken, initialCollectionState } from '../collection-store';
import { ItemDialog } from '../item-dialog/item-dialog';
import { AiSearchService } from '../search/ai-search-service';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { VIRTUAL_UNWATCHED_TAG } from '@shared/constants/tags-const';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  };
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let scrollSpy: ReturnType<typeof vi.fn>;

  const buildItem = (title: string, IMDbId = title): CollectionItemModel => ({
    image: '',
    title,
    titleLower: title.toLowerCase(),
    genre: [],
    IMDbId,
    tags: [],
    year: null,
    rate: '',
    hash: '',
    actors: '',
    plot: '',
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
          }),
        },
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialCollectionState, collectionStateToken),
        provideSignalTranslateConfig({ path: '' }),
      ],
    });

    TestBed.overrideComponent(List, { set: { template: '' } });

    fixture = TestBed.createComponent(List);
    component = fixture.componentInstance;
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
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.searchItems).toHaveBeenLastCalledWith({ search: 'be' }, 0, 50);
      expect(component['visibleCollection']().map((item) => item.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
      expect(scrollSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('maps virtual unwatched search to watched=false server filter', async () => {
    vi.useFakeTimers();
    try {
      collectionState.setState('searchText', VIRTUAL_UNWATCHED_TAG);
      await vi.runAllTimersAsync();

      expect(api.searchItems).toHaveBeenLastCalledWith({ watched: false }, 0, 50);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens a random item from the server', async () => {
    fixture.detectChanges();

    component['onRandomPick']();

    expect(api.getRandomItem).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(ItemDialog, {
      collectionItem: expect.objectContaining({ title: 'Random Pick' }),
    });
  });

  it('loads more items when scrolled near the bottom', () => {
    component['collectionLength'].set(6);
    component['visibleCollection'].set([buildItem('One')]);
    const element = { scrollHeight: 1000, scrollTop: 850, clientHeight: 100 };
    (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

    component['onScroll']();

    expect(api.searchItems).toHaveBeenCalledWith({}, 1, 50);
  });

  it('requests matched items for AI search results', () => {
    const aiSearch = TestBed.inject(AiSearchService);
    aiSearch.useAiSearch.set(true);
    collectionState.setState('aiSearchPromptText', 'space');
    (component as any).aiSearchMatchedIds = () => ['tt-ai'];
    component['loadItems'](true);

    expect(api.getMatchedItems).toHaveBeenCalled();
  });

  it('does not clear the list or fire a request while AI search results are still loading', () => {
    component['visibleCollection'].set([buildItem('Keep')]);
    const aiSearch = TestBed.inject(AiSearchService);
    aiSearch.useAiSearch.set(true);
    collectionState.setState('aiSearchPromptText', 'loading...');
    (component as any).aiSearchMatchedIds = () => null;
    component['loadItems'](true);

    expect(api.searchItems).not.toHaveBeenCalled();
    expect(api.getMatchedItems).not.toHaveBeenCalled();
    expect(component['visibleCollection']().map((item) => item.title)).toEqual(['Keep']);
  });
});
