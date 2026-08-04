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
import { CollectionState, collectionStateToken, initialCollectionState } from '../collection-store';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { AiSearchService } from '../search/ai-search-service';
import { Watchlist } from './watch-later';

describe('Watchlist', () => {
  let fixture: ComponentFixture<Watchlist>;
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let floatActions: FloatActionsService;
  const portal = { open: vi.fn() };
  const api = {
    searchItems: vi.fn(() => of({ items: [], total: 0, offset: 0, limit: 50 })),
  };
  const dataSourceRequest = (searchText: string, offset = 0, limit = 50) => ({
    reset: true,
    offset,
    limit,
    searchText,
    orderBy: 'createdAt' as const,
    orderDirection: 'desc' as const,
  });

  const createFixture = (searchText = '') => {
    TestBed.configureTestingModule({
      imports: [Watchlist],
      providers: [
        provideStore({ ...initialCollectionState, searchText }, collectionStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: api },
        {
          provide: AiSearchService,
          useValue: {
            getMatchedIds: () => of(null),
            searchInProgress: signal(false),
            checkAiAvailable: vi.fn(() => of(true)),
          },
        },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams: {} }, queryParamMap: of({ get: () => null }) },
        },
      ],
    });

    TestBed.overrideComponent(Watchlist, {
      set: {
        template: '<ng-template #floatSearch></ng-template>',
      },
    });

    fixture = TestBed.createComponent(Watchlist);
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

  it('searches watch later items by standard text', () => {
    fixture.componentInstance['watchlistDataSource'](dataSourceRequest(' alien ', 10, 25));

    expect(api.searchItems).toHaveBeenCalledWith(
      { search: 'alien', listType: 'watchlist', orderBy: 'createdAt', orderDirection: 'desc' },
      10,
      25
    );
  });

  it('merges type query filters into watch later searches', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Watchlist],
      providers: [
        provideStore(initialCollectionState, collectionStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: api },
        {
          provide: AiSearchService,
          useValue: {
            getMatchedIds: () => of(null),
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
    TestBed.overrideComponent(Watchlist, { set: { template: '<ng-template #floatSearch></ng-template>' } });
    fixture = TestBed.createComponent(Watchlist);
    fixture.detectChanges();

    fixture.componentInstance['watchlistDataSource'](dataSourceRequest(''));

    expect(api.searchItems).toHaveBeenCalledWith(
      { type: 'movie', listType: 'watchlist', orderBy: 'createdAt', orderDirection: 'desc' },
      0,
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

    fixture.componentInstance['onAddWatchlist'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { watchlist: true });
  });
});
