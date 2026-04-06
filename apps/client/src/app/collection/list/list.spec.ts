import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ElementRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { CollectionState, collectionStateToken, initialCollectionState } from '@client/collection/collection-store';
import { ItemDialog } from '@client/collection/item-dialog/item-dialog';
import { INFINITE_SCROLL_PAGE_SIZE } from '@client/collection/list/infinite-scroll/infinite-scroll-const';
import { ClaudeSearchService } from '@client/collection/search/claude-search-service';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '@client/main/main-collection-store';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { VIRTUAL_UNWATCHED_TAG, WATCHED_TAG } from '@shared/constants/tags-const';
import * as randomIntUtil from '@shared/utils/random-int-util';
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
  let mainCollectionState: NgxSimpleSignalStoreService<MainCollectionState>;
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let scrollSpy: ReturnType<typeof vi.fn>;

  const buildItem = (name: string, rawContent = name): CollectionItemModel => ({
    rawContent,
    rawContentLower: rawContent.toLowerCase(),
    image: '',
    title: name,
    titleLower: name.toLowerCase(),
    genre: [],
    IMDbId: '',
    tags: [],
    name,
    year: null,
    rate: '',
    hash: '',
  });

  beforeEach(() => {
    portal = { open: vi.fn() };
    TestBed.configureTestingModule({
      imports: [List],
      providers: [
        { provide: PortalService, useValue: portal },
        {
          provide: ClaudeSearchService,
          useFactory: () => ({
            useClaudeAi: signal(false),
            getMatchedIds: () => of(null),
            searchInProgress: signal(false),
          }),
        },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        provideStore(initialApiState, apiStateToken),
        provideStore(initialCollectionState, collectionStateToken),
        provideSignalTranslateConfig({ path: '' }),
      ],
    });

    fixture = TestBed.createComponent(List);
    component = fixture.componentInstance;
    mainCollectionState = TestBed.inject(mainCollectionStateToken);
    collectionState = TestBed.inject(collectionStateToken);

    scrollSpy = vi.fn();
    (component as any).scrollContainer = () => ({ nativeElement: { scrollTo: scrollSpy } }) as ElementRef;
  });

  it('filters collection based on search text and resets scroll position', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(component as any, 'onResetScrollPosition');
      mainCollectionState.setState('collection', [buildItem('Alpha'), buildItem('Beta')]);
      collectionState.setState('searchText', 'be');

      await vi.runAllTimersAsync();
      fixture.detectChanges();

      const filtered = component['filteredCollection']();

      expect(filtered).toEqual([buildItem('Alpha'), buildItem('Beta')]);
      expect(component['onResetScrollPosition']).toHaveBeenCalled();
      expect(scrollSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens a random item from the filtered collection', () => {
    vi.spyOn(randomIntUtil, 'randomInt').mockReturnValue(1);
    mainCollectionState.setState('collection', [buildItem('First'), buildItem('Second'), buildItem('Third')]);

    component['onRandomPick']();

    expect(portal.open).toHaveBeenCalledWith(ItemDialog, {
      collectionItem: expect.objectContaining({ name: 'Second' }),
    });
  });

  it('loads more items when scrolled near the bottom', () => {
    const largeCollection = Array.from({ length: INFINITE_SCROLL_PAGE_SIZE * 2 }, (_, index) =>
      buildItem(`Item ${index}`)
    );
    mainCollectionState.setState('collection', largeCollection);

    const initialCount = component['visibleCollection']().length;
    const element = { scrollHeight: 1000, scrollTop: 850, clientHeight: 100 };
    (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

    component['onScroll']();

    expect(component['visibleCollection']().length).toBeGreaterThan(initialCount);
  });

  it('does not load more when all items are already visible', () => {
    mainCollectionState.setState('collection', [buildItem('Only')]);

    const element = { scrollHeight: 100, scrollTop: 0, clientHeight: 100 };
    (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;

    component['onScroll']();

    expect(component['visibleCollection']().length).toBe(1);
  });

  it('resets visible count and scroll position when search text changes', async () => {
    vi.useFakeTimers();
    try {
      const largeCollection = Array.from({ length: INFINITE_SCROLL_PAGE_SIZE * 2 }, (_, index) =>
        buildItem(`Item ${index}`)
      );
      mainCollectionState.setState('collection', largeCollection);

      const element = { scrollHeight: 1000, scrollTop: 850, clientHeight: 100, scrollTo: scrollSpy };
      (component as any).scrollContainer = () => ({ nativeElement: element }) as ElementRef;
      component['onScroll']();
      const countAfterScroll = component['visibleCollection']().length;

      collectionState.setState('searchText', 'item');
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(component['visibleCollection']().length).toBeLessThan(countAfterScroll);
      expect(scrollSpy).toHaveBeenCalledWith({ top: 0, left: 1000, behavior: 'smooth' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows only unwatched items for virtual tag search', async () => {
    mainCollectionState.setState('collection', [
      { ...buildItem('Item One', `Alpha ${WATCHED_TAG} watch-list`), tags: [VIRTUAL_UNWATCHED_TAG] },
      buildItem('Item Two', 'Beta'),
    ]);

    vi.useFakeTimers();
    try {
      collectionState.setState('searchText', VIRTUAL_UNWATCHED_TAG);
      await vi.runAllTimersAsync();

      expect(component['filteredCollection']().map((item) => item.name)).toEqual(['Item One', 'Item Two']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('switches to standard text search when forceStandardSearch is enabled', async () => {
    mainCollectionState.setState('collection', [buildItem('Item One', 'apple'), buildItem('Item Two', 'other')]);

    vi.useFakeTimers();
    try {
      collectionState.setState('searchText', 'applx');
      collectionState.setState('forceStandardSearch', false);
      await vi.runAllTimersAsync();

      expect(component['filteredCollection']().map((item) => item.name)).toEqual(['Item One', 'Item Two']);

      collectionState.setState('forceStandardSearch', true);
      expect(component['filteredCollection']().map((item) => item.name)).toEqual(['Item One', 'Item Two']);
    } finally {
      vi.useRealTimers();
    }
  });
});
