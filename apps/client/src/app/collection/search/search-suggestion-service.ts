import { inject, Injectable } from '@angular/core';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { mainStateToken } from '@client/main/main-store';
import { affordableFuzzySearch, fuzzySearch } from '@shared/utils/fuzzy-search-util';

const SEPARATOR = ' ### ';

@Injectable()
export class SearchSuggestionService {
  private readonly appCollectionState = inject(mainCollectionStateToken);
  private readonly mainState = inject(mainStateToken);

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
    const fuzzyMatchedItems: Set<string> = new Set([]);

    for (const item of this.appCollectionState.state.collection()) {
      if (text.startsWith('#')) {
        for (const tag of item.tags) {
          const matchResults = fuzzySearch(text, tag) || [];
          if (matchResults.length > 0) {
            fuzzyMatchedItems.add(tag);
            break;
          }
        }
      } else {
        let matchResults =
          fuzzySearch(lowerCasedText, item.title.toLowerCase()) ||
          fuzzySearch(lowerCasedText, item.rawContent.toLowerCase()) ||
          [];
        if (matchResults.length > 0) fuzzyMatchedItems.add(`${item.title}${SEPARATOR}${item.IMDbId || item.title}`);
      }

      if (fuzzyMatchedItems.size >= limit) break;
    }

    return Array.from(fuzzyMatchedItems);
  }

  private standardSearch(lowerCasedText: string, text: string, limit: number): Array<string> {
    const matchedItems: Set<string> = new Set([]);

    for (const item of this.appCollectionState.state.collection()) {
      if (text.startsWith('#')) {
        for (const tag of item.tags) {
          if (tag.startsWith(text)) {
            matchedItems.add(tag);
            break;
          }
        }
      } else if (item.rawContent.toLowerCase().includes(lowerCasedText)) {
        matchedItems.add(`${item.title}${SEPARATOR}${item.IMDbId || item.title}`);
      }

      if (matchedItems.size >= limit) break;
    }

    return Array.from(matchedItems);
  }
}
