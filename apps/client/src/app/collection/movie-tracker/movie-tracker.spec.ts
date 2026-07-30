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
import { MovieTracker } from './movie-tracker';

describe('MovieTracker', () => {
  let fixture: ComponentFixture<MovieTracker>;
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

  const createFixture = (searchText = '', queryParams: Record<string, string> = {}) => {
    TestBed.configureTestingModule({
      imports: [MovieTracker],
      providers: [
        provideStore({ ...initialCollectionState, searchText }, collectionStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: api },
        {
          provide: AiSearchService,
          useValue: {
            setListType: vi.fn(),
            getMatchedIds: () => of(null),
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

    TestBed.overrideComponent(MovieTracker, {
      set: {
        template: '<ng-template #floatSearch></ng-template>',
      },
    });

    fixture = TestBed.createComponent(MovieTracker);
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

    createFixture('', { search: '#unwatched' });

    expect(collectionState.state.searchText()).toBe('#unwatched');
    expect(fixture.componentInstance['searchTextModel']()).toBe('#unwatched');
  });

  it('syncs search text from store to the control', () => {
    collectionState.setState('searchText', 'inception');
    fixture.detectChanges();

    expect(fixture.componentInstance['searchTextModel']()).toBe('inception');
  });

  it('persists search text changes back to the store', () => {
    fixture.componentInstance['searchTextModel'].set('interstellar');
    fixture.detectChanges();

    expect(collectionState.state.searchText()).toBe('interstellar');
  });

  it('searches movie tracker items by standard text', () => {
    fixture.componentInstance['movieTrackerDataSource'](dataSourceRequest(' dark ', 10, 25));

    expect(api.searchItems).toHaveBeenCalledWith(
      { search: 'dark', listType: 'movie-tracker', orderBy: 'createdAt', orderDirection: 'desc' },
      10,
      25
    );
  });

  it('searches movie tracker items by tag', () => {
    fixture.componentInstance['movieTrackerDataSource'](dataSourceRequest('#action'));

    expect(api.searchItems).toHaveBeenCalledWith(
      { tags: ['#action'], tagMode: 'all', listType: 'movie-tracker', orderBy: 'createdAt', orderDirection: 'desc' },
      0,
      50
    );
  });

  it('searches movie tracker items without a text filter by default', () => {
    fixture.componentInstance['movieTrackerDataSource'](dataSourceRequest(''));

    expect(api.searchItems).toHaveBeenCalledWith(
      { listType: 'movie-tracker', orderBy: 'createdAt', orderDirection: 'desc' },
      0,
      50
    );
  });

  it('registers and clears the float search template', () => {
    expect(floatActions.searchTemplate()).toBeTruthy();

    fixture.destroy();

    expect(floatActions.searchTemplate()).toBeNull();
  });

  it('opens the movie tracker dialog from the empty CTA', () => {
    const event = new Event('click');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddMovieTracker'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { movieTracker: true });
  });
});
