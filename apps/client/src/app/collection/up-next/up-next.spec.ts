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
import { UpNext } from './up-next';

describe('UpNext', () => {
  let fixture: ComponentFixture<UpNext>;
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
      imports: [UpNext],
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

    TestBed.overrideComponent(UpNext, {
      set: {
        template: '<ng-template #floatSearch></ng-template>',
      },
    });

    fixture = TestBed.createComponent(UpNext);
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

  it('syncs search text from store to the control', () => {
    collectionState.setState('searchText', 'matrix');
    fixture.detectChanges();

    expect(fixture.componentInstance['searchTextModel']()).toBe('matrix');
  });

  it('persists search text changes back to the store', () => {
    fixture.componentInstance['searchTextModel'].set('alien');
    fixture.detectChanges();

    expect(collectionState.state.searchText()).toBe('alien');
  });

  it('derives initial up-next page state', () => {
    expect(fixture.componentInstance['activeMediaChip']()).toBe('all');
    expect(fixture.componentInstance['emptyIcon']()).toBe('local_library');
    expect(fixture.componentInstance['mediaChips']).toEqual(['all', 'movie', 'series', 'book']);
    expect(fixture.componentInstance['translations'].messageEmptyUpNext()).toBe('Message.EmptyUpNext');
    expect(fixture.componentInstance['translations'].messageAddFirstUpNext()).toBe('Message.AddFirstUpNext');
    expect(fixture.componentInstance['translations'].placeholderSearchInUpNext()).toBe('Placeholder.SearchInUpNext');
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

  it('searches watch later items by standard text', () => {
    fixture.componentInstance['upNextDataSource'](dataSourceRequest(' alien ', 'next-page', 25));

    expect(api.searchItems).toHaveBeenCalledWith(
      { search: 'alien', listType: 'up-next', orderBy: 'createdAt', orderDirection: 'desc' },
      'next-page',
      25
    );
  });

  it('merges type query filters into watch later searches', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [UpNext],
      providers: [
        provideStore(initialCollectionState, collectionStateToken),
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
          useValue: { snapshot: { queryParams: { type: 'movie' } }, queryParamMap: of({ get: () => 'movie' }) },
        },
      ],
    });
    TestBed.overrideComponent(UpNext, { set: { template: '<ng-template #floatSearch></ng-template>' } });
    fixture = TestBed.createComponent(UpNext);
    fixture.detectChanges();

    fixture.componentInstance['upNextDataSource'](dataSourceRequest(''));

    expect(api.searchItems).toHaveBeenCalledWith(
      { type: 'movie', listType: 'up-next', orderBy: 'createdAt', orderDirection: 'desc' },
      null,
      50
    );
  });

  it('registers and clears the float search template', () => {
    expect(floatActions.searchTemplate()).toBeTruthy();

    fixture.destroy();

    expect(floatActions.searchTemplate()).toBeNull();
  });

  it('opens the watch later dialog from the empty CTA', () => {
    const event = new Event('click');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddUpNext'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { upNext: true });
  });
});
