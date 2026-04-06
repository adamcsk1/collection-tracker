import { inject, Injectable } from '@angular/core';
import { searchCollection } from '@client/collection/utils/search-collection-util';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { MOVIE_TAG, SERIES_TAG, VIRTUAL_TAGS, WATCHED_TAG } from '@shared/constants/tags-const';
import { affordableFuzzySearch, FUZZY_CONTENT_MAX_LENGTH, hasFuzzyMatch } from '@shared/utils/fuzzy-search-util';

const SEPARATOR = ' ### ';

@Injectable()
export class SearchSuggestionService {
  private readonly appCollectionState = inject(mainCollectionStateToken);
  private readonly basicTagList = [...VIRTUAL_TAGS, WATCHED_TAG, MOVIE_TAG, SERIES_TAG];

  public getSuggestion(text: string, limit = 3): string[] {
    const lowerCasedText = text.toLowerCase();

    if (affordableFuzzySearch(lowerCasedText)) {
      return this.fuzzySearch(lowerCasedText, text, limit);
    }
    return this.standardSearch(lowerCasedText, text, limit);
  }

  public formatSuggestionText(text: string): string {
    return text.split(SEPARATOR)[0];
  }

  public formatSuggestionValue(text: string): string {
    return text.includes(SEPARATOR) ? text.split(SEPARATOR)[1] : text;
  }

  private fuzzySearch(lowerCasedText: string, text: string, limit: number): string[] {
    return Array.from(
      searchCollection(this.appCollectionState.state.collection(), limit, (collectionItem, results) => {
        if (text.startsWith('#')) {
          this.addTagMatch(results, [...collectionItem.tags, ...this.basicTagList], (tag) => hasFuzzyMatch(text, tag));
        } else {
          const matchesTitle =
            collectionItem.titleLower.includes(lowerCasedText) ||
            hasFuzzyMatch(lowerCasedText, collectionItem.titleLower);
          const matchesContent =
            collectionItem.rawContentLower.includes(lowerCasedText) ||
            (collectionItem.rawContentLower.length <= FUZZY_CONTENT_MAX_LENGTH &&
              hasFuzzyMatch(lowerCasedText, collectionItem.rawContentLower));

          if (matchesTitle || matchesContent) {
            results.add(this.formatItemSuggestion(collectionItem));
          }
        }
      })
    );
  }

  private standardSearch(lowerCasedText: string, text: string, limit: number): string[] {
    if (text === '#') return this.basicTagList;

    return Array.from(
      searchCollection(this.appCollectionState.state.collection(), limit, (collectionItem, results) => {
        if (text.startsWith('#')) {
          this.addTagMatch(results, [...collectionItem.tags, ...this.basicTagList], (tag) => tag.startsWith(text));
        } else if (collectionItem.rawContentLower.includes(lowerCasedText)) {
          results.add(this.formatItemSuggestion(collectionItem));
        }
      })
    );
  }

  private addTagMatch(results: Set<string>, tags: string[], matches: (tag: string) => boolean): void {
    const match = tags.find(matches);
    if (match) results.add(match);
  }

  private formatItemSuggestion(collectionItem: { title: string; IMDbId: string }): string {
    return `${collectionItem.title}${SEPARATOR}${collectionItem.IMDbId || collectionItem.title}`;
  }
}
