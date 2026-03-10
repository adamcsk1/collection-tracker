import { inject, Injectable } from '@angular/core';
import { searchCollection } from '@client/collection/utils/search-collection-util';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { mainStateToken } from '@client/main/main-store';
import { MOVIE_TAG, SERIES_TAG, VIRTUAL_TAGS, WATCHED_TAG } from '@shared/constants/tags-const';
import { affordableFuzzySearch, hasFuzzyMatch } from '@shared/utils/fuzzy-search-util';

const SEPARATOR = ' ### ';
const FUZZY_CONTENT_MAX_LENGTH = 250;

@Injectable()
export class SearchSuggestionService {
  private readonly appCollectionState = inject(mainCollectionStateToken);
  private readonly mainState = inject(mainStateToken);
  private readonly basicTagList = [...VIRTUAL_TAGS, WATCHED_TAG, MOVIE_TAG, SERIES_TAG];

  public getSuggestion(text: string, limit = 3): Array<string> {
    const lowerCasedText = text.toLowerCase();

    if (this.mainState.state.searchMode() === 'fuzzy' && affordableFuzzySearch(lowerCasedText)) {
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

  private fuzzySearch(lowerCasedText: string, text: string, limit: number): Array<string> {
    return Array.from(
      searchCollection(this.appCollectionState.state.collection(), limit, (collectionItem, results) => {
        if (text.startsWith('#')) {
          let hasTagMatch = false;
          for (const tag of collectionItem.tags) {
            if (hasFuzzyMatch(text, tag)) {
              results.add(tag);
              hasTagMatch = true;
              break;
            }
          }
          if (!hasTagMatch) {
            for (const tag of this.basicTagList) {
              if (hasFuzzyMatch(text, tag)) {
                results.add(tag);
                break;
              }
            }
          }
        } else {
          if (
            collectionItem.titleLower.includes(lowerCasedText) ||
            hasFuzzyMatch(lowerCasedText, collectionItem.titleLower)
          ) {
            results.add(`${collectionItem.title}${SEPARATOR}${collectionItem.IMDbId || collectionItem.title}`);
            return;
          }

          if (collectionItem.rawContentLower.includes(lowerCasedText)) {
            results.add(`${collectionItem.title}${SEPARATOR}${collectionItem.IMDbId || collectionItem.title}`);
            return;
          }

          if (collectionItem.rawContentLower.length <= FUZZY_CONTENT_MAX_LENGTH) {
            if (hasFuzzyMatch(lowerCasedText, collectionItem.rawContentLower)) {
              results.add(`${collectionItem.title}${SEPARATOR}${collectionItem.IMDbId || collectionItem.title}`);
            }
          }
        }
      })
    );
  }

  private standardSearch(lowerCasedText: string, text: string, limit: number): Array<string> {
    if (text === '#') return this.basicTagList;

    return Array.from(
      searchCollection(this.appCollectionState.state.collection(), limit, (collectionItem, results) => {
        if (text.startsWith('#')) {
          let hasTagMatch = false;
          for (const tag of collectionItem.tags) {
            if (tag.startsWith(text)) {
              results.add(tag);
              hasTagMatch = true;
              break;
            }
          }
          if (!hasTagMatch) {
            for (const tag of this.basicTagList) {
              if (tag.startsWith(text)) {
                results.add(tag);
                break;
              }
            }
          }
        } else if (collectionItem.rawContentLower.includes(lowerCasedText)) {
          results.add(`${collectionItem.title}${SEPARATOR}${collectionItem.IMDbId || collectionItem.title}`);
        }
      })
    );
  }
}
