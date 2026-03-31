import { TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '@client/main/main-collection-store';
import { initialMainState, mainStateToken } from '@client/main/main-store';
import { MOVIE_TAG, SERIES_TAG } from '@shared/constants/tags-const';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagSuggestionService } from './tag-suggestion-service';

const buildItem = (tags: string[]): CollectionItemModel => ({
  rawContent: '',
  rawContentLower: '',
  image: '',
  title: '',
  titleLower: '',
  genre: [],
  IMDbId: '',
  tags,
  name: '',
  year: null,
  rate: '',
  hash: '',
});

describe('TagSuggestionService', () => {
  let service: TagSuggestionService;
  let collectionState: NgxSimpleSignalStoreService<MainCollectionState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TagSuggestionService,
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
      ],
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

  it('excludes internal movie and series tags from suggestions', () => {
    collectionState.setState('collection', [buildItem(['#movie', '#series', '#space', '#series'])]);

    const suggestions = service.getSuggestion('#s');

    expect(suggestions).toEqual(expect.arrayContaining(['#space']));
    expect(suggestions).not.toContain(MOVIE_TAG);
    expect(suggestions).not.toContain(SERIES_TAG);
  });

  it('returns empty list when no tags match', () => {
    collectionState.setState('collection', [buildItem(['#movie'])]);

    expect(service.getSuggestion('')).toEqual([]);
  });

  it('formats suggestion by taking the last token', () => {
    expect(service.formatSuggestionText('alpha beta gamma')).toBe('gamma');
  });

  it('uses fuzzy search mode and honors the limit', () => {
    collectionState.setState('collection', [
      buildItem(['#movie', '#space', '#spice']),
      buildItem(['#series', '#span', '#spoke', '#spike']),
    ]);

    const suggestions = service.getSuggestion('find #spa');

    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(suggestions.every((text) => text.startsWith('find '))).toBe(true);
    expect(suggestions.join(' ')).not.toContain('#movie');
  });
});
