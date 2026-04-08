import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { CollectionState, collectionStateToken, initialCollectionState } from './collection-store';
import { ClaudeSearchService } from './search/claude-search-service';
import { AutocompleteService } from '@components/autocomplete/autocomplete';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from './collection';

vi.mock('marked', () => ({ marked: vi.fn(() => '') }));

describe('Collection component', () => {
  let fixture: ComponentFixture<Collection>;
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Collection],
      providers: [
        provideStore(initialCollectionState, collectionStateToken),
        { provide: AutocompleteService, useValue: { search: vi.fn() } },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
      ],
    });

    TestBed.overrideComponent(Collection, {
      set: {
        template: '',
        providers: [
          provideStore(initialCollectionState, collectionStateToken),
          { provide: AutocompleteService, useValue: { search: vi.fn() } },
          {
            provide: ClaudeSearchService,
            useFactory: () => ({
              useClaudeAi: signal(false),
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
});
