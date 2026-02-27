import { inject, Injectable } from '@angular/core';
import { searchCollection } from '@client/collection/utils/search-collection-util';
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
    return Array.from(
      searchCollection(this.appCollectionState.state.collection(), limit, (item, results) => {
        if (text.startsWith('#')) {
          for (const tag of item.tags) {
            const matchResults = fuzzySearch(text, tag) || [];
            if (matchResults.length > 0) {
              results.add(tag);
              break;
            }
          }
        } else {
          const matchResults =
            fuzzySearch(lowerCasedText, item.title.toLowerCase()) ||
            fuzzySearch(lowerCasedText, item.rawContent.toLowerCase()) ||
            [];
          if (matchResults.length > 0) results.add(`${item.title}${SEPARATOR}${item.IMDbId || item.title}`);
        }
      })
    );
  }

  private standardSearch(lowerCasedText: string, text: string, limit: number): Array<string> {
    return Array.from(
      searchCollection(this.appCollectionState.state.collection(), limit, (item, results) => {
        if (text.startsWith('#')) {
          for (const tag of item.tags) {
            if (tag.startsWith(text)) {
              results.add(tag);
              break;
            }
          }
        } else if (item.rawContent.toLowerCase().includes(lowerCasedText)) {
          results.add(`${item.title}${SEPARATOR}${item.IMDbId || item.title}`);
        }
      })
    );
  }
}
