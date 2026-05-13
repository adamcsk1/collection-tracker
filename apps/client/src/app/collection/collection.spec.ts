import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { CollectionState, collectionStateToken, initialCollectionState } from './collection-store';
import { AiSearchService } from './search/ai-search-service';
import { AutocompleteService } from '@components/autocomplete/autocomplete';
import { FAVORITE_TAG } from '@shared/constants/tags-const';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from './collection';

vi.mock('marked', () => ({ marked: vi.fn(() => '') }));

describe('Collection component', () => {
  let fixture: ComponentFixture<Collection>;
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const createFixture = (queryParams: Record<string, unknown> = {}) => {
    queryParamMap = new BehaviorSubject(convertToParamMap(queryParams));
    TestBed.configureTestingModule({
      imports: [Collection],
      providers: [
        provideStore(initialCollectionState, collectionStateToken),
        { provide: AutocompleteService, useValue: { search: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams }, queryParamMap },
        },
        { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
      ],
    });

    TestBed.overrideComponent(Collection, {
      set: {
        template: '',
        providers: [
          provideStore(initialCollectionState, collectionStateToken),
          { provide: AutocompleteService, useValue: { search: vi.fn() } },
          {
            provide: AiSearchService,
            useFactory: () => ({
              useAiSearch: signal(false),
              getMatchedIds: () => of(null),
              searchInProgress: signal(false),
            }),
          },
        ],
      },
    });

    fixture = TestBed.createComponent(Collection);
    collectionState = fixture.debugElement.injector.get(collectionStateToken);
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
      imports: [Collection],
      providers: [
        provideStore(initialCollectionState, collectionStateToken),
        { provide: AutocompleteService, useValue: { search: vi.fn() } },
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

    TestBed.overrideComponent(Collection, {
      set: {
        template: '',
        providers: [
          provideStore(initialCollectionState, collectionStateToken),
          { provide: AutocompleteService, useValue: { search: vi.fn() } },
          {
            provide: AiSearchService,
            useFactory: () => ({
              useAiSearch: signal(false),
              getMatchedIds: () => of(null),
              searchInProgress: signal(false),
            }),
          },
        ],
      },
    });

    const freshFixture = TestBed.createComponent(Collection);
    const freshState = freshFixture.debugElement.injector.get(collectionStateToken);
    freshFixture.detectChanges();

    expect(freshState.state.searchText()).toBe('#action');
    expect(freshState.state.forceStandardSearch()).toBe(true);
    expect(routerNavigate).not.toHaveBeenCalled();
  });

  it('identifies the favorites query filter as the prefiltered favorites page', () => {
    queryParamMap.next(convertToParamMap({ search: FAVORITE_TAG }));
    fixture.detectChanges();

    expect(fixture.componentInstance['isFavoritePrefiltered']()).toBe(true);
  });

  it('does not treat other query filters as the prefiltered favorites page', () => {
    queryParamMap.next(convertToParamMap({ search: '#action' }));
    fixture.detectChanges();

    expect(fixture.componentInstance['isFavoritePrefiltered']()).toBe(false);
  });

  it('clears search text when query params no longer contain a search filter', () => {
    queryParamMap.next(convertToParamMap({ search: FAVORITE_TAG }));
    fixture.detectChanges();
    expect(collectionState.state.searchText()).toBe(FAVORITE_TAG);
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
});
