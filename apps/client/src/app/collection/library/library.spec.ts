import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { AutocompleteService } from '@components/autocomplete/autocomplete';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { CollectionState, collectionStateToken, initialCollectionState } from '../collection-store';
import { AiSearchService } from '../search/ai-search-service';
import { CollectionLibrary } from './library';

vi.mock('marked', () => ({ marked: vi.fn(() => '') }));

describe('Collection library component', () => {
  let fixture: ComponentFixture<CollectionLibrary>;
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let floatActions: FloatActionsService;
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const api = {
    searchItems: vi.fn(() => of({ items: [], total: 0, offset: 0, limit: 50 })),
    getMatchedItems: vi.fn(() => of({ items: [], total: 0, offset: 0, limit: 50 })),
    getRandomItem: vi.fn(),
  };

  const createFixture = (queryParams: Record<string, unknown> = {}) => {
    queryParamMap = new BehaviorSubject(convertToParamMap(queryParams));
    TestBed.configureTestingModule({
      imports: [CollectionLibrary],
      providers: [
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialCollectionState, collectionStateToken),
        { provide: ApiService, useValue: api },
        { provide: PortalService, useValue: { open: vi.fn() } },
        { provide: AutocompleteService, useValue: { search: vi.fn() } },
        {
          provide: AiSearchService,
          useFactory: () => ({
            useAiSearch: signal(false),
            getMatchedIds: () => of(null),
            searchInProgress: signal(false),
            checkAiAvailable: vi.fn(() => of(true)),
          }),
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams }, queryParamMap },
        },
        { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      ],
    });

    TestBed.overrideComponent(CollectionLibrary, {
      set: {
        template: '<ng-template #floatSearch></ng-template>',
      },
    });

    fixture = TestBed.createComponent(CollectionLibrary);
    collectionState = fixture.debugElement.injector.get(collectionStateToken);
    floatActions = TestBed.inject(FloatActionsService);
    fixture.detectChanges();
  };

  beforeEach(() => {
    createFixture();
  });

  it('syncs search text from store to the control', async () => {
    collectionState.setState('searchText', 'neo');
    fixture.detectChanges();

    expect(fixture.componentInstance['searchTextModel']()).toBe('neo');
  });

  it('persists search text changes back to the store', async () => {
    fixture.componentInstance['searchTextModel'].set('trinity');
    fixture.detectChanges();

    expect(collectionState.state.searchText()).toBe('trinity');
  });

  it('initializes search text from query params and keeps the URL filter', () => {
    const routerNavigate = vi.fn(() => Promise.resolve(true));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CollectionLibrary],
      providers: [
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialCollectionState, collectionStateToken),
        { provide: ApiService, useValue: api },
        { provide: PortalService, useValue: { open: vi.fn() } },
        { provide: AutocompleteService, useValue: { search: vi.fn() } },
        {
          provide: AiSearchService,
          useFactory: () => ({
            useAiSearch: signal(false),
            getMatchedIds: () => of(null),
            searchInProgress: signal(false),
            checkAiAvailable: vi.fn(() => of(true)),
          }),
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParams: { search: '#action' } },
            queryParamMap: of(convertToParamMap({ search: '#action' })),
          },
        },
        { provide: Router, useValue: { navigate: routerNavigate } },
      ],
    });

    TestBed.overrideComponent(CollectionLibrary, {
      set: {
        template: '<ng-template #floatSearch></ng-template>',
      },
    });

    const freshFixture = TestBed.createComponent(CollectionLibrary);
    const freshState = freshFixture.debugElement.injector.get(collectionStateToken);
    freshFixture.detectChanges();

    expect(freshState.state.searchText()).toBe('#action');
    expect(freshState.state.forceStandardSearch()).toBe(true);
    expect(routerNavigate).not.toHaveBeenCalled();
  });

  it('clears search text when query params no longer contain a search filter', () => {
    queryParamMap.next(convertToParamMap({ search: '#action' }));
    fixture.detectChanges();
    expect(collectionState.state.searchText()).toBe('#action');
    expect(collectionState.state.forceStandardSearch()).toBe(true);

    queryParamMap.next(convertToParamMap({}));
    fixture.detectChanges();

    expect(collectionState.state.searchText()).toBe('');
    expect(collectionState.state.forceStandardSearch()).toBe(false);
  });

  it('does not force standard search again when a suggestion is accepted in standard search mode', () => {
    collectionState.setState('forceStandardSearch', false);

    fixture.componentInstance['onSearchAccepted']();

    expect(collectionState.state.forceStandardSearch()).toBe(false);
  });

  it('does not reset standard search state again while typing', () => {
    collectionState.setState('forceStandardSearch', false);
    const setStateSpy = vi.spyOn(collectionState, 'setState');

    fixture.componentInstance['onSearchFromUser']();

    expect(setStateSpy).not.toHaveBeenCalledWith('forceStandardSearch', false);
  });

  it('registers and clears the float search template', () => {
    expect(floatActions.searchTemplate()).toBeTruthy();

    fixture.destroy();

    expect(floatActions.searchTemplate()).toBeNull();
  });
});
