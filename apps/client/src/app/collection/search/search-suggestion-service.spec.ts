import { TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { SearchSuggestionService } from './search-suggestion-service';

const buildItem = (overrides: Partial<CollectionItemModel>): CollectionItemModel => ({
  rawContent: overrides.rawContent || '',
  image: '',
  title: overrides.title || '',
  genre: overrides.genre || [],
  IMDbId: overrides.IMDbId || '',
  tags: overrides.tags || [],
  name: overrides.name || '',
  year: null,
  rate: '',
});

describe('SearchSuggestionService', () => {
  let service: SearchSuggestionService;
  let collectionState: NgxSimpleSignalStoreService<typeof initialMainCollectionState>;
  let mainState: NgxSimpleSignalStoreService<typeof initialMainState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SearchSuggestionService,
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
      ],
    });

    service = TestBed.inject(SearchSuggestionService);
    collectionState = TestBed.inject(mainCollectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialMainCollectionState
    >;
    mainState = TestBed.inject(mainStateToken) as NgxSimpleSignalStoreService<typeof initialMainState>;

    collectionState.setState('collection', [
      buildItem({
        tags: ['#action', '#space'],
        genre: ['Drama', 'Sci-Fi'],
        rawContent: 'Space drama content',
        title: 'Space Drama',
      }),
      buildItem({ tags: ['#action', '#spy'], genre: ['Thriller'], rawContent: 'Spy thriller', title: 'Spy' }),
      buildItem({ tags: ['#adventure'], genre: ['Documentary'], rawContent: 'Docu', title: 'Docu' }),
    ]);
  });

  it('suggests tags when searching with hash prefix', () => {
    const suggestions = service.getSuggestion('#a');

    expect(suggestions).toEqual(expect.arrayContaining(['#action', '#adventure']));
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it('suggests genres before titles when not using hash', () => {
    const suggestions = service.getSuggestion('dr');

    const formattedSuggestions = suggestions.map((suggestion) => service.formatSuggestionText(suggestion));

    expect(formattedSuggestions).toEqual(expect.arrayContaining(['Space Drama']));
  });

  it('falls back to raw content matches when genres miss', () => {
    const suggestions = service.getSuggestion('spy');

    const formattedSuggestions = suggestions.map((suggestion) => service.formatSuggestionText(suggestion));

    expect(formattedSuggestions).toContain('Spy');
  });

  it('returns fuzzy matches and formats values when search mode is fuzzy', () => {
    mainState.setState('searchMode', 'fuzzy');
    collectionState.setState('collection', [
      buildItem({ title: 'Gravity', rawContent: 'space thriller', IMDbId: 'tt1234567' }),
    ]);

    const suggestions = service.getSuggestion('gra');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(service.formatSuggestionText(suggestions[0])).toBe('Gravity');
    expect(service.formatSuggestionValue(suggestions[0])).toBe('tt1234567');
  });
});
