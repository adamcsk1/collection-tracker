import { inject, Injectable } from '@angular/core';
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
    const fuzzyMatchedItems: Set<string> = new Set([]);

    for (const item of this.appCollectionState.state.collection()) {
      for (const tag of item.tags) {
        if (['#movie', '#series'].includes(tag) || tags.includes(tag)) continue;
        const matchResults = fuzzySearch(text, tag, 1) || [];
        if (matchResults.length > 0) {
          fuzzyMatchedItems.add(tag);
          break;
        }
      }
      if (fuzzyMatchedItems.size >= limit) break;
    }

    return this.formatResult(fuzzyMatchedItems, tags, limit);
  }

  private standardSearch(tags: Array<string>, text: string, limit: number): Array<string> {
    const matchedItems: Set<string> = new Set([]);

    for (const item of this.appCollectionState.state.collection()) {
      for (const tag of item.tags) {
        if (['#movie', '#series'].includes(tag) || tags.includes(tag)) continue;
        if (tag.startsWith(text)) {
          matchedItems.add(tag);
          break;
        }
      }
      if (matchedItems.size >= limit) break;
    }

    return this.formatResult(matchedItems, tags, limit);
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
