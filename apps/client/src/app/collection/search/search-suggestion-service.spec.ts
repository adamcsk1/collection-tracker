import { TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SearchSuggestionService, provideStore(initialMainCollectionState, mainCollectionStateToken)],
    });

    service = TestBed.inject(SearchSuggestionService);
    collectionState = TestBed.inject(mainCollectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialMainCollectionState
    >;

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

    expect(suggestions).toEqual(expect.arrayContaining(['Drama']));
    expect(suggestions.some((item) => item === 'Space Drama')).toBe(false);
  });

  it('falls back to raw content matches when genres miss', () => {
    const suggestions = service.getSuggestion('spy');

    expect(suggestions).toContain('Spy');
  });
});
