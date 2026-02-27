import { inject, Injectable } from '@angular/core';
import { searchCollection } from '@client/collection/utils/search-collection-util';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { mainStateToken } from '@client/main/main-store';
import { affordableFuzzySearch, fuzzySearch } from '@shared/utils/fuzzy-search-util';

@Injectable()
export class TagSuggestionService {
  private readonly appCollectionState = inject(mainCollectionStateToken);
  private readonly mainState = inject(mainStateToken);

  public getSuggestion(text: string, limit = 3): Array<string> {
    const tags = text.split(' ').map((tag) => tag.trim());
    if (!tags.length) return [];

    const lastTag = tags.at(-1) || '';

    if (this.mainState.state.searchMode() === 'fuzzy' && affordableFuzzySearch(lastTag)) {
      return this.fuzzySearch(tags, lastTag, limit);
    }

    return this.standardSearch(tags, lastTag, limit);
  }

  public formatSuggestionText(text: string): string {
    return text.split(' ').at(-1) || '';
  }

  private fuzzySearch(tags: Array<string>, text: string, limit: number): Array<string> {
    return this.formatResult(
      searchCollection(this.appCollectionState.state.collection(), limit, (item, results) => {
        for (const tag of item.tags) {
          if (['#movie', '#series'].includes(tag) || tags.includes(tag)) continue;
          const matchResults = fuzzySearch(text, tag, 1) || [];
          if (matchResults.length > 0) {
            results.add(tag);
            break;
          }
        }
      }),
      tags,
      limit
    );
  }

  private standardSearch(tags: Array<string>, text: string, limit: number): Array<string> {
    return this.formatResult(
      searchCollection(this.appCollectionState.state.collection(), limit, (item, results) => {
        for (const tag of item.tags) {
          if (['#movie', '#series'].includes(tag) || tags.includes(tag)) continue;
          if (tag.startsWith(text)) {
            results.add(tag);
            break;
          }
        }
      }),
      tags,
      limit
    );
  }

  private formatResult(matchedItems: Set<string>, tags: Array<string>, limit: number): Array<string> {
    return Array.from(matchedItems)
      .slice(0, limit)
      .map((tag) => {
        tags[tags.length - 1] = tag;
        return tags.join(' ');
      });
  }
}
