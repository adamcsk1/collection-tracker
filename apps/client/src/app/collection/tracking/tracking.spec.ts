import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { collectionStateToken, initialCollectionState, type CollectionState } from '../collection-store';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { AiSearchService } from '../search/ai-search-service';
import { Tracking } from './tracking';

describe('Tracking', () => {
  let fixture: ComponentFixture<Tracking>;
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let floatActions: FloatActionsService;
  const portal = { open: vi.fn() };
  const api = {
    searchItems: vi.fn(() => of({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } })),
  };
  const dataSourceRequest = (searchText: string, cursor: string | null = null, limit = 50) => ({
    reset: true,
    cursor,
    limit,
    searchText,
    orderBy: 'createdAt' as const,
    orderDirection: 'desc' as const,
  });

  const createFixture = (searchText = '', queryParams: Record<string, string> = {}) => {
    TestBed.configureTestingModule({
      imports: [Tracking],
      providers: [
        provideStore({ ...initialCollectionState, searchText }, collectionStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: api },
        {
          provide: AiSearchService,
          useValue: {
            getMatchedIds: () => of({ status: 'idle' }),
            searchInProgress: signal(false),
            checkAiAvailable: vi.fn(() => of(true)),
          },
        },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParams },
            queryParamMap: of({ get: (key: string) => queryParams[key] ?? null }),
          },
        },
      ],
    });

    TestBed.overrideComponent(Tracking, {
      set: {
        template: '<ng-template #floatSearch></ng-template>',
      },
    });

    fixture = TestBed.createComponent(Tracking);
    collectionState = fixture.debugElement.injector.get(collectionStateToken);
    floatActions = TestBed.inject(FloatActionsService);
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createFixture();
  });

  it('clears stale shared search text when created', () => {
    TestBed.resetTestingModule();

    createFixture('library search');

    expect(collectionState.state.searchText()).toBe('');
    expect(fixture.componentInstance['searchTextModel']()).toBe('');
  });

  it('initializes search text from query param when present', () => {
    TestBed.resetTestingModule();

    createFixture('', { search: '#uncompleted' });

    expect(collectionState.state.searchText()).toBe('#uncompleted');
    expect(fixture.componentInstance['searchTextModel']()).toBe('#uncompleted');
  });

  it('syncs search text from store to the control', () => {
    collectionState.setState('searchText', 'fringe');
    fixture.detectChanges();

    expect(fixture.componentInstance['searchTextModel']()).toBe('fringe');
  });

  it('persists search text changes back to the store', () => {
    fixture.componentInstance['searchTextModel'].set('lost');
    fixture.detectChanges();

    expect(collectionState.state.searchText()).toBe('lost');
  });

  it('derives initial tracking page state', () => {
    expect(fixture.componentInstance['activeMediaChip']()).toBe('all');
    expect(fixture.componentInstance['emptyIcon']()).toBe('local_library');
    expect(fixture.componentInstance['mediaChips']).toEqual(['all', 'movie', 'series', 'book', 'album']);
    expect(fixture.componentInstance['translations'].messageEmptyTracking()).toBe('Message.EmptyTracking');
    expect(fixture.componentInstance['translations'].messageAddFirstTracking()).toBe('Message.AddFirstTracking');
    expect(fixture.componentInstance['translations'].placeholderSearchInTracking()).toBe(
      'Placeholder.SearchInTracking'
    );
    expect(fixture.componentInstance['translations'].placeholderReply()).toBe('Placeholder.Reply');
  });

  it.each([
    ['movie', 'movie'],
    ['series', 'live_tv'],
    ['book', 'menu_book'],
  ] as const)('derives %s media state from route filters', (contentType, expectedIcon) => {
    TestBed.resetTestingModule();
    createFixture('', { type: contentType });

    expect(fixture.componentInstance['activeMediaChip']()).toBe(contentType);
    expect(fixture.componentInstance['emptyIcon']()).toBe(expectedIcon);
    expect(fixture.componentInstance['forceStandardSearch']()).toBe(true);
  });

  it('forces standard search when collection state requests it', () => {
    collectionState.setState('forceStandardSearch', true);

    expect(fixture.componentInstance['forceStandardSearch']()).toBe(true);
  });

  it('searches tracking items by standard text', () => {
    fixture.componentInstance['trackingDataSource'](dataSourceRequest(' dark ', 'next-page', 25));

    expect(api.searchItems).toHaveBeenCalledWith(
      { search: 'dark', listType: 'tracking', orderBy: 'createdAt', orderDirection: 'desc' },
      'next-page',
      25
    );
  });

  it('searches tracking items by tag', () => {
    fixture.componentInstance['trackingDataSource'](dataSourceRequest('#drama'));

    expect(api.searchItems).toHaveBeenCalledWith(
      { tags: ['#drama'], tagMode: 'all', listType: 'tracking', orderBy: 'createdAt', orderDirection: 'desc' },
      null,
      50
    );
  });

  it('treats old virtual unwatched search as a custom tag filter', () => {
    fixture.componentInstance['trackingDataSource'](dataSourceRequest('#unwatched'));

    expect(api.searchItems).toHaveBeenCalledWith(
      {
        tags: ['#unwatched'],
        tagMode: 'all',
        listType: 'tracking',
        orderBy: 'createdAt',
        orderDirection: 'desc',
      },
      null,
      50
    );
  });

  it('merges completed query filters into tracking searches', () => {
    TestBed.resetTestingModule();
    createFixture('', { completed: 'false' });

    fixture.componentInstance['trackingDataSource'](dataSourceRequest(''));

    expect(api.searchItems).toHaveBeenCalledWith(
      { completed: false, listType: 'tracking', orderBy: 'createdAt', orderDirection: 'desc' },
      null,
      50
    );
  });

  it('searches tracking items without a text filter by default', () => {
    fixture.componentInstance['trackingDataSource'](dataSourceRequest(''));

    expect(api.searchItems).toHaveBeenCalledWith(
      { listType: 'tracking', orderBy: 'createdAt', orderDirection: 'desc' },
      null,
      50
    );
  });

  it('registers and clears the float search template', () => {
    expect(floatActions.searchTemplate()).toBeTruthy();

    fixture.destroy();

    expect(floatActions.searchTemplate()).toBeNull();
  });

  it('opens the tracking dialog from the empty CTA', () => {
    const event = new Event('click');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddTracking'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { tracking: true });
  });
});
