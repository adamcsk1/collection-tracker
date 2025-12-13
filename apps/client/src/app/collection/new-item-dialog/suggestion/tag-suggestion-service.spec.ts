import { TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagSuggestionService } from './tag-suggestion-service';

const buildItem = (tags: Array<string>): CollectionItemModel => ({
  rawContent: '',
  image: '',
  title: '',
  genre: [],
  IMDbId: '',
  tags,
  name: '',
  year: null,
  rate: '',
});

describe('TagSuggestionService', () => {
  let service: TagSuggestionService;
  let collectionState: NgxSimpleSignalStoreService<typeof initialMainCollectionState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TagSuggestionService, provideStore(initialMainCollectionState, mainCollectionStateToken)],
    });

    service = TestBed.inject(TagSuggestionService);
    collectionState = TestBed.inject(mainCollectionStateToken);
  });

  it('suggests up to three unique tags replacing the last token', () => {
    collectionState.setState('collection', [
      buildItem(['#movie', '#scifi', '#scary', '#space']),
      buildItem(['#series', '#scifi', '#science', '#scary']),
    ]);

    const suggestions = service.getSuggestion('find #sc');

    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(suggestions.every((text) => text.startsWith('find '))).toBe(true);
    expect(suggestions.join(' ')).not.toContain('#movie');
  });

  it('returns empty list when no tags match', () => {
    collectionState.setState('collection', [buildItem(['#movie'])]);

    expect(service.getSuggestion('')).toEqual([]);
  });

  it('formats suggestion by taking the last token', () => {
    expect(service.formatSuggestionText('alpha beta gamma')).toBe('gamma');
  });
});
